package model

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleSuperAdmin   Role = "super_admin"
	RoleCompanyAdmin Role = "company_admin"
	RoleSupervisor   Role = "supervisor"
	RoleOperational  Role = "operational"
)

// roleLevel define a ordem hierárquica: quanto maior, mais permissão.
var roleLevel = map[Role]int{
	RoleOperational:  1,
	RoleSupervisor:   2,
	RoleCompanyAdmin: 3,
	RoleSuperAdmin:   4,
}

func (r Role) Level() int {
	return roleLevel[r]
}

func (r Role) HasPermission(required Role) bool {
	return r.Level() >= required.Level()
}

type User struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	CompanyID      *uuid.UUID `json:"company_id,omitempty" db:"company_id"` // nil para SuperAdmin
	DepartmentID   *uuid.UUID `json:"department_id,omitempty" db:"department_id"`
	Email          string     `json:"email" db:"email"`
	PasswordHash   string     `json:"-" db:"password_hash"`
	Role           Role       `json:"role" db:"role"`
	TwoFAEnabled   bool       `json:"two_fa_enabled" db:"two_fa_enabled"`
	TwoFASecret    string     `json:"-" db:"two_fa_secret"`
	IsActive       bool       `json:"is_active" db:"is_active"`
	LastLoginAt    *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	LastLoginIP    string     `json:"last_login_ip,omitempty" db:"last_login_ip"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

type Company struct {
	ID        uuid.UUID `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Plan      string    `json:"plan" db:"plan"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type Department struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CompanyID uuid.UUID `json:"company_id" db:"company_id"`
	Name      string    `json:"name" db:"name"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type AccessLog struct {
	ID        uuid.UUID `json:"id" db:"id"`
	UserID    uuid.UUID `json:"user_id" db:"user_id"`
	Action    string    `json:"action" db:"action"`
	IPAddress string    `json:"ip_address" db:"ip_address"`
	UserAgent string    `json:"user_agent" db:"user_agent"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
