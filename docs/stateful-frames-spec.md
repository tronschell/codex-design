# Stateful frames and components

> **Implementation update · October 15, 2026:** The editor now includes diagramming and application states. [Diagrams and application states](diagramming.md) is the current runtime/API guide. This document retains the historical concept, prototype, and design-board details; proposed behavior below is not the runtime contract.

Historical status: design concept and local prototype. Application states are now implemented separately from Hover/Pressed/Focus; see the current guide above for the shipped model and registered tools.

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
