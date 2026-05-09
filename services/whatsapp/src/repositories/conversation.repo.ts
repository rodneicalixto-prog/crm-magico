import { pool } from '../config/db.js'
import type { Conversation, Message } from '../models/types.js'

export const conversationRepo = {
  async list(companyId: string, opts: {
    status?: string; assignedUserId?: string; limit?: number; offset?: number
  } = {}): Promise<{ data: Conversation[]; total: number }> {
    const { limit = 20, offset = 0, status, assignedUserId } = opts
    const conditions = [`company_id = $1`]
    const params: unknown[] = [companyId]
    let i = 2

    if (status) { conditions.push(`status = $${i++}`); params.push(status) }
    if (assignedUserId) { conditions.push(`assigned_user_id = $${i++}`); params.push(assignedUserId) }

    const where = conditions.join(' AND ')
    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM conversations WHERE ${where}`, params
    )
    const { rows } = await pool.query<Conversation>(
      `SELECT id, company_id, contact_id, assigned_user_id, wa_account_id,
              department_id, status, priority, unread_count, last_message_at,
              resolved_at, sla_deadline_at, created_at
       FROM conversations WHERE ${where}
       ORDER BY last_message_at DESC NULLS LAST LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    )
    return { data: rows, total: parseInt(count, 10) }
  },

  async findById(id: string, companyId: string): Promise<Conversation | null> {
    const { rows } = await pool.query<Conversation>(
      `SELECT * FROM conversations WHERE id = $1 AND company_id = $2`, [id, companyId]
    )
    return rows[0] ?? null
  },

  async findOrCreate(companyId: string, contactId: string, waAccountId: string): Promise<Conversation> {
    // Find open conversation for this contact
    const { rows } = await pool.query<Conversation>(
      `SELECT * FROM conversations
       WHERE company_id=$1 AND contact_id=$2 AND status IN ('open','in_progress','waiting')
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, contactId]
    )
    if (rows[0]) return rows[0]

    const { rows: created } = await pool.query<Conversation>(
      `INSERT INTO conversations (company_id, contact_id, wa_account_id, status)
       VALUES ($1, $2, $3, 'open') RETURNING *`,
      [companyId, contactId, waAccountId]
    )
    return created[0]
  },

  async assign(id: string, companyId: string, userId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE conversations
       SET assigned_user_id=$3, status='in_progress', updated_at=NOW()
       WHERE id=$1 AND company_id=$2`,
      [id, companyId, userId]
    )
    return (rowCount ?? 0) > 0
  },

  async updateStatus(id: string, companyId: string, status: string): Promise<boolean> {
    const extra = status === 'resolved' ? `, resolved_at = NOW()` : ''
    const { rowCount } = await pool.query(
      `UPDATE conversations SET status=$3, updated_at=NOW()${extra}
       WHERE id=$1 AND company_id=$2`,
      [id, companyId, status]
    )
    return (rowCount ?? 0) > 0
  },

  async incrementUnread(id: string): Promise<void> {
    await pool.query(
      `UPDATE conversations SET unread_count = unread_count + 1, last_message_at = NOW() WHERE id = $1`,
      [id]
    )
  },

  async resetUnread(id: string): Promise<void> {
    await pool.query(`UPDATE conversations SET unread_count = 0 WHERE id = $1`, [id])
  },
}

export const messageRepo = {
  async list(conversationId: string, opts: { limit?: number; before?: string } = {}): Promise<Message[]> {
    const { limit = 50, before } = opts
    const conditions = [`conversation_id = $1`]
    const params: unknown[] = [conversationId]

    if (before) { conditions.push(`created_at < $2`); params.push(before) }

    const { rows } = await pool.query<Message>(
      `SELECT id, conversation_id, sender_user_id, direction, msg_type,
              content, media_url, wa_message_id, status, created_at
       FROM messages WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    )
    return rows.reverse()
  },

  async create(data: {
    conversation_id: string
    sender_user_id?: string | null
    direction: string
    msg_type: string
    content?: string | null
    media_url?: string | null
    wa_message_id?: string | null
    status?: string
  }): Promise<Message> {
    const { rows } = await pool.query<Message>(
      `INSERT INTO messages
         (conversation_id, sender_user_id, direction, msg_type, content, media_url, wa_message_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.conversation_id, data.sender_user_id ?? null, data.direction,
       data.msg_type, data.content ?? null, data.media_url ?? null,
       data.wa_message_id ?? null, data.status ?? 'pending']
    )
    return rows[0]
  },

  async updateStatus(waMessageId: string, status: string): Promise<void> {
    await pool.query(
      `UPDATE messages SET status=$2 WHERE wa_message_id=$1`, [waMessageId, status]
    )
  },
}
