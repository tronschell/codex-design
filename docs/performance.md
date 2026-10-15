# Performance measurements

## Content-addressed save history — October 14, 2026

Measured on macOS arm64 with Node.js 24.19.0, using `npx tsx` against `ProjectStore` in fresh scratch data directories. No user project was read or changed. There are three generated workloads made from copies of the GaugeReel demo, with the same node styling as the canvas-scaling workload:

- 3 copies on 1 page (0.42 MB of JSON)
- 12 copies on 1 page (1.69 MB)
- 12 copies, one per page, across 12 pages (1.69 MB)

Each workload is imported once. Then 20 sequential `update_node` saves move the first root frame. The table reports:

- median and p90 save time over saves 3–20
- growth of the history directory per save, excluding the import
- one `listVersions` call over 21 revisions
- one `getVersion(5)` call

The before and after columns are each the mean of two runs of the same script, run in the same order. Raw output is in `artifacts/history-save-before.txt` and `artifacts/history-save-after.txt`, which are ignored by Git.

| Workload | Measurement | Before | After | Absolute change | Percentage change |
| --- | --- | ---: | ---: | ---: | ---: |
| 3×, 1 page | Save median | 61.95 ms | 56.90 ms | −5.05 ms | −8.2% |
| | Save p90 | 66.20 ms | 59.30 ms | −6.90 ms | −10.4% |
| | History per save | 433 KB | 433 KB | 0 | 0% |
| | List versions | 21.60 ms | 7.60 ms | −14.00 ms | −64.8% |
| | Get revision | 18.00 ms | 15.45 ms | −2.55 ms | −14.2% |
| 12×, 1 page | Save median | 142.60 ms | 86.65 ms | −55.95 ms | −39.2% |
| | Save p90 | 149.90 ms | 91.00 ms | −58.90 ms | −39.3% |
| | History per save | 1,729.5 KB | 1,729.5 KB | 0 | 0% |
| | List versions | 71.55 ms | 13.55 ms | −58.00 ms | −81.1% |
| | Get revision | 67.85 ms | 48.40 ms | −19.45 ms | −28.7% |
| 12×, 12 pages | Save median | 144.30 ms | 83.50 ms | −60.80 ms | −42.1% |
| | Save p90 | 147.70 ms | 88.75 ms | −58.95 ms | −39.9% |
| | History per save | 1,730.6 KB | 146 KB | −1,584.6 KB | −91.6% |
| | List versions | 76.20 ms | 14.45 ms | −61.75 ms | −81.0% |
| | Get revision | 70.20 ms | 43.15 ms | −27.05 ms | −38.5% |

Changes, in `server/history.ts` and `server/store.ts`:

- **History format 2 stores pages as content-addressed blobs.** Each page, the design system and the comment threads are written as `history/<id>/blobs/<sha256>.json`. A blob that already exists is skipped. Each revision directory now holds a small `snapshot.json` that lists those hashes, plus the remaining project fields inline. The project file is assembled from the same JSON fragments, so each save serializes the project once.
- **The head is verified by hash, not by reading it back.** Before, every save read the previous revision's full snapshot and compared it as JSON to the project in memory. Now the store remembers the hash of each project it committed and compares it with `version.json`. The full read-back compare runs only if the hashes differ. That can happen, for example, when a legacy document was normalized on read. A scratch check that counted `readVersion` calls on the 12-page workload found 0 read-backs over 20 warm saves, and 0 on the first save of a freshly started store. A cold store hashes its serialized project once instead.
- **One clone per save.** `mutate` reads the cached project without cloning it, clones it once as the working copy, and caches the validated result after saving. Before, the cached read and the working copy each cost a full `structuredClone`. *Not measured separately:* the earlier 120× profile timed one clone at 27.4 ms.
- **Retention keeps everything.** Nothing is pruned, and unreferenced blobs are never collected.

User effect:

- On the 1.69 MB workloads, a server-side save (`ProjectStore.mutate`) now takes about 84–87 ms instead of 143–144 ms. *Estimate, not measured in the UI:* agent edits and canvas drops should reach "All changes saved" about 60 ms sooner. Network time and client reconciliation weren't measured.
- Server-side `listVersions` is about 5× faster. *Estimate:* the History panel opens correspondingly faster, but that wasn't timed in the browser.
- On a project split across 12 pages, an edit to one page adds 146 KB of history instead of 1.7 MB. 20 saves now grow history by 2.9 MB instead of 34.6 MB.

Limits:

- An edit still writes the whole changed page as a new blob. So a single-page project gains nothing in history size, and the 3× workload (one page, little else) improves least.
- Each save still rewrites the full `<id>.json`.
- Fields other than pages, the design system and threads are inlined, so every revision rewrites them. That includes `boards` (up to 100) and `tokens`. On this workload `snapshot.json` is 1,703 bytes, with `boards` at 119 bytes and `tokens` at 122 bytes.
- Integrity: the head check confirms the version record, not the blob bytes on disk. Because existing blobs are skipped, a blob corrupted on disk keeps being referenced by later revisions. The corruption only surfaces on preview or restore, and the project file stays intact. Temporary `.blob-*` files left by a crash are never cleaned up.
- Each save still runs the full zod `projectSchema` validation, and `libraryChanges` still stringifies the design system and components twice. Both are left for phase 2.
- The time left in the 3× save was not broken down. *Estimate, not measured:* it is mostly fixed costs such as validation, fsync calls and the write lock.
- The get-revision result for the 12×, 1-page workload varied between runs: 52.8 ms and 44.0 ms.

Compatibility:

- Existing format-1 history stays readable. The first save on such a project upgrades `manifest.json` and the `.history-<id>.json` marker to format 2, then adds format-2 revisions alongside the old `project.json` revisions.
- Older plugin builds reject format-2 history ("Saved history metadata has an invalid structure.") instead of misreading it. Don't run an older build against the same data directory after upgrading.

A scratchpad script checked compatibility directly. It used the unchanged `HEAD` history module to write format-1 revisions 0–1, then confirmed the following with the new store:

- new saves upgrade the manifest and marker
- the version list spans both formats
- format-1 previews are byte-identical
- restoring a format-1 revision and a format-2 revision both work
- a cold store verifies the head by hash and keeps saving
- an interrupted save left in `pending.json` rolls back and saving resumes
- a tampered page blob fails with a checksum error

`npm run typecheck` and `npm run build` pass. No tests, dependencies or fixtures were added or run.

## Large-project canvas scaling — October 14, 2026

Workload: a generated project made of 12 copies of the GaugeReel demo, giving 4,944 nodes, 192 root frames, 900 vertical-stack parents and 2,448 token-bound text nodes on one page (1.77 MB of JSON). It lived in a scratch data directory; no user project was read or changed. The before and after runs each used freshly regenerated data and a fresh local dev server with React development Strict Mode and `?profile=1`, in the same 1024 × 736 stage of the built-in browser pane. That pane was hidden, which throttles `requestAnimationFrame`, so both runs mapped rAF to a MessageChannel macrotask. A step means event dispatch, two macrotasks, then a forced layout. These numbers are main-thread work per step, not frame rate. Paint and raster were not measured. Each figure comes from a single run.

Sequence: fit all (`1`), 60 wheel-pan steps, 40 ctrl+wheel zoom steps, fit all again, pointerdown on empty canvas, then drag the first root frame through 60 pointer moves and drop it, timing until the status reads "All changes saved".

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Drag: mean step | 62.16 ms | 11.43 ms | −50.73 ms | −81.6% |
| Drag: p95 step | 125.2 ms | 22.1 ms | −103.1 ms | −82.3% |
| Drag: worst step | 131.1 ms | 34.4 ms | −96.7 ms | −73.8% |
| Drag: React render time, 60 moves | 2,136.7 ms | 445.0 ms | −1,691.7 ms | −79.2% |
| Drag: design-node renders, 60 moves | 593,280 | 120 | −593,160 | −99.98% |
| Drop to saved | 383.4 ms | 328.8 ms | −54.6 ms | −14.2% |
| Drop: React render time | 47.4 ms | 8.3 ms | −39.1 ms | −82.5% |
| Drop: design-node renders | 9,888 | 2 | −9,886 | −99.98% |
| Drop: SVG parses | 1,776 | 0 | −1,776 | −100% |
| Pan: mean step | 4.65 ms | 1.80 ms | −2.85 ms | −61.3% |
| Pan: p95 step | 13.7 ms | 6.1 ms | −7.6 ms | −55.5% |
| Pan: React render time | 165.7 ms | 29.4 ms | −136.3 ms | −82.3% |
| Zoom: mean step | 8.50 ms | 8.24 ms | −0.26 ms | −3.1% |
| Zoom: p95 step | 31.2 ms | 24.6 ms | −6.6 ms | −21.2% |
| Zoom: React render time | 150.8 ms | 176.8 ms | +26.0 ms | +17.2% |
| Zoom: design-node renders | 3,822 | 2,652 | −1,170 | −30.6% |
| Fit-all mount | 222.2 ms | 237.2 ms | +15.0 ms | +6.8% |
| Pointerdown on empty canvas | 37.8 ms | 33.6 ms | −4.2 ms | −11.1% |

Changes:

- **Unchanged layers keep their identity.** Each server snapshot is reconciled against the previous one (`share` in `src/useProject.ts`): records are matched by id, and every unchanged node, page, thread and token reuses its existing object. The canvas child index keeps sibling arrays when nothing beneath them changed, and memoized layers compare only their own child list. Token resolution and stack positioning take an optional WeakMap cache, which only the editor passes. The server mutates its working copy in place, so server and export paths stay uncached. Result: a drag or a save re-renders the moved frame instead of all 4,944 layers.
- **Undo history stores references.** Entries used to hold `structuredClone` copies of the page before and after, plus its threads, and each edit ran `JSON.stringify` on both pages. Entries now point to the shared snapshots, and the staleness check uses identity first, then a structural compare. *Estimate, not measured:* on this 1.77 MB page, 60 entries previously retained up to 120 full page copies. Now each entry adds only the objects that edit changed plus new arrays of pointers. Each save also skips about 3.5 MB of stringification and four deep clones.
- **Frame labels are culled to the stage, and comment pins look up their anchors by id instead of scanning every node per thread.** Two labels rendered for two onscreen frames at 91%, with none offscreen. `layoutFrameLabels` measured 0.56 ms per call in isolation on this workload, so its O(frames²) loop was left alone.

User effect: on a corporate-scale page, the mean main-thread work per drag pointer move fell from 62 ms to 11 ms. That fits within a 16.7 ms frame budget at 60 Hz on average. The p95 step is 22.1 ms, which is still over budget. *Estimate:* the earlier drag could not exceed about 16 fps. Drops, agent edits and saves from other sessions no longer re-render the whole canvas. The before and after runs used the same script and order. Pan also measured faster, but the workload has no comment threads, it renders no frame labels at fit zoom, and no pan-path code changed, so this delta isn't attributed to any specific change. Reproduce it before relying on it. Zoom, fit-all, pointerdown and drop-to-saved (a single run that depends on the network) show no reliable change: the zoom render-time and fit-all increases are within the variance seen between earlier runs. Component-library previews already mount lazily through `IntersectionObserver`, so thousands of components do not mount at once.

Checks: after the drag, the frame was saved at x = 2595. Undo restored (80, 280) and redo restored 2595, confirming that reference-based undo entries round-trip. `npm run typecheck` and `npm run build` pass. Production JS is 3,405.68 kB (965.74 kB gzip). The before bundle was not built, so no bundle-size delta is claimed.

Not measured: RAM (the `performance.memory` readings of 63–125 MB were too coarse and depend on garbage-collection timing), paint, frame rate and production-build interaction timings.

**Scaling ceiling (needs a product decision).** This workload is close to the current hard limits. At demo density a project caps out near 190 frames: `MAX_INPUT_BYTES` (2 MiB, `shared/validation.ts`) also bounds the API JSON body, the `/mcp` body (`2mb`) and history `snapshotLimit`, and pages and components are capped at 5,000 nodes each. A 25× copy of the demo (about 10,300 nodes) was rejected. Hundreds of frames with thousands of components will need these coupled limits raised together, and ideally paged or per-board persistence. That was left unchanged.

Raw captures: `artifacts/scale-canvas-before.json` and `artifacts/scale-canvas-after.json` (ignored by Git). No tests, dependencies or fixtures were added or run.

## Progressive canvas synchronization — October 14, 2026

Measured on macOS arm64 with Node.js 24.19.0, using the existing GaugeReel project at revision 4: one board, one page, 16 frames and 412 nodes. The project remained unchanged throughout both measurements. No test data was created and no design document was modified.

Method: a read-only local HTTP profile reproduced the previous embedded 2.5-second full-project refresh schedule for 20 seconds, then used the new sequential ten-second revision-watch requests for the same idle workload. Response bodies were counted as UTF-8 bytes. The before window lasted 20.002 seconds; the after window lasted 20.026 seconds. These are controlled API measurements, not browser-wide network or memory measurements. They exclude project-list requests, request/response headers, MCP envelopes and initial loading.

| Metric | Before | After | Net effect |
| --- | ---: | ---: | --- |
| Idle project-sync requests | 8 | 2 | 6 fewer; 75% reduction |
| Idle project-sync response-body bytes | 1,000,064 | 162 | 999,902 fewer; 99.98% reduction |
| Full project bodies during idle window | 8 | 0 | Unchanged heartbeats carry no design document |

The two unchanged watch responses were 81 bytes each. After the idle window, a read-only catch-up request from revision 3 returned revision 4 with all 412 nodes in 6.01 ms. This measures already-saved revision retrieval, not save-to-paint latency.

User effect: an idle canvas no longer repeatedly downloads the entire project. During generation, saving frame shells and then component groups exposes useful work incrementally; native file/store notifications wake a waiting canvas without the former scheduled 2.5-second refresh delay. Compact `includeProject: false` acknowledgements also keep repeated full project documents out of the agent's build conversation.

Limits: the 99.98% figure applies only to the measured idle project response-body payload. Changed revisions still deliver a complete project snapshot, and nearby saves may coalesce. No memory, CPU, frame-rate, total generation-time, newly-saved-event latency, model-context size, or actual cross-host MCP traffic improvement was measured. No percentage improvement is claimed for those metrics. The compact edit-result format and frame-first workflow were inspected, not benchmarked. There are no artificial frame reveal delays.

Raw local captures: `artifacts/progressive-sync-before.json` and `artifacts/progressive-sync-after.json` (ignored by Git). Measurements used direct profiling and inspection; no tests, dependencies or fixtures were added or run.

## Canvas rendering and startup — October 14, 2026

This pass uses the same unchanged GaugeReel revision 4 (412 nodes, 19 roots, 16 frames, 74 SVG images, zero HTML iframes). The baseline is commit `7a24af6` with development-only profiling counters added before either capture. Both sides use the same local Vite server, React development Strict Mode, browser and macOS machine. No project data was created or edited.

### Zoom interaction

Method: with the first frame selected and Properties open, fit all content, then choose these eight zoom settings from the actual toolbar: 25%, 50%, 100%, 50%, 25%, 50%, 100%, 25%. The canvas stage is 422 × 821 CSS pixels on both sides. A React Profiler records `actualDuration` for commits where the camera changes; counters record component invocations and SVG parsing/encoding. Values below subtract the counters immediately before the sequence from those immediately after it. Automation wait time is excluded.

| Metric across eight zoom changes | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| React rendering work | 184.90 ms | 80.00 ms | −104.90 ms | −56.73% |
| Mean React work per camera commit | 23.11 ms | 10.00 ms | −13.11 ms | −56.73% |
| Design-node component invocations | 6,592 | 728 | −5,864 | −88.96% |
| SVG parses/encodes | 1,184 | 112 | −1,072 | −90.54% |
| Inspector layer rows regenerated | 304 | 0 | −304 | −100% |

There are eight camera commits on each side. Strict Mode invokes component functions twice, so the invocation counts are development work counts, not unique nodes. Both sides already cached tree indexes between camera updates; this sequence did not rebuild them. New frames entering the render gutter still mount and encode their source, accounting for the remaining after work.

User effect: zooming performs substantially less React work, leaving more main-thread time for input and painting. This is a measured CPU-work reduction, not a measured frame-rate or input-latency improvement. Wheel and hand-pan updates also accumulate into one pending animation-frame update, preserving every wheel delta; that scheduling change was inspected directly and has no separate percentage claim.

### Offscreen work

Method: select `01 Sign in`, choose Fit selection, then 100% zoom with Properties open. Both captures have exactly the same 422 × 821 stage and `translate(-64px, -259.269px) scale(1)` camera. Count only design elements inside `.canvas-world`.

