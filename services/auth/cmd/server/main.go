package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/crm-magico/auth/internal/handler"
	"github.com/crm-magico/auth/internal/middleware"
	"github.com/crm-magico/auth/internal/migrate"
	"github.com/crm-magico/auth/internal/model"
	"github.com/crm-magico/auth/internal/repository"
	"github.com/crm-magico/auth/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

func main() {
	ctx := context.Background()

	// ── Banco de Dados ──────────────────────────────────────────
	db, err := pgxpool.New(ctx, mustEnv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("postgres connect: %v", err)
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		log.Fatalf("postgres ping: %v", err)
	}

	if err := migrate.Run(ctx, db); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	// ── Redis ────────────────────────────────────────────────────
	redisOpts, err := redis.ParseURL(mustEnv("REDIS_URL"))
	if err != nil {
		log.Fatalf("redis parse url: %v", err)
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	// ── Wiring ───────────────────────────────────────────────────
	userRepo    := repository.NewUserRepository(db)
	companyRepo := repository.NewCompanyRepository(db)
	deptRepo    := repository.NewDepartmentRepository(db)

	authSvc := service.NewAuthService(
		userRepo,
		rdb,
		mustEnv("JWT_SECRET"),
		parseDuration("JWT_EXPIRY", 15*time.Minute),
		parseDuration("REFRESH_EXPIRY", 7*24*time.Hour),
	)
	authHandler  := handler.NewAuthHandler(authSvc)
	adminHandler := handler.NewAdminHandler(userRepo, companyRepo, deptRepo)

	// ── Router ───────────────────────────────────────────────────
	if os.Getenv("ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()
	r.Use(corsMiddleware())

	// Métricas Prometheus
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

	v1 := r.Group("/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.Refresh)
			auth.POST("/logout", middleware.Auth(authSvc), authHandler.Logout)
			auth.GET("/me", middleware.Auth(authSvc), authHandler.Me)
			// Endpoint interno para outros serviços validarem tokens
			auth.GET("/validate", authHandler.ValidateToken)
		}

		// ── Admin (company_admin+) ───────────────────────────────
		admin := v1.Group("/admin")
		admin.Use(middleware.Auth(authSvc), middleware.RequireRole(model.RoleCompanyAdmin))
		{
			admin.GET("/users", adminHandler.ListUsers)
			admin.POST("/users", adminHandler.CreateUser)
			admin.DELETE("/users/:id", adminHandler.DeactivateUser)
			admin.PATCH("/users/:id/role", adminHandler.ChangeUserRole)

			admin.GET("/departments", adminHandler.ListDepartments)
			admin.POST("/departments", adminHandler.CreateDepartment)
			admin.DELETE("/departments/:id", adminHandler.DeleteDepartment)
		}

		// ── Super Admin ──────────────────────────────────────────
		superAdmin := v1.Group("/super-admin")
		superAdmin.Use(middleware.Auth(authSvc), middleware.RequireRole(model.RoleSuperAdmin))
		{
			superAdmin.GET("/companies", adminHandler.ListCompanies)
			superAdmin.POST("/companies", adminHandler.CreateCompany)
			superAdmin.GET("/companies/:id", adminHandler.GetCompany)
			superAdmin.PATCH("/companies/:id", adminHandler.UpdateCompany)
			superAdmin.DELETE("/companies/:id", adminHandler.DeleteCompany)
		}
	}

	port := getEnv("PORT", "8001")
	log.Printf("Auth Service listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}
