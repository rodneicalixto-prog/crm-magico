import { createMiddleware } from 'hono/factory'
import { jwtVerify, importSPKI } from 'jose'
import { env } from '../config/env.js'

export interface JwtClaims {
  uid: string
  cid?: string
  did?: string
  role: string
  email: string
}

const secret = new TextEncoder().encode(env.JWT_SECRET)

export const authMiddleware = createMiddleware<{ Variables: { claims: JwtClaims } }>(
  async (c, next) => {
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    try {
      const { payload } = await jwtVerify(token, secret)
      c.set('claims', payload as unknown as JwtClaims)
    } catch {
      return c.json({ error: 'invalid token' }, 401)
    }

    await next()
  }
)

export const requireRole = (minRole: string) =>
  createMiddleware(async (c, next) => {
    const roleLevel: Record<string, number> = {
      operational: 1, supervisor: 2, company_admin: 3, super_admin: 4,
    }
    const claims = c.get('claims') as JwtClaims
    if ((roleLevel[claims?.role] ?? 0) < (roleLevel[minRole] ?? 99)) {
      return c.json({ error: 'forbidden' }, 403)
    }
    await next()
  })
