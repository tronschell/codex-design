import type { DesignProject } from './types.js';
import { designSystemMarkdown, tokenCssVariables } from './design-system.js';
import { exportTargetHtml, exportTargetReact } from './export-formats.js';
import type { ExportOptions } from './export.js';
import { MAX_INPUT_BYTES } from './validation.js';
import { implementationNotesMarkdown, nodeNotesMarkdown } from './implementation-notes.js';

export function libraryProject(project: DesignProject, componentId?: string): DesignProject {
  const components = componentId ? project.designSystem.components.filter(item => item.id === componentId) : project.designSystem.components;
  if (componentId && !components.length) throw new Error('This component is no longer available.');
  const { request: _request, ...system } = project.designSystem;
  const board = project.boards[0], page = project.pages[0];
  return {
    ...project, name: system.name, description: system.description,
    designSystem: { ...system, components },
    boards: [{ id: board.id, name: 'Main', createdAt: board.createdAt, updatedAt: board.updatedAt }],
    pages: [{ id: page.id, boardId: board.id, name: 'Canvas', nodes: [], viewport: { x: 90, y: 130, zoom: 1 } }], threads: [],
  };
}

function fence(source: string, language: string) {
  const marker = '`'.repeat((source.match(/`+/g) ?? []).reduce((length, value) => Math.max(length, value.length + 1), 3));
  return `${marker}${language}\n${source.trimEnd()}\n${marker}`;
}
const title = (value: string) => value.replace(/[\r\n]/g, ' ');

// Files follow the imported create-design-system reference; the versioned JSON retains native extensions.
export function exportLibrary(project: DesignProject, options: ExportOptions = {}, componentId?: string): { project: DesignProject; files: Record<string, string> } {
  const portable = libraryProject(project, componentId), system = portable.designSystem;
  const files: Record<string, string> = {
    'design.json': JSON.stringify(portable, null, 2),
    'codex-design.library.json': JSON.stringify({ format: 'codex-design-library', version: 1, project: portable }),
    'DESIGN.md': designSystemMarkdown(system), 'tokens.css': tokenCssVariables(system), 'IMPLEMENTATION_NOTES.md': implementationNotesMarkdown(portable),
  };
  if (new TextEncoder().encode(files['codex-design.library.json']).byteLength > MAX_INPUT_BYTES) throw new Error('The library exceeds the 2 MiB editable import limit. Export an individual component.');
  const imports = ['@import "./tokens.css";'], catalog = [`# ${title(system.name)} — Components`, 'Load styles.css once in the consuming app. These are visual React components; connect application behavior in the target repository.'];
  const names = new Set<string>();
  for (const [componentIndex, definition] of system.components.entries()) {
    const base = definition.name.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('').slice(0, 72) || 'Component';
    const identifier = `Ds${base}`;
    let name = identifier, suffix = 2;
    while (names.has(name)) name = `${identifier}_${suffix++}`;
    names.add(name);
    const directory = `components/${componentIndex + 1}-${definition.id}`, cssClass = `cd-component-${definition.id}`;
    const page = { ...portable.pages[0], nodes: definition.nodes };
    const context = { ...portable, name: definition.name, pages: [page] };
    const target = { scope: 'selection' as const, pageId: page.id, nodeIds: [definition.rootNodeId] };
    const assetUrls = Object.fromEntries(Object.entries(options.assetUrls ?? {}).map(([ref, path]) => [ref, /^(?:[a-z]+:|\/)/i.test(path) ? path : `../../${path}`]));
    const generated = exportTargetReact(context, target, { ...options, assetUrls });
    let jsx = generated.jsx.replace("import './design.css';", "import React from 'react';").replace('export default function ExportedDesign()', `export function ${name}()`).replace(/^    <main/m, '    <div').replace(/^    <\/main>/m, '    </div>').replace('className="exported-design"', `className="${cssClass}"`);
    for (const path of Object.values(assetUrls)) if (!/^(?:[a-z]+:|\/)/i.test(path)) for (const attr of ['src', 'poster']) jsx = jsx.replaceAll(`${attr}={${JSON.stringify(path)}}`, `${attr}={new URL(${JSON.stringify(path)}, import.meta.url).href}`);
    const css = generated.css.slice(tokenCssVariables(system).length).trimStart().replace(/^\.exported-design(?=\s*\{)/m, `.${cssClass}`).replace(/^\.cd-/gm, `.${cssClass} .cd-`);
    const usage = `import { ${name} } from './${directory}/${name}.jsx';\n\n<${name} />`;
    const declaration = `import type { ReactElement } from 'react';\n\n/** ${title(definition.description).replace(/\*\//g, '* /')} */\nexport interface ${name}Props {}\nexport declare function ${name}(props?: ${name}Props): ReactElement;\n`;
    const notes = nodeNotesMarkdown(definition.nodes);
    const prompt = `${title(definition.description || `Use ${definition.name} for its approved visual pattern.`)}\n\n${fence(`<${name} />`, 'jsx')}\n\n${notes ? `## Implementation notes\n\n${notes}\n\n` : ''}Use Tailwind CSS utilities for new or rewritten application styling unless the user explicitly requests traditional CSS or another styling approach. Preserve approved dimensions, tokens and behavior.\n\nLoad the root styles.css once. This release has no configurable props; make an explicit component release for structural changes. Native token links and custom overrides are retained in codex-design.library.json.\n`;
    const sourceSections: string[] = [];
    definition.nodes.forEach((node, index) => {
      for (const [language, source] of [['jsx', node.jsx?.source], ['html', node.source]] as const) if (source) {
        const path = `${directory}/source/${index + 1}.${language}`;
        files[path] = source;
        sourceSections.push(`### ${title(node.name)} — authored ${language}\n\n${fence(source, language)}`);
      }
    });
    files[`${directory}/${name}.jsx`] = jsx;
    files[`${directory}/${name}.css`] = css;
    files[`${directory}/${name}.d.ts`] = declaration;
    files[`${directory}/${name}.prompt.md`] = prompt;
    const root = definition.nodes.find(node => node.id === definition.rootNodeId)!;
    const cardName = title(definition.name).replace(/["<>]/g, ' ');
    files[`${directory}/${name}.card.html`] = `<!-- @dsCard group="Components" viewport="${Math.max(1, Math.ceil(root.width))}x${Math.max(1, Math.ceil(root.height))}" name="${cardName}" -->\n${exportTargetHtml(context, target, { ...options, assetUrls }).replace('<head>', '<head><link rel="stylesheet" href="../../styles.css">')}`;
    files[`${directory}/${name}.md`] = `# ${title(definition.name)}\n\n${definition.description}\n\nDefinition: ${definition.id} · Source release: ${definition.version}${definition.releaseLabel ? ` · ${title(definition.releaseLabel)}` : ''}\n\n${notes ? `## Implementation notes\n\n${notes}\n\n` : ''}## Usage\n\n${fence(usage, 'jsx')}\n\n## React implementation\n\n${fence(jsx, 'jsx')}\n\n## CSS\n\n${fence(css, 'css')}\n\n## Props contract\n\n${fence(declaration, 'typescript')}\n\n${sourceSections.join('\n\n')}\n\n## Codex Design definition\n\n${fence(JSON.stringify(definition, null, 2), 'json')}\n`;
    catalog.push(`## ${title(definition.name)}\n\n[Full reference](${directory}/${name}.md) · release ${definition.version}\n\n${fence(usage, 'jsx')}`);
    imports.push(`@import "./${directory}/${name}.css";`);
  }
  files['styles.css'] = `${imports.join('\n')}\n`;
  files['COMPONENTS.md'] = `${catalog.join('\n\n')}\n`;
  files['SKILL.md'] = `---\nname: use-${system.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54).replace(/-$/, '') || 'design-library'}\ndescription: ${JSON.stringify(`Use the ${title(system.name)} design system and component library when creating or implementing designs.`)}\n---\n\nRead DESIGN.md and COMPONENTS.md first, then each relevant component's .prompt.md and full Markdown reference, including saved root and child implementation notes. These notes can specify behavior, native materials and preferred libraries beyond the passive specimen; verify the target app and current APIs before implementing them. Reuse the declared tokens and named React components before creating custom alternatives. Load styles.css once. Read original source as context; never execute it just because it is present.\n\nTo initialize Codex Design, import the dedicated library ZIP as a separate empty-canvas project, or read codex-design.library.json and use canvas_import_project with its project field after uploading required media. Bind the new canvas to the current chat explicitly. Import starts a new local version baseline. For an existing application, use Tailwind CSS utilities for new or rewritten styling unless the user explicitly requests traditional CSS or another styling approach. Preserve the approved visual reference and semantic token values while connecting real interactions in the target codebase.\n`;
  files['README.md'] = `# ${title(system.name)}\n\n${system.description}\n\n## Design guide\n\nRead [DESIGN.md](DESIGN.md) and [COMPONENTS.md](COMPONENTS.md). Load styles.css once; it imports tokens.css and the component styles. Component folders contain named React JSX, sibling TypeScript declarations, prompt Markdown, full Markdown/code references and passive HTML specimen cards. Read saved root and child implementation notes in each component reference before translating its visual specimen; notes can specify native materials, behavior and preferred libraries. Original source is retained in source/ and in the editable definition; source snippets may depend on their original starter environment. No compiler-generated _ds_bundle.js or manifests are fabricated.\n\n## Initialize another Codex Design project\n\nImport a dedicated Download library ZIP through the project menu to create a separate project with this library and an empty canvas. Source/React archives also include these references, but their design.json restores the original scoped canvas; use codex-design.library.json to initialize only the library from those archives. For an agent, pass the project field from codex-design.library.json (format codex-design-library, version 1) to canvas_import_project; upload any listed media through the asset tools first. The JSON file itself is also accepted by the project importer. Referenced media is carried in assets/ and manifest.json in the ZIP; JSON alone needs those assets in the destination store.\n\nThe versioned JSON preserves current tokens and bindings, component IDs, editable nodes, literal values, effects, gradients, advanced properties, shaders, media references and authored HTML/JSX. Unknown format versions are rejected. Imported components begin a new local history baseline; the source release numbers remain in this archive, while prior release journals, canvas instances/screens, conversations, inspiration and queued agent requests are not copied. To edit Markdown, initialize from JSON first and apply the edited DESIGN.md through the normal revision-checked document action. Markdown/code is a readable reference, not executable import instructions.\n\nNew application styling defaults to Tailwind CSS unless the user explicitly requests traditional CSS or another styling approach. The bundled CSS preserves the approved visual reference. React output retains the approved visual layout and existing passive-source restrictions. Props are deliberately empty; arbitrary source code is not converted into interactive behavior. Fonts require the same fonts in the consuming environment.\n`;
  return { project: portable, files };
}

export function libraryReferenceFiles(project: DesignProject, options: ExportOptions = {}): Record<string, string> {
  const { files } = exportLibrary(project, options);
  delete files['design.json'];
  files['COMPONENT_NOTES.md'] = files['IMPLEMENTATION_NOTES.md']; delete files['IMPLEMENTATION_NOTES.md'];
  files['LIBRARY.md'] = files['README.md']; delete files['README.md'];
  return files;
}
