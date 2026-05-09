import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  email: string
  role: 'super_admin' | 'company_admin' | 'supervisor' | 'operational'
  company_id?: string
  department_id?: string
}

interface AuthState {
  token: string | null
  refresh: string | null
  user: AuthUser | null
  setTokens: (token: string, refresh: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
  refreshToken: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refresh: null,
      user: null,

      setTokens: (token, refresh) => set({ token, refresh }),
      setUser: (user) => set({ user }),

      logout: () => {
        set({ token: null, refresh: null, user: null })
        window.location.href = '/login'
      },

      refreshToken: async () => {
        const { refresh } = get()
        if (!refresh) return false
        const base = import.meta.env.VITE_AUTH_URL || 'https://auth.sosbot.online'
        try {
          const res = await fetch(`${base}/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          })
          if (!res.ok) return false
          const data = await res.json()
          set({ token: data.tokens?.access_token, refresh: data.tokens?.refresh_token })
          return true
        } catch {
          return false
        }
      },
    }),
    { name: 'crm-auth', partialize: s => ({ token: s.token, refresh: s.refresh, user: s.user }) }
  )
)

export const roleLevel: Record<string, number> = {
  operational: 1, supervisor: 2, company_admin: 3, super_admin: 4,
}

export function hasRole(user: AuthUser | null, minRole: string) {
  return (roleLevel[user?.role ?? ''] ?? 0) >= (roleLevel[minRole] ?? 99)
}
