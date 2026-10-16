# Codex Design · Diagram workspace

Existing editor chrome plus proposed native diagramming patterns.

<!-- codex-design:documentation -->

# Diagramming in Codex Design

Concept and implementation brief · October 15, 2026

## Product decision

Add native diagrams to the existing canvas. A diagram is a typed frame within the current Project → Board → Page hierarchy. Interface designs, technical diagrams and planning artifacts can sit together and link to one another.

Retain the editor people already use: dark canvas, compact toolbar, resizable Inspector, Layers, comments, history, autosave, Components and MCP editing. A Diagram toolbar menu opens creation/templates and the selected diagram's notation library. The existing page selector remains available. Do not replace the editor with an embedded drawing application or introduce a second document/history system.

This is an editable visual concept and proposed behavior. The current application has general design nodes; the connected shapes, notation editors and imports described below are not implemented by this design task.

The refined board adds the interaction workflow and now includes a catalog plus dedicated examples for all 14 UML types. See [diagramming-interaction-spec.md](./diagramming-interaction-spec.md), [diagramming-uml-spec.md](./diagramming-uml-spec.md) and the [per-type build registry](./diagramming-uml-catalog.json).

## Original review map

| Page | What to assess |
| --- | --- |
| 01 · Start a diagram | Explicit creation dialog, template search, family navigation, Describe and Import entry points |
| 02 · Data architecture | Sources, processing boundary, lineage, attached ports, orthogonal route and data-contract Inspector |
| 03 · UML structure | Class compartments, typed members, cardinality, composition and dependency |
| 04 · UML interaction | Lifelines, activations, messages, reply notation and guarded fragment |
| 05 · User journey | Stage matrix, typed content, hypotheses, evidence and optional confidence curve |
| 06 · Roadmap | Date-based initiatives, lanes, milestones, dependencies and timeline/Now–Next–Later views |
| 07 · Venn & sets | Sets, selected intersection, members and explicitly non-proportional areas |

All sample system, persona and roadmap content is illustrative. Roadmap dates are not delivery estimates. Journey statements are hypotheses, not reported research findings.

## Entry and workspace

1. Choose Diagram → New diagram, or choose a diagram when creating a page.
2. Start blank, choose a template, describe an outcome, or import supported content.
3. Template selection shows its shape family and a preview. Creation inserts editable content as one undoable transaction.
4. A 200px collapsible library holds searchable stencils. More libraries enables additional notation in the same diagram. Search results carry library names and keyboard-place/drag affordances.
5. Select a shape, connection, journey cell, initiative or set region to reveal relevant properties in the existing Inspector. Preserve Properties / Code / Tweaks; show only controls the selected family actually supports.
6. Auto layout is scoped to the current diagram or selection. Show the proposed layout before committing; pinned objects and authored routes are preserved unless the person explicitly unlocks them.
7. Export uses the existing panel and clear selection/diagram/page/board scope.

The chooser opens only after a deliberate creation action. A fresh canvas remains blank. No permanent welcome panel or floating AI prompt occupies it.

Below about 1100px, collapse the shape library into a popover first. Retain the existing Inspector's 260–640px resize behavior; at narrow widths show either palette or Inspector as a drawer. Canvas navigation remains pan/zoom. The delivered mockups are 1440×900 desktop states; narrow layouts are specified, not visually mocked here.

## Diagram family coverage

| Family | Proposed coverage | Specialized editing |
| --- | --- | --- |
| Architecture | System context, container/component views, deployment, infrastructure, cloud/network and integration maps | Boundaries, roles, ports, protocols, ownership, linked detail views |
| Data | Conceptual/logical/physical ERD, pipelines, lineage and data-flow diagrams | Tables, stable field IDs, PK/FK, nullability, cardinality, datasets and schema contracts |
| UML | All 14 diagram types listed below | Notation-specific symbols and properties; deeper semantics phased |
| Flows | Flowcharts, decision trees, swimlanes and user flows | Decisions, guarded branches, lanes and labels |
| Journeys | User/customer journeys and service blueprints | Stages, actions, thoughts, touchpoints, emotion/confidence, evidence and opportunities |
| Roadmaps | Timeline, release plans, milestones and Now–Next–Later | Dates, lanes, owner, status, dependencies and scheduling warnings |
| Sets | Two/three-set Venn and Euler-style relationships | Set/member identity, union, intersection, difference and universe |
| Additional packs | Mind maps, org charts and BPMN notation | Extend the registry only when the family has real insertion, editing and export support |

BPMN notation is a future pack, not a claim of executable BPMN or complete standard conformance. Four-plus-set analysis should use an appropriate alternative layout rather than unreadable overlapping circles.

### All 14 UML types

Structure: class, object, component, composite structure, package, deployment, profile.

Behavior: activity, use case, state machine, sequence, communication, interaction overview, timing. The last four are interaction diagrams.

