# Application state / Typed controls

Enum controls and a Boolean toggle generated from a typed context. Values affect a single resolved frame; variables can propagate to child components.

Definition: app-state-controls · Source release: 226

## Implementation notes

### ChevronDown

Object: state-screen-preview-n127 · Type: code · Parent: state-screen-preview-n125

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

### ChevronDown

Object: state-screen-preview-n131 · Type: code · Parent: state-screen-preview-n129

> Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.

## Usage

```jsx
import { DsApplicationStateTypedControls } from './components/1-app-state-controls/DsApplicationStateTypedControls.jsx';

<DsApplicationStateTypedControls />
```

## React implementation

```jsx
import React from 'react';

export function DsApplicationStateTypedControls() {
  return (
    <div className="cd-component-app-state-controls" aria-label={"Application state / Typed controls"}>
      <div className="cd-layer-0" data-node-id={"state-screen-preview-n123"} aria-label={"State controls"}>
        <div className="cd-layer-1" data-node-id={"state-screen-preview-n124"} aria-label={"Membership"}>{"Membership"}</div>
        <div className="cd-layer-2" data-node-id={"state-screen-preview-n125"} aria-label={"Pro"}>
          <div className="cd-layer-3" data-node-id={"state-screen-preview-n126"} aria-label={"Pro"}>{"Pro"}</div>
          <div className="cd-layer-4" data-node-id={"state-screen-preview-n127"} aria-label={"ChevronDown"}><img className="cd-media" style={{ objectFit: "fill" }} alt={"ChevronDown"} src={"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23b7b7b7%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20class%3D%22lucide%20lucide-chevron-down%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E"} draggable={false} /></div>
        </div>
        <div className="cd-layer-5" data-node-id={"state-screen-preview-n128"} aria-label={"Billing"}>{"Billing"}</div>
        <div className="cd-layer-6" data-node-id={"state-screen-preview-n129"} aria-label={"Current"}>
          <div className="cd-layer-7" data-node-id={"state-screen-preview-n130"} aria-label={"Current"}>{"Current"}</div>
          <div className="cd-layer-8" data-node-id={"state-screen-preview-n131"} aria-label={"ChevronDown"}><img className="cd-media" style={{ objectFit: "fill" }} alt={"ChevronDown"} src={"data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23b7b7b7%22%20stroke-width%3D%221.75%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20class%3D%22lucide%20lucide-chevron-down%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E"} draggable={false} /></div>
        </div>
        <div className="cd-layer-9" data-node-id={"state-screen-preview-n132"} aria-label={"Onboarding"}>{"Onboarding"}</div>
        <div className="cd-layer-10" data-node-id={"state-screen-preview-n133"} aria-label={"Complete"}>
          <div className="cd-layer-11" data-node-id={"state-screen-preview-n134"} aria-label={"Complete"}>{"Complete"}</div>
          <div className="cd-layer-12" data-node-id={"state-screen-preview-n135"} aria-label={"Onboarding toggle"}></div>
          <div className="cd-layer-13" data-node-id={"state-screen-preview-n136"} aria-label={"Toggle thumb"}></div>
        </div>
      </div>
    </div>
  );
}
```

## CSS

