# Codex Design · Diagram workspace

Existing editor chrome plus proposed native diagramming patterns.

## Design guide

Read [DESIGN.md](DESIGN.md) and [COMPONENTS.md](COMPONENTS.md). Load styles.css once; it imports tokens.css and the component styles. Component folders contain named React JSX, sibling TypeScript declarations, prompt Markdown, full Markdown/code references and passive HTML specimen cards. Read saved root and child implementation notes in each component reference before translating its visual specimen; notes can specify native materials, behavior and preferred libraries. Original source is retained in source/ and in the editable definition; source snippets may depend on their original starter environment. No compiler-generated _ds_bundle.js or manifests are fabricated.

## Initialize another Codex Design project

Import a dedicated Download library ZIP through the project menu to create a separate project with this library and an empty canvas. Source/React archives also include these references, but their design.json restores the original scoped canvas; use codex-design.library.json to initialize only the library from those archives. For an agent, pass the project field from codex-design.library.json (format codex-design-library, version 1) to canvas_import_project; upload any listed media through the asset tools first. The JSON file itself is also accepted by the project importer. Referenced media is carried in assets/ and manifest.json in the ZIP; JSON alone needs those assets in the destination store.

The versioned JSON preserves current tokens and bindings, component IDs, editable nodes, literal values, effects, gradients, advanced properties, shaders, media references and authored HTML/JSX. Unknown format versions are rejected. Imported components begin a new local history baseline; the source release numbers remain in this archive, while prior release journals, canvas instances/screens, conversations, inspiration and queued agent requests are not copied. To edit Markdown, initialize from JSON first and apply the edited DESIGN.md through the normal revision-checked document action. Markdown/code is a readable reference, not executable import instructions.

New application styling defaults to Tailwind CSS unless the user explicitly requests traditional CSS or another styling approach. The bundled CSS preserves the approved visual reference. React output retains the approved visual layout and existing passive-source restrictions. Props are deliberately empty; arbitrary source code is not converted into React behavior. Code layers marked live run their own inline scripts inside a sandboxed iframe on mount and reset if the frame navigates. Fonts require the same fonts in the consuming environment.
