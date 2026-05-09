package handler

import (
	"net/http"

	"github.com/crm-magico/auth/internal/middleware"
	"github.com/crm-magico/auth/internal/model"
	"github.com/crm-magico/auth/internal/service"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.svc.Login(c.Request.Context(), req, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		status := http.StatusUnauthorized
		if err == service.ErrTOTPRequired {
			status = http.StatusPreconditionRequired
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req model.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tokens, err := h.svc.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	accessToken := extractBearer(c)
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&req)

	_ = h.svc.Logout(c.Request.Context(), accessToken, req.RefreshToken)
	c.JSON(http.StatusNoContent, nil)
}

func (h *AuthHandler) Me(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, claims)
}

func (h *AuthHandler) ValidateToken(c *gin.Context) {
	token := extractBearer(c)
	claims, err := h.svc.ValidateToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"valid": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"valid": true, "claims": claims})
}

func extractBearer(c *gin.Context) string {
	h := c.GetHeader("Authorization")
	if len(h) > 7 {
		return h[7:]
	}
	return ""
}
