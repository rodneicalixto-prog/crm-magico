-- ============================================================
-- CRM Mágico — Migration 004: Seed — Super Admin inicial
-- Senha padrão: Admin@12345 (TROCAR IMEDIATAMENTE em produção)
-- Hash gerado com bcrypt cost=12
-- ============================================================

INSERT INTO users (id, company_id, email, password_hash, role, two_fa_enabled, is_active)
VALUES (
    uuid_generate_v4(),
    NULL,
    'superadmin@crmmagico.local',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oE5/DREC6',
    'super_admin',
    false,
    true
)
ON CONFLICT (email) DO NOTHING;