| Mounted content | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Design-node elements | 412 | 57 | −355 | −86.17% |
| SVG image elements | 74 | 8 | −66 | −89.19% |
| Root frames | 16 | 2 | −14 | −87.50% |

Only clipped frame/code roots outside a 200-screen-pixel gutter are omitted. The selected root remains mounted during editing, and an active text edit is blurred/saved before canvas selection can remove that retained root. Roots whose children may overflow remain mounted. All layers, frame labels, navigation, source and saved data remain available; approaching a frame renders it synchronously. This reduces the amount of mounted content the browser manages. **It is not a measurement of RAM saved.** Heap and process-memory tools were unavailable.

### Loading and full-scene CPU

Warm navigation method: three reloads of the same explicit project/board/page URL with browser cache warm, Inspector closed, and the same 702 × 821 stage. The development-only ready mark records navigation start to the first animation frame after a project/page becomes available. It is not LCP, TTI or a production page-load metric.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Median warm navigation ready mark | 149.90 ms | 160.40 ms | +10.50 ms | +7.00% |
| Full-scene React server-render median | 3.182 ms | 2.352 ms | −0.830 ms | −26.09% |
| Full-scene React server-render p95 | 8.266 ms | 8.356 ms | +0.090 ms | +1.09% |

Warm reload samples were 176.9/149.9/145.1 ms before and 170.1/160.4/149.4 ms after. Their ranges overlap, the sample is small, and the median got slower; **no loading-speed improvement is established**. Selected canvases now load independently of the project menu, and a validated, scope-matching embedded launch snapshot can avoid a redundant full-project read. That embedded fast path was inspected in source, but not timed against a reloaded host runtime, so no host-launch improvement is claimed.

The separate full-scene measurement uses Node.js 24.19.0 and `renderToStaticMarkup`: five warmups followed by 30 timed renders in a fresh process on each side. It renders every root without viewport culling. Before uses the frozen baseline's per-root NodeView; after uses the shared CanvasNodes index. Both produce 211,959 bytes of markup. This isolates component/index CPU from browser layout, paint, networking and input; it does not predict browser load time. The tail did not improve.

Implementation: one child index per scene, memoized node/source/style work, stable canvas and Inspector callbacks, indexed layer lookup, source generation only while the Code tab needs it, comment-only hover tracking, viewport culling, and animation-frame camera updates. The `?profile=1` instrumentation runs only in development and is removed from the production bundle. No new dependencies were needed.

Bundle tradeoff: the standalone embedded widget grows from 451,196 to 455,199 bytes (+4,003 bytes, +0.89%), or 130,018 to 131,413 bytes with gzip (+1,395 bytes, +1.07%). This pass optimizes work after loading; it does not reduce download size.

Limits: no FPS, dropped-frame, paint, actual input latency, browser heap, process RAM, or cross-host launch timing was available. Larger boards and HTML-iframe-heavy designs were not profiled. No improvement is claimed for those workloads or metrics. Direct inspection covered hand panning, selection, Properties/Code, frame preview navigation, history mode and component conversation placement; it did not apply a historical version or alter a design.

Raw captures (ignored by Git): `artifacts/canvas-camera-{before,after}.json`, `canvas-dom-{before,after}.json`, `canvas-load-{before,after}.json`, and `canvas-render-{before,after}.json`. The development profile is exposed on `#root[data-canvas-profile]`; no telemetry is sent. No tests, test scripts, fixtures or test dependencies were added or run.


## Paper-inspired media, shaders and scoped handoff — October 14, 2026

This batch adds image/video assets, bounded WebGL effects, layer filtering and scoped export. Measurement uses the unchanged saved GaugeReel Mobile revision 4: one board/page, 412 nodes, 16 frames and 74 passive SVG sources. No user design was modified. No tests were added or run.

### Focused agent context

Method: compact UTF-8 `JSON.stringify` length of the actual structured output for a full `canvas_get_project` read versus the new source-inclusive `canvas_get_node_context` read of `01 Sign in` (`gauge-2`, 28 nodes). Both use the same normalized saved project. The focused response retains the current revision, complete subtree source, tokens, bounds and applicable conversations; ancestors are returned for nested selections. This compares the appropriate read for a component task, not two equivalent whole-project reads.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Component-task structured response | 125,020 B | 7,814 B | -117,206 B | -93.75% |

User effect: a component comment or handoff can send about 7.8 kB of relevant design context instead of 125 kB of unrelated screens. This is a measured response-byte reduction, not a measured token count, cost, model latency or RAM saving. The old full read remains available when wider context is needed. Current comment/handoff prompts choose the focused tool for anchored components.

### Export CPU and feature cost

Method: frozen `shared/export.ts` from commit `1c40907` versus current `exportProjectBundle`, read-only in the same Node.js 24.19.0 process. Ten warmups per version, then forty timed samples per version, interleaved with alternating order to reduce ambient/GC order bias. Both export the same normalized document to 20 text files, 601,006 UTF-8 bytes. This measures the existing HTML/source bundle path, not new media archives or React output.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Export CPU median | 2.729 ms | 2.557 ms | -0.172 ms | -6.30% |
| Export CPU p95 | 3.792 ms | 3.851 ms | +0.058 ms | +1.54% |

The median improved slightly while the tail did not. Separately timed pre/post runs measured 2.738 → 3.360 ms median (+0.622 ms, +22.74%) and 3.479 → 4.559 ms p95 (+1.080 ms, +31.04%). Those runs were far apart in time; their disagreement with the interleaved comparison shows why no meaningful loading/export speed improvement is established. The shared child index now appends in place instead of repeatedly copying sibling arrays; no broad canvas-speed claim is inferred from this microprofile.

Method for feature cost: exact widget bytes from the previously installed artifact (SHA-256 `120a5689cb96d901217d3495846045384b075cb96f2c15eea61d765fa68f0dc0`) and the final production build, plus Python gzip default compression on each with mtime zero. The widget remains self-contained; media binaries are never bundled into it.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 455,497 B | 524,114 B | +68,617 B | +15.06% |
| Embedded widget, gzip | 130,854 B | 151,951 B | +21,097 B | +16.12% |

User effect: the richer tools add download/parse bytes; this batch does not improve initial bundle size. Media URLs are shared by mounted references and released afterward. Videos are passive while editing; shaders default static, use at most one million drawing pixels and 30 animated draws per second, and stop offscreen/background. Stable menu preview settings avoid reinitializing WebGL on unrelated rerenders. These are inspected resource controls, not measured percentages of GPU, FPS or memory savings. No runtime dependency was added.

### Direct inspection and limits

The local browser displayed all three real WebGL thumbnails without errors, filtered Welcome layers while preserving their frame, generated the selected heading's React/CSS at 338 × 42 px, and downloaded an actual 824,613-byte page source ZIP. Direct archive inspection found 24 files, revision 4, all 412 design nodes, a version-1 manifest, and the page's React/CSS files. Exporting did not change the saved document. The production build and exported JSX compilation passed.

No native video playback, media-upload roundtrip, imported-backup roundtrip, custom GLSL GPU execution, large-media archive timings, browser heap/process RAM, paint/FPS/input latency, or refreshed installed-host Blob/download/clipboard behavior was measured in this batch. Browser codec support and host CSP behavior remain practical limits. PNG capture and compressed/repacked ZIP import remain unavailable. No claim is made for those paths. Existing history, comments, source and per-chat binding are retained.

Raw ignored artifacts: `paper-export-before.json`, `paper-export-after.json`, `paper-export-paired.json`, `paper-context-payload.json`, `paper-widget-before.json`, `paper-widget-after.json`, `paper-shader-menu.png` and `paper-export-panel.png` under `artifacts/`.


## Stack alignment feature cost — October 14, 2026

This is a layout capability addition, with no claim of faster interaction or lower memory use. Method: exact production `dist/widget.html` bytes and Python gzip default compression (mtime zero), from the committed media/export build before this change and the final stack-alignment build on the same machine. No dependencies were added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 524,114 B | 526,491 B | +2,377 B | +0.45% |
| Embedded widget, gzip | 151,951 B | 152,677 B | +726 B | +0.48% |

User effect: stack parents can align and distribute fixed-size children without individually calculating coordinates, and child position fields accurately show layout-controlled coordinates. The small widget increase is the cost of the additional controls and layout calculation; it is not a loading improvement. Defaults retain previous start positioning. The canvas, component context, history comparison, HTML and React use the same resolver.

Build/type compilation and a bounded source review covered main/cross-axis placement, minimum gaps, padding, hidden/empty/single-child stacks, clamped overflow, scoped ancestor exports, optional schema compatibility and read-only coordinate fields. A review found and corrected stale Escape cancellation when switching from a read-only coordinate field to an editable one. The existing 412-node GaugeReel revision 4 has no stack parents and was not modified. New stack editing was not exercised in the live browser; no new example designs, fixtures or tests were generated. No stack CPU, load-time, FPS, latency or RAM metric was measured, and no gain is claimed for those metrics.

Raw ignored byte measurements: `artifacts/stack-layout-before.json` and `artifacts/stack-layout-after.json`.


## Stack detachment correctness fix — October 14, 2026

Switching a parent from vertical/horizontal stack to Free position now freezes only its visible direct children's resolved local coordinates in the same atomic save. This prevents the arrangement from jumping to stale raw coordinates; no speed or memory improvement is claimed. REST and MCP use the same store operation. Imports, page replacements and History Apply keep exact stored geometry.

Method: exact production artifact lengths and Python gzip default compression (mtime zero), from committed build `d52f4f2` before this change and the completed fix build on the same machine. No dependencies were added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 526,491 B | 526,569 B | +78 B | +0.01% |
| Embedded widget, gzip | 152,677 B | 152,709 B | +32 B | +0.02% |
| MCP runtime | 919,624 B | 920,057 B | +433 B | +0.05% |
| MCP runtime, gzip | 184,313 B | 185,494 B | +1,181 B | +0.64% |

Compilation and bounded source review covered shared API/MCP handling, operation order, hidden children, nested stacks, geometry-only writes, validation rollback, and page-snapshot undo/history. Positions are captured immediately before the parent patch; later operations can intentionally move the free children. Computed out-of-range coordinates fail validation instead of being clipped or partly saved. Existing designs were not edited; the local 412-node GaugeReel document remains revision 4 and has no stacks. Live detachment was not exercised, no tests or generated example/fixture projects were created, and no CPU, load-time, FPS, latency or RAM result is claimed.

Raw ignored size measurements: `artifacts/layout-detach-before.json` and `artifacts/layout-detach-after.json`.


## Cancellable media imports — October 14, 2026

This is a usability and resource-control addition, with no measured speed or memory improvement. Canvas imports, Inspector file replacements and video-poster uploads can now be stopped, including automatically during navigation or History. A shared REST/MCP operation removes only unfinished upload directories under the existing write lock. Completed assets, already-added nodes, saves in progress and historical versions remain intact.

Method and workload for feature cost: exact production artifact lengths and Python gzip default compression with mtime zero, using committed build `0d02c77` before this change and the final cancellation build on the same machine. Both artifacts contain the complete widget/runtime; no media or new dependency is bundled.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 526,569 B | 529,015 B | +2,446 B | +0.46% |
| Embedded widget, gzip | 152,709 B | 153,412 B | +703 B | +0.46% |
| MCP runtime | 920,057 B | 922,021 B | +1,964 B | +0.21% |
| MCP runtime, gzip | 185,494 B | 185,879 B | +385 B | +0.21% |

User effect: an unwanted import no longer has to finish sending all remaining chunks before the user can stop it. Successful pending cleanup releases its upload slot and temporary bytes. An in-flight embedded RPC or final design save may finish first; upload creation deliberately completes before cancellation so its ID is known. Cleanup is best effort when disconnected or connected to an older host, with the existing one-hour expiry as fallback. These are inspected behavior/resource bounds, not measured transfer-byte, disk, RAM or elapsed-time savings. The artifact increases above are feature costs, not loading improvements.

Production compilation and bounded source review passed. A fresh local HTTP MCP initialization and read-only `tools/list` inspection confirmed the cancellation tool's strict input/output schemas, idempotent annotation, app/model visibility and lack of a canvas-navigation resource binding. The review found and fixed Inspector uploads continuing during navigation loading. No mutation tool was called for verification, and the saved 412-node GaugeReel document remained at revision 4.

Limits: no live upload/cancel or replacement roundtrip, installed-host runtime behavior, native codec, cancellation latency, transferred bytes avoided, temporary disk bytes released, browser/process memory, CPU, load-time, FPS or input latency was measured. No improvement is claimed for those metrics. Completed-asset deletion, upload resume and rollback of already-saved changes are not implemented. No tests, fixtures, example projects or dependencies were added or run.

Raw ignored captures: `artifacts/media-cancel-before.json`, `artifacts/media-cancel-after.json` and `artifacts/media-cancel-catalog.json`.


## Layer selection navigation — October 14, 2026

This is a navigation and keyboard-usability fix, with no loading or memory improvement claimed. Selecting a frame or component now reveals its row in the Layers panel without moving the canvas or changing focus. An explicit Reveal selected layer action clears an excluding filter and reopens the selected ancestor path. Ordinary scrolling/collapse is retained until the selection/context/ancestry changes or Reveal is requested. Native buttons now retain Space activation instead of passing it to the canvas hand-pan shortcut.

Direct-inspection method and workload: the same unchanged GaugeReel revision 4, one page, 16 frames and 412 nodes, in the local Vite browser at 702 × 853 CSS pixels. On each side, mount a fresh Inspector with `16 Ready` selected. Read the selected row and layer-list bounding rectangles from the rendered DOM. The list spans Y=90–266 CSS pixels on both sides; the 22-pixel row is at Y=488–510 before and Y=243–265 after. List scrollTop changes from 0 to 245 CSS pixels. Visible row height is the intersection of those rectangles.

| Usability measurement | Before | After | Absolute change |
| --- | ---: | ---: | ---: |
| Selected row visible height | 0 of 22 CSS px | 22 of 22 CSS px | +22 CSS px; 0% → 100% visible (+100 percentage points) |

User effect: the current component can be found immediately in the layer list, including after selecting a deeply nested component or recovering from a filter. This is measured visibility, not a rendering-speed or latency metric. Manual collapse, filtered recovery and Enter/Space activation were directly inspected without editing the design; the Reveal button retained keyboard focus.

Method for feature cost: exact committed production artifact lengths before this change (`70ab213`) and the final compiled build on the same machine; Python gzip default compression with mtime zero. No dependency was added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 529,015 B | 530,335 B | +1,320 B | +0.25% |
| Embedded widget, gzip | 153,412 B | 153,844 B | +432 B | +0.28% |
| MCP runtime | 922,021 B | 922,021 B | 0 B | 0.00% |
| MCP runtime, gzip | 185,879 B | 185,879 B | 0 B | 0.00% |

Production compilation and one bounded source review with a focused confirmation passed. The review caught and fixed unrelated node updates reopening manually collapsed ancestors and the global Space shortcut suppressing native button activation. Per-project/page selection keys, changed ancestry, missing/filtered selections, unchanged ordinary edits and the absence of document writes were inspected in source. The local saved document stayed at revision 4 with 412 nodes.

Limits: no property-edit or cross-project/page navigation workload was performed to verify the guard, and no refreshed installed-host behavior, full-width desktop view, browser/process RAM, CPU, load time, input latency, FPS or dropped-frame metric was measured. No gains are claimed for those metrics. No tests, fixtures, generated example designs or dependencies were added or run.

Raw ignored captures: `artifacts/layer-reveal-before.json`, `artifacts/layer-reveal-after.json`, `artifacts/layer-reveal-ui.json`, `artifacts/layer-reveal-after.jpg` and `artifacts/layer-reveal-frame-after.jpg`.


## Anchored image-generation feature cost — October 14, 2026

This is a feature addition, not a measured optimization. Component comments can request native image generation with persisted intent; the active agent receives layout-aware placement guidance and can import an actual native output into durable assets before applying a normal versioned edit. The model chooses semantic placement from the request, source and layout. No generation is simulated or started by the editor itself.

Artifact method and workload: exact committed production artifact lengths from `e1eb45d` before this feature and the final compiled feature build on the same machine; Python gzip default compression with mtime zero. No media bytes or new dependency are bundled.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 530,335 B | 534,024 B | +3,689 B | +0.70% |
| Embedded widget, gzip | 153,844 B | 155,179 B | +1,335 B | +0.87% |
| MCP runtime | 922,021 B | 943,310 B | +21,289 B | +2.31% |
| MCP runtime, gzip | 185,879 B | 191,609 B | +5,730 B | +3.08% |

