import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type TransitionNodeData = {
  kind: 'transition'
  label: string
  condition?: string
  [key: string]: unknown
}

interface TransitionNodeProps {
  data: TransitionNodeData
  selected?: boolean
}

function TransitionNode({ data, selected }: TransitionNodeProps) {
  return (
    <Card
      className={cn(
        'w-52 border-l-4 border-l-purple-500 shadow-md transition-shadow',
        selected && 'shadow-lg ring-2 ring-purple-400/50',
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-purple-500" />
      <CardHeader className="flex-row items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-purple-600" />
        <CardTitle className="text-sm font-semibold truncate">{data.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {data.condition || 'no condition set'}
        </p>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-purple-500" />
    </Card>
  )
}

export default memo(TransitionNode)
