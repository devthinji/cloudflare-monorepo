import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const SECTIONS = [
  {
    title: 'AI Provider',
    icon: '🤖',
    fields: [
      { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', required: true, source: '.dev.vars' },
      { key: 'JWT_SECRET', label: 'JWT Secret', required: true, source: '.dev.vars' },
      { key: 'DB_ENCRYPTION_KEY', label: 'DB Encryption Key', required: true, source: '.dev.vars' },
    ],
  },
  {
    title: 'WhatsApp (Meta Cloud API)',
    icon: '📱',
    fields: [
      { key: 'WHATSAPP_ACCESS_TOKEN', label: 'Access Token', required: true, source: '.dev.vars / D1' },
      { key: 'WHATSAPP_APP_SECRET', label: 'App Secret', required: true, source: '.dev.vars / D1' },
      { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Verify Token', required: true, source: '.dev.vars / D1' },
      { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', required: true, source: 'D1 (agents.channel_config)' },
      { key: 'WHATSAPP_BUSINESS_ACCOUNT_ID', label: 'Business Account ID', required: false, source: 'D1 (agents.channel_config)' },
    ],
  },
  {
    title: 'M-Pesa Daraja',
    icon: '💳',
    fields: [
      { key: 'MPESA_CONSUMER_KEY', label: 'Consumer Key', required: true, source: '.dev.vars' },
      { key: 'MPESA_CONSUMER_SECRET', label: 'Consumer Secret', required: true, source: '.dev.vars' },
      { key: 'MPESA_PASSKEY', label: 'Passkey', required: true, source: '.dev.vars' },
      { key: 'MPESA_SHORTCODE', label: 'Shortcode', required: true, source: '.dev.vars' },
      { key: 'MPESA_CALLBACK_URL', label: 'Callback URL', required: true, source: '.dev.vars' },
      { key: 'MPESA_ENVIRONMENT', label: 'Environment', required: true, source: '.dev.vars' },
    ],
  },
  {
    title: 'Platform',
    icon: '⚙️',
    fields: [
      { key: 'VITE_API_URL', label: 'Dashboard API URL', required: true, source: '.env.local', value: 'http://localhost:8787' },
      { key: 'Database', label: 'D1 Database', required: true, source: 'wrangler.toml', value: 'platform-db' },
      { key: 'SESSIONS_KV', label: 'Sessions KV', required: true, source: 'wrangler.toml' },
      { key: 'DOCS_BUCKET', label: 'R2 Documents Bucket', required: true, source: 'wrangler.toml', value: 'platform-docs' },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Platform configuration reference</p>
      </div>

      <p className="text-sm text-muted-foreground">
        Secrets are managed via <code className="bg-gray-100 px-1 rounded text-xs">.dev.vars</code> in local dev
        and Cloudflare Secrets in production. Agent-specific WhatsApp credentials are stored encrypted
        in the <code className="bg-gray-100 px-1 rounded text-xs">agents</code> D1 table.
      </p>

      {SECTIONS.map(s => (
        <Card key={s.title}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span>{s.icon}</span>
              {s.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium w-48">Key</th>
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium w-32">Source</th>
                  <th className="pb-2 font-medium w-20">Required</th>
                </tr>
              </thead>
              <tbody>
                {s.fields.map(f => (
                  <tr key={f.key} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{f.key}</td>
                    <td className="py-2">
                      <span className="font-medium">{f.label}</span>
                      {f.value && <span className="text-xs text-muted-foreground ml-2">({f.value})</span>}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{f.source}</td>
                    <td className="py-2">
                      <Badge className={f.required ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}>
                        {f.required ? 'Required' : 'Optional'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
