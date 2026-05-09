package middleware

import (
	"net/http"
	"strings"

	"github.com/crm-magico/auth/internal/model"
	"github.com/crm-magico/auth/internal/service"
	"github.com/gin-gonic/gin"
)

const ctxClaimsKey = "claims"

func Auth(authSvc *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
			return
		}

		token := strings.TrimPrefix(header, "Bearer ")
		claims, err := authSvc.ValidateToken(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		c.Set(ctxClaimsKey, claims)
		c.Next()
	}
}

// RequireRole garante que o usuário tem ao menos o nível de role exigido.
func RequireRole(required model.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := c.MustGet(ctxClaimsKey).(*model.Claims)
		if !ok || !claims.Role.HasPermission(required) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

// SameCompany bloqueia acesso cross-company para roles abaixo de SuperAdmin.
func SameCompany() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := c.MustGet(ctxClaimsKey).(*model.Claims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		if claims.Role == model.RoleSuperAdmin {
			c.Next()
			return
		}

		targetCompany := c.Param("company_id")
		if targetCompany != "" && claims.CompanyID != nil &&
			targetCompany != claims.CompanyID.String() {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "cross-company access denied"})
			return
		}

		c.Next()
	}
}

func GetClaims(c *gin.Context) *model.Claims {
	v, _ := c.Get(ctxClaimsKey)
	claims, _ := v.(*model.Claims)
	return claims
}
