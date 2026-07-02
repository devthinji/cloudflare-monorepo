import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import StageNode from './nodes/StageNode'
import type { StageNodeData } from './nodes/StageNode'
import WorkflowSidebar from './WorkflowSidebar'
import WorkflowToolbar from './WorkflowToolbar'
import NodeConfigPanel from './panels/NodeConfigPanel'
import { useBlueprintExport, useBlueprintImport, nodesFromBlueprint, edgesFromBlueprint } from './hooks/useBlueprint'
import { useBlueprintLoad, useBlueprintSave } from './hooks/useMachineBlueprint'
import { blueprintFromCanvas } from './hooks/useBlueprint'
import type { VisualBlueprint } from './types'

const DEFAULT_WORKFLOW_NODES: Node<StageNodeData>[] = [
  {
    id: 'identify',
    type: 'stage',
    position: { x: 80, y: 80 },
    data: {
      stage: 'identify',
      label: 'Identify',
      description: 'Detect whether the customer is new, returning, or already registered.',
    },
  },
  {
    id: 'auth',
    type: 'stage',
    position: { x: 320, y: 80 },
    data: {
      stage: 'auth',
      label: 'Auth',
      description: 'Ask for the customer name and validate it before continuing.',
    },
  },
  {
    id: 'collect',
    type: 'stage',
    position: { x: 560, y: 80 },
    data: {
      stage: 'collect',
      label: 'Collect',
      description: 'Collect the document fields, handle payment, and confirm generation.',
      subStages: ['sku_select', 'collection', 'naming', 'validation', 'transaction', 'transaction_validation', 'confirm_generation', 'generation', 'repetition_or_close'],
    },
  },
  {
    id: 'farewell',
    type: 'stage',
    position: { x: 800, y: 80 },
    data: {
      stage: 'farewell',
      label: 'Farewell',
      description: 'Wrap up the conversation and invite the user to continue later.',
    },
  },
  {
    id: 'closed',
    type: 'stage',
    position: { x: 1040, y: 80 },
    data: {
      stage: 'closed',
      label: 'Closed',
      description: 'The session is closed until the customer starts again.',
    },
  },
]

const DEFAULT_WORKFLOW_EDGES: Edge[] = [
  { id: 'edge_identify_auth',    source: 'identify', target: 'auth',     data: { event: 'CUSTOMER_NEW', guard: '' },        animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'edge_identify_collect', source: 'identify', target: 'collect', data: { event: 'CUSTOMER_REGISTERED', guard: '' }, animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'edge_auth_collect',     source: 'auth',     target: 'collect', data: { event: 'NAME_VALID', guard: '' },          animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'edge_collect_farewell', source: 'collect',  target: 'farewell', data: { event: 'DOC_READY', guard: '' },          animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
  { id: 'edge_farewell_closed',  source: 'farewell', target: 'closed',  data: { event: 'WANTS_TO_CLOSE', guard: '' },      animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } },
]

const nodeTypes: NodeTypes = {
  stage: StageNode,
}

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: '#94a3b8', strokeWidth: 2 },
}

interface WorkflowEditorProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  blueprintId?: string
  blueprintVersion?: number
  agentSlug?: string
}

