import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/auth'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export default function Team() {
  const qc      = useQueryClient()
  const { user } = useAuthStore()

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await authApi.get('/v1/admin/users')
      return data.users ?? []
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => authApi.delete(`/v1/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Usuário desativado') },
    onError: () => toast.error('Erro ao desativar'),
  })

  function roleBadge(role: string) {
    const map: Record<string, string> = {
      super_admin:   'bg-purple-100 text-purple-700',
      company_admin: 'bg-blue-100 text-blue-700',
      supervisor:    'bg-teal-100 text-teal-700',
      operational:   'bg-gray-100 text-gray-600',
    }
    return map[role] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Equipe</h1>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-400">Carregando…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Função</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge(u.role)}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== user?.id && (
                      <button
                        onClick={() => deactivateMutation.mutate(u.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                        title="Desativar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
