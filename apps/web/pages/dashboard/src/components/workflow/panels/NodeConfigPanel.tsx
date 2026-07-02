import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Trash2, ChevronUp, ChevronDown, MessageCircle, Image as ImageIcon, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BlueprintEvent, NodeAction, NodeActionType } from '../types'
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
  stage?: string
  label: string
  description?: string
  subStages?: string[]
  actions?: NodeAction[]
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

const ACTION_LABEL: Record<NodeActionType, string> = {
  say_text: 'Say Text',
  say_image: 'Say Image',
  execute_code: 'Execute Code',
}

const ACTION_ICON = { say_text: MessageCircle, say_image: ImageIcon, execute_code: Code2 }

export default function NodeConfigPanel({ nodes, edges, selectedNode: selectedNodeRaw, selectedEdge, onUpdateNode, onUpdateEdge }: NodeConfigPanelProps) {
  const selectedNode = selectedNodeRaw as Node<NodeDataAny> | null

  const patchNode = useCallback(
    (patch: Partial<NodeDataAny>) => {
      if (selectedNode) onUpdateNode(selectedNode.id, patch)
    },
    [selectedNode, onUpdateNode],
  )

  const actions = selectedNode?.data.actions ?? []

  const addAction = useCallback(
    (type: NodeActionType) => {
      const newAction: NodeAction = { id: `action_${Date.now()}`, type }
      patchNode({ actions: [...actions, newAction] })
    },
    [actions, patchNode],
  )

  const updateAction = useCallback(
    (id: string, patch: Partial<NodeAction>) => {
      patchNode({ actions: actions.map(a => (a.id === id ? { ...a, ...patch } : a)) })
    },
    [actions, patchNode],
  )

  const removeAction = useCallback(
    (id: string) => {
      patchNode({ actions: actions.filter(a => a.id !== id) })
    },
    [actions, patchNode],
  )

  const moveAction = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = actions.findIndex(a => a.id === id)
      const swapIdx = idx + dir
      if (idx < 0 || swapIdx < 0 || swapIdx >= actions.length) return
      const next = [...actions]
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      patchNode({ actions: next })
    },
    [actions, patchNode],
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
    <aside className="w-80 shrink-0 overflow-hidden border-l border-border bg-background p-3 flex flex-col">
      <Tabs defaultValue="inspector" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mb-3 w-full">
          <TabsTrigger value="inspector" className="flex-1">Inspector</TabsTrigger>
          <TabsTrigger value="test" className="flex-1">Emulator</TabsTrigger>
        </TabsList>

        <TabsContent value="inspector" className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {selectedNode && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Node</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input value={selectedNode.data.label} onChange={e => patchNode({ label: e.target.value })} className="h-8 text-sm" />
                    </div>
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-2">
                    <CardTitle className="text-sm">On Enter Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {actions.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">No actions yet — this node does nothing when entered.</p>
                    )}
                    {actions.map((a, i) => {
                      const Icon = ACTION_ICON[a.type]
                      return (
                        <div key={a.id} className="space-y-1.5 rounded-md border p-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-xs font-medium">{ACTION_LABEL[a.type]}</span>
                            <div className="ml-auto flex items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => moveAction(a.id, -1)}><ChevronUp className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === actions.length - 1} onClick={() => moveAction(a.id, 1)}><ChevronDown className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeAction(a.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>

                          {a.type === 'say_text' && (
                            <textarea
                              value={a.content ?? ''}
                              onChange={e => updateAction(a.id, { content: e.target.value })}
                              rows={2}
                              placeholder="What the agent says…"
                              className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          )}
                          {a.type === 'say_image' && (
                            <>
                              <Input value={a.mediaUrl ?? ''} onChange={e => updateAction(a.id, { mediaUrl: e.target.value })} placeholder="Image URL" className="h-7 text-xs" />
                              <Input value={a.content ?? ''} onChange={e => updateAction(a.id, { content: e.target.value })} placeholder="Caption (optional)" className="h-7 text-xs" />
                            </>
                          )}
                          {a.type === 'execute_code' && (
                            <>
                              <Input value={a.actionName ?? ''} onChange={e => updateAction(a.id, { actionName: e.target.value })} placeholder="e.g. mpesa.stkPush" className="h-7 text-xs font-mono" />
                              <textarea
                                value={a.params ?? ''}
                                onChange={e => updateAction(a.id, { params: e.target.value })}
                                rows={2}
                                placeholder='{"amount": "{{skuPrice}}"}'
                                className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </>
                          )}
                        </div>
                      )
                    })}

                    <div className="flex gap-1.5 pt-1">
                      <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={() => addAction('say_text')}>
                        <Plus className="h-3 w-3" /> Text
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={() => addAction('say_image')}>
                        <Plus className="h-3 w-3" /> Image
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={() => addAction('execute_code')}>
                        <Plus className="h-3 w-3" /> Code
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {selectedEdge && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Transition</CardTitle>
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
                    <Label className="text-xs">Condition (optional)</Label>
                    <Input
                      value={(selectedEdge.data as { guard?: string })?.guard ?? ''}
                      onChange={handleGuardChange}
                      placeholder='e.g. state.paymentAmount >= state.skuPrice'
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedNode && !selectedEdge && (
              <p className={cn('text-xs text-muted-foreground text-center py-8')}>
                Select a node or transition to edit its properties.
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
