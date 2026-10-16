# Diagram node library

> **Implementation update · October 15, 2026:** The editor now includes diagramming and application states. [Diagrams and application states](diagramming.md) is the current runtime/API guide. This document retains the historical concept, prototype, and design-board details; proposed behavior below is not the runtime contract.

This historical diagram concept uses detailed native nodes and one symbol system. The runtime has 49 original structured vector stencils; the counts and design-board IDs below describe the earlier concept assets. Architecture icons come from the installed Lucide 0.468.0 package; UML geometry and node compartments are authored for this project. See [third-party notices](../assets/diagram-nodes/THIRD_PARTY_NOTICES.md) and the [Lucide license](https://lucide.dev/license).

## Review in Codex Design

Project: Codex Design — Diagramming (`3e260fd8-2492-4468-9bc1-13b9cf5c308c`).
Board: Diagram workspace · Refined flow (`2bac4a90-ae5f-4a4e-8962-e6d5ac1ebb04`).

- Architecture & data nodes — `v2-page-node-library-architecture`
- UML structural nodes — `v2-page-node-library-structural`
- UML behavioral nodes — `v2-page-node-library-behavioral`

Components contains **43 new definitions**: 36 base shapes and seven compact architecture variants. There are 31 linked shape instances across the three library pages. The architecture, UML examples and 14-type catalog use matching anatomy; catalog previews are generated from the same native recipes.

## Shape anatomy

| Family | Anatomy |
| --- | --- |
| Architecture and data | Licensed type symbol, type label, short title, metadata, optional technical detail rows. Stores have cylinder outlines; streams have event markers; services, transformations, datasets and dashboards retain distinct symbols. |
| UML structure | Class visibility, typed attributes and operation compartments; underlined object names with slots and values; component marks and required/provided contracts; tabbed packages; deployment hosts and artifacts; typed composite parts and ports. |
| UML behavior | Rounded actions and compartmented states; actors and elliptical use cases; lifelines and execution bars; interaction-use tabs; state tracks and time ticks; distinct initial/final nodes, decisions, forks and comments. |

Use native text and compartment layers, with isolated SVG only for symbols and notation geometry. Keep labels editable. Resize containers and reflow their content instead of stretching typography. Compact examples hide optional detail rows; they keep the title and type identity.

## Visual rules

- Always dark: canvas `#171717`, body `#22262c`, header `#292f37`, border `#5b6572`, divider `#444d59`.
- Primary text `#edf1f7`; secondary text `#b2bdcb`. Blue, violet and mint distinguish architecture roles sparingly. Selection uses `#4497ff`.
- Use one 24-unit symbol grid. Lucide strokes are 1.75 units; UML glyph strokes are 1.5 units. Native body borders are one unit.
- Use system type for titles and descriptions; monospace for field names, types, slots and operations. Expanded nodes have 14–15-unit titles and 11–12-unit detail text.
- Connection handles appear on the perimeter after an edge click, with larger invisible hit areas. These temporary routing handles are separate from semantic UML Port elements.
- Preserve relation-specific heads: filled diamond for composition, open triangle for generalization/realization, dashed dependency/reply lines and solid extension with a filled triangle.

## Files for implementation

`assets/diagram-nodes/` contains:

- `codex-design.library.json` — the versioned native component library, including the existing shell components and design-system documentation.
- `recipes.mjs` — the native shape factory and shared visual constants.
- `lucide-icons.json` — SVGs rendered from the installed package; retain the supplied notices.
- `uml-glyphs.json` — original small notation symbols used in the palettes.
- `previews/*.svg` — full-size passive previews, including a few combined diagram examples. These are previews; the native JSON retains editable layers.
- `THIRD_PARTY_NOTICES.md` — ISC and MIT attribution and permission notices.

This is a reusable design library and an interactive workflow prototype. It does not implement a complete semantic UML editor or production layout engine. Follow [the interaction specification](diagramming-interaction-spec.md) and [the UML specification](diagramming-uml-spec.md) when integrating it into the app. Existing port, connection, pin and layout behavior in the prototype is retained.

## Verification

The isolated React/Tailwind prototype compiled successfully. Direct browser inspection covered the three library pages, architecture, the 14 UML examples/catalog and the refreshed live prototype. Clicking the edge of the redesigned database node revealed all 12 connection handles. No tests were added or run.