User effect: a component's image request retains its prompt and conversation while the agent can choose an appropriate box/aspect ratio and save a reusable image in context. The widget/runtime increases above are feature costs; no faster load, lower RAM, transfer savings or generation-time improvement is claimed. The importer reads at most 32 MiB plus a sentinel byte and uploads through existing bounded chunks. These are inspected limits, not measured process-memory or import-latency results.

Read-only contract inspection used the unchanged GaugeReel revision 4, one board/page, 16 frames and 412 nodes. A fresh production stdio process advertised the importer as model-only and not widget-accessible. A separate in-memory connection with the same default factory options as HTTP did not advertise it; no listener, file import or mutation was invoked. A real `canvas_get_node_context` read for source-backed node `gauge-67` (`Editable mountain footage`) with `includeImagePlacement:true` returned its 73 × 138 local box, absolute box at 1075/586 CSS pixels, source flag and parent constraints. Its complete structured response was 4,568 UTF-8 bytes, including a 2,497-byte imagePlacement object. This measures payload cost for that one source layer, not a representative image-generation workload.

The ordinary first-frame `gauge-2` response, without image placement, was 7,814 bytes using compact `JSON.stringify` length, matching the previous recorded focused-read size for the same saved frame. Source inspection confirms the new field is opt-in rather than added to every read. No model token, cost, latency or RAM result is inferred from payload bytes.

Production compilation and one bounded source review passed. Review covered intent validation/persistence, follow-up and queue consistency, transport visibility, size/path/symlink checks, bounded reads/uploads, revision-aware placement guidance and retention of source, layout and conversations. The saved document remained revision 4 with 412 nodes. Browser access to the current pane was rejected by URL policy; UI verification used source/compiled output instead of additional browser attempts.

Limits: native generation, result-path compatibility, raster decoding, actual import/placement/reply roundtrips, installed-host UI/clipboard/Blob behavior, adversarial filesystem races, CPU, load-time, browser/process RAM, FPS, input latency and generation duration were not exercised or measured. Directory membership does not prove a file's producer, and Node lacks atomic multi-component `openat` traversal against hostile same-user path replacement. No tests, fixtures, generated example assets/designs or dependencies were added or run.

Raw ignored captures: `artifacts/image-request-before.json`, `artifacts/image-request-after.json`, `artifacts/image-request-contract.json` and `artifacts/image-request-http-catalog.json`.

## Design system and inspiration feature cost — October 14, 2026

This adds shared design knowledge, explicit token links and board references; it is not a measured speed or memory optimization. The user can edit one project-wide system, generate/discover it through the active agent, reuse named properties and collect annotated images per board. No dependency or media bytes were added to the bundle.

Artifact method and workload: exact previous production artifacts from `4aed987` and the final feature build on the same machine, measured by file length and Python gzip default compression with mtime zero. Both include the self-contained embedded editor and bundled Node runtime.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 534,024 B | 608,844 B | +74,820 B | +14.01% |
| Embedded widget, gzip | 155,179 B | 175,948 B | +20,769 B | +13.38% |
| MCP runtime | 943,310 B | 978,877 B | +35,567 B | +3.77% |
| MCP runtime, gzip | 191,609 B | 200,978 B | +9,369 B | +4.89% |

User effect: the additional UI/runtime provides the token canvas/editor, inspiration canvas/imports, compatible Inspector bindings, conflict-preserving drafts, derived DESIGN.md/CSS and agent workflows. These byte increases are feature costs, not faster-loading claims. Vite reports the main chunk over 500 kB before compression; embedded mode still bundles its UI for operation without a web server or external script resources.

Read-only payload workload: the same unchanged local GaugeReel revision 4, one board/page, 16 frames and 412 nodes. A fresh compiled stdio process read `canvas_get_node_context` for `gauge-2` (`01 Sign in`) with default options. Compact UTF-8 `JSON.stringify(structuredContent)` length is 7,814 → 7,874 B (+60 B, +0.77%). The new focused response contains only the system name and actually bound tokens (zero for this existing frame), and optional effective styles/positions when they differ. Full documentation, sources and requests stay in the dedicated getter rather than repeating in each component read. No model-token, cost, latency or RAM claim follows from byte length.

The same process advertised the three new read tools with strict input/output schemas, read-only annotations and app/model visibility. Reads confirmed five safely normalized legacy tokens, a 439-byte DESIGN.md, 196-byte CSS, empty board inspiration/request queues, root DESIGN.md/tokens.css in the source export, and a read-only historical system at revision 4. Saved JSON remained 124,856 B with identical SHA-256 before/after inspection. New mutations were not called for verification.

Source-inspected resource behavior: near-viewport image mounting uses a 160 CSS-pixel prefetch margin and releases offscreen MediaNode references while keeping card dimensions/focus; switching to a library unmounts the hidden design scene's node renderers, avoiding hidden shader/video work and eager root media reads. Collection-level token resolution creates one lookup map per collection, instead of rebuilding it per linked node; the real saved project has no explicit bindings, so no representative bound-board CPU measurement is available. HTML/React export loads only actual design media, while source/editable archives retain board inspiration. These statements describe implementation bounds, not measured savings.

Production compilation and one bounded source review with focused fixes/confirmation passed. Review resolved legacy-value compatibility, focused-output schema and live-update draft-loss issues. No tests, fixtures, verification designs/assets or dependencies were added or run.

Limits: browser URL policy blocked the current pane, so the new UI, token edits/propagation/deletion, draft-conflict interactions, inspiration upload/paste/cancel, native image decoding, DESIGN.md clipboard/download, Generate/Find delivery and repository discovery/generation, installed-host behavior and mutation roundtrips remain unexercised. Browser/process RAM, CPU, actual transferred bytes, load time, input latency, frame cadence/FPS and model duration were not measured. No gains are claimed for those metrics. Exported absolute stack coordinates remain a snapshot; changing CSS spacing variables outside the editor does not automatically reflow them. Aliases/component instances are outside this batch.

Raw ignored captures: `artifacts/design-system-before.json`, `artifacts/design-system-after.json` and `artifacts/design-system-contract.json`.


## SVG document-variable compatibility — October 14, 2026

This is a rendering-correctness fix, not a measured optimization. SVG source with CSS `var(...)` now uses the existing sandboxed document renderer so project token definitions remain available in canvas/preview, HTML and React. Self-contained passive SVG source keeps its image path; raw SVG export explains its self-contained-source requirement. Source, dimensions, layout and stored designs are preserved.

Artifact method: exact production outputs from `1ea8ca1` and the compiled fix on the same machine, using file byte length and Python gzip default compression with mtime zero. No dependency was added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 608,844 B | 608,939 B | +95 B | +0.016% |
| Embedded widget, gzip | 175,948 B | 175,980 B | +32 B | +0.018% |
| MCP runtime | 978,877 B | 978,972 B | +95 B | +0.010% |
| MCP runtime, gzip | 200,978 B | 201,010 B | +32 B | +0.016% |

User effect: generated illustrations that reference named design-system values retain access to those values rather than losing them at an image-document boundary. This follows the inspected render path; no pixel, load-time, CPU, memory, FPS or input-latency improvement is claimed.

Read-only compatibility workload: two fresh production stdio processes, first the previously installed runtime and then the current compiled runtime, reading the same saved GaugeReel page (revision 4, 16 frames, 412 nodes, 74 source layers). Compact export file bytes and SHA-256 were identical: page HTML 193,254 B, React JSX 98,423 B, React CSS 119,832 B, DESIGN.md 439 B and tokens.css 196 B. Saved JSON remained 124,856 B with the same SHA-256. This document has zero source layers using CSS variables, so these reads establish compatibility for the existing content, not visual verification of the corrected case.

Production compilation and bounded direct caller/source inspection passed. Browser URL policy still blocks the pane; variable-backed SVG visual rendering, format-disabled messaging and refreshed installed-host behavior were not exercised. No tests, fixtures, generated designs/assets or dependencies were added or run. Raw ignored captures: `artifacts/svg-token-before.json`, `artifacts/svg-token-after.json` and `artifacts/svg-token-export-inspection.json`.


## Resizable Inspector, object effects and Advanced feature cost — October 14, 2026

This is a requested feature addition, not a measured loading or memory optimization. The right Inspector and library editors resize with locally remembered widths. All settings/library/Export selectors use the same compact rounded, keyboard-operable menus; named color choices show actual swatches. Objects gain all six editable effects and Advanced CSS properties, shared by persisted history, MCP, canvas/preview and HTML/React exports.

Artifact method and workload: exact production artifacts from `4f20ebe` immediately before this batch and the final compiled build on the same machine. Read file lengths and Python `gzip.compress(..., compresslevel=9, mtime=0)`. Both sides include the complete self-contained editor and bundled Node runtime; no dependencies or media were added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 608,939 B | 642,402 B | +33,463 B | +5.50% |
| Embedded widget, gzip | 175,980 B | 186,261 B | +10,281 B | +5.84% |
| MCP runtime | 978,972 B | 990,878 B | +11,906 B | +1.22% |
| MCP runtime, gzip | 201,010 B | 204,074 B | +3,064 B | +1.52% |

User effect: adjustable working space, consistent color-aware controls and direct visual effect editing without losing component source or conversations. The increases above are feature costs. Vite still reports its existing main-chunk size warning; no faster loading, reduced memory, latency, CPU or frame-rate result is claimed.

Read-only contract workload: the same saved GaugeReel revision 4, one board/page, 16 frames and 412 nodes, using fresh production stdio MCP clients against the previous installed runtime and current compiled runtime with the same data directory. The catalog keeps 27 tools and now includes all six effect variants and 15 Advanced style fields in generic node/edit/context schemas. Project, focused node, image-placement, history-list and export reads succeeded. The first-frame focused response remains 7,874 → 7,874 B (0 B; 0.00%). The source-backed image-placement response is 4,628 → 4,640 B (+12 B; +0.26%), reflecting border-aware derived absolute coordinates; these are document calculations, not measured browser geometry or latency.

The existing page's HTML (193,254 B), React CSS (119,832 B), DESIGN.md (439 B) and tokens.css (196 B) retain identical SHA-256 values. React JSX remains 98,423 B; direct read comparison isolates its changed hash to single-to-double quoting of 74 SVG `objectFit: fill` string literals. Saved JSON remains 124,856 B with the same SHA-256, `012cd37bcad35cb535b4b78f4bdd6961cbcb2d7b8d70dfac52de40cd3fd81339`. No mutation or generated verification design was used.

Production compilation and bounded source review passed. Review resolved conflicting effect-save replay, focus loss while locking/rolling back saves, popup dismissal and dialog Tab/Escape behavior, SVG/video fit overrides, inverse parent placement/dragging, and stale clipping/fit in agent context. Numeric drafts clamp to their displayed limits. Legacy styling without the optional new fields retains its behavior; CSS-wide legacy shadow keywords yield to structured shadows instead of invalidating the combined declaration.

Limits: browser URL policy remains unresolved, so resizing, menus/popovers, focus behavior, real effect edits, Advanced edits, history roundtrips and refreshed installed-host rendering were inspected in source/compiled contracts rather than exercised. Existing data has no structured effects or Advanced fields. Transform bounds include parent borders/transforms, but shadow/blur extents do not enlarge selection bounds; extreme overflowing transforms fall back to layout geometry. Transformed ancestry uses Inspector Width/Height instead of corner drag-resize; the transient drawing rectangle remains axis-aligned until placement. Background blur depends on browser support and backing content. Fixed dimensions take precedence over aspect ratio, and named animations require destination keyframes. Browser/process RAM, load time, CPU, input latency and FPS were not measured. No tests, fixtures, example assets/designs or dependencies were added or run.

Raw ignored captures: `artifacts/inspector-before.json`, `artifacts/inspector-after.json` and `artifacts/inspector-contract.json`.


## Canvas and within-frame snapping feature cost — October 14, 2026

This implements requested alignment behavior rather than a measured performance optimization. Dragging and corner resizing use a 6-CSS-pixel capture range, transient edge/center guides and an Option/Alt bypass. Parent interior/sibling targets provide within-frame alignment; other root frames/objects and origin provide page-wide alignment. Stack positions, hidden trees and locked ancestry retain their constraints. Agent `snap_node` uses the same geometry with an explicit design-unit distance, independent of browser preferences.

Artifact method/workload: exact production artifacts from `84b0a44` before this batch and the final compiled build on the same machine. File byte lengths and Python `gzip.compress(..., compresslevel=9, mtime=0)` for the self-contained widget and Node runtime. No dependency or media was added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 642,402 B | 649,366 B | +6,964 B | +1.08% |
| Embedded widget, gzip | 186,261 B | 188,704 B | +2,443 B | +1.31% |
| MCP runtime | 990,878 B | 1,000,084 B | +9,206 B | +0.93% |
| MCP runtime, gzip | 204,074 B | 206,480 B | +2,406 B | +1.18% |

User effect: magnetic edge/center alignment reduces manual positioning while the held Option/Alt key allows free movement. The measured bytes are feature cost, not loading/latency or RAM savings. Vite retains its existing large-main-chunk warning. Snap candidates are collected and sorted once per gesture; pointer movement performs binary nearest-anchor lookup rather than rebuilding all candidate geometry. At most two guide paths are drawn. These are inspected implementation bounds, not measured CPU/FPS results.

Read-only contract workload: fresh old/current production stdio processes, identical saved GaugeReel revision 4, one page, 16 frames and 412 nodes. The catalog retains 27 tools; generic editing now advertises strict `snap_node` input with optional distance default 8, minimum 0 and maximum 100 design units. Real project/focused-context/HTML/React reads passed. The first-frame focused result remains 7,874 → 7,874 B (0 B; 0.00%). Every generated HTML/React/CSS/DESIGN.md/tokens.css file hash is identical. Saved JSON remains 124,856 B with SHA-256 `012cd37bcad35cb535b4b78f4bdd6961cbcb2d7b8d70dfac52de40cd3fd81339`; its history metadata hash also stayed unchanged. No mutation or verification design was used.

Compilation and bounded source review passed. Review fixed click-only resize saves, stale gestures after selection/modal/preview/context changes and ancestor-lock parity. Pointer release recomputes the final geometry/modifier state rather than reading a potentially stale React preview. Cancel/Escape/lost capture/blur discard unsaved gesture geometry; agent revisions invalidate cached targets. Undo/duplicate/delete shortcuts also cancel an active gesture before acting.

Limits: browser URL policy remains unresolved; real dragging/resizing, live guides, held modifiers, cancellation, mutation/history roundtrips and refreshed installed-host behavior have not been exercised. Transformed drags use world-axis visual bounding boxes and inverse parent coordinates; transformed corner resizing keeps its existing property-only limit. Stack children resize without positional snapping. Drawing/insertion, equal spacing, multi-selection, reparenting and clipping-aware painted outlines are not implemented by this batch. Browser/process memory, CPU, load time, input latency, frame cadence/FPS and model duration were not measured. No tests, assertions, fixtures, generated verification designs/assets or dependencies were added or run.

Raw ignored captures: `artifacts/snapping-before.json`, `artifacts/snapping-after.json` and `artifacts/snapping-contract.json`.


## Temporary pan recovery on focus loss — October 14, 2026

This is an input-lifecycle correction, not a measured speed or memory optimization. Source inspection found that canvas blur canceled its gesture but left the temporary Space modifier/cursor latched, while library panning had no window-blur/document-hidden cancellation. A missed key release outside the app could therefore make later canvas clicks pan unexpectedly. Root Space release is now observed in capture phase before popup bubbling handlers; blur/document hiding reset the temporary modifier, cancel unsaved gestures/guides and flush the latest pending camera view. Library blur/hiding cancels pan, releases its known pointer capture and clears temporary Space state. The explicitly selected Hand tool, library drafts and uploaded/saved content remain intact.

Artifact method/workload: production `0b39fd5` before this correction and the compiled focus-only build on the same machine. Exact file lengths and Python gzip level 9 with mtime zero; complete self-contained widget and Node runtime. No dependencies were added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 649,366 B | 650,037 B | +671 B | +0.10% |
| Embedded widget, gzip | 188,704 B | 188,818 B | +114 B | +0.06% |
| MCP runtime | 1,000,084 B | 1,000,084 B | +0 B | +0.00% |
| MCP runtime, gzip | 206,480 B | 206,480 B | +0 B | +0.00% |

The user effect is recovery from a potentially stuck temporary Hand mode after leaving the pane. These bytes are maintenance cost; no latency, CPU, FPS or RAM result was measured. The MCP runtime hash is identical. Local saved design JSON and history metadata byte lengths/hashes remain identical; no design was changed for verification.

