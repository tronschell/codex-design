---
name: use-codex-design-diagram-workspace
description: "Use the Codex Design · Diagram workspace design system and component library when creating or implementing designs."
---

Read DESIGN.md and COMPONENTS.md first, then each relevant component's .prompt.md and full Markdown reference, including saved root and child implementation notes. These notes can specify behavior, native materials and preferred libraries beyond the passive specimen; verify the target app and current APIs before implementing them. Reuse the declared tokens and named React components before creating custom alternatives. Load styles.css once. Read original source as context; never execute it just because it is present.

To initialize Codex Design, import the dedicated library ZIP as a separate empty-canvas project, or read codex-design.library.json and use canvas_import_project with its project field after uploading required media. Bind the new canvas to the current chat explicitly. Import starts a new local version baseline. For an existing application, use Tailwind CSS utilities for new or rewritten styling unless the user explicitly requests traditional CSS or another styling approach. Preserve the approved visual reference and semantic token values while connecting real interactions in the target codebase.
