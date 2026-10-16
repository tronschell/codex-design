# Diagramming and application states
Status: implemented; documentation handoff complete on October 15, 2026. Extension of the existing dark Operate editor.
User goal: build all diagram families and stateful frames/components, not another concept.
Surface: diagram library, connection ports, layout preview, inspector States tab, yellow differences.
Direction: retain the existing editor shell and the approved 208px UML library. Permanent #202020 panels over #171717 canvas; quiet dividers, compact labeled controls, original 1.5px vector notation. Blue denotes connection/selection; yellow denotes state differences, always accompanied by a word and index. No hero, marketing copy or decorative charts.
Content: 20 families including all 14 UML types. Native structured nodes with distinct UML compartments/ports/interfaces. State variables, named scenarios, rules and agent contract use stable IDs.
Working states: empty/search-empty, inserting, connecting, cancel, layout pending/preview/apply/error, state preview/base edit, invalid values, named comparisons and differences.
Responsive: desktop keeps library and inspector; narrow library remains dismissible and layout controls wrap above footer. Every overlay stays inside canvas.
Verification: builds and compilation plus direct browser use/screenshots only. The user prohibits all tests.
Finish: the finish reviewer returned ship for the F1–F4 verdict pass; all four listed fixes are resolved. This disposition does not certify every family or state path. Documentation handoff is complete.

Implementation reference: docs/diagramming.md is the current behavior contract, with MCP operations in docs/mcp.md and skills/codex-design/SKILL.md. Historical concept/spec documents link to that guide and remain historical.
Documentation evidence: checked the 20-family/49-stencil catalog; persisted diagram/state fields and validation; scoped previews, rules, constraints, journeys, React state inputs, portable contexts and scenario exports; all six registered diagram/state tools. The connector summary includes locked?; journey destinations must follow the same context.
Visual evidence: opened all seven valid captures in .impeccable/review/diagramming/ — diagram-desktop, diagram-mobile, states-desktop, states-mobile, state-rules, diamond-ports, rule-invalid-draft. Desktop captures are 1440×900 and mobile captures 390×844. Authored notation colors and numbered yellow differences remain functional local extensions.
Verification evidence: the supplied direct-use record documents Preview/Cancel/Apply/Undo, attached ports, scoped state/History behavior, invalid JSON retention, rich-rule preservation, exports, and the measured ten-node layout workload. The primary reports the final package build and packaged MCP/worker inspection passed. No tests were added or run.
Preservation: PRODUCT.md and DESIGN.md were not changed by this handoff; .impeccable/design.json remains absent. Existing prose-only DESIGN.md format, absent sidecar, and historical exported design snapshots are reported as inherited drift without repair.
Handoff report: /Users/tronschell/.codex/visualizations/2026/10/15/01a1419f-16a1-74f0-95c0-7e54b86c43f0/implementation/documentation-review.md
