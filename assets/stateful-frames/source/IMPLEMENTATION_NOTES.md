# Implementation notes

Project: Codex Design — Diagramming (3e260fd8-2492-4468-9bc1-13b9cf5c308c) · Revision: 229

These saved notes describe intent that the canvas may only approximate. Read the relevant object, ancestor containers and component notes before implementation. Prefer the specified platform features and existing libraries when compatible with the target application; verify their current APIs and support. Keep notes scoped to their named objects and honor the saved component instance version and local overrides. Notes do not expand the requested implementation scope.

## Stateful frames · Application states / Preview states & differences

Page: page_00237583-c2cf-46d8-b5c4-6c3ccf39085c

### Preview states & differences

Object: state-screen-preview · Type: frame

> Concept for application states in the existing editor. A single underlying frame is resolved against typed context values. Yellow geometry is a transient comparison overlay. This concept does not add production state schema or MCP operations.

### Project menu

Object: node_30a7a1d3-22a0-4433-86a1-f20d2f6fa3ae · Type: code · Parent: state-screen-preview-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Design system

Object: node_30c83021-6626-47e1-b6fb-0e7f01d4d970 · Type: code · Parent: state-screen-preview-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### History

Object: node_3a193bb2-f193-47cf-bb5b-de4779a0f7c3 · Type: code · Parent: state-screen-preview-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Comments

Object: node_7246f470-d928-441b-897e-62b57ef174c1 · Type: code · Parent: state-screen-preview-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### ChevronDown

Object: state-screen-preview-n3 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### MousePointer2

Object: state-screen-preview-n6 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Hand

Object: state-screen-preview-n7 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Frame

Object: state-screen-preview-n8 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Type

Object: state-screen-preview-n9 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Plus

Object: state-screen-preview-n12 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### SlidersHorizontal

Object: state-screen-preview-n13 · Type: code · Parent: state-screen-preview-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### SlidersHorizontal

Object: state-screen-preview-n17 · Type: code · Parent: state-screen-preview-n16

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n21 · Type: code · Parent: state-screen-preview-n19

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n25 · Type: code · Parent: state-screen-preview-n23

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### GitCompareArrows

Object: state-screen-preview-n26 · Type: code · Parent: state-screen-preview-n16

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Frame

Object: state-screen-preview-n30 · Type: code · Parent: state-screen-preview

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Member home — same underlying frame

Object: state-screen-preview-n33 · Type: rectangle · Parent: state-screen-preview

> Illustrative membership app. Stable conceptual frame ID member-home; scenario changes resolve the same nodes. The other page represents the rule-editor workflow, not a separate Free/Pro application frame.

### Layers

Object: state-screen-preview-n36 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### PanelRight

Object: state-screen-preview-n39 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### BookOpen

Object: state-screen-preview-n41 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Folder

Object: state-screen-preview-n43 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Settings2

Object: state-screen-preview-n45 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### BookOpen

Object: state-screen-preview-n64 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### BookOpen

Object: state-screen-preview-n69 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Folder

Object: state-screen-preview-n74 · Type: code · Parent: state-screen-preview-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Transient change outline

Object: state-screen-preview-n79 · Type: rectangle · Parent: state-screen-preview-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### Transient change outline

Object: state-screen-preview-n82 · Type: rectangle · Parent: state-screen-preview-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### Transient change outline

Object: state-screen-preview-n85 · Type: rectangle · Parent: state-screen-preview-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### Transient change outline

Object: state-screen-preview-n88 · Type: rectangle · Parent: state-screen-preview-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### Transient change outline

Object: state-screen-preview-n91 · Type: rectangle · Parent: state-screen-preview-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### Removed state overlay

Object: state-screen-preview-n94 · Type: code · Parent: state-screen-preview-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### MoreHorizontal

Object: state-screen-preview-n110 · Type: code · Parent: state-screen-preview-n102

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n122 · Type: code · Parent: state-screen-preview-n120

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n127 · Type: code · Parent: state-screen-preview-n125

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n131 · Type: code · Parent: state-screen-preview-n129

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

