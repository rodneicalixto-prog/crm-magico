export type WaAccountType = 'official' | 'unofficial' | 'evolution'
export type WaAccountStatus = 'connected' | 'disconnected' | 'pending_qr' | 'banned'
export type ConversationStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'archived'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'template'

export interface WaAccount {
  id: string
  company_id: string
  phone_number: string
  display_name: string | null
  account_type: WaAccountType
  status: WaAccountStatus
  session_data: Record<string, unknown>
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  company_id: string
  phone_number: string
  name: string | null
  email: string | null
  avatar_url: string | null
  tags: string[]
  opt_out: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  company_id: string
  contact_id: string
  assigned_user_id: string | null
  wa_account_id: string | null
  department_id: string | null
  status: ConversationStatus
  priority: 'urgent' | 'normal' | 'low'
  unread_count: number
  last_message_at: string | null
  resolved_at: string | null
  sla_deadline_at: string | null
  created_at: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_user_id: string | null
  direction: MessageDirection
  msg_type: MessageType
  content: string | null
  media_url: string | null
  wa_message_id: string | null
  status: MessageStatus
  created_at: string
}

// Evolution API webhook payload
export interface EvolutionWebhookEvent {
  event: string
  instance: string
  data: {
    key?: {
      remoteJid: string
      fromMe: boolean
      id: string
    }
    message?: {
      conversation?: string
      imageMessage?: { url: string; caption?: string }
      audioMessage?: { url: string }
      documentMessage?: { url: string; fileName: string }
      videoMessage?: { url: string; caption?: string }
    }
    messageType?: string
    messageTimestamp?: number
    pushName?: string
    status?: string
    qrcode?: { base64: string; count: number }
    state?: string
  }
  destination: string
  date_time: string
  sender: string
  server_url: string
  apikey: string
}
