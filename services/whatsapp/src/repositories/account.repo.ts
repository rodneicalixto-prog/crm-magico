import { pool } from '../config/db.js'
import type { WaAccount } from '../models/types.js'

export const accountRepo = {
  async listByCompany(companyId: string): Promise<WaAccount[]> {
    const { rows } = await pool.query<WaAccount>(
      `SELECT id, company_id, phone_number, display_name, account_type,
              status, session_data, is_shared, created_at, updated_at
       FROM whatsapp_accounts WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId]
    )
    return rows
  },

  async findById(id: string, companyId: string): Promise<WaAccount | null> {
    const { rows } = await pool.query<WaAccount>(
      `SELECT * FROM whatsapp_accounts WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    )
    return rows[0] ?? null
  },

  async create(data: {
    company_id: string
    phone_number?: string | null
    display_name?: string
    account_type: string
    is_shared?: boolean
  }): Promise<WaAccount> {
    const { rows } = await pool.query<WaAccount>(
      `INSERT INTO whatsapp_accounts (company_id, phone_number, display_name, account_type, is_shared)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.company_id, data.phone_number || null, data.display_name ?? null,
       data.account_type, data.is_shared ?? false]
    )
    return rows[0]
  },

  async updateStatus(id: string, status: string): Promise<void> {
    await pool.query(
      `UPDATE whatsapp_accounts SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status]
    )
  },

  async updateSessionData(id: string, data: Record<string, unknown>): Promise<void> {
    await pool.query(
      `UPDATE whatsapp_accounts SET session_data = $2, updated_at = NOW() WHERE id = $1`,
      [id, JSON.stringify(data)]
    )
  },

  async delete(id: string, companyId: string): Promise<boolean> {
    const { rowCount } = await pool.query(
      `DELETE FROM whatsapp_accounts WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    )
    return (rowCount ?? 0) > 0
  },
}
