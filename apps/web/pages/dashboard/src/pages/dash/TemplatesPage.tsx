// ─── SKU Studio — 4-screen flow ───────────────────────────────────────────────
// Screen 1: Library  — list all SKUs
// Screen 2: Upload   — drag & drop file, pick type/agent/price
// Screen 3: Review   — edit extracted fields (reorder, rename, validate)
// Screen 4: Preview  — simulated WhatsApp conversation thread

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Upload, FileText, ChevronRight, ChevronLeft, Eye, Trash2,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle, Loader2,
  GripVertical, Plus, X, ArrowUp, ArrowDown, MessageSquare,
  Pencil, BookOpen, Zap,
} from 'lucide-react'
import { skusApi, agentsApi, type SKU, type SKUField, type SKUUploadResult, type Agent } from '../../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'library' | 'upload' | 'review' | 'preview'

const FIELD_TYPES = ['text','textarea','number','phone','email','date','choice','image_url']
const AGENTS      = ['taji', 'elim']
const CURRENCIES  = ['KES', 'USD', 'UGX', 'TZS']
const DOC_TYPES   = ['cv','application_letter','cover_letter','resignation_letter','nda','invoice','quotation','progress_report','exam_paper','minutes','gift_card','other']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(sku: SKU) {
  if (!sku.isActive && sku.requiresReview) return { label: 'Needs Review', color: 'bg-amber-50 text-amber-600', icon: <AlertCircle size={11}/> }
  if (!sku.isActive)                       return { label: 'Draft',        color: 'bg-gray-100 text-gray-500',  icon: <BookOpen size={11}/> }
  return                                          { label: 'Live',         color: 'bg-emerald-50 text-emerald-600', icon: <CheckCircle size={11}/> }
}

