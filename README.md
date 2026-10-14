<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-color-dark.svg" />
  <img src="assets/logo-color.svg" width="64" height="64" alt="Codex Design logo" />
</picture>

# Codex Design

An infinite canvas for designing interfaces and slides with your coding agent. Build desktop, web, tablet and mobile layouts; refine editable layers and source beside the conversation.

[![ChatGPT + Codex](assets/badges/chatgpt-codex.svg)](https://developers.openai.com/plugins)
[![React 19.3.0](https://img.shields.io/badge/React-19.3.0-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript 5.9.3](https://img.shields.io/badge/TypeScript-5.9.3-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-417e38?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MCP Apps](assets/badges/mcp-apps.svg)](docs/mcp.md)

![Codex Design with mobile screens above the desktop Forma workspace](docs/screenshots/forma-workspace.jpg)

Projects contain boards, pages and frames. Each project shares one editable design system; each board keeps its own inspiration. Component conversations, media, source exports and version history stay with the document. Chats keep independent canvas selections. Generated screens appear progressively with a grey loading wipe.

## Paste this into ChatGPT to install

Use ChatGPT desktop with Codex/local terminal access. A web-only chat cannot install software on your computer.

```text
Install Codex Design from https://github.com/tronschell/codex-design on this computer.

Clone it into a new local folder, or reuse its existing checkout without overwriting
local changes. Read README.md and docs/plugin.md. Check that Node.js 22+, npm, Git
and the Codex CLI are available. Set up missing prerequisites from official sources,
respecting any required approvals; explain any access limitation.

Run npm ci and npm run build in the checkout. Register its absolute directory with
codex plugin marketplace add <absolute-checkout-path>, then run
codex plugin add codex-design@codex-design-local --json.

Confirm it is installed and enabled with
codex plugin list --marketplace codex-design-local --json.
Preserve existing design data. Do not run tests or deploy anything. Tell me whether
to reload ChatGPT/Codex. If local plugin installation is unavailable, explain that
instead of claiming installation succeeded.
```

After installation, ask: **“Design a mobile app in Codex Design.”** The canvas opens beside the chat without a development server. See the [official local-plugin setup](https://developers.openai.com/plugins/build/plugins).

## Development

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the printed local URL. Designs are saved in ignored `data/`. Use `npm run build` then `npm start` for production, or `npm run package:plugin` for a portable ZIP in `releases/`.

See [setup and hosting](docs/plugin.md), [MCP tools](docs/mcp.md), [product behavior](PRODUCT.md), [design guidance and host limits](skills/codex-design/references/host-runtime.md), and [measured performance](docs/performance.md). Cloud ChatGPT connections require a reachable HTTPS MCP endpoint; the local host is a single-user service.

## Credits

Thanks to [asgeirtj/system_prompts_leaks](https://github.com/asgeirtj/system_prompts_leaks) for the original design prompt, skills and JSX examples, preserved with the requested `claude-design` → `codex-design` rename. [Provenance](skills/codex-design/references/upstream-source.json) and the [upstream CC0 license](skills/codex-design/references/upstream-LICENSE) are included. Claude Design inspired the canvas workflow and visual direction. This is an independent project, unaffiliated with OpenAI or Anthropic.
