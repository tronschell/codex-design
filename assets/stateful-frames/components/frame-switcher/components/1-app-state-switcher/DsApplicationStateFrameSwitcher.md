# Application state / Frame switcher

Proposed frame-scoped View as selector, pinned baseline and yellow difference count. Preview selection is session state, not an edit to the design.

Definition: app-state-switcher · Source release: 226

## Implementation notes

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

## Usage

```jsx
import { DsApplicationStateFrameSwitcher } from './components/1-app-state-switcher/DsApplicationStateFrameSwitcher.jsx';

<DsApplicationStateFrameSwitcher />
```

## React implementation

```jsx
import React from 'react';

export function DsApplicationStateFrameSwitcher() {
  return (
    <div className="cd-component-app-state-switcher" aria-label={"Application state / Frame switcher"}>
      <div className="cd-layer-0" data-node-id={"state-screen-preview-n16"} aria-label={"Frame state switcher"}>
        <div className="cd-layer-1" data-node-id={"state-screen-preview-n17"} aria-label={"SlidersHorizontal"}><img className="cd-media" style={{ objectFit: "fill" }} alt={"SlidersHorizontal"} src={"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23b7b7b7%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20class%3D%22lucide%20lucide-sliders-horizontal%22%3E%3Cline%20x1%3D%2221%22%20x2%3D%2214%22%20y1%3D%224%22%20y2%3D%224%22%3E%3C%2Fline%3E%3Cline%20x1%3D%2210%22%20x2%3D%223%22%20y1%3D%224%22%20y2%3D%224%22%3E%3C%2Fline%3E%3Cline%20x1%3D%2221%22%20x2%3D%2212%22%20y1%3D%2212%22%20y2%3D%2212%22%3E%3C%2Fline%3E%3Cline%20x1%3D%228%22%20x2%3D%223%22%20y1%3D%2212%22%20y2%3D%2212%22%3E%3C%2Fline%3E%3Cline%20x1%3D%2221%22%20x2%3D%2216%22%20y1%3D%2220%22%20y2%3D%2220%22%3E%3C%2Fline%3E%3Cline%20x1%3D%2212%22%20x2%3D%223%22%20y1%3D%2220%22%20y2%3D%2220%22%3E%3C%2Fline%3E%3Cline%20x1%3D%2214%22%20x2%3D%2214%22%20y1%3D%222%22%20y2%3D%226%22%3E%3C%2Fline%3E%3Cline%20x1%3D%228%22%20x2%3D%228%22%20y1%3D%2210%22%20y2%3D%2214%22%3E%3C%2Fline%3E%3Cline%20x1%3D%2216%22%20x2%3D%2216%22%20y1%3D%2218%22%20y2%3D%2222%22%3E%3C%2Fline%3E%3C%2Fsvg%3E"} draggable={false} /></div>
        <div className="cd-layer-2" data-node-id={"state-screen-preview-n18"} aria-label={"View as"}>{"View as"}</div>
        <div className="cd-layer-3" data-node-id={"state-screen-preview-n19"} aria-label={"Pro member"}>
          <div className="cd-layer-4" data-node-id={"state-screen-preview-n20"} aria-label={"Pro member"}>{"Pro member"}</div>
          <div className="cd-layer-5" data-node-id={"state-screen-preview-n21"} aria-label={"ChevronDown"}><img className="cd-media" style={{ objectFit: "fill" }} alt={"ChevronDown"} src={"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23b7b7b7%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20class%3D%22lucide%20lucide-chevron-down%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E"} draggable={false} /></div>
        </div>
        <div className="cd-layer-6" data-node-id={"state-screen-preview-n22"} aria-label={"Compare to"}>{"Compare to"}</div>
        <div className="cd-layer-7" data-node-id={"state-screen-preview-n23"} aria-label={"Free member"}>
          <div className="cd-layer-8" data-node-id={"state-screen-preview-n24"} aria-label={"Free member"}>{"Free member"}</div>
          <div className="cd-layer-9" data-node-id={"state-screen-preview-n25"} aria-label={"ChevronDown"}><img className="cd-media" style={{ objectFit: "fill" }} alt={"ChevronDown"} src={"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23b7b7b7%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20class%3D%22lucide%20lucide-chevron-down%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E"} draggable={false} /></div>
        </div>
        <div className="cd-layer-10" data-node-id={"state-screen-preview-n26"} aria-label={"GitCompareArrows"}><img className="cd-media" style={{ objectFit: "fill" }} alt={"GitCompareArrows"} src={"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23e8c15b%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20class%3D%22lucide%20lucide-git-compare-arrows%22%3E%3Ccircle%20cx%3D%225%22%20cy%3D%226%22%20r%3D%223%22%3E%3C%2Fcircle%3E%3Cpath%20d%3D%22M12%206h5a2%202%200%200%201%202%202v7%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22m15%209-3-3%203-3%22%3E%3C%2Fpath%3E%3Ccircle%20cx%3D%2219%22%20cy%3D%2218%22%20r%3D%223%22%3E%3C%2Fcircle%3E%3Cpath%20d%3D%22M12%2018H7a2%202%200%200%201-2-2V9%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22m9%2015%203%203-3%203%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E"} draggable={false} /></div>
        <div className="cd-layer-11" data-node-id={"state-screen-preview-n27"} aria-label={"6 changes"}>{"6 changes"}</div>
        <div className="cd-layer-12" data-node-id={"state-screen-preview-n28"} aria-label={"Reset"}>
          <div className="cd-layer-13" data-node-id={"state-screen-preview-n29"} aria-label={"Reset"}>{"Reset"}</div>
        </div>
      </div>
    </div>
  );
}
```

