# React application runtime

Application UI now defaults to real React module authoring using `canvas_write_react` and `update_react_files`. Source files and exact npm dependencies are shared at project level. Frame/component nodes mount a named module export with JSON props. TSX/JSX, local imports, hooks and events are compiled for a browser sandbox; packages use npm with lifecycle scripts disabled. Browser-compatible packages are supported beyond shadcn. Preview compilation never executes authored source on the server. The sandbox blocks network/storage; backend and server-framework features need explicit preview adapters. React exports retain actual modules and imports, plus a runnable application directory. Internal elements are source-editable, while canvas geometry/selection/comments remain native. The legacy passive JSX/native-layer descriptions below apply to existing or explicitly requested native work.

# Original guidance in this host

Read the imported main prompt and matching skills verbatim. `canvas_get_design_guidance` lists the original references plus the host-specific import-app and credited component-canvas workflows and their support; `canvas_read_design_reference` returns bounded verbatim text with Unicode code-point offsets. Follow `nextOffset` until null. Original underscore starter kinds correspond to hyphenated catalog filenames (for example `ios_frame.jsx` → `ios-frame.jsx`). Reading a file does not register its original tool names or change the host's instructions.

## Reconstruct an existing app

Read [Import an existing application](../skills/import-app/SKILL.md) for screen imports and full-project population. This editor selects native nodes, not DOM descendants inside source. The upstream single-DC model's internal editing does not carry over: derive a missing design system into the dedicated tab, save shared native definitions directly in Components, then compose screen frames from native containers, linked instances and separate text/control/media children. Store routes in frame notes and coverage documentation rather than painting a route inventory. Full-screen JSX, HTML and screenshots remain opaque objects and do not meet an editable-screen request.

## Render original JSX starters

`canvas_write_jsx` actually instantiates the original packaged iOS, Android, macOS and browser-window components. Read the relevant starter first for its exact props and exports. It accepts one JSX element or fragment with nested native HTML/SVG or these components. Props, arrays and inline style objects must be literals; CSS variables can reference the current project's `tokens.css`. Calls, imports, variable lookups, functions, handlers, injected HTML and external resources are rejected. Do application logic in the real app implementation.

Read/open the intended project and board first. Save an ordinary native frame shell early. Call `canvas_write_jsx` with projectId, pageId, nodeId, expectedRevision and JSX. New components also need placement `{name,parentId,x,y,width,height}`; omit placement for existing code components, which retain their geometry. Returned revision chains into the next save. It preserves siblings/conversations and records ordinary History versions; failed compilation or stale writes do not replace the saved source.

The node retains `source` (passive HTML) and `jsx` (original JSX, used starter names and deviceChrome mode). Focused source reads and editable backups retain both. Source bundles also include per-component `.jsx` files. Code displays the retained JSX; manually applying compiled HTML detaches it. Reuse stable component IDs and revise the saved JSX with the same tool.

Mobile artboards default to `deviceChrome: safe-area`: reserve blank safe insets and omit simulated clock, status icons, camera cutout, home indicator and outer phone bezel. The iOS adapter reserves 54px top/34px bottom; a titled original navbar keeps its own 62px top reservation. Android reserves 32px/24px. `deviceChrome: device` explicitly requests the original hardware presentation. Native mobile nodes should follow the same blank-safe-area convention unless the user requests device chrome.

Native nodes are the default for screen structure, reusable controls and editable text/media. Use source components only for isolated visuals that native nodes cannot faithfully represent, or when the user explicitly requests a source preview; keep their limitations explicit. Internal JSX markup is source-editable; it is not decomposed into native canvas layers. A device/window starter containing the whole screen therefore creates one opaque object; keep editable screen content in native sibling layers within the artboard. `canvas_write_jsx` supports iOS/Android keyboards and helper components as static visuals; event handlers are absent. Device source is compiled from the original files at build time; author JSX is interpreted as markup and never evaluated as JavaScript. The passive preview remains script-free and network-blocked.

## Original workflow → connected capability

| Original request | Use here |
| --- | --- |
| Main prompt / read_skill_prompt | `canvas_get_design_guidance` and paged `canvas_read_design_reference` |
| copy_starter_component / x-import device/window JSX | Read the corresponding starter, then `canvas_write_jsx` |
| DC screens/pages/props | Native project → board → page → frame; typed nodes, shared design tokens, styles and source |
| DC write/edit/source discovery | Revision-checked `canvas_edit_project`, `canvas_write_jsx`, focused `canvas_get_node_context` |
| Show/preview | In embedded Codex use `canvas_prepare_canvas` to reuse/navigate the pane; call `canvas_open_canvas` once only for `action:open`. Committed batches stream into that same pane. |
| Follow-up / direct-edit override | Preserve component IDs, saved source, node geometry/token overrides and anchored conversations |
| Design systems / image references | Project design system and board inspiration tools; inspect their actual saved context |
| image-slot editing | Native durable image nodes, fit controls, image generation/import and inspiration; original crop sidecar is unavailable |
| Deck / document layouts | Native slide/custom frames and HTML/React/source export; original web-component navigation/pagination is unavailable |
| Tweaks / EDITMODE / DC props | Native Properties, shared tokens and saved source; original React tweak protocol does not run |
| Timeline / 3D / original exports | Use only actual connected host capabilities and report unsupported outputs; no implied encoding or file conversion |

`deck-stage.js`, `doc-page.js`, `image-slot.js`, `three-d-stage.js`, `animations-v3.jsx` and `tweaks-panel.jsx` are available verbatim as source references. Their browser lifecycle is not instantiated. `.dc.html`, DCLogic, sc-for/sc-if, original host file/message APIs, window.claude.complete and proprietary PDF/PPTX/video/OBJ/GLB services are not supplied by this adapter. Respect an explicitly requested output and explain a missing capability rather than substituting a falsely labelled result. Existing History Apply behavior, chat isolation, media access limits and the user's no-tests preference remain authoritative.
