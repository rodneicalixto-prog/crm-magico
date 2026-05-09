-- ============================================================
-- CRM Mágico — Migration 002: WhatsApp & Conversas
-- ============================================================

-- ─── CONTAS WHATSAPP ─────────────────────────────────────────
CREATE TYPE wa_account_type AS ENUM ('official', 'unofficial', 'evolution');
CREATE TYPE wa_account_status AS ENUM ('connected', 'disconnected', 'pending_qr', 'banned');

CREATE TABLE whatsapp_accounts (
    id             UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id     UUID              NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_number   VARCHAR(20)       NOT NULL,
    display_name   VARCHAR(255),
    account_type   wa_account_type   NOT NULL DEFAULT 'official',
    status         wa_account_status NOT NULL DEFAULT 'disconnected',
    session_data   JSONB             DEFAULT '{}',  -- dados de sessão criptografados
    is_shared      BOOLEAN           NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

CREATE INDEX idx_wa_accounts_company ON whatsapp_accounts(company_id);
CREATE INDEX idx_wa_accounts_status  ON whatsapp_accounts(status);

-- Usuários autorizados a usar uma conta compartilhada
CREATE TABLE whatsapp_account_users (
    account_id UUID NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (account_id, user_id)
);

-- ─── CONTATOS ────────────────────────────────────────────────
CREATE TABLE contacts (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone_number     VARCHAR(20) NOT NULL,
    name             VARCHAR(255),
    email            VARCHAR(255),
    tags             TEXT[]      DEFAULT '{}',
    source           VARCHAR(50) DEFAULT 'whatsapp_auto',
    metadata         JSONB       DEFAULT '{}',
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contact_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(company_id, phone_number)
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_tags    ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_phone   ON contacts(phone_number);

-- ─── CONVERSAS ───────────────────────────────────────────────
CREATE TYPE conversation_status AS ENUM ('new', 'in_progress', 'waiting', 'resolved');
CREATE TYPE conversation_priority AS ENUM ('urgent', 'normal', 'low');

CREATE TABLE conversations (
    id                UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id        UUID                  NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id     UUID                  REFERENCES departments(id) ON DELETE SET NULL,
    contact_id        UUID                  NOT NULL REFERENCES contacts(id),
    assigned_to       UUID                  REFERENCES users(id) ON DELETE SET NULL,
    wa_account_id     UUID                  REFERENCES whatsapp_accounts(id),
    status            conversation_status   NOT NULL DEFAULT 'new',
    priority          conversation_priority NOT NULL DEFAULT 'normal',
    subject           VARCHAR(500),
    tags              TEXT[]                DEFAULT '{}',
    sla_deadline      TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Partições por semestre
CREATE TABLE conversations_2024_h1 PARTITION OF conversations
    FOR VALUES FROM ('2024-01-01') TO ('2024-07-01');
CREATE TABLE conversations_2024_h2 PARTITION OF conversations
    FOR VALUES FROM ('2024-07-01') TO ('2025-01-01');
CREATE TABLE conversations_2025_h1 PARTITION OF conversations
    FOR VALUES FROM ('2025-01-01') TO ('2025-07-01');
CREATE TABLE conversations_2025_h2 PARTITION OF conversations
    FOR VALUES FROM ('2025-07-01') TO ('2026-01-01');
CREATE TABLE conversations_default PARTITION OF conversations DEFAULT;

CREATE INDEX idx_conversations_company    ON conversations(company_id);
CREATE INDEX idx_conversations_assigned   ON conversations(assigned_to);
CREATE INDEX idx_conversations_status     ON conversations(status);
CREATE INDEX idx_conversations_contact    ON conversations(contact_id);
CREATE INDEX idx_conversations_updated    ON conversations(updated_at DESC);

-- ─── MENSAGENS ───────────────────────────────────────────────
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'audio', 'document', 'location', 'template');
CREATE TYPE message_source AS ENUM ('official', 'unofficial', 'internal');

CREATE TABLE messages (
    id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id   UUID              NOT NULL,  -- FK resolvida no app (particionado)
    company_id        UUID              NOT NULL REFERENCES companies(id),
    sender_id         UUID,             -- NULL se for mensagem do cliente
    direction         message_direction NOT NULL,
    msg_type          message_type      NOT NULL DEFAULT 'text',
    source            message_source    NOT NULL DEFAULT 'official',
    content           TEXT,
    media_url         TEXT,
    wa_message_id     VARCHAR(255),     -- ID do WhatsApp para deduplicação
    source_hash       VARCHAR(64),      -- hash determinístico para dedupe híbrido
    is_duplicate      BOOLEAN           NOT NULL DEFAULT false,
    metadata          JSONB             DEFAULT '{}',
    sent_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (sent_at);

CREATE TABLE messages_2024_q4 PARTITION OF messages
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
CREATE TABLE messages_2025_q1 PARTITION OF messages
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE messages_2025_q2 PARTITION OF messages
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');
CREATE TABLE messages_default  PARTITION OF messages DEFAULT;

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_wa_id        ON messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX idx_messages_hash         ON messages(source_hash) WHERE source_hash IS NOT NULL;

-- ─── SYNC STATUS (híbrido oficial/não-oficial) ───────────────
CREATE TABLE conversation_sync_status (
    conversation_id       UUID PRIMARY KEY,
    last_sync_official    TIMESTAMPTZ,
    last_sync_unofficial  TIMESTAMPTZ,
    sync_drift_ms         BIGINT,
    confidence_score      DECIMAL(3,2) DEFAULT 1.0,
    needs_manual_review   BOOLEAN DEFAULT false,
    indexed_fields        JSONB DEFAULT '{}'
);
