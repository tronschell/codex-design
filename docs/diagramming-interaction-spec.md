# Diagramming — interaction and visual refinement

> **Implementation update · October 15, 2026:** The editor now includes diagramming and application states. [Diagrams and application states](diagramming.md) is the current runtime/API guide. This document retains the historical concept, prototype, and design-board details; proposed behavior below is not the runtime contract.

Historical scope: design concept and isolated interaction prototype. The production implementation is documented in the current guide above.

Design project: `3e260fd8-2492-4468-9bc1-13b9cf5c308c` — **Codex Design — Diagramming**.
Refined board: `2bac4a90-ae5f-4a4e-8962-e6d5ac1ebb04` — **Diagram workspace · Refined flow**.
The original concept board remains available for comparison. This document refines the interaction contract in [diagramming-concept.md](./diagramming-concept.md).

## Visual direction

The diagram workspace always renders in dark mode, independent of the operating system theme. Use #171717 for the canvas and an explicit dark backdrop inside source-backed grid layers. Embedded source documents must support the host color scheme, and standalone HTML exports default to dark mode.

Keep the existing neutral, compact editor: 32px title bar, 31px floating toolbar, system typography, blue selection, dark canvas. Collapse Properties until it is needed. The smaller shape palette exposes recognizable stencils; the diagram receives the remaining width.

Use restrained category color in symbols, headings and connectors: blue sources, violet processing/models, green consumption. Node bodies stay neutral. Data cards have a recognizable symbol, a small kind label, a clear title and one metadata line. UML retains its real compartments and relation markers. Journey stages and roadmap lanes align as content structures; Venn circles retain circular geometry and legible overlap labels.

Controls are 24–32px high. Selection and connector focus are visible at all zoom levels. A subtle dot grid belongs to the diagram canvas only. The shared native title bar and refined toolbar are reusable project components. The refined board contains 22 static concept screens plus the isolated interaction lab. Labels, shapes and containers are native, separately editable layers; isolated vector paths and preview thumbnails remain source-backed SVG.

## Edge-to-port workflow

1. Hover near the perimeter to hint that the node can connect. Click its edge to reveal connection points on **all four sides**. Default rectangular cards expose three points per side (25%, 50%, 75%); do not use resize corners as connection points.
2. A point has a small visible circle and a larger pointer target. The selected node gets a compact Connect / Pin action strip. Clicking the body selects; dragging the body moves.
3. Click a port, then a target node or port; alternatively, drag from a port to a target. While connecting, show a live route preview, snap to nearby compatible target ports and reveal that target’s ports.
4. Drop or click onto empty canvas to open **Add next step** at the endpoint. The picker offers shapes appropriate to the current notation, search, and a name. Choosing a shape creates the node, its connection and any required spacing as one undoable change.
5. Escape cancels without saving a partial edge. Clicking an existing edge selects the connection, exposing label, direction, markers and route settings. Dragging an endpoint reconnects it; dragging a segment creates a manual waypoint in the production implementation.

For UML, perimeter handles are view routing anchors; an actual UML Port is a separately created semantic element. See diagramming-uml-spec.md for this distinction and specialized pin/message/time endpoints.

Avoid mode ambiguity: perimeter starts connection, body moves, explicit Resize mode changes size. The final implementation should keep screen-space hit targets independent of canvas zoom (minimum 24px desktop targets; larger touch targets) and reject incompatible typed relations with a visible explanation. Snapping must use endpoint identities, not pixel proximity stored as the relationship.

Keyboard proposal: select a node and press C or Enter to reveal ports; Tab through the available ports; Enter starts a connection. Move focus to a target and press Enter to attach. Expose an Add next step command in the same interaction state. Escape cancels. Undo/redo treats the gesture as one transaction. The prototype implements node/port focus, Enter to connect, Escape and undo, but does not implement every planned keyboard shortcut.

## Auto place is a mode

Show a persistent **Auto place on/off** control. New architecture/flow templates can start with it on. Imported or manually arranged diagrams should retain their existing positions until the user turns it on or chooses Arrange.