## CSS

```css
.cd-component-app-state-switcher .cd-component-app-state-switcher { position: relative; width: 976px; height: 40px; }

.cd-component-app-state-switcher .cd-layer-0 {
  position:absolute;
  left:0;
  top:0;
  width:976px;
  height:40px;
  box-sizing:border-box;
  opacity:1;
  background:#202020;
  border-radius:5px;
  border:1px solid #3b3b3b;
}

.cd-component-app-state-switcher .cd-layer-1 {
  position:absolute;
  left:12px;
  top:12px;
  width:16px;
  height:16px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
  overflow:hidden;
}

.cd-component-app-state-switcher .cd-layer-2 {
  position:absolute;
  left:38px;
  top:11px;
  width:55px;
  height:20px;
  box-sizing:border-box;
  opacity:1;
  color:#ababab;
  font-size:12px;
  font-weight:400;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  text-align:left;
  line-height:1.4;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  letter-spacing:-0.01em;
}

.cd-component-app-state-switcher .cd-layer-3 {
  position:absolute;
  left:97px;
  top:7px;
  width:156px;
  height:26px;
  box-sizing:border-box;
  opacity:1;
  background:#243a54;
  border-radius:4px;
  border:1px solid #4779aa;
}

.cd-component-app-state-switcher .cd-layer-4 {
  position:absolute;
  left:9px;
  top:4px;
  width:138px;
  height:18px;
  box-sizing:border-box;
  opacity:1;
  color:#bddbff;
  font-size:12px;
  font-weight:500;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  text-align:left;
  line-height:1.4;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  letter-spacing:-0.01em;
}

.cd-component-app-state-switcher .cd-layer-5 {
  position:absolute;
  left:131px;
  top:6px;
  width:14px;
  height:14px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
  overflow:hidden;
}

.cd-component-app-state-switcher .cd-layer-6 {
  position:absolute;
  left:285px;
  top:11px;
  width:76px;
  height:20px;
  box-sizing:border-box;
  opacity:1;
  color:#ababab;
  font-size:12px;
  font-weight:400;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  text-align:left;
  line-height:1.4;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  letter-spacing:-0.01em;
}

.cd-component-app-state-switcher .cd-layer-7 {
  position:absolute;
  left:364px;
  top:7px;
  width:149px;
  height:26px;
  box-sizing:border-box;
  opacity:1;
  background:#292929;
  border-radius:4px;
  border:1px solid #3b3b3b;
}

.cd-component-app-state-switcher .cd-layer-8 {
  position:absolute;
  left:9px;
  top:4px;
  width:131px;
  height:18px;
  box-sizing:border-box;
  opacity:1;
  color:#e8eaed;
  font-size:12px;
  font-weight:500;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  text-align:left;
  line-height:1.4;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  letter-spacing:-0.01em;
}

.cd-component-app-state-switcher .cd-layer-9 {
  position:absolute;
  left:124px;
  top:6px;
  width:14px;
  height:14px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
  overflow:hidden;
}

.cd-component-app-state-switcher .cd-layer-10 {
  position:absolute;
  left:550px;
  top:12px;
  width:16px;
  height:16px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
  overflow:hidden;
}

.cd-component-app-state-switcher .cd-layer-11 {
  position:absolute;
  left:575px;
  top:11px;
  width:135px;
  height:20px;
  box-sizing:border-box;
  opacity:1;
  color:#e8c15b;
  font-size:12px;
  font-weight:500;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  text-align:left;
  line-height:1.4;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  letter-spacing:-0.01em;
}

.cd-component-app-state-switcher .cd-layer-12 {
  position:absolute;
  left:904px;
  top:7px;
  width:60px;
  height:26px;
  box-sizing:border-box;
  opacity:1;
  background:#292929;
  border-radius:4px;
  border:1px solid #3b3b3b;
}

.cd-component-app-state-switcher .cd-layer-13 {
  position:absolute;
  left:9px;
  top:4px;
  width:42px;
  height:18px;
  box-sizing:border-box;
  opacity:1;
  color:#e8eaed;
  font-size:12px;
  font-weight:500;
  font-family:system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  text-align:left;
  line-height:1.4;
  white-space:pre-wrap;
  overflow-wrap:break-word;
  letter-spacing:-0.01em;
}

.cd-component-app-state-switcher .cd-media { display: block; width: 100%; height: 100%; pointer-events: none; }

.cd-component-app-state-switcher .cd-code { border: 0; }

.cd-component-app-state-switcher .cd-shader-status { position: absolute; inset: 0; padding: 8px; overflow: auto; color: #ddd; background: #242424; font: 11px/1.4 system-ui, sans-serif; }

.cd-component-app-state-switcher .cd-arrow { position: absolute; right: 0; top: -5px; width: 9px; height: 9px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(45deg); }
```

