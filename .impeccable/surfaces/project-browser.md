# Project and board browser

Mode: Operate. Primary target: src/ProjectMenu.tsx. Related: src/App.tsx.

## Direction contract

THESIS: Make choosing a saved design visual and deliberate while keeping the editor underneath intact.

OWN-WORLD: Inherit the existing neutral dark editor, system type, restrained borders, grey actions and blue focus. Keep the 32px title-bar trigger.

STORY: Browse projects, inspect a project’s boards, then explicitly open one. Real saved-frame previews, counts and edited dates identify the right work. Creation and import stay available.

FIRST VIEWPORT: A centered modal up to 1120px wide with title/Close, search/sort/actions, three columns of layout-preview cards filling the remaining dialog height. Content scrolls independently. Narrow panes use one column and wrap actions.

FORM: Local extension of the established editor. User supplied the modal direction and metadata/preview request; no concept seed applies.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Constraints: preserve saved documents and per-chat selection. Browsing does not activate a project. Close and Escape restore trigger focus. History is browse-only. No tests, fixtures or generated verification designs. Preview imagery is derived at runtime from saved native layers, not a shipping raster.

Management extension (2026-10-16): quiet Rename/Delete actions below each preview; inline confirmation with an exact-name deletion gate and recovery explanation. Existing local project and board renames were inspected in the browser and restored to their original names; deletion confirmation/cancel and the protected final board were inspected. Build/TypeScript passed. No generated verification designs or tests. Finish verdict: coherent with the dark modal; final installed host needs reload.
