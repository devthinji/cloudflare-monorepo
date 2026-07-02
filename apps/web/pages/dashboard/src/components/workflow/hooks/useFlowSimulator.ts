import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'

export interface ChatBubble {
  id: string
  from: 'bot' | 'user' | 'system'
  text: string
  imageUrl?: string
}

interface NodeDataAny {
  kind?: 'stage' | 'transition' | 'message' | 'execute'
  label: string
  description?: string
  messageType?: 'text' | 'image'
  content?: string
  mediaUrl?: string
  action?: string
  [key: string]: unknown
}

function bubbleForNode(node: Node, id: string): ChatBubble | null {
  const data = node.data as NodeDataAny
  const kind = data.kind ?? 'stage'

  if (kind === 'message') {
    return data.messageType === 'image'
      ? { id, from: 'bot', text: data.content || data.label, imageUrl: data.mediaUrl }
      : { id, from: 'bot', text: data.content || `[${data.label}] — no reply text set` }
  }
  if (kind === 'execute') {
    return { id, from: 'system', text: `⚙ Running action: ${data.action || data.label}` }
  }
  // stage / transition — narrate the stage entry
  return { id, from: 'system', text: `→ Entered "${data.label}"${data.description ? ` — ${data.description}` : ''}` }
}

/** Client-side graph walker used to test a blueprint's conversation flow before it's deployed. */
export function useFlowSimulator(nodes: Node[], edges: Edge[]) {
  const findStart = useCallback(() => {
    const identify = nodes.find(n => (n.data as NodeDataAny).stage === 'identify')
    return identify?.id ?? nodes[0]?.id ?? null
  }, [nodes])

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(() => findStart())
  const [history, setHistory] = useState<ChatBubble[]>(() => {
    const startId = findStart()
    const startNode = nodes.find(n => n.id === startId)
    const bubble = startNode ? bubbleForNode(startNode, `start-${startNode.id}`) : null
    return bubble ? [bubble] : []
  })

  const outgoing = useMemo(
    () => edges.filter(e => e.source === currentNodeId),
    [edges, currentNodeId],
  )

  const reset = useCallback(() => {
    const startId = findStart()
    const startNode = nodes.find(n => n.id === startId)
    setCurrentNodeId(startId)
    const bubble = startNode ? bubbleForNode(startNode, `start-${Date.now()}`) : null
    setHistory(bubble ? [bubble] : [])
  }, [nodes, findStart])

  const advance = useCallback(
    (edgeId: string) => {
      const edge = edges.find(e => e.id === edgeId)
      if (!edge) return
      const eventLabel = (edge.data as { event?: string } | undefined)?.event || 'continue'
      const targetNode = nodes.find(n => n.id === edge.target)
      setHistory(prev => [
        ...prev,
        { id: `user-${Date.now()}`, from: 'user', text: eventLabel },
        ...(targetNode
          ? [bubbleForNode(targetNode, `node-${Date.now()}`)].filter((b): b is ChatBubble => b !== null)
          : []),
      ])
      setCurrentNodeId(edge.target)
    },
    [edges, nodes],
  )

  return { currentNodeId, history, outgoing, advance, reset }
}
