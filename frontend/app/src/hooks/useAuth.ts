import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/api'
import { useAuthStore, AuthUser } from '../store/auth'

export function useMe() {
  const setUser = useAuthStore(s => s.setUser)
  const token   = useAuthStore(s => s.token)

  return useQuery<AuthUser>({
    queryKey: ['me'],
    enabled: !!token,
    queryFn: async () => {
      const { data } = await authApi.get('/v1/auth/me')
      setUser(data)
      return data
    },
  })
}
