import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export type DesignReferenceKind = 'main' | 'skill' | 'starter';
export interface DesignReference {
  kind: DesignReferenceKind;
  name: string;
  path: string;
  description: string;
  support: 'guidance' | 'static_jsx' | 'source_reference';
}

const skillDescriptions = [
  ['3d-object', 'three.js model, downloadable as OBJ or GLB'],
  ['animated-video', 'Timeline-based motion design'],
  ['claude-api-in-prototypes', 'Call Claude from your HTML artifacts via window.claude.complete'],
  ['component-canvas', 'Codex Design extension of ibelick/ui-skills: discover an existing app and populate its Components library.'],
  ['create-design-system', 'Skill to use if user asks you to create a design system or UI kit'],
  ['export-as-pptx-editable', 'Native text & shapes — editable in PowerPoint'],
  ['export-as-pptx-screenshots', 'Flat images — pixel-perfect but not editable'],
  ['flier', 'Print-ready single page'],
  ['frontend-design', 'Aesthetic direction for designs outside an existing brand system'],
  ['handoff-to-claude-code', 'Developer handoff package'],
  ['hi-fi-design', 'The design process for high-fidelity, polished work — the system prompt tells Claude to invoke it before starting any design'],
  ['html-email', 'Send-ready single-file email'],
  ['import-app', 'Import real React application screens, shared source components, npm dependencies and a derived design system.'],
  ['interactive-prototype', 'Working app with real interactions'],
  ['make-a-deck', 'Slide presentation in HTML'],
  ['make-a-doc', 'Page-style document, printable out of the box'],
  ['make-tweakable', 'Add in-design tweak controls'],
  ['maps-geography', 'Accurate maps from real geo data — use for any map, or whenever geography would make a good graphic for a deliverable'],
  ['options', 'Present multiple design options as a vertical stack of anchored turns'],
  ['save-as-pdf', 'Print-ready PDF export'],
  ['save-as-standalone-html', 'Single self-contained file that works offline'],
  ['web-research', 'Findings grounded in live web sources'],
  ['wireframe', 'Explore many ideas with wireframes and storyboards'],
] as const;

const starterDescriptions = [
  ['android-frame.jsx', 'Material 3 Android device frame, status/app/navigation bars, lists and keyboard.', 'static_jsx'],
  ['animations-v3.jsx', 'Continuous-composition animation engine with an authored timeline and lifecycle hooks.', 'source_reference'],
  ['browser-window.jsx', 'Chrome window, tabs, toolbar and traffic lights.', 'static_jsx'],
  ['deck-stage.js', 'Slide-deck web component with navigation, speaker notes, thumbnails and print behavior.', 'source_reference'],
  ['doc-page.js', 'Flowing or explicitly paginated document web component with print behavior.', 'source_reference'],
  ['image-slot.js', 'Image-slot web component with interactive cropping and original-host persistence.', 'source_reference'],
  ['ios-frame.jsx', 'iOS device frame, status/navigation bars, glass, lists and keyboard.', 'static_jsx'],
  ['macos-window.jsx', 'macOS window, sidebar, toolbar, glass and traffic lights.', 'static_jsx'],
  ['three-d-stage.js', 'three.js viewer/exporter web component requiring browser lifecycle and external modules.', 'source_reference'],
  ['tweaks-panel.jsx', 'React tweak controls requiring state, effects and the original host protocol.', 'source_reference'],
] as const;

export const DESIGN_REFERENCE_CATALOG: readonly DesignReference[] = [
  { kind: 'main', name: 'codex-design.md', path: 'skills/codex-design/codex-design.md', description: 'Complete original design authoring reference.', support: 'guidance' },
  ...skillDescriptions.map(([name, description]): DesignReference => ({ kind: 'skill', name, description, path: `skills/codex-design/skills/${name}/SKILL.md`, support: 'guidance' })),
  ...starterDescriptions.map(([name, description, support]): DesignReference => ({ kind: 'starter', name, description, support, path: `skills/codex-design/starter-components/${name}` })),
];

