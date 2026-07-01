import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const FIELDS = [
  { key: 'VITE_API_URL', label: 'Dashboard API URL', required: true, source: '.env.local', value: 'http://localhost:8787' },
  { key: 'Database', label: 'D1 Database', required: true, source: 'wrangler.toml', value: 'platform-db' },
  { key: 'SESSIONS_KV', label: 'Sessions KV', required: true, source: 'wrangler.toml' },
  { key: 'DOCS_BUCKET', label: 'R2 Documents Bucket', required: true, source: 'wrangler.toml', value: 'platform-docs' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', required: true, source: '.dev.vars' },
  { key: 'JWT_SECRET', label: 'JWT Secret', required: true, source: '.dev.vars' },
  { key: 'DB_ENCRYPTION_KEY', label: 'DB Encryption Key', required: true, source: '.dev.vars' },
]

export default function PlatformPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Platform</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide configuration, service bindings, and environment variables.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment reference</CardTitle>
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