Production compilation and bounded direct source inspection passed, covering stable listener dependencies, matching capture-phase cleanup, hidden-only visibility handling, no intercepted normal button activation, pointer release and preservation of the explicit Hand tool. Browser access remains blocked by URL policy; real OS focus switching, popup/host event propagation, pointer-capture behavior and installed-host UI were not exercised. No tests, assertions, fixtures or verification designs/assets were added or run.

Raw ignored captures: `artifacts/focus-loss-before.json` and `artifacts/focus-loss-after.json`.


## Stable select width during scrolling — October 14, 2026

Fixed the user-reported menu width feedback loop. Placement previously read the already constrained popup's `scrollWidth` and used it as its next outer width. That inner measurement excludes borders/scrollbar space, while active-row changes also reran placement, allowing repeated scroll/hover events to progressively narrow the menu. The shared Select now measures its natural outer border box independently on opening or option changes, restores temporary sizing immediately before layout is placed, and reuses that width for trigger/viewport repositioning. Active-row validation and reveal no longer restart the placement effect. Rounded menus, color swatches, viewport clamping, keyboard/typeahead and scrolling remain in the shared component.

Artifact method/workload: production focus-recovery build at `701f17d` before this fix and the final compiled select build on the same machine. Exact byte lengths and Python gzip level 9 with mtime zero for the complete widget/runtime. No dependency or new UI option was added.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 650,037 B | 650,268 B | +231 B | +0.04% |
| Embedded widget, gzip | 188,818 B | 188,860 B | +42 B | +0.02% |
| MCP runtime | 1,000,084 B | 1,000,084 B | +0 B | +0.00% |
| MCP runtime, gzip | 206,480 B | 206,480 B | +0 B | +0.00% |

This is a correctness correction; artifact deltas are maintenance costs, not measured performance gains. The user-supplied screenshots demonstrate the pre-fix narrowing, but no CSS-pixel before/after width or swipe latency was measured. The fix's sizing and listener paths were directly inspected and compilation passed. The runtime SHA-256 and local design/history metadata hashes are unchanged. No existing design was edited for verification.

Limits: browser URL policy remains unresolved, so actual swipes, viewport/Inspector resizing, option mutations, keyboard navigation and refreshed installed-host interactions remain unexercised. Load time, CPU, RAM, input latency and FPS were not measured. No tests, assertions, fixtures, verification designs/assets or dependencies were added or run.

Raw ignored captures: `artifacts/select-width-before.json` and `artifacts/select-width-after.json`.


## Project conversation list — October 14, 2026

The comment caret now opens a complete current-project conversation list, with open and resolved sections, saved Codex response previews and navigation to the full component thread across boards/pages. The list is mounted only while open and derives its contents from the existing document; no new persistence or runtime APIs are needed. This is a usability feature, without a loading, CPU, memory or frame-rate improvement claim.

Method/workload: the production widget/runtime from `963a7d9` before the feature and the final conversation-list build on the same machine. Exact artifact byte lengths and Python gzip level 9 with mtime zero; all existing editor features remain bundled. Values are build costs rather than end-user timing measurements.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 650,268 B | 658,736 B | +8,468 B | +1.30% |
| Embedded widget, gzip | 188,860 B | 190,677 B | +1,817 B | +0.96% |
| MCP runtime | 1,000,084 B | 1,000,084 B | +0 B | +0.00% |
| MCP runtime, gzip | 206,480 B | 206,480 B | +0 B | +0.00% |

Practical effect: resolved conversations become accessible from the editor, with full saved replies and a direct route to their component. This behavior is established by source/compiled contracts; it has not been exercised in the installed UI. The MCP runtime SHA-256 remains unchanged. The actual 124,856-byte GaugeReel document and 30-byte history metadata retain the same hashes and revision 4. It contains zero comment threads; no sample conversations or user-design changes were generated for verification.

Production compilation and a bounded source review passed. Browser URL policy still blocks inspection, so populated list rendering, scrolling, cross-board/page clicks, keyboard/focus, Send/Resolve mutations and installed-host interactions remain unexercised. CPU, RAM, load time, input latency and FPS were not measured. No tests, assertions, fixtures, verification designs/assets or dependencies were added or run.

Raw ignored captures: `artifacts/comments-list-before.json` and `artifacts/comments-list-after.json`.


## Compact selection properties — October 14, 2026

Added the screenshot-based text/object toolbar for a closed Properties panel, including token-backed/custom styling, anchored dialogs and retained component-comment/More actions. It mounts for the current visible selection and uses a measured toolbar box; hidden ancestry, pointer gestures, text editing, libraries, history and open conversations keep it out of the way. Shared persisted styling supports italic, lists, safe links, real axis padding and stack-only margins. This is a usability feature; no loading, CPU, memory or FPS improvement is claimed.

Artifact method/workload: the production `4b269c0` widget/runtime before this feature and the final compiled selection-toolbar build, same machine and dependencies. Exact byte lengths and Python gzip level 9 with mtime zero for the complete self-contained widget/runtime. These are feature costs, not speed or memory gains.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Embedded widget | 658,736 B | 688,838 B | +30,102 B | +4.57% |
| Embedded widget, gzip | 190,677 B | 198,056 B | +7,379 B | +3.87% |
| MCP runtime | 1,000,084 B | 1,006,694 B | +6,610 B | +0.66% |
| MCP runtime, gzip | 206,480 B | 208,249 B | +1,769 B | +0.86% |

Read-only workload/method: fresh SDK stdio clients against the prior installed runtime and the new production runtime, both pointed at the same saved GaugeReel revision 4, page-1, first frame. No design mutations or generated examples. Serialized structured response bytes were measured with Node Buffer over JSON.stringify.

| Actual read | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Ordinary focused component context | 7,874 B | 7,874 B | +0 B | +0.00% |
| Component context with image placement | 16,734 B | 17,834 B | +1,100 B | +6.57% |
| Page HTML export response | 197,299 B | 197,299 B | +0 B | +0.00% |
| Page React export response | 230,054 B | 230,054 B | +0 B | +0.00% |

Practical effect: a closed Inspector stays closed while selecting/creating, and common whole-object properties are reachable beside the selection. The compact toolbar/interaction is source-inspected rather than measured in a browser. Placement payload grows only for the opt-in axis/margin layout description. The ordinary context and every actual HTML/React/CSS/DESIGN.md/tokens.css export file remain identical to the installed baseline. New markup/helper rules emit when their features are used, preserving existing source output for this unmodified document.

The saved 124,856-byte project and 30-byte history metadata keep their prior SHA-256 hashes; revision 4, 412 nodes, 16 frames. This document has no stack layouts or new links/lists/axis properties, so these reads establish legacy compatibility and output-schema acceptance, not the visual correctness of newly authored cases. Production compilation and bounded source review passed. The review corrected popup-close/save focus, hidden ancestry, misleading uniform padding, nested React-link pointer events, default tracking and native canvas event boundaries.

Limits: browser URL policy remains unresolved. Real bar geometry, wrapping, popup scrolling/search, keyboard/focus, native color picker, new style/link/list/spacing mutations, undo/history and installed-host interactions remain unexercised. Native video controls take precedence over links (own href remains reachable with keyboard or padding); explicit pointer-events may intentionally intercept/disable containing links. Text formatting applies to the entire plain-text node; typography Theme references existing individual project tokens rather than composite/range-level text styles. CPU, RAM, load time, latency and FPS were not measured. No tests, assertions, fixtures, generated verification designs/assets or dependencies were added or run.

Raw ignored captures: `artifacts/selection-toolbar-before.json`, `artifacts/selection-toolbar-after.json`, `artifacts/selection-toolbar-before-reads.json`, `artifacts/selection-toolbar-after-reads.json`.

## Original JSX authoring bridge — October 14, 2026

This is a feature/packaging cost measurement, not a measured speed or memory improvement. Method: Node `fs.statSync(...).size` on the previously installed plugin and the final production build, same machine and uncompressed files. Workload is the packaged MCP entry, widget and new on-demand authoring modules; no designs or media are included in these counts.

| Artifact | Before (bytes) | After (bytes) | Absolute change | Change |
| --- | ---: | ---: | ---: | ---: |
| Main MCP runtime | 1,006,694 | 1,028,189 | +21,495 bytes | +2.14% |
| Canvas widget | 688,838 | 690,001 | +1,163 bytes | +0.17% |
| Original compiled starter families | absent | 103,910 | +103,910 bytes | new module |
| JSX parser/static renderer | absent | 2,066,083 | +2,066,083 bytes | new module |
| These four files combined | 1,695,532 | 3,888,183 | +2,192,651 bytes | +129.32% |

The first compiled bridge put its parser/React server renderer in the main entry (3,092,120 bytes). Moving authoring into an on-demand module reduced that entry to 1,028,189 bytes: −2,063,931 bytes (−66.75%) relative to that intermediate implementation. This is an observed artifact comparison, not a runtime benchmark; review fixes and export documentation also landed before the final build. Normal project reads/edits do not import the JSX renderer or starter registry. The first JSX write loads them; total package code increases and module caching retains them afterward. The practical effect is keeping the new parser out of ordinary canvas-tool startup, rather than making the entire plugin smaller.

Cold-start time, first-JSX-write latency, CPU, heap/RSS, browser memory, visual rendering time and frame rate were not measured. No percentages for those metrics are claimed. Native static rendering and real MCP authoring/export of the requested design artifact provide direct functional inspection, without tests, assertions, fixtures or test dependencies. Live browser interaction remains unverified because the browser policy blocked local preview access.

## Generation loading chrome and maintainability — October 14, 2026

This batch adds visible loading state and removes confirmed dead code; it is not a claimed runtime optimization. Comparable measurement: Python `Path.stat().st_size` on the previously installed production artifacts from commit `8a20718` and the new production build, on the same machine, with the same build command and no design/media payloads.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 690,001 B | 692,711 B | +2,710 B | +0.39% |
| MCP runtime | 1,028,189 B | 1,030,019 B | +1,830 B | +0.18% |
| Compiled original starters | 103,910 B | 103,910 B | 0 B | 0.00% |
| JSX renderer | 2,066,083 B | 2,066,083 B | 0 B | 0.00% |

Practical effect: explicitly generating frames show grey with a subtle wipe while real saved batches arrive, then return to their authored background when marked ready. After two idle minutes, the wipe stops and says Waiting for Codex; Properties can stop it without deleting content. Animation uses CSS transforms, no React animation loop; hidden/offscreen views and reduced motion suppress movement. Generation timestamps are excluded from yellow visual-diff highlights. Source and preview/export appearance remain independent of editor loading chrome.

Production build/package, strict unused-symbol compilation and bounded source review passed. All 32 imported reference hashes still match the provenance manifest. No CPU, RAM, load-time, input-latency, FPS, compositor/GPU cost or generation-duration metric was measured; no gains are claimed. Actual live loading transitions and sidebar rendering require the refreshed host. No tests, assertions, fixtures, test scripts or dependencies were added or run.

## Export cancellation lifecycle — October 14, 2026

This is a correctness/quality-of-life change, not a measured runtime optimization. Comparable artifact method: Python byte counts of the installed `36e5d88` production files and the new build, same machine/build command, widget and MCP entry only; no designs or media are included.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 692,711 B | 693,740 B | +1,029 B | +0.15% |
| MCP runtime | 1,030,019 B | 1,030,019 B | 0 B | 0.00% |

User effect: closing Export stops pending preparation instead of allowing a surprise later download or clipboard write. Revision/target changes cancel the old action and request a current export. Abort signals reach chunked media reads and FileReader conversion; completion/error notices are bounded to the active action. The MCP runtime is byte-identical, and shared source generators and persistence are unchanged.

Verification uses production compilation/package and direct source inspection of every export caller and asynchronous boundary, without tests, assertions, fixtures or scripts for testing. Actual cancellation latency, bytes avoided, CPU, heap/RSS, browser RAM, load time, input latency and FPS were not measured; no improvement percentages are claimed. Real installed-host close-during-media/clipboard/download behavior was not exercised. A host RPC already in flight may complete, already dispatched side effects cannot be undone, and synchronous ZIP construction cannot yield to a close event mid-operation. No user designs were mutated.

## SVG branding footprint — October 14, 2026

Measured artifact comparison, not a runtime speed/memory claim. Method: Python Path.stat().st_size over the installed f09082a artifacts and the current checkout/build, on the same machine; workload is the plugin branding files, standalone favicon, compiled widget and MCP entry. Two theme SVGs replace one shared PNG.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Plugin logo assets | 167,189 B | 542 B | −166,647 B | −99.68% |
| Standalone favicon | 4,088 B | 351 B | −3,737 B | −91.41% |
| Canvas widget | 693,740 B | 693,740 B | 0 B | 0.00% |
| MCP runtime | 1,030,019 B | 1,030,361 B | +342 B | +0.03% |

User effect: the mark remains crisp at sidebar/icon sizes and has explicit light/dark contrast. The MCP server reads the two small packaged SVGs and exposes inline icons in initialization and canvas-resource metadata; branding no longer depends solely on manifest PNG paths. The widget is unchanged. No startup/decoding time, requests/bytes transferred, CPU, RAM, FPS or sidebar rendering improvement was measured. The SVG previews and real MCP metadata were inspected; actual host sidebar caching/rendering still needs confirmation after reload. Existing design data is separate from these artifact counts. No tests were added or run.

## Shift-click selection footprint — October 14, 2026

This is a usability feature, not a measured runtime optimization. Comparable artifact method: Python Path.stat().st_size over the installed `f745ad6` production files and the final production build, on the same machine using `npm run build`; workload is the self-contained editor widget and MCP entry, excluding user designs/media.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 693,740 B | 699,489 B | +5,749 B | +0.83% |
| MCP runtime | 1,030,361 B | 1,030,383 B | +22 B | +0.0021% |

User effect: Shift-click accumulates or removes objects, and group moves/nudges/duplication/deletion save as one undoable change. Selection export and agent context include all selected IDs. Group snapping excludes the moving subtrees, and inverse parent transforms preserve world-space offsets. Group resizing applies only to untransformed free-positioned roots and retains descendant content sizes. No interaction-time, throughput, load-time, CPU, heap/RSS, GPU, browser-memory or FPS measurements were collected; no speed or memory improvement is claimed.

Verification uses production build/package, strict unused-symbol compilation and bounded direct source review. The review corrected fractional-zoom resize edge drift and retained focus before disabling group action buttons. Connected MCP Apps automation does not support modified clicks/native gestures, so live Shift-click, dragging/resizing, keyboard actions and installed-host focus remain unexercised. Existing user designs were not mutated to verify the feature; the GaugeReel JSON retains SHA-256 `012cd37bcad35cb535b4b78f4bdd6961cbcb2d7b8d70dfac52de40cd3fd81339`. No tests, assertions, fixtures, test scripts or dependencies were added or run.

## Box-selection footprint — October 14, 2026

This is a selection usability feature, not a measured runtime optimization. Method: Python Path.stat().st_size over the installed `23a59f8` production files and the current build, same machine and `npm run build`; workload is the self-contained canvas widget and MCP entry, excluding design/media data.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 699,489 B | 702,937 B | +3,448 B | +0.49% |
| MCP runtime | 1,030,383 B | 1,030,383 B | 0 B | 0.00% |

User effect: a pointer drag from blank canvas selects enclosed visible objects together; Shift adds them to the existing selection. Geometry is captured at pointer-down, preview IDs remain local until release, and cancellation restores the accepted selection without design/history writes. Candidate bounds respect transformed rectangular overflow clips; the MCP runtime is byte-identical. No selection latency, load time, CPU, heap/RSS, GPU, browser RAM, throughput or FPS metrics were measured, and no runtime speed/memory savings are claimed.

Production compilation/package and bounded source review are the verification method. Review corrected focused-input Escape handling and clipping beneath borders/rotated ancestors. Live native drag/modified-click input is unavailable in the connected MCP Apps browser, so actual gestures, zoomed interaction and installed-host focus remain unexercised. User designs were not mutated for verification; GaugeReel retains SHA-256 `012cd37bcad35cb535b4b78f4bdd6961cbcb2d7b8d70dfac52de40cd3fd81339`. No tests, assertions, fixtures, test scripts or dependencies were added or run.

## Cross-platform keyboard and clipboard footprint — October 14, 2026

Usability/correctness feature, not a measured runtime optimization. Method: Python Path.stat().st_size over installed `8864a07` production files and the current `npm run build`, same machine; workload is the self-contained canvas widget and MCP entry, excluding user designs/media.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 702,937 B | 712,919 B | +9,982 B | +1.42% |
| MCP runtime | 1,030,383 B | 1,030,383 B | 0 B | 0.00% |

