---
name: import-app
description: Bring an existing application into Codex Design as real React screens with shared source components, dependencies and design tokens.
---

# Import an application as React screens

Application screens should look and behave like the actual application. React is the default authoring path. Do not replace real controls, layouts, charts or typography with collections of approximate rectangles and labels. Shadcn is optional; retain the application's own components and use any compatible React ecosystem library that fits the application.

Read the connected canvas project and revision first. Open its intended board, inspect its existing design system, source files, components and saved notes. Keep stable IDs and existing conversations. A request to show components or derive tokens remains scoped to that request; it does not authorize replacing screens.

## Inspect the application

Read AGENTS.md, DESIGN.md, package.json, routes, layouts, component source, styles, assets and provider requirements. Inspect the actual rendered app when available, at the target viewport. Build a compact route/state coverage list in documentation. Separate observed values from inference. Preserve real typography, spacing, density, hierarchy, iconography, imagery, content and interactive states.

If no DESIGN.md exists, derive the observed design system into the project's Design system tab with semantic tokens, source evidence and component rules. Keep routes and file inventories in notes/documentation rather than painting them into screens.

## Preserve a real module graph

Use `canvas_write_react` for screens or reusable component specimens. Save JSX/TSX modules in `designSystem.react.files`; relative imports and `@/` (mapped to `src/`) resolve shared modules. Declare browser-compatible npm libraries with exact versions. Packages are bundled locally with install scripts disabled. React hooks, component composition, props and event handlers run in an isolated browser preview. The compiler does not execute application source on the server.

Reuse existing application source when compatible. Keep one shared Button, navigation component, input or chart implementation and import it into every screen. If using shadcn, include its actual customized component source and dependencies. Do not recreate it as a native shape approximation. Other component systems, chart libraries, motion libraries and styling choices are equally valid. Follow existing app styling; use Tailwind for new styling unless instructed otherwise.

Each screen is a frame with a `react` binding `{entry,exportName,props?}`. Keep a separate entry for each meaningful route/state/viewport. Screen entries may wrap shared providers, routing context and realistic local data. Use state and events for supported interactions. Adapt server-only modules, private APIs and backend calls to explicit local preview adapters without altering the approved visual design or claiming a working backend. The preview blocks network/storage and embeds bundled code without CDNs. The exported application runs in an ordinary React environment.

Save shared files using `update_react_files` through `canvas_edit_project` when no new screen is needed. It merges file/dependency changes; a null value deletes a file/dependency. Shared changes rebuild referencing screens together. Compilation failure preserves the previous saved project. Never overwrite unrelated files in a shared application or delete modules still needed by another screen.

## Components and canvas editing

Register every reusable inner UI component in the Components library as part of screen authoring, not as a separate optional discovery step. Use the components array on canvas_write_react (or upsert_component in the same canvas_edit_project transaction), with stable IDs, a frame/code root bound to its defining module export, realistic JSON preview props, and appropriate preview dimensions. Screens must import that same implementation. Use a preview adapter for required providers. The compiler marks JSX DOM elements in bound component definitions so clicking an inner component opens its isolated preview and shared source editor; choosing it in Components opens the same editor. Keep meaningful controls and sections in exported components instead of one monolithic screen function. Boundaries are React component selections, not editable copies of every DOM element.

The Components tab contains definitions whose root is a code/frame node with a React binding. Save them with `upsert_component`, using the same application source as the screen imports; give specimens meaningful props and preserve root IDs. `instantiate_component` places the saved binding and editable geometry on a canvas. Native release pinning applies to bindings, props and geometry; React source modules are project-wide and update every importer when edited. Do not describe a native release as pinning an independent copy of its React source.

Frame position, dimensions, selection and comments remain native canvas features. Selecting a registered React component opens its own editing page; edits to its source update every importer. DOM elements inside that component remain source-edited. Bind to the module that defines its JSX rather than a barrel re-export. A component implemented entirely by an opaque third-party render function may need a local JSX adapter for selectable bounds. Use native child layers for diagrams, wireframes or an explicit request for individual native layer editing. Existing native designs remain valid and should not be replaced without intent. Static `canvas_write_jsx` remains a legacy preview path, not the default application renderer.

## Build progressively and inspect

Create named frame shells early, with the correct viewport and `generation:{status:"building"}`. Save coherent shared components and screen entries progressively. Bind a frame only when its source compiles; mark it ready after its content is complete. Chain returned revisions and rebase on conflicts.

Compare rendered screens with the source application at matching viewports. Inspect actual fonts, spacing, content density, responsive layout and control states. Exercise meaningful UI interactions directly when available. React alone is not proof of fidelity: a generic box layout is still incomplete. Do not claim an application is imported based on route names, file inventories, blank shells or node counts.

Use builds, compilation and direct inspection. Do not add, generate or run tests or fixtures. Report completed screens, shared components, missing views, preview adapters and behavior actually inspected. Exports retain authored modules, dependency manifests and real React imports; they must not replace React screens with HTML in an iframe in the React source export. Clear queued requests only after their matching work is saved and the request ID is still current.
