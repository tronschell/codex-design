# Use another coding harness

Codex Design's browser entrypoint uses standard MCP over stdio. It does not require a Codex plugin, MCP Apps renderer or particular model. The existing Codex plugin continues to use `dist/mcp.mjs` and its conversation pane; leave that configuration unchanged.

## Build and connect

From this checkout, with Node.js 22+:

```sh
npm ci
npm run build
```

Configure your harness to run `node /absolute/path/to/codex-design/dist/browser.mjs`. This starts its own loopback browser editor on an available port. The process must stay running while the browser is in use. Standard output is reserved for MCP; startup information goes to standard error.

For clients using the common MCP config format:

```json
{
  "mcpServers": {
    "codex-design": {
      "command": "node",
      "args": ["/absolute/path/to/codex-design/dist/browser.mjs"]
    }
  }
}
```

Ask the agent: **“Create a new mobile reading-app design in Codex Design and open its canvas.”** `canvas_open_canvas` requests opening the exact project, board and page in the default browser and returns `standaloneUrl`. If opening is unavailable, follow that URL yourself. An unbound request opens a project chooser; it never selects another conversation's latest project. Keep the returned IDs in each conversation and pass them explicitly on later calls. Opening the bare browser URL also requires a project choice. A stale project link keeps its requested URL and shows its error beside the chooser; choosing a project explicitly replaces that URL with its current project/board/page.

The agent can read the complete bundled design guidance through MCP, progressively build native layers or supported JSX, reuse design-system tokens/components, import media, read comments and export source. Browser changes and agent changes share the same revision-checked store and live synchronization.

## Pi

With [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) installed, merge the common config above into your project's `.mcp.json`. Add `"idleTimeout": 0` to that server entry so idle MCP cleanup does not disconnect an open canvas. Restart or reload Pi after configuration changes. Its `mcp` proxy can discover the actual tool names and invoke them; no Codex-specific Pi extension is needed.

Use whichever model your Pi installation supports. For a local installation that already defines it, `pi --provider tron-router --model tron-router` selects `tron-router`; Codex Design does not install or configure that model.

## OpenCode

Merge this entry into `opencode.json` or `opencode.jsonc`, following [OpenCode's MCP configuration](https://opencode.ai/docs/mcp-servers/):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "codex-design": {
      "type": "local",
      "command": ["node", "/absolute/path/to/codex-design/dist/browser.mjs"],
      "enabled": true
    }
  }
}
```

Other MCP clients use the same command in their own configuration format. This checkout does not overwrite existing client configuration.

## Storage and controls

- Browser-mode projects default to `~/.codex-design/projects`, independently of Codex's plugin data. Set `CODEX_DESIGN_DATA_DIR` to an explicit shared directory only when you intend to share that store. Do not put it inside `dist`.
- `CODEX_DESIGN_BROWSER_PORT` optionally chooses a fixed local port; the default `0` selects a free one. Each process has its own URL, so multiple harnesses do not take over one global canvas.
- `CODEX_DESIGN_OPEN_BROWSER=0` disables automatic browser launch and retains the returned link, useful over SSH or in headless environments.
- `CODEX_DESIGN_TOKEN` optionally protects the browser API with the existing token sign-in. This entrypoint always binds to `127.0.0.1`; it does not expose the editor publicly or start a remote MCP endpoint.

History and library restores remain explicit **Apply** actions in the browser. App-only restore/selection/watch tools are not registered on this agent connection. Read-only version inspection remains available. Model tool results include JSON in their text fallback, so clients that do not consume `structuredContent` still receive real IDs, revisions and source.

Comments and design-system requests persist in the browser. Ask the agent to handle pending requests; it reads the queue, saves the requested edits and replies through MCP. A plain MCP connection cannot universally wake a harness or inject a chat message, so this mode does not promise automatic delivery. Native image generation also depends on the harness's own tools; the editor supplies storage and placement, not a model. Codex's existing host messaging and native image integration remain separate and unchanged.