User effect: primary keyboard commands work with Command/Ctrl from the canvas and toolbar/closed-select focus, while native text editing remains separate. Selection copy/cut/paste preserves scoped content and conversations through validated atomic saves. Clipboard input/transactions stay within the existing 2 MiB and 2,000-operation limits; geometry metadata is bounded during collection. These are inspected limits, not measured latency or RAM savings. No keyboard latency, clipboard throughput, CPU, heap/RSS, GPU, browser-memory, load-time or FPS measurements were collected; no runtime savings are claimed. The MCP runtime is byte-identical.

Verification uses production build/package, strict unused-symbol TypeScript compilation and bounded source review. Actual native Mac/Windows shortcut delivery, host clipboard support and cut/paste/undo interactions remain unexercised; the connected MCP Apps browser exposes no native keyboard/clipboard gestures. Existing designs were not mutated for verification; GaugeReel retains SHA-256 `012cd37bcad35cb535b4b78f4bdd6961cbcb2d7b8d70dfac52de40cd3fd81339`. No tests, assertions, fixtures, test scripts or dependencies were added or run. Cross-page transformed-parent paste requires the original unchanged parent or copying its frame; opaque authored source dependencies are retained rather than rewritten.

## Versioned library and canvas-map footprint — October 14, 2026

This batch adds functionality, not a measured runtime optimization. Method: raw file byte sizes of the `904bf78` production artifacts recorded before edits and the final `npm run build` artifacts on the same machine; workload is the self-contained widget and bundled MCP runtime, excluding design/media storage.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 711,935 B | 763,185 B | +51,250 B | +7.20% |
| MCP runtime | 1,030,383 B | 1,088,001 B | +57,618 B | +5.59% |

User effect: one title-bar library entry replaces separate system/inspiration entries; three tabs preserve project component/token scope and per-board inspiration. Native linked components reuse definitions, keep local overrides and deliberately adopt released versions. Named/scoped snapshots support comparison and explicit Apply without replacing unrelated screens. Full-canvas PNG/SVG maps preserve spatial layout and allow background, labels, margin and resolution choices. These feature costs increase the download footprint; no load-time, interaction-latency, CPU, memory, GPU, throughput or FPS improvement was measured or claimed. Offscreen component previews use the existing IntersectionObserver pattern; no savings were measured.

Read-only compiled MCP inspection of the actual Forma revision 25 (one page, no definitions) returned 35 tools, two design-system history entries and a transparent SVG map of 188,935 B at 2,420 × 1,968 design pixels. The selected 2× raster dimensions are 4,840 × 3,936 pixels; these dimensions were computed by the real export, not a measured PNG download. SVG rendering warnings disclose foreignObject/CSS and font substitution. The browser bounds PNG to 16,384 px per side / 64,000,000 pixels and map assets to 48 MiB raw / 64 MiB embedded. Those caps are inspected resource limits, not measurements of peak allocation.

Production builds/package, strict unused-symbol compilation, empty static UI detector findings and bounded source review are the verification method. Direct read-only MCP inspection confirms existing-project parsing, scoped history and SVG generation. The currently open host pane caches the previous UI, even after reopening the same resource; new tab controls and actual PNG raster/download remain unexercised until a host restart. No test, fixture, assertion/self-check or test dependency was added or run. No user designs were edited for verification; the original GaugeReel hash remains `012cd37bcad35cb535b4b78f4bdd6961cbcb2d7b8d70dfac52de40cd3fd81339`.

## Refined Properties footprint — October 14, 2026

This adds editing capabilities, not a measured runtime optimization. Method: Node `fs.stat().size` over the existing production artifacts before edits (the `873be92` application baseline) and the final production build/package on the same machine with unchanged dependencies. Workload: self-contained canvas widget and bundled MCP runtime, excluding designs/media.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 759,046 B | 803,102 B | +44,056 B | +5.80% |
| MCP runtime | 1,088,001 B | 1,092,191 B | +4,190 B | +0.39% |

User effect: direct geometry/alignment/rotation/flip editing and compact native radius, opacity, blend, gradient, border and outline controls replace the broad Appearance list. Gradient stops and opacity sliders preview locally and save once when accepted, avoiding a persisted revision for every pointer event; this is inspected behavior, not a measured latency or memory reduction. No load time, interaction latency, CPU, browser RAM, heap/RSS, GPU or FPS improvement was measured or claimed. The added controls increase artifact size. Verification used production compilation/package, strict unused-symbol compilation, bounded source review and read-only browser inspection at 336px/260px panel widths. Native picker dialogs and gradient/save/Undo gestures remain unexercised; no tests or user-design mutations were performed.

## Font picker and DESIGN.md footprint — October 14, 2026

Functionality and consistency work, with no claimed runtime speed improvement. Method: Node `fs.stat().size` over the `7faf993` production artifacts before edits and the final `npm run package:plugin` build, same machine and unchanged dependencies. Workload: the self-contained widget and bundled MCP runtime, excluding user designs and media.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Canvas widget | 803,102 B | 810,683 B | +7,581 B | +0.94% |
| MCP runtime | 1,092,191 B | 1,100,756 B | +8,565 B | +0.78% |

User effect: fonts can be chosen visually and searched, while DESIGN.md token edits update linked styles through one atomic save instead of leaving a separate stale documentation table. Current source variables follow authored same-specificity declarations. These added capabilities increase artifact bytes; no load-time, interaction latency, memory, heap/RSS, CPU, GPU or FPS savings were measured or claimed. Direct inspection covered actual typography, filtering/focus and narrow panel layout without modifying existing designs. No tests, assertions, fixtures or dependencies were added or run.

## Application performance pass — October 14, 2026

Baseline: `ff22c4d`. GPT‑6.1 Sol at max reasoning profiled/reviewed the store and geometry paths; the primary agent profiled the production browser. This pass changes validated-read caching, ancestor lookup, camera-independent bounds/selection work and redundant asset copies. It does not change saved designs, source, comments, History Apply, project scope or rendering quality. No tests, dependencies, fixtures or verification designs were added or run.

### Workloads and method

The installed library contains **six actual projects, seven pages and 1,512 native nodes**. Forma has 397 nodes; GaugeReel has 412 nodes and 16 root screens; statusline.sh is the largest JSON document at 382,223 B, 217 nodes across two pages. Its measured first page has 86 nodes, eight roots and three source-backed nodes. A separate unchanged repository GaugeReel revision 4 supplies the repeated 412-node store-read workload. These are the largest available real designs; this is **not** a measurement of thousands of projects or a 10,000-object board.

Store measurements use Node.js 24.19.0 on macOS arm64. Each phase/workload runs in three fresh processes, alternating before/after: one cold call, ten warmups and 200 sequential read-only calls. The already-initialized store skips only initialization writes/locking; ordinary read/stat/validation/copy behavior runs unchanged. Reported values are medians of the three run results; CPU is process user+system CPU during the 200 calls, peak RSS is `process.resourceUsage().maxRSS` for that isolated profiling process, and retained heap is sampled after explicit GC. These are store-worker measurements, not the desktop app's total RAM or CPU percentage. Raw output/document hashes match before/after; all saved-file hashes remain unchanged.

Geometry measurements use the same Node process with frozen before/current functions: twenty warmups and 100 alternating paired samples on the six nonempty page arrays; the seventh page is empty. Canvas-map preparation includes newly resolved arrays and index creation. No browser paint, input or GPU work is included. All real-node geometry output hashes match.

| Store / geometry metric | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Six-project list, warm median | 8.941167 ms | 0.061792 ms | −8.879375 ms | −99.31% |
| Six-project list, warm p95 | 11.055 ms | 0.100 ms | −10.955 ms | −99.10% |
| Forma read, warm median | 2.409792 ms | 0.432167 ms | −1.977625 ms | −82.07% |
| GaugeReel 412-node read, warm median | 1.878166 ms | 0.332584 ms | −1.545582 ms | −82.29% |
| List CPU, 200 reads | 2,198.060 ms | 26.098 ms | −2,171.962 ms | −98.81% |
| Forma read CPU, 200 reads | 597.200 ms | 91.412 ms | −505.788 ms | −84.69% |
| List profiling process peak RSS | 270,096 KiB | 76,912 KiB | −193,184 KiB | −71.52% |
| Forma read profiling process peak RSS | 223,904 KiB | 69,024 KiB | −154,880 KiB | −69.17% |
| List process post-GC heap | 6,317,672 B | 6,848,776 B | +531,104 B | +8.41% |
| Cold six-project list | 24.653292 ms | 25.760167 ms | +1.106875 ms | +4.49% |
| Cold Forma read | 10.515083 ms | 11.074333 ms | +0.559250 ms | +5.32% |
| Cold GaugeReel read | 8.061292 ms | 8.949167 ms | +0.887875 ms | +11.01% |
| Visible bounds, 1,512 installed nodes | 5.559542 ms | 3.328708 ms | −2.230834 ms | −40.13% |
| Visible bounds, GaugeReel 412 nodes | 1.258208 ms | 0.734125 ms | −0.524083 ms | −41.65% |
| Five nonempty projects' canvas-map layout | 6.525458 ms | 3.885334 ms | −2.640124 ms | −40.46% |

User effect: repeated project-menu/SSE refreshes avoid re-reading and validating every unchanged design; returning to a recently read project avoids repeated validation. Every request still checks file identity, size and nanosecond modification/change times, so ordinary edits and atomic saves by another process invalidate the cache. Changed data still passes the complete schema and corruption checks. Summaries contain scalar metadata; only **one** full validated document is retained, and callers get independent copies. Caching reduces allocation churn under repeated reads, at the cost of a small retained heap increase and slightly slower cold reads. It does not establish a cold-start improvement. Ancestor lookup now uses a weak snapshot index, without caching geometry or ignoring current transforms. Camera-only renders reuse root bounds and selection eligibility until their actual inputs change.

### Production loading and canvas interaction

Both builds run on separate loopback ports, using the same saved documents, IAB session, warm browser/server caches and fixed 1,280 × 720 viewport (1,280 × 688 canvas, Inspector closed). Local-only identical HTML instrumentation records browser Performance APIs and DOM marks; it is absent from packaged builds. Five alternating navigations per phase/project reduce order bias. The first-canvas mark is the first animation-frame callback after rendered design nodes appear; React has committed the controls, but source iframes/media may still be loading. It is **not** TTI, LCP, INP, or proof that every resource is ready. `loadEventEnd` measures the outer document's load, which can precede asynchronous project/source loading.

Pan method: reload the unselected Forma overview, then eight native 0.5-page wheel scrolls, alternating down/up at (1,000, 500). Three rounds per build, alternating phase order. Each round receives eight wheel events and eight camera responses. Wheel response measures event capture to the next rAF after the canvas transform changes, a callback proxy rather than input-to-paint. Frame intervals cover the active input plus a 150 ms tail and measure callback cadence, **not rendered FPS**. Pan rows are medians of the three rounds, with ordinary midpoint medians for eight response samples. No ≥50 ms long-task entries were observed in these short captures; this is not a CPU-utilization measurement.

| Production browser metric, warm | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Forma first-canvas median, 397 nodes | 64.0 ms | 56.1 ms | −7.9 ms | −12.34% |
| GaugeReel first-canvas median, 412 nodes | 64.5 ms | 56.3 ms | −8.2 ms | −12.71% |
| Source-heavy document first-canvas median | 53.4 ms | 52.3 ms | −1.1 ms | −2.06% |
| Forma outer-document load median | 40.6 ms | 37.2 ms | −3.4 ms | −8.37% |
| GaugeReel outer-document load median | 36.3 ms | 37.9 ms | +1.6 ms | +4.41% |
| Source-heavy outer-document load median | 37.0 ms | 40.4 ms | +3.4 ms | +9.19% |
| Source-heavy first iframe load median | 59.1 ms | 61.1 ms | +2.0 ms | +3.38% |
| Wheel-to-camera callback median | 8.65 ms | 8.70 ms | +0.05 ms | +0.58% |
| Active rAF interval median | 8.3 ms | 8.3 ms | 0.0 ms | 0.00% |
| Active rAF interval p95 | 9.2 ms | 9.3 ms | +0.1 ms | +1.09% |

User effect: the measured native canvas appeared around eight milliseconds earlier. Five samples are small and ranges overlap (GaugeReel 53.9–76.2 ms before, 55.4–67.6 ms after), so the 12.71% figure is specific to this workload, not a general loading guarantee. Source readiness and outer load did not consistently improve. Panning was already responsive in this workload and remains essentially unchanged; no smoother-FPS or lower input-to-paint claim is made. Hand panning, selection and Properties/Code were inspected through the actual UI without editing designs.

Earlier sequential warm samples also varied more: Forma first-canvas median 88.0→60.5 ms, GaugeReel 78.9→58.2 ms, source-heavy 72.1→53.5 ms. The alternating comparison above is the primary result; the larger sequential gains are not used as the headline.

### Asset allocations and artifact cost

`client.readAsset` returns a Uint8Array backed by a fresh exact-length ordinary ArrayBuffer. Display and embedded-text/canvas-map export preparation now pass that owned buffer directly to Blob, avoiding an extra full-length `Uint8Array.slice()`; ZIP import retains its necessary slicing because those bytes can be subarray views. Measured file/metadata lengths for the four currently referenced images total **8,702,896 B**. One acquisition per distinct referenced asset therefore removes 8,702,896 B of explicit temporary copies (to 0 B, −100% of that copy); the largest single removed copy is 2,613,943 B. This is measured payload size plus inspected allocation behavior, **not measured browser RAM**, not all images mounted simultaneously, and not removal of Blob's own storage or image-decoding memory. The same redundant-copy removal applies to embedded-text and canvas-map export preparation; Source ZIP did not use this copy path.

Exact uncompressed production widget bytes are 818,720→818,956 B (+236 B, +0.03%); Node zlib gzip level 9 is 234,147→234,196 B (+49 B, +0.02%). The MCP runtime is 1,100,756→1,102,033 B (+1,277 B, +0.12%). The widget stays self-contained; introducing lazy chunks without changing the packaging/host loader would break it, so this pass does not split the bundle or claim a download-size win.

### Coverage and remaining limits

Production compilation, strict unused-symbol compilation, a bounded GPT‑6.1 Sol max source review and direct UI inspection passed. Fresh production HTTP MCP reads expose the same 34 tools and identical structured project, focused component context, React export and history-list hashes. No designs, versions, conversations, original imported references or assets were changed for measurement.

Reliable app-only browser heap/RSS, total desktop CPU, GPU usage, paint/FPS, dropped frames, true input latency/INP, formal interaction readiness, cold browser/plugin-host launch, save-to-paint streaming, large video/shader workloads, thousands of projects and boards larger than the saved 412-node workload remain **unmeasured**. The browser's heap counters varied with navigation/GC and could not establish isolated memory savings. The server peak-RSS reductions above must not be presented as a 71.52% reduction in the desktop app's memory.

Remaining scaling issues found by inspection: a cold library list still validates every project, and a changed revision still transfers a full project snapshot. The warm summary cache removes the repeated cost but does not solve cold-library scaling. A persisted summary index or revision deltas need their own integrity/recovery design and real larger workloads before implementation. Media/shader virtualization and bounded shader animation already exist; they are retained without inventing new savings.

Raw local captures (ignored by Git): `application-performance-store.json`, `application-performance-browser.json`, `application-performance-observer.js`, `application-performance-bundles.json`, `effects-geometry-profile.json`, and `media-explicit-copy-profile.json` under `artifacts/`.

## Portable library export feature cost — October 14, 2026

This is an export/portability feature, not a performance optimization. Method: exact production widget/runtime bytes and Node zlib gzip level 9 from committed build 567d31e and the final feature build, on the same machine. No dependency was added. The widget remains self-contained; library generation and media reads run on explicit export.

widget.html: 818,956→830,520 B (+11564 B, +1.41%); gzip 234,196→238,307 B (+4111 B, +1.76%). mcp.mjs: 1,102,033→1,115,149 B (+13116 B, +1.19%); gzip 232,405→236,452 B (+4047 B, +1.74%).

The actual read-only browser export of Forma revision 33 was 42,871 B in 15 ZIP entries, containing 22 tokens, one seven-node component definition and zero page nodes/media references. Generated React compilation and production import-schema parsing passed. Source release 26 is retained in the archive; normal import rebases it to a new local baseline. These are artifact/structure measurements, not export latency, import latency, memory, CPU, load time or frame-rate improvements. No gain is claimed for those unmeasured metrics. Raw ignored captures: library-export-before.json, library-export-after.json, library-export-downloaded.zip and library-export-mcp.json.

