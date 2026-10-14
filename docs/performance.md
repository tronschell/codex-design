# Performance measurements

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
