import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { MessageCircle, Image as ImageIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MessageType } from '../types'

export type MessageNodeData = {
  kind: 'message'
  label: string
  messageType: MessageType
  content?: string
  mediaUrl?: string
  [key: string]: unknown
}

interface MessageNodeProps {
  data: MessageNodeData
  selected?: boolean
}

function MessageNode({ data, selected }: MessageNodeProps) {
  const isImage = data.messageType === 'image'

  return (
    <Card
      className={cn(
        'w-60 border-l-4 border-l-teal-500 shadow-md transition-shadow',
        selected && 'shadow-lg ring-2 ring-teal-400/50',
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !bg-teal-500" />
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold truncate">
          {isImage ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-teal-600" /> : <MessageCircle className="h-3.5 w-3.5 shrink-0 text-teal-600" />}
          <span className="truncate">{data.label}</span>
        </CardTitle>
        <Badge variant="secondary" className="shrink-0 bg-teal-100 px-1.5 py-0 text-[10px] font-semibold text-teal-700">
          {data.messageType}
        </Badge>
      </CardHeader>
      <CardContent>
        {isImage ? (
          <p className="truncate text-xs text-muted-foreground">{data.mediaUrl || 'No image URL set'}</p>
        ) : (
          <p className="line-clamp-2 text-xs text-muted-foreground">{data.content || 'No reply text set'}</p>
        )}
      </CardContent>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !bg-teal-500" />
    </Card>
  )
}

export default memo(MessageNode)
