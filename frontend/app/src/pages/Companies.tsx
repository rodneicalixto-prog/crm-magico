import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Company {
  id: string
  name: string
  plan: string
  is_active: boolean
  created_at: string
}

export default function Companies() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', plan: 'basic' })

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data } = await authApi.get('/v1/super-admin/companies')
      return data.companies ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: () => authApi.post('/v1/super-admin/companies', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); setForm({ name: '', plan: 'basic' }); toast.success('Empresa criada') },
    onError: () => toast.error('Erro ao criar empresa'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authApi.delete(`/v1/super-admin/companies/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Empresa removida') },
    onError: () => toast.error('Erro ao remover'),
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Empresas</h1>
        <form
          onSubmit={e => { e.preventDefault(); if (form.name.trim()) createMutation.mutate() }}
          className="flex gap-2"
        >
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Nome da empresa"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={form.plan}
            onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button
            type="submit"
            disabled={!form.name.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} /> Criar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <p className="p-4 text-sm text-gray-400">Carregando…</p>
        ) : companies.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nenhuma empresa cadastrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Criada em</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{c.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${c.is_active ? 'text-green-600' : 'text-red-500'}`}>
                      {c.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
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
