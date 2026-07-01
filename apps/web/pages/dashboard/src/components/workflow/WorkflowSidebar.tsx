import { type DragEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StageType, StageNodeData } from './nodes/StageNode'

interface StageDef {
  stage: StageType
  label: string
  description: string
  subStages?: string[]
}

const STAGES: StageDef[] = [
  { stage: 'identify', label: 'Identify', description: 'Identify the customer by phone' },
  { stage: 'auth',     label: 'Auth',     description: 'Authenticate or register' },
  { stage: 'collect',  label: 'Collect',  description: 'Collect fields & process payment', subStages: ['sku_select', 'collection', 'naming', 'validation', 'transaction', 'confirm_generation', 'generation', 'repetition_or_close'] },
  { stage: 'farewell', label: 'Farewell', description: 'Say goodbye or ask next' },
  { stage: 'closed',   label: 'Closed',   description: 'Session terminated' },
]

const STAGE_COLORS: Record<StageType, string> = {
  identify: 'bg-blue-500',
  auth:     'bg-amber-500',
  collect:  'bg-indigo-500',
  farewell: 'bg-emerald-500',
  closed:   'bg-muted-foreground',
  substage: 'bg-muted-foreground',
}

function onDragStart(event: DragEvent, data: StageNodeData) {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(data))
  event.dataTransfer.effectAllowed = 'move'
}

export default function WorkflowSidebar() {
  return (
    <aside className="w-56 shrink-0 bg-background border-r border-border p-4 overflow-y-auto">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Stages</h3>
      <div className="space-y-2">
        {STAGES.map(s => (
          <Card
            key={s.stage}
            draggable
            onDragStart={e => onDragStart(e, { stage: s.stage, label: s.label, description: s.description, subStages: s.subStages })}
            className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
          >
            <CardContent>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', STAGE_COLORS[s.stage])} />
                <span className="text-sm font-medium">{s.label}</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">{s.stage}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{s.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </aside>
  )
}
