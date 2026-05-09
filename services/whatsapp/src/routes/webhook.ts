import { Hono } from 'hono'
import { messageService } from '../services/message.service.js'
import type { EvolutionWebhookEvent } from '../models/types.js'
import { env } from '../config/env.js'

const app = new Hono()

// Evolution API webhook — chamado pelo Evolution quando chegam eventos
app.post('/evolution/:accountId', async (c) => {
  // Validar secret via header
  const apikey = c.req.header('apikey') ?? c.req.header('x-api-key') ?? ''
  if (env.EVOLUTION_API_KEY && apikey !== env.EVOLUTION_API_KEY) {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const body = await c.req.json() as EvolutionWebhookEvent
  try {
    await messageService.processWebhookEvent(body)
    return c.json({ ok: true })
  } catch (err: any) {
    console.error('Webhook error:', err.message)
    return c.json({ error: 'processing failed' }, 500)
  }
})

export { app as webhookRoutes }