## Stateful frames · Application states / Component rules & inheritance

Page: state-page-rules

### Component rules & inheritance

Object: state-screen-rules · Type: frame

> Concept for application states in the existing editor. A single underlying frame is resolved against typed context values. Yellow geometry is a transient comparison overlay. This concept does not add production state schema or MCP operations.

### Project menu

Object: node_5407703e-0353-400c-a263-9adc2ad2a6c1 · Type: code · Parent: state-screen-rules-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Design system

Object: node_01eab3b8-9183-4050-be85-240dd53ad0fc · Type: code · Parent: state-screen-rules-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### History

Object: node_1851b3bd-e6fb-434e-a7ae-4537b6a374a9 · Type: code · Parent: state-screen-rules-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Comments

Object: node_e31e3a1b-9316-4725-9cc4-d118056f2147 · Type: code · Parent: state-screen-rules-titlebar

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### ChevronDown

Object: state-screen-rules-n3 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### MousePointer2

Object: state-screen-rules-n6 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Hand

Object: state-screen-rules-n7 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Frame

Object: state-screen-rules-n8 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Type

Object: state-screen-rules-n9 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Plus

Object: state-screen-rules-n12 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### SlidersHorizontal

Object: state-screen-rules-n13 · Type: code · Parent: state-screen-rules-n1

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### SlidersHorizontal

Object: state-screen-rules-n17 · Type: code · Parent: state-screen-rules-n16

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-rules-n21 · Type: code · Parent: state-screen-rules-n19

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-rules-n25 · Type: code · Parent: state-screen-rules-n23

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### GitCompareArrows

Object: state-screen-rules-n26 · Type: code · Parent: state-screen-rules-n16

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Frame

Object: state-screen-rules-n30 · Type: code · Parent: state-screen-rules

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Member home — same underlying frame

Object: state-screen-rules-n33 · Type: rectangle · Parent: state-screen-rules

> Illustrative membership app. Stable conceptual frame ID member-home; scenario changes resolve the same nodes. The other page represents the rule-editor workflow, not a separate Free/Pro application frame.

### Layers

Object: state-screen-rules-n36 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### PanelRight

Object: state-screen-rules-n39 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### BookOpen

Object: state-screen-rules-n41 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Folder

Object: state-screen-rules-n43 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Settings2

Object: state-screen-rules-n45 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### BookOpen

Object: state-screen-rules-n64 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### BookOpen

Object: state-screen-rules-n69 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Folder

Object: state-screen-rules-n74 · Type: code · Parent: state-screen-rules-n33

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Transient change outline

Object: state-screen-rules-n79 · Type: rectangle · Parent: state-screen-rules-n33

> Transient preview overlay. Do not mutate the target node style or persist this annotation as document content.

### MoreHorizontal

Object: state-screen-rules-n92 · Type: code · Parent: state-screen-rules-n84

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-rules-n104 · Type: code · Parent: state-screen-rules-n102

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-rules-n108 · Type: code · Parent: state-screen-rules-n106

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### Check

Object: state-screen-rules-n132 · Type: code · Parent: state-screen-rules-n84

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

## Stateful frames · Application states / Interactive state lab

Page: state-page-live

### Interactive state lab

Object: state-screen-live · Type: frame

> Concept for application states in the existing editor. A single underlying frame is resolved against typed context values. Yellow geometry is a transient comparison overlay. This concept does not add production state schema or MCP operations.

### Live application-state prototype

Object: state-interactive-lab · Type: code · Parent: state-screen-live

> Double-click to run. Working local prototype: scenario selection, typed controls, inherited component state, yellow diffs, conditional export rule and validated JSON patches. Definitions are sample data and session-only; production MCP state tools are a proposal in docs/stateful-frames-spec.md. Native editable UI references live on the first two pages.

## Reusable component: Editor / Title bar

