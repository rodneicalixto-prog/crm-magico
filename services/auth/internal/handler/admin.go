package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/crm-magico/auth/internal/middleware"
	"github.com/crm-magico/auth/internal/model"
	"github.com/crm-magico/auth/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AdminHandler struct {
	users    *repository.UserRepository
	companies *repository.CompanyRepository
	depts    *repository.DepartmentRepository
}

func NewAdminHandler(
	users *repository.UserRepository,
	companies *repository.CompanyRepository,
	depts *repository.DepartmentRepository,
) *AdminHandler {
	return &AdminHandler{users: users, companies: companies, depts: depts}
}

// ── Companies ────────────────────────────────────────────────

func (h *AdminHandler) ListCompanies(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit > 100 {
		limit = 100
	}

	companies, total, err := h.companies.List(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": companies, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) CreateCompany(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
		Plan string `json:"plan"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Plan == "" {
		req.Plan = "basic"
	}

	company := &model.Company{Name: req.Name, Plan: req.Plan}
	if err := h.companies.Create(c.Request.Context(), company); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, company)
}

func (h *AdminHandler) GetCompany(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	company, err := h.companies.FindByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, company)
}

func (h *AdminHandler) UpdateCompany(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	company, err := h.companies.FindByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var req struct {
		Name     *string `json:"name"`
		Plan     *string `json:"plan"`
		IsActive *bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		company.Name = *req.Name
	}
	if req.Plan != nil {
		company.Plan = *req.Plan
	}
	if req.IsActive != nil {
		company.IsActive = *req.IsActive
	}

	if err := h.companies.Update(c.Request.Context(), company); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, company)
}

func (h *AdminHandler) DeleteCompany(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.companies.Delete(c.Request.Context(), id); errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ── Users ────────────────────────────────────────────────────

func (h *AdminHandler) ListUsers(c *gin.Context) {
	claims := middleware.GetClaims(c)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit > 100 {
		limit = 100
	}

	// super_admin pode filtrar por qualquer empresa; admin só vê a própria
	companyParam := c.Query("company_id")
	var companyID uuid.UUID
	if claims.Role == model.RoleSuperAdmin && companyParam != "" {
		if id, err := uuid.Parse(companyParam); err == nil {
			companyID = id
		}
	} else if claims.CompanyID != nil {
		companyID = *claims.CompanyID
	}

	if companyID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "company_id required"})
		return
	}

	users, total, err := h.users.ListByCompany(c.Request.Context(), companyID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Remover campos sensíveis
	type safeUser struct {
		ID           uuid.UUID  `json:"id"`
		CompanyID    *uuid.UUID `json:"company_id,omitempty"`
		DepartmentID *uuid.UUID `json:"department_id,omitempty"`
		Email        string     `json:"email"`
		Role         model.Role `json:"role"`
		IsActive     bool       `json:"is_active"`
		LastLoginAt  interface{} `json:"last_login_at,omitempty"`
	}

	safe := make([]safeUser, 0, len(users))
	for _, u := range users {
		safe = append(safe, safeUser{
			ID: u.ID, CompanyID: u.CompanyID, DepartmentID: u.DepartmentID,
			Email: u.Email, Role: u.Role, IsActive: u.IsActive, LastLoginAt: u.LastLoginAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": safe, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) CreateUser(c *gin.Context) {
	claims := middleware.GetClaims(c)

	var req struct {
		Email        string     `json:"email" binding:"required,email"`
		Password     string     `json:"password" binding:"required,min=8"`
		Role         model.Role `json:"role" binding:"required"`
		CompanyID    *uuid.UUID `json:"company_id"`
		DepartmentID *uuid.UUID `json:"department_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Enforce hierarchy: não pode criar role maior que a própria
	if !claims.Role.HasPermission(req.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot create user with higher role"})
		return
	}

	// Admin empresa sempre cria usuários na própria empresa
	if claims.Role != model.RoleSuperAdmin {
		req.CompanyID = claims.CompanyID
	}
	if req.CompanyID == nil && req.Role != model.RoleSuperAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "company_id required"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "password hashing failed"})
		return
	}

	user := &model.User{
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         req.Role,
		CompanyID:    req.CompanyID,
		DepartmentID: req.DepartmentID,
	}
	if err := h.users.Create(c.Request.Context(), user); errors.Is(err, repository.ErrDuplicateEmail) {
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	user.PasswordHash = ""
	c.JSON(http.StatusCreated, user)
}

func (h *AdminHandler) DeactivateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.users.SetActive(c.Request.Context(), id, false); errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AdminHandler) ChangeUserRole(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req struct {
		Role model.Role `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !claims.Role.HasPermission(req.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot assign role higher than your own"})
		return
	}

	if err := h.users.UpdateRole(c.Request.Context(), id, req.Role); errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

// ── Departments ───────────────────────────────────────────────

func (h *AdminHandler) ListDepartments(c *gin.Context) {
	claims := middleware.GetClaims(c)
	companyID := claims.CompanyID
	if claims.Role == model.RoleSuperAdmin {
		if id, err := uuid.Parse(c.Query("company_id")); err == nil {
			companyID = &id
		}
	}
	if companyID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "company_id required"})
		return
	}

	depts, err := h.depts.ListByCompany(c.Request.Context(), *companyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": depts})
}

func (h *AdminHandler) CreateDepartment(c *gin.Context) {
	claims := middleware.GetClaims(c)

	var req struct {
		Name      string     `json:"name" binding:"required"`
		CompanyID *uuid.UUID `json:"company_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	companyID := claims.CompanyID
	if claims.Role == model.RoleSuperAdmin && req.CompanyID != nil {
		companyID = req.CompanyID
	}
	if companyID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "company_id required"})
		return
	}

	dept := &model.Department{Name: req.Name, CompanyID: *companyID}
	if err := h.depts.Create(c.Request.Context(), dept); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, dept)
}

func (h *AdminHandler) DeleteDepartment(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	companyID := uuid.Nil
	if claims.CompanyID != nil {
		companyID = *claims.CompanyID
	}

	if err := h.depts.Delete(c.Request.Context(), id, companyID); errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "department not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}
