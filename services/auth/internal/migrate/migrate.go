package migrate

import (
	"context"
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed sql/*.sql
var migrationFiles embed.FS

func Run(ctx context.Context, db *pgxpool.Pool) error {
	if err := ensureMigrationsTable(ctx, db); err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	entries, err := migrationFiles.ReadDir("sql")
	if err != nil {
		return fmt.Errorf("read embedded migrations: %w", err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		if err := applyMigration(ctx, db, entry.Name()); err != nil {
			return fmt.Errorf("migration %s: %w", entry.Name(), err)
		}
	}
	return nil
}

func ensureMigrationsTable(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

func applyMigration(ctx context.Context, db *pgxpool.Pool, filename string) error {
	var applied bool
	err := db.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", filename,
	).Scan(&applied)
	if err != nil {
		return err
	}
	if applied {
		return nil
	}

	content, err := migrationFiles.ReadFile("sql/" + filename)
	if err != nil {
		return err
	}

	tx, err := db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, string(content)); err != nil {
		return fmt.Errorf("execute SQL: %w", err)
	}
	if _, err := tx.Exec(ctx,
		"INSERT INTO schema_migrations(version) VALUES($1)", filename,
	); err != nil {
		return err
	}

	log.Printf("Migration applied: %s", filename)
	return tx.Commit(ctx)
}
