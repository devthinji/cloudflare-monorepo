import { useEffect, useState } from 'react'
import { Users, MessageSquare, Loader2, X, Search, RefreshCw, Shield, ShieldOff, ChevronRight, ArrowLeft, Cpu, RotateCcw } from 'lucide-react'
import { customersApi, conversationsApi, messagesApi, machineApi, type Customer, type Conversation, type Message, type MachineContextData } from '../../api/client'

type Tab = 'users' | 'conversations'

export default function ConversationsPage() {
  const [tab,          setTab]          = useState<Tab>('users')
  const [customers,    setCustomers]    = useState<Customer[]>([])
  const [convos,       setConvos]       = useState<Conversation[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [detail,       setDetail]       = useState<Customer | null>(null)
  const [selectedConvo, setSelectedConvo] = useState<{ convo: Conversation; messages: Message[]; loadingMessages: boolean } | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      if (tab === 'users') {
        setCustomers(await customersApi.list())
      } else {
        const allCustomers = await customersApi.list()
        const all: Conversation[] = []
        for (const u of allCustomers.slice(0, 30)) {
          try { all.push(...await conversationsApi.list(u.id)) } catch {}
        }
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        setConvos(all)
      }
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab])

  async function toggleBlock(customer: Customer) {
    try {
      await customersApi.patch(customer.id, { blocked: !customer.blocked })
      setCustomers(c => c.map(x => x.id === customer.id ? { ...x, blocked: !x.blocked } : x))
      if (detail?.id === customer.id) setDetail(d => d ? { ...d, blocked: !d.blocked } : d)
    } catch (e) { setError((e as Error).message) }
  }

  async function openMessageThread(convo: Conversation) {
    setSelectedConvo({ convo, messages: [], loadingMessages: true })
    try {
      const messages = await messagesApi.list(convo.id)
      setSelectedConvo(prev => prev ? { ...prev, messages, loadingMessages: false } : null)
    } catch (e) {
      setError((e as Error).message)
      setSelectedConvo(prev => prev ? { ...prev, loadingMessages: false } : null)
    }
  }

  const filteredCustomers = customers.filter(u =>
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
          <button key={t} onClick={() => { setTab(t); setSelectedConvo(null) }}
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
          <CustomerDetail customer={detail} onBack={() => setDetail(null)} onToggleBlock={() => toggleBlock(detail)}/>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Users size={40} className="mx-auto mb-3 opacity-25"/>
                <p className="text-sm">{search ? 'No customers match your search' : 'No customers yet'}</p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Customer', 'Channel', 'Agent', 'Registered', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCustomers.map(u => (
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
                  {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
        )

      ) : selectedConvo ? (

        // ── Message thread panel ─────────────────────────────────────────────
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <button onClick={() => setSelectedConvo(null)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">Conversation</p>
              <p className="text-xs text-gray-400 font-mono truncate">{selectedConvo.convo.userId} · {selectedConvo.convo.agentSlug}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedConvo.convo.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              {selectedConvo.convo.status}
            </span>
          </div>

          <div className="px-4 py-3 space-y-2 max-h-[500px] overflow-y-auto" style={{ minHeight: 200 }}>
            {selectedConvo.loadingMessages ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-300"/></div>
            ) : selectedConvo.messages.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">No messages in this conversation</p>
            ) : (
              selectedConvo.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap shadow-sm ${msg.role === 'user' ? 'bg-indigo-50 text-gray-900 rounded-br-sm' : 'bg-gray-50 text-gray-900 rounded-bl-sm'}`}>
                    <p className="text-xs font-semibold text-gray-400 mb-0.5">{msg.role === 'user' ? 'User' : 'Agent'}</p>
                    <p>{msg.content}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{new Date(msg.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            {selectedConvo.messages.length} message{selectedConvo.messages.length !== 1 ? 's' : ''}
          </div>
        </div>

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
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openMessageThread(c)}>
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

// ── Customer Detail Panel ─────────────────────────────────────────────────────

function CustomerDetail({ customer, onBack, onToggleBlock }: { customer: Customer; onBack: () => void; onToggleBlock: () => void }) {
  const [machineCtx, setMachineCtx] = useState<MachineContextData | null>(null)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [resetting,  setResetting]  = useState(false)

  async function loadMachineContext() {
    if (!customer.agentSlug) return
    setLoadingCtx(true)
    try {
      const ctx = await machineApi.getContext(customer.id, customer.agentSlug)
      setMachineCtx(ctx)
    } catch {
      setMachineCtx(null)
    } finally {
      setLoadingCtx(false)
    }
  }

  async function handleReset() {
    if (!customer.agentSlug) return
    setResetting(true)
    try {
      await machineApi.reset(customer.id, customer.agentSlug)
      setMachineCtx(null)
    } catch (e) {
      // ignore
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></button>
        <div>
          <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
          <p className="text-xs text-gray-400 font-mono">{customer.phone ?? customer.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: 'Channel',     value: customer.channel },
          { label: 'Agent',       value: customer.agentSlug ?? '—' },
          { label: 'Registered',  value: customer.registered ? 'Yes' : 'No' },
          { label: 'Status',      value: customer.blocked ? 'Blocked' : 'Active' },
          { label: 'Joined',      value: new Date(customer.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Last seen',   value: new Date(customer.updatedAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
        ].map(row => (
          <div key={row.label} className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{row.label}</p>
            <p className="font-medium text-gray-800">{row.value}</p>
          </div>
        ))}
      </div>

      {/* Machine Context */}
      {customer.agentSlug && (
        <div className="border border-gray-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-indigo-500"/>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Machine State</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadMachineContext} disabled={loadingCtx}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-40">
                {loadingCtx ? 'Loading...' : 'Refresh'}
              </button>
              {machineCtx && (
                <button onClick={handleReset} disabled={resetting}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40">
                  <RotateCcw size={12}/> {resetting ? 'Resetting...' : 'Reset'}
                </button>
              )}
            </div>
          </div>

          {machineCtx ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">Stage:</span>
                <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{machineCtx.stage}</span>
                {machineCtx.collectSub && (
                  <span className="font-mono bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">{machineCtx.collectSub}</span>
                )}
              </div>
              {machineCtx.liveSKU && (
                <p className="text-gray-500">SKU: {machineCtx.liveSKU.name} ({machineCtx.liveSKU.currency} {machineCtx.liveSKU.price})</p>
              )}
              {machineCtx.collectedFields && Object.keys(machineCtx.collectedFields).length > 0 && (
                <div>
                  <p className="text-gray-400 mb-1">Collected fields:</p>
                  <pre className="bg-gray-50 rounded-lg p-2 text-[10px] text-gray-600 overflow-x-auto">{JSON.stringify(machineCtx.collectedFields, null, 1)}</pre>
                </div>
              )}
              {machineCtx.sessionCount !== undefined && (
                <p className="text-gray-400">Session count: {machineCtx.sessionCount}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">
              {customer.agentSlug ? 'Click Refresh to load machine state' : 'No agent assigned'}
            </p>
          )}
        </div>
      )}

      {customer.metadata && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Metadata</p>
          <pre className="text-xs bg-gray-50 rounded-xl p-3 overflow-x-auto text-gray-600">{JSON.stringify(customer.metadata, null, 2)}</pre>
        </div>
      )}

      <button onClick={onToggleBlock}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${customer.blocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
        {customer.blocked ? <><Shield size={14}/> Unblock Customer</> : <><ShieldOff size={14}/> Block Customer</>}
      </button>
    </div>
  )
}