When on:
- Adding/removing a node or connection, completing a quick insert, or changing direction/spacing triggers a new arrangement.
- Run after the committed structural gesture, never during typing, selection changes or each drag frame.
- Reflow the affected region first. Preserve unrelated regions and the user’s mental map.
- Nodes marked Pin keep exact coordinates. Dragging a node with Auto place on pins it at the dropped location; explain this in the status message and provide Unpin.
- Connections stay attached during a drag. Expensive routing/layout runs after release.
- Present a small completion message with Undo. Undo restores the full prior graph geometry in one step; it does not immediately re-run the same arrangement.

Settings: Left to right / Top to bottom; Comfortable / Compact spacing; reduce crossings; preserve pinned nodes. **Arrange entire diagram** requests a broader pass. A future selection scope uses the selection plus connected boundary constraints. Make the active scope visible.

For a costly or large rearrangement, show a cancellable preview and explicit Apply. Small incremental changes can commit directly with Undo. Use short coordinated movement when feasible, honoring reduced motion; endpoints and labels must travel with their nodes, not lag behind.

## Layout and routing contract

“Optimal” means best candidate under the current constraints, not a promise that every graph can be crossing-free. Some topologies require crossings; pins, explicit ports and semantic order can also prevent a perfect result.

Production priority:
1. Respect semantic order, port constraints, pinned coordinates, container membership and fixed dates.
2. Avoid node overlaps and route segments through unrelated node bodies. Reserve corridors around shapes and labels.
3. Reduce crossings and overlapping unrelated routes.
4. Reduce unnecessary bends, wire length, and movement from the existing layout.

Keep placement separate from routing. A layered placement algorithm can rank nodes, reorder within layers and place components, followed by an orthogonal obstacle router. Explicit user-selected ports stay attached; automatically chosen ports may be reassigned only while remaining semantically compatible. Provide visible jump/bridge treatment when crossings remain. Manual waypoints need a lock/reset affordance.

A large layout job runs in a worker against a known document revision. Discard stale results, support cancellation, and commit positions, ports, routes and labels atomically. Pin constraints that cannot be satisfied should be explained rather than silently ignored. For cyclic graphs, process strongly connected groups and handle feedback edges deliberately.

The prototype uses bounded candidate enumeration (up to four nodes per layer and 4,096 candidates), ranks acyclic graphs, and scores overlap, conflicting routes, wire length and movement. Cycles retain the existing layer assignment. It uses simple orthogonal endpoint routing. It does **not** implement full obstacle avoidance, compound-graph layout, a globally optimal solver, arbitrary-scale placement or server persistence.

## Diagram-specific behavior

| Family | Placement and connection behavior |
| --- | --- |
| Architecture, data flow, ERD | Layered layout, typed ports, containment, orthogonal routes, cardinality/labels attached to edges. |
| UML class/object/component/deployment/package/composite structure/profile | Semantic stencil library and proper relationship markers; containers and hierarchy constrain placement. |
| UML activity/state machine/use case | Decision branches, swimlanes, state boundaries and semantic connector rules. |
| UML sequence/communication/timing/interaction overview | Separate adapters preserve occurrence order, explicit message numbering, interaction control flow and fixed time values respectively. Generic graph layout cannot override those semantics. |
| User journey | Reorder whole stages with their cells; add rows, evidence, touchpoints, pains and opportunities. Hypotheses stay labeled. |
| Roadmap | Preserve dates, lanes, milestones and fixed dates. Dependency routing changes around the timeline; arranging cannot silently change dates. |
| Venn/Euler | Preserve set membership/intersection meaning; reposition labels and circles using set-specific rules. Areas remain explicitly non-proportional unless actual proportional layout is implemented. |

The start screen exposes six families with real miniature previews. UML now has a catalog and a dedicated native example for each of all 14 requested types. The [UML specification](./diagramming-uml-spec.md) and [build registry](./diagramming-uml-catalog.json) define each type’s structured editing, notation checks and layout constraints. Those runtime capabilities remain planned; the example screens are design coverage.

## Refined canvas pages

