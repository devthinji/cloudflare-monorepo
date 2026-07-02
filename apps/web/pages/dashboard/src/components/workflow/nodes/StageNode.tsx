import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageCircle, Image as ImageIcon, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NodeAction } from '../types'

export type StageType = 'identify' | 'auth' | 'collect' | 'farewell' | 'closed' | 'substage'

const STAGE_STYLES: Record<StageType, { border: string; badge: string; bg: string }> = {
  identify: { border: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700', bg: 'bg-blue-50' },
  auth:     { border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700', bg: 'bg-amber-50' },
  collect:  { border: 'border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700', bg: 'bg-indigo-50' },
  farewell: { border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50' },
  closed:   { border: 'border-l-muted-foreground', badge: 'bg-muted text-muted-foreground', bg: 'bg-muted/50' },
  substage: { border: 'border-l-muted-foreground', badge: 'bg-muted text-muted-foreground', bg: 'bg-muted/50' },
}

const ACTION_ICON = {
  say_text: MessageCircle,
  say_image: ImageIcon,
  execute_code: Code2,
}

function actionSummary(a: NodeAction): string {
  if (a.type === 'say_text') return a.content || 'empty text'
  if (a.type === 'say_image') return a.mediaUrl || 'no image url'
  return a.actionName || 'no action name'
}

export type StageNodeData = {
  stage: StageType
  label: string
  description?: string
  subStages?: string[]
  actions?: NodeAction[]
  [key: string]: unknown
}

interface StageNodeProps {
  data: StageNodeData
  selected?: boolean
}

function StageNode({ data, selected }: StageNodeProps) {
  const style = STAGE_STYLES[data.stage] ?? STAGE_STYLES.closed

  return (
    <Card className={cn(
      'w-64 shadow-md border-l-4 transition-shadow',
      style.border,
      selected && 'shadow-lg ring-2 ring-blue-400/50',
    )}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-muted-foreground" />
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold truncate">{data.label}</CardTitle>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 font-semibold shrink-0', style.badge)}>
          {data.stage}
        </Badge>
      </CardHeader>
      {data.description && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </CardContent>
      )}

      {/* onEnter actions, stacked — mirrors Botpress v12's node content list */}
      {data.actions && data.actions.length > 0 && (
        <div className="space-y-1 px-3 pb-2">
          {data.actions.map(a => {
            const Icon = ACTION_ICON[a.type]
            return (
              <div key={a.id} className="flex items-center gap-1.5 rounded border bg-muted/30 px-1.5 py-1">
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-[10px] text-muted-foreground">{actionSummary(a)}</span>
              </div>
            )
          })}
        </div>
      )}

      {data.subStages && data.subStages.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-3">
          {data.subStages.map(s => (
            <span key={s} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', style.bg)}>
              {s}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-muted-foreground" />
    </Card>
  )
}

export default memo(StageNode)