```css
.cd-component-app-state-controls .cd-component-app-state-controls { position: relative; width: 312px; height: 138px; }

.cd-component-app-state-controls .cd-layer-0 {
  position:absolute;
  left:0;
  top:0;
  width:312px;
  height:138px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
}

.cd-component-app-state-controls .cd-layer-1 {
  position:absolute;
  left:0;
  top:6px;
  width:108px;
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

.cd-component-app-state-controls .cd-layer-2 {
  position:absolute;
  left:116px;
  top:0;
  width:196px;
  height:28px;
  box-sizing:border-box;
  opacity:1;
  background:#292929;
  border-radius:4px;
  border:1px solid #3b3b3b;
}

.cd-component-app-state-controls .cd-layer-3 {
  position:absolute;
  left:9px;
  top:5px;
  width:178px;
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

.cd-component-app-state-controls .cd-layer-4 {
  position:absolute;
  left:174px;
  top:7px;
  width:14px;
  height:14px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
  overflow:hidden;
}

.cd-component-app-state-controls .cd-layer-5 {
  position:absolute;
  left:0;
  top:49px;
  width:108px;
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

.cd-component-app-state-controls .cd-layer-6 {
  position:absolute;
  left:116px;
  top:43px;
  width:196px;
  height:28px;
  box-sizing:border-box;
  opacity:1;
  background:#292929;
  border-radius:4px;
  border:1px solid #3b3b3b;
}

.cd-component-app-state-controls .cd-layer-7 {
  position:absolute;
  left:9px;
  top:5px;
  width:178px;
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

.cd-component-app-state-controls .cd-layer-8 {
  position:absolute;
  left:174px;
  top:7px;
  width:14px;
  height:14px;
  box-sizing:border-box;
  opacity:1;
  background:transparent;
  border-radius:0;
  overflow:hidden;
}

.cd-component-app-state-controls .cd-layer-9 {
  position:absolute;
  left:0;
  top:92px;
  width:108px;
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

.cd-component-app-state-controls .cd-layer-10 {
  position:absolute;
  left:116px;
  top:86px;
  width:196px;
  height:28px;
  box-sizing:border-box;
  opacity:1;
  background:#292929;
  border-radius:4px;
  border:1px solid #3b3b3b;
}

.cd-component-app-state-controls .cd-layer-11 {
  position:absolute;
  left:9px;
  top:5px;
  width:178px;
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

.cd-component-app-state-controls .cd-layer-12 {
  position:absolute;
  left:151px;
  top:7px;
  width:29px;
  height:14px;
  box-sizing:border-box;
  opacity:1;
  background:#446c98;
  border-radius:7px;
}

.cd-component-app-state-controls .cd-layer-13 {
  position:absolute;
  left:166px;
  top:9px;
  width:10px;
  height:10px;
  box-sizing:border-box;
  opacity:1;
  background:#dfedff;
  border-radius:5px;
}

.cd-component-app-state-controls .cd-media { display: block; width: 100%; height: 100%; pointer-events: none; }

.cd-component-app-state-controls .cd-code { border: 0; }

.cd-component-app-state-controls .cd-shader-status { position: absolute; inset: 0; padding: 8px; overflow: auto; color: #ddd; background: #242424; font: 11px/1.4 system-ui, sans-serif; }

.cd-component-app-state-controls .cd-arrow { position: absolute; right: 0; top: -5px; width: 9px; height: 9px; border-top: 2px solid currentColor; border-right: 2px solid currentColor; transform: rotate(45deg); }
```

## Props contract

```typescript
import type { ReactElement } from 'react';

/** Enum controls and a Boolean toggle generated from a typed context. Values affect a single resolved frame; variables can propagate to child components. */
export interface DsApplicationStateTypedControlsProps {}
export declare function DsApplicationStateTypedControls(props?: DsApplicationStateTypedControlsProps): ReactElement;
```

### ChevronDown — authored html

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b7b7b7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
```

### ChevronDown — authored html

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b7b7b7" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"></path></svg>
```

## Codex Design definition

