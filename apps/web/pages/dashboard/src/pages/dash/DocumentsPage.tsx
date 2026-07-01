import { useEffect, useState } from 'react'
import { FileText, Download, Loader2, X, Search, RefreshCw } from 'lucide-react'
import { documentsApi, agentsApi, BASE_URL, type Document, type Agent } from '../../api/client'

export default function DocumentsPage() {
  const [docs,      setDocs]      = useState<Document[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [agentSlug, setAgentSlug] = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [agents,    setAgents]    = useState<Agent[]>([])

  async function load() {
    try {
      setLoading(true); setError(null)
      const [data, agentsData] = await Promise.all([documentsApi.listAll(), agentsApi.list()])
      setDocs(data)
      setAgents(agentsData)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = docs.filter(d => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.userId.includes(search)) return false
    if (agentSlug && d.agentSlug !== agentSlug) return false
    if (dateFrom && new Date(d.createdAt) < new Date(dateFrom)) return false
    if (dateTo && new Date(d.createdAt) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">All generated documents across all users</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">
          {error}<button onClick={() => setError(null)}><X size={14}/></button>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title or user ID..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
        </div>
        <select value={agentSlug} onChange={e => setAgentSlug(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
          <option value="">All agents</option>
          {agents.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300"/></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={44} className="mx-auto mb-4 opacity-25"/>
          <p className="text-sm font-medium">{search || agentSlug || dateFrom || dateTo ? 'No documents match your filters' : 'No documents generated yet'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Document', 'User', 'Agent', 'Type', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg shrink-0">
                        <FileText size={14} className="text-indigo-600"/>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{doc.title}</p>
                        <p className="text-xs text-gray-400 font-mono">{doc.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{doc.userId}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{doc.agentSlug || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{doc.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(doc.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    {doc.fileUrl ? (
                      <a href={`${BASE_URL}/api/v1/docgen/download?key=${encodeURIComponent(doc.fileUrl)}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">
                        <Download size={12}/> Download
                      </a>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
            {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
