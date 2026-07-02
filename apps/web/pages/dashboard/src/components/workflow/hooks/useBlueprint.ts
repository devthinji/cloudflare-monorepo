import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { VisualBlueprint, VisualNodeDef, VisualEdgeDef, BlueprintEvent, NodeAction } from '../types'

interface NodeDataAny {
  stage?: string
  label: string
  description?: string
  subStages?: string[]
  actions?: NodeAction[]
  [key: string]: unknown
}

export function blueprintFromCanvas(
  id: string,
  version: number,
  agentSlug: string,
  nodes: Node[],
  edges: Edge[],
): VisualBlueprint {
  const vnodes: VisualNodeDef[] = nodes.map(n => {
    const d = n.data as NodeDataAny
    return {
      id: n.id,
      stage: (d.stage ?? 'identify') as VisualNodeDef['stage'],
      label: d.label,
      description: d.description,
      subStages: d.subStages,
      actions: d.actions,
      position: { x: n.position.x, y: n.position.y },
    }
  })

  const vedges: VisualEdgeDef[] = edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    event: (e.data?.event ?? 'CUSTOMER_REGISTERED') as BlueprintEvent,
    guard: e.data?.guard as string | undefined,
  }))

  return { id, version, agentSlug, nodes: vnodes, edges: vedges }
}

export function useBlueprintExport() {
  return useCallback(
    (id: string, version: number, agentSlug: string, nodes: Node[], edges: Edge[]) => {
      const bp = blueprintFromCanvas(id, version, agentSlug, nodes, edges)
      const json = JSON.stringify(bp, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${id}-v${version}.blueprint.json`
      a.click()
      URL.revokeObjectURL(url)
    },
    [],
  )
}

export function useBlueprintImport(
  onImport: (bp: VisualBlueprint) => void,
) {
  return useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.blueprint.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const bp: VisualBlueprint = JSON.parse(text)
        onImport(bp)
      } catch {
        alert('Invalid blueprint file')
      }
    }
    input.click()
  }, [onImport])
}

export function nodesFromBlueprint(bp: VisualBlueprint): Node[] {
  return bp.nodes.map(vn => ({
    id: vn.id,
    type: 'stage',
    position: vn.position,
    data: {
      stage: vn.stage ?? 'identify',
      label: vn.label,
      description: vn.description,
      subStages: vn.subStages,
      actions: vn.actions ?? [],
    },
  }))
}

export function edgesFromBlueprint(bp: VisualBlueprint): Edge[] {
  return bp.edges.map(ve => ({
    id: ve.id,
    source: ve.source,
    target: ve.target,
    data: { event: ve.event, guard: ve.guard },
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }))
}
