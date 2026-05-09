import { useQuery } from '@tanstack/react-query'
import { waApi } from '../lib/api'
import { MessageSquare, Users, Clock, CheckCircle } from 'lucide-react'

interface Stats {
  open: number
  in_progress: number
  waiting: number
  resolved_today: number
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: convs } = useQuery({
    queryKey: ['conversations', 'dashboard'],
    queryFn: async () => {
      const { data } = await waApi.get('/v1/conversations?limit=200')
      return data.conversations ?? []
    },
  })

  const stats: Stats = {
    open:           (convs ?? []).filter((c: { status: string }) => c.status === 'open').length,
    in_progress:    (convs ?? []).filter((c: { status: string }) => c.status === 'in_progress').length,
    waiting:        (convs ?? []).filter((c: { status: string }) => c.status === 'waiting').length,
    resolved_today: (convs ?? []).filter((c: { status: string }) => c.status === 'resolved').length,
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Abertas"        value={stats.open}           icon={MessageSquare} color="bg-blue-500" />
        <StatCard label="Em Atendimento" value={stats.in_progress}    icon={Users}         color="bg-yellow-500" />
        <StatCard label="Aguardando"     value={stats.waiting}        icon={Clock}         color="bg-orange-500" />
        <StatCard label="Resolvidas"     value={stats.resolved_today} icon={CheckCircle}   color="bg-green-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Conversas Recentes</h2>
        {!convs || convs.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma conversa ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {convs.slice(0, 10).map((c: { id: string; contact_name?: string; status: string; updated_at: string }) => (
              <li key={c.id} className="py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">
                  {c.contact_name ?? 'Contato desconhecido'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
