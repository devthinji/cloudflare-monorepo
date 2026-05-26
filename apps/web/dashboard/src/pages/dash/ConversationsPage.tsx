import { useState } from 'react'
import { MessageSquare, Search, Filter } from 'lucide-react'

interface Conversation {
  id:        string
  userId:    string
  agentSlug: string
  channel:   string
  status:    'active' | 'closed' | 'archived'
  lastMsg:   string
  updatedAt: string
}

const MOCK: Conversation[] = [
  { id: 'c1', userId: '+254712345678', agentSlug: 'taji', channel: 'whatsapp', status: 'active',   lastMsg: 'Please update the skills section', updatedAt: '2m ago'  },
  { id: 'c2', userId: '+254798765432', agentSlug: 'taji', channel: 'whatsapp', status: 'closed',   lastMsg: 'Thank you! Got the letter.',        updatedAt: '1h ago'  },
  { id: 'c3', userId: '+254700112233', agentSlug: 'elim', channel: 'whatsapp', status: 'active',   lastMsg: 'What topics are in Grade 8 Maths?', updatedAt: '18m ago' },
  { id: 'c4', userId: '+254711223344', agentSlug: 'taji', channel: 'whatsapp', status: 'active',   lastMsg: 'I need a resignation letter',        updatedAt: '34m ago' },
  { id: 'c5', userId: '+254733445566', agentSlug: 'elim', channel: 'whatsapp', status: 'archived', lastMsg: 'Help with Science experiment',       updatedAt: '2d ago'  },
]

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-emerald-50 text-emerald-600',
  closed:   'bg-gray-100 text-gray-500',
  archived: 'bg-orange-50 text-orange-500',
}

export default function ConversationsPage() {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'active' | 'closed' | 'archived'>('all')

  const filtered = MOCK.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter
    const matchSearch = c.userId.includes(search) || c.agentSlug.includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <p className="text-sm text-gray-500 mt-1">{MOCK.length} total conversations</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by user or agent…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'active', 'closed', 'archived'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                filter === s ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Last Message</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-5 py-3.5 font-mono text-gray-800">{c.userId}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    c.agentSlug === 'taji' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>{c.agentSlug}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate hidden md:table-cell">{c.lastMsg}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs hidden sm:table-cell">{c.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No conversations found</p>
          </div>
        )}
      </div>
    </div>
  )
}
