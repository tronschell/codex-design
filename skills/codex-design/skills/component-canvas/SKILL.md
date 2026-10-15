---
name: component-canvas
description: Discover an existing application's UI components and supported variants, then populate its Codex Design Components library. Use for show-all-components requests or Find app components.
license: MIT
---

# Component canvas for Codex Design

Adapted and extended from [component-canvas](https://github.com/ibelick/ui-skills/blob/main/skills/component-canvas/SKILL.md) by [Julien Thibeaut (ibelick)](https://github.com/ibelick), in [ui-skills](https://github.com/ibelick/ui-skills). The upstream [MIT license](LICENSE) is retained. Its component-preservation, variant-comparison, safe-preview and coverage principles guide this workflow. The extension uses the existing Codex Design library instead of adding a canvas route to the target application.

## Establish the app and scope

Use the project and application repository named in the conversation or saved request. Read the current project, design system, existing component definitions and matching pending request. Ask for an application location only when it cannot be established; the editor plugin repository is not automatically the target app. An explicit “all components” request covers all public UI families in that authorized scope.

Use `canvas_get_pending_design_system_requests` to read a queued `mode:"components"` request. Use the matching project ID with `canvas_open_canvas` and existing context/edit tools. Natural-language requests use this same workflow without requiring a queued request or another permission step.

## Discover actual components

- Read applicable DESIGN.md and AGENTS.md files, public component exports/props, current design tokens, existing stories/examples and production usages. Start repository searches with `rg`; skip dependencies, build output, secrets and unrelated applications.
- Inventory component families and supported named variants, useful sizes, states, compositions and themes. Include only what exists. Keep one canonical specimen per family and separate named variations where useful for reuse; do not enumerate every prop combination.
- Compare one feature at a time: hold labels, icons, content, theme, wrapper and the other props constant. Preserve the component's own disabled, selected and state styling. Read actual APIs instead of inventing variants.
- Keep a coverage record of source/export identity, examined variants, imported entries, omissions and reasons. A bounded sample is not a complete inventory.

## Preserve the application

Do not change component source, exports, hooks, styles, providers or behavior to make discovery work. Do not patch libraries, DOM, browser APIs or portal roots. Do not add a gallery route or dependencies, make the app public, or change access controls for this task. Existing repository styles remain authoritative evidence; Tailwind is the default for newly authored styling unless the user explicitly requests otherwise.

Use safe existing examples and public callback/provider seams when inspecting real behavior. Do not use production credentials, real account data, live writes or callbacks that mutate projects. If safe isolation or rendering is unavailable, document the omission instead of fabricating a successful preview. Do not add or run tests, create fixtures or change the app's test setup; this workspace uses compilation and direct inspection.

## Save into the existing Components page

Use `canvas_list_components` and `canvas_get_component` to match existing source/export/variant identities before saving. Reuse stable definition IDs and node IDs (including the rootNodeId of a definition with placed instances), skip unchanged entries and preserve unrelated definitions. Do not overwrite a manually curated component merely because its name matches.

Save small coherent batches through `canvas_edit_project` with a fresh `expectedRevision`:

```text
upsert_component {
  component: { id, name, description, rootNodeId, nodes, version: 0 }
}
```

The server stamps the saved revision. Updating a definition retains older release history and does not update placed instances. Each definition needs one root at local `(0, 0)` with `parentId:null`, unique node IDs and a connected descendant tree. Nested linked instances are unsupported. No staging pages or placed screen objects are needed; the library immediately displays `designSystem.components`.

Prefer editable native nodes where they faithfully represent the component. For source-backed components retain original HTML/JSX as passive source and include a faithful rendered specimen. Compile Tailwind utilities into the preview CSS when needed; the sandbox cannot run a Tailwind browser script or arbitrary application imports. Persist real media as uploaded asset references.

Record the source path, export, variant/state, public prop notes and limitations in the definition's description. Merge source evidence and a Component inventory section into the existing design-system documentation without discarding curated content. The project supports 200 definitions and 5000 nodes per definition; report omissions caused by limits.

Preserve saved node `notes`. Record implementation intent the passive specimen cannot express—such as native materials, behavior and preferred libraries—in `notes` on the relevant root or child (up to 5,000 characters). Root notes describe the reusable component; child notes remain scoped to that child. These notes follow releases and instance overrides, are readable in focused context and ship in implementation handoffs. Distinguish observed application requirements from proposals.

The existing library owns layout, pan, zoom, fit, selection and history. Do not implement another camera or replace its chrome with the upstream standalone-canvas layout. Group component families through consistent names and descriptions while retaining actual specimen dimensions.

## Inspect and report honestly

Library specimens are passive visual previews. They do not establish that application interactions, hooks, focus, portals, nested scrolling, responsive behavior or runtime themes work. If a safe live application preview is available, inspect relevant behavior with real pointer/keyboard input and report that separately. Do not fake hover/focus/pressed behavior by adding classes to the original component.

Check compilation and inspect saved definitions, visible previews and any real app behavior actually exercised. Report saved counts, coverage, omitted variants, unavailable previews and unverified behavior. An existing-app discovery must preserve its actual appearance rather than redesign it.

For queued requests, verify that the same request remains current and queued before each saved batch; stop if cancelled or replaced. Reread the request and revision after saving definitions and coverage. Clear `queued` only if that same request ID remains current, preserving its other fields; leave incomplete or interrupted work pending. A request being queued is not evidence that discovery ran.
