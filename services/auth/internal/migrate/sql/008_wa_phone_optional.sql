-- 008_wa_phone_optional.sql
-- Make phone_number optional so accounts can be created by name before associating a number.

ALTER TABLE whatsapp_accounts
    ALTER COLUMN phone_number DROP NOT NULL;

-- Unique constraint only applies when phone_number is non-null and non-empty.
ALTER TABLE whatsapp_accounts
    DROP CONSTRAINT IF EXISTS whatsapp_accounts_company_id_phone_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_accounts_phone_unique
    ON whatsapp_accounts(company_id, phone_number)
    WHERE phone_number IS NOT NULL AND phone_number <> '';