// ─── SKU Studio ───────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [screen,  setScreen]  = useState<Screen>('library')
  const [skus,    setSKUs]    = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Upload state
  const [file,         setFile]         = useState<File | null>(null)
  const [uploadForm,   setUploadForm]   = useState({ name: '', agentSlug: 'taji', documentType: 'cv', price: 200, currency: 'KES' })
  const [uploading,    setUploading]    = useState(false)
  const [uploadResult, setUploadResult] = useState<SKUUploadResult | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Review state — editing a draft SKU
  const [editSKU,    setEditSKU]    = useState<SKU | null>(null)
  const [fields,     setFields]     = useState<SKUField[]>([])
  const [saving,     setSaving]     = useState(false)
  const [agents,     setAgents]     = useState<Agent[]>([])
  const [agentAccessMap, setAgentAccessMap] = useState<Record<string, boolean>>({})

  // Preview state
  const [previewSKU, setPreviewSKU] = useState<SKU | null>(null)
  const [chatThread, setChatThread] = useState<{ role: 'bot' | 'user'; text: string }[]>([])
  const [chatInput,  setChatInput]  = useState('')
  const chatFieldIdx = useRef(0)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try { setLoading(true); setSKUs(await skusApi.list()) }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); if (!uploadForm.name) setUploadForm(p => ({ ...p, name: f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ') })) }
  }

  async function handleUpload() {
    if (!file || !uploadForm.name) return
    setUploading(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', uploadForm.name)
      fd.append('agentSlug', uploadForm.agentSlug)
      fd.append('documentType', uploadForm.documentType)
      fd.append('price', String(uploadForm.price))
      fd.append('currency', uploadForm.currency)

      const res = await skusApi.upload(fd)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Upload failed')

      setUploadResult(res.data)
      // Load extracted fields into review screen
      const full = await skusApi.get(res.data.id)
      setEditSKU(full)
      setFields([...full.fieldSchema].sort((a, b) => a.order - b.order))
      const agentsList = await agentsApi.list()
      setAgents(agentsList)
      setAgentAccessMap(Object.fromEntries(agentsList.map(a => [a.slug, true])))
      setScreen('review')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // ── Review / Field Editor ───────────────────────────────────────────────────

  function moveField(idx: number, dir: -1 | 1) {
    const next = [...fields]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target]!, next[idx]!]
    setFields(next.map((f, i) => ({ ...f, order: i + 1 })))
  }

  function updateField(idx: number, patch: Partial<SKUField>) {
    setFields(f => f.map((field, i) => i === idx ? { ...field, ...patch } : field))
  }

  function addField() {
    setFields(f => [...f, { key: `field_${f.length + 1}`, label: 'New Field', type: 'text', required: true, order: f.length + 1 }])
  }

  function removeField(idx: number) {
    setFields(f => f.filter((_, i) => i !== idx).map((field, i) => ({ ...field, order: i + 1 })))
  }

  async function saveFields(publish: boolean) {
    if (!editSKU) return
    setSaving(true)
    try {
      await skusApi.update(editSKU.id, {
        fieldSchema: fields,
        isActive: publish,
        agentAccess: agents.map(a => ({ agentSlug: a.slug, enabled: agentAccessMap[a.slug] ?? false })),
      })
      await load()
      if (publish) { setScreen('library') }
      else { setError(null) }
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  // ── Preview / Simulated Chat ────────────────────────────────────────────────

  function openPreview(sku: SKU) {
    setPreviewSKU(sku)
    chatFieldIdx.current = 0
    const sorted = [...sku.fieldSchema].sort((a, b) => a.order - b.order)
    const first  = sorted[0]
    setChatThread([
      { role: 'bot', text: `Hi! Let me help you create your *${sku.name}* (${sku.currency} ${sku.price}).` },
      { role: 'bot', text: first ? fieldPrompt(first, 0, sorted.length) : 'All fields collected!' },
    ])
    setChatInput('')
    setScreen('preview')
  }

  function fieldPrompt(f: SKUField, idx: number, total: number): string {
    let msg = `(${idx + 1}/${total}) *${f.label}*`
    if (f.hint) msg += `\n_e.g. ${f.hint}_`
    if (f.type === 'choice' && f.choices) msg += '\n\n' + f.choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')
    if (!f.required) msg += '\n_(optional)_'
    return msg
  }

  function sendPreviewMessage() {
    if (!previewSKU || !chatInput.trim()) return
    const sorted = [...previewSKU.fieldSchema].sort((a, b) => a.order - b.order)
    const next   = chatFieldIdx.current + 1
    chatFieldIdx.current = next

    const newThread = [...chatThread, { role: 'user' as const, text: chatInput }]
    if (next < sorted.length) {
      newThread.push({ role: 'bot', text: fieldPrompt(sorted[next]!, next, sorted.length) })
    } else {
      newThread.push({ role: 'bot', text: `✅ All done! Here's a summary...\n\nPayment: *${previewSKU.currency} ${previewSKU.price}* via M-Pesa\n\nType *Yes* to confirm and pay.` })
    }
    setChatThread(newThread)
    setChatInput('')
  }

  // ── Toggle live ─────────────────────────────────────────────────────────────

  async function toggleActive(sku: SKU) {
    try {
      sku.isActive ? await skusApi.unpublish(sku.id) : await skusApi.publish(sku.id)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  async function deleteSKU(sku: SKU) {
    if (!confirm(`Delete "${sku.name}"? This cannot be undone.`)) return
    try { await skusApi.delete(sku.id); await load() }
    catch (e) { setError((e as Error).message) }
  }

  // ── Screen: Library ─────────────────────────────────────────────────────────

  if (screen === 'library') return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SKU Studio</h1>
          <p className="text-sm text-gray-500 mt-1">Upload templates — AI extracts fields — agents sell them</p>
        </div>
        <button onClick={() => { setFile(null); setUploadForm({ name: '', agentSlug: 'taji', documentType: 'cv', price: 200, currency: 'KES' }); setScreen('upload') }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Upload size={15}/> Upload Template
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">{error}<button onClick={() => setError(null)}><X size={14}/></button></div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300"/></div>
      ) : skus.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText size={44} className="mx-auto mb-4 opacity-25"/>
          <p className="text-sm font-medium">No templates yet</p>
          <p className="text-xs mt-1">Upload a .docx, PDF, or image to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {skus.map(sku => {
            const badge = statusBadge(sku)
            return (
              <div key={sku.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-indigo-50 rounded-xl shrink-0"><FileText size={18} className="text-indigo-600"/></div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm">{sku.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{sku.templateType} · v{sku.version}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleActive(sku)} className={`shrink-0 ${sku.isActive ? 'text-emerald-500' : 'text-gray-300'}`}>
                    {sku.isActive ? <ToggleRight size={26}/> : <ToggleLeft size={26}/>}
                  </button>
                </div>

                {sku.description && <p className="text-xs text-gray-500 line-clamp-2">{sku.description}</p>}

                <div className="flex flex-wrap gap-1.5">
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.icon}{badge.label}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{sku.currency} {sku.price}</span>
                  <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{sku.fieldSchema.length} fields</span>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-50">
                  <button onClick={() => openPreview(sku)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 font-medium"><MessageSquare size={12}/> Preview</button>
                  <button onClick={() => deleteSKU(sku)}   className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium"><Trash2 size={12}/> Delete</button>
                  <button onClick={async () => {
                    setEditSKU(sku); setFields([...sku.fieldSchema].sort((a,b) => a.order - b.order))
                    const agentsList = await agentsApi.list()
                    setAgents(agentsList)
                    setAgentAccessMap(Object.fromEntries(agentsList.map(a => [a.slug, true])))
                    setScreen('review')
                  }} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"><Pencil size={12}/> Edit</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Screen: Upload ───────────────────────────────────────────────────────────

  if (screen === 'upload') return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setScreen('library')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={20}/></button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Upload Template</h1>
          <p className="text-xs text-gray-500">Supported: .docx, .pdf, .png, .jpg</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">{error}<button onClick={() => setError(null)}><X size={14}/></button></div>}

      {/* Drop zone */}
      <div ref={dropRef} onDragOver={e => e.preventDefault()} onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${file ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}>
        <input ref={fileRef} type="file" accept=".docx,.pdf,.png,.jpg,.jpeg" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!uploadForm.name) setUploadForm(p => ({ ...p, name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') })) }}}/>
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText size={28} className="text-indigo-600"/>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button onClick={e => { e.stopPropagation(); setFile(null) }} className="text-gray-300 hover:text-red-400"><X size={16}/></button>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto mb-3 text-gray-300"/>
            <p className="text-sm font-medium text-gray-600">Drop your template here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">.docx with {'{placeholders}'} · PDF · PNG / JPG</p>
          </>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <Field label="Template Name">
          <input value={uploadForm.name} onChange={e => setUploadForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Professional CV" className={input()}/>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Agent">
            <select value={uploadForm.agentSlug} onChange={e => setUploadForm(p => ({ ...p, agentSlug: e.target.value }))} className={input()}>
              {AGENTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Document Type">
            <select value={uploadForm.documentType} onChange={e => setUploadForm(p => ({ ...p, documentType: e.target.value }))} className={input()}>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Price">
            <input type="number" value={uploadForm.price} onChange={e => setUploadForm(p => ({ ...p, price: +e.target.value }))} className={input()}/>
          </Field>
          <Field label="Currency">
            <select value={uploadForm.currency} onChange={e => setUploadForm(p => ({ ...p, currency: e.target.value }))} className={input()}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <button onClick={handleUpload} disabled={!file || !uploadForm.name || uploading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
        {uploading ? <><Loader2 size={16} className="animate-spin"/> Extracting fields...</> : <><Zap size={16}/> Extract Fields</>}
      </button>
    </div>
  )

  // ── Screen: Review ───────────────────────────────────────────────────────────

  if (screen === 'review' && editSKU) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen('library')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={20}/></button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review Fields</h1>
            <p className="text-xs text-gray-500">{editSKU.name} · {fields.length} fields extracted</p>
          </div>
        </div>
        <button onClick={() => openPreview({ ...editSKU, fieldSchema: fields })}
          className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:underline">
          <Eye size={14}/> Preview
        </button>
      </div>

      {uploadResult?.requiresReview && (
        <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-4 py-3 rounded-xl">
          <AlertCircle size={14} className="shrink-0 mt-0.5"/>
          <span>AI-extracted from image — please review all fields before publishing.</span>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex justify-between">{error}<button onClick={() => setError(null)}><X size={14}/></button></div>}

      {/* Field list */}
      <div className="space-y-3">
        {fields.map((field, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20"><ArrowUp size={13}/></button>
                <button onClick={() => moveField(idx, 1)}  disabled={idx === fields.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20"><ArrowDown size={13}/></button>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono shrink-0">{field.order}</span>
              <input value={field.key} onChange={e => updateField(idx, { key: e.target.value })}
                className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg flex-1 min-w-0 border-0 focus:ring-1 focus:ring-indigo-300"/>
              <button onClick={() => removeField(idx)} className="text-gray-300 hover:text-red-400 shrink-0"><X size={14}/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Label / Question">
                <input value={field.label} onChange={e => updateField(idx, { label: e.target.value })} className={input()} placeholder="What is your full name?"/>
              </Field>
              <Field label="Type">
                <select value={field.type} onChange={e => updateField(idx, { type: e.target.value as SKUField['type'] })} className={input()}>
                  {FIELD_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Hint (example)">
                <input value={field.hint ?? ''} onChange={e => updateField(idx, { hint: e.target.value })} className={input()} placeholder="e.g. John Kamau"/>
              </Field>
              <Field label="">
                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })} className="rounded"/>
                  <span className="text-sm text-gray-700">Required</span>
                </label>
              </Field>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addField}
        className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-indigo-400 text-gray-500 hover:text-indigo-600 py-3 rounded-xl text-sm transition-colors">
        <Plus size={15}/> Add Field
      </button>

      {/* Agent Access */}
      {agents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Agent Access</p>
          <p className="text-xs text-gray-400">Control which agents can offer this SKU</p>
          <div className="flex flex-wrap gap-3 pt-1">
            {agents.map(a => (
              <label key={a.slug} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={agentAccessMap[a.slug] ?? false}
                  onChange={e => setAgentAccessMap(m => ({ ...m, [a.slug]: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-300"/>
                <span className="text-sm text-gray-700">{a.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => saveFields(false)} disabled={saving}
          className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl text-sm transition-colors">
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button onClick={() => saveFields(true)} disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          {saving ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle size={15}/>}
          Publish & Go Live
        </button>
      </div>
    </div>
  )

  // ── Screen: Preview ──────────────────────────────────────────────────────────

  if (screen === 'preview' && previewSKU) return (
    <div className="max-w-sm mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setScreen(editSKU ? 'review' : 'library')} className="text-gray-400 hover:text-gray-600"><ChevronLeft size={20}/></button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Preview</h1>
          <p className="text-xs text-gray-500">How it looks on WhatsApp</p>
        </div>
      </div>

      {/* Phone frame */}
      <div className="bg-[#e5ddd5] rounded-2xl overflow-hidden shadow-lg" style={{ height: 560 }}>
        {/* Header bar */}
        <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">T</div>
          <div>
            <p className="text-sm font-semibold">Taji</p>
            <p className="text-xs opacity-70">online</p>
          </div>
        </div>

        {/* Chat thread */}
        <div className="overflow-y-auto p-3 space-y-2" style={{ height: 460 }}>
          {chatThread.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-line shadow-sm ${msg.role === 'user' ? 'bg-[#dcf8c6] text-gray-900 rounded-br-none' : 'bg-white text-gray-900 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="bg-white px-3 py-2 flex gap-2">
          <input value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendPreviewMessage()}
            placeholder="Type a message..." className="flex-1 text-sm px-3 py-1.5 bg-gray-100 rounded-full outline-none"/>
          <button onClick={sendPreviewMessage} className="bg-[#075e54] text-white w-8 h-8 rounded-full flex items-center justify-center">
            <ChevronRight size={16}/>
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400">Type answers to walk through the full conversation</p>
    </div>
  )

  return null
}

// ─── Micro components ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-medium text-gray-500">{label}</label>}
      {children}
    </div>
  )
}

function input() {
  return 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white'
}
