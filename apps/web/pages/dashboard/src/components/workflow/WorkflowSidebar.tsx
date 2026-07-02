import { useState, type DragEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { StageType, StageNodeData } from './nodes/StageNode'

interface PaletteItem {
  label: string
  description: string
  data: StageNodeData
}

const STAGE_DOT: Record<StageType, string> = {
  identify: 'bg-blue-500',
  auth:     'bg-amber-500',
  collect:  'bg-indigo-500',
  farewell: 'bg-emerald-500',
  closed:   'bg-muted-foreground',
  substage: 'bg-muted-foreground',
}

// Mirrors Botpress v12's simple "Add Node" menu — just node presets, no drag tray of content types.
// Actions (say text/image, execute code) are added inside a node via the Inspector, not dragged onto the canvas.
const NODES: PaletteItem[] = [
  { label: 'Identify', description: 'Identify the customer by phone', data: { stage: 'identify', label: 'Identify', description: 'Identify the customer by phone' } },
  { label: 'Auth', description: 'Authenticate or register', data: { stage: 'auth', label: 'Auth', description: 'Authenticate or register' } },
  { label: 'Collect', description: 'Collect fields & process payment', data: { stage: 'collect', label: 'Collect', description: 'Collect fields & process payment', subStages: ['sku_select', 'collection', 'naming', 'validation', 'transaction', 'confirm_generation', 'generation', 'repetition_or_close'] } },
  { label: 'Farewell', description: 'Say goodbye or ask next', data: { stage: 'farewell', label: 'Farewell', description: 'Say goodbye or ask next' } },
  { label: 'Closed', description: 'Session terminated', data: { stage: 'closed', label: 'Closed', description: 'Session terminated' } },
]

function onDragStart(event: DragEvent, data: StageNodeData) {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(data))
  event.dataTransfer.setData('application/reactflow-type', 'stage')
  event.dataTransfer.effectAllowed = 'move'
}

export default function WorkflowSidebar() {
  const [open, setOpen] = useState(true)
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          Nodes
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pb-3 pt-1">
          {NODES.map(item => (
            <Card
              key={item.label}
              draggable
              onDragStart={e => onDragStart(e, item.data)}
              className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
            >
              <CardContent>
                <div className="mb-1 flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT[item.data.stage])} />
                  <span className="text-sm font-medium">{item.label}</span>
                  <Badge variant="secondary" className="ml-auto px-1 py-0 text-[10px]">node</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </CollapsibleContent>
      </Collapsible>
      <p className="mt-2 px-1 text-[11px] text-muted-foreground">
        Add actions (say text/image, execute code) from a node's Inspector once it's on the canvas.
      </p>
    </aside>
  )
}
