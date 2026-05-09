package repository

import (
	"context"
	"errors"

	"github.com/crm-magico/auth/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanyRepository struct {
	db *pgxpool.Pool
}

func NewCompanyRepository(db *pgxpool.Pool) *CompanyRepository {
	return &CompanyRepository{db: db}
}

func (r *CompanyRepository) Create(ctx context.Context, c *model.Company) error {
	c.ID = uuid.New()
	return r.db.QueryRow(ctx, `
		INSERT INTO companies (id, name, plan, is_active, settings)
		VALUES ($1, $2, $3, true, '{}')
		RETURNING is_active, created_at, updated_at
	`, c.ID, c.Name, c.Plan).Scan(&c.IsActive, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CompanyRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Company, error) {
	c := &model.Company{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, plan, is_active, created_at, updated_at
		FROM companies WHERE id = $1
	`, id).Scan(&c.ID, &c.Name, &c.Plan, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return c, err
}

func (r *CompanyRepository) List(ctx context.Context, limit, offset int) ([]*model.Company, int, error) {
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, name, plan, is_active, created_at, updated_at
		FROM companies ORDER BY created_at DESC LIMIT $1 OFFSET $2
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var companies []*model.Company
	for rows.Next() {
		c := &model.Company{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Plan, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		companies = append(companies, c)
	}
	return companies, total, rows.Err()
}

func (r *CompanyRepository) Update(ctx context.Context, c *model.Company) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE companies SET name=$2, plan=$3, is_active=$4 WHERE id=$1
	`, c.ID, c.Name, c.Plan, c.IsActive)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *CompanyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM companies WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
