package repository

import (
	"context"

	"github.com/crm-magico/auth/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DepartmentRepository struct {
	db *pgxpool.Pool
}

func NewDepartmentRepository(db *pgxpool.Pool) *DepartmentRepository {
	return &DepartmentRepository{db: db}
}

func (r *DepartmentRepository) Create(ctx context.Context, d *model.Department) error {
	d.ID = uuid.New()
	return r.db.QueryRow(ctx, `
		INSERT INTO departments (id, company_id, name, is_active)
		VALUES ($1, $2, $3, true)
		RETURNING created_at
	`, d.ID, d.CompanyID, d.Name).Scan(&d.CreatedAt)
}

func (r *DepartmentRepository) ListByCompany(ctx context.Context, companyID uuid.UUID) ([]*model.Department, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, company_id, name, is_active, created_at
		FROM departments WHERE company_id = $1 ORDER BY name
	`, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deps []*model.Department
	for rows.Next() {
		d := &model.Department{}
		if err := rows.Scan(&d.ID, &d.CompanyID, &d.Name, &d.IsActive, &d.CreatedAt); err != nil {
			return nil, err
		}
		deps = append(deps, d)
	}
	return deps, rows.Err()
}

func (r *DepartmentRepository) Delete(ctx context.Context, id, companyID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM departments WHERE id=$1 AND company_id=$2
	`, id, companyID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