## Props contract

```typescript
import type { ReactElement } from 'react';

/** Proposed frame-scoped View as selector, pinned baseline and yellow difference count. Preview selection is session state, not an edit to the design. */
export interface DsApplicationStateFrameSwitcherProps {}
export declare function DsApplicationStateFrameSwitcher(props?: DsApplicationStateFrameSwitcherProps): ReactElement;
```

### SlidersHorizontal — authored html

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b7b7b7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sliders-horizontal"><line x1="21" x2="14" y1="4" y2="4"></line><line x1="10" x2="3" y1="4" y2="4"></line><line x1="21" x2="12" y1="12" y2="12"></line><line x1="8" x2="3" y1="12" y2="12"></line><line x1="21" x2="16" y1="20" y2="20"></line><line x1="12" x2="3" y1="20" y2="20"></line><line x1="14" x2="14" y1="2" y2="6"></line><line x1="8" x2="8" y1="10" y2="14"></line><line x1="16" x2="16" y1="18" y2="22"></line></svg>
```

### ChevronDown — authored html

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b7b7b7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
```

### ChevronDown — authored html

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b7b7b7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
```

### GitCompareArrows — authored html

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8c15b" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-git-compare-arrows"><circle cx="5" cy="6" r="3"></circle><path d="M12 6h5a2 2 0 0 1 2 2v7"></path><path d="m15 9-3-3 3-3"></path><circle cx="19" cy="18" r="3"></circle><path d="M12 18H7a2 2 0 0 1-2-2V9"></path><path d="m9 15 3 3-3 3"></path></svg>
```

## Codex Design definition

