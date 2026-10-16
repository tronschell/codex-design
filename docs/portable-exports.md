# Portable files and image exports

`.cxdp` (Codex Design Project) is the common editable export for a whole project, board, page, selected frame/subtree, diagram, reusable component or design-system library. `.cxd` already has an established use in HCImage; web searches on 2026-10-16 found no established file-format use for `.cxdp`, `.cxdg` or `.cxdn`. This is a collision check, not an exclusive extension registration.

The file is a deterministic store-only ZIP container with a version-1 `codex-design-project` manifest, `design.json` and content-addressed media in `assets/`. It preserves authored React modules, compiled previews, dependencies, native nodes, state definitions, diagram relationships, shared tokens, implementation notes, component definitions and scoped conversations. Full-project files also retain all boards and inspiration. Selected subtrees retain ancestor shells and `original-scope.json`. Library/component files have a blank canvas with their reusable definitions. Import creates a new project and history baseline; historical revisions do not travel. Existing JSON, library JSON and legacy ZIP imports remain available.

Use **Export → Codex Design · .cxdp**, or Download library / a component's export action. Import through the workspace browser. Files include original media, so moving the file does not require copying the private asset directory. Manifest version, document limits, ZIP paths/CRCs and required media SHA-256 values are checked before project creation. React source is not executed by import. Native component links follow the existing importer: current links rebase; instances requiring absent historical releases detach with their materialized appearance retained. Archives are capped at 256 MiB.

Git can track `.cxdp` as a binary file. Repeated exports of the same revision/scope contain no new timestamp or random ID. Keep the file in the application's repository, for example `design/app.cxdp`. Commit and push through normal Git commands; saving an export does not commit anything. For line-by-line review, keep a source export alongside the portable file. Installed system fonts are not bundled and may differ on another computer.

## Images

PNG and JPEG support selection, page, board, project and component scopes. Components have an Export image action with the same resolution, DPI and background controls. The editor exposes 1×–4× presets, optional pixel width/height, print DPI (1–2,400), JPEG quality (1–100), background, labels and margin. One custom dimension preserves proportions; two fit the artwork within that rectangle with background padding. DPI changes physical print dimensions without resampling pixels. PNG writes pHYs metadata and preserves alpha; JPEG writes JFIF density and flattens transparency onto white. Images are bounded to 16,384 pixels per side and 64 megapixels. Pixel-based size ranges are explicitly heuristic; prepared files report exact byte counts and SHA-256.

Images render in a short-lived isolated Chrome/Chromium process on the design server. No browser package or test dependency is installed. Chrome is discovered in standard macOS/Windows locations and PATH; set `CODEX_DESIGN_CHROME_PATH` to an executable for another installation. The renderer uses DevTools pipes without a debug TCP listener, a temporary profile, blocked network requests, a 60-second deadline and one concurrent render. No sandbox-disabling Chrome flags are used. React executes in its existing opaque-origin preview sandbox and captures initial render. Arbitrary HTML scripts remain disabled. Videos use posters or the first decodable frame; shaders render at time zero when the browser/GPU supports them. Missing images, shader failures and React error overlays stop export. External images/fonts are unavailable in this offline renderer; embed resources. Browser/device fonts can be substituted. Existing standalone SVG/HTML/source exports remain available without Chrome.

## Agent workflow

1. Finish edits through the normal revision-checked design tools.
2. Optionally call `canvas_estimate_export` with `projectId`, scope and `format:"cxdp"`, `"png"` or `"jpeg"`.
3. Call `canvas_prepare_export` with the same settings and `expectedRevision`. For example:

```json
{"projectId":"<project-id>","expectedRevision":12,"format":"cxdp"}
```

```json
{"projectId":"<project-id>","expectedRevision":12,"pageId":"<page-id>","nodeIds":["<frame-id>"],"format":"png","image":{"width":2400,"dpi":300,"background":"transparent","margin":0,"labels":false}}
```

4. Save the returned `exportId` using `canvas_save_export {exportId,filePath:"/absolute/repository/design/app.cxdp"}`. The directory must exist. `overwrite:true` explicitly replaces an existing file atomically; otherwise creation is exclusive. Local file tools are model-only and registered only in local stdio entrypoints. HTTP/app callers use `canvas_read_export_chunk` to download/decode bytes. Handles last 15 minutes and may be evicted when the four-file/256-MiB cache fills.
5. On another computer, call `canvas_import_file {filePath:"/absolute/repository/design/app.cxdp"}`, then open the returned project. The editor's Import supports the same file.

Use `library:true` for a portable design system or `componentId` for one reusable definition; do not combine those with board/page/node scope. For image scenarios, pass `pageId` and `state:{frameId,scenarioId?,values:{}}`. `.cxdp` keeps all state definitions. `canvas_export_project` also accepts `format:cxdp/project/png/jpeg` and returns the prepared handle under `file`; its existing source formats retain their original text-file response.

The editor uses the same server renderer as the agent, retrieves bounded 1-MiB chunks and checks the final SHA-256. Closing the panel cancels retrieval; an already-started server render finishes or hits its 60-second deadline. The output is never applied to the editable design. Exports wait for the editor's pending field saves; agent callers should use `expectedRevision`.

## Direct verification

Production compilation/build and direct export inspection only; no tests, fixtures or test dependencies were added or run. A copy of the existing GaugeReel Mobile revision 4 exported to a 205,459-byte `.cxdp` and reopened as one board/page containing all 412 nodes. Its sign-in frame rendered at 720 × 1,480 pixels: PNG 71,259 bytes and JPEG at quality 85 61,839 bytes. `sips` reported 300 DPI in both axes for both files, alpha present in PNG and absent in JPEG. These are actual output sizes for that design and settings, not performance measurements or universal compression ratios. The source project was left unchanged.

A read-only render of the existing Sidecup React Discover screen produced an 84,831-byte PNG at 780 × 607 pixels, 144 DPI; its actual application UI was visually inspected. No saved design was changed.