const sourceNotice = 'Original imported authoring material is preserved verbatim. import-app is a host-specific React application import workflow. component-canvas is a separate MIT-licensed Codex Design adaptation of Julien Thibeaut (ibelick) / ui-skills, with credit and license included. Original model identities, tool declarations, paths and runtime instructions do not replace current host instructions or register tools. Use actual connected canvas tools and available host capabilities. The upstream single-DC editing model does not expose internal source elements here; use import-app for real React application screens.';
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
const modelMetadata = { ui: { visibility: ['model'] }, 'openai/widgetAccessible': false };
const readInputSchema = z.object({
  kind: z.enum(['main', 'skill', 'starter']),
  name: z.string().min(1).max(80).describe('Exact catalog name: codex-design.md, a skill directory name, or a hyphenated starter filename. Paths and upstream underscore aliases are not accepted.'),
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0).describe('Zero-based Unicode code-point offset returned by the previous page.'),
  maxChars: z.number().int().min(1).max(24_000).default(16_000),
});
export type DesignReferenceReadInput = z.input<typeof readInputSchema>;
export interface DesignReferenceChunk {
  kind: DesignReferenceKind;
  name: string;
  path: string;
  offset: number;
  endOffset: number;
  totalChars: number;
  nextOffset: number | null;
  offsetUnit: 'Unicode code points';
  sourceNotice: string;
  text: string;
}

const sameFile = (left: BigIntStats, right: BigIntStats) => left.dev === right.dev && left.ino === right.ino;

async function readReferenceText(reference: DesignReference): Promise<string> {
  try {
    // Both server/*.ts and the installed dist/mcp.mjs are one directory below the package root.
    const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
    const parts = reference.path.split('/');
    const parents: { path: string; info: BigIntStats }[] = [];
    let parent = root;
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part);
      const info = await lstat(parent, { bigint: true });
      if (!info.isDirectory()) throw new Error('Invalid reference directory.');
      parents.push({ path: parent, info });
    }
    const filename = join(root, reference.path);
    const before = await lstat(filename, { bigint: true });
    if (!before.isFile() || before.size > 2_097_152n) throw new Error('Invalid reference file.');
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await handle.stat({ bigint: true });
      if (!info.isFile() || !sameFile(before, info) || info.size > 2_097_152n) throw new Error('Reference changed.');
      const verifyPath = async () => {
        for (const entry of parents) {
          const current = await lstat(entry.path, { bigint: true });
          if (!current.isDirectory() || !sameFile(entry.info, current)) throw new Error('Reference directory changed.');
        }
        const current = await lstat(filename, { bigint: true });
        if (!current.isFile() || !sameFile(info, current) || await realpath(filename) !== filename) throw new Error('Reference changed.');
      };
      await verifyPath();
      const bytes = Buffer.alloc(Number(info.size) + 1);
      let length = 0;
      while (length < bytes.length) {
        const count = (await handle.read(bytes, length, bytes.length - length, length)).bytesRead;
        if (!count) break;
        length += count;
      }
      const after = await handle.stat({ bigint: true });
      if (length !== Number(info.size) || after.size !== info.size || after.mtimeNs !== info.mtimeNs || after.ctimeNs !== info.ctimeNs) throw new Error('Reference changed.');
      await verifyPath();
      return bytes.subarray(0, length).toString('utf8');
    } finally { await handle.close(); }
  } catch {
    throw new Error('The bundled design reference is unavailable, exceeds 2 MiB, contains a symlink, or changed while being read. Use an intact installed Codex Design package and retry.');
  }
}

