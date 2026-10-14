# Canvas editor

Mode: Operate. Task: inspect, construct, revise, discuss, and approve application screens.

Latest user refinement: substantially reduce the editor chrome's padding and margins to match the dense inspector reference supplied October 14. Use 22px inspector fields/layers, 24px controls, tightly grouped inline fields and single-row layer actions across toolbars, menus, inspector, conversations and dialogs. Preserve typography and canvas content dimensions.

History refinement: top-right history icon beside comments; compact right history panel; preview any saved change without mutating the live project; explicit Apply to restore all project contents; retain historical snapshots for recovery. Flash changed elements briefly yellow and outline removed elements at their previous positions. Keep editor chrome neutral grey without green or olive tints. The comment cursor is a small conversation icon with its top-left corner as the placement hotspot.

Pinned composition: full-viewport dark infinite canvas; project and active board path at top left; comment/share controls top right; page and tool palette floating top left; preview, inspector and zoom floating top right. A right inspector can be toggled. Screens are arranged in named horizontal flows. Comments preserve a component anchor and a conversation. The project dropdown opens on recent boards within the current application project, shows six initially and offers Load more in batches of six. A Projects control retains top-level project switching and creation. Page navigation and implementation handoff belong to the active board.

The source of truth is the server's revisioned document. Canvas interaction must support mouse, trackpad and keyboard; API tools must expose the full hierarchy and source so the agent can work without the rendered UI. First viewport should show a useful GaugeReel flow with multiple screens, recognizable orange controls, and enough whitespace to match the reference.

Validation: desktop main canvas, narrow desktop layout, project/page switching, component editing, saved comments, reload persistence, MCP edit round trip, export source. The user authorized agent delegation using gpt-6.1-sol at max effort.
