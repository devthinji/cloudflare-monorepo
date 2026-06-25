import { useEffect, useState, useRef } from 'react'
import {
  FileText, Upload, Pencil, Trash2, X, Save, Loader2,
  CheckCircle, Clock, AlertCircle, Eye, ToggleLeft, ToggleRight, Plus,
} from 'lucide-react'
import { templatesApi, type Template } from '../../api/client'

const DOC_TYPES = [
  'cv', 'application_letter', 'cover_letter', 'resignation_letter',
  'nda', 'minutes', 'invoice', 'quotation', 'progress_report',
  'revision_notes', 'exam_paper', 'gift_card', 'printable', 'portfolio', 'other',
]

const TIERS    = ['', 'simple', 'advanced', 'pro']
const AGENTS   = ['taji', 'elim']
const CURRENCIES = ['KES', 'USD', 'UGX', 'TZS']

const STATUS_BADGE: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  pending:    { icon: <Clock size={12} />,        className: 'bg-gray-100 text-gray-500',    label: 'Pending' },
  processing: { icon: <Loader2 size={12} className="animate-spin" />, className: 'bg-blue-50 text-blue-600', label: 'Extracting...' },
  done:       { icon: <CheckCircle size={12} />,  className: 'bg-emerald-50 text-emerald-600', label: 'Ready' },
  failed:     { icon: <AlertCircle size={12} />,  className: 'bg-red-50 text-red-500',       label: 'Failed' },
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const [panel,     setPanel]     = useState<'none' | 'upload' | 'edit' | 'view'>('none')
  const [selected,  setSelected]  = useState<Template | null>(null)

  // Upload form state
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    name: '', documentType: 'cv', tier: '', agentSlugs: ['taji'],
    price: 0, currency: 'KES',
  })
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit form state
  const [saving, setSaving]   = useState(false)
  const [editForm, setEditForm] = useState<Partial<Template>>({})

  // Poll for processing templates
  const pollRef = useRef<number | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const data = await templatesApi.list()
      setTemplates(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Poll every 3s if any template is processing
    pollRef.current = window.setInterval(async () => {
      const data = await templatesApi.list().catch(() => [])
      setTemplates(data)
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !uploadForm.name || !uploadForm.documentType) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', uploadForm.name)
      fd.append('documentType', uploadForm.documentType)
      fd.append('tier', uploadForm.tier)
      fd.append('agentSlugs', uploadForm.agentSlugs.join(','))
      fd.append('price', String(uploadForm.price))
      fd.append('currency', uploadForm.currency)
      const res = await templatesApi.upload(fd)
      if (!res.success) throw new Error(res.error ?? 'Upload failed')
      setPanel('none')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(t: Template) {
    setSelected(t)
    setEditForm({
      name:       t.name,
      price:      t.price,
      currency:   t.currency,
      tier:       t.tier,
      agentSlugs: t.agentSlugs,
      isActive:   t.isActive,
    })
    setPanel('edit')
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        agentSlugs: typeof editForm.agentSlugs === 'string'
          ? JSON.parse(editForm.agentSlugs) : editForm.agentSlugs,
      }
      await templatesApi.update(selected.id, payload)
      setPanel('none')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ──────────────────────────────────────────────────────────

  async function handleToggle(t: Template) {
    try {
      await templatesApi.update(t.id, { isActive: !t.isActive })
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(t: Template) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return
    try {
      await templatesApi.delete(t.id)
      await load()
    } catch (e) { setError((e as Error).message) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Upload .docx templates — AI extracts fields automatically</p>
        </div>
        <button
          onClick={() => { setUploadForm({ name: '', documentType: 'cv', tier: '', agentSlugs: ['taji'], price: 0, currency: 'KES' }); setPanel('upload') }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Upload size={16} /> Upload Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex justify-between">
          {error} <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(t => {
            const status = STATUS_BADGE[t.extractionStatus] ?? STATUS_BADGE.pending
            const agents = (() => { try { return JSON.parse(t.agentSlugs) as string[] } catch { return [] } })()
            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-50 shrink-0">
                      <FileText size={20} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                      <span className="text-xs text-gray-400 font-mono">{t.documentType}{t.tier ? ` · ${t.tier}` : ''}</span>
                    </div>
                  </div>
                  <button onClick={() => handleToggle(t)} className={`shrink-0 transition-colors ${t.isActive ? 'text-emerald-500' : 'text-gray-300'}`}>
                    {t.isActive ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>
                </div>

                {t.description && (
                  <p className="text-xs text-gray-500 mt-3 line-clamp-2">{t.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${status.className}`}>
                    {status.icon} {status.label}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">
                    {t.currency} {t.price.toFixed(0)}
                  </span>
                  {agents.map(a => (
                    <span key={a} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{a}</span>
                  ))}
                </div>

                {t.extractionStatus === 'done' && (
                  <p className="text-xs text-gray-400 mt-2">
                    {(() => { try { return JSON.parse(t.fieldSchema).length } catch { return 0 } })()} fields extracted
                  </p>
                )}

                {t.extractionStatus === 'failed' && (
                  <p className="text-xs text-red-400 mt-2 truncate">{t.extractionError}</p>
                )}

                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end gap-3">
                  <button onClick={() => { setSelected(t); setPanel('view') }}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                    <Eye size={12} /> Schema
                  </button>
                  <button onClick={() => handleDelete(t)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium">
                    <Trash2 size={12} /> Delete
                  </button>
                  <button onClick={() => openEdit(t)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Pencil size={12} /> Edit
                  </button>
                </div>
              </div>
            )
          })}

          {templates.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No templates yet. Upload your first .docx to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Upload Panel ─────────────────────────────────────────────────── */}
      {panel === 'upload' && (
        <SlideOver title="Upload Template" onClose={() => setPanel('none')}>
          <Field label="Template Name *">
            <input value={uploadForm.name} onChange={e => setUploadForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Professional CV — Blue" className={inp} />
          </Field>
          <Field label=".docx File *">
            <input ref={fileRef} type="file" accept=".docx" className={inp} />
          </Field>
          <Field label="Document Type *">
            <select value={uploadForm.documentType} onChange={e => setUploadForm(f => ({ ...f, documentType: e.target.value }))} className={inp}>
              {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Tier">
            <select value={uploadForm.tier} onChange={e => setUploadForm(f => ({ ...f, tier: e.target.value }))} className={inp}>
              {TIERS.map(t => <option key={t} value={t}>{t || '— none —'}</option>)}
            </select>
          </Field>
          <Field label="Assign to Agents">
            <div className="flex gap-3">
              {AGENTS.map(a => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={uploadForm.agentSlugs.includes(a)}
                    onChange={e => setUploadForm(f => ({
                      ...f,
                      agentSlugs: e.target.checked
                        ? [...f.agentSlugs, a]
                        : f.agentSlugs.filter(x => x !== a),
                    }))} />
                  {a}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Price (${uploadForm.currency})`}>
              <input type="number" min={0} value={uploadForm.price}
                onChange={e => setUploadForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                className={inp} />
            </Field>
            <Field label="Currency">
              <select value={uploadForm.currency} onChange={e => setUploadForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <SlideOverFooter onClose={() => setPanel('none')} onSave={handleUpload}
            saving={uploading} saveLabel="Upload & Extract" saveIcon={<Upload size={14} />}
            disabled={!uploadForm.name || !fileRef.current?.files?.length} />
        </SlideOver>
      )}

      {/* ── Edit Panel ───────────────────────────────────────────────────── */}
      {panel === 'edit' && selected && (
        <SlideOver title={`Edit — ${selected.name}`} onClose={() => setPanel('none')}>
          <Field label="Name">
            <input value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inp} />
          </Field>
          <Field label="Tier">
            <select value={editForm.tier ?? ''} onChange={e => setEditForm(f => ({ ...f, tier: e.target.value }))} className={inp}>
              {TIERS.map(t => <option key={t} value={t}>{t || '— none —'}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price">
              <input type="number" min={0} value={editForm.price ?? 0}
                onChange={e => setEditForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                className={inp} />
            </Field>
            <Field label="Currency">
              <select value={editForm.currency ?? 'KES'} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Active">
            <button type="button" onClick={() => setEditForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`transition-colors ${editForm.isActive ? 'text-emerald-500' : 'text-gray-300'}`}>
              {editForm.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </Field>
          <SlideOverFooter onClose={() => setPanel('none')} onSave={handleSave} saving={saving} saveLabel="Save Changes" />
        </SlideOver>
      )}

      {/* ── Schema Viewer ────────────────────────────────────────────────── */}
      {panel === 'view' && selected && (
        <SlideOver title={`Schema — ${selected.name}`} onClose={() => setPanel('none')}>
          <p className="text-xs text-gray-500 mb-4">
            AI extracted {(() => { try { return JSON.parse(selected.fieldSchema).length } catch { return 0 } })()} fields from this template.
          </p>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(JSON.parse(selected.fieldSchema || '[]'), null, 2)}
          </pre>
          <button onClick={() => setPanel('none')}
            className="mt-4 w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </SlideOver>
      )}
    </div>
  )
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SlideOver({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white h-full shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>
      </div>
    </div>
  )
}

function SlideOverFooter({
  onClose, onSave, saving, saveLabel = 'Save', saveIcon, disabled = false,
}: {
  onClose: () => void; onSave: () => void; saving: boolean
  saveLabel?: string; saveIcon?: React.ReactNode; disabled?: boolean
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
      <button onClick={onSave} disabled={saving || disabled}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
        {saving ? <Loader2 size={14} className="animate-spin" /> : (saveIcon ?? <Save size={14} />)}
        {saveLabel}
      </button>
    </div>
  )
}
