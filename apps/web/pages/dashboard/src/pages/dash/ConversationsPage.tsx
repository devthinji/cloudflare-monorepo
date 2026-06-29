// ─── Conversations & Users Page ───────────────────────────────────────────────
// Two tabs: Users (registered callers) and Messages (conversation threads)

import { useEffect, useState } from 'react'
import { Users, MessageSquare, Loader2, X, Search, RefreshCw, Shield, ShieldOff, ChevronRight, ArrowLeft } from 'lucide-react'
import { usersApi, conversationsApi, type User, type Conversation } from '../../api/client'

type Tab = 'users' | 'conversations'

export default function ConversationsPage() {
  const [tab,     setTab]     = useState<Tab>('users')
  const [users,   setUsers]   = useState<User[]>([])
  const [convos,  setConvos]  = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [detail,  setDetail]  = useState<User | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      if (tab === 'users') {
        setUsers(await usersApi.list())
      } else {
        // conversations across all users — fetch per user
        const allUsers = await usersApi.list()
        const all: Conversation[] = []
        for (const u of allUsers.slice(0, 30)) {
          try { all.push(...await conversationsApi.list(u.id)) } catch {}
        }
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        setConvos(all)
      }
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab])

  async function toggleBlock(user: User) {
    try {
      await usersApi.patch(user.id, { blocked: !user.blocked })
      setUsers(u => u.map(x => x.id === user.id ? { ...x, blocked: !x.blocked } : x))
      if (detail?.id === user.id) setDetail(d => d ? { ...d, blocked: !d.blocked } : d)
    } catch (e) { setError((e as Error).message) }
  }

  const filteredUsers = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.id.includes(search) || (u.phone ?? '').includes(search)
  )

  const filteredConvos = convos.filter(c =>
    !search || c.userId.includes(search) || c.agentSlug.includes(search)
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users & Conversations</h1>
          <p className="text-sm text-gray-500 mt-1">Everyone who has messaged your agents</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">{error}<button onClick={() => setError(null)}><X size={14}/></button></div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['users', 'conversations'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'users' ? <span className="flex items-center gap-1.5"><Users size={14}/> Users</span>
                           : <span className="flex items-center gap-1.5"><MessageSquare size={14}/> Conversations</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'users' ? 'Search by name, number, or ID...' : 'Search by user ID or agent...'}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300"/></div>
      ) : tab === 'users' ? (

        // ── Users table ──────────────────────────────────────────────────────
        detail ? (
          <UserDetail user={detail} onBack={() => setDetail(null)} onToggleBlock={() => toggleBlock(detail)}/>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-25"/>
                <p className="text-sm">{search ? 'No users match your search' : 'No users yet'}</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['User', 'Channel', 'Agent', 'Registered', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setDetail(u)}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{u.phone ?? u.id}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{u.channel}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{u.agentSlug ?? '—'}</td>
                        <td className="px-4 py-3">
                          {u.registered
                            ? <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Yes</span>
                            : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">No</span>}
                        </td>
                        <td className="px-4 py-3">
                          {u.blocked
                            ? <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">Blocked</span>
                            : <span className="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">Active</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-300"><ChevronRight size={14}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
        )

      ) : (

        // ── Conversations list ───────────────────────────────────────────────
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {filteredConvos.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-25"/>
              <p className="text-sm">{search ? 'No conversations match' : 'No conversations yet'}</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['User', 'Agent', 'Channel', 'Status', 'Last Active'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredConvos.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.userId}</td>
                      <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c.agentSlug}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{c.channel}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(c.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                {filteredConvos.length} conversation{filteredConvos.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── User Detail Panel ─────────────────────────────────────────────────────────

function UserDetail({ user, onBack, onToggleBlock }: { user: User; onBack: () => void; onToggleBlock: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
          <p className="text-xs text-gray-400 font-mono">{user.phone ?? user.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: 'Channel',     value: user.channel },
          { label: 'Agent',       value: user.agentSlug ?? '—' },
          { label: 'Registered',  value: user.registered ? 'Yes' : 'No' },
          { label: 'Status',      value: user.blocked ? 'Blocked' : 'Active' },
          { label: 'Joined',      value: new Date(user.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Last seen',   value: new Date(user.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
        ].map(row => (
          <div key={row.label} className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{row.label}</p>
            <p className="font-medium text-gray-800">{row.value}</p>
          </div>
        ))}
      </div>

      {user.metadata && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Metadata</p>
          <pre className="text-xs bg-gray-50 rounded-xl p-3 overflow-x-auto text-gray-600">{JSON.stringify(user.metadata, null, 2)}</pre>
        </div>
      )}

      <button onClick={onToggleBlock}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${user.blocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
        {user.blocked ? <><Shield size={14}/> Unblock User</> : <><ShieldOff size={14}/> Block User</>}
      </button>
    </div>
  )
}
