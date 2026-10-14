# Plugin setup and hosting

## Local package

`plugin.json` provides portable identity and OpenAI presentation metadata. Skills are discovered under `skills/`; the MCP server is declared in root `mcp.json` with an explicit `stdio` transport. The repo marketplace uses `source.path: "./"`, relative to the repository root, with `AVAILABLE` installation and `ON_INSTALL` authentication policies.

The manifest includes square monochrome light/dark `composerIcon` and `logo` SVG assets under `assets/`; these are also included in the distribution archive. The MCP implementation and the resource shared by both canvas entrypoints advertise the same theme-specific SVG icons as standard inline data URIs, so native sidebar clients do not need to fetch a private local file. Hosts may cache presentation metadata until a reload. `canvas_open_app` declares the app-only `global` sidebar entrypoint, while `canvas_open_canvas` declares the separate `thread` conversation-panel entrypoint, following the official [Plugin Extensions](https://developers.openai.com/plugins/build/extensions) format. Installation and launcher registration are separate: a plugin can be enabled and expose tools even when these launcher fields are absent. Supported sidebar surfaces use the registered entrypoint; the agent can also invoke `canvas_open_canvas` directly.

Color branding lives separately in `assets/logo-color.svg` and `assets/logo-color-dark.svg`. Only the upper piece receives the soft procedural color field (SVG turbulence/displacement and blur); the lower piece keeps theme-specific neutral ink. README uses these script-free vectors. Sidebar/composer and MCP icons continue to use the monochrome `icon.svg` / `icon-dark.svg` assets.

For a new interface or slide design request, the skill selects or creates a project and board and invokes `canvas_open_canvas` before editing. Its resource advertises `inline` and `fullscreen`, with `preferredDisplayMode: "fullscreen"` for model-initiated opening. In a supporting desktop host this appears as a content pane beside the conversation. The widget advertises the same supported modes during initialization and preserves the host's chosen mode; it never requests fullscreen on mount. The user can still use its fullscreen button. The global browser and each thread canvas have separate selections; neither defaults to another chat’s most recently used project. An unbound thread opens a project chooser. The host owns the final layout. See the official [display-mode extension](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#display-modes).

The widget restores its project, board and page from explicit launch input or its attached app context before loading a document. Meaningful selection changes update `ui/update-model-context`, with `window.openai.widgetState` as a compatibility fallback. When the host provides `_meta["openai/session"]` on tool calls, a hashed conversation key also remembers the selection in private `.canvas-selections/` files alongside the project store. This is a UI preference, not a project revision. MCP transport session IDs are never used as conversation IDs. See the official [client metadata reference](https://developers.openai.com/plugins/reference) and [context-change specification](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#context-changed-notifications).

After changing a local package, rebuild it and refresh the installed copy with `codex plugin add codex-design@codex-design-local --json`. Restart the desktop app so new chats load the current skill and MCP metadata. The portable plugin format expands `${PLUGIN_ROOT}` in MCP arguments and supplies a writable `${PLUGIN_DATA}` directory. Project persistence uses the following priority:

1. `CODEX_DESIGN_DATA_DIR`, when explicitly set.
2. `PLUGIN_DATA/projects` when launched as an installed plugin.
3. The package's `data/` directory for local development.

The media-capable UI uses `ui://codex-design/canvas-v2.html`. Its standard UI CSP allows `blob:` resources for locally assembled asset URLs and keeps `connectDomains` empty; it does not open arbitrary media origins. Asset bytes travel through authenticated app tools. Existing MCP processes retain their old tool schemas until the host reloads. Browser inspection does not establish installed-host Blob, clipboard, download or codec compatibility; inspect those after reload. CSP metadata follows the official [UI reference](https://developers.openai.com/plugins/reference).

Native image requests use the active host agent's built-in image-generation capability. The plugin does not call a model API or store API credentials. Only the local stdio entry opts into the model-only `canvas_import_generated_image` tool; HTTP MCP, REST and the embedded app cannot invoke a local-file importer. It reads completed raster results strictly within `CODEX_HOME/generated_images` (default `~/.codex/generated_images`) and copies them through the existing bounded asset pipeline. It does not accept general local paths or remote URLs, navigate the canvas, delete originals or change a project revision. Hosts without shared local output paths use the existing byte-upload tools. Native generation availability is owned by the host.

Design-system Generate/Find uses the same active-agent handoff as component comments. A saved request contains the app brief and optional repository scope; the connected host receives its workflow prompt, while standalone mode provides a copyable prompt. The MCP server provides system/inspiration metadata and revision-checked operations, rather than broad filesystem access or a background model. The active agent reads applicable DESIGN.md files before components/styles within the authorized target app and saves structured tokens, documentation and evidence. Update both the skill and runtime when refreshing this capability; a running old MCP process will not learn the new schemas until the host reloads.

The bundled runtime resolves its widget path from its own module URL, so launching it from a different current directory works. It requires Node.js 22 or later. The archive excludes project data and dependencies because the MCP runtime is already bundled.

To edit an installed plugin's project in the standalone browser, point the web server and the plugin process at the same absolute `CODEX_DESIGN_DATA_DIR`. Store writes use a cross-process lock and recheck the revision while locked; two stale clients cannot silently overwrite each other. Browser clients refresh persisted changes through the server's synchronization path.

## Bundled design guidance

The `codex-design` skill loads the user-selected prompt/skill snapshot under its own directory: `codex-design.md`, `skills/` and `starter-components/`. All imported source files are preserved verbatim; only the `claude-design` path/file slug is renamed. `references/upstream-source.json` pins the repository revision, source paths and content hashes, and `references/upstream-LICENSE` retains its license text. These resources ship in the existing skill/package copy path.

The skill's connection instructions are separate from the imported prompt. They use the actual connected canvas tools and preserve the application's stored-document behavior. The external prompt's tool declarations, model identities, paths and starter runtimes do not create those capabilities in Codex or replace host instructions. The import supplies the exact requested guidance and authoring material; original-platform runtime compatibility and equivalent design quality are not implied.

## ChatGPT connection

ChatGPT cloud needs a reachable MCP endpoint; local stdio is a separate transport for clients that can launch the Node process. The HTTP host provides `/mcp` using Streamable HTTP.

In ChatGPT Plugins, use **Add custom MCP server** to register the endpoint and review its tool list. A registered connection receives an account-specific technical ID beginning with `plugin_asdk_app`. If distributing a plugin that references that registered connection, put the mapping in an `.app.json` file and reference it from `extensions.com.openai.apps` in `plugin.json`, following the current official [plugin packaging guide](https://developers.openai.com/plugins/build/plugins). This repository leaves out that account-specific mapping until a connection actually exists.

Use an MCP Apps-capable client to render the UI. ChatGPT's public UI submission additionally requires a unique hosted component origin; set `CODEX_DESIGN_WIDGET_DOMAIN` to that origin for the MCP resource metadata. Local use does not need a public widget origin because HTML is served through the MCP resource.

## Deployment boundary

The default service listens at `127.0.0.1:4310`. Set `PORT`, `CODEX_DESIGN_HOST`, and `CODEX_DESIGN_BASE_URL` when needed. Binding outside localhost requires `CODEX_DESIGN_TOKEN`; the server then requires `Authorization: Bearer <token>` for API and MCP requests. The standalone browser provides a token sign-in dialog and retains that token for the browser session.

A remote connection can read every design and source field and can mutate any saved project within its store. The bearer token is single-user authentication. For a shared or public service, add per-user authorization, per-user stores, and the host's supported OAuth flow before publishing. A UI origin and HTTPS alone do not provide account isolation.

Public directory submission and workspace publication are manual account operations. Packaging a ZIP or adding a local marketplace does not publish a plugin. Review the current official [MCP deployment](https://developers.openai.com/plugins/build/mcp-server) and [UI reference](https://developers.openai.com/plugins/reference) before submitting a hosted version.
