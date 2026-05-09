import { pool } from '../config/db.js'
import type { Contact } from '../models/types.js'

export const contactRepo = {
  async findOrCreate(companyId: string, phone: string, name?: string): Promise<Contact> {
    const { rows: found } = await pool.query<Contact>(
      `SELECT * FROM contacts WHERE company_id=$1 AND phone_number=$2`, [companyId, phone]
    )
    if (found[0]) {
      if (name && !found[0].name) {
        await pool.query(`UPDATE contacts SET name=$3 WHERE company_id=$1 AND phone_number=$2`, [companyId, phone, name])
        found[0].name = name
      }
      return found[0]
    }
    const { rows } = await pool.query<Contact>(
      `INSERT INTO contacts (company_id, phone_number, name)
       VALUES ($1, $2, $3) RETURNING *`,
      [companyId, phone, name ?? null]
    )
    return rows[0]
  },

  async list(companyId: string, opts: { search?: string; limit?: number; offset?: number } = {}): Promise<{ data: Contact[]; total: number }> {
    const { limit = 20, offset = 0, search } = opts
    const params: unknown[] = [companyId]
    let where = `company_id = $1`
    if (search) {
      params.push(`%${search}%`)
      where += ` AND (name ILIKE $2 OR phone_number ILIKE $2 OR email ILIKE $2)`
    }

    const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM contacts WHERE ${where}`, params)
    const { rows } = await pool.query<Contact>(
      `SELECT id, company_id, phone_number, name, email, avatar_url, tags, opt_out, created_at, updated_at
       FROM contacts WHERE ${where} ORDER BY name ASC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    )
    return { data: rows, total: parseInt(count, 10) }
  },

  async findById(id: string, companyId: string): Promise<Contact | null> {
    const { rows } = await pool.query<Contact>(
      `SELECT * FROM contacts WHERE id=$1 AND company_id=$2`, [id, companyId]
    )
    return rows[0] ?? null
  },

  async update(id: string, companyId: string, data: Partial<Pick<Contact, 'name' | 'email' | 'tags' | 'opt_out'>>): Promise<Contact | null> {
    const sets: string[] = []
    const params: unknown[] = [id, companyId]
    let i = 3
    if (data.name !== undefined) { sets.push(`name=$${i++}`); params.push(data.name) }
    if (data.email !== undefined) { sets.push(`email=$${i++}`); params.push(data.email) }
    if (data.tags !== undefined) { sets.push(`tags=$${i++}`); params.push(data.tags) }
    if (data.opt_out !== undefined) { sets.push(`opt_out=$${i++}`); params.push(data.opt_out) }
    if (!sets.length) return this.findById(id, companyId)

    const { rows } = await pool.query<Contact>(
      `UPDATE contacts SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$1 AND company_id=$2 RETURNING *`,
      params
    )
    return rows[0] ?? null
  },
}
