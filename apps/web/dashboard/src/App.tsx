import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashLayout        from './components/DashLayout'
import OverviewPage      from './pages/dash/OverviewPage'
import AgentsPage        from './pages/dash/AgentsPage'
import ConversationsPage from './pages/dash/ConversationsPage'
import DocumentsPage     from './pages/dash/DocumentsPage'
import TransactionsPage  from './pages/dash/TransactionsPage'
import SettingsPage      from './pages/dash/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashLayout />}>
          <Route index                  element={<OverviewPage />}      />
          <Route path="agents"          element={<AgentsPage />}        />
          <Route path="conversations"   element={<ConversationsPage />} />
          <Route path="documents"       element={<DocumentsPage />}     />
          <Route path="transactions"    element={<TransactionsPage />}  />
          <Route path="settings"        element={<SettingsPage />}      />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
