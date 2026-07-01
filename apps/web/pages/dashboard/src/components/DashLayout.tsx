import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Bot, MessageSquare, FileText, CreditCard, Settings, Globe, Package, LogOut, GitBranch, Menu, X,
} from 'lucide-react'

const NAV = [
  { to: '/',              icon: <LayoutDashboard size={18} />, label: 'Overview',      end: true  },
  { to: '/agents',        icon: <Bot size={18} />,             label: 'Agents',        end: false },
  { to: '/conversations', icon: <MessageSquare size={18} />,   label: 'Conversations', end: false },
  { to: '/documents',     icon: <FileText size={18} />,        label: 'Documents',     end: false },
  { to: '/transactions',  icon: <CreditCard size={18} />,      label: 'Transactions',  end: false },
  { to: '/templates',     icon: <Package size={18} />,         label: 'Templates',     end: false },
  { to: '/workflow',      icon: <GitBranch size={18} />,      label: 'Workflow',      end: false },
  { to: '/settings',      icon: <Settings size={18} />,        label: 'Settings',      end: false },
]

export default function DashLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={`shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'w-56' : 'w-0 -ml-56'
      }`}>
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <span className="font-bold text-base tracking-tight text-sidebar-foreground">
            ASSAPPFAC Platform
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>

        <div className="px-3 pb-4 border-t border-sidebar-border">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Globe size={18} /> View Site
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-muted/30 flex flex-col">
        <div className="h-16 border-b border-border px-6 flex items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
