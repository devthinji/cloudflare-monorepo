import { useState } from 'react'
import WorkflowEditor from '@/components/workflow/WorkflowEditor'
import { agentsApi } from '@/api/client'
import type { Agent } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

const BLUEPRINT_ID = 'taji-v1'
const BLUEPRINT_VERSION = 1

export default function WorkflowPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentSlug, setAgentSlug] = useState('taji')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    agentsApi.list()
      .then(setAgents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between pb-3 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workflow Builder</h1>
          <p className="text-sm text-muted-foreground">Drag-and-drop visual editor for conversation blueprints</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Agent</Label>
            <select
              value={agentSlug}
              onChange={e => setAgentSlug(e.target.value)}
              className="flex h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {agents.map(a => (
                <option key={a.slug} value={a.slug} disabled={!a.isActive}>{a.name} ({a.slug}){!a.isActive ? ' — inactive' : ''}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground self-end pb-1">
            Blueprint: {BLUEPRINT_ID} v{BLUEPRINT_VERSION}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="flex-1 rounded-md border overflow-hidden" style={{ minHeight: '500px' }}>
        <WorkflowEditor
          blueprintId={BLUEPRINT_ID}
          blueprintVersion={BLUEPRINT_VERSION}
          agentSlug={agentSlug}
        />
      </div>
    </div>
  )
}
