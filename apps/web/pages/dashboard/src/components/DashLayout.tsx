import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, Bot, MessageSquare, FileText, CreditCard, Settings, Globe, Package, LogOut, GitBranch,
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
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <span className="font-bold text-base tracking-tight">
            ASSAPPFAC Platform
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>

        {/* View site link — external */}
        <div className="px-3 pb-4 border-t border-gray-100">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <Globe size={18} /> View Site
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
