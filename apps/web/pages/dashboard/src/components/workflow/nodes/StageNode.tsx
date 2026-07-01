import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StageType = 'identify' | 'auth' | 'collect' | 'farewell' | 'closed' | 'substage'

const STAGE_STYLES: Record<StageType, { border: string; badge: string; bg: string }> = {
  identify: { border: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700', bg: 'bg-blue-50' },
  auth:     { border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700', bg: 'bg-amber-50' },
  collect:  { border: 'border-l-indigo-500', badge: 'bg-indigo-100 text-indigo-700', bg: 'bg-indigo-50' },
  farewell: { border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700', bg: 'bg-emerald-50' },
  closed:   { border: 'border-l-gray-400', badge: 'bg-gray-100 text-gray-600', bg: 'bg-gray-50' },
  substage: { border: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-600', bg: 'bg-slate-50' },
}

export type StageNodeData = {
  stage: StageType
  label: string
  description?: string
  subStages?: string[]
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
      'w-56 shadow-md border-l-4 transition-shadow',
      style.border,
      selected && 'shadow-lg ring-2 ring-blue-400/50',
    )}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-gray-400" />
      <CardHeader className="p-3 pb-1 flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold truncate">{data.label}</CardTitle>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 font-semibold shrink-0', style.badge)}>
          {data.stage}
        </Badge>
      </CardHeader>
      {data.description && (
        <CardContent className="px-3 pb-3 pt-0">
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </CardContent>
      )}
      {data.subStages && data.subStages.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1">
          {data.subStages.map(s => (
            <span key={s} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', style.bg)}>
              {s}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-gray-400" />
    </Card>
  )
}

export default memo(StageNode)
