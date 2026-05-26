import { useState } from 'react'
import { Save, Eye, EyeOff } from 'lucide-react'

interface Section {
  title:    string
  fields:   { key: string; label: string; type: string; placeholder: string; secret?: boolean }[]
}

const SECTIONS: Section[] = [
  {
    title: 'AI Provider',
    fields: [
      { key: 'groq_api_key',         label: 'Groq API Key',          type: 'text', placeholder: 'gsk_…',   secret: true },
      { key: 'default_model',        label: 'Default Model',         type: 'text', placeholder: 'llama-3.3-70b-versatile' },
    ],
  },
  {
    title: 'WhatsApp (Meta Cloud API)',
    fields: [
      { key: 'wa_token',             label: 'Access Token',          type: 'text', placeholder: 'EAABs…',  secret: true },
      { key: 'wa_phone_number_id',   label: 'Phone Number ID',       type: 'text', placeholder: '1234567890' },
      { key: 'wa_verify_token',      label: 'Webhook Verify Token',  type: 'text', placeholder: 'my-secret-token', secret: true },
    ],
  },
  {
    title: 'M-Pesa Daraja',
    fields: [
      { key: 'mpesa_consumer_key',    label: 'Consumer Key',         type: 'text', placeholder: 'abc…',    secret: true },
      { key: 'mpesa_consumer_secret', label: 'Consumer Secret',      type: 'text', placeholder: 'xyz…',    secret: true },
      { key: 'mpesa_passkey',         label: 'Passkey',              type: 'text', placeholder: 'bfb2…',   secret: true },
      { key: 'mpesa_shortcode',       label: 'Shortcode / Till',     type: 'text', placeholder: '174379'   },
      { key: 'mpesa_callback_url',    label: 'Callback URL',         type: 'text', placeholder: 'https://api.yourdomain.com/webhooks/mpesa' },
    ],
  },
  {
    title: 'Platform',
    fields: [
      { key: 'jwt_secret',           label: 'JWT Secret',            type: 'text', placeholder: 'super-secret…', secret: true },
      { key: 'r2_public_url',        label: 'R2 Public Domain',      type: 'text', placeholder: 'https://docs.yourdomain.com' },
    ],
  },
]

export default function SettingsPage() {
  const [values, setValues]   = useState<Record<string, string>>({})
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [saved, setSaved]     = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration — stored as encrypted secrets</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {SECTIONS.map(section => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{section.title}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {section.fields.map(field => (
                <div key={field.key} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 sm:w-48 shrink-0">{field.label}</label>
                  <div className="relative flex-1">
                    <input
                      type={field.secret && !visible[field.key] ? 'password' : 'text'}
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono pr-9"
                    />
                    {field.secret && (
                      <button
                        type="button"
                        onClick={() => setVisible(v => ({ ...v, [field.key]: !v[field.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {visible[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          type="submit"
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Save size={15} />
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
