import { useCallback, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { NodeAction } from '../types'

export interface ChatBubble {
  id: string
  from: 'bot' | 'user' | 'system'
  text: string
  imageUrl?: string
}

interface NodeDataAny {
  label: string
  description?: string
  actions?: NodeAction[]
  [key: string]: unknown
}

function bubblesForNode(node: Node, prefix: string): ChatBubble[] {
  const data = node.data as NodeDataAny
  const bubbles: ChatBubble[] = [
    { id: `${prefix}-enter`, from: 'system', text: `→ Entered "${data.label}"${data.description ? ` — ${data.description}` : ''}` },
  ]

  for (const action of data.actions ?? []) {
    if (action.type === 'say_text') {
      bubbles.push({ id: `${prefix}-${action.id}`, from: 'bot', text: action.content || '[empty text]' })
    } else if (action.type === 'say_image') {
      bubbles.push({ id: `${prefix}-${action.id}`, from: 'bot', text: action.content || '', imageUrl: action.mediaUrl })
    } else {
      bubbles.push({ id: `${prefix}-${action.id}`, from: 'system', text: `⚙ Running action: ${action.actionName || 'unnamed action'}` })
    }
  }

  return bubbles
}

/** Client-side graph walker used to test a blueprint's conversation flow before it's deployed. */
export function useFlowSimulator(nodes: Node[], edges: Edge[]) {
  const findStart = useCallback(() => {
    const identify = nodes.find(n => (n.data as { stage?: string }).stage === 'identify')
    return identify?.id ?? nodes[0]?.id ?? null
  }, [nodes])

  const [currentNodeId, setCurrentNodeId] = useState<string | null>(() => findStart())
  const [history, setHistory] = useState<ChatBubble[]>(() => {
    const startId = findStart()
    const startNode = nodes.find(n => n.id === startId)
    return startNode ? bubblesForNode(startNode, `start-${startNode.id}`) : []
  })

  const outgoing = useMemo(
    () => edges.filter(e => e.source === currentNodeId),
    [edges, currentNodeId],
  )

  const reset = useCallback(() => {
    const startId = findStart()
    const startNode = nodes.find(n => n.id === startId)
    setCurrentNodeId(startId)
    setHistory(startNode ? bubblesForNode(startNode, `start-${Date.now()}`) : [])
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
        ...(targetNode ? bubblesForNode(targetNode, `node-${Date.now()}`) : []),
      ])
      setCurrentNodeId(edge.target)
    },
    [edges, nodes],
  )

  return { currentNodeId, history, outgoing, advance, reset }
}
