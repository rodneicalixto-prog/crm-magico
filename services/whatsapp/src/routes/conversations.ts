import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { conversationRepo, messageRepo } from '../repositories/conversation.repo.js'
import { messageService } from '../services/message.service.js'

const app = new Hono()
app.use('*', authMiddleware)

// GET /conversations
app.get('/', async (c) => {
  const claims = c.get('claims')
  const companyId = claims.cid
  if (!companyId) return c.json({ error: 'company required' }, 400)

  const status = c.req.query('status')
  const limit  = parseInt(c.req.query('limit')  ?? '20', 10)
  const offset = parseInt(c.req.query('offset') ?? '0',  10)
  const assignedUserId = c.req.query('assigned_to')

  const result = await conversationRepo.list(companyId, { status, limit, offset, assignedUserId })
  return c.json(result)
})

// GET /conversations/:id
app.get('/:id', async (c) => {
  const claims = c.get('claims')
  const conv = await conversationRepo.findById(c.req.param('id'), claims.cid!)
  if (!conv) return c.json({ error: 'not found' }, 404)
  return c.json(conv)
})

// PATCH /conversations/:id/assign
app.patch('/:id/assign', zValidator('json', z.object({ user_id: z.string().uuid() })), async (c) => {
  const claims = c.get('claims')
  const { user_id } = c.req.valid('json')
  const ok = await conversationRepo.assign(c.req.param('id'), claims.cid!, user_id)
  if (!ok) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})

// PATCH /conversations/:id/status
app.patch('/:id/status', zValidator('json', z.object({
  status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'archived'])
})), async (c) => {
  const claims = c.get('claims')
  const { status } = c.req.valid('json')
  const ok = await conversationRepo.updateStatus(c.req.param('id'), claims.cid!, status)
  if (!ok) return c.json({ error: 'not found' }, 404)
  return c.body(null, 204)
})

// GET /conversations/:id/messages
app.get('/:id/messages', async (c) => {
  const limit  = parseInt(c.req.query('limit')  ?? '50', 10)
  const before = c.req.query('before')
  const messages = await messageRepo.list(c.req.param('id'), { limit, before })

  // Marcar como lidas
  await conversationRepo.resetUnread(c.req.param('id'))
  return c.json({ data: messages })
})

// POST /conversations/:id/messages — enviar mensagem
app.post('/:id/messages', zValidator('json', z.object({
  account_id: z.string().uuid(),
  text: z.string().min(1),
})), async (c) => {
  const claims = c.get('claims')
  const { account_id, text } = c.req.valid('json')

  try {
    const message = await messageService.sendText({
      companyId: claims.cid!,
      accountId: account_id,
      conversationId: c.req.param('id'),
      senderUserId: claims.uid,
      text,
    })
    return c.json(message, 201)
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

export { app as conversationRoutes }
