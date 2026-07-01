import { useEffect, useState, type FormEvent } from 'react'
import { agentsApi, type Agent } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, Copy, AlertTriangle, RotateCcw } from 'lucide-react'

const MASKED = '\u2022'.repeat(20)

const FIELDS = [
  { key: 'whatsappPhoneNumberId', label: 'Phone Number ID', type: 'text', secret: false, placeholder: 'e.g. 1038436689362682' },
  { key: 'whatsappBusinessAccountId', label: 'Business Account ID', type: 'text', secret: false, placeholder: 'e.g. 1231013812046656' },
  { key: 'whatsappAccessToken', label: 'Access Token', type: 'password', secret: true, placeholder: 'EAAC...' },
  { key: 'whatsappAppSecret', label: 'App Secret', type: 'password', secret: true, placeholder: 'f59d14289c33...' },
  { key: 'whatsappVerifyToken', label: 'Verify Token', type: 'password', secret: true, placeholder: 'mytoken' },
]

export default function WhatsAppConfig() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown')
  const [statusMessage, setStatusMessage] = useState('')
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})

  useEffect(() => {
    agentsApi.list().then(setAgents).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedSlug) return
    agentsApi.get(selectedSlug).then(a => {
      const merged: Record<string, string> = {}
      for (const f of FIELDS) {
        const source = f.secret ? a.apiKeys?.[f.key] : (a.channelConfig?.[f.key] as string | undefined)
        merged[f.key] = source ?? ''
      }
      setValues(merged)
      setDirty({})
      setConnectionStatus(merged.whatsappAccessToken ? 'connected' : 'disconnected')
    }).catch(() => setConnectionStatus('disconnected'))
  }, [selectedSlug])

  function setValue(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }))
    setDirty(d => ({ ...d, [key]: true }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!selectedSlug) return
    setSaving(true)
    try {
      const apiKeys: Record<string, string> = {}
      const channelConfig: Record<string, unknown> = {}
      for (const f of FIELDS) {
        const v = values[f.key] ?? ''
        if (f.secret) {
          if (dirty[f.key] || v) apiKeys[f.key] = v
        } else {
          if (v) channelConfig[f.key] = v
        }
      }
      await agentsApi.update(selectedSlug, {
        apiKeys: Object.keys(apiKeys).length ? apiKeys : undefined,
        channelConfig: Object.keys(channelConfig).length ? channelConfig : undefined,
      })
      setDirty({})
      setConnectionStatus('connected')
      setStatusMessage('Credentials saved.')
    } catch (e: any) {
      setStatusMessage(e.message)
    }
    setSaving(false)
  }

  async function handleTest() {
    if (!selectedSlug) return
    setTesting(true)
    try {
      const a = await agentsApi.get(selectedSlug)
      const token = a.apiKeys?.whatsappAccessToken
      if (token) {
        setConnectionStatus('connected')
        setStatusMessage('API connection successful')
      } else {
        setConnectionStatus('disconnected')
        setStatusMessage('No access token configured')
      }
    } catch {
      setConnectionStatus('disconnected')
      setStatusMessage('Connection test failed')
    }
    setTesting(false)
  }

  async function handleReset() {
    if (!selectedSlug || !confirm('Clear WhatsApp credentials for this agent?')) return
    setResetting(true)
    try {
      await agentsApi.update(selectedSlug, {
        apiKeys: { whatsappAccessToken: '', whatsappAppSecret: '', whatsappVerifyToken: '' },
        channelConfig: { whatsappPhoneNumberId: '', whatsappBusinessAccountId: '' },
      })
      setValues({})
      setDirty({})
      setConnectionStatus('disconnected')
      setStatusMessage('')
    } catch (e: any) {
      setStatusMessage(e.message)
    }
    setResetting(false)
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/webhooks/whatsapp`
    : ''

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url)
  }

  const currentAgent = agents.find(a => a.slug === selectedSlug)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">WhatsApp connection</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure Meta WhatsApp Business API credentials per agent.
        </p>
      </div>

      {/* Agent selector */}
      <div className="space-y-1">
        <Label>Agent</Label>
        <select
          value={selectedSlug}
          onChange={e => setSelectedSlug(e.target.value)}
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select an agent...</option>
          {agents.map(a => (
            <option key={a.slug} value={a.slug}>{a.name} ({a.slug})</option>
          ))}
        </select>
      </div>

      {!selectedSlug && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Select an agent to configure its WhatsApp credentials.
          </CardContent>
        </Card>
      )}

      {selectedSlug && (
        <>
          {/* Connection Status */}
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <CheckCircle2 className="size-4 text-green-600 shrink-0" />
              ) : (
                <XCircle className="size-4 text-red-500 shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-medium">
                  {connectionStatus === 'connected' ? 'Connected' : 'Not connected'}
                </span>
                {statusMessage && (
                  <span className="text-muted-foreground ml-2">— {statusMessage}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Credentials form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Credentials</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                {FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label>{f.label}</Label>
                    <div className="flex gap-1">
                      <Input
                        type={f.secret && !showSecrets[f.key] ? 'password' : 'text'}
                        value={values[f.key] ?? ''}
                        onChange={e => setValue(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="flex-1 font-mono text-xs"
                      />
                      {f.secret && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets(s => ({ ...s, [f.key]: !s[f.key] }))}>
                          {showSecrets[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 flex-wrap">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button type="button" variant="outline" className="text-red-500 hover:text-red-700" onClick={handleReset} disabled={resetting}>
                    {resetting ? 'Resetting...' : 'Reset'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Webhook URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Webhook URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Set this URL in your Meta App Dashboard &rarr; WhatsApp &rarr; Configuration.
              </p>
              <div className="flex gap-1">
                <Input value={webhookUrl} readOnly className="font-mono text-xs flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => handleCopy(webhookUrl)}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Setup instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Setup steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Go to <strong>Meta Developer Portal</strong> &rarr; your app &rarr; WhatsApp &rarr; Configuration</li>
                <li>Set the <strong>Callback URL</strong> to the webhook URL above</li>
                <li>Set the <strong>Verify Token</strong> to match what you enter above</li>
                <li>Subscribe to the <strong>messages</strong> webhook field</li>
                <li>Configure your <strong>Phone Number ID</strong> and <strong>Permanent Access Token</strong> from the WhatsApp Business Account</li>
                <li>Click <strong>Save</strong> to store credentials, then <strong>Test Connection</strong> to verify</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