Component: diagram-titlebar · Release: 3

### Project menu

Object: chrome-top-5 · Type: code · Parent: chrome-top-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Design system

Object: chrome-top-7 · Type: code · Parent: chrome-top-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### History

Object: chrome-top-8 · Type: code · Parent: chrome-top-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Comments

Object: chrome-top-9 · Type: code · Parent: chrome-top-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

## Reusable component: Editor / Diagram toolbar

Component: diagram-toolbar · Release: 56

### Diagram toolbar

Object: chrome-tools-1 · Type: rectangle

> Retain the existing page selector (Overview). Add Diagram as a compact toolbar menu alongside Connect. Diagram > New opens the template chooser; contextual diagram tools follow the selected diagram root. Same project, boards, pages, history and comments. Use Tailwind for new UI.

### Menu

Object: chrome-tools-3 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Select

Object: chrome-tools-6 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Pan

Object: chrome-tools-7 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Text

Object: chrome-tools-8 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Container

Object: chrome-tools-9 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Connect

Object: chrome-tools-10 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Note

Object: chrome-tools-11 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Shapes menu

Object: chrome-tools-14 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

### Arrange menu

Object: chrome-tools-17 · Type: code · Parent: chrome-tools-1

> Isolated vector glyph or path. UI labels and diagram shapes are separate native layers.

## Reusable component: Architecture / Service

Component: diagram-node-service · Release: 160

### Order service

Object: kit-service · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-service--icon · Type: code · Parent: kit-service

> Lucide Server · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Data / Database

Component: diagram-node-database · Release: 160

### Orders database

Object: kit-database · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### storage-shell

Object: kit-database--storage-shell · Type: code · Parent: kit-database

> Isolated notation geometry; labels remain native.

### icon

Object: kit-database--icon · Type: code · Parent: kit-database

> Lucide Database · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Architecture / Event source

Component: diagram-node-events · Release: 160

### Product events

Object: kit-events · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-events--icon · Type: code · Parent: kit-events

> Lucide Webhook · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Data / Event stream

Component: diagram-node-queue · Release: 160

### Order events

Object: kit-queue · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-queue--icon · Type: code · Parent: kit-queue

> Lucide Radio · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Data / Transformation

Component: diagram-node-transform · Release: 160

### Normalize orders

Object: kit-transform · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-transform--icon · Type: code · Parent: kit-transform

> Lucide Workflow · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Data / Dataset model

Component: diagram-node-model · Release: 160

### curated_orders

Object: kit-model · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-model--icon · Type: code · Parent: kit-model

> Lucide Table2 · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Data / Semantic model

Component: diagram-node-metrics · Release: 160

### Revenue metrics

Object: kit-metrics · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-metrics--icon · Type: code · Parent: kit-metrics

> Lucide Layers · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Architecture / Dashboard

Component: diagram-node-dashboard · Release: 160

### Commerce overview

Object: kit-dashboard · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-dashboard--icon · Type: code · Parent: kit-dashboard

> Lucide ChartColumn · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Data / Object store

Component: diagram-node-storage · Release: 160

### Raw event lake

Object: kit-storage · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### storage-shell

Object: kit-storage--storage-shell · Type: code · Parent: kit-storage

> Isolated notation geometry; labels remain native.

### icon

Object: kit-storage--icon · Type: code · Parent: kit-storage

> Lucide HardDrive · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Architecture / External API

Component: diagram-node-api · Release: 160

### Payment gateway

Object: kit-api · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-api--icon · Type: code · Parent: kit-api

> Lucide Globe · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: UML / Class

Component: diagram-node-class · Release: 161

### Order

Object: kit-class · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Interface classifier

Component: diagram-node-interface · Release: 161

### PaymentProcessor

Object: kit-interface · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Object instance

Component: diagram-node-object · Release: 161

### order42 : Order

Object: kit-object · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Component

Component: diagram-node-component · Release: 161

