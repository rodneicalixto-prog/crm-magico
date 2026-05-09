import axios from 'axios'
import { useAuthStore } from '../store/auth'

const AUTH_BASE = import.meta.env.VITE_AUTH_URL ?? '/api/auth'
const WA_BASE   = import.meta.env.VITE_WA_URL   ?? '/api/wa'

function makeClient(baseURL: string) {
  const client = axios.create({ baseURL })

  client.interceptors.request.use(cfg => {
    const token = useAuthStore.getState().token
    if (token) cfg.headers.Authorization = `Bearer ${token}`
    return cfg
  })

  client.interceptors.response.use(
    r => r,
    async err => {
      if (err.response?.status === 401) {
        const { refreshToken, logout } = useAuthStore.getState()
        const ok = await refreshToken()
        if (ok) {
          err.config.headers.Authorization = `Bearer ${useAuthStore.getState().token}`
          return client.request(err.config)
        }
        logout()
      }
      return Promise.reject(err)
    }
  )

  return client
}

export const authApi = makeClient(AUTH_BASE)
export const waApi   = makeClient(WA_BASE)
