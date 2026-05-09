import { z } from 'zod'

const schema = z.object({
  PORT:             z.string().default('8002'),
  ENV:              z.enum(['development', 'production']).default('development'),
  DATABASE_URL:     z.string(),
  REDIS_URL:        z.string(),
  JWT_SECRET:       z.string(),
  AUTH_SERVICE_URL: z.string().default('http://auth-service:8001'),
  // Evolution API (WhatsApp bridge)
  EVOLUTION_API_URL:   z.string().optional(),
  EVOLUTION_API_KEY:   z.string().optional(),
  // Webhook para notificar outros serviços
  WEBHOOK_SECRET:   z.string().default('change_me'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid env:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