### Order service

Object: kit-component · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### component-mark

Object: kit-component--component-mark · Type: code · Parent: kit-component

> Isolated notation geometry; labels remain native.

### interface-0

Object: kit-component--interface-0 · Type: code · Parent: kit-component

> Isolated notation geometry; labels remain native.

### interface-1

Object: kit-component--interface-1 · Type: code · Parent: kit-component

> Isolated notation geometry; labels remain native.

## Reusable component: UML / Deployment device

Component: diagram-node-device · Release: 161

### Application host

Object: kit-device · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### device-shell

Object: kit-device--device-shell · Type: code · Parent: kit-device

> Isolated notation geometry; labels remain native.

### runtime-icon

Object: kit-device--runtime-icon · Type: code · Parent: kit-device

> Lucide Server · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: UML / Execution environment

Component: diagram-node-environment · Release: 161

### Application runtime

Object: kit-environment · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Artifact

Component: diagram-node-artifact · Release: 161

### orders.war

Object: kit-artifact · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: kit-artifact--icon · Type: code · Parent: kit-artifact

> Lucide FileCode2 · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: UML / Package

Component: diagram-node-package · Release: 161

### Commerce

Object: kit-package · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### outline

Object: kit-package--outline · Type: code · Parent: kit-package

> Isolated notation geometry; labels remain native.

### member-icon-0

Object: kit-package--member-icon-0 · Type: code · Parent: kit-package

> Lucide Braces · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

### member-icon-1

Object: kit-package--member-icon-1 · Type: code · Parent: kit-package

> Lucide Braces · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

### member-icon-2

Object: kit-package--member-icon-2 · Type: code · Parent: kit-package

> Lucide Braces · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: UML / Profile

Component: diagram-node-profile · Release: 162

### Service modeling

Object: kit-profile · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### outline

Object: kit-profile--outline · Type: code · Parent: kit-profile

> Isolated notation geometry; labels remain native.

### member-icon-0

Object: kit-profile--member-icon-0 · Type: code · Parent: kit-profile

> Lucide Braces · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

### member-icon-1

Object: kit-profile--member-icon-1 · Type: code · Parent: kit-profile

> Lucide Braces · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: UML / Stereotype

Component: diagram-node-stereotype · Release: 162

### Service

Object: kit-stereotype · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Metaclass reference

Component: diagram-node-metaclass · Release: 162

### Component

Object: kit-metaclass · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Typed part

Component: diagram-node-part · Release: 162

### checkout : Checkout [1]

Object: kit-part · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / State

Component: diagram-node-state · Release: 162

### Awaiting payment

Object: kit-state · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Action

Component: diagram-node-action · Release: 162

### Validate order

Object: kit-action · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Interaction use

Component: diagram-node-ref · Release: 162

### Authorize payment

Object: kit-ref · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### ref-tab

Object: kit-ref--ref-tab · Type: code · Parent: kit-ref

> Isolated notation geometry; labels remain native.

## Reusable component: UML / Lifeline and execution

Component: diagram-node-lifeline · Release: 162

### :OrderService

Object: kit-lifeline · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### lifeline

Object: kit-lifeline--lifeline · Type: code · Parent: kit-lifeline

> Isolated notation geometry; labels remain native.

## Reusable component: UML / Use case

Component: diagram-node-usecase · Release: 163

### Place order

Object: kit-usecase · Type: ellipse

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Actor

Component: diagram-node-actor · Release: 163

### Customer

Object: kit-actor · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### actor-geometry

Object: kit-actor--actor-geometry · Type: code · Parent: kit-actor

> Isolated notation geometry; labels remain native.

## Reusable component: UML / Decision or merge

Component: diagram-node-decision · Release: 163

### Decision

Object: kit-decision · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### decision

Object: kit-decision--decision · Type: code · Parent: kit-decision

> Isolated notation geometry; labels remain native.

