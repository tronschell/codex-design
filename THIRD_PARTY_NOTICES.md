# Third-party materials

The root MIT License covers original Codex Design contributions by tronschell. It does not relicense third-party code, artwork, trademarks, or the imported authoring snapshot.

## Imported authoring snapshot — permission unresolved

The files listed in `skills/codex-design/references/upstream-source.json` were imported from an external repository containing third-party design prompts and starters. Their provenance and that repository's license notice remain alongside the files. Codex Design has not established that the source repository can license all of that material. The new MIT license does not grant permission to those files or their compiled contents in `dist/starters.mjs`.

Public directory submission remains blocked until the relevant rights are established or the material is replaced with independent content. Rewording imported text does not establish permission.

## Credited dependencies and assets

- Component discovery adapts Julien Thibeaut's MIT-licensed ui-skills workflow. Its notice is retained in `skills/codex-design/skills/component-canvas/LICENSE`.
- Diagram libraries and ELK retain notices under `assets/diagram-nodes/`.
- Stateful-frame source dependencies retain notices in `assets/stateful-frames/THIRD_PARTY_NOTICES.md`.
- The shaders.com runtime and dependency notices are bundled with the generated shader assets and their exports.
- Other npm dependencies retain their package licenses and any notices emitted into the bundled runtime. Package names and exact resolved versions are recorded in `package-lock.json`.
- The ChatGPT icon is an OpenAI asset used for identification; its source is recorded in `assets/chatgpt-logo.md`. The MIT grant does not license third-party trademarks or suggest endorsement.

See `docs/publication-readiness.md` for the current distribution boundary.
