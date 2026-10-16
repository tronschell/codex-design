# Diagramming in Codex Design

> **Implementation update · October 15, 2026:** The editor now includes diagramming and application states. [Diagrams and application states](diagramming.md) is the current runtime/API guide. This document retains the historical concept, prototype, and design-board details; proposed behavior below is not the runtime contract.

> **Refined concept:** The **Diagram workspace · Refined flow** board adds cleaner native diagram screens, perimeter ports, connected-node quick insert, a persistent Auto place mode, and an isolated working prototype. See [the interaction specification](./diagramming-interaction-spec.md) for the current behavior, prototype limits, measured example and build sequence.

Concept and implementation brief · October 15, 2026

Saved design project: Codex Design — Diagramming

- Project ID: 3e260fd8-2492-4468-9bc1-13b9cf5c308c
- Board ID: board_42da9a10-92a9-4ca4-bb4a-5fa583b690b8
- Primary page ID: page-architecture
- Review pages: page_d85ba238-5d66-4d2c-9186-aec15e0ec951, page-architecture, page-uml-class, page-uml-sequence, page-journey, page-roadmap, page-venn

Open the saved project through Codex Design to inspect and edit the screens. Use the latest revision when implementing from this concept.

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