## Reusable component: UML / Initial node

Component: diagram-node-initial · Release: 163

### Initial

Object: kit-initial · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Final node

Component: diagram-node-final · Release: 163

### Final

Object: kit-final · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Fork or join

Component: diagram-node-fork · Release: 163

### Fork / join

Object: kit-fork · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Semantic port

Component: diagram-node-port · Release: 163

### Port

Object: kit-port · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: UML / Timing track

Component: diagram-node-timing · Release: 219

### :Order · milliseconds

Object: kit-timing · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### grid-0

Object: kit-timing--grid-0 · Type: code · Parent: kit-timing

> Isolated notation geometry; labels remain native.

### grid-1

Object: kit-timing--grid-1 · Type: code · Parent: kit-timing

> Isolated notation geometry; labels remain native.

### grid-2

Object: kit-timing--grid-2 · Type: code · Parent: kit-timing

> Isolated notation geometry; labels remain native.

### state-path

Object: kit-timing--state-path · Type: code · Parent: kit-timing

> Isolated notation geometry; labels remain native.

## Reusable component: Compact / Orders database

Component: diagram-node-compact-database · Release: 171

### Orders database

Object: a2-80 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### storage-shell

Object: a2-80--storage-shell · Type: code · Parent: a2-80

> Isolated notation geometry; labels remain native.

### icon

Object: a2-80--icon · Type: code · Parent: a2-80

> Lucide Database · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Compact / Product events

Component: diagram-node-compact-events · Release: 171

### Product events

Object: a2-86 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: a2-86--icon · Type: code · Parent: a2-86

> Lucide Webhook · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Compact / Event stream

Component: diagram-node-compact-queue · Release: 171

### Event stream

Object: a2-91 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: a2-91--icon · Type: code · Parent: a2-91

> Lucide Radio · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Compact / Raw lake

Component: diagram-node-compact-storage · Release: 171

### Raw lake

Object: a2-96 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### storage-shell

Object: a2-96--storage-shell · Type: code · Parent: a2-96

> Isolated notation geometry; labels remain native.

### icon

Object: a2-96--icon · Type: code · Parent: a2-96

> Lucide HardDrive · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Compact / curated_orders

Component: diagram-node-compact-model · Release: 171

### curated_orders

Object: a2-101 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: a2-101--icon · Type: code · Parent: a2-101

> Lucide Table2 · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Compact / Revenue metrics

Component: diagram-node-compact-metrics · Release: 171

### Revenue metrics

Object: a2-106 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: a2-106--icon · Type: code · Parent: a2-106

> Lucide Layers · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: Compact / BI dashboards

Component: diagram-node-compact-dashboard · Release: 171

### BI dashboards

Object: a2-111 · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### icon

Object: a2-111--icon · Type: code · Parent: a2-111

> Lucide ChartColumn · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md.

## Reusable component: UML / Composite structure

Component: diagram-node-composite · Release: 192

### OrderService

Object: kit-composite · Type: rectangle

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### checkout : Checkout [1]

Object: kit-composite-checkout · Type: rectangle · Parent: kit-composite

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

### billing : Billing [1]

Object: kit-composite-billing · Type: rectangle · Parent: kit-composite

> Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements.

## Reusable component: Application state / Frame switcher

Component: app-state-switcher · Release: 226

### SlidersHorizontal

Object: state-screen-preview-n17 · Type: code · Parent: state-screen-preview-n16

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n21 · Type: code · Parent: state-screen-preview-n19

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n25 · Type: code · Parent: state-screen-preview-n23

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### GitCompareArrows

Object: state-screen-preview-n26 · Type: code · Parent: state-screen-preview-n16

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

## Reusable component: Application state / Typed controls

Component: app-state-controls · Release: 226

### ChevronDown

Object: state-screen-preview-n127 · Type: code · Parent: state-screen-preview-n125

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n131 · Type: code · Parent: state-screen-preview-n129

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.