| Page | Saved page ID | Purpose |
| --- | --- | --- |
| Start a diagram | page_418142a4-8eba-480c-8e64-5198743d1cec | Template picker and prompt/import entry |
| Connect from any edge | v2-page-architecture | Architecture and 12 visible perimeter ports |
| Add the next step | v2-page-next | Connector-to-empty-canvas quick insert |
| Auto place & routing | v2-page-layout | Persistent mode, constraints, settings and undo |
| UML · All diagram types | v2-page-uml-catalog | All seven structural and seven behavioral types with notation previews |
| UML · Class | v2-page-uml-class | Class compartments, multiplicity and relation markers |
| UML · Sequence | v2-page-uml-sequence | Lifelines, messages and ordered interaction fragment |
| User journey | v2-page-journey | Full-width stage matrix with explicit hypothesis |
| Roadmap | v2-page-roadmap | Dated swimlanes and attached dependencies |
| Venn & sets | v2-page-venn | Circular sets and selectable overlap |
| Try the workflow | v2-page-live | Isolated live interaction component |

Twelve additional dedicated UML example pages cover component, deployment, object, package, profile, composite structure, use case, activity, state machine, communication, interaction overview and timing. Their saved page IDs and requirements are in [diagramming-uml-spec.md](./diagramming-uml-spec.md).

On **Try the workflow**, double-click the selected live component to start it. The same prototype is supplied as a standalone `interaction-lab.html`. Its React source and Tailwind build script are included for handoff. The live component has local, ephemeral state and no network access. It does not mutate the surrounding native design or save into the production graph model.

Working prototype behavior:
- edge click reveals 12 ports; mouse drag or click-to-connect;
- target-node attachment and add-on-empty-canvas;
- automatic incremental arrangement after adding a connected node;
- move, pin/unpin, direction, spacing, Arrange, delete an edge, Undo and Reset;
- narrow desktop toolbar wrapping and visible focus states.

Planned only: production persistence and MCP graph operations, import/export parsers, full semantic validation, all diagram stencils, search-driven quick insert, reconnect/waypoint editing, zoom/pan, advanced routing, collaboration and large-graph performance.

## Verification and measured example

No tests were added or run. The standalone React/Tailwind prototype compiled successfully. Direct browser inspection covered edge click, all 12 ports, click-to-connect, connector drag to empty canvas, insertion with automatic arrangement, undo, and desktop/narrow desktop rendering. Native screen exports were visually inspected; connector aspect-ratio errors and an overflowing additional-node layout were corrected.

Measured demonstration workload: the same six-node/four-edge graph, left-to-right direction, Comfortable spacing, one pinned source, before and after toggling Auto place. A route conflict counts one pair of unrelated connectors if their rendered polyline segments properly cross or overlap collinearly by more than one diagram unit; shared endpoints are excluded.

| Measure | Before | After | Absolute change | Relative change |
| --- | ---: | ---: | ---: | ---: |
| Conflicting connector pairs | 2 pairs | 0 pairs | −2 pairs | −100% |
| Pinned source position | (74, 105) diagram px | (74, 105) diagram px | 0 px | 0% |

Method: read the prototype’s rendered conflict counter and node transforms through the isolated browser’s DOM during direct interaction, using its current polyline geometry. Practical effect: the two overlapping/crossed route pairs separate into clear parallel flows, while the pinned source stays fixed. This is a small demonstration, not a general performance benchmark. Layout latency and large-graph performance were not measured.

## Build sequence

1. Persist semantic graph nodes, ports, edges and layout settings. Expose the same atomic operations through MCP, history and the editor.
2. Implement the edge/port/quick-insert gesture state machine and attached endpoint rendering.
3. Add pins, bounded incremental placement, routing, cancellation, revision checks and undo.
4. Ship architecture/data, ERD and basic flow stencils. Implement all 14 UML types through the delivery packs in diagramming-uml-spec.md, alongside the structured planning editors.
5. Implement import/export with explicit fidelity reporting and graceful unsupported-shape handling.

Use Tailwind for new UI. Preserve the editor’s server revision model, comments, source and existing canvas hierarchy. The live prototype is reference material; its bounded layout code should not be mistaken for the final engine.

## Packaging note

The native component includes a rendered initial preview so it is useful before activation. The standalone prototype runs directly when opened. The packaged canvas HTML also includes a narrow export-only correction: set the iframe srcdoc before inserting the frame, so its initial blank load does not prematurely trigger the navigation reset. The host's production exporter at `shared/export.ts` was not modified; fresh HTML exports may need the same correction. The sandbox's navigation reset remains enabled.
