package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/crm-magico/auth/internal/model"
	"github.com/crm-magico/auth/internal/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrTOTPRequired       = errors.New("totp code required")
	ErrInvalidTOTP        = errors.New("invalid totp code")
	ErrTokenRevoked       = errors.New("token revoked")
	ErrInvalidToken       = errors.New("invalid token")
)

type AuthService struct {
	users         *repository.UserRepository
	redis         *redis.Client
	jwtSecret     []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
}

func NewAuthService(
	users *repository.UserRepository,
	rdb *redis.Client,
	jwtSecret string,
	accessExpiry, refreshExpiry time.Duration,
) *AuthService {
	return &AuthService{
		users:         users,
		redis:         rdb,
		jwtSecret:     []byte(jwtSecret),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
	}
}

func (s *AuthService) Login(ctx context.Context, req model.LoginRequest, ip, ua string) (*model.LoginResponse, error) {
	user, err := s.users.FindByEmail(ctx, req.Email)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	if user.TwoFAEnabled {
		if req.TOTPCode == "" {
			return nil, ErrTOTPRequired
		}
		if !validateTOTP(user.TwoFASecret, req.TOTPCode) {
			return nil, ErrInvalidTOTP
		}
	}

	tokens, err := s.issueTokenPair(user)
	if err != nil {
		return nil, err
	}

	_ = s.users.UpdateLastLogin(ctx, user.ID, ip)
	_ = s.users.LogAccess(ctx, &model.AccessLog{
		UserID:    user.ID,
		Action:    "login",
		IPAddress: ip,
		UserAgent: ua,
	})

	return &model.LoginResponse{Tokens: *tokens, User: *user}, nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*model.TokenPair, error) {
	claims, err := s.parseToken(refreshToken)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Verificar se o refresh token foi revogado
	revoked, err := s.redis.Exists(ctx, revokedKey(refreshToken)).Result()
	if err != nil || revoked > 0 {
		return nil, ErrTokenRevoked
	}

	user, err := s.users.FindByID(ctx, claims.UserID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Revogar o refresh token usado (rotação de tokens)
	_ = s.redis.Set(ctx, revokedKey(refreshToken), "1", s.refreshExpiry)

	return s.issueTokenPair(user)
}

func (s *AuthService) Logout(ctx context.Context, accessToken, refreshToken string) error {
	s.redis.Set(ctx, revokedKey(accessToken), "1", s.accessExpiry)
	s.redis.Set(ctx, revokedKey(refreshToken), "1", s.refreshExpiry)
	return nil
}

func (s *AuthService) ValidateToken(ctx context.Context, tokenStr string) (*model.Claims, error) {
	claims, err := s.parseToken(tokenStr)
	if err != nil {
		return nil, ErrInvalidToken
	}

	revoked, _ := s.redis.Exists(ctx, revokedKey(tokenStr)).Result()
	if revoked > 0 {
		return nil, ErrTokenRevoked
	}

	return claims, nil
}

func (s *AuthService) issueTokenPair(user *model.User) (*model.TokenPair, error) {
	claims := model.Claims{
		UserID:       user.ID,
		CompanyID:    user.CompanyID,
		DepartmentID: user.DepartmentID,
		Role:         user.Role,
		Email:        user.Email,
	}

	accessToken, err := s.signToken(claims, s.accessExpiry)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.signToken(claims, s.refreshExpiry)
	if err != nil {
		return nil, err
	}

	return &model.TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.accessExpiry.Seconds()),
	}, nil
}

func (s *AuthService) signToken(claims model.Claims, expiry time.Duration) (string, error) {
	jwtClaims := jwt.MapClaims{
		"uid":  claims.UserID.String(),
		"role": string(claims.Role),
		"email": claims.Email,
		"exp":  time.Now().Add(expiry).Unix(),
		"iat":  time.Now().Unix(),
		"jti":  uuid.New().String(),
	}
	if claims.CompanyID != nil {
		jwtClaims["cid"] = claims.CompanyID.String()
	}
	if claims.DepartmentID != nil {
		jwtClaims["did"] = claims.DepartmentID.String()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) parseToken(tokenStr string) (*model.Claims, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	mc, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	uid, _ := uuid.Parse(mc["uid"].(string))
	claims := &model.Claims{
		UserID: uid,
		Role:   model.Role(mc["role"].(string)),
		Email:  mc["email"].(string),
	}

	if cid, ok := mc["cid"].(string); ok {
		id, _ := uuid.Parse(cid)
		claims.CompanyID = &id
	}
	if did, ok := mc["did"].(string); ok {
		id, _ := uuid.Parse(did)
		claims.DepartmentID = &id
	}

	return claims, nil
}

func revokedKey(token string) string {
	// Usar apenas o sufixo para evitar chaves gigantes no Redis
	if len(token) > 32 {
		return "revoked:" + token[len(token)-32:]
	}
	return "revoked:" + token
}

// validateTOTP é um placeholder — integrar com github.com/pquerna/otp
func validateTOTP(secret, code string) bool {
	// TODO: implementar TOTP real com pquerna/otp
	return len(code) == 6
}
