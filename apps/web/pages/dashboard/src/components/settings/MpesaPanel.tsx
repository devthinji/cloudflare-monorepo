import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const FIELDS = [
  { key: 'MPESA_CONSUMER_KEY', label: 'Consumer Key', required: true, source: '.dev.vars' },
  { key: 'MPESA_CONSUMER_SECRET', label: 'Consumer Secret', required: true, source: '.dev.vars' },
  { key: 'MPESA_PASSKEY', label: 'Passkey', required: true, source: '.dev.vars' },
  { key: 'MPESA_SHORTCODE', label: 'Shortcode', required: true, source: '.dev.vars', value: '174379' },
  { key: 'MPESA_CALLBACK_URL', label: 'Callback URL', required: true, source: '.dev.vars', value: 'https://<ngrok>.ngrok-free.app/webhooks/mpesa' },
  { key: 'MPESA_ENVIRONMENT', label: 'Environment', required: true, source: '.dev.vars', value: 'sandbox' },
]

export default function MpesaPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">M-Pesa Daraja</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          M-Pesa payment processing via the Safaricom Daraja API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration reference</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Secrets are managed via <code className="bg-gray-100 px-1 rounded text-xs">.dev.vars</code> in local dev
            and Cloudflare Secrets in production.
          </p>
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
              {FIELDS.map(f => (
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
    </div>
  )
}
