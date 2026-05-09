import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Kanban from './pages/Kanban'
import Contacts from './pages/Contacts'
import Accounts from './pages/Accounts'
import Team from './pages/Team'
import Companies from './pages/Companies'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="kanban"    element={<Kanban />} />
          <Route path="contacts"  element={<Contacts />} />
          <Route path="accounts"  element={<Accounts />} />
          <Route path="team"      element={<Team />} />
          <Route path="companies" element={<Companies />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
