-- ============================================================
-- CRM Mágico — Migration 001: Schema base + multi-tenant
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- ─── EMPRESAS ────────────────────────────────────────────────
CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    plan        VARCHAR(50)  NOT NULL DEFAULT 'basic', -- basic | pro | enterprise
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    settings    JSONB        NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── DEPARTAMENTOS ───────────────────────────────────────────
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id  UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_company ON departments(company_id);

-- ─── USUÁRIOS ────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'company_admin',
    'supervisor',
    'operational'
);

CREATE TABLE users (
    id              UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID       REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = super_admin
    department_id   UUID       REFERENCES departments(id) ON DELETE SET NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    role            user_role    NOT NULL DEFAULT 'operational',
    two_fa_enabled  BOOLEAN      NOT NULL DEFAULT false,
    two_fa_secret   TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_company   ON users(company_id);
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_role      ON users(role);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── LOGS DE ACESSO ──────────────────────────────────────────
CREATE TABLE access_logs (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action      VARCHAR(50) NOT NULL,  -- login | logout | token_refresh | impersonate
    ip_address  INET,
    user_agent  TEXT,
    metadata    JSONB       DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Partições por trimestre (criar partições futuras conforme necessário)
CREATE TABLE access_logs_2024_q1 PARTITION OF access_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE access_logs_2024_q2 PARTITION OF access_logs
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE access_logs_2024_q3 PARTITION OF access_logs
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');
CREATE TABLE access_logs_2024_q4 PARTITION OF access_logs
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
CREATE TABLE access_logs_2025_q1 PARTITION OF access_logs
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE access_logs_2025_q2 PARTITION OF access_logs
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE access_logs_default  PARTITION OF access_logs DEFAULT;

CREATE INDEX idx_access_logs_user   ON access_logs(user_id);
CREATE INDEX idx_access_logs_action ON access_logs(action);
CREATE INDEX idx_access_logs_time   ON access_logs(created_at DESC);
