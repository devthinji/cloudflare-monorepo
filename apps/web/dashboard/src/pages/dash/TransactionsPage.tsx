import { useState } from 'react'
import { CreditCard, Search, CheckCircle, XCircle, Clock } from 'lucide-react'

interface Transaction {
  id:                 string
  userId:             string
  agentSlug:          string
  amount:             number
  status:             'pending' | 'completed' | 'failed'
  mpesaReceiptNumber?: string
  phoneNumber:        string
  description:        string
  createdAt:          string
}

const MOCK: Transaction[] = [
  { id: 't1', userId: '+254712345678', agentSlug: 'taji', amount: 150, status: 'completed', mpesaReceiptNumber: 'QGH7YZ1234', phoneNumber: '+254712345678', description: 'CV generation',          createdAt: 'Today, 09:20'  },
  { id: 't2', userId: '+254798765432', agentSlug: 'taji', amount: 100, status: 'completed', mpesaReceiptNumber: 'QGH8AB5678', phoneNumber: '+254798765432', description: 'Application letter',     createdAt: 'Today, 08:35'  },
  { id: 't3', userId: '+254711223344', agentSlug: 'taji', amount: 100, status: 'pending',   phoneNumber: '+254711223344', description: 'Resignation letter', createdAt: '2h ago'          },
  { id: 't4', userId: '+254700112233', agentSlug: 'elim', amount: 50,  status: 'failed',    phoneNumber: '+254700112233', description: 'Elim monthly',        createdAt: 'Yesterday'       },
  { id: 't5', userId: '+254733445566', agentSlug: 'taji', amount: 150, status: 'completed', mpesaReceiptNumber: 'QGH9CD9012', phoneNumber: '+254733445566', description: 'CV generation',  createdAt: '22 May'          },
]

const STATUS_CONFIG = {
  completed: { icon: <CheckCircle size={14} />, classes: 'text-emerald-600 bg-emerald-50' },
  pending:   { icon: <Clock size={14} />,        classes: 'text-orange-500 bg-orange-50'  },
  failed:    { icon: <XCircle size={14} />,      classes: 'text-red-500 bg-red-50'        },
}

export default function TransactionsPage() {
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState<'all' | 'pending' | 'completed' | 'failed'>('all')

  const filtered = MOCK.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchSearch = t.phoneNumber.includes(search) || t.description.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const totalKes = filtered
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">M-Pesa payments via Daraja API</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 text-right shadow-sm">
          <p className="text-xs text-gray-400">Collected (filtered)</p>
          <p className="text-xl font-bold text-gray-900">KES {totalKes.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search phone or description…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'completed', 'pending', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                statusFilter === s ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Description</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Receipt</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(t => {
              const cfg = STATUS_CONFIG[t.status]
              return (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-gray-800">{t.phoneNumber}</td>
                  <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">{t.description}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">KES {t.amount}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium capitalize ${cfg.classes}`}>
                      {cfg.icon}{t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400 hidden md:table-cell">
                    {t.mpesaReceiptNumber ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400 hidden lg:table-cell">{t.createdAt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No transactions found</p>
          </div>
        )}
      </div>
    </div>
  )
}
