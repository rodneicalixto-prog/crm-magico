import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware, type JwtClaims } from '../middleware/auth.js'
import { contactRepo } from '../repositories/contact.repo.js'

type Env = { Variables: { claims: JwtClaims } }
const app = new Hono<Env>()
app.use('*', authMiddleware)

// GET /contacts
app.get('/', async (c) => {
  const claims = c.get('claims')
  const search = c.req.query('search')
  const limit  = parseInt(c.req.query('limit')  ?? '20', 10)
  const offset = parseInt(c.req.query('offset') ?? '0',  10)

  const result = await contactRepo.list(claims.cid!, { search, limit, offset })
  return c.json(result)
})

// GET /contacts/:id
app.get('/:id', async (c) => {
  const claims = c.get('claims')
  const contact = await contactRepo.findById(c.req.param('id'), claims.cid!)
  if (!contact) return c.json({ error: 'not found' }, 404)
  return c.json(contact)
})

// PATCH /contacts/:id
app.patch('/:id', zValidator('json', z.object({
  name:    z.string().optional(),
  email:   z.string().email().optional(),
  tags:    z.array(z.string()).optional(),
  opt_out: z.boolean().optional(),
})), async (c) => {
  const claims = c.get('claims')
  const body = c.req.valid('json')
  const contact = await contactRepo.update(c.req.param('id'), claims.cid!, body)
  if (!contact) return c.json({ error: 'not found' }, 404)
  return c.json(contact)
})

export { app as contactRoutes }
