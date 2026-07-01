# Visual Workflow Builder — Implementation Tasklist

> **Source blueprint:** `docs/04_design/07-frontend-stack-blueprint.md`
> **Created:** 2026-07-01
> **Branch:** feat/e2e
> **Milestone:** Visual node editor for the ConversationMachine business logic
> **Completion:** 0 / 13 tasks (0%)

---

## Progress Tracker

```
[                  ] 0%
```

---

## Phase 0 — Setup (shadcn/ui + xyflow)

- [ ] Init shadcn/ui in dashboard (`npx shadcn@latest init`)
- [ ] Add shadcn components: `card`, `badge`, `button`, `input`, `label`, `separator`, `scroll-area`
- [ ] Add `cn()` utility to `src/lib/utils.ts`
- [ ] Create `src/components/ui/` with all initialized shadcn components
- [ ] `pnpm add @xyflow/react` —filter=@repo/web-dashboard
- [ ] Convert existing `input` and `Field` helpers in `AgentsPage.tsx` → shadcn `Input` + `Label`
- [ ] Convert existing buttons → shadcn `Button`

## Phase 1 — Foundation (canvas + first node)

- [ ] Create `src/components/workflow/WorkflowEditor.tsx` — React Flow canvas with zoom/pan/minimap
- [ ] Create `src/components/workflow/nodes/StageNode.tsx` — custom node using shadcn `Card` + `Badge`
- [ ] Create `src/components/workflow/WorkflowSidebar.tsx` — draggable palette populated from `MachineStage[]`
- [ ] Wire `onDrop` handler (sidebar → canvas creates nodes at drop position)
- [ ] Snap to grid: `snapGrid: [20, 20]`
- [ ] Verify: drag stages from sidebar, connect them with edges

## Phase 2 — Blueprint Serialization

- [ ] Create `hooks/useBlueprintExport.ts` — serialize RF nodes/edges → `VisualBlueprint` JSON
- [ ] Create `hooks/useBlueprintImport.ts` — parse JSON → RF nodes/edges
- [ ] Create `panels/BlueprintPreview.tsx` — read-only JSON panel using shadcn `ScrollArea`
- [ ] Wire save/load buttons → `POST/GET /api/v1/machine/blueprint/:version`

## Phase 3 — Node Configuration

- [ ] Create `panels/NodeConfigPanel.tsx` — side panel on node select (shadcn `Card` form)
- [ ] Add fields: stage name, description, messages (key-value editor)
- [ ] Add guard dropdown on edges (conditional branches)
- [ ] Color-code nodes by stage (blue/amber/indigo/green/gray)

## Phase 4 — Polish

- [ ] Animate default transition edges
- [ ] Add undo/redo (`@xyflow/undo` or custom)
- [ ] Keyboard shortcuts: Delete, Ctrl+S, Ctrl+Z
- [ ] Export blueprint as downloadable `.json`
- [ ] Import blueprint from file (drag & drop onto canvas)

---

## File creation order

```
 1. src/lib/utils.ts                          ← cn() utility
 2. src/components/ui/*                        ← shadcn components
 3. src/components/workflow/WorkflowEditor.tsx
 4. src/components/workflow/nodes/StageNode.tsx
 5. src/components/workflow/WorkflowSidebar.tsx
 6. src/components/workflow/panels/NodeConfigPanel.tsx
 7. src/components/workflow/panels/BlueprintPreview.tsx
 8. src/components/workflow/hooks/useBlueprintExport.ts
 9. src/components/workflow/hooks/useBlueprintImport.ts
10. src/components/workflow/hooks/useMachineBlueprint.ts
```

## References

- Blueprint doc: `docs/04_design/07-frontend-stack-blueprint.md`
- Machine types: `apps/api/gateway/src/machine/states/index.ts`
- Business logic: `apps/api/gateway/src/machine/steps/business-logic/version_1.ts`
- React Flow docs: https://reactflow.dev
- shadcn/ui: https://ui.shadcn.com