## Selection-title usability fix — October 14, 2026

This is a hit-target/spacing correction, not a runtime optimization. Method: read-only browser DOM rectangle and elementFromPoint inspection before/after, using the same 1,280 × 720 viewport, Forma's unchanged 397-node page, and exact camera `translate(-40.1422px, 723.934px) scale(0.601896)`. Select the three mobile frames in Layers and Fit selection; inspect that selection, then select the middle frame alone through Layers without moving the camera. No design write is needed.

| Measured vertical title overlap | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| One selected frame | 16 CSS px | 0 CSS px | −16 CSS px | −100% |
| Three selected frames | 18 CSS px | 0 CSS px | −18 CSS px | −100% |

User effect: the middle frame-title center no longer hits Delete selection; it hits the frame-name button. Both bars move below when the title leaves too little room above the fixed toolbar. Their final lower positions clear the dimension badge by 5 CSS px and the viewport bottom by 8 CSS px. These are measured layout/hit-target outcomes, not lower accidental-deletion rates or latency measurements.

Exact production artifact sizes on the same machine: widget.html 830,520→830,726 B (+206 B, +0.0248%); Python gzip level 9 with fixed mtime 237,623→237,764 B (+141 B, +0.0593%). The MCP runtime is byte-identical at 1,115,149 B (235,665 B gzip). No dependency was added. Loading, interaction latency, CPU, RAM and FPS were not measured for this UI change. Raw read-only layout and bundle captures are in /private/tmp/codex-toolbar-{before,after}-{single,multi}.json and codex-toolbar-bundles-{before,after}.json.

## Portable browser entrypoint feature cost — October 14, 2026

This is harness compatibility, not a performance optimization. Method: compare the previous production `dist/mcp.mjs` bytes with the completed build, using Python gzip level 9 with fixed mtime on the same machine. The existing Codex runtime changes from 1,115,149 to 1,116,786 B (+1,637 B, +0.1468%); gzip changes from 235,665 to 236,156 B (+491 B, +0.2083%). Its default MCP catalog, resource metadata, instructions and real project response remain exactly identical. The editor widget remains 830,726 B, SHA-256 `181794c25d67b184441af67a1ce61c33baf540ce8cd8910acda265ac6c40372e` (0 B / 0% change).

The separate browser runtime is 2,293,257 B (536,457 B gzip), including its existing Express/API/store dependencies. Codex's normal stdio entrypoint does not import or start this HTTP server. Other harnesses run one loopback endpoint for their MCP process, with the same passive editor and revision synchronization. Browser-mode JSON text fallback intentionally repeats structured data for clients that otherwise receive only summaries; it is not a payload optimization. No dependency was added.

The live Pi/tron-router study saved 87 native nodes, 10 tokens, two completed mobile screens and an anchored comment/reply; history and React export worked through the ordinary MCP adapter. These are functional outcomes, not measured cold-start, load, streaming latency, CPU, memory or FPS gains. Those metrics were not profiled for this feature. Local inspection captures are `/private/tmp/codex-harness-codex-{baseline,current}.json`, `codex-harness-portable-catalog.json` and `codex-design-pi-session.jsonl`; fictional study data and its screenshot live in this chat's visualization output, outside existing project storage.

## Bounded history-preview retention — October 14, 2026

History kept every opened full snapshot for the lifetime of its panel. It now retains eight recently used version promises, updating recency on a hit and refetching an evicted version through the existing validated client. The selected preview and change comparison keep their ordinary independent references. This bounds the cache, not all in-flight requests or the entire application's memory. It does not delete saved history, change Apply, or modify MCP responses.

Method: production Vite browser builds from frozen `e461e8d` and the completed change, on the same machine and 1,280 × 720 viewport. Each fresh session opened History on an identical local copy of Forma revision 35 (397 current nodes, 36 real saved versions), expanded the list and browsed v0 through v35, waiting for each actual preview to finish. Temporary instrumentation in the profiling copy recorded the cache's keys and summed UTF-8 `JSON.stringify(ProjectVersion)` byte lengths after fulfilled reads; the read-only HTTP host recorded snapshot requests. Those byte counts describe serialized content referenced by the cache, **not measured browser heap or RAM**. Instrumentation and the frozen workload stay outside the repository and installed plugin.

| Measured outcome after browsing 36 versions | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Cached full-version responses | 36 | 8 | −28 | −77.78% |
| Sum of cached responses' JSON encodings | 3,852,077 B | 1,058,161 B | −2,793,916 B | −72.53% |
| Snapshot requests during the sequential pass | 36 | 36 | 0 | 0% |

User effect: extended history browsing stops accumulating the whole visited journal in this cache while nearby previews remain reusable. In the final build, v35→v34→v35 caused zero additional snapshot reads. Revisiting evicted v0 performed one read and opened its actual preview; Apply became available, and Close returned to the unchanged live canvas without applying. A distant revisit can therefore take an ordinary server round trip. The cache peaked at eight entries in the measured settled sequence; rapid overlapping requests can remain alive until they settle.

Production package/build and strict unused-symbol TypeScript compilation passed, retaining the existing large-chunk warning. Widget size is 830,726→830,805 B (+79 B, +0.00951%); Python gzip level 9 with fixed mtime is 237,764→237,789 B (+25 B, +0.01051%). The Codex, browser and JSX runtime bundles are byte-identical. No dependency or test was added or run. Heap/RSS, GC release, CPU, loading/interaction latency, FPS and installed-host cold launch were not measured; no gain is claimed for them. Local measurement summary: `/private/tmp/codex-history-cache-profile.json`.

## Explicit browser project-choice correction — October 14, 2026

This is a project-binding correction, not a runtime performance optimization. Before, the actual bare browser URL redirected itself to the latest Nook project without a selection; afterward the same URL stays unbound and shows the existing project chooser. A missing-project URL now stays on its error/chooser instead of falling back to a different design. Valid explicit selections/reloads remain usable in independent windows. No loading, interaction, CPU, memory or FPS gain is claimed.

Exact production artifact comparison on the same machine against `adb7aeb`: widget.html 830,805→830,520 B (−285 B, −0.03430%); Python gzip level 9 with fixed mtime 237,789→237,676 B (−113 B, −0.04752%). The Codex, browser and JSX runtime bundles are byte-identical. The change removes the implicit latest-project/empty-list fallback and reuses the existing project menu; no dependency is added. All 27 recorded files in the isolated inspected store remain unchanged. Production packaging and strict TypeScript compilation are the validation method; no tests were added or run. Empty-library creation, authentication retries and installed-host context delivery remain unexercised.

## Camera commits within the display frame — October 14, 2026

The canvas had no fixed 60 Hz timer. Its animation-frame callback queued an asynchronous React update, leaving the camera transform and overlays unchanged until after that callback phase. The camera now commits synchronously inside its existing single queued animation-frame callback. Library panning and zooming use the same frame batching; their latest camera remains available immediately to input handlers and the per-section cache. Pointer release, cancellation, section changes and unmount flush or cancel pending work. No display settings, saved document format, rendering quality or dependencies change.

Method: freeze the existing production build and its two camera source files before editing, then compare it with the completed production build in the same in-app browser. Both use the same isolated saved GaugeReel document ("Component discovery preview", revision 7, 412 native nodes, 16 root screens, five library tokens), warm resources and a 1,280 × 720 viewport. The design canvas is 1,280 × 688; the library canvas is 944 × 656 with its 336 px panel open. Culling remains enabled; 335 nodes are mounted at the design overview's resting position. This is not a large component-library or shader-heavy workload.

Three rounds per build/surface alternate phase order: before/after, after/before, before/after. Each round reloads the same document, selects Hand and performs eight native drags, alternating directions. Design drags run (480, 520)↔(1,040, 520), a 560 CSS px displacement; library drags run (150, 480)↔(790, 480), a 640 CSS px displacement. Each round receives 64 pointer-move events and 64 camera transform updates. A separate wheel comparison performs eight native 0.5-page scrolls, alternating down/up at (1,000, 500), with eight events and eight updates per build.

Identical temporary HTML instrumentation captures native input timestamps, camera style mutations and rAF intervals during input plus a 150 ms tail. A window bubble listener registers an additional rAF probe after the application's camera callback is queued. "Absent at frame probe" means the corresponding transform mutation had not occurred when that later callback ran. It measures callback-phase delivery, **not dropped display frames**. Input-to-DOM time ends at the transform's MutationObserver callback; it excludes compositor, paint and display presentation. Timing rows below are medians of the three round medians; late-update counts sum all three rounds. Instrumentation, frozen builds and raw captures are outside the repository and packaged widget.

| Measured camera outcome | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Design hand-pan updates absent at frame probe | 192 / 192 | 0 / 192 | −192 updates | −100% |
| Library hand-pan updates absent at frame probe | 192 / 192 | 0 / 192 | −192 updates | −100% |
| Design hand-pan input-to-DOM median | 1.20 ms | 0.60 ms | −0.60 ms | −50.00% |
| Library hand-pan input-to-DOM median | 0.80 ms | 0.50 ms | −0.30 ms | −37.50% |
| Design active rAF interval median | 8.30 ms | 8.30 ms | 0.00 ms | 0.00% |
| Library active rAF interval median | 8.30 ms | 8.30 ms | 0.00 ms | 0.00% |
| Design active rAF interval p95 | 9.20 ms | 8.90 ms | −0.30 ms | −3.26% |
| Library active rAF interval p95 | 8.90 ms | 8.80 ms | −0.10 ms | −1.12% |
| Wheel updates absent at frame probe, one round | 8 / 8 | 0 / 8 | −8 updates | −100% |
| Wheel input-to-DOM median, one round | 1.30 ms | 1.40 ms | +0.10 ms | +7.69% |

User effect: the camera and its overlays are ready inside the requested browser frame instead of waiting for React to commit after the frame callback phase. The browser already supplied roughly 120 Hz callbacks in this session; this change removes the observed scheduling deferral rather than establishing a 60→120 rendered-FPS improvement. Wheel input-to-DOM time did not improve, and the small p95 differences are not a general smoothness guarantee. No ≥50 ms long-task entries were observed in the short captures; this is not CPU utilization or proof that every frame met its paint deadline.

Production TypeScript compilation, widget/runtime build and direct UI inspection passed. Wheel panning, library zoom buttons, keyboard panning, section camera restoration, returning to the design canvas and selection alignment were inspected through the actual UI. No tests, assertions, fixtures or dependencies were added or run. Exact widget bytes are 3,492,877→3,493,165 B (+288 B, +0.0082%); Python gzip level 9 with fixed mtime is 970,063→970,172 B (+109 B, +0.0112%). The existing large-chunk build warning remains.

Actual screen-paint FPS, GPU presentation, dropped display frames, true input-to-paint latency, app CPU/RAM, very large boards and installed-plugin-host refresh behavior remain unmeasured. Synchronous React work must still fit the browser's frame budget; this does not override browser, host, power-mode or display limits. Primary API references: [requestAnimationFrame scheduling](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) and [React synchronous DOM commits and caveats](https://react.dev/reference/react-dom/flushSync). Raw local captures and frozen builds: `/private/tmp/codex-pan-profile/`; summary: `summary.json` in that directory.

## Hover, pressed and focus states as data — October 14, 2026

Workload: a generated 4,944-node single-page project (`exportPageHtml` and `exportTargetReact`, page scope), run read-only in one Node.js 24.19.0 process with `tsx`. Each case ran 3 warmups, then 12 timed samples; the table reports medians. The "states" case adds `styles.states` (hover fill + opacity, pressed fill) to every fifth frame/rectangle, 238 layers. Same machine, same document, back to back; run-to-run noise was about ±1.5 ms.

| Measurement | No states (baseline) | 238 layers with states | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| HTML page bytes | 2,327,833 B | 2,364,159 B | +36,326 B | +1.56% |
| React + CSS bytes | 2,635,692 B | 2,658,664 B | +22,972 B | +0.87% |
| HTML export median | 17.8 ms | 19.1 ms | +1.3 ms | +7.3% (inside noise) |
| React export median | 18.5 ms | 19.1 ms | +0.6 ms | +3.2% (inside noise) |

Projects without states: output bytes are identical to the pre-change build (2,327,833 B HTML, 2,635,692 B React) and the three baseline runs (18.5–19.2 ms HTML, 18.6–20.4 ms React medians) bracket the post-change 17.8/18.5 ms, so no export cost is measured for existing designs.

User effect: states cost nothing unless authored; a design with them downloads about 1% more source and gets `:hover` and `:active` behaviour from plain CSS, with no script. (Correction, October 15: a later real-pointer review found pressed was masked by focus and focus never applied to unlinked layers; see the review fixes entry below.) Estimates, not measurements: the editor adds one `useMemo` that returns the existing node array while no state is previewed, and previewing maps the list once and re-renders only the selected layer, because unchanged `DesignNode` objects keep their memoized subtrees. Editor pan/zoom, selection latency and memory were not measured: the browser pane's `requestAnimationFrame` was suspended during this session, so the profiler captured no frames and that baseline was discarded. The production bundle was built (JS 3,415,360 B, CSS 107,152 B after) but not built before the change, so no size delta is claimed.

Browser check: an exported demo page parsed the emitted rules and, with the pane's hover simulated by swapping `:hover`/`:active` for classes, computed background rgb(51,102,255) → rgb(255,138,76) with opacity 0.9 on hover and rgb(194,77,6) when pressed, confirming the `!important` rules beat the inline styles. This class-swap check is superseded by the real-pointer run in the review fixes entry below. The pane did not deliver real pointer hover, so native `:hover` matching and the Inspector's States section were not exercised in a browser; both compile (`tsc --noEmit`, `vite build`).

## Opt-in live code layers — October 14, 2026

Same 4,944-node workload, method and process as the states entry above (3 warmups, 12 timed samples, medians).

| Measurement | Before this change | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| HTML page bytes | 2,327,833 B | 2,327,833 B | 0 B | 0% |
| React + CSS bytes | 2,635,692 B | 2,635,692 B | 0 B | 0% |
| HTML export median | 17.8 ms (after-states run) | 17.4 and 18.0 ms | -0.4 / +0.2 ms | inside noise |
| React export median | 18.5 ms | 18.4 and 18.5 ms | -0.1 / 0.0 ms | inside noise |

Projects without live layers export identical bytes at the same speed. The editor path is unchanged for passive code layers: they render the same sandboxed iframe, and only layers marked `live` mount a small wrapper that subscribes by id to a single-frame store, so entering or leaving re-renders just that layer rather than the scene (design estimate, not profiled in a browser; the pane's `requestAnimationFrame` was suspended, so no editor timings exist). At most one scripted iframe runs, and leaving remounts it with the passive document (whether that releases the old document's timers and listeners promptly is browser behaviour and was not measured). User effect: existing designs cost nothing extra; a live layer costs one running iframe only while it is being used.

Exported page check: a generated page with one live and one passive layer, loaded in the browser pane, delivered exactly one message, from the live frame. Inside it, localStorage, `parent.document`, `document.cookie` and a `fetch` to a same-machine URL were all blocked (correction, October 15: self-navigation and WebRTC still reached the network; see the review fixes entry below); the passive frame ran nothing. A React export carried `sandbox="allow-scripts"`, the `cd-live` class and its CSS rule. The editor's double-click/Esc flow compiles (`tsc --noEmit`, `vite build`) but was not exercised in a browser because the pane would not render the canvas, and a script can still burn CPU or navigate its own frame; no CPU limit is claimed.

## Live-layer activation scope correction — October 14, 2026

This is an editor correctness fix, not a runtime optimization. The eligible live target is derived during rendering from the current project/page and one selected, unhidden, unlocked code layer with Select active. Its transient activation key includes project, page and node IDs. Other layers, multiple selections, history and component previews use the existing passive sandbox. This prevents an already selected group or a reused native node ID from inheriting activation; it does not change the persisted live flag or exported behavior.

Method: build the clean `bacd8ae` checkout and the completed change on the same machine through `npm run build`, then compare exact production widget bytes and Python gzip level 9 with fixed mtime. Widget.html changes 3,525,309→3,525,681 B (+372 B, +0.01055%); gzip changes 980,795→980,960 B (+165 B, +0.01682%). The Codex, browser and JSX runtime bundles are byte-identical to that frozen baseline. No dependency was added. Local artifact report: `/private/tmp/codex-live-scope-artifacts.json`.

