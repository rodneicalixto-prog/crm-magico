.PHONY: up down logs ps build migrate seed auth-dev

# ─── Infraestrutura ──────────────────────────────────────────
up:
	docker compose up -d
	@echo "Aguardando serviços ficarem saudáveis..."
	@docker compose ps

down:
	docker compose down

down-volumes:
	docker compose down -v

restart:
	docker compose restart

logs:
	docker compose logs -f

logs-%:
	docker compose logs -f $*

ps:
	docker compose ps

# ─── Build ───────────────────────────────────────────────────
build:
	docker compose build

build-%:
	docker compose build $*

# ─── Banco de Dados ──────────────────────────────────────────
migrate:
	@echo "Rodando migrações..."
	@for f in migrations/postgres/*.sql; do \
		echo "  -> $$f"; \
		docker compose exec -T postgres psql -U crm -d crm_magico -f /docker-entrypoint-initdb.d/$$(basename $$f); \
	done

db-shell:
	docker compose exec postgres psql -U crm -d crm_magico

redis-shell:
	docker compose exec redis redis-cli -a crm_redis_secret

kafka-topics:
	docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# ─── Dev Services ────────────────────────────────────────────
auth-dev:
	cd services/auth && \
	DATABASE_URL="postgres://crm:crm_secret@localhost:5432/crm_magico?sslmode=disable" \
	REDIS_URL="redis://:crm_redis_secret@localhost:6379/0" \
	JWT_SECRET="dev_secret_change_in_prod_32chars!!" \
	JWT_EXPIRY="15m" \
	REFRESH_EXPIRY="168h" \
	PORT="8001" \
	ENV="development" \
	go run ./cmd/server

auth-test:
	cd services/auth && go test ./...

# ─── Observabilidade ─────────────────────────────────────────
open-grafana:
	@echo "Grafana: http://localhost:3001 (admin / crm_grafana_secret)"

open-prometheus:
	@echo "Prometheus: http://localhost:9090"

# ─── Utilitários ─────────────────────────────────────────────
kafka-create-topics:
	@echo "Criando tópicos Kafka..."
	docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 \
		--create --if-not-exists --topic chat-events --partitions 6 --replication-factor 1
	docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 \
		--create --if-not-exists --topic whatsapp-sync --partitions 6 --replication-factor 1
	docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 \
		--create --if-not-exists --topic audit-log --partitions 3 --replication-factor 1
	docker compose exec kafka kafka-topics --bootstrap-server localhost:9092 \
		--create --if-not-exists --topic metric-events --partitions 3 --replication-factor 1
	@echo "Tópicos criados."

setup: up kafka-create-topics
	@echo ""
	@echo "✓ CRM Mágico dev environment pronto!"
	@echo "  Auth Service:  make auth-dev"
	@echo "  Grafana:       http://localhost:3001"
	@echo "  Prometheus:    http://localhost:9090"
	@echo "  PostgreSQL:    localhost:5432"
	@echo "  Redis:         localhost:6379"
	@echo "  Kafka:         localhost:9092"
