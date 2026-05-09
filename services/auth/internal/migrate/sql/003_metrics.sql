-- 003_metrics.sql — Métricas (sem TimescaleDB — PostgreSQL puro)

CREATE TABLE IF NOT EXISTS user_metrics (
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    metric_date          DATE        NOT NULL,
    total_chats          INT         NOT NULL DEFAULT 0,
    resolved_chats       INT         NOT NULL DEFAULT 0,
    avg_response_time_s  INT,
    avg_handle_time_s    INT,
    first_contact_resolution INT     NOT NULL DEFAULT 0,
    sentiment_score_avg  DECIMAL(3,2),
    messages_sent        INT         NOT NULL DEFAULT 0,
    messages_received    INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, metric_date)
) PARTITION BY RANGE (metric_date);

CREATE TABLE IF NOT EXISTS user_metrics_2025 PARTITION OF user_metrics
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS user_metrics_2026 PARTITION OF user_metrics
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS user_metrics_default PARTITION OF user_metrics DEFAULT;

CREATE INDEX IF NOT EXISTS idx_user_metrics_company ON user_metrics(company_id, metric_date DESC);

CREATE TABLE IF NOT EXISTS department_metrics (
    department_id        UUID  NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    metric_date          DATE  NOT NULL,
    total_chats          INT   NOT NULL DEFAULT 0,
    resolved_chats       INT   NOT NULL DEFAULT 0,
    avg_response_time_s  INT,
    open_chats           INT   NOT NULL DEFAULT 0,
    PRIMARY KEY (department_id, metric_date)
);

-- metric_events como tabela regular particionada (substitui hypertable TimescaleDB)
CREATE TABLE IF NOT EXISTS metric_events (
    id            UUID        DEFAULT uuid_generate_v4(),
    time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    company_id    UUID        NOT NULL,
    user_id       UUID,
    department_id UUID,
    event_type    VARCHAR(50) NOT NULL,
    value         DOUBLE PRECISION DEFAULT 1,
    metadata      JSONB DEFAULT '{}'
) PARTITION BY RANGE (time);

CREATE TABLE IF NOT EXISTS metric_events_2025 PARTITION OF metric_events
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE IF NOT EXISTS metric_events_2026 PARTITION OF metric_events
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS metric_events_default PARTITION OF metric_events DEFAULT;

CREATE INDEX IF NOT EXISTS idx_metric_events_company ON metric_events(company_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_metric_events_user    ON metric_events(user_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_metric_events_type    ON metric_events(event_type, time DESC);
