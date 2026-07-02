import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Cog } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type ExecuteNodeData = {
  kind: 'execute'
  label: string
  action?: string
  params?: string
  [key: string]: unknown
}

interface ExecuteNodeProps {
  data: ExecuteNodeData
  selected?: boolean
}

function ExecuteNode({ data, selected }: ExecuteNodeProps) {
  return (
    <Card
      className={cn(
        'w-56 border-l-4 border-l-orange-500 shadow-md transition-shadow',
        selected && 'shadow-lg ring-2 ring-orange-400/50',
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-orange-500" />
      <CardHeader className="flex-row items-center gap-2">
        <Cog className="h-3.5 w-3.5 shrink-0 text-orange-600" />
        <CardTitle className="text-sm font-semibold truncate">{data.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="truncate rounded bg-orange-100 px-1.5 py-0.5 font-mono text-[11px] text-orange-800">
          {data.action || 'no_action_set()'}
        </p>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-orange-500" />
    </Card>
  )
}

export default memo(ExecuteNode)
