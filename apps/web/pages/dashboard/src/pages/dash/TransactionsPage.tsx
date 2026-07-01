import { useEffect, useState } from 'react'
import { CreditCard, Search, CheckCircle, XCircle, Clock, Loader2, X, RefreshCw } from 'lucide-react'
import { transactionsApi, type Transaction } from '../../api/client'

const STATUS_CONFIG = {
  completed: { icon: <CheckCircle size={14} />, classes: 'text-emerald-600 bg-emerald-50' },
  pending:   { icon: <Clock size={14} />,        classes: 'text-orange-500 bg-orange-50'  },
  failed:    { icon: <XCircle size={14} />,      classes: 'text-red-500 bg-red-50'        },
}

export default function TransactionsPage() {
  const [txns,    setTxns]   = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [statusFilter, setStatus] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')

  async function load() {
    try {
      setLoading(true); setError(null)
      setTxns(await transactionsApi.listAll())
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = txns.filter(t => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchSearch = !search ||
      (t.phoneNumber ?? '').includes(search) ||
      (t.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      t.userId.includes(search)
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
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl">
            <RefreshCw size={14} /> Refresh
          </button>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 text-right shadow-sm">
            <p className="text-xs text-gray-400">Collected (filtered)</p>
            <p className="text-xl font-bold text-gray-900">KES {totalKes.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">
          {error}<button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search phone, user ID, or description…"
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
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>
      ) : (
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
                const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-gray-800">{t.phoneNumber ?? t.userId}</td>
                    <td className="px-5 py-3.5 text-gray-600 hidden sm:table-cell">{t.description ?? '—'}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">{t.currency} {t.amount}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium capitalize ${cfg.classes}`}>
                        {cfg.icon}{t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-400 hidden md:table-cell">
                      {t.mpesaReceiptNumber ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 hidden lg:table-cell">
                      {new Date(t.createdAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{loading ? '' : txns.length === 0 ? 'No transactions yet' : 'No transactions match your search'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
