import { NavLink } from 'react-router-dom'
import { LayoutDashboard, MessageSquare, Users, Building2, PhoneCall, LogOut } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore, hasRole } from '../store/auth'

const link = 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors'
const active = 'bg-brand-600 text-white'
const idle   = 'text-gray-300 hover:bg-white/10'

export default function Sidebar() {
  const { user, logout } = useAuthStore()

  return (
    <aside className="w-60 bg-brand-900 flex flex-col h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-white font-bold text-lg">CRM Mágico</p>
        <p className="text-brand-100 text-xs truncate mt-0.5">{user?.email}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        <NavLink to="/" end className={({ isActive }) => clsx(link, isActive ? active : idle)}>
          <LayoutDashboard size={16} /> Dashboard
        </NavLink>

        <NavLink to="/kanban" className={({ isActive }) => clsx(link, isActive ? active : idle)}>
          <MessageSquare size={16} /> Conversas
        </NavLink>

        <NavLink to="/contacts" className={({ isActive }) => clsx(link, isActive ? active : idle)}>
          <Users size={16} /> Contatos
        </NavLink>

        <NavLink to="/accounts" className={({ isActive }) => clsx(link, isActive ? active : idle)}>
          <PhoneCall size={16} /> WhatsApp
        </NavLink>

        {hasRole(user, 'company_admin') && (
          <NavLink to="/team" className={({ isActive }) => clsx(link, isActive ? active : idle)}>
            <Users size={16} /> Equipe
          </NavLink>
        )}

        {hasRole(user, 'super_admin') && (
          <NavLink to="/companies" className={({ isActive }) => clsx(link, isActive ? active : idle)}>
            <Building2 size={16} /> Empresas
          </NavLink>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={logout}
          className={clsx(link, 'w-full text-left', idle)}
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  )
}
