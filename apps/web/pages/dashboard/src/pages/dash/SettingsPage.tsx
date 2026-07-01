// ─── Settings Page ────────────────────────────────────────────────────────────
// Secrets are managed via Doppler + wrangler, not the dashboard.
// This page documents what is required and how to configure each secret.

import { ExternalLink, Info, Shield } from 'lucide-react'

interface SecretDoc {
  key:         string
  label:       string
  description: string
  where:       string
  required:    boolean
}

const SECRET_DOCS: { section: string; secrets: SecretDoc[] }[] = [
  {
    section: 'AI Provider',
    secrets: [
      { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key',     description: 'Primary LLM provider. Used by all workers for text generation.', where: 'https://openrouter.ai/keys', required: true },
    ],
  },
  {
    section: 'WhatsApp (Meta Cloud API)',
    secrets: [
      { key: 'WHATSAPP_ACCESS_TOKEN',     label: 'Access Token',         description: 'Meta permanent or long-lived token for sending messages.', where: 'Meta Business Manager → WhatsApp → API Setup', required: true },
      { key: 'WHATSAPP_PHONE_NUMBER_ID',  label: 'Phone Number ID',      description: 'The numeric ID of your WhatsApp Business phone number.',   where: 'Meta Business Manager → WhatsApp → API Setup', required: true },
      { key: 'WHATSAPP_VERIFY_TOKEN',     label: 'Webhook Verify Token', description: 'Any secret string — must match what Meta sends to verify your webhook.', where: 'Set by you, then enter in Meta webhook config', required: true },
    ],
  },
  {
    section: 'M-Pesa Daraja',
    secrets: [
      { key: 'MPESA_CONSUMER_KEY',    label: 'Consumer Key',    description: 'Daraja app consumer key.',           where: 'https://developer.safaricom.co.ke', required: true },
      { key: 'MPESA_CONSUMER_SECRET', label: 'Consumer Secret', description: 'Daraja app consumer secret.',        where: 'https://developer.safaricom.co.ke', required: true },
      { key: 'MPESA_PASSKEY',         label: 'Passkey',         description: 'Lipa Na M-Pesa Online passkey.',     where: 'https://developer.safaricom.co.ke', required: true },
      { key: 'MPESA_SHORTCODE',       label: 'Shortcode',       description: 'Paybill or Till number.',            where: 'Safaricom Business Account',        required: true },
      { key: 'MPESA_CALLBACK_URL',    label: 'Callback URL',    description: 'Public URL that Safaricom calls after payment. Must match gateway /webhooks/mpesa.', where: 'Your deployed gateway URL', required: true },
      { key: 'MPESA_ENVIRONMENT',     label: 'Environment',     description: '"sandbox" for testing, "production" for live.',  where: 'Set manually', required: true },
    ],
  },
  {
    section: 'Platform',
    secrets: [
      { key: 'JWT_SECRET',   label: 'JWT Secret',      description: 'Secret key for signing dashboard JWT tokens. Use a 32+ character random string.', where: 'Generate: openssl rand -hex 32',              required: true },
      { key: 'R2_PUBLIC_URL', label: 'R2 Public Domain', description: 'The public domain for your R2 bucket, used to serve generated documents.', where: 'Cloudflare Dashboard → R2 → Bucket settings', required: false },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration reference</p>
      </div>

      {/* Info banner */}
      <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5 text-sm text-blue-800">
        <Shield size={18} className="shrink-0 mt-0.5 text-blue-500" />
        <div>
          <p className="font-medium">Secrets are managed via Doppler, not the dashboard.</p>
          <p className="text-blue-600 mt-1">
            Add or update secrets at{' '}
            <a href="https://dashboard.doppler.com" target="_blank" rel="noopener noreferrer"
              className="underline font-medium">dashboard.doppler.com</a>
            {' '}under project <code className="bg-blue-100 px-1 rounded">cloudflare-monorepo</code>, config <code className="bg-blue-100 px-1 rounded">dev</code> (local) or <code className="bg-blue-100 px-1 rounded">prd</code> (production).
          </p>
        </div>
      </div>

      {/* Secret docs per section */}
      {SECRET_DOCS.map(({ section, secrets }) => (
        <div key={section} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">{section}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {secrets.map(s => (
              <div key={s.key} className="px-6 py-4 flex items-start gap-4">
                <Info size={15} className="text-gray-300 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{s.key}</code>
                    <span className="text-sm font-medium text-gray-800">{s.label}</span>
                    {s.required && <span className="text-xs text-red-500 font-medium">required</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{s.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <ExternalLink size={11} />
                    {s.where.startsWith('http')
                      ? <a href={s.where} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">{s.where}</a>
                      : s.where
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
