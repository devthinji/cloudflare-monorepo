# Frontend Stack Blueprint — Visual Workflow Builder

> Status: **Blueprint** · Target: Dashboard `apps/web/pages/dashboard/`
> Context: Build a visual node-based editor for the ConversationMachine business logic
> (the 4-stage state machine in `apps/api/gateway/src/machine/steps/business-logic/`)

---

## Core Stack (locked)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **React 18** | Existing in dashboard, locked |
| Routing | **react-router-dom v6** | Existing |
| Build | **Vite 5 + TypeScript 5** | Existing |
| Styling | **Tailwind CSS 3 + shadcn/ui** | Existing |
| Icons | **lucide-react** | Existing |
| Class utils | **clsx + tailwind-merge** | Existing |

---

## Node Editor Library — `@xyflow/react` v12

**Recommendation: [@xyflow/react](https://reactflow.dev) (MIT, 8.35M weekly downloads)**

Used in production by: Stripe, Zapier, Typeform, Retool, n8n.

### Why not alternatives

| Library | Reason eliminated |
|---------|-------------------|
| **tldraw** | Free-form whiteboard, wrong paradigm. License requires watermark unless paid. |
| **@blocknote/react** | Rich text editor (Notion clone). Wrong category. |
| **beautiful-react-diagrams** | Abandoned since 2019 — 1K weekly downloads. |
| **react-dnd (custom)** | Primitives only — would reimplement everything React Flow gives free. |

### Why it fits

The ConversationMachine blueprint (`version_1.ts`) has a structure that maps 1:1 to React Flow concepts:

| Machine Concept | React Flow Mapping |
|----------------|-------------------|
| Stages (`identify`, `auth`, `collect`, `farewell`, `closed`) | **Nodes** — one node per stage |
| Sub-stages (`sku_select`, `collection`, `naming`, ...) | **Sub-nodes** inside a collect group, or separate nodes |
| Transitions (`CUSTOMER_NEW → 'auth'`) | **Edges** with labels showing the event |
| Guards (`isRegistered`, `hasLiveSKU`) | **Conditional edges** (branches from same node) |
| Messages / validators | **Node properties** — show in side panel on select |
| Blueprint JSON | **Serialized flow** — export/import as JSON |

### Key integrations

- **Custom nodes** are React components — use shadcn/ui `Card`, `Button`, `Badge` directly
- **Tailwind CSS** works out of the box (official example exists)
- **Zustand** (bundled with RF) for workflow state — consistent with existing patterns
- **pnpm + Turborepo** — install as workspace dependency, tree-shakes to ~40KB gzipped

### What you get for free

- Drag & drop from sidebar toolbar
- Snap to grid (configurable via `snapGrid` prop)
- Edge connections with animated arrows
- Minimap, zoom, pan
- Node selection, multi-select, keyboard shortcuts
- Custom node types (any React component)
- Edge labels and animated edges
- Export/import flow as JSON

---

## Component Architecture

### Proposed directory layout

```
src/
  components/
    workflow/                    ← NEW: visual workflow builder
      WorkflowEditor.tsx         ← main canvas (React Flow wrapper)
      WorkflowSidebar.tsx        ← drag source toolbar (stages to drop)
      nodes/
        StageNode.tsx            ← default stage node (custom React Flow node)
        SubStageNode.tsx         ← sub-stage node for collect sub-states
        StartNode.tsx            ← entry point (small, circular)
        EndNode.tsx              ← terminal (farewell/closed)
      panels/
        NodeConfigPanel.tsx      ← right-side panel: edit selected node's props
        EdgeConfigPanel.tsx      ← right-side panel: edit selected edge's event
        BlueprintPreview.tsx     ← JSON view of the current blueprint
      hooks/
        useBlueprintExport.ts    ← serialize canvas → blueprint JSON
        useBlueprintImport.ts    ← parse blueprint JSON → RF nodes/edges
        useMachineBlueprint.ts   ← load/save via API to gateway
```

### Node types (visual mapping)

```
  [ START ] ─── CUSTOMER_NEW ───→ [ IDENTIFY ] ─── CUSTOMER_REGISTERED ───→ [ AUTH ]
                                      │
                                      ├── CUSTOMER_NEW ───────────────→ [ COLLECT ]
                                      │                                    │
                                      └── CUSTOMER_RETURNING_UNREGISTERED ──→ [ COLLECT ]
                                                                              │
                                                                        ┌─────┴──────┐
                                                                        │ sku_select │ ...
                                                                        │ collection │
                                                                        │  naming    │
                                                                        │ validation │
                                                                        └─────┬──────┘
                                                                              │
                                                                        [ FAREWELL ] ──→ [ CLOSED ]
```

### Visual style per stage

| Stage | Color | Icon | Shape |
|-------|-------|------|-------|
| `identify` | Blue | `UserSearch` | Rounded rect |
| `auth` | Amber | `Shield` | Rounded rect |
| `collect` | Indigo | `ClipboardList` | Large group node with sub-nodes inline |
| `farewell` | Green | `Wave` | Rounded rect |
| `closed` | Gray | `Circle` | Small circle (terminal) |
| Sub-steps | Slate | — | Compact pills inside collect |

---

## Data Flow

```
WorkflowEditor (React Flow canvas)
    │
    ├── serialize to BlueprintNode[] + BlueprintEdge[]
    │       │
    │       ▼
    │   useBlueprintExport() → version_1.ts format
    │       │
    │       ▼
    │   POST /api/v1/machine/blueprint/:version   ← save to gateway
    │
    └── deserialize from version_1.ts format
            │
            ▼
        useBlueprintImport() → RF nodes + edges
            │
            ▲
        GET /api/v1/machine/blueprint/:version    ← load from gateway
```

Blueprint JSON format (mapping to `version_1.ts`):

```typescript
interface VisualBlueprint {
  version: string
  nodes: {
    id: string
    type: 'start' | 'stage' | 'substage' | 'end'
    position: { x: number; y: number }
    data: {
      stage: string
      label: string
      description?: string
      messages: Record<string, string>         // from messages{}
      validators?: Record<string, ValidatorDef> // from validators{}
    }
  }[]
  edges: {
    id: string
    source: string
    target: string
    label: string                              // event name from transitions{}
    guard?: string                             // condition from guards{}
    animated?: boolean
  }[]
}
```

---

## Phased Implementation Plan

### Phase 1 — Foundation (1-2 days)

- [ ] Install `@xyflow/react` as workspace dependency in `apps/web/pages/dashboard`
- [ ] Create `WorkflowEditor.tsx` — basic React Flow canvas with zoom/pan/minimap
- [ ] Create `StageNode.tsx` — custom node component styled with Tailwind + shadcn
- [ ] Create `WorkflowSidebar.tsx` — drag source toolbar populated from `MachineStage[]`
- [ ] Wire drag from sidebar → drop onto canvas (React Flow `onDrop` handler)
- [ ] Add snap-to-grid (`snapGrid: [20, 20]`)
- [ ] Verify: can drag stages from sidebar, connect them with edges

### Phase 2 — Blueprint Serialization (1 day)

- [ ] Create `useBlueprintExport.ts` — serialize RF nodes/edges → `VisualBlueprint` JSON
- [ ] Create `useBlueprintImport.ts` — deserialize JSON → RF nodes/edges
- [ ] Create `BlueprintPreview.tsx` — read-only JSON panel
- [ ] Add load/save buttons connected to `GET/POST /api/v1/machine/blueprint/:version`

### Phase 3 — Node Configuration (1-2 days)

- [ ] Create `NodeConfigPanel.tsx` — side panel that opens when a node is selected
- [ ] Add fields: stage name, description, messages (key-value editor)
- [ ] Add validators editor for collect-stage nodes
- [ ] Add guard dropdown on edges (conditional branches)

### Phase 4 — Polish & Integration (1 day)

- [ ] Color-code nodes by stage type
- [ ] Animate edges (`animated: true`) for default transitions
- [ ] Add undo/redo (via `@xyflow/undo` package or custom)
- [ ] Keyboard shortcuts: Delete to remove, Ctrl+S to save, Ctrl+Z to undo
- [ ] Export blueprint as downloadable JSON file
- [ ] Import blueprint from JSON file (drag & drop onto canvas)

---

## Edge & Guard Visualization

Edges should show both the event name and guard condition:

```
    ┌──────────┐
    │ COLLECT  │
    └────┬─────┘
         │
    [PAYMENT_COMPLETED]     ← event label on edge
         │ when: isActive    ← guard condition (small text)
         ▼
    ┌──────────┐
    │ FAREWELL │
    └──────────┘
```

Implementation: React Flow's `<BaseEdge>` + `<EdgeLabelRenderer>` for custom label rendering.

---

## Guard Branches

A single node can have multiple outgoing edges with different guards:

```
    ┌──────────┐
    │ COLLECT  │
    └────┬─────┘
         │
    ┌────┴────┐───────────┐
    │ PAYMENT │ SKU_CHOSEN│ SKU_NOT_CHOSEN
    │COMPLETED│           │
    │         │           │
    ▼         ▼           ▼
  FAREWELL  COLLECT    COLLECT
            (payment)  (sku_select)
```

Visual: blue edges for success paths, amber for retry, red for failure/exit.

---

## shadcn/ui Component Usage

Custom nodes should be built from existing dashboard components:

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function StageNode({ data }: { data: StageNodeData }) {
  return (
    <Card className="w-56 shadow-md border-l-4 border-l-blue-500">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{data.label}</CardTitle>
          <Badge variant="outline" className="text-[10px]">{data.stage}</Badge>
        </div>
      </CardHeader>
      {data.description && (
        <CardContent className="px-3 pb-2 pt-0">
          <p className="text-xs text-muted-foreground">{data.description}</p>
        </CardContent>
      )}
    </Card>
  )
}
```

---

## Task List — Next Actions

### Immediate (research complete, ready to build)

```
[ ] pnpm add @xyflow/react —filter=@repo/web-dashboard
[ ] Create src/components/workflow/ directory
[ ] Scaffold WorkflowEditor.tsx with basic React Flow instance
[ ] Scaffold StageNode.tsx using shadcn Card
[ ] Scaffold WorkflowSidebar.tsx with draggable stage items
[ ] Wire onDrop handler to create nodes from sidebar
[ ] Set snapGrid: [20,20], fitView on load, MiniMap
```

### Short-term (after foundation)

```
[ ] Create blueprint serialization hooks
[ ] Create NodeConfigPanel.tsx
[ ] Add edge label rendering (event names + guards)
[ ] Color-code nodes by stage
[ ] Save/Load blueprint via API
```

### Future

```
[ ] Undo/redo support
[ ] Auto-layout using dagre
[ ] Keyboard shortcuts
[ ] JSON import/export files
[ ] Version history (compare blueprints)
```

---

## References

- React Flow docs: https://reactflow.dev
- Tailwind + React Flow example: https://reactflow.dev/examples/styling/tailwind
- Custom nodes guide: https://reactflow.dev/examples/nodes/custom-node
- Edge labels: https://reactflow.dev/examples/edges/edge-label-renderer
- Machine blueprint: `apps/api/gateway/src/machine/steps/business-logic/version_1.ts`
- Machine types: `apps/api/gateway/src/machine/states/index.ts`
