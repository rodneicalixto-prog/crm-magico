import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { waApi } from '../lib/api'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

type Status = 'open' | 'in_progress' | 'waiting' | 'resolved'

interface Conversation {
  id: string
  contact_name?: string
  contact_phone?: string
  status: Status
  assigned_to?: string
  updated_at: string
  last_message?: string
}

const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: 'open',        label: 'Novo',          color: 'bg-blue-50 border-blue-200' },
  { key: 'in_progress', label: 'Em Atendimento', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'waiting',     label: 'Aguardando',    color: 'bg-orange-50 border-orange-200' },
  { key: 'resolved',    label: 'Resolvido',     color: 'bg-green-50 border-green-200' },
]

function ConvCard({ conv, onMove }: { conv: Conversation; onMove: (id: string, s: Status) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-gray-900 truncate">
          {conv.contact_name ?? conv.contact_phone ?? 'Desconhecido'}
        </p>
      </div>
      {conv.last_message && (
        <p className="text-xs text-gray-500 truncate">{conv.last_message}</p>
      )}
      <div className="flex gap-1 flex-wrap">
        {COLUMNS.filter(c => c.key !== conv.status).map(c => (
          <button
            key={c.key}
            onClick={() => onMove(conv.id, c.key)}
            className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-brand-100 text-gray-600 hover:text-brand-700 transition-colors"
          >
            → {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Kanban() {
  const qc = useQueryClient()

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await waApi.get('/v1/conversations?limit=200')
      return data.conversations ?? []
    },
  })

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      waApi.patch(`/v1/conversations/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversa movida')
    },
    onError: () => toast.error('Erro ao mover conversa'),
  })

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Carregando…</div>
  }

  return (
    <div className="p-6 h-full overflow-x-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-5">Kanban de Conversas</h1>
      <div className="flex gap-4 min-w-max h-[calc(100vh-8rem)]">
        {COLUMNS.map(col => {
          const items = conversations.filter(c => c.status === col.key)
          return (
            <div key={col.key} className={clsx('flex flex-col w-72 rounded-xl border p-3', col.color)}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-gray-700">{col.label}</h2>
                <span className="bg-white text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-200">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin pr-0.5">
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Vazio</p>
                ) : (
                  items.map(conv => (
                    <ConvCard
                      key={conv.id}
                      conv={conv}
                      onMove={(id, status) => moveMutation.mutate({ id, status })}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
