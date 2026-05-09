package repository

import (
	"context"
	"errors"

	"github.com/crm-magico/auth/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")
var ErrDuplicateEmail = errors.New("email already exists")

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(ctx, `
		SELECT id, company_id, department_id, email, password_hash,
		       role, two_fa_enabled, COALESCE(two_fa_secret, ''), is_active,
		       last_login_at, COALESCE(last_login_ip, ''), created_at, updated_at
		FROM users WHERE email = $1 AND is_active = true
	`, email).Scan(
		&u.ID, &u.CompanyID, &u.DepartmentID, &u.Email, &u.PasswordHash,
		&u.Role, &u.TwoFAEnabled, &u.TwoFASecret, &u.IsActive,
		&u.LastLoginAt, &u.LastLoginIP, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	u := &model.User{}
	err := r.db.QueryRow(ctx, `
		SELECT id, company_id, department_id, email, password_hash,
		       role, two_fa_enabled, COALESCE(two_fa_secret, ''), is_active,
		       last_login_at, COALESCE(last_login_ip, ''), created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&u.ID, &u.CompanyID, &u.DepartmentID, &u.Email, &u.PasswordHash,
		&u.Role, &u.TwoFAEnabled, &u.TwoFASecret, &u.IsActive,
		&u.LastLoginAt, &u.LastLoginIP, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return u, err
}

func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	u.ID = uuid.New()
	_, err := r.db.Exec(ctx, `
		INSERT INTO users (id, company_id, department_id, email, password_hash, role, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, true)
	`, u.ID, u.CompanyID, u.DepartmentID, u.Email, u.PasswordHash, u.Role)
	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID, ip string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users SET last_login_at = NOW(), last_login_ip = $2 WHERE id = $1
	`, userID, ip)
	return err
}

func (r *UserRepository) LogAccess(ctx context.Context, log *model.AccessLog) error {
	log.ID = uuid.New()
	_, err := r.db.Exec(ctx, `
		INSERT INTO access_logs (id, user_id, action, ip_address, user_agent)
		VALUES ($1, $2, $3, $4, $5)
	`, log.ID, log.UserID, log.Action, log.IPAddress, log.UserAgent)
	return err
}