Production packaging and strict unused-symbol TypeScript compilation passed, retaining the existing large-chunk warning. Reviewed every activation/subscription caller, the CanvasNodes tree and the separate readonly NodeView path with the React best-practices checklist. No saved design or user script was modified or executed, and no tests, fixtures or verification designs were added or run. Actual live activation/exit, reused-ID navigation, native multiple-selection gestures and installed-host behavior were not exercised. Loading, interaction latency, CPU, RAM, paint/FPS and GPU use remain unmeasured; no speed or resource savings are claimed.

## Inline text synchronization correction — October 14, 2026

This is a correctness fix rather than a performance optimization. Method: build clean `c8636cc` and the completed source change on the same machine with `npm run build`, then compare the exact self-contained production widget and Python gzip level 9 with fixed mtime. Workload is the same application build, with no design-content changes.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Widget HTML | 3,525,681 B | 3,526,143 B | +462 B | +0.01310% |
| Widget gzip | 980,960 B | 981,099 B | +139 B | +0.01417% |

The Codex, browser, JSX-renderer and starter runtime bundles remain byte-identical. Report: `/private/tmp/codex-text-sync-artifacts.json`. No dependency was added. The practical change is that incoming clean text and “Use saved value” replace the visible stale text; local typing avoids a DOM rewrite. This behavior was inspected in source, not measured in a live editor session. Load/interaction time, CPU, RAM, FPS, native caret/IME behavior and concurrent edit sequences remain unmeasured or unexercised. Compilation and builds ran without tests, fixtures, verification designs or changes to saved user content.

## Inline edit lock and session guards — October 15, 2026

This is a correctness change. Comparable workload/method: build clean `4a8558d` and the complete correction on the same machine with `npm run build`; compare exact self-contained widget bytes and Python gzip level 9 with fixed mtime. Saved designs and dependencies are unchanged.

| Artifact | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Widget HTML | 3,526,143 B | 3,526,224 B | +81 B | +0.00230% |
| Widget gzip | 981,099 B | 981,149 B | +50 B | +0.00510% |

The Codex, browser, JSX-renderer and starter runtime bundles remain byte-identical. Local report: `/private/tmp/codex-text-lock-artifacts.json`. The practical intended effect is to prevent inline text edits through locked ancestry or non-Select tools and prevent an unmounted editor's save completion from dismissing a newer edit session. These paths were inspected in source; browser inspection could not start because the UI automation runtime returned a missing-path error. No interaction, load, CPU, RAM, frame-rate or GPU measurements were obtained, and no runtime savings are claimed. Builds and strict TypeScript compilation ran without tests, fixtures or verification designs.

## Skip unbound CSS token scans — October 15, 2026

Source inspection found that every emitted style property scanned the project's token array even when that property used Custom. The shared CSS emitter now returns literal values immediately without a design-system context or explicit binding. Bound values retain the same compatible-kind check, CSS variable and literal fallback. This removes redundant searches without a cache, invalidation rule, dependency or data-format change.

Workload: frozen existing Lot revision 107 (598 nodes, four pages, 22 tokens), Bloom revision 9 (536 nodes, three pages, 16 tokens) and Forma revision 35 (397 nodes, one page, 22 tokens). Together: 1,531 nodes, including 1,003 with bindings, across eight pages. Source files and the in-memory input encodings retained their hashes. No user designs were edited.

Method: bundle clean `006618d` and the completed shared export modules separately with the production Node-target esbuild settings (Node 22 target, ESM, no minification). Run on Node v24.19.0 / Apple M5 Pro in fresh processes, ordered before/after, after/before, before/after. Each case has ten warmup passes, then 17 timed batches per process: twelve whole-workload passes per style batch or five per export batch. Tables pool the 51 final batch averages per version and report their median; exploratory `initial` runs are excluded. Wall time uses performance.now(); CPU time is process.cpuUsage user + system. Each export pass constructs all eight pages independently using the supported page scope. React timings include the existing implementation-notes Markdown in its result. Media reads/embedding, archives, network, download, the separate Codex handoff prompt and browser rendering are outside the timed workload.

Wall time per workload pass:

| Workload | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Literal canvas styles · 1,531 layers | 0.473 ms | 0.449 ms | -0.024 ms | -5.1% |
| Token-aware export styles · 1,531 layers | 2.472 ms | 1.371 ms | -1.101 ms | -44.5% |
| HTML source · 8 pages | 7.080 ms | 5.934 ms | -1.146 ms | -16.2% |
| React/CSS source · 8 pages | 7.620 ms | 6.450 ms | -1.170 ms | -15.4% |

CPU time per workload pass (not whole-app CPU utilization):

| Workload | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Literal canvas styles · 1,531 layers | 0.504 ms | 0.477 ms | -0.027 ms | -5.4% |
| Token-aware export styles · 1,531 layers | 2.544 ms | 1.447 ms | -1.098 ms | -43.1% |
| HTML source · 8 pages | 7.177 ms | 6.039 ms | -1.138 ms | -15.9% |
| React/CSS source · 8 pages | 7.685 ms | 6.496 ms | -1.189 ms | -15.5% |

The substantial export-style, HTML and React reductions are consistent across all three process pairs: wall-time run medians span 2.379–2.490→1.354–1.379 ms, 7.017–7.195→5.877–5.987 ms and 7.541–7.656→6.359–6.498 ms, respectively. Literal canvas-style wall-time ranges overlap (0.449–0.532→0.444–0.452 ms), so that small difference is inconclusive; it is not evidence of faster panning.

The four complete output encodings retain identical byte lengths and SHA-256 hashes across all six final runs: literal styles 402,264 B, token-aware styles 448,757 B, HTML results 738,136 B and complete React result objects 1,716,447 B. These are JSON response encodings, not browser RAM or downloadable archive sizes. The practical effect is less synchronous work preparing code exports; the measured absolute savings are about 1.15 ms for eight HTML pages and 1.17 ms for eight React/CSS pages. Actual export-menu latency, startup, project loading, scrolling/panning, FPS, memory, GPU and whole-app CPU utilization remain unmeasured by this change. No UI speedup is inferred from Node timings.

Production artifact method: run npm run build on the clean baseline and completed change, then compare exact bytes and Python gzip level 9 with fixed mtime. Widget 3,526,224→3,526,247 B (+23 B, +0.00065%); gzip 981,149→981,164 B (+15 B, +0.00153%). Codex runtime 4,315,883→4,315,974 B (+91 B, +0.00211%). browser runtime 5,492,358→5,492,449 B (+91 B, +0.00166%). JSX-renderer and starter bundles remain byte-identical. Production packaging and strict unused-symbol TypeScript compilation passed with the existing large-chunk warning. No tests, fixtures, verification designs or dependencies were added or run. Raw workload, six run reports, summaries and artifact hashes are under `/private/tmp/codex-token-lookup-profile/`.

## Indexed ZIP checksum traversal — October 15, 2026

The shared ZIP packer and unpacker spent most of this workload's processing time traversing checksum bytes with a typed-array iterator. Replaced that traversal with an indexed loop. The CRC table, polynomial, initial/final values, archive layout and path/count/size/format/integrity guards are unchanged. No compression dependency or new cache was introduced.

Workload: frozen Lot revision 107, with 598 saved nodes across four pages. Its actual saved project JSON is 246,418 B and its two original PNG assets total 4,632,164 B. Adding the version-1 media manifest gives 4,879,421 B of payload in four entries and a 4,880,095 B stored ZIP. This profiles the core editable-backup payload; source/README/handoff generation and other UI export files are outside the workload. The saved project, media and history were not modified, and the archive was not imported into the application.

Method: separately bundle clean `e0dff80` and the completed shared ZIP module with esbuild's production Node settings (Node 22 target, ESM, no minification). Run on Node v24.19.0 / Apple M5 Pro in fresh processes, ordered before/after, after/before, before/after. Each routine gets four warmup calls, a GC before sampling and thirteen timed batches of two calls per process. The table reports the median of the 39 batch averages per version, normalized to one call; exploratory `initial` runs are excluded. Input reads and output hashing occur outside timing. Packing includes string UTF-8 encoding, headers, checksums and final assembly; unpacking includes the existing ZIP validation, checksums and entry views. CPU time is process.cpuUsage user + system; wall time uses performance.now().

| Routine / metric | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| ZIP packing · wall time | 23.027 ms | 8.638 ms | -14.389 ms | -62.5% |
| ZIP packing · CPU time | 23.041 ms | 8.767 ms | -14.274 ms | -61.9% |
| ZIP unpacking · wall time | 22.351 ms | 8.089 ms | -14.261 ms | -63.8% |
| ZIP unpacking · CPU time | 22.331 ms | 8.110 ms | -14.221 ms | -63.7% |

Run-median wall ranges are consistent: packing 22.812–23.077→8.612–9.022 ms; unpacking 22.218–22.442→8.046–8.120 ms. The generated archive retains the same 4,880,095 B length and SHA-256 across all six final runs (0 B / 0% size change). All four extracted entries retain identical lengths and hashes, including the existing nonzero-offset entry views. Frozen payload files and the original saved project retain their hashes.

Practical effect: less synchronous checksum work in the routines used by project/source/component/library downloads and ZIP reading. On this payload, measured packing saves 14.389 ms and unpacking saves 14.261 ms. These are Node measurements of the shared routines, not whole-browser download/import timings or whole-app CPU utilization. Project/asset reads, source/manifest generation, asset SHA-256 checks, project-schema validation, persistence, DOM/download handling and browser rendering are excluded. Memory/RAM, startup, project loading, panning/FPS, GPU and installed-host latency remain unmeasured; the change does not establish memory or archive-size savings.

Production artifact method: npm run build on the clean baseline and completed source, exact bytes plus Python gzip level 9 with fixed mtime. Widget 3,526,247→3,526,260 B (+13 B, +0.00037%); gzip 981,164→981,174 B (+10 B, +0.00102%). The Codex, browser, JSX-renderer and starter runtime bundles remain byte-identical. Production packaging and strict unused-symbol TypeScript compilation passed with the existing large-chunk warning. No tests, fixtures, verification designs or dependencies were added or run. Raw payload provenance, six run reports, output hashes and artifact comparisons are under `/private/tmp/codex-archive-crc-profile/`.

## Avoid redundant download-buffer copies — October 15, 2026

The final download helper copied each binary export with Uint8Array.slice before constructing its Blob. Blob already snapshots its input. It now receives the typed-array view directly, retaining its exact byte offset/length and the existing immutable download contents. ExportFile and the ZIP packer's return type explicitly use ArrayBuffer-backed views: all binary producers create a fresh ZIP buffer or a PNG view over blob.arrayBuffer(). No cast, shared-buffer fallback, cache or dependency was added. Object URL lifetime, filenames, MIME types and caller cancellation/revision guards are unchanged.

Workload: reuse the frozen existing Lot revision 107 core editable-backup payload described above, not a synthetic project. The four-entry ZIP contains the real 598-node/four-page document, two original PNGs and its media manifest, totaling 4,880,095 B. This does not include the complete UI export's additional source/documentation files. No saved design, asset or history was changed and no import/download was dispatched in the app.

Method: extract the Blob-construction stage from clean 469fc68 and the completed downloadExport, replacing the surrounding URL creation with a returned Blob for direct profiling. Transpile those actual stages with esbuild's Node 22 ESM target without minification. Run Node v24.19.0 on Apple M5 Pro in three fresh-process pairs ordered before/after, after/before, before/after. Each process uses four warmups and thirteen timed batches of four calls, with GC before each batch outside timing. Results are the median of 39 batch averages per version, normalized to one Blob preparation. performance.now() records wall time; process.cpuUsage user + system records process CPU time, which can include runtime worker work. File reads, hashes and Blob.arrayBuffer() output inspection are outside timing; initial exploratory runs are excluded.

| Metric per 4,880,095 B payload | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Blob preparation · wall time | 0.200917 ms | 0.103886 ms | -0.097031 ms | -48.3% |
| Blob preparation · CPU time | 0.319750 ms | 0.218250 ms | -0.101500 ms | -31.7% |
| Explicit preparatory payload copies | 1 | 0 | -1 | -100% |
| Bytes in that explicit copy | 4,880,095 B | 0 B | -4,880,095 B | -100% |

Copy counts come from direct inspection of the single removed slice and the measured input byte length, not a heap measurement. Blob's own snapshot remains. Wall-time process medians span 0.186698–0.206344→0.100542–0.108927 ms; CPU medians span 0.301000–0.325000→0.214500–0.220750 ms. The practical effect is one fewer full payload allocation/copy before binary downloads. The absolute measured time saved here is only 0.097031 ms; this is not evidence of perceptibly faster downloads or a 48.3% reduction in total export latency.

All six final ZIP Blob outputs retain the same 4,880,095 B length, application/zip MIME type and SHA-256. Separate direct snapshots of all four real extracted entry views, at nonzero offsets, retain their input lengths/hashes and expected MIME types, including both original PNGs. The source project's SHA-256 remains unchanged. Strings still pass directly to Blob as before. No data outside a view's range is exported.

Artifact method: compare the existing packaged clean 469fc68 build with the completed production build, exact bytes and Python gzip level 9 with fixed mtime. Widget 3,526,260→3,526,210 B (-50 B, -0.00142%); gzip 981,174→981,157 B (-17 B, -0.00173%). Codex, browser, JSX-renderer and starter bundles remain byte-identical. Strict unused-symbol TypeScript compilation and production packaging passed with the existing large-chunk warning. No tests, fixtures, verification designs, dependencies or user-design writes were added or run.

Browser Blob implementation/heap behavior, actual memory peak/RAM/GC reduction, end-to-end export/download/import latency, installed-host interaction, startup, canvas panning/FPS and whole-app CPU utilization remain unmeasured. Node Blob timings do not establish those browser metrics. Raw source stages, workload provenance, six run reports, output/view hashes and artifact comparisons are in /private/tmp/codex-download-blob-profile/.

## Creation completions respect navigation — October 15, 2026

This correctness change prevents old creation/import completions from replacing a newer pane choice or applying selection/camera/menu follow-ups to a different project, board or page. It reuses the existing captured navigation identity and current readonly state. A newly created project remains saved and appears in Projects when its original pane context has changed. Snapshot activation reports whether it applied after waiting for queued writes; both callers check the result. No request/save is cancelled retroactively.

Verification is strict unused-symbol TypeScript compilation, production packaging and direct source review of all creation/import follow-ups and the shared activation/queue/binding paths. No tests, assertions, fixtures, verification designs, saved-project writes or app imports were added or run. Actual delayed responses, rapid navigation, History/library interactions and installed-host behavior were not exercised in a browser. Loading/interaction latency, memory, CPU utilization, panning/FPS and GPU metrics remain unmeasured, and no performance improvement is claimed.

Artifact method: compare the existing clean packaged 82d4615 build with the completed production build; exact file bytes and Python gzip level 9 with fixed mtime. The frontend widget grows as follows; the Codex, browser, JSX-renderer and starter bundles retain identical bytes and SHA-256 hashes. No new dependency or persistence/MCP format was added. Build output retains the existing large-chunk warning.

| Artifact / encoding | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Widget · raw | 3,526,210 B | 3,526,515 B | +305 B | +0.00865% |
| Widget · gzip level 9 | 981,157 B | 981,304 B | +147 B | +0.01498% |

The user's practical benefit is preserving their current canvas and history preview when earlier creation work finishes. Bundle size is an artifact measurement, not a measured download/load-time change. Artifact hashes and comparisons are in /private/tmp/codex-creation-navigation-review/.

## States and live-layer review fixes — October 15, 2026

Correctness and safety fixes from an independent review of the two entries above; no speedup is claimed. The changes: state colours accept only safe colour values, and every inline CSS string escapes `; { } < >`. State rules are emitted in focus → hover → pressed order, with focus as `:has(:focus-visible)`. Children of a linked layer follow that layer's hover. A border added only in a state becomes an inset outline. Hidden layers emit no state rules. Live documents load a prelude that removes the WebRTC constructors and owns Esc. A second frame load (self-navigation) resets the frame to its passive document. HTML exports run live layers only after a click on Run. The canvas map never runs scripts. Inert state keys, empty states and stray `live` flags are normalised on every write path.

Real-pointer check: headless Chrome driven over the DevTools protocol with real mouse and keyboard events on an exported page (file URL), plus a UDP listener and an HTTP server on 127.0.0.1.

