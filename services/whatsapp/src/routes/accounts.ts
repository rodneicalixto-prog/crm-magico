import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { accountRepo } from '../repositories/account.repo.js'
import { messageService } from '../services/message.service.js'
import { env } from '../config/env.js'

const app = new Hono()
app.use('*', authMiddleware)

const createSchema = z.object({
  phone_number:  z.string().min(5),
  display_name:  z.string().optional(),
  account_type:  z.enum(['official', 'unofficial', 'evolution']).default('evolution'),
  is_shared:     z.boolean().optional(),
})

// GET /accounts
app.get('/', async (c) => {
  const claims = c.get('claims')
  const companyId = claims.cid
  if (!companyId) return c.json({ error: 'company required' }, 400)

  const accounts = await accountRepo.listByCompany(companyId)
  return c.json({ data: accounts })
})

// POST /accounts
app.post('/', requireRole('company_admin'), zValidator('json', createSchema), async (c) => {
  const claims = c.get('claims')
  const companyId = claims.cid!
  const body = c.req.valid('json')

  const account = await accountRepo.create({ ...body, company_id: companyId })
  return c.json(account, 201)
})

// DELETE /accounts/:id
app.delete('/:id', requireRole('company_admin'), async (c) => {
  const claims = c.get('claims')
  const deleted = await accountRepo.delete(c.req.param('id'), claims.cid!)
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})

// POST /accounts/:id/connect — iniciar conexão + QR code
app.post('/:id/connect', requireRole('company_admin'), async (c) => {
  const claims = c.get('claims')
  const webhookBase = env.EVOLUTION_API_URL?.replace('/api', '') ?? ''
  try {
    const result = await messageService.connectAccount(c.req.param('id'), claims.cid!, webhookBase)
    return c.json(result)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// GET /accounts/:id/qrcode
app.get('/:id/qrcode', async (c) => {
  const claims = c.get('claims')
  try {
    const qr = await messageService.getQrCode(c.req.param('id'), claims.cid!)
    if (!qr) return c.json({ error: 'QR code not available yet' }, 404)
    return c.json(qr)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// POST /accounts/:id/disconnect
app.post('/:id/disconnect', requireRole('company_admin'), async (c) => {
  const claims = c.get('claims')
  try {
    await messageService.disconnectAccount(c.req.param('id'), claims.cid!)
    return c.body(null, 204)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

export { app as accountRoutes }
