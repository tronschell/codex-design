# Codex Design privacy policy — publisher review draft

**Not yet a published policy.** Publisher: [confirm publisher]. Private support/privacy contact: [confirm contact]. Effective date: [set on approval]. This describes the desktop-only local plugin; a hosted service needs its own policy reflecting its actual infrastructure.

## Information used

The plugin saves the projects, boards, design content, React source, dependency declarations, media, component notes, and anchored conversations you choose to create or import. It also saves revision timestamps, version history and canvas preferences needed to reopen your work. When supplied by the host, a hashed conversation identifier associates a saved canvas selection with the current conversation; the plugin does not retrieve the complete chat log.

The plugin does not request payment details, health records, government identifiers or account credentials. Do not place secrets or sensitive personal records in designs, source, comments or exports.

## Purpose, location and recipients

Data is used to render and edit designs, support agent tool requests, preserve versions, and create exports. The desktop plugin stores it on the computer running the local MCP server, normally under the host-provided `PLUGIN_DATA/projects` directory. An explicitly configured `CODEX_DESIGN_DATA_DIR` overrides that location.

Content returned by tools and selected-component context is shared with the ChatGPT/Codex host used for the conversation. Host processing is governed by that host's policies and your account settings. The local plugin does not run its own analytics service or send project data to a publisher-operated backend.

React dependency compilation contacts the npm registry to retrieve declared packages. The registry receives ordinary network request information and requested package names/versions; installation scripts are disabled. Optional native image generation is performed by the active host's image tool. Exported files are saved where you choose; you control later sharing. Support information you deliberately send to the publisher is a separate disclosure; use the approved private contact for sensitive support details rather than public GitHub issues.

## Retention and controls

Saved projects, history, completed media, compiler caches and recovery copies persist locally until removed. Pending incomplete media uploads expire after one hour. Deleting a board removes its current pages/comments but prior versions remain in history. Deleting a project removes it from the workspace and retains its current JSON under `.deleted-projects`, along with existing history and shared media. Deletion in the UI is not secure erasure.

You can export your work, edit current content and remove projects from the workspace. To remove all local plugin data, stop its MCP/browser processes, locate the configured data directory, preserve any desired exports, and remove that directory. It is shared by projects in that installation; removing it also removes their media/history. Host uninstall behavior may vary, and deletion does not recall exports or content already supplied to the host. Ask the publisher through the approved contact about any support information you supplied directly.

## Publisher completion

Before publication, confirm this policy against the shipped implementation; add the actual publisher/contact, support-data retention and recipients, applicable user-request handling, and effective date. Publish the approved policy at the listing's public HTTPS privacy URL.
