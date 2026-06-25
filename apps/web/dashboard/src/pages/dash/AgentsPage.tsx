import { useEffect, useState } from 'react'
import { Bot, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Save, Loader2 } from 'lucide-react'
import { agentsApi, type Agent, type AgentCreateInput } from '../../api/client'

// ── Model options ─────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { provider: 'groq',          id: 'llama-3.3-70b-versatile' },
  { provider: 'groq',          id: 'mixtral-8x7b-32768' },
  { provider: 'cloudflare-ai', id: '@cf/meta/llama-3.1-8b-instruct' },
  { provider: 'openai',        id: 'gpt-4o-mini' },
]

const CHANNELS = ['whatsapp', 'telegram', 'sms', 'ussd', 'dashboard']

const EMPTY_FORM: AgentCreateInput = {
  name:          '',
  slug:          '',
  description:   '',
  systemPrompt:  '',
  modelProvider: 'groq',
  modelId:       'llama-3.3-70b-versatile',
  channel:       'whatsapp',
  isActive:      true,
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents,  setAgents]  = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const [panel,   setPanel]   = useState<'none' | 'create' | 'edit'>('none')
  const [editing, setEditing] = useState<Agent | null>(null)
  const [form,    setForm]    = useState<AgentCreateInput>(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Load agents ─────────────────────────────────────────────────────────────

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const data = await agentsApi.list()
      setAgents(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── Open edit panel ──────────────────────────────────────────────────────────

  function openEdit(agent: Agent) {
    setEditing(agent)
    setForm({
      name:          agent.name,
      slug:          agent.slug,
      description:   agent.description ?? '',
      systemPrompt:  agent.systemPrompt,
      modelProvider: agent.modelProvider,
      modelId:       agent.modelId,
      channel:       agent.channel,
      isActive:      agent.isActive ?? true,
    })
    setPanel('edit')
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPanel('create')
  }

  function closePanel() {
    setPanel('none')
    setEditing(null)
  }

  // ── Auto-slug from name ──────────────────────────────────────────────────────

  function handleNameChange(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(f => ({ ...f, name, ...(panel === 'create' ? { slug } : {}) }))
  }

  // ── Save (create or update) ──────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name || !form.slug || !form.systemPrompt) return
    try {
      setSaving(true)
      if (panel === 'create') {
        await agentsApi.create(form)
      } else if (editing) {
        await agentsApi.update(editing.slug, form)
      }
      closePanel()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────

  async function handleToggle(agent: Agent) {
    try {
      await agentsApi.update(agent.slug, { isActive: !agent.isActive })
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  // The API doesn't expose DELETE yet — we deactivate instead

  async function handleDelete(agent: Agent) {
    try {
      await agentsApi.update(agent.slug, { isActive: false })
      setDeleteId(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const agentColor = (slug: string) =>
    slug === 'taji' ? 'blue' : slug === 'elim' ? 'purple' : 'gray'

  const colorMap: Record<string, { bg: string; text: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
    gray:   { bg: 'bg-gray-100',  text: 'text-gray-500' },
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">Create, configure and manage your AI agents</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> New Agent
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between">
          {error}
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {/* Agent cards */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map(agent => {
            const c = colorMap[agentColor(agent.slug)]
            return (
              <div key={agent.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${c.bg}`}>
                      <Bot size={20} className={c.text} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                      <span className="text-xs text-gray-400 font-mono">/{agent.slug}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(agent)}
                    className={`transition-colors ${agent.isActive ? 'text-emerald-500' : 'text-gray-300'}`}
                    title={agent.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {agent.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                {agent.description && (
                  <p className="text-sm text-gray-500 mt-3 line-clamp-2">{agent.description}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-mono">{agent.modelId}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{agent.channel}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    agent.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {agent.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteId(agent.id)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                  >
                    <Trash2 size={12} /> Deactivate
                  </button>
                  <button
                    onClick={() => openEdit(agent)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              </div>
            )
          })}

          {agents.length === 0 && (
            <div className="col-span-2 text-center py-16 text-gray-400">
              <Bot size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No agents yet. Create your first one.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirm deactivate dialog */}
      {deleteId && (() => {
        const agent = agents.find(a => a.id === deleteId)!
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-gray-900 mb-2">Deactivate {agent.name}?</h3>
              <p className="text-sm text-gray-500 mb-6">
                This will stop the agent from responding to messages. You can reactivate it at any time.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(agent)}
                  className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                >
                  Deactivate
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Create / Edit slide-over panel */}
      {panel !== 'none' && (
        <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={closePanel}>
          <div
            className="w-full max-w-lg bg-white h-full shadow-xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {panel === 'create' ? 'New Agent' : `Edit — ${editing?.name}`}
              </h2>
              <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Panel form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              <Field label="Name *">
                <input
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Taji"
                  className={input}
                />
              </Field>

              <Field label="Slug *">
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="e.g. taji"
                  className={`${input} font-mono`}
                  disabled={panel === 'edit'}
                />
                {panel === 'edit' && (
                  <p className="text-xs text-gray-400 mt-1">Slug cannot be changed after creation.</p>
                )}
              </Field>

              <Field label="Description">
                <input
                  value={form.description ?? ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of what this agent does"
                  className={input}
                />
              </Field>

              <Field label="Model">
                <select
                  value={`${form.modelProvider}|${form.modelId}`}
                  onChange={e => {
                    const [modelProvider, modelId] = e.target.value.split('|')
                    setForm(f => ({ ...f, modelProvider, modelId }))
                  }}
                  className={input}
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={`${m.provider}|${m.id}`} value={`${m.provider}|${m.id}`}>
                      {m.provider} — {m.id}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Channel">
                <select
                  value={form.channel}
                  onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                  className={input}
                >
                  {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                </select>
              </Field>

              <Field label="System Prompt *">
                <textarea
                  value={form.systemPrompt}
                  onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder="You are [name], a..."
                  rows={12}
                  className={`${input} resize-y font-mono text-xs`}
                />
              </Field>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Active</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className={`transition-colors ${form.isActive ? 'text-emerald-500' : 'text-gray-300'}`}
                >
                  {form.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

            </div>

            {/* Panel footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={closePanel}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.slug || !form.systemPrompt}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {panel === 'create' ? 'Create Agent' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
