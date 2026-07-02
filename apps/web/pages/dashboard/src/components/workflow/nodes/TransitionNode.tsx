import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
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
    <div
      className={cn(
        'w-48 rounded-lg border-2 border-dashed border-purple-400 bg-purple-50 px-3 py-2 shadow-sm transition-shadow',
        selected && 'shadow-lg ring-2 ring-purple-400/50',
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-purple-500" />
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-purple-600" />
        <span className="text-sm font-semibold text-purple-900 truncate">{data.label}</span>
      </div>
      {data.condition && (
        <p className="mt-1 truncate rounded bg-purple-100 px-1.5 py-0.5 text-[11px] font-mono text-purple-700">
          {data.condition}
        </p>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-purple-500" />
    </div>
  )
}

export default memo(TransitionNode)
