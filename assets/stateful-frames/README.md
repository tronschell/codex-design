# Stateful frames — interactive concept

Open `prototype.html` in a browser. The HTML contains its runtime and styles and makes no network requests.

Try View as Free/Pro, change Billing or Onboarding, then choose a change in the yellow list. Rules demonstrates an Export component following the frame or pinning its own membership. Agent demonstrates atomic local JSON patches; the default patch creates a Team scenario.

The native Codex Design board is **Stateful frames · Application states** in project `3e260fd8-2492-4468-9bc1-13b9cf5c308c`. Its first two pages contain editable native UI layers and two reusable state-control components. The third page runs this lab on double-click.

All edits inside the lab stay in browser memory and reset on reload. The lab is a concept, not a production editor integration. Proposed production behavior and MCP operations are documented in `../../docs/stateful-frames-spec.md`.

## Sources

- `prototype.jsx`: React and Tailwind interface.
- `state-model.mjs`: typed sample values, scenarios, rules, resolver and runtime patch validation.
- `member-experience.state.json`: initial authored sample definition, not a per-user preview session.
- `source/`: exported native board and its documentation.
- `components/`: portable native state switcher and typed-control components.
- `THIRD_PARTY_NOTICES.md`: licenses for the embedded runtime and icons.

Build from the repository with its installed dependencies:

```sh
node assets/stateful-frames/build-prototype.mjs
```

Outside this repository, set `CODEX_DESIGN_REPO` to the repository root. No dependency installation or tests are required by this handoff. Screenshots and review notes live with the accompanying artifact capture.
