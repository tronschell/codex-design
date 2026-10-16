# Diagrams and application states

Implemented in the editor and MCP runtime · October 15, 2026. This is the current behavior reference; the earlier concept documents preserve design exploration.

## Diagrams

Open **Diagram library** in the canvas toolbar. Choose a starter or blank diagram. The library, diagram frames, previews, and generated notation use explicit dark surfaces. The palette contains 49 original vector stencils with one consistent symbol system; no remote icon service is required.

| Family | Types |
| --- | --- |
| Technical and planning | Architecture, data architecture, flowchart, user journey, roadmap, Venn and sets |
| UML structural | Class, component, deployment, object, package, profile, composite structure |
| UML behavioral | Use case, activity, state machine, sequence, communication, interaction overview, timing |

Each family has its own palette, starter, and supported relationships. Notation includes classifier compartments and operations, interface symbols, deployment nodes, package tabs, ports and parts, actors, state pseudostates, lifelines, numbered messages, timing tracks, journey stages, and dated initiatives. Templates are editable examples, not simulations or semantic UML compilers.

Click a stencil then the canvas, or drag a stencil onto the diagram. Click a node edge to reveal attachment points; drag a point to another node, or click a point followed by a target. Dropping in empty space opens connected-node quick insert. Selecting an edge exposes endpoint handles for reconnecting it. Escape cancels. With a diagram element selected, C or Enter reveals ports; the port buttons support keyboard focus and activation.

Nodes expose twelve perimeter ports, reduced to four on very small screen silhouettes. Diamond paint, edge hit detection, port positions, nearest-port selection, and routing share the same geometry. Endpoints use stable node IDs, so moving or resizing a node retains its relationships. Orthogonal routing avoids element bounds when a route can be found; straight, curved, manual waypoint, role, multiplicity, and label controls are available in Properties.

### Arrangement

**Auto place** arranges after adding/removing elements or changing connections. That arrangement belongs to the same save and Undo entry. Manual node movement, resizing, and keyboard nudges pin the element. **Pin** toggles that constraint.

**Arrange** computes a preview with measured crossing counts and moved-node counts. Cancel keeps the saved diagram; Apply commits the proposed positions against the revision that was arranged. A newer revision invalidates an outstanding preview. Direction and spacing controls are persisted per frame.

Graph diagrams use ELK layered layout in a separate Node worker. Sequence, timing, journey, roadmap, and set diagrams have dedicated arrangements. Nested containers arrange from the inside out. Pinned and locked elements retain their positions. Layout seeks fewer crossings; it does not guarantee a globally optimal or crossing-free graph. A preview warns when its crossing count increases.

Current bounds: 750 visible elements per arrangement, a 15-second worker timeout, and a bounded orthogonal routing search. Large or highly constrained diagrams can retain crossings; manual waypoints, pins, and multiple frames remain useful.

## Stateful frames and components

Select a frame or component and open **States** in the Inspector. Add the membership preset or follow an existing context. The preset supplies membership, billing, and onboarding inputs; contexts also support custom choice, toggle, number, and text inputs.

**Preview** selects a named scenario or custom inputs. It resolves the existing frame in memory without duplicating nodes, changing the saved revision, or adding History entries. Compare with the base design, previous inputs, or a saved scenario. Yellow numbered outlines and the linked difference list identify **Added**, **Hidden**, **Changed**, and **Moved** nodes. Hidden content leaves a dashed ghost at its former position. Inspecting differences shows before/after values and the winning rule.

Preview is scoped to the current project, board, and page. Unrelated navigation clears it; History shows saved designs without application-state overrides. **Edit base** returns to ordinary editing. Base geometry/source edits are blocked while previewing; state definitions remain editable.

**Rules** defines conditions and property effects. Simple controls cover one equality condition and one representable effect. Compound conditions, multiple effects, and richer property patches use the full JSON editor. The current JSON text is authoritative in that mode: invalid drafts stay visible and cannot save. Rules that cannot be represented by simple controls stay in JSON, preserving all their properties.

**Context** edits variables, defaults, choice values, named scenarios, and forbidden combinations. Constraints reject impossible inputs before preview/save. Higher-priority rules win; overlapping writers at the same priority are rejected before an atomic save. Rules may target only their owning subtree. Conditions support equality, membership in a list, all, and any.

A component follows its containing frame's inputs unless a local input is pinned. Reusable component definitions retain their context and rules; instantiation and copying remap target IDs. Portable library and scoped exports include the context needed to resolve them.

Journey transitions attach a destination, optional guard, and input changes to an element. The destination frame must follow the same application-state context. **Follow journey** carries the current values, applies the transition changes, and focuses the destination frame, including across pages or boards. Preview sessions remain local to the current pane; they do not switch another chat's preview.

