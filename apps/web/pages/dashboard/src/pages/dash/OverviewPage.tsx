import { useEffect, useState } from 'react'
import { Bot, FileText, MessageSquare, CreditCard, TrendingUp, Users } from 'lucide-react'

interface Stat {
  label:  string
  value:  string | number
  icon:   React.ReactNode
  change: string
  up:     boolean
}

export default function OverviewPage() {
  const [stats] = useState<Stat[]>([
    { label: 'Active Agents',    value: 2,      icon: <Bot size={20} />,           change: '+0',    up: true  },
    { label: 'Conversations',    value: 128,    icon: <MessageSquare size={20} />,  change: '+12%',  up: true  },
    { label: 'Documents Generated', value: 47,  icon: <FileText size={20} />,       change: '+23%',  up: true  },
    { label: 'Transactions',     value: 'KES 14,200', icon: <CreditCard size={20} />, change: '+8%', up: true  },
    { label: 'Active Users',     value: 36,     icon: <Users size={20} />,          change: '+5',    up: true  },
    { label: 'Avg. Response',    value: '1.2s', icon: <TrendingUp size={20} />,     change: '-0.3s', up: true  },
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Platform health at a glance</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
              <span className={`text-xs font-medium ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
                {s.change} this week
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { user: '+254712345678', agent: 'taji',  action: 'CV generated',          time: '2m ago'  },
            { user: '+254798765432', agent: 'taji',  action: 'Application letter sent', time: '11m ago' },
            { user: '+254700112233', agent: 'elim',  action: 'New conversation',        time: '18m ago' },
            { user: '+254711223344', agent: 'taji',  action: 'STK push initiated',      time: '34m ago' },
            { user: '+254733445566', agent: 'elim',  action: 'New conversation',        time: '1h ago'  },
          ].map((row, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-mono">
                  {row.user.slice(-2)}
                </span>
                <div>
                  <span className="font-medium text-gray-800">{row.user}</span>
                  <span className="text-gray-400 mx-1.5">·</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    row.agent === 'taji' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>{row.agent}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <span className="text-gray-600">{row.action}</span>
                <span className="text-gray-400 text-xs w-14 text-right">{row.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