export default function WorkflowEditor({
  initialNodes,
  initialEdges,
  blueprintId = 'custom',
  blueprintVersion = 1,
  agentSlug = 'taji',
}: WorkflowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? DEFAULT_WORKFLOW_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? DEFAULT_WORKFLOW_EDGES)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [undoStack, setUndoStack] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])
  const [redoStack, setRedoStack] = useState<{ nodes: Node[]; edges: Edge[] }[]>([])

  const blueprintLoad = useBlueprintLoad()
  const blueprintSave = useBlueprintSave()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pushSnapshot = useCallback(() => {
    setUndoStack(prev => {
      const next = [...prev, { nodes: [...nodes], edges: [...edges] }]
      if (next.length > 50) next.shift()
      return next
    })
    setRedoStack([])
  }, [nodes, edges])

  const handleUndo = useCallback(() => {
    const snapshot = undoStack[undoStack.length - 1]
    if (!snapshot) return
    setRedoStack(prev => [...prev, { nodes: [...nodes], edges: [...edges] }])
    setUndoStack(prev => prev.slice(0, -1))
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
  }, [undoStack, nodes, edges, setNodes, setEdges])

  const handleRedo = useCallback(() => {
    const snapshot = redoStack[redoStack.length - 1]
    if (!snapshot) return
    setUndoStack(prev => [...prev, { nodes: [...nodes], edges: [...edges] }])
    setRedoStack(prev => prev.slice(0, -1))
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
  }, [redoStack, nodes, edges, setNodes, setEdges])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.shiftKey ? handleRedo() : handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  // Load blueprint on mount
  useEffect(() => {
    const load = async () => {
      const blueprint = await blueprintLoad(agentSlug, blueprintVersion)
      if (blueprint) {
        setNodes(nodesFromBlueprint(blueprint))
        setEdges(edgesFromBlueprint(blueprint))
      }
    }
    load()
  }, [agentSlug, blueprintVersion, blueprintLoad, setNodes, setEdges])

  // Auto-save blueprint when nodes/edges change
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(async () => {
      const blueprint: VisualBlueprint = blueprintFromCanvas(blueprintId, blueprintVersion, agentSlug, nodes, edges)

      setSaveStatus('saving')
      const success = await blueprintSave(agentSlug, blueprintVersion, blueprint)
      if (success) {
        setSaveStatus('saved')
        setSaveError(null)
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
        setSaveError('Failed to save blueprint')
      }
    }, 1000) // Debounce for 1 second
  }, [nodes, edges, agentSlug, blueprintVersion, blueprintId, blueprintSave])

  const onConnect = useCallback(
    (params: Connection) => {
      pushSnapshot()
      const edge: Edge = {
        ...params,
        id: `edge_${Date.now()}`,
        data: { event: '', guard: '' },
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      }
      setEdges(eds => addEdge(edge, eds))
    },
    [pushSnapshot, setEdges],
  )

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/reactflow')
      const nodeType = event.dataTransfer.getData('application/reactflow-type') || 'stage'
      if (!raw || !reactFlowInstance) return

      const data = JSON.parse(raw)
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      pushSnapshot()

      const newNode: Node = {
        id: `node_${Date.now()}`,
        type: nodeType,
        position,
        data,
      }

      setNodes(nds => nds.concat(newNode))
    },
    [reactFlowInstance, pushSnapshot, setNodes],
  )

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
    setSelectedNode(selNodes[0] ?? null)
    setSelectedEdge(selEdges[0] ?? null)
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    setSelectedEdge(null)
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedNode(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }, [])

  const onNodesDelete = useCallback(() => {
    pushSnapshot()
  }, [pushSnapshot])

  const onEdgesDelete = useCallback(() => {
    pushSnapshot()
  }, [pushSnapshot])

  const handleUpdateNode = useCallback(
    (id: string, data: Record<string, unknown>) => {
      pushSnapshot()
      setNodes(nds =>
        nds.map(n => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
      )
    },
    [pushSnapshot, setNodes],
  )

  const handleUpdateEdge = useCallback(
    (id: string, data: Partial<{ event: string; guard: string }>) => {
      pushSnapshot()
      setEdges(eds =>
        eds.map(e => (e.id === id ? { ...e, data: { ...(e.data as object), ...data } as Record<string, unknown> } : e)),
      )
    },
    [pushSnapshot, setEdges],
  )

  const exportBlueprint = useBlueprintExport()
  const handleImport = useBlueprintImport((bp: VisualBlueprint) => {
    pushSnapshot()
    setNodes(nodesFromBlueprint(bp))
    setEdges(edgesFromBlueprint(bp))
  })

  return (
    <div className="flex flex-col h-full">
      <WorkflowToolbar
        onExport={() => exportBlueprint(blueprintId, blueprintVersion, agentSlug, nodes, edges)}
        onImport={handleImport}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        isSidebarOpen={isSidebarOpen}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        saveStatus={saveStatus}
        saveError={saveError}
      />
      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && <WorkflowSidebar />}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onSelectionChange={onSelectionChange}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              snapToGrid
              snapGrid={[20, 20]}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
              selectionOnDrag
              panOnDrag={[1, 2]}
            >
              <Controls />
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <MiniMap
                nodeStrokeColor="#6b7280"
                nodeColor="#e5e7eb"
                maskColor="rgba(0,0,0,0.08)"
                style={{ bottom: 10, right: 10 }}
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        <NodeConfigPanel
          nodes={nodes}
          edges={edges}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onUpdateNode={handleUpdateNode}
          onUpdateEdge={handleUpdateEdge}
        />
      </div>
    </div>
  )
}
