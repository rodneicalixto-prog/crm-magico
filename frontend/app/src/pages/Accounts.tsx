import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { waApi, authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { Plus, QrCode, Wifi, WifiOff } from 'lucide-react'
import { useAuthStore } from '../store/auth'

interface Account {
  id: string
  name: string
  phone_number?: string
  status: string
  created_at: string
}

interface Company { id: string; name: string }

export default function Accounts() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const isSuperAdmin = user?.role === 'super_admin'

  const [newName, setNewName] = useState('')
  const [qrModal, setQrModal] = useState<{ id: string; qr?: string } | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>(user?.company_id ?? '')

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['companies-list'],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data } = await authApi.get('/v1/super-admin/companies')
      return data.data ?? data.companies ?? []
    },
  })

  const companyId = isSuperAdmin ? selectedCompany : (user?.company_id ?? '')
  const qs = companyId ? `?company_id=${companyId}` : ''

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['accounts', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await waApi.get(`/v1/accounts${qs}`)
      return data.accounts ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => waApi.post('/v1/accounts', { name, company_id: companyId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); setNewName('') },
    onError: () => toast.error('Erro ao criar conta'),
  })

  const connectMutation = useMutation({
    mutationFn: (id: string) => waApi.post(`/v1/accounts/${id}/connect${qs}`),
    onSuccess: async (_, id) => {
      toast.success('Gerando QR Code…')
      const { data } = await waApi.get(`/v1/accounts/${id}/qrcode${qs}`)
      setQrModal({ id, qr: data.qr_code })
    },
    onError: () => toast.error('Erro ao conectar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => waApi.delete(`/v1/accounts/${id}${qs}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); toast.success('Conta removida') },
    onError: () => toast.error('Erro ao remover conta'),
  })

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      connected:   'bg-green-100 text-green-700',
      pending_qr:  'bg-yellow-100 text-yellow-700',
      disconnected:'bg-red-100 text-red-700',
    }
    return map[status] ?? 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-6 space-y-4">
      {isSuperAdmin && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">Empresa:</label>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— selecione —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Contas WhatsApp</h1>
        <form
          onSubmit={e => { e.preventDefault(); if (newName.trim() && companyId) createMutation.mutate(newName.trim()) }}
          className="flex gap-2"
        >
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome da conta"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!newName.trim() || !companyId || createMutation.isPending}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isSuperAdmin && !companyId ? (
          <p className="p-4 text-sm text-gray-400">Selecione uma empresa para ver as contas.</p>
        ) : isLoading ? (
          <p className="p-4 text-sm text-gray-400">Carregando…</p>
        ) : accounts.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">Nenhuma conta cadastrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.phone_number ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(a.status)}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => connectMutation.mutate(a.id)}
                      disabled={a.status === 'connected'}
                      title="Conectar / QR Code"
                      className="p-1.5 rounded hover:bg-green-50 text-green-600 disabled:opacity-30"
                    >
                      <QrCode size={15} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(a.id)}
                      title="Remover"
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                    >
                      <WifiOff size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center space-y-4 shadow-xl">
            <h2 className="font-bold text-gray-900">Escanear QR Code</h2>
            {qrModal.qr ? (
              <img src={`data:image/png;base64,${qrModal.qr}`} alt="QR Code" className="mx-auto" />
            ) : (
              <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
                <Wifi size={20} className="animate-pulse" /> Gerando…
              </div>
            )}
            <button
              onClick={() => setQrModal(null)}
              className="w-full border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