| Check | Result |
| --- | --- |
| Button base → hover → pressed → released → left | rgb(51,102,255) → rgb(255,138,76) → rgb(194,77,6) → rgb(255,138,76) → rgb(51,102,255); pressed now wins and focus does not stick after a click |
| Keyboard focus (Tab) on that button | rgb(255,255,255) |
| Child text of a linked card, card hovered / not hovered | rgb(255,0,0) / rgb(255,255,255) |
| Child position when a state-only border appears | unchanged (600,0 20×20); outline 1px, offset −1px |
| Live layer before Run | no messages, empty sandbox |
| After Run | script ran; `RTCPeerConnection` and `webkitRTCPeerConnection` both blocked; 0 UDP packets; its `location.href` navigation reset the frame to the passive document with the Run button restored; 0 requests reached the HTTP server |
| Canvas map | no `allow-scripts`, `script-src` or Run button |
| Schema | `red}body{…}x{` and `var(--x)` rejected as state fills; hex, rgba and `transparent` accepted |

The 0 HTTP requests is specific to a file-URL page; whether a served page's frame can complete one navigation request before the reset was not measured, so the docs say navigation is reset, not prevented.

Export cost (same 4,944-node workload and benchmark as the states entry; 3 warmups and 12 samples, reporting medians): output bytes are unchanged at 2,327,833 B HTML / 2,635,692 B React without states, and 2,364,159 B / 2,658,664 B with 238 stateful layers (0 B, 0%). The escaping touches no value in this design. Medians this run were 19.7/20.1 ms without states and 21.3/21.1 ms with them. HEAD has moved several commits since the 17.8/18.5 ms baseline and no back-to-back pre-fix run was taken, so no timing change is claimed. `tsc --noEmit` and `vite build` pass. The editor's double-click, Esc and navigation-reset flow, and the Inspector's Focus gating, compile but were not exercised in a browser. No tests were added or run.

## Incremental save validation — October 15, 2026

Phase 2 of the corporate-scale plan. Same `ProjectStore.mutate` benchmark as the content-addressed history entry: scratch data, 20 sequential `update_node` saves of the first root frame, median and p90 over saves 3–20, two runs per side, HEAD vs working tree in the same order. The document cap was raised to 32 MiB for both sides only so the 48× workload could load. Node.js 24.19.0, macOS arm64.

| Workload | Measurement | Before | After | Absolute change | Percentage change |
| --- | --- | ---: | ---: | ---: | ---: |
| 12×, 12 pages (1.69 MB, 4,944 nodes) | Save median | 83.2 / 84.1 ms | 57.8 / 57.9 ms | −25.8 ms | −30.9% |
| | CPU per save | 49.8 / 50.5 ms | 21.3 / 22.3 ms | −28.4 ms | −56.5% |
| | List versions | 17.4 / 13.1 ms | 4.3 / 4.6 ms | −10.8 ms | −70.8% |
| 48×, 48 pages (6.78 MB, 19,776 nodes) | Save median | 196.0 / 196.8 ms | 89.0 / 90.9 ms | −106.5 ms | −54.2% |
| | CPU per save | 168.8 / 170.9 ms | 55.0 / 57.2 ms | −113.8 ms | −67.0% |
| | clone + apply + validate | 113.2 / 115.1 ms | 29.4 / 31.8 ms | −83.6 ms | −73.2% |
| | List versions | 40.8 / 41.6 ms | 3.7 / 3.0 ms | −37.9 ms | −92.0% |

Changes: `validateProjectUpdate` re-validates only the nodes, pages, threads and components whose JSON changed, reusing earlier results by structural equality (`sameJson`), while project-wide invariants still run on every save and two of them are no longer quadratic. The history encoder reuses the stored JSON and hash of unchanged pages instead of hashing the whole project. Request size and saved-document size are separate limits. A scratch check ran 24 valid and invalid edits through both the incremental and the full validator and got the same outcome, including the same errors, every time.

User effect: on a 48-page project an edit is durable in about 90 ms instead of about 196 ms of server time; most of what remains is fsync, not CPU. History listing is effectively instant. Raw output: `artifacts/save-pipeline-phase2.txt`.

## Delta editor sync and compact MCP acknowledgements — October 15, 2026

Phase 3. Workload: the same scratch projects, driven in-process through the embedded MCP server (`canvas_edit_project` with one node move, then `canvas_watch_project` for the next revision), with the editor's merge (`applyProjectDelta` plus `share`) timed separately. Two runs per side, HEAD vs working tree; the table shows run 1 / run 2.

| Workload | Measurement | Before | After | Absolute change | Percentage change |
| --- | --- | ---: | ---: | ---: | ---: |
| 48×, 48 pages | Edit round trip | 1,193.1 / 1,187.7 ms | 81.8 / 81.9 ms | −1,108.6 ms | −93.1% |
| | Edit CPU | 1,361.3 / 1,386.2 ms | 47.7 / 47.3 ms | −1,326.3 ms | −96.5% |
| | SDK output validation | 1,012.7 / 1,013.9 ms | 0.2 / 0.2 ms | −1,013.1 ms | −99.98% |
| | Edit response | 5,980.7 KB | 126.2 KB | −5,854.5 KB | −97.9% |
| | Editor parse + merge | 93.9 / 95.7 ms | 3.9 / 4.0 ms | −90.9 ms | −95.8% |
| | Watch update | 1,060.8 / 1,018.5 ms, 5,980.7 KB | 1.1 / 1.2 ms, 126.2 KB | −1,038.5 ms | −99.9% |
| 12×, 12 pages | Edit round trip | 224.9 / 230.2 ms | 56.3 / 56.2 ms | −171.3 ms | −75.3% |
| | Edit response | 1,490 KB | 125 KB | −1,365 KB | −91.6% |

Changes: tools that return a project declare a shallow passthrough output schema, so the MCP SDK no longer re-validates the full document on every call (the largest single cost). Edits and watches can return a delta containing only the changed pages, which the editor merges into its existing copy; a stale base revision falls back to a full read. `canvas_edit_project` returns a compact acknowledgement unless `includeProject: true`, and `canvas_get_project` accepts `boardScope` to read one board. The benchmark confirmed the merged editor copy is identical to the saved project. `docs/mcp.md`, the skill and the server instructions describe the new defaults.

User effect: an agent edit on a 48-page project round-trips in about 82 ms instead of about 1.2 s, and the open editor picks it up in about 5 ms instead of about 1.1 s, with 98% less data per update. Not done: on-demand board loading (a partial document cannot pass the project-wide checks), and `canvas_open_canvas` still sends the whole project because the widget needs it at launch. Raw output: `artifacts/mcp-sync-phase3-before.txt`, `artifacts/mcp-sync-phase3-after.txt`.

## Corporate-scale limits and page-scoped working copies — October 15, 2026

Phase 4. Limits are now: 2 MiB per request or transaction; 32 MiB per saved document, import or history snapshot; 500 boards, 500 pages, 25,000 nodes per page, 100,000 nodes per project, 5,000 native components and 20,000 conversations. Component nodes stay at 5,000 and a transaction at 2,000 operations.

`mutate` now deep-copies only the pages a page-scoped transaction (`create_node`, `update_node`, `delete_node`, `snap_node`) touches and shares every other page by reference; any other operation still clones the whole project. A scratch check deep-froze the cached project before a save: nothing was mutated and untouched pages kept their identity. Same save benchmark, the working tree with the new limits before and after this change, two runs each (run 1 / run 2).

| Workload | Measurement | Full clone | Page-scoped copy | Absolute change | Percentage change |
| --- | --- | ---: | ---: | ---: | ---: |
| 120×, 120 pages (16.98 MB, 49,440 nodes) | Save median | 164.2 / 169.7 ms | 99.2 / 101.1 ms | −66.8 ms | −40.0% |
| | CPU per save | 138.7 / 145.9 ms | 61.0 / 63.7 ms | −80.0 ms | −56.2% |
| | clone + apply + validate | 71.1 / 77.9 ms | 13.7 / 14.5 ms | −60.4 ms | −81.1% |
| 48×, 48 pages | Save median | 89.0 / 89.0 ms | 66.9 / 68.1 ms | −21.5 ms | −24.2% |
| | CPU per save | 55.7 / 55.1 ms | 31.0 / 31.5 ms | −24.2 ms | −43.6% |

At 120 pages, `history.save` (writing the 17 MB working file and fsync) is about 86 ms of the remaining save. The JS heap after GC is about 102 MB either way. RSS high-water marks were 1.1–1.8 GB with full clones and about 0.5 GB with page-scoped copies, but RSS depends on GC timing and these figures are noisy, so no exact memory saving is claimed. The MCP path on the same build: 48× edit 64.3–64.5 ms (81.8 ms after phase 3), and 120× edit 91.4–92.6 ms with 56–57 ms CPU, a 128.6 KB response, 9.2–9.5 ms editor merge and a 1.4–1.6 ms watch.

User effect: a 120-page, 49,000-node project, which the old 2 MiB cap rejected outright, now saves in about 100 ms of server time and syncs to an open editor in under 100 ms. Raw output: `artifacts/save-limits-phase4-fullclone.txt`, `artifacts/save-limits-phase4-pagecopy.txt`, `artifacts/mcp-sync-phase4.txt`.

## Windowed layers panel, drag preview and history diff — October 15, 2026

Phase 5. Workload: one page holding 48 GaugeReel copies (19,776 nodes, 768 root frames, 912 root layer rows, 7.1 MB) in scratch data; Vite dev server with React development Strict Mode and `?profile=1`; built-in browser at an emulated 1280 × 800; `requestAnimationFrame` mapped to a MessageChannel macrotask. A step is dispatch, two macrotasks, then a forced layout, so these are main-thread work per step, not frame rates. Before means the HEAD versions of `src/App.tsx`, `src/Inspector.tsx` and `src/editor-utils.ts` swapped into the same tree on freshly regenerated data. With the inspector open, before shows two runs and after shows one.

| Inspector open | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Drag: mean step | 78.5 / 74.9 ms | 36.2 ms | −40.5 ms | −52.8% |
| Drag: p95 step | 166 / 178 ms | 66 ms | −106 ms | −61.6% |
| Drag: layer-row renders, 60 moves | 113,088 | 96 | −112,992 | −99.9% |
| Drop to saved | 697 / 703 ms | 484 ms | −216 ms | −30.9% |
| Clear selection (Esc) | 215 / 207 ms | 74.5 ms | −136.5 ms | −64.7% |
| Open inspector | 338 / 336 ms | 87 ms | −250 ms | −74.2% |
| Filter layers | 284 / 268 ms | 60 ms | −216 ms | −78.3% |
| Clear filter | 157 / 151 ms | 73 ms | −81 ms | −52.6% |
| Select the 10th layer row | 110.9 ms | 104.1 ms | −6.8 ms | −6.1% (within noise) |
| Scroll layers, 100 px steps | 8.6 ms | 14.3 ms | +5.7 ms | +66% (regression) |
| Scroll layers, 300 px steps | 15.2 ms | 27.9 ms | +12.7 ms | +84% (regression) |
| DOM elements | 33,832 | 24,037 | −9,795 | −29.0% |

| Inspector closed | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Drag: mean step | 35.74 ms | 26.97 ms | −8.77 ms | −24.5% |
| Drag: p95 step | 61.9 ms | 52.1 ms | −9.8 ms | −15.8% |
| Drag: React render, 60 moves | 1,234.5 ms | 756.6 ms | −477.9 ms | −38.7% |
| Zoom: mean step | 30.08 ms | 29.55 ms | −0.53 ms | −1.8% (no change) |
| Zoom: React render, 40 steps | 640.1 ms | 448.9 ms | −191.2 ms | −29.9% |
| Pan: mean step | 13.57 ms | 13.85 ms | +0.28 ms | +2.1% (no change) |
| Drop to saved | 465.2 ms | 484.2 ms | +19.0 ms | +4.1% (single network-bound run) |

Changes:

- **Windowed layer tree.** `LayerTree` is a memoized component that renders fixed 22 px rows in 20-row chunks around the scroll position; selection and the Inspector's callbacks reach it through a ref, so canvas drags no longer re-render it. Revealing the selection scrolls by row index.
- **Drag preview reuses unchanged nodes.** When every patch only moves x/y and the parent is not a stack, the preview copies the base node array and replaces just the moved entries instead of re-resolving 19,776 nodes. Other gestures use the previous path. With the drag fast path alone, the mean step was 29.55 ms.
- **Frame-label layout uses column buckets.** `layoutFrameLabels` checks collisions only against labels in the same 256 px screen column (wide labels in a separate list): 6.27 → 1.80 ms per call at 768 frames in Node, with 0 mismatches over 16 cases (the real page plus 600 random frames at 8 zooms).
- **History diff compares raw pages.** `versionChanges` resolves tokens only for the page it shows when the design-system tokens are unchanged: 19.5 → 3.3 ms at 48 pages and 48.1 → 6.9 ms at 120 pages (2,000 threads), with 0 mismatches over 6 edit types (node moved, node removed, thread reply, token value, no change, page added).

User effect: with the layers panel open on a corporate-scale page, dragging does about half the main-thread work per move, and opening, filtering and clearing the selection take a quarter to a third of the time they did. Known regression: scrolling the layer list does more work per scroll step (14–28 ms vs 9–15 ms), because each 20-row chunk boundary re-renders the window; the list now holds about 60 rows instead of all 912, so the trade was accepted, but it is not yet fixed. Zoom and pan wall time did not change. Raw output: `artifacts/canvas-phase5-layers-before.json`, `artifacts/canvas-phase5-layers-after.json`, `artifacts/canvas-phase5-drag.json`, `artifacts/version-changes-phase5.txt`.

## Selection and drag-start work — October 15, 2026

Same 48× page, dev server, viewport and step definition as the phase 5 entry. Before and after swapped `src/App.tsx`, `src/Inspector.tsx`, `src/editor-utils.ts`, `src/DesignNode.tsx`, `shared/effects.ts` and `shared/snapping.ts` (before = this session's working tree without these changes) and reloaded the page. Medians of 7 trials for selection and 4 drags for drag start; after shows two runs.

| Measurement | Before | After | Absolute change | Percentage change |
| --- | ---: | ---: | ---: | ---: |
| Click-select a frame, inspector closed | 55.2 ms | 45.1 / 47.4 ms | −8.9 ms | −16.1% |
| Esc, inspector closed | 36.6 ms | 27.3 / 30.2 ms | −7.9 ms | −21.6% |
| Click-select a frame, inspector open | 96.9 ms | 84.5 / 86.7 ms | −11.3 ms | −11.7% |
| Select a layer row | 93.2 ms | 79.5 / 76.8 ms | −15.0 ms | −16.1% |
| Pointer-down on a frame (drag start) | 56.4 ms | 47.9 / 45.3 ms | −9.8 ms | −17.4% |
| Later drag moves, mean | 26.21 ms | 22.76 / 23.03 ms | −3.32 ms | −12.7% |
| First drag move | 47.3 ms | 45.3 / 48.4 ms | −0.45 ms | −1.0% (no change) |

Changes, found with Chrome's JS Self-Profiling API through a scratch proxy that added the `Document-Policy: js-profiling` header:

- The Inspector's state-link check reused the existing layer index instead of rebuilding an id map and child map over every node on each selection.
- `shared/effects.ts` exports its per-array `nodeIndex` cache. `selectionRoots`, the App's `nodeById`, the canvas child index and `createSnapScene` use it instead of building their own id maps.
- Snap candidates are built on a gesture's first move instead of on every pointer-down, so a plain click no longer pays for them. `createSnapScene` decides whether a node can snap (parent, sibling or root) before walking its ancestors for visibility. That cut it from 4.6 to 1.5 ms per call on 19,776 nodes, with 0 mismatches over 27 cases including hidden nodes and multi-node drags. That timing has the cached index warm, as it is in the editor.

Correctness fix: the windowed layer tree from phase 5 measured the list's offset with `offsetTop`, which is relative to `.inspector` (60 px), not to the scroller (2 px). Selecting a layer above the current scroll position left its row hidden 58 px above the list in 4 of 7 checks; 7 of 7 are visible now. The reveal uses the fixed row geometry and a tracked scroll position instead of reading layout. It measured 12–13 ms per selection, but that is forced layout that would otherwise run at frame time, so no speedup is claimed for it.

User effect: clicking, deselecting and starting a drag on a 20,000-node page take 8–15 ms less main-thread work each (12–22%), and every drag move takes about 3 ms less. What remains with the inspector closed is mostly React development-mode overhead and browser rendering; only about 9 ms per click is application script. Production-build interaction timings, paint, frame rate and memory were not measured. Raw output: `artifacts/selection-phase6.json`, `artifacts/snap-scene-phase6.txt`.

`npm run typecheck` and `npm run build` pass for this entry and for the phase 2–5 entries above (the build keeps its existing large-chunk warning). No tests, dependencies or fixtures were added or run.
