# UML — all 14 diagram types

> **Implementation update · October 15, 2026:** The editor now includes diagramming and application states. [Diagrams and application states](diagramming.md) is the current runtime/API guide. This document retains the historical concept, prototype, and design-board details; proposed behavior below is not the runtime contract.

Historical scope: complete design coverage with a native example for each of the 14 UML types. All 14 now also have runtime palettes and starters. The JSON registry here remains the historical handoff; shared/diagram-catalog.ts is the runtime catalog.

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
