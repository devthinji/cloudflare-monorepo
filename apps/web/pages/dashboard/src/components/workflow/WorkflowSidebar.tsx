import { useState, type DragEvent } from 'react'
import { ChevronRight, MessageCircle, Image as ImageIcon, Code2, GitBranch } from 'lucide-react'
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
  icon: React.ReactNode
  label: string
  description: string
  data: PaletteData
}

const STAGE_DOT: Record<StageType, string> = {
  identify: 'bg-blue-500',
  auth:     'bg-amber-500',
  collect:  'bg-indigo-500',
  farewell: 'bg-emerald-500',
  closed:   'bg-muted-foreground',
  substage: 'bg-muted-foreground',
}

// Card tray categories mirror Botpress Studio's own order: Nodes, Send Messages, Execute Code, Flow Logic.
const NODES: PaletteItem[] = [
  { nodeType: 'stage', icon: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT.identify)} />, label: 'Identify', description: 'Identify the customer by phone', data: { stage: 'identify', label: 'Identify', description: 'Identify the customer by phone' } },
  { nodeType: 'stage', icon: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT.auth)} />, label: 'Auth', description: 'Authenticate or register', data: { stage: 'auth', label: 'Auth', description: 'Authenticate or register' } },
  { nodeType: 'stage', icon: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT.collect)} />, label: 'Collect', description: 'Collect fields & process payment', data: { stage: 'collect', label: 'Collect', description: 'Collect fields & process payment', subStages: ['sku_select', 'collection', 'naming', 'validation', 'transaction', 'confirm_generation', 'generation', 'repetition_or_close'] } },
  { nodeType: 'stage', icon: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT.farewell)} />, label: 'Farewell', description: 'Say goodbye or ask next', data: { stage: 'farewell', label: 'Farewell', description: 'Say goodbye or ask next' } },
  { nodeType: 'stage', icon: <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_DOT.closed)} />, label: 'Closed', description: 'Session terminated', data: { stage: 'closed', label: 'Closed', description: 'Session terminated' } },
]

const SEND_MESSAGES: PaletteItem[] = [
  { nodeType: 'message', icon: <MessageCircle className="h-3.5 w-3.5 shrink-0 text-teal-600" />, label: 'Text', description: 'Send a text message to the user', data: { kind: 'message', label: 'Text Reply', messageType: 'text', content: '' } },
  { nodeType: 'message', icon: <ImageIcon className="h-3.5 w-3.5 shrink-0 text-teal-600" />, label: 'Image', description: 'Send an image to the user', data: { kind: 'message', label: 'Image Reply', messageType: 'image', mediaUrl: '' } },
]

const EXECUTE_CODE: PaletteItem[] = [
  { nodeType: 'execute', icon: <Code2 className="h-3.5 w-3.5 shrink-0 text-orange-600" />, label: 'Action', description: 'Run a backend action (payment, docgen, etc.)', data: { kind: 'execute', label: 'Action', action: '', params: '' } },
]

const FLOW_LOGIC: PaletteItem[] = [
  { nodeType: 'transition', icon: <GitBranch className="h-3.5 w-3.5 shrink-0 text-purple-600" />, label: 'Transition', description: 'Branch the flow on a condition', data: { kind: 'transition', label: 'Transition', condition: '' } },
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

// Order and naming follow Botpress Studio's own Card tray: Nodes, Send Messages, Execute Code, Flow Logic.
export default function WorkflowSidebar() {
  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-3">
      <PaletteGroup title="Nodes" items={NODES} />
      <PaletteGroup title="Send Messages" items={SEND_MESSAGES} />
      <PaletteGroup title="Execute Code" items={EXECUTE_CODE} />
      <PaletteGroup title="Flow Logic" items={FLOW_LOGIC} />
    </aside>
  )
}
