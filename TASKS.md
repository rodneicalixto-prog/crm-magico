# CRM Mágico — Tarefas

## Em Progresso
_nenhuma_

## Backlog — Core do Sistema

### 🏗️ Arquitetura & Infraestrutura
- [x] Definir stack definitiva (Python/Node.js/Go/Java Spring por serviço)
- [x] Configurar monorepo
- [x] Setup Docker Compose para dev local (PostgreSQL+TimescaleDB, Redis, Kafka, Elasticsearch, Prometheus, Grafana)
- [ ] Setup Kubernetes para produção
- [ ] Configurar CI/CD pipeline

### 🔐 Autenticação & Hierarquia
- [x] Auth Service em Go com JWT + RBAC (estrutura completa)
- [x] Roles: SUPER ADMIN / ADMIN EMPRESA / SUPERVISOR / USUÁRIO (hierarquia por nível)
- [x] Middleware RequireRole + SameCompany (bloqueio cross-tenant)
- [x] Log de acessos (tabela access_logs particionada)
- [x] Token rotation (refresh token revogado a cada uso via Redis)
- [ ] 2FA TOTP real (integrar pquerna/otp — placeholder criado)
- [ ] Session management (simultâneas controladas)
- [ ] Redefinição de senha por e-mail

### 💬 Módulo WhatsApp Multi-conta
- [ ] Integração WhatsApp Business API (oficial)
- [ ] Bridge API não-oficial (whatsapp-web.js/puppeteer)
- [ ] Evolution Go Integration Layer (gRPC streaming)
- [ ] Pool de números compartilháveis
- [ ] Transferência de conversas em tempo real
- [ ] Tags automáticas por tipo de atendimento
- [ ] NLP para detecção de intenção do cliente
- [ ] QR Code rotation system
- [ ] Auto-reconnect com exponential backoff
- [ ] HybridSyncOrchestrator (deduplicação de mensagens)
- [ ] Conflict resolution (oficial vs não-oficial)

### 📊 Dashboard & Métricas
- [ ] Dashboard por nível hierárquico (materialized views)
- [ ] Métricas individuais por usuário (tempo médio, taxa resolução, sentiment score)
- [ ] Time series + forecasting de demanda
- [ ] Widgets arrastáveis (React)
- [ ] Export PDF/Excel com templates
- [ ] Scheduled reports via e-mail
- [ ] Real-time WebSocket updates

### 🎯 Kanban de Conversas
- [ ] Board com colunas: Novo / Em Atendimento / Aguardando / Resolvido
- [ ] Swimlanes por prioridade (Urgente / Normal / Baixa Prioridade)
- [ ] WIP Limits por usuário/coluna
- [ ] SLA Countdown visível
- [ ] Drag & Drop entre colunas
- [ ] Auto-movimento por inatividade
- [ ] WebSocket events em tempo real

### 👥 Gestão de Contatos
- [ ] Contact Auto-Discovery (registro automático ao primeiro contato)
- [ ] Enriquecimento via APIs externas
- [ ] Detecção de duplicatas (similarity threshold 0.85)
- [ ] Import/Export (CSV, JSON, XLSX, vCard, Google Contacts)
- [ ] ContactImportWizard (UI em etapas)
- [ ] Batch operations
- [ ] Rollback de importação

### 💬 Chat Interno
- [ ] Grupos por departamento/projeto
- [ ] Menções (@) e notificações
- [ ] Compartilhamento de conversas de clientes
- [ ] End-to-end encryption
- [ ] Histórico pesquisável

### 🔄 Webhook Automation
- [ ] Event Router (Node.js + Redis)
- [ ] Subscription system por empresa/evento
- [ ] Retry com dead letter queue
- [ ] Automation Engine (triggers & actions)
- [ ] No-code Webhook Configurator (drag-and-drop)
- [ ] Test environment com mock data
- [ ] Version control das automações

### 🗃️ Banco de Dados
- [ ] PostgreSQL com schemas separados por empresa
- [ ] TimescaleDB para métricas temporais
- [ ] Partitioning por data para conversas
- [ ] Apache Kafka (topics por empresa/departamento)
- [ ] Redis Cluster para cache
- [ ] Elasticsearch para auditoria e busca

### 🔐 Segurança & Observabilidade
- [ ] API Gateway com WAF rules
- [ ] DDoS protection por IP range
- [ ] Encryption at rest (AES-256) + key rotation
- [ ] Prometheus + Grafana (métricas)
- [ ] Jaeger (tracing distribuído)
- [ ] Sentry (error tracking)
- [ ] Fluentd → ELK (log aggregation)

### 🖥️ Frontend
- [ ] SPA React/Vue.js + WebSocket Client
- [ ] Componentes dinâmicos por permissão (route guards)
- [ ] Virtual scrolling para listas de conversas
- [ ] Offline-first (IndexedDB + Service Workers)
- [ ] Admin Panel (app React separado)
- [ ] Dynamic menu por role

## Concluído

### Sprint 1 — Fundação
- [x] Estrutura do monorepo (`services/`, `frontend/`, `infra/`, `migrations/`)
- [x] `docker-compose.yml` (PostgreSQL+TimescaleDB, Redis, Kafka+Zookeeper, Elasticsearch, Prometheus, Grafana)
- [x] Auth Service Go: models, repository, service, handler, middleware RBAC
- [x] Migrações PostgreSQL: companies, departments, users, access_logs, whatsapp_accounts, contacts, conversations, messages, metric_events (TimescaleDB hypertable)
- [x] Makefile com comandos de dev (`make setup`, `make auth-dev`, `make db-shell`, etc.)
- [x] `.env.example`
