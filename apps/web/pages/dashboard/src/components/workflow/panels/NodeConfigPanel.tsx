import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { StageNodeData } from '../nodes/StageNode'
import type { BlueprintEvent } from '../types'

const EVENTS: BlueprintEvent[] = [
  'CUSTOMER_NEW', 'CUSTOMER_RETURNING_UNREGISTERED', 'CUSTOMER_REGISTERED',
  'NAME_VALID', 'NAME_INVALID',
  'SKU_CHOSEN', 'SKU_NOT_CHOSEN',
  'FIELD_VALID', 'FIELD_INVALID', 'ALL_FIELDS_DONE',
  'NAME_PROVIDED',
  'SUMMARY_CONFIRMED', 'SUMMARY_REJECTED',
  'PAYMENT_INITIATED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'PAYMENT_SKIPPED',
  'CONFIRM_GENERATION', 'CANCEL_GENERATION',
  'DOC_READY', 'DOC_FAILED',
  'WANTS_ANOTHER', 'WANTS_TO_CLOSE',
]

interface NodeConfigPanelProps {
  selectedNode: Node<StageNodeData> | null
  selectedEdge: Edge | null
  onUpdateNode: (id: string, data: Partial<StageNodeData>) => void
  onUpdateEdge: (id: string, data: Partial<{ event: string; guard: string }>) => void
}

export default function NodeConfigPanel({ selectedNode, selectedEdge, onUpdateNode, onUpdateEdge }: NodeConfigPanelProps) {
  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedNode) onUpdateNode(selectedNode.id, { label: e.target.value })
    },
    [selectedNode, onUpdateNode],
  )

  const handleDescChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedNode) onUpdateNode(selectedNode.id, { description: e.target.value })
    },
    [selectedNode, onUpdateNode],
  )

  const handleEventChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (selectedEdge) onUpdateEdge(selectedEdge.id, { event: e.target.value })
    },
    [selectedEdge, onUpdateEdge],
  )

  const handleGuardChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedEdge) onUpdateEdge(selectedEdge.id, { guard: e.target.value })
    },
    [selectedEdge, onUpdateEdge],
  )

  return (
    <aside className="w-72 shrink-0 bg-background border-l border-border p-4 overflow-y-auto">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Properties</h3>
      <div className="space-y-4">
        {selectedNode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Node
                <Badge variant="secondary" className="text-[10px]">
                  {selectedNode.data.stage}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Label</Label>
                <Input value={selectedNode.data.label} onChange={handleLabelChange} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input value={selectedNode.data.description ?? ''} onChange={handleDescChange} className="h-8 text-sm" />
              </div>
              {selectedNode.data.subStages && (
                <div className="space-y-1">
                  <Label className="text-xs">Sub-stages</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.data.subStages.map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {selectedEdge && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Edge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Event</Label>
                <select
                  value={(selectedEdge.data as { event?: string })?.event ?? ''}
                  onChange={handleEventChange}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— select event —</option>
                  {EVENTS.map(ev => (
                    <option key={ev} value={ev}>{ev}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Guard (optional)</Label>
                <Input
                  value={(selectedEdge.data as { guard?: string })?.guard ?? ''}
                  onChange={handleGuardChange}
                  placeholder="e.g. isNameValid"
                  className="h-8 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedNode && !selectedEdge && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Select a node or edge to edit its properties.
          </p>
        )}
      </div>
    </aside>
  )
}