React source frames receive the resolved values in `props.canvasState`. Source code reads those props to choose its view. Native-node changes have individual yellow highlights; changes inside a React source frame are highlighted at the frame boundary.

### Persistence and export

The document remains the source of truth:

- Frame: `diagram: {kind, autoPlace, direction, spacing}`.
- Element: `diagramElement: {kind, pinned?, subtitle?, stereotype?, rows?, operations?, start?, end?, lane?, order?, color?}`.
- Connector: `diagramEdge: {from, to, kind, route, label?, startLabel?, endLabel?, waypoints?, sequence?, locked?}`.
- State owner: `applicationState: {name, variables, scenarios, constraints?}`.
- Following component/frame: `stateBinding: {contextNodeId, inputs?}`.
- Scoped behavior: `stateRules[]`; navigation: `journey`.

These are validated node fields, edited through the ordinary revision-checked transaction path. Schema limits include 32 inputs, 100 scenarios, and 200 rules per owner. See `shared/feature-schema.ts`, `shared/application-state.ts`, and `shared/diagrams.ts` for validation and resolution.

Static exports can render the selected scenario. The editor's **Export current state** option resolves it without yellow inspection overlays. Source/project backups retain the editable base and definitions. MCP HTML/React exports include an application-state descriptor when a scenario is requested; SVG exports contain the resolved drawing. Neither path modifies the saved design.

## Agent workflow

Reuse the existing canvas through `canvas_prepare_canvas`; call the host launcher only when it returns `action: "open"`. Diagram and state tools never open a pane themselves.

1. Read the current project/page IDs and revision. Call `canvas_list_diagram_types` for canonical family, stencil, and relationship IDs.
2. Create with `canvas_create_diagram`; edit nodes, connectors, pins, dates, and state metadata through `canvas_edit_project`.
3. Call `canvas_layout_diagram` for proposed operations and measured crossings; apply its operations with its returned revision. Previewing alone does not save.
4. Use `canvas_get_state_context` from any selected descendant, `canvas_edit_state` for revision-checked definition changes, and `canvas_preview_state` for resolved nodes and differences with provenance.
5. Export a scenario with `canvas_export_project`, including `pageId`, a static format, and `state: {frameId, scenarioId?, values?}`.

Example rule upsert, using IDs and revision read from the actual document:

```json
{
  "projectId": "project-id",
  "pageId": "page-id",
  "nodeId": "member-frame",
  "expectedRevision": 12,
  "edit": {
    "kind": "rule",
    "value": {
      "id": "paid-export",
      "name": "Show export for paid members",
      "enabled": true,
      "priority": 10,
      "when": {"key": "membership", "in": ["pro", "team"]},
      "effects": [{"targetNodeId": "export-button", "set": {"hidden": false}}]
    }
  }
}
```

The target must already exist inside the owning subtree. Define its base hidden state once; the rule reveals that same node.

## Verification and measurement

No tests, test fixtures, or test dependencies were added or run. Verification used TypeScript compilation, the production/widget build, direct Chromium interaction at 1440×900 and 390×844, and actual local MCP/API calls against an isolated synthetic review project.

Direct inspection covered all 20 saved starter families, port dragging and endpoint persistence, connection Undo, manual pinning, arrangement Preview/Cancel/Apply/Undo, rule creation and complex-rule preservation, invalid JSON saves, constraints, ambiguous priorities, named comparisons, cross-page journeys, History isolation, component capture/instantiation, portable exports, and scenario export without overlays. The synthetic project is not a default seed or packaged user data.

Measured layout workload: ten 220×130 service nodes in two columns, five reverse-order connections, no pinned nodes, RIGHT direction and comfortable spacing. The same geometry/router counted proper intersections before and after one worker layout on the same local runtime. Result: **4 → 0 crossings**, **−4 crossings (−100%)**; all ten nodes moved, producing unobstructed horizontal connections. Worker computation took **45 ms** in that observation, excluding startup and IPC. This is a single small workload, not a general speed or optimality claim.

State preview and scenario export held the saved revision at **25 → 25** in the direct API inspection. An invalid JSON Save held revision **32 → 32**, retained the typed text, and displayed the validation error. These observations measure non-mutation, not performance.

## Code and licensing

UI: `src/DiagramWorkspace.tsx`, `src/DiagramProperties.tsx`, `src/ApplicationStates.tsx`, `src/useApplicationPreview.ts`, and Tailwind-backed `src/diagramming.css`.

Shared model/rendering: `shared/diagram-*.ts`, `shared/diagrams.ts`, `shared/application-state*.ts`, and `shared/feature-schema.ts`. Layout and MCP registration: `server/diagram-layout*.ts` and `server/diagram-tools.ts`.

The runtime stencils are original vector work. ELK 0.12.0 is bundled under EPL-2.0 with its notice and license in `assets/diagram-nodes/`. The historical concept boards also contain credited Lucide assets; their notices remain bundled.
