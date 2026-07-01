import { useEffect, useState } from 'react'
import { Bot, FileText, CreditCard, Users, Loader2 } from 'lucide-react'
import { agentsApi, customersApi, documentsApi, transactionsApi } from '../../api/client'

interface Stats {
  activeAgents:   number
  totalCustomers: number
  totalDocs:      number
  revenueKes:     number
}

interface RecentDoc {
  userId:    string
  agentSlug: string
  title:     string
  createdAt: string
}

export default function OverviewPage() {
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [recent,  setRecent]  = useState<RecentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [agents, customers, docs, txns] = await Promise.all([
          agentsApi.list(),
          customersApi.list(),
          documentsApi.listAll(),
          transactionsApi.listAll().catch(() => []),
        ])
        setStats({
          activeAgents:   agents.filter(a => a.isActive).length,
          totalCustomers: customers.length,
          totalDocs:      docs.length,
          revenueKes:     txns
            .filter(t => t.status === 'completed')
            .reduce((s, t) => s + t.amount, 0),
        })
        setRecent(
          [...docs]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 8)
            .map(d => ({ userId: d.userId, agentSlug: d.agentSlug, title: d.title, createdAt: d.createdAt }))
        )
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statCards = stats ? [
    { label: 'Active Agents',        value: stats.activeAgents,                    icon: <Bot size={20} /> },
    { label: 'Registered Users',     value: stats.totalCustomers,                  icon: <Users size={20} /> },
    { label: 'Documents Generated',  value: stats.totalDocs,                       icon: <FileText size={20} /> },
    { label: 'Revenue Collected',    value: `KES ${stats.revenueKes.toLocaleString()}`, icon: <CreditCard size={20} /> },
  ] : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Platform health at a glance</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-2 rounded-lg bg-blue-50 text-blue-600">{s.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent documents */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Recent Documents</h2>
              <span className="text-xs text-gray-400">last {recent.length}</span>
            </div>
            {recent.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">No documents yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map((row, i) => (
                  <div key={i} className="px-6 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-mono shrink-0">
                        {row.userId.slice(-2)}
                      </span>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-800 truncate block">{row.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          row.agentSlug === 'taji' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>{row.agentSlug}</span>
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs whitespace-nowrap ml-4">
                      {new Date(row.createdAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