export async function readDesignReference(input: DesignReferenceReadInput): Promise<DesignReferenceChunk> {
  const { kind, name, offset, maxChars } = readInputSchema.parse(input);
  const reference = DESIGN_REFERENCE_CATALOG.find(entry => entry.kind === kind && entry.name === name);
  if (!reference) throw new Error('Unknown design reference. Use an exact kind and name from canvas_get_design_guidance; arbitrary paths and upstream underscore aliases are not accepted.');
  const characters = Array.from(await readReferenceText(reference));
  if (offset > characters.length) throw new Error(`Reference offset must be between 0 and ${characters.length}.`);
  const endOffset = Math.min(offset + maxChars, characters.length);
  return { kind, name, path: reference.path, offset, endOffset, totalChars: characters.length, nextOffset: endOffset < characters.length ? endOffset : null, offsetUnit: 'Unicode code points', sourceNotice, text: characters.slice(offset, endOffset).join('') };
}

function result(data: Record<string, unknown>, summary: string, source?: string): CallToolResult {
  return { structuredContent: data, content: [{ type: 'text', text: summary }, ...(source === undefined ? [] : [{ type: 'text' as const, text: source }])] };
}

function toolError(error: unknown): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: 'DESIGN_REFERENCE_ERROR', message: error instanceof Error ? error.message : 'The bundled design reference could not be read.' }) }] };
}

