-- ============================================================
-- CRM Mágico — Migration 003: Métricas (TimescaleDB)
-- ============================================================

-- ─── MÉTRICAS INDIVIDUAIS POR USUÁRIO ────────────────────────
CREATE TABLE user_metrics (
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    metric_date          DATE        NOT NULL,
    total_chats          INT         NOT NULL DEFAULT 0,
    resolved_chats       INT         NOT NULL DEFAULT 0,
    avg_response_time_s  INT,        -- segundos
    avg_handle_time_s    INT,
    first_contact_resolution INT     NOT NULL DEFAULT 0,
    sentiment_score_avg  DECIMAL(3,2),
    messages_sent        INT         NOT NULL DEFAULT 0,
    messages_received    INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, metric_date)
) PARTITION BY RANGE (metric_date);

CREATE TABLE user_metrics_2025 PARTITION OF user_metrics
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE user_metrics_2026 PARTITION OF user_metrics
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE user_metrics_default PARTITION OF user_metrics DEFAULT;

CREATE INDEX idx_user_metrics_company ON user_metrics(company_id, metric_date DESC);

-- ─── MÉTRICAS DE DEPARTAMENTO ────────────────────────────────
CREATE TABLE department_metrics (
    department_id        UUID  NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    metric_date          DATE  NOT NULL,
    total_chats          INT   NOT NULL DEFAULT 0,
    resolved_chats       INT   NOT NULL DEFAULT 0,
    avg_response_time_s  INT,
    open_chats           INT   NOT NULL DEFAULT 0,
    PRIMARY KEY (department_id, metric_date)
);

-- ─── SÉRIE TEMPORAL (TimescaleDB) ────────────────────────────
-- Eventos em tempo real para análise sazonal e forecasting
CREATE TABLE metric_events (
    time          TIMESTAMPTZ NOT NULL,
    company_id    UUID        NOT NULL,
    user_id       UUID,
    department_id UUID,
    event_type    VARCHAR(50) NOT NULL, -- 'chat_started' | 'chat_resolved' | 'message_sent' | ...
    value         DOUBLE PRECISION DEFAULT 1,
    metadata      JSONB DEFAULT '{}'
);

SELECT create_hypertable('metric_events', 'time');

CREATE INDEX idx_metric_events_company ON metric_events(company_id, time DESC);
CREATE INDEX idx_metric_events_user    ON metric_events(user_id, time DESC);
CREATE INDEX idx_metric_events_type    ON metric_events(event_type, time DESC);

-- Política de retenção: manter 2 anos de eventos
SELECT add_retention_policy('metric_events', INTERVAL '2 years');

-- Agregação contínua por hora (performance de dashboards)
CREATE MATERIALIZED VIEW metric_events_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    company_id,
    department_id,
    event_type,
    COUNT(*) AS event_count,
    SUM(value) AS total_value,
    AVG(value) AS avg_value
FROM metric_events
GROUP BY bucket, company_id, department_id, event_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy('metric_events_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);
