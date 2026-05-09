-- 005_add_last_login_ip.sql — Colunas ausentes na tabela users

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);

-- Garantir que two_fa_secret não seja NULL (evita erro de scan no Go)
UPDATE users SET two_fa_secret = '' WHERE two_fa_secret IS NULL;
ALTER TABLE users ALTER COLUMN two_fa_secret SET DEFAULT '';
ALTER TABLE users ALTER COLUMN two_fa_secret SET NOT NULL;