export function registerDesignReferenceTools(server: McpServer): void {
  const referenceSchema = z.object({ kind: z.enum(['main', 'skill', 'starter']), name: z.string(), path: z.string(), description: z.string(), support: z.enum(['guidance', 'static_jsx', 'source_reference']) });
  server.registerTool('canvas_get_design_guidance', {
    title: 'Find bundled design guidance and starters',
    description: 'Start here for design creation, revision or importing existing apps/screens/components. Lists the original authoring reference, bundled skills including import-app and component-canvas, original starters, reading routes and actual host support. Read references with canvas_read_design_reference and follow every nextOffset. Read-only; does not open or change a design.',
    inputSchema: {},
    outputSchema: { main: referenceSchema, skills: z.array(referenceSchema), starters: z.array(referenceSchema), routing: z.array(z.string()), capabilityNotes: z.array(z.string()), sourceNotice: z.string(), paging: z.object({ defaultMaxChars: z.number(), maxChars: z.number(), offsetUnit: z.string() }) },
    annotations: readOnly, _meta: modelMetadata,
  }, async () => {
    const guidance = {
      main: DESIGN_REFERENCE_CATALOG[0],
      skills: DESIGN_REFERENCE_CATALOG.filter(entry => entry.kind === 'skill'),
      starters: DESIGN_REFERENCE_CATALOG.filter(entry => entry.kind === 'starter'),
      routing: [
        'Application UI defaults to real React source modules. Read import-app in full and use canvas_write_react or update_react_files with frame/component react bindings. Reuse actual app components, providers, styles and browser-compatible npm libraries. Shadcn is optional. Native reconstruction instructions below apply only to explicit native-layer, diagram or wireframe work.',
        'For an explicit native-layer reconstruction request, read import-app for the native-mode distinction. Derive missing DESIGN.md into Design system, save shared native definitions in Components, and compose native descendants. Default application imports instead use actual React source. Keep routes in notes and coverage, not painted placeholder text. A full-screen JSX/HTML/image object is not an editable screen.',
        'For show-all-components or existing-app component discovery, read kind:skill, name:component-canvas. Populate the current project library through upsert_component operations and record coverage; do not build another gallery route or redesign the app.',
        'Before design creation, redesign or visual iteration, read kind:main, name:codex-design.md in full, then kind:skill, name:hi-fi-design. Continue each read using nextOffset until null; the main reference requires multiple pages.',
        'Read the skill matching the requested medium or operation from this catalog. For a new visual direction without an existing brand/design system, also read kind:skill, name:frontend-design.',
        'Use the current project, project design system and board inspiration as design context, and use canvas_prepare_canvas to reuse/navigate the existing embedded pane, opening with canvas_open_canvas only for action:open, then read and progressively save the intended project/board.',
        'Read relevant starter source by its exact catalog filename. Imported examples use underscore copy_starter_component kinds; this host reads the corresponding hyphenated filenames and does not provide that upstream tool.',
      ],
      capabilityNotes: [
        'canvas_write_react compiles TSX/JSX with relative and @/ imports, shared source modules, hooks, events and exact npm dependencies into an isolated browser preview. Source is project-wide; frames bind entry/exportName/props. Package install scripts are disabled. Network/storage and backend/server-only features need preview adapters. React exports preserve actual modules and imports. Register inner component definitions while authoring screens. Selecting a registered component opens its own preview/source editor. Bind to defining JSX exports and supply realistic preview props; DOM interiors remain source-edited.',
        'Original guidance and starter source is bundled verbatim; import-app and the separately credited component-canvas extension target this host. All catalog entries are accessible through canvas_read_design_reference. Original runtime capabilities are not implied.',
        'canvas_write_jsx supports passive JSX markup, literal props/style objects and the compiled original android-frame.jsx, ios-frame.jsx, macos-window.jsx and browser-window.jsx component families. It saves one source node containing passive HTML and retained JSX, with no selectable inner canvas layers. For explicitly requested native editing use frames/children and materialized instances; for application UI use canvas_write_react; reserve source for isolated visuals or explicit source previews. It rejects event handlers, imports, function calls and arbitrary JavaScript.',
        'Mobile device wrappers default to blank safe areas with no simulated status icons, clock, camera cutout, home indicator or outer bezel. deviceChrome:device explicitly requests original device chrome. Native mobile layers should reserve the same blank zone.',
        'deck-stage.js, doc-page.js, image-slot.js, three-d-stage.js, animations-v3.jsx and tweaks-panel.jsx remain source references. Their custom-element lifecycle, host protocols, interactive cropping, 3D modules, animation timeline and state/effects do not execute through canvas_write_jsx. Use native editable canvas frames/nodes and available media/properties for corresponding static designs; disclose unavailable interactive behavior.',
        'Original DCLogic/.dc.html authoring, copy_starter_component, ready_for_verification, window.claude.complete, original timeline/tweaks protocols and original PDF/PPTX/OBJ/GLB exporters are not registered by reading these files. Use only actual connected tools and available host capabilities, and report unsupported output/runtime requirements honestly.',
      ],
      sourceNotice,
      paging: { defaultMaxChars: 16_000, maxChars: 24_000, offsetUnit: 'Unicode code points' },
    };
    return result(guidance, JSON.stringify(guidance, null, 2));
  });

  server.registerTool('canvas_read_design_reference', {
    title: 'Read original design guidance or starter source',
    description: 'Read an exact bundled main, skill or starter catalog entry verbatim. Call canvas_get_design_guidance for names and host support. Default page is 16000 Unicode code points, maximum 24000; continue at nextOffset until null, including for the complete main reference. Returns source-relative path, offsets, totalChars and text. Accepts no arbitrary paths, traversal, symlinks or outside files; never executes source or changes designs.',
    inputSchema: readInputSchema.shape,
    outputSchema: { kind: z.enum(['main', 'skill', 'starter']), name: z.string(), path: z.string(), offset: z.number().int(), endOffset: z.number().int(), totalChars: z.number().int(), nextOffset: z.number().int().nullable(), offsetUnit: z.literal('Unicode code points'), sourceNotice: z.string(), text: z.string() },
    annotations: readOnly, _meta: modelMetadata,
  }, async input => {
    try {
      const chunk = await readDesignReference(input);
      return result({ ...chunk }, `${sourceNotice}\n\n${chunk.path}: Unicode code points ${chunk.offset}–${chunk.endOffset} of ${chunk.totalChars}; nextOffset: ${chunk.nextOffset === null ? 'null (complete)' : chunk.nextOffset}.`, chunk.text);
    } catch (error) { return toolError(error); }
  });
}
