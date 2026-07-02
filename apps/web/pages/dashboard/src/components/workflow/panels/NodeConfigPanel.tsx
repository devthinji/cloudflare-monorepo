import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { BlueprintEvent } from '../types'
import ChatTestPanel from './ChatTestPanel'

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

interface NodeDataAny {
  kind?: 'stage' | 'transition' | 'message' | 'execute'
  stage?: string
  label: string
  description?: string
  subStages?: string[]
  condition?: string
  messageType?: 'text' | 'image'
  content?: string
  mediaUrl?: string
  action?: string
  params?: string
  [key: string]: unknown
}

interface NodeConfigPanelProps {
  nodes: Node[]
  edges: Edge[]
  selectedNode: Node | null
  selectedEdge: Edge | null
  onUpdateNode: (id: string, data: Partial<NodeDataAny>) => void
  onUpdateEdge: (id: string, data: Partial<{ event: string; guard: string }>) => void
}

export default function NodeConfigPanel({ nodes, edges, selectedNode: selectedNodeRaw, selectedEdge, onUpdateNode, onUpdateEdge }: NodeConfigPanelProps) {
  const selectedNode = selectedNodeRaw as Node<NodeDataAny> | null
  const patchNode = useCallback(
    (patch: Partial<NodeDataAny>) => {
      if (selectedNode) onUpdateNode(selectedNode.id, patch)
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

  const kind = selectedNode?.data.kind ?? (selectedNode ? 'stage' : undefined)

  return (
    <aside className="w-80 shrink-0 overflow-hidden border-l border-border bg-background p-3 flex flex-col">
      <Tabs defaultValue="inspector" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mb-3 w-full">
          <TabsTrigger value="inspector" className="flex-1">Inspector</TabsTrigger>
          <TabsTrigger value="test" className="flex-1">Emulator</TabsTrigger>
        </TabsList>

        <TabsContent value="inspector" className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {selectedNode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Node
                    <Badge variant="secondary" className="text-[10px]">{kind}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input value={selectedNode.data.label} onChange={e => patchNode({ label: e.target.value })} className="h-8 text-sm" />
                  </div>

                  {kind === 'stage' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={selectedNode.data.description ?? ''} onChange={e => patchNode({ description: e.target.value })} className="h-8 text-sm" />
                      </div>
                      {selectedNode.data.subStages && selectedNode.data.subStages.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Sub-stages</Label>
                          <div className="flex flex-wrap gap-1">
                            {selectedNode.data.subStages.map(s => (
                              <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {kind === 'transition' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Condition / guard</Label>
                      <Input
                        value={selectedNode.data.condition ?? ''}
                        onChange={e => patchNode({ condition: e.target.value })}
                        placeholder="e.g. paymentAmount >= skuPrice"
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                  )}

                  {kind === 'message' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Message type</Label>
                        <select
                          value={selectedNode.data.messageType ?? 'text'}
                          onChange={e => patchNode({ messageType: e.target.value as 'text' | 'image' })}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="text">Text</option>
                          <option value="image">Image</option>
                        </select>
                      </div>
                      {selectedNode.data.messageType === 'image' ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Image URL</Label>
                          <Input value={selectedNode.data.mediaUrl ?? ''} onChange={e => patchNode({ mediaUrl: e.target.value })} placeholder="https://..." className="h-8 text-sm" />
                          <Label className="text-xs">Caption (optional)</Label>
                          <Input value={selectedNode.data.content ?? ''} onChange={e => patchNode({ content: e.target.value })} className="h-8 text-sm" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Reply text</Label>
                          <textarea
                            value={selectedNode.data.content ?? ''}
                            onChange={e => patchNode({ content: e.target.value })}
                            rows={4}
                            placeholder="What the agent replies with…"
                            className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {kind === 'execute' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Action</Label>
                        <Input
                          value={selectedNode.data.action ?? ''}
                          onChange={e => patchNode({ action: e.target.value })}
                          placeholder="e.g. mpesa.stkPush"
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Params (JSON)</Label>
                        <textarea
                          value={selectedNode.data.params ?? ''}
                          onChange={e => patchNode({ params: e.target.value })}
                          rows={4}
                          placeholder='{"amount": "{{skuPrice}}"}'
                          className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </div>
                    </>
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
              <p className={cn('text-xs text-muted-foreground text-center py-8')}>
                Select a node or edge to edit its properties.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="test" className="flex-1 overflow-hidden">
          <ChatTestPanel nodes={nodes} edges={edges} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
