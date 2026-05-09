import { evolutionService } from './evolution.service.js'
import { accountRepo } from '../repositories/account.repo.js'
import { contactRepo } from '../repositories/contact.repo.js'
import { conversationRepo, messageRepo } from '../repositories/conversation.repo.js'
import { redis } from '../config/redis.js'
import type { EvolutionWebhookEvent } from '../models/types.js'
import { env } from '../config/env.js'

export const messageService = {
  // Enviar mensagem de texto via Evolution API
  async sendText(params: {
    companyId: string
    accountId: string
    conversationId: string
    senderUserId: string
    text: string
  }) {
    const account = await accountRepo.findById(params.accountId, params.companyId)
    if (!account) throw new Error('account not found')

    const conversation = await conversationRepo.findById(params.conversationId, params.companyId)
    if (!conversation) throw new Error('conversation not found')

    const contact = await contactRepo.findById(conversation.contact_id, params.companyId)
    if (!contact) throw new Error('contact not found')

    const instanceName = `crm_${params.accountId}`
    const waId = await evolutionService.sendText(instanceName, {
      number: contact.phone_number,
      text: params.text,
    })

    return messageRepo.create({
      conversation_id: params.conversationId,
      sender_user_id: params.senderUserId,
      direction: 'outbound',
      msg_type: 'text',
      content: params.text,
      wa_message_id: waId,
      status: 'sent',
    })
  },

  // Processar evento inbound do Evolution API webhook
  async processWebhookEvent(event: EvolutionWebhookEvent) {
    const { event: eventType, instance, data } = event

    // Encontrar a conta pelo nome da instância (crm_{accountId})
    const accountId = instance.replace('crm_', '')

    if (eventType === 'CONNECTION_UPDATE') {
      await this.handleConnectionUpdate(accountId, data.state ?? 'disconnected')
      return
    }

    if (eventType === 'QRCODE_UPDATED' && data.qrcode) {
      await redis.setex(`qr:${accountId}`, 60, JSON.stringify(data.qrcode))
      return
    }

    if (eventType === 'MESSAGES_UPSERT' && data.key && data.message) {
      await this.handleInboundMessage(accountId, event)
      return
    }

    if (eventType === 'MESSAGES_UPDATE' && data.key) {
      const status = (data.status ?? '').toLowerCase()
      const mapped = status === 'read' ? 'read' : status === 'delivery_ack' ? 'delivered' : 'sent'
      await messageRepo.updateStatus(data.key.id!, mapped)
    }
  },

  async handleConnectionUpdate(accountId: string, state: string) {
    const mapped =
      state === 'open' ? 'connected' :
      state === 'connecting' ? 'pending_qr' :
      state === 'close' ? 'disconnected' : 'disconnected'

    await accountRepo.updateStatus(accountId, mapped)
  },

  async handleInboundMessage(accountId: string, event: EvolutionWebhookEvent) {
    const { data } = event
    if (!data.key || data.key.fromMe) return  // ignorar mensagens enviadas por nós

    const phone = data.key.remoteJid!.replace('@s.whatsapp.net', '').replace('@c.us', '')
    const pushName = data.pushName

    // Buscar a conta para obter company_id
    const { rows } = await (await import('../config/db.js')).pool.query(
      `SELECT company_id FROM whatsapp_accounts WHERE id = $1`, [accountId]
    )
    if (!rows[0]) return
    const companyId: string = rows[0].company_id

    // Auto-discover contato
    const contact = await contactRepo.findOrCreate(companyId, phone, pushName)

    // Obter ou criar conversa aberta
    const conversation = await conversationRepo.findOrCreate(companyId, contact.id, accountId)

    // Determinar tipo e conteúdo
    const msg = data.message!
    let msgType: string = 'text'
    let content: string | null = null
    let mediaUrl: string | null = null

    if (msg.conversation) {
      content = msg.conversation
    } else if (msg.imageMessage) {
      msgType = 'image'
      mediaUrl = msg.imageMessage.url
      content = msg.imageMessage.caption ?? null
    } else if (msg.audioMessage) {
      msgType = 'audio'
      mediaUrl = msg.audioMessage.url
    } else if (msg.documentMessage) {
      msgType = 'document'
      mediaUrl = msg.documentMessage.url
      content = msg.documentMessage.fileName
    } else if (msg.videoMessage) {
      msgType = 'video'
      mediaUrl = msg.videoMessage.url
      content = msg.videoMessage.caption ?? null
    }

    await messageRepo.create({
      conversation_id: conversation.id,
      direction: 'inbound',
      msg_type: msgType,
      content,
      media_url: mediaUrl,
      wa_message_id: data.key.id,
      status: 'delivered',
    })

    await conversationRepo.incrementUnread(conversation.id)

    // Publicar evento em Redis para WebSocket/outros serviços
    await redis.publish('whatsapp:message', JSON.stringify({
      event: 'new_message',
      company_id: companyId,
      conversation_id: conversation.id,
      contact_id: contact.id,
    }))
  },

  async connectAccount(accountId: string, companyId: string, webhookBase: string) {
    const account = await accountRepo.findById(accountId, companyId)
    if (!account) throw new Error('account not found')

    const instanceName = `crm_${accountId}`
    await evolutionService.createInstance(instanceName, account.phone_number)

    const webhookUrl = `${webhookBase}/webhook/evolution/${accountId}`
    await evolutionService.setWebhook(instanceName, webhookUrl)

    await accountRepo.updateStatus(accountId, 'pending_qr')
    return { instance_name: instanceName }
  },

  async getQrCode(accountId: string, companyId: string) {
    const account = await accountRepo.findById(accountId, companyId)
    if (!account) throw new Error('account not found')

    // Try cache first
    const cached = await redis.get(`qr:${accountId}`)
    if (cached) return JSON.parse(cached)

    const instanceName = `crm_${accountId}`
    return evolutionService.getQrCode(instanceName)
  },

  async disconnectAccount(accountId: string, companyId: string) {
    const account = await accountRepo.findById(accountId, companyId)
    if (!account) throw new Error('account not found')

    const instanceName = `crm_${accountId}`
    await evolutionService.deleteInstance(instanceName)
    await accountRepo.updateStatus(accountId, 'disconnected')
  },
}
