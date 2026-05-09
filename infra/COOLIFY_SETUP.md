# Coolify — Setup do CRM Mágico

## 1. Gerar API Token

1. Acesse: https://coolify.sosbot.online
2. Clique no seu perfil (canto superior direito) → **Keys & Tokens**
3. Clique em **Add** → dê o nome `crm-magico-deploy`
4. Copie o token gerado (começa com `coolify_...`)
5. Envie o token para o Claude continuar a configuração automaticamente

---

## 2. Configurar Source (GitHub)

No painel Coolify:
1. **Sources** → **Add** → **GitHub App**
2. Repository: `https://github.com/Calixto69/crm-magico`
3. Branch: `main`

---

## 3. Criar Serviços

### Auth Service (Go)
- **New Resource** → **Application** → **Dockerfile**
- Repository: `Calixto69/crm-magico`
- Dockerfile path: `services/auth/Dockerfile`
- Port: `8001`
- Domain: `auth.sosbot.online` (ou subdomínio de sua preferência)

**Environment Variables:**
```
DATABASE_URL=postgres://crm:crm_secret@postgres:5432/crm_magico?sslmode=disable
REDIS_URL=redis://:crm_redis_secret@redis:6379/0
JWT_SECRET=<gerar com: openssl rand -hex 32>
JWT_EXPIRY=15m
REFRESH_EXPIRY=168h
PORT=8001
ENV=production
```

### PostgreSQL + TimescaleDB
- **New Resource** → **Database** → **PostgreSQL**
- Version: `timescale/timescaledb:latest-pg14`
- Database: `crm_magico`
- User: `crm`
- Password: (definir senha forte)

### Redis
- **New Resource** → **Database** → **Redis**
- Version: `redis:7-alpine`
- Password: (definir senha forte)

---

## 4. Deploy Automático (Webhook)

Após criar o application no Coolify:
1. Vá em **Settings** do application → **Webhooks**
2. Copie o webhook URL
3. No GitHub: `Settings → Webhooks → Add webhook`
4. Cole a URL, Content-Type: `application/json`, evento: `push`

A cada `git push` para `main` o Coolify fará deploy automático.

---

## 5. Ordem de Deploy

1. PostgreSQL (aguardar ficar healthy)
2. Redis (aguardar ficar healthy)  
3. Auth Service (após os bancos subirem)
