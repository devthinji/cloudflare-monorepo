import type { Edge, Node } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { RotateCcw, Image as ImageIcon } from 'lucide-react'
import { useFlowSimulator } from '../hooks/useFlowSimulator'

interface ChatTestPanelProps {
  nodes: Node[]
  edges: Edge[]
}

export default function ChatTestPanel({ nodes, edges }: ChatTestPanelProps) {
  const { history, outgoing, advance, reset } = useFlowSimulator(nodes, edges)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-xs text-muted-foreground">
          Walks the current canvas — no backend calls, so you can try it before deploying.
        </p>
        <Button variant="ghost" size="sm" onClick={reset} title="Restart from the beginning">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 rounded-md border bg-muted/20 px-3 py-2">
        <div className="flex flex-col gap-2">
          {history.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">No nodes on the canvas yet.</p>
          )}
          {history.map(bubble => (
            <div
              key={bubble.id}
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                bubble.from === 'bot' && 'self-start bg-background border',
                bubble.from === 'user' && 'self-end bg-primary text-primary-foreground',
                bubble.from === 'system' && 'self-center bg-transparent text-muted-foreground italic',
              )}
            >
              {bubble.imageUrl && (
                <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ImageIcon className="h-3 w-3" /> {bubble.imageUrl}
                </div>
              )}
              {bubble.text}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="mt-2 space-y-1.5">
        {outgoing.length === 0 ? (
          <p className="text-center text-[11px] text-muted-foreground py-1">— end of flow —</p>
        ) : (
          outgoing.map(edge => (
            <Button
              key={edge.id}
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => advance(edge.id)}
            >
              {(edge.data as { event?: string } | undefined)?.event || 'continue'}
            </Button>
          ))
        )}
      </div>
    </div>
  )
}
