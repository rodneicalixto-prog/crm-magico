package model

import "github.com/google/uuid"

type Claims struct {
	UserID       uuid.UUID  `json:"uid"`
	CompanyID    *uuid.UUID `json:"cid,omitempty"`
	DepartmentID *uuid.UUID `json:"did,omitempty"`
	Role         Role       `json:"role"`
	Email        string     `json:"email"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // segundos
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	TOTPCode string `json:"totp_code,omitempty"`
}

type LoginResponse struct {
	Tokens TokenPair `json:"tokens"`
	User   User      `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}
