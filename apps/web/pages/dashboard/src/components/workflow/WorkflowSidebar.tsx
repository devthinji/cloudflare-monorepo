import { useState, type DragEvent } from 'react'
import { ChevronRight, GitBranch, MessageCircle, Image as ImageIcon, Cog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { StageType, StageNodeData } from './nodes/StageNode'
import type { TransitionNodeData } from './nodes/TransitionNode'
import type { MessageNodeData } from './nodes/MessageNode'
import type { ExecuteNodeData } from './nodes/ExecuteNode'

type PaletteData = StageNodeData | TransitionNodeData | MessageNodeData | ExecuteNodeData

interface PaletteItem {
  nodeType: 'stage' | 'transition' | 'message' | 'execute'
  color: string
  icon: React.ReactNode
  label: string
  description: string
  data: PaletteData
}

const STAGE_COLORS: Record<StageType, string> = {
  identify: 'bg-blue-500',
  auth:     'bg-amber-500',
  collect:  'bg-indigo-500',
  farewell: 'bg-emerald-500',
  closed:   'bg-muted-foreground',
  substage: 'bg-muted-foreground',
}

const BASIC: PaletteItem[] = [
  { nodeType: 'stage', color: STAGE_COLORS.identify, icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />, label: 'Identify', description: 'Identify the customer by phone', data: { stage: 'identify', label: 'Identify', description: 'Identify the customer by phone' } },
  { nodeType: 'stage', color: STAGE_COLORS.auth,     icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />, label: 'Auth', description: 'Authenticate or register', data: { stage: 'auth', label: 'Auth', description: 'Authenticate or register' } },
  { nodeType: 'stage', color: STAGE_COLORS.collect,  icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />, label: 'Collect', description: 'Collect fields & process payment', data: { stage: 'collect', label: 'Collect', description: 'Collect fields & process payment', subStages: ['sku_select', 'collection', 'naming', 'validation', 'transaction', 'confirm_generation', 'generation', 'repetition_or_close'] } },
  { nodeType: 'stage', color: STAGE_COLORS.farewell, icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />, label: 'Farewell', description: 'Say goodbye or ask next', data: { stage: 'farewell', label: 'Farewell', description: 'Say goodbye or ask next' } },
  { nodeType: 'stage', color: STAGE_COLORS.closed,   icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground" />, label: 'Closed', description: 'Session terminated', data: { stage: 'closed', label: 'Closed', description: 'Session terminated' } },
  { nodeType: 'transition', color: 'bg-purple-500', icon: <GitBranch className="h-3.5 w-3.5 shrink-0 text-purple-600" />, label: 'Transition', description: 'Branch the flow on a condition', data: { kind: 'transition', label: 'Transition', condition: '' } },
]

const MESSAGE: PaletteItem[] = [
  { nodeType: 'message', color: 'bg-teal-500', icon: <MessageCircle className="h-3.5 w-3.5 shrink-0 text-teal-600" />, label: 'Text Reply', description: 'Send a text message to the user', data: { kind: 'message', label: 'Text Reply', messageType: 'text', content: '' } },
  { nodeType: 'message', color: 'bg-teal-500', icon: <ImageIcon className="h-3.5 w-3.5 shrink-0 text-teal-600" />, label: 'Image Reply', description: 'Send an image to the user', data: { kind: 'message', label: 'Image Reply', messageType: 'image', mediaUrl: '' } },
]

const EXECUTE: PaletteItem[] = [
  { nodeType: 'execute', color: 'bg-orange-500', icon: <Cog className="h-3.5 w-3.5 shrink-0 text-orange-600" />, label: 'Action', description: 'Run a backend action (payment, docgen, etc.)', data: { kind: 'execute', label: 'Action', action: '', params: '' } },
]

function onDragStart(event: DragEvent, nodeType: string, data: PaletteData) {
  event.dataTransfer.setData('application/reactflow', JSON.stringify(data))
  event.dataTransfer.setData('application/reactflow-type', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}

function PaletteGroup({ title, items, defaultOpen = true }: { title: string; items: PaletteItem[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pb-3 pt-1">
        {items.map(item => (
          <Card
            key={item.label}
            draggable
            onDragStart={e => onDragStart(e, item.nodeType, item.data)}
            className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
          >
            <CardContent>
              <div className="mb-1 flex items-center gap-2">
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
                <Badge variant="secondary" className="ml-auto px-1 py-0 text-[10px]">{item.nodeType}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function WorkflowSidebar() {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-3">
      <PaletteGroup title="Basic" items={BASIC} />
      <PaletteGroup title="Message" items={MESSAGE} />
      <PaletteGroup title="Execute" items={EXECUTE} />
    </aside>
  )
}