```json
{
  "id": "app-state-controls",
  "name": "Application state / Typed controls",
  "description": "Enum controls and a Boolean toggle generated from a typed context. Values affect a single resolved frame; variables can propagate to child components.",
  "rootNodeId": "state-screen-preview-n123",
  "nodes": [
    {
      "id": "state-screen-preview-n123",
      "type": "rectangle",
      "name": "State controls",
      "parentId": null,
      "x": 0,
      "y": 0,
      "width": 312,
      "height": 138,
      "styles": {
        "fill": "transparent",
        "radius": 0
      }
    },
    {
      "id": "state-screen-preview-n124",
      "type": "text",
      "name": "Membership",
      "parentId": "state-screen-preview-n123",
      "x": 0,
      "y": 6,
      "width": 108,
      "height": 20,
      "content": "Membership",
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
      "id": "state-screen-preview-n125",
      "type": "rectangle",
      "name": "Pro",
      "parentId": "state-screen-preview-n123",
      "x": 116,
      "y": 0,
      "width": 196,
      "height": 28,
      "styles": {
        "fill": "#292929",
        "radius": 4,
        "borderColor": "#3b3b3b",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n126",
      "type": "text",
      "name": "Pro",
      "parentId": "state-screen-preview-n125",
      "x": 9,
      "y": 5,
      "width": 178,
      "height": 18,
      "content": "Pro",
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
      "id": "state-screen-preview-n127",
      "type": "code",
      "name": "ChevronDown",
      "parentId": "state-screen-preview-n125",
      "x": 174,
      "y": 7,
      "width": 14,
      "height": 14,
      "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b7b7b7\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-chevron-down\"><path d=\"m6 9 6 6 6-6\"></path></svg>",
      "notes": "Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.",
      "styles": {}
    },
    {
      "id": "state-screen-preview-n128",
      "type": "text",
      "name": "Billing",
      "parentId": "state-screen-preview-n123",
      "x": 0,
      "y": 49,
      "width": 108,
      "height": 20,
      "content": "Billing",
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
      "id": "state-screen-preview-n129",
      "type": "rectangle",
      "name": "Current",
      "parentId": "state-screen-preview-n123",
      "x": 116,
      "y": 43,
      "width": 196,
      "height": 28,
      "styles": {
        "fill": "#292929",
        "radius": 4,
        "borderColor": "#3b3b3b",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n130",
      "type": "text",
      "name": "Current",
      "parentId": "state-screen-preview-n129",
      "x": 9,
      "y": 5,
      "width": 178,
      "height": 18,
      "content": "Current",
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
      "id": "state-screen-preview-n131",
      "type": "code",
      "name": "ChevronDown",
      "parentId": "state-screen-preview-n129",
      "x": 174,
      "y": 7,
      "width": 14,
      "height": 14,
      "source": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#b7b7b7\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-chevron-down\"><path d=\"m6 9 6 6 6-6\"></path></svg>",
      "notes": "Lucide 0.468.0. ISC / Feather-derived MIT; notices in assets/diagram-nodes/THIRD_PARTY_NOTICES.md.",
      "styles": {}
    },
    {
      "id": "state-screen-preview-n132",
      "type": "text",
      "name": "Onboarding",
      "parentId": "state-screen-preview-n123",
      "x": 0,
      "y": 92,
      "width": 108,
      "height": 20,
      "content": "Onboarding",
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
      "id": "state-screen-preview-n133",
      "type": "rectangle",
      "name": "Complete",
      "parentId": "state-screen-preview-n123",
      "x": 116,
      "y": 86,
      "width": 196,
      "height": 28,
      "styles": {
        "fill": "#292929",
        "radius": 4,
        "borderColor": "#3b3b3b",
        "borderWidth": 1
      }
    },
    {
      "id": "state-screen-preview-n134",
      "type": "text",
      "name": "Complete",
      "parentId": "state-screen-preview-n133",
      "x": 9,
      "y": 5,
      "width": 178,
      "height": 18,
      "content": "Complete",
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
      "id": "state-screen-preview-n135",
      "type": "rectangle",
      "name": "Onboarding toggle",
      "parentId": "state-screen-preview-n133",
      "x": 151,
      "y": 7,
      "width": 29,
      "height": 14,
      "styles": {
        "fill": "#446c98",
        "radius": 7
      }
    },
    {
      "id": "state-screen-preview-n136",
      "type": "rectangle",
      "name": "Toggle thumb",
      "parentId": "state-screen-preview-n133",
      "x": 166,
      "y": 9,
      "width": 10,
      "height": 10,
      "styles": {
        "fill": "#dfedff",
        "radius": 5
      }
    }
  ],
  "version": 226
}
```
