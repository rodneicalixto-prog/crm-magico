-- 002_whatsapp.sql — WhatsApp & Conversas

DO $$ BEGIN
    CREATE TYPE wa_account_type AS ENUM ('official', 'unofficial', 'evolution');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE wa_account_status AS ENUM ('connected', 'disconnected', 'pending_qr', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id             UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id     UUID              NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_number   VARCHAR(20)       NOT NULL,
    display_name   VARCHAR(255),
    account_type   wa_account_type   NOT NULL DEFAULT 'official',
    status         wa_account_status NOT NULL DEFAULT 'disconnected',
    session_data   JSONB             DEFAULT '{}',
    is_shared      BOOLEAN           NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_wa_accounts_company ON whatsapp_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_status  ON whatsapp_accounts(status);

CREATE TABLE IF NOT EXISTS whatsapp_account_users (
    account_id UUID NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (account_id, user_id)
);

-- ─── CONTATOS ────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE contact_status AS ENUM ('active', 'blocked', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS contacts (
    id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      UUID           NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_number    VARCHAR(20)    NOT NULL,
    name            VARCHAR(255),
    email           VARCHAR(255),
    avatar_url      TEXT,
    status          contact_status NOT NULL DEFAULT 'active',
    tags            TEXT[]         DEFAULT '{}',
    custom_fields   JSONB          DEFAULT '{}',
    opt_out         BOOLEAN        NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone   ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_tags    ON contacts USING gin(tags);

-- ─── CONVERSAS (particionado por mês) ────────────────────────
DO $$ BEGIN
    CREATE TYPE conversation_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE conversation_priority AS ENUM ('urgent', 'normal', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS conversations (
    id                UUID                  DEFAULT uuid_generate_v4(),
    company_id        UUID                  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id        UUID                  NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    assigned_user_id  UUID                  REFERENCES users(id) ON DELETE SET NULL,
    wa_account_id     UUID                  REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
    department_id     UUID                  REFERENCES departments(id) ON DELETE SET NULL,
    status            conversation_status   NOT NULL DEFAULT 'open',
    priority          conversation_priority NOT NULL DEFAULT 'normal',
    unread_count      INT                   NOT NULL DEFAULT 0,
    last_message_at   TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    sla_deadline_at   TIMESTAMPTZ,
    metadata          JSONB                 DEFAULT '{}',
    created_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS conversations_2025 PARTITION OF conversations
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS conversations_2026 PARTITION OF conversations
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS conversations_default PARTITION OF conversations DEFAULT;

CREATE INDEX IF NOT EXISTS idx_conversations_company  ON conversations(company_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user     ON conversations(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_contact  ON conversations(contact_id);

-- ─── MENSAGENS (particionado por mês) ────────────────────────
DO $$ BEGIN
    CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'template');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS messages (
    id               UUID             DEFAULT uuid_generate_v4(),
    conversation_id  UUID             NOT NULL,
    sender_user_id   UUID             REFERENCES users(id) ON DELETE SET NULL,
    direction        message_direction NOT NULL,
    msg_type         message_type     NOT NULL DEFAULT 'text',
    content          TEXT,
    media_url        TEXT,
    media_mime_type  VARCHAR(100),
    wa_message_id    VARCHAR(255),
    status           message_status   NOT NULL DEFAULT 'pending',
    metadata         JSONB            DEFAULT '{}',
    created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS messages_2025 PARTITION OF messages
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS messages_2026 PARTITION OF messages
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS messages_default PARTITION OF messages DEFAULT;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);

-- ─── SYNC STATUS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_sync_status (
    conversation_id UUID PRIMARY KEY,
    official_msg_id VARCHAR(255),
    unofficial_msg_id VARCHAR(255),
    last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
