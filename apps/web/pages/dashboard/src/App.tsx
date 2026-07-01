import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import DashLayout        from './components/DashLayout'
import LoginPage         from './pages/auth/LoginPage'
import OverviewPage      from './pages/dash/OverviewPage'
import AgentsPage        from './pages/dash/AgentsPage'
import ConversationsPage from './pages/dash/ConversationsPage'
import DocumentsPage     from './pages/dash/DocumentsPage'
import TransactionsPage  from './pages/dash/TransactionsPage'
import SettingsPage      from './pages/dash/SettingsPage'
import TemplatesPage    from './pages/dash/TemplatesPage'
import WorkflowPage     from './pages/dash/WorkflowPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashLayout /></ProtectedRoute>}>
        <Route index                  element={<OverviewPage />}      />
        <Route path="agents"          element={<AgentsPage />}        />
        <Route path="conversations"   element={<ConversationsPage />} />
        <Route path="documents"       element={<DocumentsPage />}     />
        <Route path="transactions"    element={<TransactionsPage />}  />
        <Route path="settings"        element={<SettingsPage />}      />
          <Route path="templates"       element={<TemplatesPage />}     />
          <Route path="workflow"        element={<WorkflowPage />}      />
          <Route path="*"               element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
