import { useEffect, useState, type FormEvent } from 'react'
import { agentsApi } from '@/api/client'
import type { Agent, AgentCreateInput, AgentUpdateInput } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Plus, Loader2 } from 'lucide-react'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', slug: '', description: '', systemPrompt: '', modelProvider: 'openrouter', modelId: '', channel: 'whatsapp',
  })

  function load() {
    setLoading(true)
    agentsApi.list().then(setAgents).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  function resetForm() {
    setForm({ name: '', slug: '', description: '', systemPrompt: '', modelProvider: 'openrouter', modelId: '', channel: 'whatsapp' })
  }

  function openCreate() {
    resetForm()
    setCreating(true)
    setEditingId(null)
  }

  function openEdit(a: Agent) {
    setForm({
      name: a.name, slug: a.slug, description: a.description ?? '', systemPrompt: a.systemPrompt,
      modelProvider: a.modelProvider, modelId: a.modelId, channel: a.channel,
    })
    setEditingId(a.slug)
    setCreating(false)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const data: AgentCreateInput = {
        name: form.name, slug: form.slug, description: form.description || undefined,
        systemPrompt: form.systemPrompt, modelProvider: form.modelProvider, modelId: form.modelId,
        channel: form.channel,
      }
      if (editingId) {
        await agentsApi.update(editingId, data as AgentUpdateInput)
      } else {
        await agentsApi.create(data)
      }
      load()
      setEditingId(null); setCreating(false)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete agent "${slug}"?`)) return
    try {
      await agentsApi.delete(slug)
      load()
    } catch (e: any) { setError(e.message) }
  }

  const inForm = creating || editingId

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
  if (error && agents.length === 0) return <div className="text-red-600 py-12">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground">Create, configure and manage your AI agents</p>
        </div>
        <Button onClick={openCreate} disabled={!!inForm}><Plus className="h-4 w-4 mr-1" /> New Agent</Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {inForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">{editingId ? 'Edit Agent' : 'New Agent'}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Slug</Label>
                  <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required disabled={!!editingId} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>System Prompt</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.systemPrompt}
                  onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <select value={form.modelProvider} onChange={e => setForm(f => ({ ...f, modelProvider: e.target.value }))} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="openrouter">OpenRouter</option>
                    <option value="workers-ai">Workers AI</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Model ID</Label>
                  <Input value={form.modelId} onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>Channel</Label>
                  <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setCreating(false) }}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {agents.length === 0 && !inForm ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No agents configured yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {agents.map(a => (
            <Card key={a.id} className={editingId === a.slug ? 'ring-2 ring-blue-400' : ''}>
              <CardContent className="p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 mt-0.5 text-blue-500" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{a.slug}</Badge>
                      <Badge className={a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>{a.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.modelProvider}/{a.modelId}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(a.slug)}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