This coverage follows [draw.io's UML overview](https://www.drawio.com/blog/uml-2-5/) and the [OMG UML 2.5.1 specification reference](https://www.omg.org/spec/UML/2.5.1/About-UML). The specification is the authority for notation details during implementation.

| Type | Necessary content beyond basic boxes |
| --- | --- |
| Class | Compartments, member visibility/types, association ends, multiplicity, generalization and aggregation/composition |
| Object | Instance labels, slots, values and links |
| Component | Provided/required interfaces, ports and dependencies |
| Composite structure | Parts, ports, roles and internal connectors |
| Package | Package nesting, imports and merge relationships |
| Deployment | Nodes/devices/environments, artifacts and deployment relationships |
| Profile | Profiles, stereotypes, metaclasses, tagged values and extension notation |
| Activity | Actions, control/object flows, decisions, fork/join, partitions and initial/final nodes |
| Use case | Actors, use cases, system boundaries, include/extend and generalization |
| State machine | States, events/guards/effects, transitions, regions, history and pseudostates |
| Sequence | Lifelines, ordered messages, activation, creation/destruction, guards and combined fragments |
| Communication | Participants, links and message numbering |
| Interaction overview | Control flow between interactions and referenced sequences |
| Timing | Lifeline/state tracks, time constraints and ordered changes |

All 14 types now have dedicated native example screens on the refined board, with explicit notation-aware layout and editing requirements in [diagramming-uml-spec.md](./diagramming-uml-spec.md). The [JSON registry](./diagramming-uml-catalog.json) records the planned elements, relationships, inspectors, layout constraints and validation per type. It is design handoff data, not a runtime implementation.

Do not market “all UML supported” when only generic stencils exist. Track each family separately as stencil coverage, structured editing, notation validation and import/export coverage.

## Shared interaction contract

### Shapes and connectors

- Drag or keyboard-place a shape. Double-click edits its label; structured content opens a member/cell editor. A shape replacement preserves ID, notes, links, compatible ports and connected edges.
- Hover/selection reveals port handles. Drag a port to a compatible destination or use Connect in the toolbar. Click-to-connect supports keyboard operation. Escape cancels without saving.
- A connection stores endpoint references, route mode, manual waypoints, start/end markers, semantic kind and independent labels. Visual position is derived from endpoint geometry.
- Support straight, orthogonal and curved routing, self-loops and parallel edges. End markers include open/filled arrows, generalization triangles, open/filled diamonds and ERD crow's feet.
- Moving/resizing a node recomputes attached endpoints and routes. Moving a container carries children once. Collapsed boundaries retain external connections through explicit boundary ports.
- Invalid connections show a reason and a non-color cue. Notation checks warn without blocking intentional sketching unless graph integrity would break.
- Deleting a node removes its incident connectors in the same undoable operation. Undo restores them and their notes. A conversion to an intentional dangling endpoint is explicit.
- Duplicating a diagram remaps all internal node, port and member IDs. External connections are not silently copied to unrelated content. Partial copying must disclose dropped external relationships.
- Cross-page relationships are navigable references initially; a continuous physical wire across pages is out of scope.
- Drag previews are local; commit one transaction on release. Existing 650ms autosave applies to text/fields. Preserve failed drafts and require explicit resolution of real revision conflicts.

### Semantic editors

ERD: fields and PK/FK references have stable IDs; relationships can attach to rows. Moving a field keeps its foreign-key connection. “Import schema” must identify its source and show unmapped types before creating content.

UML: render relationships from semantic kinds, not user-selected decorative arrowheads alone. Class rows have separate visibility/name/type fields. Sequence message order drives vertical placement and activation/fragment geometry. Preserve explicit guards and reply kinds; no pretend UML execution engine.

Journeys: stage reorder carries every row cell. Support optional rows, evidence links and hypothesis/observed labels. The confidence curve can be hidden and must distinguish hypotheses from measured research. Opportunities may link to roadmap items or design frames.

Roadmaps: date geometry derives from stored dates. In Now–Next–Later mode, preserve dates even when the view does not show them. Moving work warns about dependency conflicts; cascading rescheduling requires a reviewed explicit action. Never silently change an owner's committed date.

Sets: region membership derives from stable set and member IDs. A member belongs to one or more sets. Selection targets the set or exact region expression. Default display is conceptual; do not imply circle area matches counts. Quantitative area layout is a separate later capability with clear approximation limits.

### Accessibility and state

Keep existing canvas focus and navigation shortcuts. Assign a new connection shortcut only after auditing the current shortcut map; do not steal comment, typing or operating-system keys. Give connectors generous screen-space hit targets independent of their visual 1–2px stroke.

Expose objects and relationships as a keyboard-navigable tree/list with names, roles and endpoint descriptions. Every drag operation needs an Inspector or keyboard equivalent. Provide visible focus, textual validation, high-contrast labels, pattern/marker differentiation and reduced-motion behavior.

No-results states offer clearing filters or enabling another library. Invalid imports retain the file/pasted text and list specific issues. Long layout/import/generation operations expose cancellation and truthful progress. Existing diagrams stay intact until a reviewed import/layout is applied.

## Describe with Codex

Describe belongs in the creation dialog and the existing anchored comment workflow. Examples: “Map the checkout services and event flow” or “Add the timeout branch to this sequence.”

Use the current host/agent bridge. When immediate delivery is unavailable, show queued state and a copyable request. Do not claim generation is running merely because a request was saved. Generated output is native typed nodes/edges plus explicit assumptions, not a full-diagram SVG/HTML image.

An edit request includes selected semantic objects, relevant neighbors and incident connections. Codex returns revision-checked operations scoped to that selection. Preserve IDs, user labels, notes and manual routes unless the request changes them. Show the proposed result and destructive scope before applying a broad replacement; use one undo boundary per accepted change.

The Code tab can expose the native diagram data and supported textual representations. Mermaid/PlantUML are optional import/export adapters. A text edit with lossy conversion produces an explicit preview/mapping report; it never silently replaces the richer native document. No lossless round-trip promise.

## Imports and exports

| Format | Contract |
| --- | --- |
| Native Codex Design JSON | Preserve supported typed content, positions, IDs, annotations and templates through the existing versioned project export |
| SVG / PNG | Clean artwork without editor chrome; use portable SVG primitives for diagrams where possible |
| PDF | Later export adapter, clearly disabled until implemented |
| Mermaid | Explicitly listed supported families/features; retain original text and report unsupported constructs |
| PlantUML | Later adapter, with the same coverage/loss reporting |
| draw.io XML / .drawio | Later migration path; parse a supported subset, report unmapped stencils/styles/links and preserve the original import |
| SQL DDL / schema | Data-model adapter with reviewed entity/field mapping; no database mutation |

Imported diagram content is data: bound resource sizes, reject scripts/external execution, sanitize links, and provide warnings without silently dropping meaning. An SVG import alone is a visual object unless it has been mapped into editable semantic shapes. Current canvas map SVG uses foreignObject; it is not proof of portable diagram SVG support.

## How this fits the codebase

Observed from /Users/tronschell/Documents/codex-design:

- shared/types.ts currently defines frames, text, rectangle, ellipse, line, arrow, code and media nodes. Line/arrow nodes are visual objects without endpoint/port references.
- shared/validation.ts validates persisted nodes, operations and project size.
- server/store.ts and server/mcp.ts provide the shared revisioned document and typed mutation boundary.
- src/App.tsx owns the canvas tools and shell. src/DesignNode.tsx renders the current native node tree.
- src/Inspector.tsx, src/SelectionToolbar.tsx and src/useProject.ts provide existing editing/save conventions.
- shared/export.ts, shared/export-formats.ts and src/ExportPanel.tsx provide export surfaces.
- src/clipboard.ts explicitly remaps and validates the copied hierarchy; diagram references will need corresponding remapping.
- shared/snapping.ts is the existing alignment foundation. It is not an obstacle-avoiding edge router.

### Proposed model extension

Extend the existing native document; keep a single authoritative set of node IDs and coordinates.

- Diagram root: an existing frame with optional diagram metadata containing family, notation version, library IDs and layout settings.
- Diagram shape: typed shape metadata, stable semantic fields/compartments and ports on a node. Geometry remains in existing x/y/width/height.
- Connector: a new node kind with typed source/target endpoints, semantic relationship, markers, labels and routing. Endpoints reference actual node/port/member IDs. Store authored waypoints; derive automatic routes.
- Family data: sequence order/fragments, journey stage/row/cell IDs, roadmap dates/dependencies, or set/member IDs. Avoid a second detached scene graph with duplicate coordinates.
- Template registry: versioned native template data with family, search terms, stencil definitions, default styles, validators and export capability declarations.
- References: same-document links to design frames, notes and related diagrams; preserve existing conversations and history.

### Proposed modules and responsibilities

| Area | Implementation direction |
| --- | --- |
| shared/types.ts + shared/validation.ts | Add versioned optional metadata, shape/port/edge types and referential integrity checks; old documents remain valid |
| shared/diagrams/model.ts | Proposed new semantic helpers and endpoint/member reference resolution |
| shared/diagrams/notation.ts | Proposed registry of family-specific symbols, markers, properties and validation rules |
| shared/diagrams/routing.ts | Proposed shared path/anchor calculations; interactive preview and export use the same geometry |
| shared/diagrams/layout.ts | Proposed layout adapter; deterministic positions, pin handling and cancellation |
| shared/diagrams/templates.ts | Proposed native starter templates and library metadata |
| src/DiagramPalette.tsx + src/DiagramInspector.tsx | Proposed contextual components styled with Tailwind and existing field primitives |
| src/DiagramConnections.tsx | Proposed SVG connection layer with screen-space hit regions and selection handles |
| src/App.tsx + src/DesignNode.tsx | Integrate connection gestures and typed rendering with existing selection, zoom, clipping and transforms |
| server/store.ts + server/mcp.ts | Add the same diagram mutations and context for browser and agent clients, with atomic saves |
| src/clipboard.ts | Remap ports, members, relationships and family references when pasting |
| shared/export.ts + ExportPanel | Semantic visual export and explicit adapter availability |

The proposed new files do not exist yet. Keep the current canvas engine. Evaluate an isolated graph-layout library only if a bounded prototype shows it handles compound groups, pinned nodes and stable routes better than a small shared implementation. Do not introduce a second canvas framework merely to obtain connectors.

### MCP parity

Every user action must be available through the existing revision-checked operation boundary. Proposed operations include create_diagram, create_diagram_shape, connect_nodes, update_connector, update_diagram_member and apply_diagram_layout; names are design suggestions, not tools available today.

Read context must include incident edges, ports, semantic fields, family constraints and layout ownership. Multi-object operations validate all references and save atomically. Export, undo/history, comments and source must preserve those records. A connector should be a valid comment target just like a shape.

## Build order

| Phase | Concrete exit condition |
| --- | --- |
| 1 · Connector foundation | Attached endpoints, ports, labels/markers, route handles, undo, copy/paste, comments, persistence, SVG/PNG export and MCP parity work for a small flowchart/data pipeline |
| 2 · Architecture, ERD and UML basics | Architecture boundaries, typed ERD fields/cardinality, class compartments, activity/state/use-case notation, template browser and palette are editable |
| 3 · Complete UML catalog | Remaining structure and interaction packs have explicit coverage; sequence, communication, timing and interaction-overview constraints are implemented before full-support claims |
| 4 · Product planning | Journey matrices/evidence, semantic timeline/Now–Next–Later and two/three-set Venn/Euler editing ship on the same document model |
| 5 · Interchange and deeper automation | Reviewed draw.io/Mermaid/PlantUML/schema adapters, user templates and robust generation/edit previews |

All 14 structured diagram types remain in scope. Implement them through the explicit delivery packs in diagramming-uml-spec.md; the catalog must distinguish designed examples from available runtime capabilities. The first build milestone should be moving a source node while its labeled connection stays attached, then saving/reopening and editing that same connection through MCP.

## Verification approach

Honor the standing no-tests preference: do not add, generate or run tests. During implementation, use compilation/builds and direct inspection of creation, reconnect/move, nested boundaries, undo, copy/paste, reload, export, keyboard use and matching MCP operations.

If performance becomes part of the work, record measured before/after values under the same diagram/workload, with units, absolute and percentage change, and practical effect. This concept makes no measured speed or memory claims.

## Delivered and deferred

Delivered: the original seven desktop concept screens, the refined interaction board, all 14 dedicated UML examples and their catalog, a per-type build registry, native editable text/shapes/containers, reusable editor components and rendered visual review. Isolated icon/connector specimens are source-backed vectors; they are not semantic connected edges yet.

Deferred: runtime behavior, schema changes, specialized editors, import/export adapters and narrower-screen mockups. The design task changes no application implementation code and runs no tests.


---

# Diagramming — interaction and visual refinement

Status: design concept and isolated interaction prototype; the production editor has not gained a diagram engine.

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


---

# UML — all 14 diagram types

Status: complete design coverage; production implementation planned. The native canvas contains a dedicated example for each requested type and a catalog of all 14. The JSON registry is a build handoff, not a runtime plugin or an installed diagram engine.

This extends [the diagramming concept](./diagramming-concept.md) and [the interaction specification](./diagramming-interaction-spec.md). The shared connection and Auto place workflow remains the foundation.

Design project: `3e260fd8-2492-4468-9bc1-13b9cf5c308c` — Codex Design — Diagramming.
Board: `2bac4a90-ae5f-4a4e-8962-e6d5ac1ebb04` — Diagram workspace · Refined flow.
Catalog: `v2-page-uml-catalog` — UML · All diagram types.
Build registry: [diagramming-uml-catalog.json](./diagramming-uml-catalog.json).

## Coverage and navigation

All seven structural and seven behavioral diagram types from the supplied screenshot are included. Sequence, communication, interaction overview and timing form the interaction subset of behavioral diagrams; they are not a third disjoint family.

Start a diagram → UML opens the two-column catalog. Each row has a distinct notation preview, title and short description. Search matches names, common aliases and relevant constructs. Selecting a row opens a template preview with Blank / Use template choices and an editable name. Creation is one transaction. The catalog and example screens are static native design concepts; this navigation is specified for implementation.

The editor keeps the same compact shell and existing Properties panel. Switching diagram types changes the stencil library, allowed relationships, relevant Inspector fields and layout settings. It must not reinterpret existing content. Changing an existing diagram's type is an explicit conversion with a mapping preview.

| Type | Classification | Main elements | Native example page |
| --- | --- | --- | --- |
| Class | structural | class, interface, data-type, enumeration, association-class… | `v2-page-uml-class` |
| Component | structural | component, interface, port, provided-interface, required-interface | `v2-page-uml-component` |
| Deployment | structural | device, execution-environment, artifact, deployment-specification | `v2-page-uml-deployment` |
| Object | structural | instance-specification, slot, literal-value, instance-value, link | `v2-page-uml-object` |
| Package | structural | package, nested-package, model, packageable-element | `v2-page-uml-package` |
| Profile | structural | profile, stereotype, metaclass-reference, stereotype-property, constraint… | `v2-page-uml-profile` |
| Composite structure | structural | structured-classifier, part-property, port, collaboration, collaboration-use… | `v2-page-uml-composite` |
| Use case | behavioral | actor, use-case, subject-boundary, extension-point | `v2-page-uml-use-case` |
| Activity | behavioral | action, object-node, input-pin, output-pin, activity-parameter… | `v2-page-uml-activity` |
| State machine | behavioral | state, composite-state, submachine-state, region, initial… | `v2-page-uml-state` |
| Sequence | behavioral / interaction | interaction, lifeline, execution-specification, message-occurrence, combined-fragment… | `v2-page-uml-sequence` |
| Communication | behavioral / interaction | interaction, lifeline-role, connector, message | `v2-page-uml-communication` |
| Interaction overview | behavioral / interaction | interaction, interaction-use, initial, final, decision… | `v2-page-uml-interaction-overview` |
| Timing | behavioral / interaction | lifeline-track, state-condition, value-lifeline, state-change, time-observation… | `v2-page-uml-timing` |

Each example shows a readable subset, not every construct supported by the planned type. The registry records the broader planned elements, relationship kinds, property groups, validation and layout constraints. In particular, the simple activity example does not demonstrate every concurrent or exception-flow construct; the simple sequence example does not demonstrate every fragment operator.

## Connection handles and actual UML ports

Clicking a node's perimeter reveals routing handles around every eligible side. The ordinary rectangular view exposes three per side. These are connection anchors belonging to the view. They are not automatically semantic UML Port elements.

Actual UML ports are explicit square symbols owned by a structured classifier or part, with stable identity, type, multiplicity and applicable interface properties. Add UML port creates one deliberately. Selecting an existing UML port offers its properties and permitted connectors. Boundary ports stay on their owner's boundary when layout runs.

The connection gesture uses the selected relationship kind. If none is selected, offer the compatible relationships for the source and target: association, dependency, include, transition, message, and so on. The editor derives markers from that kind. Decorative arrowhead changes must not silently change semantic meaning.

Drag or click from a routing handle or semantic port. Reveal eligible target anchors, preview the route, and explain incompatible targets. Dropping onto empty canvas opens a filtered Add next step picker. Insertion creates the element, view and relationship atomically. Escape leaves no partial edge. Reconnection validates both endpoints before committing.

Sequence messages, timing occurrences and activity pins need specialized endpoint selection, even though their gesture and focus behavior feel consistent. A generic perimeter endpoint cannot stand in for an occurrence, a typed pin or a UML Port.

## Shared data model

Use the existing versioned project and native canvas hierarchy. Add semantic records for UML elements and relationships, then let native views reference those records. Store each view's geometry only on its existing native node; do not introduce a second scene graph with duplicate positions.

- A diagram records its stable ID, diagram type, notation version, enabled libraries and layout settings.
- A semantic element has a stable element ID, UML kind, owning element, classifier/type references and kind-specific fields.
- A native view has its existing node ID, an element reference, compartment visibility and visual overrides. The same element can have views on multiple diagrams.
- A semantic relationship has stable endpoint references and kind-specific data. Its connector view owns route settings, labels and manual waypoints.
- Routing anchors are view data. UML ports, properties, pins, message occurrences and association ends are semantic data with their own IDs.
- A template declares its type and required capabilities. Preview artwork must not count as semantic editing support.

Moving a view affects that view's geometry. Renaming a shared semantic element updates all its views. Deleting a view and deleting the underlying element are distinct actions with explicit labels and affected-view disclosure. Copy/paste offers a new independent model element by default; creating another view of the same element is a separate command. Cloning a diagram remaps internal semantic references unless the user explicitly chooses shared views.

All mutations use the existing revision-checked transaction boundary for the editor and MCP. Undo restores the complete gesture. Referential integrity failures block the save; incomplete notation can remain as a clearly marked sketch.

## Auto place by diagram type

Auto place reduces crossings within each notation's constraints. It does not promise a globally optimal or crossing-free result. Keep pinned views and semantic constraints first, avoid node/label obstacles second, reduce crossing conflicts third, then reduce bends, wire length and unnecessary movement.

| Type | Constraints that arrangement must preserve |
| --- | --- |
| Class | Keep compartments and member rows with their classifier. Preserve containment, explicit relation ends and pinned views. |
| Component | Keep named interface glyphs and ports attached to their owning component. Preserve assembly/delegation endpoints and component containment. |
| Deployment | Preserve device/environment/artifact nesting. Route communication paths between nodes; deployment relations retain their actual targets. |
| Object | Keep slot rows with their instance and preserve explicit link endpoints. Never replace an instance view with its classifier during layout. |
| Package | Preserve namespace nesting and pinned package boundaries. External dependency routes must avoid unrelated package bodies. |
| Profile | Keep stereotypes in their profile and metaclass references visibly distinct. Extension arrows remain attached to the relevant stereotype and metaclass. |
| Composite structure | Keep part and port ownership; boundary ports stay on their owning perimeter. Arrange internal parts without moving them outside the structured classifier. |
| Use case | Keep actors outside the subject boundary and use cases inside the selected subject. Preserve include/extend direction and existing pins. |
| Activity | Preserve partitions, structured scopes and explicit branch guards. Keep fork/join synchronization and distinguish flow-final from activity-final. |
| State machine | Preserve region ownership, initial/history nodes and transition direction. Keep internal transitions internal; route self-transitions without moving them to another state. |
| Sequence | Preserve occurrence order, send/receive dependencies and fragment scope. Move lifelines horizontally without reordering messages; explicit Reorder changes the model. Creation/destruction bound the visible lifeline. |
| Communication | Preserve explicit message sequence expressions and nesting while moving participants. Keep message arrows and labels on the appropriate connector. |
| Interaction overview | Preserve interaction-use targets and control-flow direction. Keep decision/merge and fork/join structures properly nested. |
| Timing | Preserve timestamps, symbolic ordering, shared time scale and duration constraints. Only track spacing, label positions and routing change in Auto place. Dragging a timed event requires an explicit time-edit gesture. |

Use distinct placement adapters behind the shared control. The settings panel shows only relevant controls: direction and spacing for structural flows; partition/region handling for activity and states; lifeline spacing for sequence; track spacing and label packing for timing. Hide controls that cannot apply rather than offering ineffective switches.

With Auto place on, a committed insertion, deletion or reconnection triggers a bounded regional pass. User drags pin geometry as already specified. Sequence occurrence order and timing values change only through explicit semantic edits. Message renumbering in communication diagrams is a separate reviewed operation.

Keep route geometry and placement separate. Recompute compatible automatic anchors, route around obstacles, position labels and report unresolved conflicts without silently moving pins. A broader Arrange action uses a cancellable preview when the move is costly. Apply geometry, routes and labels in one revision-checked transaction and discard stale work.

## Structured editing and notation checks

The registry's inspectorGroups and validationRequirements are the implementation checklist for every type. A few high-impact distinctions:

- Class members separate visibility, name, type, parameters and defaults. Object slots reference classifier features and hold actual values; instances use underlined labels.
- Deployment separates artifact deployment, manifestation and node communication paths. A package import is not an ordinary dependency with a renamed label.
- Profile extensions connect a stereotype to a referenced metaclass. Applied tagged values use declared property types. A profile editor does not edit the UML metamodel itself.
- Composite parts are typed properties with multiplicity. Assembly and delegation connectors retain their endpoint roles and actual ports.
- Use-case include points toward the included use case; extend points toward the extended use case. Extension points and conditions remain structured.
- Activity control flow and object flow are distinct. Initial, activity-final, flow-final, decision/merge and fork/join have separate semantics.
- State transitions keep trigger, guard and effect separate. Regions, entry/do/exit behavior, history and pseudostates are not flattened into labels.
- Sequence message kinds, occurrences, execution spans, fragment operators and operand guards are explicit data. Layout cannot scramble their order.
- Communication message sequence expressions are stored, not inferred from node positions. Interaction overview references actual interactions and preserves nested branching/synchronization.
- Timing uses a shared time scale with explicit units, event times or symbolic expressions, and duration bounds. Unknown values remain unknown.

Offer actionable diagnostics anchored to the affected element, with a text explanation and an Inspector shortcut. Validate graph integrity strictly; allow intentional incomplete modeling with visible notation warnings. Do not label the result fully UML-conformant merely because the diagrams render. Execution, code generation, OCL evaluation and simulation are separate capabilities outside this concept.

## Capability and interchange contract

The JSON registry declares concept coverage separately from structured editing, layout, validation and native semantic round-trip support. All runtime capabilities are planned. The application must derive availability from implemented capabilities, not from the existence of a catalog row.

Native project JSON is the intended semantic interchange for supported elements and their views. Migration must preserve IDs, unknown versioned fields where safe, annotations and references. SVG/PNG are visual exports; a picture is not proof of an editable semantic round trip.

Mermaid, PlantUML and draw.io adapters need construct-level coverage for each diagram type. No universal import/export promise is made. Keep the original input, disclose unsupported or lossy constructs, and preview the mapping before committing. Do not silently flatten an unsupported profile, timing constraint or fragment into an ordinary box. Unresolved references remain identifiable and repairable.

## Delivery packs

All 14 types remain in the committed product scope. These are implementation groupings, not a reduction in the requested coverage:

1. Shared semantic records, native views, connections, history, persistence, accessible selection and capability registry.
2. Structural packs: class and object; package, component and deployment; composite structure and profile.
3. Behavioral flow packs: use case, activity and state machine.
4. Interaction packs: sequence, communication, interaction overview and timing, each with its own ordering/containment rules.
5. Per-type interchange adapters with declared fidelity, followed by broader automation.

A pack is ready only when its actual shapes, structured properties, typed relations, layout rules, persistence, copy/paste, undo and matching MCP operations work together. The catalog may show upcoming types as planned during incremental rollout; full-support copy waits for actual runtime coverage.

## Review and verification

No tests were added or run. Review used native project inspection, HTML exports and visual inspection of the catalog and the 12 new example screens. The existing class and sequence designs were retained and named explicitly. Minor thumbnail clipping and notation details were corrected during visual review.

The examples use illustrative commerce and order-processing content. Timing values are illustrative, not measurements. This extension makes no new performance or crossing-reduction measurements. The earlier isolated shared-workflow prototype remains separate and does not implement all UML editors.

Implementation verification should use compilation/builds and direct inspection: create and edit each type, connect/reconnect, move nested content, arrange with pins and semantic constraints, undo, save/reopen, copy/paste, inspect export fidelity, use keyboard equivalents and perform matching MCP edits. Follow the standing no-tests preference.

## Sources

The user's attached list defines the requested coverage. Notation decisions use the [OMG UML 2.5.1 specification](https://www.omg.org/spec/UML/2.5.1/About-UML), including §12.3.3.6 for stereotype extensions, §17.9 for communication diagrams, §17.10 for interaction overview diagrams and §17.11 for timing diagrams. The proposed editor interactions and rollout are product decisions rather than requirements quoted from the standard.


# Diagram node library · 2026-10-15

43 new reusable definitions: 36 base shapes and seven compact architecture variants. Three library pages cover architecture/data, structural UML and behavioral UML. Native text and compartments remain individually editable; isolated SVG geometry carries symbols and notation outlines. Catalog previews derive from the same component recipes.

Always render dark: canvas #171717, body #22262c, header #292f37, borders #5b6572 and dividers #444d59. Type symbols share a 24-unit grid; Lucide stroke 1.75, UML glyph stroke 1.5. Titles use system type; member names, types, values and operations use monospace. Distinct silhouettes and notation carry meaning without relying only on color. Temporary connection handles are not semantic UML Port nodes.

Use accurate relation glyphs: filled composition diamonds; open generalization/realization triangles; solid generalization and dashed realization/dependency; dashed replies; filled extension triangles. Expanded structural nodes expose attributes/operations, object slots, component contracts, nested parts and deployment artifacts. Compact architecture variants preserve type, title and metadata. Resize content instead of scaling typography.

Architecture symbols use Lucide 0.468.0. UML geometry and node anatomy are original project assets. Native components and the live React/Tailwind prototype are design assets; complete semantic validation and production auto-layout remain implementation work described in docs/diagramming-uml-spec.md and docs/diagramming-interaction-spec.md.

Repository handoff: docs/diagramming-node-library.md and assets/diagram-nodes/. Preserve the notices below when redistributing Lucide or Feather-derived icons.

# Third-party notices — diagram nodes

Architecture symbols use SVG geometry from the installed `lucide-react` package, version 0.468.0. Lucide is ISC-licensed; its Feather-derived icons retain MIT attribution. Both notices are included below. Original UML geometry, node anatomy and native component recipes were authored for this project and are not copied from draw.io stencil libraries.

Sources: https://lucide.dev/license · https://github.com/lucide-icons/lucide

## Lucide — ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## Feather — The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to
do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


---

# Application states — concept and handoff

# Stateful frames and components

Status: design concept and working local prototype. The existing editor has Hover, Pressed and Focus styles in `shared/node-states.ts`; it does not yet have the application-state model or MCP operations proposed here.

## Product behavior

Author one frame, then resolve it against a named application context. A membership change can alter text, visibility, styling and a journey's next step while retaining the frame, node IDs, component links, comments and shared geometry. Optional elements are authored once with a hidden base value. State selection must not duplicate, replace or destructively rewrite the frame.

The example uses a Member experience context with Membership (Free / Pro / Team), Billing (Current / Needs attention), and Onboarding complete (Boolean). Saved scenarios are named combinations, not copies of the design. Free member, Pro member, Payment issue and New member demonstrate normal and recovery paths. These are illustrative product rules, not a billing system.

## Interface

A compact bar above the selected frame shows **View as [scenario]**, **Compare to [baseline]** and the number of changes. Selecting a scenario resolves that same frame immediately. Changing an individual control shows Custom until its complete values match a saved scenario. Preserve the selected scenario ID independently of its values, so two named scenarios can share values without losing their identity. Compare typed values in schema order, not by JSON property order.

The right inspector retains Properties, Code and Tweaks, and adds **States**. Inside States:

- **Preview**: context/scope, named scenario, typed controls, Highlight differences, and a linked change list.
- **Rules**: the selected component, Follow frame or explicit input overrides, readable When / Then rules, base fallback, current match and property provenance.
- **Agent**: stable IDs, the resolved context and a structured read/edit interface. Technical keys stay here and in implementation handoffs.

Keep the existing 336px inspector, compact controls, neutral dark surfaces and blue selection. At narrow widths the controls move above the pannable canvas. A state selector also belongs on a component's library specimen, using its declared state contract.

**Preview and editing are separate.** View as, controls, comparison baseline and highlight visibility are session state. They do not autosave the base document or add Undo entries. A visible editing target says Base design or Rule: [name]; authoring against an active scenario must never silently capture a preview as a base edit. Rule edits follow the existing 650ms autosave, retained-draft, conflict and Undo behavior. Creating or updating a saved scenario is an explicit action.

The native pages represent two inspector workflows; they are not separate Free and Pro application frames. The interactive lab uses one application subtree.

## Yellow differences

Default Compare to is the previously viewed state. Users can pin a named scenario such as Free member; the prototype opens with that pinned comparison to demonstrate six differences immediately. Show the baseline in both the frame bar and change list. Selecting an identical scenario produces a quiet “No differences” state.

| Difference | Canvas treatment | List detail |
| --- | --- | --- |
| Changed content or appearance | Thin yellow outline and faint wash on the affected element | Property, before → after, matching rule |
| Newly visible | Yellow outline with Added label | Hidden → visible, condition |
| Hidden | Dashed yellow ghost at the element's previous bounds | Visible → hidden; reveal the original layer in Rules |
| Moved or resized | Yellow current outline and optional dashed previous bounds | Before/after geometry; preserve selection |

Use `#e8c15b` for change annotations. Blue remains selection. Annotations are a separate overlay, never written into node styles. Give each changed logical element a number that matches its list row; include Added/Changed/Hidden/Moved labels so color is not the only signal. Selecting a row reveals that element without losing the chosen state. Hidden layers remain reachable through the change list and Layers.

Compare effective render results, not raw rule JSON: typed content, effective visibility, resolved tokens and styles, then final layout bounds. Do not count a changed ancestor and every unchanged descendant as separate edits. A hidden ancestor produces one subtree-removal entry unless expanded. Reflow can move an otherwise unchanged element; report it as Moved rather than suggesting its content was edited. Ignore preview chrome, focus, selection and highlight settings.

Removed ghosts use pre-switch geometry and do not occupy layout space. Clip them to the appropriate frame and parent constraints. If a new element occupies the same position, prefer the dashed outline and list entry over painting old content on top. Pointer events belong to the current frame; ghosts are inspectable through their list. At high zoom use a constant screen-pixel outline.

A brief low-opacity flash can orient the user, then the outline stays until Highlight differences is turned off or the comparison changes. Reduced motion removes the flash and transition. Use an aria-live summary such as “Pro member: six differences from Free member”; never announce all changed text at once.

## State model

Proposed additions are versioned optional fields, not overloaded `NodeStyle.states`.

```ts
type StateValue = string | boolean | number;
type StateCondition =
  | { key: string; eq: StateValue }
  | { key: string; in: StateValue[] }
  | { all: StateCondition[] }
  | { any: StateCondition[] };

interface ApplicationStateContext {
  id: string;
  name: string;
  variables: StateVariable[]; // stable ID, label, type, default, constraints
  scenarios: StateScenario[]; // stable ID, name, complete typed values
  constraints: StateConstraint[];
}
interface StateBinding {
  contextId: string;
  inputs: Record<string, { from: string } | { literal: StateValue }>;
}
interface StateRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  when: StateCondition;
  effects: Array<{
    targetNodeId: string; // stable ID inside the owning frame/definition
    set: StatePropertyPatch;
  }>;
}
```

Store contexts on the project. A frame binds to a context; a reusable component declares named inputs and rules in its definition. Instances map those inputs to frame variables, or pin individual values explicitly. Component target IDs use the canonical definition IDs and resolve through the existing instance node map. Keep state schema references and dependencies in portable library exports.

MVP controls are enums and Booleans. Later numeric/string inputs need explicit bounds/lengths and appropriate controls. Conditions are declarative JSON with bounded depth/length; never arbitrary JavaScript, code evaluation, dynamic property paths or network requests.

State effects initially allow text content, hidden/visible and an explicit safe style/token subset. Opaque code/media can switch a known authored source or reference only through a separate declared variant contract; the editor must not imply it can inspect arbitrary internal DOM. Conditional tree insertion, source execution and nested component slots are not implied by this concept. Layout-related effects can be added using the editor's shared geometry resolver.

All optional UI is ordinary authored content, even when its base is hidden. A rule reveals it; no runtime node cloning is needed.

## Resolution and ownership

1. Read the current project revision and pinned component releases.
2. Resolve context defaults, then the selected complete scenario, then temporary control values.
3. Apply the instance's input mapping and explicit pins; show each value's origin.
4. Validate types and cross-variable constraints before resolving any affected frame.
5. Start from the authored base plus existing local component overrides.
6. Evaluate applicable rules; higher explicit priority wins per target/property. Equal-priority overlapping writers are rejected with both rule IDs and the conflicting property.
7. Resolve token references, normal layout, visibility and bounds using the existing rendering pipeline.
8. Compare the previous/baseline effective snapshot with the new snapshot and draw transient overlays.

Use no hidden “last item wins” rule. A higher priority is a deliberate authoring decision. Unrelated properties compose. Unknown variables, deleted targets and incompatible component releases return actionable errors without partially updating the frame. A variable or scenario cannot be deleted while referenced unless the same atomic edit migrates those references.

State selection and input pins are not component-version updates. Released definitions carry their state contract; existing instances remain pinned until an explicit update, preserving local overrides under the existing release rules. Do not introduce automatic fleet updates.

Application state resolves before Hover, Pressed and Focus presentation. Those interaction styles remain independent; a disabled state suppresses inappropriate interactive styling. Keep editor selection and history comparison separate from both.

For the example, Free + Needs attention is invalid because Free has no paid invoice. The UI explicitly resets Billing to Current when selecting Free and announces that adjustment. Structured edits must submit a valid complete result; they must not silently coerce data. Invalid component pins require a clear recovery to Follow frame.

## Journeys

Frames participating in a journey bind to the same context and declare which values a navigation link carries. Moving from Member home to Library or Collection preserves membership, billing and onboarding; unrelated frames do not inherit values merely because they share a page.

A transition may propose an atomic state patch plus a target frame, for example completing onboarding sets `onboarding = true` and navigates to the collection. Show these mutations in the journey inspector. Branch guards read the same typed context. The user can preview a branch without editing the graph.

Keep a scoped preview session per conversation/pane and journey. Expose a clear Follow journey / Local override choice. State changes in one Codex chat must not silently switch another chat's preview.

The prototype demonstrates carrying context across its three navigation steps. A full journey-transition editor remains implementation work.

## Agent contract — proposed, not registered tools

Agents should use the same model and mutations as the UI.

| Proposed capability | Behavior |
| --- | --- |
| `canvas_get_state_context` | Read a scoped frame/component's schema, scenarios, input origins, rules, current revision, resolved nodes and diagnostics |
| `canvas_preview_state` | Resolve typed values and optionally show them in the calling pane; return the effective diff without saving a project revision |
| `canvas_edit_project` additions | Atomically create/update/delete contexts, scenarios, rules and bindings with `expectedRevision` |
| Existing context/export tools | Include state dependencies, current effective values and rule provenance; export a chosen scenario or a stateful definition |

Suggested edit operations are `upsert_state_context`, `upsert_state_scenario`, `bind_state_context`, `upsert_state_rule`, `set_state_instance_inputs` and corresponding dependency-checked deletions. Scope every operation by project plus owning frame or component definition. Stable IDs make repeated upserts idempotent.

Example shape of a future rule edit:

```json
{
  "type": "upsert_state_rule",
  "owner": {
    "kind": "frame",
    "pageId": "member-pages",
    "nodeId": "member-home"
  },
  "rule": {
    "id": "export-access",
    "name": "Export collection",
    "enabled": true,
    "priority": 20,
    "when": {
      "all": [
        { "key": "membership", "in": ["pro", "team"] },
        { "key": "billing", "eq": "current" }
      ]
    },
    "effects": [
      { "targetNodeId": "export-collection", "set": { "hidden": false } }
    ]
  }
}
```

The containing edit request supplies the actual project ID and freshly read `expectedRevision`. On conflict reread and rebase the intended edit; do not overwrite the document with an old full snapshot. Return resolved affected node IDs, before/after values, reason/rule IDs, warnings and the new revision.

The standalone lab uses deliberately smaller local operations: `set_values`, `upsert_scenario` and `upsert_rule`. Its Agent tab validates the full batch, rejects invalid/ambiguous rules, then applies everything together in browser memory. These local operations are demonstrations and must not be advertised as currently callable MCP tools.

The lab resolves content and visibility on eight known sample nodes, supports `when.all` with `eq`/`in` predicates, and offers one Export component membership override. Style/geometry diffs, the generic native-node resolver, persistence/history/autosave, reusable component releases and registered MCP operations remain proposed production work.

## History, export and implementation

Preview browsing adds no document versions. Authored schemas, bindings, scenarios and rules participate in ordinary Undo, autosave, library releases and project history. History renders the state definitions from the historical revision; its yellow version comparison must be clearly labelled and must not mix with application-state comparison.

Static export records the selected scenario, complete input values and document revision, and excludes the yellow inspection overlay by default. An explicit “Include differences” export may include annotations and baseline metadata. Stateful source/library exports preserve the base, context schema, bindings, rules and dependencies. Do not serialize per-user preview sessions as document defaults. Import validation must reject unresolved references and migrate older documents without changing their appearance.

Implementation touchpoints:

- `shared/types.ts` and `shared/validation.ts`: versioned schema, typed operations, referential/type/condition validation.
- New shared state resolver: UI, MCP, history and exporters use one pure implementation.
- `server/store.ts`, `server/api.ts`, `server/mcp.ts`: revision-checked writes, scoped reads and explicit preview responses.
- `src/App.tsx` and inspector components: pane-local preview context, edit-target mode, controls and overlay.
- Existing geometry/visibility resolution: resolve before hit testing, layout and export; use actual transformed bounds.
- `shared/export.ts` and library export: scenario metadata, dependencies and source handoff.
- Component context and comments: include effective state and rule provenance when the user comments on a state-dependent element.

Start with typed contexts, scenarios, visibility/content rules and a single-frame preview. Then add component input contracts and the difference overlay. Add journey propagation and shared export semantics before describing the feature as complete. There is no production state engine or MCP implementation in this change.

## Artifacts and verification

Codex Design project: `3e260fd8-2492-4468-9bc1-13b9cf5c308c`. Board: Stateful frames · Application states (`ee1cca06-2e6f-491d-bb6e-de49f5b6601c`).

Native pages: Preview states & differences; Component rules & inheritance; Interactive state lab. The first two are native editable designs. The lab is a sandboxed executable prototype; double-click to run it.

`assets/stateful-frames/` contains the React/Tailwind prototype, self-contained HTML, model/validator, initial state-definition JSON, build script and notices. Build with `node assets/stateful-frames/build-prototype.mjs` from this project, using its installed dependencies.

Verification uses builds and direct browser inspection, never tests. The prototype compiled; observed interactions include six differences for Pro versus Free, zero for Free versus Free, a component-specific Free override that hides Export while the frame remains Pro, and a structured patch that adds and selects Team. Direct inspection also confirmed that a saved Pro reviewed scenario retained its selected name after switching away and back, and that an agent content rule changed Export collection to Download pack. The finish review's ship verdict scored both of those fixes resolved. Desktop and narrow-width screenshots accompany the handoff. This does not verify a production integration or every future state combination.


# Third-party notices — stateful frame concept

The prototype embeds React, React DOM, Scheduler, Tailwind CSS and Lucide icons. Native editor chrome uses the same Lucide icon geometry. The sample UI and state model were authored for this project.

## react 19.3.0

MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## react-dom 19.3.0

MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## scheduler 0.28.0

MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## tailwindcss 4.3.3

MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## lucide-react 0.468.0

ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.



<!-- codex-design:tokens -->

## Tokens

| Name | Kind | Value | CSS variable | Description |
| --- | --- | --- | --- | --- |
| Selection and active tools | color | \#4497ff | --ds-system-accent |  |
| Canvas | color | \#171717 | --ds-system-background |  |
| Primary text | color | \#e8eaed | --ds-system-foreground |  |
| Editor font | fontFamily | system-ui, -apple-system, BlinkMacSystemFont, sans-serif | --ds-system-font-family |  |
| Control radius | radius | 6px | --ds-system-radius |  |
| Editor surface | color | \#202020 | --ds-editor-surface |  |
| Editor boundary | color | \#3a3a3a | --ds-editor-border |  |
| Secondary text | color | \#a3a3a3 | --ds-editor-muted |  |
| Data source | color | \#76b8ec | --ds-diagram-source |  |
| Transformation | color | \#bda7ed | --ds-diagram-transform |  |
| Serving | color | \#87c9b5 | --ds-diagram-serving |  |
| Attention | color | \#dfba79 | --ds-diagram-attention |  |

<!-- codex-design:catalog -->

## Reusable native components

| Component | Definition ID | Released revision | Nodes | Description |
| --- | --- | --- | --- | --- |
| Editor / Title bar | diagram-titlebar | 3 | 11 | Observed compact title-bar pattern adapted for the concept. |
| Editor / Diagram toolbar | diagram-toolbar | 56 | 17 | Proposed Diagram entry, connect tool and arrangement menu in existing 31px floating toolbar. |
| Editor / Refined diagram toolbar | diagram-toolbar-refined | 106 | 15 | Compact reusable diagram toolbar; diagram family label is a local text override. |
| Architecture / Service | diagram-node-service | 160 | 9 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Data / Database | diagram-node-database | 160 | 7 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Architecture / Event source | diagram-node-events | 160 | 8 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Data / Event stream | diagram-node-queue | 160 | 11 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Data / Transformation | diagram-node-transform | 160 | 9 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Data / Dataset model | diagram-node-model | 160 | 9 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Data / Semantic model | diagram-node-metrics | 160 | 8 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Architecture / Dashboard | diagram-node-dashboard | 160 | 8 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Data / Object store | diagram-node-storage | 160 | 7 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Architecture / External API | diagram-node-api | 160 | 8 | New diagram concept component · authored native anatomy, dark mode. Lucide 0.468.0 symbols; ISC and Feather-derived MIT notices retained. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Class | diagram-node-class | 161 | 13 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Interface classifier | diagram-node-interface | 161 | 6 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Object instance | diagram-node-object | 161 | 10 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Component | diagram-node-component | 161 | 10 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Deployment device | diagram-node-device | 161 | 6 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Execution environment | diagram-node-environment | 161 | 6 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Artifact | diagram-node-artifact | 161 | 6 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Package | diagram-node-package | 161 | 10 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Profile | diagram-node-profile | 162 | 8 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Stereotype | diagram-node-stereotype | 162 | 11 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Metaclass reference | diagram-node-metaclass | 162 | 6 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Typed part | diagram-node-part | 162 | 5 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / State | diagram-node-state | 162 | 5 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Action | diagram-node-action | 162 | 2 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Interaction use | diagram-node-ref | 162 | 4 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Lifeline and execution | diagram-node-lifeline | 162 | 5 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Use case | diagram-node-usecase | 163 | 2 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Actor | diagram-node-actor | 163 | 3 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Decision or merge | diagram-node-decision | 163 | 2 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Initial node | diagram-node-initial | 163 | 2 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Final node | diagram-node-final | 163 | 3 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Fork or join | diagram-node-fork | 163 | 1 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Semantic port | diagram-node-port | 163 | 1 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| UML / Timing track | diagram-node-timing | 219 | 11 | New diagram concept component · authored native anatomy, dark mode. UML 2.5.1 notation geometry. Planned semantic editing is defined in docs/diagramming-uml-spec.md. |
| Compact / Orders database | diagram-node-compact-database | 171 | 7 | Shared compact database node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| Compact / Product events | diagram-node-compact-events | 171 | 6 | Shared compact events node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| Compact / Event stream | diagram-node-compact-queue | 171 | 9 | Shared compact queue node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| Compact / Raw lake | diagram-node-compact-storage | 171 | 6 | Shared compact storage node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| Compact / curated\_orders | diagram-node-compact-model | 171 | 6 | Shared compact model node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| Compact / Revenue metrics | diagram-node-compact-metrics | 171 | 6 | Shared compact metrics node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| Compact / BI dashboards | diagram-node-compact-dashboard | 171 | 6 | Shared compact dashboard node used across the architecture flow. Authored native shape anatomy with licensed Lucide symbols; keep fields and original labels editable. |
| UML / Composite structure | diagram-node-composite | 192 | 10 | Native structured classifier, typed parts, square UML ports and internal connectors. |
| UML / Comment and constraint | diagram-node-comment | 192 | 3 | Native editable comment with isolated folded-corner notation outline. |
| Application state / Frame switcher | app-state-switcher | 226 | 14 | Proposed frame-scoped View as selector, pinned baseline and yellow difference count. Preview selection is session state, not an edit to the design. |
| Application state / Typed controls | app-state-controls | 226 | 14 | Enum controls and a Boolean toggle generated from a typed context. Values affect a single resolved frame; variables can propagate to child components. |

Definitions live in the project document. Linked instances retain their released revision and explicit local overrides; applying a newer release is deliberate. Source-backed code remains passive source. Prior releases are immutable project-history snapshots; portable project backups start a new history baseline when imported.

## Sources

- /Users/tronschell/Documents/codex-design/DESIGN.md (design-md; observed): Observed existing dark canvas and compact editor conventions; proposal preserves these.
- /Users/tronschell/Documents/codex-design/src/App.tsx (component; observed): Observed page selector, floating tools, project title bar, library entry and inspector.
- /Users/tronschell/Documents/codex-design/shared/types.ts (config; observed): Observed flat page nodes and revisioned operations. No attached-edge or diagram semantic model exists in the inspected schema.

## Token CSS

```css
:root {
  --ds-system-accent: #4497ff;
  --ds-system-background: #171717;
  --ds-system-foreground: #e8eaed;
  --ds-system-font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --ds-system-radius: 6px;
  --ds-editor-surface: #202020;
  --ds-editor-border: #3a3a3a;
  --ds-editor-muted: #a3a3a3;
  --ds-diagram-source: #76b8ec;
  --ds-diagram-transform: #bda7ed;
  --ds-diagram-serving: #87c9b5;
  --ds-diagram-attention: #dfba79;
}
```

Load styles.css from a library export for component styles. COMPONENTS.md indexes each component's Markdown, React JSX, CSS and props declaration. The versioned codex-design.library.json preserves editable Codex Design extensions for initialization in a new project.
