-- 006_fix_superadmin_password.sql — Corrigir hash de senha do super admin
-- Senha: Admin@12345 — trocar imediatamente em produção

UPDATE users
SET password_hash = '$2b$12$Mrhx.wijW93Axtd3kOPVjO0HNuC89KXU3GPxy7DYm5lUW7kBNXgfu'
WHERE email = 'superadmin@crmmagico.local'
  AND role = 'super_admin';
