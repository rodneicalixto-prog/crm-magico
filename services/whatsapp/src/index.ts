import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { pool } from './config/db.js'
import { redis } from './config/redis.js'
import { env } from './config/env.js'
import { accountRoutes } from './routes/accounts.js'
import { conversationRoutes } from './routes/conversations.js'
import { contactRoutes } from './routes/contacts.js'
import { webhookRoutes } from './routes/webhook.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: '*', allowMethods: ['GET','POST','PATCH','DELETE','OPTIONS'] }))

app.get('/health', async (c) => {
  try {
    await pool.query('SELECT 1')
    await redis.ping()
    return c.json({ status: 'ok', service: 'whatsapp', version: '1.0.0' })
  } catch (e: any) {
    return c.json({ status: 'degraded', error: e.message }, 503)
  }
})

const v1 = app.basePath('/v1')
v1.route('/accounts', accountRoutes)
v1.route('/conversations', conversationRoutes)
v1.route('/contacts', contactRoutes)
v1.route('/webhook', webhookRoutes)

// Startup checks
async function start() {
  try {
    await pool.query('SELECT 1')
    console.log('PostgreSQL connected')
    await redis.ping()
    console.log('Redis connected')
  } catch (err) {
    console.error('Startup failed:', err)
    process.exit(1)
  }

  serve({ fetch: app.fetch, port: parseInt(env.PORT) }, (info) => {
    console.log(`WhatsApp Service listening on :${info.port}`)
  })
}

start()