```json
{
  "id": "app-state-switcher",
  "name": "Application state / Frame switcher",
  "description": "Proposed frame-scoped View as selector, pinned baseline and yellow difference count. Preview selection is session state, not an edit to the design.",
  "rootNodeId": "state-screen-preview-n16",
  "nodes": [
    {
      "id": "state-screen-preview-n16",
      "type": "rectangle",
      "name": "Frame state switcher",
      "parentId": null,
      "x": 0,
      "y": 0,
      "width": 976,
      "height": 40,
      "styles": {
        "fill": "#202020",
        "radius": 5,
        "borderColor": "#3b3b3b",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n17",
      "type": "code",
      "name": "SlidersHorizontal",
      "parentId": "state-screen-preview-n16",
      "x": 12,
      "y": 12,
      "width": 16,
      "height": 16,
      "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b7b7b7\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-sliders-horizontal\"><line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\"></line><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\"></line><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\"></line><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\"></line><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\"></line><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\"></line><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\"></line><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\"></line><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\"></line></svg>",
      "notes": "Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.",
      "styles": {}
    },
    {
      "id": "state-screen-preview-n18",
      "type": "text",
      "name": "View as",
      "parentId": "state-screen-preview-n16",
      "x": 38,
      "y": 11,
      "width": 55,
      "height": 20,
      "content": "View as",
      "styles": {
        "color": "#ababab",
        "fontSize": 12,
        "fontWeight": 400,
        "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "lineHeight": 1.4,
        "whiteSpace": "pre-wrap"
      }
    },
    {
      "id": "state-screen-preview-n19",
      "type": "rectangle",
      "name": "Pro member",
      "parentId": "state-screen-preview-n16",
      "x": 97,
      "y": 7,
      "width": 156,
      "height": 26,
      "styles": {
        "fill": "#243a54",
        "radius": 4,
        "borderColor": "#4779aa",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n20",
      "type": "text",
      "name": "Pro member",
      "parentId": "state-screen-preview-n19",
      "x": 9,
      "y": 4,
      "width": 138,
      "height": 18,
      "content": "Pro member",
      "styles": {
        "color": "#bddbff",
        "fontSize": 12,
        "fontWeight": 500,
        "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "lineHeight": 1.4,
        "whiteSpace": "pre-wrap"
      }
    },
    {
      "id": "state-screen-preview-n21",
      "type": "code",
      "name": "ChevronDown",
      "parentId": "state-screen-preview-n19",
      "x": 131,
      "y": 6,
      "width": 14,
      "height": 14,
      "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b7b7b7\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-chevron-down\"><path d=\"m6 9 6 6 6-6\"></path></svg>",
      "notes": "Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.",
      "styles": {}
    },
    {
      "id": "state-screen-preview-n22",
      "type": "text",
      "name": "Compare to",
      "parentId": "state-screen-preview-n16",
      "x": 285,
      "y": 11,
      "width": 76,
      "height": 20,
      "content": "Compare to",
      "styles": {
        "color": "#ababab",
        "fontSize": 12,
        "fontWeight": 400,
        "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "lineHeight": 1.4,
        "whiteSpace": "pre-wrap"
      }
    },
    {
      "id": "state-screen-preview-n23",
      "type": "rectangle",
      "name": "Free member",
      "parentId": "state-screen-preview-n16",
      "x": 364,
      "y": 7,
      "width": 149,
      "height": 26,
      "styles": {
        "fill": "#292929",
        "radius": 4,
        "borderColor": "#3b3b3b",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n24",
      "type": "text",
      "name": "Free member",
      "parentId": "state-screen-preview-n23",
      "x": 9,
      "y": 4,
      "width": 131,
      "height": 18,
      "content": "Free member",
      "styles": {
        "color": "#e8eaed",
        "fontSize": 12,
        "fontWeight": 500,
        "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "lineHeight": 1.4,
        "whiteSpace": "pre-wrap"
      }
    },
    {
      "id": "state-screen-preview-n25",
      "type": "code",
      "name": "ChevronDown",
      "parentId": "state-screen-preview-n23",
      "x": 124,
      "y": 6,
      "width": 14,
      "height": 14,
      "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b7b7b7\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-chevron-down\"><path d=\"m6 9 6 6 6-6\"></path></svg>",
      "notes": "Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.",
      "styles": {}
    },
    {
      "id": "state-screen-preview-n26",
      "type": "code",
      "name": "GitCompareArrows",
      "parentId": "state-screen-preview-n16",
      "x": 550,
      "y": 12,
      "width": 16,
      "height": 16,
      "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#e8c15b\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-git-compare-arrows\"><circle cx=\"5\" cy=\"6\" r=\"3\"></circle><path d=\"M12 6h5a2 2 0 0 1 2 2v7\"></path><path d=\"m15 9-3-3 3-3\"></path><circle cx=\"19\" cy=\"18\" r=\"3\"></circle><path d=\"M12 18H7a2 2 0 0 1-2-2V9\"></path><path d=\"m9 15 3 3-3 3\"></path></svg>",
      "notes": "Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.",
      "styles": {}
    },
    {
      "id": "state-screen-preview-n27",
      "type": "text",
      "name": "6 changes",
      "parentId": "state-screen-preview-n16",
      "x": 575,
      "y": 11,
      "width": 135,
      "height": 20,
      "content": "6 changes",
      "styles": {
        "color": "#e8c15b",
        "fontSize": 12,
        "fontWeight": 500,
        "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "lineHeight": 1.4,
        "whiteSpace": "pre-wrap"
      }
    },
    {
      "id": "state-screen-preview-n28",
      "type": "rectangle",
      "name": "Reset",
      "parentId": "state-screen-preview-n16",
      "x": 904,
      "y": 7,
      "width": 60,
      "height": 26,
      "styles": {
        "fill": "#292929",
        "radius": 4,
        "borderColor": "#3b3b3b",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n29",
      "type": "text",
      "name": "Reset",
      "parentId": "state-screen-preview-n28",
      "x": 9,
      "y": 4,
      "width": 42,
      "height": 18,
      "content": "Reset",
      "styles": {
        "color": "#e8eaed",
        "fontSize": 12,
        "fontWeight": 500,
        "fontFamily": "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        "lineHeight": 1.4,
        "whiteSpace": "pre-wrap"
      }
    }
  ],
  "version": 226
}
```
