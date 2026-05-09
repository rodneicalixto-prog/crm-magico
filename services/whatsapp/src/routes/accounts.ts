import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, requireRole, type JwtClaims } from '../middleware/auth.js'
import { accountRepo } from '../repositories/account.repo.js'
import { messageService } from '../services/message.service.js'
import { env } from '../config/env.js'

type Env = { Variables: { claims: JwtClaims } }
const app = new Hono<Env>()
app.use('*', authMiddleware)

const createSchema = z.object({
  name:          z.string().min(1).optional(),
  phone_number:  z.string().min(5).optional(),
  display_name:  z.string().optional(),
  account_type:  z.enum(['official', 'unofficial', 'evolution']).default('evolution'),
  is_shared:     z.boolean().optional(),
  company_id:    z.string().uuid().optional(), // super_admin pode especificar
})

function resolveCompany(claims: JwtClaims, override?: string): string | null {
  if (claims.role === 'super_admin') return override ?? null
  return claims.cid ?? null
}

function toAccountView(row: any) {
  return { ...row, name: row.display_name ?? row.phone_number ?? row.id }
}

// GET /accounts
app.get('/', async (c) => {
  const claims = c.get('claims')
  const companyId = resolveCompany(claims, c.req.query('company_id'))
  if (!companyId) return c.json({ error: 'company_id required' }, 400)

  const accounts = await accountRepo.listByCompany(companyId)
  return c.json({ accounts: accounts.map(toAccountView) })
})

// POST /accounts
app.post('/', requireRole('company_admin'), zValidator('json', createSchema), async (c) => {
  const claims = c.get('claims')
  const body = c.req.valid('json')
  const companyId = resolveCompany(claims, body.company_id)
  if (!companyId) return c.json({ error: 'company_id required' }, 400)

  const displayName = body.name ?? body.display_name ?? null
  const account = await accountRepo.create({
    company_id:   companyId,
    phone_number: body.phone_number || null,
    display_name: displayName ?? undefined,
    account_type: body.account_type,
    is_shared:    body.is_shared,
  })
  return c.json(toAccountView(account), 201)
})

// DELETE /accounts/:id
app.delete('/:id', requireRole('company_admin'), async (c) => {
  const claims = c.get('claims')
  const companyId = resolveCompany(claims, c.req.query('company_id'))
  if (!companyId) return c.json({ error: 'company_id required' }, 400)
  const deleted = await accountRepo.delete(c.req.param('id'), companyId)
  if (!deleted) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})

// POST /accounts/:id/connect — iniciar conexão + QR code
app.post('/:id/connect', requireRole('company_admin'), async (c) => {
  const claims = c.get('claims')
  const companyId = resolveCompany(claims, c.req.query('company_id'))
  if (!companyId) return c.json({ error: 'company_id required' }, 400)
  const webhookBase = env.EVOLUTION_API_URL?.replace('/api', '') ?? ''
  try {
    const result = await messageService.connectAccount(c.req.param('id'), companyId, webhookBase)
    return c.json(result)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// GET /accounts/:id/qrcode
app.get('/:id/qrcode', async (c) => {
  const claims = c.get('claims')
  const companyId = resolveCompany(claims, c.req.query('company_id'))
  if (!companyId) return c.json({ error: 'company_id required' }, 400)
  try {
    const qr = await messageService.getQrCode(c.req.param('id'), companyId)
    if (!qr) return c.json({ error: 'QR code not available yet' }, 404)
    return c.json(qr)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// POST /accounts/:id/disconnect
app.post('/:id/disconnect', requireRole('company_admin'), async (c) => {
  const claims = c.get('claims')
  const companyId = resolveCompany(claims, c.req.query('company_id'))
  if (!companyId) return c.json({ error: 'company_id required' }, 400)
  try {
    await messageService.disconnectAccount(c.req.param('id'), companyId)
    return c.body(null, 204)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

export { app as accountRoutes }
