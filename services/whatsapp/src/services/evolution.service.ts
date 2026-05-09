import axios from 'axios'
import { env } from '../config/env.js'

const api = axios.create({
  baseURL: env.EVOLUTION_API_URL ?? 'http://evolution-api:8080',
  headers: { apikey: env.EVOLUTION_API_KEY ?? '' },
  timeout: 30_000,
})

export interface SendTextPayload {
  number: string
  text: string
  delay?: number
}

export interface SendMediaPayload {
  number: string
  mediatype: 'image' | 'video' | 'audio' | 'document'
  media: string   // URL ou base64
  caption?: string
  fileName?: string
}

export const evolutionService = {
  async createInstance(instanceName: string, phoneNumber: string) {
    const { data } = await api.post('/instance/create', {
      instanceName,
      number: phoneNumber,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    })
    return data
  },

  async getQrCode(instanceName: string): Promise<{ base64: string; count: number } | null> {
    try {
      const { data } = await api.get(`/instance/connect/${instanceName}`)
      return data?.qrcode ?? null
    } catch {
      return null
    }
  },

  async getInstanceStatus(instanceName: string): Promise<string> {
    try {
      const { data } = await api.get(`/instance/connectionState/${instanceName}`)
      return data?.instance?.state ?? 'unknown'
    } catch {
      return 'disconnected'
    }
  },

  async deleteInstance(instanceName: string) {
    await api.delete(`/instance/delete/${instanceName}`)
  },

  async sendText(instanceName: string, payload: SendTextPayload): Promise<string> {
    const { data } = await api.post(`/message/sendText/${instanceName}`, {
      number: payload.number,
      textMessage: { text: payload.text },
      delay: payload.delay ?? 1000,
    })
    return data?.key?.id ?? ''
  },

  async sendMedia(instanceName: string, payload: SendMediaPayload): Promise<string> {
    const { data } = await api.post(`/message/sendMedia/${instanceName}`, {
      number: payload.number,
      mediatype: payload.mediatype,
      media: payload.media,
      caption: payload.caption ?? '',
      fileName: payload.fileName ?? '',
    })
    return data?.key?.id ?? ''
  },

  async setWebhook(instanceName: string, webhookUrl: string) {
    await api.post(`/webhook/set/${instanceName}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATED',
          'SEND_MESSAGE',
        ],
      },
    })
  },

  async listInstances(): Promise<Array<{ instanceName: string; state: string }>> {
    try {
      const { data } = await api.get('/instance/fetchInstances')
      return data ?? []
    } catch {
      return []
    }
  },
}
