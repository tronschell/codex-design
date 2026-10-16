# Public plugin submission readiness

Reviewed 2026-10-16. **Status: local distribution builds; public submission is blocked.** The ZIP is a local installation candidate, not a cleared public submission. Nothing has been submitted to or approved by OpenAI.

## Completed in the package

- Portable plugin manifest and local stdio MCP configuration; self-contained widget and bundled server. Node.js 22 or later is declared.
- Desktop-only execution is explicit (`extensions.com.openai.requires_local_executor: true`). There is no claim of cloud or mobile availability.
- MIT license for original contributions and explicit third-party exclusions; package author/developer name set to `tronschell`.
- Three starter prompts, within the documented limit, an accurate description, independent-project disclosure, square light/dark icons, and verified public repository/support links.
- Typed tool inputs, bounded asset operations, revision checks, explicit destructive annotations, and project/board rename/delete consent requirements.
- Package allowlist excludes Git history, workspace data, credentials, and development node_modules. Required compiled runtime dependencies are included under dist.
- Build/compilation and direct browser inspection of component selection, the isolated highlighted source editor, transparent previews, project/board rename, and deletion confirmation. No automated tests or generated verification designs were added or run, as requested.

## Remaining requirements

| Requirement | Current evidence | Needed before submission |
| --- | --- | --- |
| Local MCP eligibility | Publisher reports not approved / unsure | The publisher must obtain approval from its OpenAI representative for the submitting organization. |
| Publisher identity | Package author and developer name are now `tronschell`; individual publishing is supported | Complete individual verification and use an organization owner or Apps Management Write role. The directory displays the selected verified identity, which may differ from the package handle. |
| Public policies | Website/support URLs exist; publisher is tronschell and MIT is selected for original code; policy drafts are updated | Review the prepared policy drafts, provide a private privacy contact and effective date, publish final HTTPS pages, and set `interface.privacyPolicyURL` and `interface.termsOfServiceURL`. Do not point the listing at draft policies. |
| Third-party redistribution | `skills/codex-design/references/upstream-source.json` identifies imported Anthropic/claude-design material from `asgeirtj/system_prompts_leaks` | Establish permission from the relevant rights holder, or replace the imported guidance and starter code with independently authored material before public distribution. The source repository's CC0 notice does not establish ownership of third-party material. |
| Installed-host review | Local browser/build inspection completed; final installed-host session still needs reload | Inspect the installed release in the supported desktop host, including embedded source previews, consent prompts, media/export, and the local MCP connection. The browser result alone does not establish host compatibility. |

The publisher authorized MIT for original code. That grant does not establish rights to the imported snapshot. The publisher chose to retain the imported snapshot. Its files, function names and provenance remain unchanged in this update. Cosmetic renaming or rewording does not establish permission; public redistribution still needs permission or an independent replacement. It was intentionally requested for local authoring, and it is used both by the design-reference tools and by compiled device-frame starters. Removing just its Markdown directory from the ZIP would leave the compiled imported code in `dist/starters.mjs` and break reference tools. A replacement must update the catalog, skill links, four runtime device-frame implementations, and rebuilt artifacts together. Original prompts also contain original-host instructions that need a public-review audit if retained.

## Review walkthrough and runtime notes

Use a supported desktop local-execution conversation and the packaged local MCP server. Open the canvas, choose an existing project/board, select a registered inner React component, and inspect its isolated source editor. Renames require an explicit submit; board/project deletions require typing the exact name in the UI. Agent management requires explicit user consent and `userConfirmed: true`. Stale revisions reject changes.

Projects, comments, source, media, history, and npm package caches live in the per-installation local data directory. Project deletion moves its current JSON into `.deleted-projects`, preserving history and shared assets. It is recoverable workspace removal, not secure erasure. The privacy draft describes retention and manual removal.

The widget embeds sandboxed `srcdoc` previews for user-authored React/source. They are used to render components and their interactions in isolation, rather than to frame a third-party website. Explain this iframe use during review. React compilation may download exact declared packages from npm with installation scripts disabled; it does not execute package lifecycle hooks or require a model API key. Host-controlled image generation remains optional.

The repository's HTTP service uses a single-user bearer token. It is **not a public multi-user cloud backend**. A hosted edition would require per-user authorization/storage, a supported OAuth flow, HTTPS and reviewed UI/CSP origins. The local desktop submission route does not make it available to browser/mobile-only users.

## Submission after the blockers are resolved

1. Finalize the publisher identity, public policy URLs, and third-party rights/replacement decision.
2. Obtain the OpenAI local MCP allowlist confirmation for the submitting organization.
3. Run `npm run package:plugin`; use the resulting `releases/codex-design-<version>.zip`. Inspect the actual ZIP contents and run the supported-host review against that release.
4. Follow the documented desktop-only portal route: **Create plugin → Skills only**, then upload the ZIP containing local MCP configuration. Complete the review details and explain the local runtime and iframe use. No service login or hosted demo account is required by this implementation.
5. Submit through the verified account. Review approval and publication remain separate account operations.

## Official sources

- [Desktop-only plugins](https://developers.openai.com/plugins/deploy/desktop-only): eligibility, organization allowlisting, local transport and upload route.
- [Submit plugins](https://developers.openai.com/plugins/deploy/submission): publisher roles, listing metadata and review flow.
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines): originality/permission, privacy, annotations, iframe review and reliability.

These requirements were checked on the date above and may change. The drafts are review material, not a claim of legal or marketplace clearance.
