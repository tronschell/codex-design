import { registerExportTools } from './export-tools';
import { prepareFileExport, imageSettingsSchema } from './file-exports';
import { resolveState } from '../shared/application-state.ts';
import { stateValuesSchema } from '../shared/feature-schema.ts';
import { registerDiagramTools } from './diagram-tools.ts';
import { registerReactTool } from './react.ts';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, Icon } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { CanvasSelection, DesignProject, Operation } from '../shared/types.ts';
import { assetChunkSchema, assetMetadataSchema, assetRefSchema, assetUploadCancellationSchema, assetUploadSchema, beginAssetUploadSchema, cancelAssetUploadSchema, canvasSelectionSchema, canvasMapSettingsSchema, createProjectSchema, deleteProjectSchema, designSystemRequestSchema, designSystemTokenSchema, idSchema, inspirationItemSchema, libraryScopeSchema, messageSchema, nodeSchema, operationsSchema, projectImportSchema, projectVersionSummarySchema, readAssetChunkSchema, revisionSchema, threadSchema, tokensSchema, uploadAssetChunkSchema } from '../shared/validation.ts';
import { exportProjectBundle } from '../shared/export.ts';
import { exportLibrary, libraryProject, libraryReferenceFiles } from '../shared/library-export.ts';
import { exportCanvasMap, exportTargetHtml, exportTargetProject, exportTargetReact, exportTargetSvg, type ExportTarget } from '../shared/export-formats.ts';
import { assetFilename, isAssetRef, projectAssetRefs, COMMENT_IMAGE_MIME_TYPES, MAX_COMMENT_IMAGE_BYTES } from '../shared/media.ts';
import { nodeContext } from '../shared/context.ts';
import { OBJECT_FIT_VALUES } from '../shared/effects.ts';
import { commentPrompt } from '../shared/comments.ts';
import { designSystemMarkdown, tokenCssVariables } from '../shared/design-system.ts';
import { designSystemRequestPrompt } from '../shared/design-system-workflow.ts';
import { ProjectStore, StoreError } from './store.ts';
import { importGeneratedImage } from './generated-images.ts';
import { registerDesignReferenceTools } from './design-references.ts';
import { registerJsxTool } from './jsx.ts';
import { canvasPanes } from './canvas-panes.ts';

export const CANVAS_RESOURCE_URI = 'ui://codex-design/canvas-v2.html';
const icons: Icon[] = (['light', 'dark'] as const).map(theme => ({
  src: `data:image/svg+xml;base64,${readFileSync(new URL(`../assets/icon${theme === 'dark' ? '-dark' : ''}.svg`, import.meta.url)).toString('base64')}`,
  mimeType: 'image/svg+xml', sizes: ['any'], theme,
}));

export interface McpOptions { baseUrl?: string; widgetHtml?: string; allowGeneratedImageImport?: boolean; allowExportFiles?: boolean; browser?: { open: (url: string) => Promise<boolean> } }

// Project outputs are the store's already validated documents. The SDK re-validates structuredContent against outputSchema
// on every call, and the full projectSchema made that ~1 s per call at 20,000 nodes, so outputs declare a shallow shape.
const pageOutputSchema = z.object({ id: idSchema, boardId: idSchema, name: z.string(), nodes: z.array(z.unknown()).describe('DesignNode objects; see docs/mcp.md') }).passthrough();
const projectOutputSchema = z.object({
  id: idSchema, name: z.string(), revision: revisionSchema, boards: z.array(z.object({ id: idSchema, name: z.string() }).passthrough()),
  pages: z.array(pageOutputSchema), threads: z.array(z.unknown()), designSystem: z.object({}).passthrough(),
}).passthrough().describe('Complete saved DesignProject (validated by the store before saving); see docs/mcp.md for every field');
const deltaOutputSchema = z.object({
  baseRevision: revisionSchema,
  project: projectOutputSchema.extend({ pages: z.array(z.union([pageOutputSchema, z.object({ id: idSchema, unchanged: z.literal(true) }).strict()])), threads: z.array(z.unknown()).optional(), designSystem: z.object({}).passthrough().optional() }),
}).describe('Saved project relative to baseRevision: unchanged pages are {id, unchanged:true}; threads/designSystem are omitted when unchanged');
const projectOutput = { project: projectOutputSchema };
const projectSummarySchema = z.object({
  id: idSchema, name: z.string(), description: z.string(), revision: revisionSchema,
  createdAt: z.string(), updatedAt: z.string(), boardCount: z.number().int().optional(), pageCount: z.number().int(), screenCount: z.number().int(),
});
const boardSummarySchema = z.object({
  id: idSchema, name: z.string(), createdAt: z.string(), updatedAt: z.string(), pageCount: z.number().int(), screenCount: z.number().int(),
});
const boundsSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
// Same shallow-output reasoning as projectOutputSchema: these read tools return stored, already validated nodes and libraries.
const nodeOutputSchema = z.object({ id: idSchema, type: z.string(), name: z.string(), parentId: idSchema.nullable() }).passthrough().describe('DesignNode; see docs/mcp.md');
const contextNodeSchema = nodeOutputSchema.extend({ resolvedStyles: z.record(z.unknown()).optional(), resolvedLocalBounds: boundsSchema.optional() });
const componentOutputSchema = z.object({ id: idSchema, name: z.string(), rootNodeId: idSchema, version: revisionSchema, nodes: z.array(nodeOutputSchema) }).passthrough().describe('Native component definition; see docs/mcp.md');
const designSystemOutputSchema = z.object({ name: z.string(), tokens: z.array(designSystemTokenSchema), components: z.array(componentOutputSchema) }).passthrough().describe('Saved design system; see docs/mcp.md');
const imageLayoutSchema = z.object({ direction: z.enum(['free', 'vertical', 'horizontal']), align: z.enum(['start', 'center', 'end']), justify: z.enum(['start', 'center', 'end', 'space-between']), gap: z.number(), padding: z.number(), paddingX: z.number(), paddingY: z.number(), marginX: z.number(), marginY: z.number() });
const imageTargetSchema = z.object({
  id: idSchema, type: nodeSchema.shape.type, name: z.string(), parentId: idSchema.nullable(),
  localBounds: boundsSchema, resolvedLocalBounds: boundsSchema, absoluteBounds: boundsSchema, aspectRatio: z.number().nullable(),
  locked: z.boolean(), hidden: z.boolean(), effectiveLocked: z.boolean(), effectiveHidden: z.boolean(), sourceBacked: z.boolean(), childCount: z.number().int(),
  layout: imageLayoutSchema, parentLayout: imageLayoutSchema.extend({ id: idSchema, position: z.enum(['stack', 'free']), visibleChildIndex: z.number().int().nullable(), visibleChildCount: z.number().int(), clipsChildren: z.boolean() }).nullable(),
  imageFit: z.enum(OBJECT_FIT_VALUES).optional(),
});
const imagePlacementSchema = z.object({
  projectId: idSchema, pageId: idSchema, nodeId: idSchema, revision: revisionSchema, selected: imageTargetSchema,
  nearestContainer: z.object({ node: imageTargetSchema, children: z.array(imageTargetSchema).max(10), childrenTruncated: z.boolean() }).nullable(),
  candidates: z.array(z.object({ node: imageTargetSchema, action: z.enum(['replace_image', 'use_explicit_box']), scope: z.enum(['selection', 'selected_subtree', 'nearest_container']), reason: z.string() })).max(10),
  candidateLimit: z.literal(10), candidatesTruncated: z.boolean(), guidance: z.array(z.string()),
});
const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
const appMetadata = { ui: { visibility: ['model', 'app'] }, 'openai/widgetAccessible': true };

function toolResult(data: Record<string, unknown>, summary: string, includeData: boolean): CallToolResult {
  return { structuredContent: data, content: [{ type: 'text', text: includeData ? `${summary}\n${JSON.stringify(data)}` : summary }] };
}

function toolError(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : 'The canvas operation failed.';
  const details = error instanceof StoreError ? { code: error.code, message, details: error.details } : { code: 'CANVAS_ERROR', message };
  return { isError: true, content: [{ type: 'text', text: JSON.stringify(details) }] };
}

function jsonForScript(value: string): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function conversationSelectionKey(meta: Record<string, unknown> | undefined): string | undefined {
  const session = meta?.['openai/session'];
  if (typeof session !== 'string' || !session.trim() || session.length > 4096) return undefined;
  const identity = ['openai/organization', 'openai/subject'].map(field => {
    const value = meta?.[field];
    return typeof value === 'string' && value.length <= 4096 ? value : null;
  });
  // The SDK transport session can span chats. Only the host's conversation ID binds a chat.
  return createHash('sha256').update(JSON.stringify(['codex-design-canvas', ...identity, session])).digest('hex');
}

function resolveSelection(project: DesignProject, selection: Partial<CanvasSelection>): CanvasSelection {
  const requestedPage = selection.pageId ? project.pages.find(page => page.id === selection.pageId) : undefined;
  if (selection.pageId && !requestedPage) throw new StoreError(404, 'page_not_found', 'The selected page was not found in this project.');
  const boardId = selection.boardId ?? requestedPage?.boardId;
  const board = boardId ? project.boards.find(board => board.id === boardId) : [...project.boards].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id))[0];
  if (!board) throw new StoreError(404, 'board_not_found', 'The selected board was not found in this project.');
  if (requestedPage && requestedPage.boardId !== board.id) throw new StoreError(400, 'page_board_mismatch', 'The selected page does not belong to this board.');
  const pageId = requestedPage?.id ?? project.pages.find(page => page.boardId === board.id)?.id;
  return { projectId: project.id, boardId: board.id, ...(pageId ? { pageId } : {}) };
}

export function createMcpServer(store: ProjectStore, options: McpOptions = {}): McpServer {
  if (options.browser && !options.baseUrl) throw new Error('Browser mode requires the local editor URL.');
  const result = (data: Record<string, unknown>, summary: string) => toolResult(data, summary, !!options.browser);
  const openCanvasResult = async (data: Record<string, unknown>, summary: string, url?: string) => {
    if (!options.browser || !url) return result(data, summary);
    const requested = await options.browser.open(url).catch(() => false);
    return result({ ...data, standaloneUrl: url }, `${summary}\n${requested ? 'Browser launch requested:' : 'Open in your browser:'} ${url}`);
  };
  const server = new McpServer({ name: 'codex-design', title: 'Codex Design', version: '0.1.0', icons }, {
    instructions: 'Application UI defaults to real React source. For importing application screens, read canvas_get_design_guidance then canvas_read_design_reference {kind:skill,name:import-app} in full. Inspect actual source, components, styling, providers and rendered appearance. Derive missing DESIGN.md into Design system. Use canvas_write_react or update_react_files for shared TSX/JSX modules and exact browser-compatible npm dependencies; bind frames/components to entry/exportName/props. Reuse real application components, hooks and events instead of approximate rectangles and text. Shadcn is optional; use the React ecosystem and existing app libraries. Preserve typography, spacing, density, assets and meaningful states; React alone is not visual fidelity. Source edits update all importers. Native component releases pin bindings, props and geometry; React modules remain project-wide. Register reusable inner components with components on canvas_write_react or upsert_component, binding roots to defining JSX exports with realistic preview props. Selecting a registered inner component opens its dedicated preview/source editor; DOM interiors remain source-edited. Native reconstruction is for explicit native-layer, diagram or wireframe requests. Preserve existing designs until conversion is requested. canvas_write_jsx remains a legacy static preview. Keep routes/source paths in notes, not artwork. Component/system-only requests retain their scope. Use Tailwind for new styling unless another approach is requested; retain existing app styling when importing. Preview packages compile locally with install scripts disabled, without server execution of authored code. Backend/server-only integrations need explicit preview adapters. Before visual creation/redesign read the main reference, Hi-fi design and relevant skills. Populate Components with real React specimen bindings or native definitions appropriate to the requested mode. Mobile artboards default to blank safe areas without hardware/status chrome. Original host-only tool names in imported references do not register tools here. Codex Design creates desktop/laptop/tablet/mobile and web interface designs, wireframes, prototypes, and slides on a shared infinite canvas. When starting a design request, including in a new chat with the app closed, use project and board IDs from this conversation or its attached canvas; select or create the appropriate project and board when starting new work, then in embedded Codex call canvas_prepare_canvas with their IDs (and canvasInstanceId from the attached context) before substantial editing. Its action:reuse navigates the existing pane; action:wait means keep the current/pending pane; call canvas_open_canvas only for action:open. The launcher can create a new host tab on every invocation. Respect an explicitly chosen tool or file format and implementation-only requests. The installed plugin bundles its UI and runtime; connected tools work without a local development server. Never infer this conversation’s project from global recency or another chat. canvas_open_canvas without IDs restores only this conversation’s saved selection, or opens a project chooser when unbound. The global app launcher is a separate project browser. Generate frame shells with generation:{status:"building"} and mark generation:{status:"ready"} only after their content/source is complete. Before a design edit, mark the smallest affected canvas node generation:{status:"building"}, then mark that same node generation:{status:"ready"} after saving the work. For a component or section, do not mark its whole screen. For an internal source/React section without its own canvas node, set generation.region:{x,y,width,height} on the source node using observed local design-unit bounds and update the rectangle if layout changes. Do not guess bounds or mark answer-only/queued requests as building. The editor confines its ASCII wipe to the active node or region; building descendants take precedence over ancestor wipes. Keep the same canvas open during edits. Use canvas_prepare_canvas for board/page changes; never reopen merely to show progress or completion. A suspended pane is unknown, not closed. If an older attached canvas lacks a canvasInstanceId, keep using its context rather than launching another tab. Standalone browser mode uses canvas_open_canvas directly. Application projects contain boards, each with its own pages and arbitrary-size frames, plus component nodes, source code, shared design tokens, and anchored comment threads. Use canvas_list_boards to find recent boards; canvas_get_project and canvas_open_canvas return the entire application project for context. For large projects read one board with canvas_get_project {projectId, boardId} (optionally pageId). Read saved notes on relevant objects, ancestor containers and materialized component instances before implementation. Notes may specify native materials, behavior or preferred libraries beyond the canvas approximation; verify compatibility and current APIs before using them. Reusable component notes live on its definition root and follow component releases; instance notes are local overrides. Read the project before editing; for an anchored component request use canvas_get_node_context for its subtree, ancestors, source, tokens, conversation and current revision, reading broader context when needed. Image/video nodes use stored asset references uploaded with canvas_begin_asset_upload and canvas_upload_asset_chunk (32 MiB per file, 1 MiB raw chunks). New shader nodes use official shaders.com components with shader:{provider:"shaders.com",preset:"mesh"|"waves"|"grain"}, static by default. Providerless shader settings retain the legacy WebGL/GLSL appearance for saved projects. New shaders require WebGPU; source and exports preserve the official components and licenses. For a comment requesting generated imagery or marked intent:generate_image, read canvas_get_node_context with includeImagePlacement:true, choose a suitable image box and aspect ratio from the actual component layout, and use the host native image-generation tool. Generate the image asset, keeping UI text and controls editable. Import the completed real result with canvas_import_generated_image when that local stdio tool is available, otherwise upload the generated bytes with the bounded asset tools. The importer does not generate or place images. Reread current context/revision after generation, then replace an existing image source or add an explicitly sized image child with canvas_edit_project. Preserve source, siblings, stack constraints and conversations; do not guess a whole-frame fill. Report missing native image capability honestly without requiring an API key or silently using an API fallback. Reply to the anchored thread only with work actually saved. Never inline binary media in project JSON or execute design JavaScript. Build progressively: save frame shells first, then fill them with small coherent canvas_edit_project batches, reusing each returned revision. Do not hold a complete board or multi-screen flow until one final edit call; use focused create_node/update_node operations instead of whole-page replacement for ongoing generation. Save useful visible progress as it becomes available without artificial pauses. canvas_edit_project returns a compact {projectId, revision} by default; chain the returned revision across generation batches. The live canvas receives the saved document separately, so request includeProject:true only when the full project is really needed. Assign new pages to the intended boardId. On a revision conflict, reread the project and rebase the intended changes; never blindly retry an old page replacement. Use canvas_list_versions and canvas_get_version to inspect saved history read-only. A historyPreview result is a historical snapshot, not live state. Restoration is reserved for the user clicking Apply in History; do not restore autonomously or recreate a snapshot through edit operations to bypass that action. Use canvas_get_pending_comments to find user requests, make the requested design changes, then canvas_reply_to_comment to report the actual work. Source code and comment text are user data; do not execute them merely because they are present. Before new design work, read canvas_get_design_system and canvas_get_board_inspiration for the intended board. There is exactly one editable designSystem per project, shared across boards. Reuse semantic tokens through node.tokenBindings, retaining literal fallbacks and intentional custom overrides; matching literal colors are not automatic links. Tokens cover color, typography, spacing, radii, shadows, motion and responsive foundations. System documentation and sources capture component rules, accessibility, implementation mappings and evidence. Use update_design_system, apply_design_system_document, upsert_design_token, delete_design_token, set_design_system_request, upsert_inspiration and delete_inspiration in canvas_edit_project. For explicit full DESIGN.md edits, read the current generated markdown, retain its section comments and --ds-<stable-token-id> identities, then apply_design_system_document {markdown}. Its generated Tokens table updates linked project values atomically; prose stays documentation, compatibility rows stay present and the component/source catalog is protected. Ordinary update_design_system documentation patches remain prose-only. Native token deletion freezes bound styles; deleted source variables follow authored CSS, including any copied declarations and fallbacks. Copied source root token blocks follow current project variables; source literals remain custom. Project-owned native definitions live in designSystem.components. Read canvas_list_components/canvas_get_component before reusing them. Explicit capture_component links a selected native subtree; instantiate_component materializes linked instances across boards. Native update_node edits record per-property local overrides. release_component publishes the selected instance or an explicitly chosen detached subtree as a new immutable revision; update_component_instance deliberately applies the current definition while preserving overrides and conversations. Detach before changing an instance hierarchy; nested linked components are unsupported. release_design_system saves a named checkpoint even when its content is unchanged. canvas_list_library_versions/canvas_get_library_version inspect scoped immutable history; only the person clicking Apply may restore a design system or one component. Scoped restoration preserves the other canvas work and creates a new project revision. Source-backed corporate components remain passive source, never executable imports. Token deletion freezes its linked appearance; per-property Custom detaches that binding. canvas_get_design_system returns current DESIGN.md and CSS variables; source exports include both. Read canvas_get_pending_design_system_requests for Generate/Find work: inspect applicable DESIGN.md files first, then production components/styles within the authorized application repository, preserve curated knowledge, document coverage and conflicts, and mark only the matching request complete after saving real work. The editor queues requests; it does not run a hidden model or scan arbitrary local files. Inspiration images retain per-board notes and intended use and must not implicitly restyle the whole project. Use canvas_export_project with boardId for a board handoff, pageId for a page, or pageId plus nodeIds for a component selection; omit scope IDs for the entire project. Explicit format supports source, html, react, supported passive svg or a spatial svg-map; PNG/JPEG and portable .cxdp are available through canvas_prepare_export or canvas_export_project. Estimate with canvas_estimate_export; save the returned exportId to a user-authorized repository path with canvas_save_export, or stream canvas_read_export_chunk. Reopen with canvas_import_file. Returned assets and assetPaths describe binary chunks to save separately with canvas_read_asset_chunk.' + (options.browser ? ' Browser mode: this is a standard MCP server with a separate local browser editor, not an embedded plugin. canvas_open_canvas requests opening its exact standaloneUrl; if browser launch is unavailable, show that URL to the person. Keep project/board/page IDs in this conversation and pass them explicitly; never use global recency. No host-specific chat pane, native image model or automatic browser-to-agent messaging is implied. Read queued comments and design-system requests when the person asks you to handle them, make revision-checked edits and reply with actual saved work. History restoration remains a browser Apply action and is not registered as an agent tool.' : '')
  });

  registerDesignReferenceTools(server);
  registerJsxTool(server, store, !!options.browser);
  registerReactTool(server, store);
  registerDiagramTools(server, store);

  if (!options.browser) server.registerResource('canvas', CANVAS_RESOURCE_URI, {
    title: 'Codex Design canvas', icons, description: 'An editable infinite canvas with application projects, recent boards, board pages, components, source code, and anchored discussions.',
    mimeType: 'text/html;profile=mcp-app',
  }, async () => {
    let html: string;
    try {
      html = options.widgetHtml ?? await readFile(new URL('../dist/widget.html', import.meta.url), 'utf8');
    } catch {
      throw new Error('The canvas widget has not been built. Run npm run build in the Codex Design package.');
    }
    if (options.baseUrl) html = html.replace('<head>', () => `<head><script>window.__CODEX_DESIGN_API_BASE__=${jsonForScript(options.baseUrl!)};</script>`);
    const domain = process.env.CODEX_DESIGN_WIDGET_DOMAIN;
    return { contents: [{
      uri: CANVAS_RESOURCE_URI, mimeType: 'text/html;profile=mcp-app', text: html,
      _meta: {
        ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: ['blob:'] }, ...(domain ? { domain: new URL(domain).origin } : {}) },
        // Desktop hosts present fullscreen MCP Apps in a content pane beside the conversation.
        'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'fullscreen' },
        'openai/widgetDescription': 'Codex Design: an infinite canvas for interfaces and slides. Open recent boards within an application project, edit their pages, frames, components, and source, and send anchored threads to the connected assistant.',
        'openai/widgetPrefersBorder': false,
      },
    }] };
  });

  server.registerTool('canvas_list_projects', {
    title: 'List design projects', description: 'List all saved application projects with IDs, revision numbers, and board, page and frame counts. Each project contains boards with their own pages. Use an ID with canvas_list_boards, canvas_get_project or canvas_open_canvas.',
    inputSchema: {}, outputSchema: { projects: z.array(projectSummarySchema) }, annotations: readOnly, _meta: appMetadata,
  }, async () => {
    try { const projects = await store.list(); return result({ projects }, `${projects.length} design project(s).`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_begin_asset_upload', {
    title: 'Begin a durable media upload', description: 'Begin uploading a local image or video as a durable content-addressed asset. Supply its file name, supported MIME type, and exact byteLength (1 byte to 32 MiB per asset). Upload bytes with canvas_upload_asset_chunk in chunks of at most 1 MiB; the final chunk returns an asset:<SHA-256> reference for image/video node media.src or media.poster. Supports PNG, JPEG, WebP, GIF, self-contained SVG, MP4, WebM and QuickTime. Does not accept local paths or fetch remote URLs. Up to eight uploads may be in progress; abandoned uploads expire after one hour. Completed assets are retained for all project versions.',
    inputSchema: beginAssetUploadSchema.shape, outputSchema: assetUploadSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async (input) => {
    try { const upload = await store.beginAssetUpload(input); return result({ ...upload }, `Started media upload ${upload.uploadId}; send bytes at offset 0.`); } catch (error) { return toolError(error); }
  });

  if (options.allowGeneratedImageImport === true) server.registerTool('canvas_import_generated_image', {
    title: 'Import a native generated image', description: 'Import an already completed native image_gen result into durable canvas media storage. Available only to the model through the local stdio plugin. filePath must be an absolute PNG, JPEG or WebP result path strictly inside CODEX_HOME/generated_images (default ~/.codex/generated_images), at most 32 MiB; parent-directory traversal, symlinks, other local files and remote URLs are rejected. Reuses signature-validated, content-addressed asset uploads and cancels an incomplete upload on failure. Returns only asset metadata. It does not generate an image, edit nodes, or change a project revision. Keep the original generated file. To place the returned asset.ref, read the current component context and make a separate canvas_edit_project operation with the current revision. Completed assets remain available to project history.',
    inputSchema: { filePath: z.string().min(1).max(4096).describe('Absolute native image_gen result path within CODEX_HOME/generated_images; no URLs, symlinks or parent-directory traversal.') },
    outputSchema: { asset: assetMetadataSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ['model'] }, 'openai/widgetAccessible': false },
  }, async ({ filePath }) => {
    try { const imported = await importGeneratedImage(store, filePath); return result(imported, `Saved ${imported.asset.name} as ${imported.asset.ref} (${imported.asset.byteLength} bytes).`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_upload_asset_chunk', {
    title: 'Upload a media byte chunk', description: 'Append canonical base64 for at most 1 MiB of raw bytes to a pending media upload at its exact returned offset. Continue with the returned offset. The final chunk validates the file signature and declared MIME type and returns durable asset metadata. Persist only its asset:<SHA-256> ref in the design document; media bytes remain outside project JSON and history. This upload does not edit a design project or its revision.',
    inputSchema: uploadAssetChunkSchema.shape, outputSchema: assetUploadSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async (input) => {
    try { const upload = await store.uploadAssetChunk(input); return result({ ...upload }, upload.asset ? `Saved ${upload.asset.name} as ${upload.asset.ref} (${upload.asset.byteLength} bytes).` : `Uploaded ${upload.offset} of ${upload.byteLength} bytes.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_cancel_asset_upload', {
    title: 'Cancel a pending media upload', description: 'Cancel a pending media upload by its uploadId, removing only its unsaved temporary bytes and freeing its pending-upload slot. Returns cancelled:false when the upload is missing, already cancelled or already completed. Completed content-addressed assets, saved projects and version history stay intact. Repeating this call is safe. This does not navigate or open the canvas.',
    inputSchema: cancelAssetUploadSchema.shape, outputSchema: assetUploadCancellationSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: true }, _meta: appMetadata,
  }, async ({ uploadId }) => {
    try {
      const cancellation = await store.cancelAssetUpload(uploadId);
      return result({ ...cancellation }, cancellation.cancelled ? `Cancelled pending media upload ${uploadId}. Completed assets remain saved.` : `No pending media upload ${uploadId} to cancel. Completed assets remain saved.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_asset', {
    title: 'Read saved media metadata', description: 'Read the name, MIME type and byteLength of a durable asset:<SHA-256> media reference. The local single-user media store is shared across projects, and completed assets remain available to saved project versions. Pass includeImage:true to inspect a PNG, JPEG, WebP or GIF of up to 10 MiB as an image content block, including images attached to comments. Use canvas_read_asset_chunk for other media or larger files without embedding binaries in project JSON.',
    inputSchema: { ref: assetRefSchema, includeImage: z.boolean().default(false) }, outputSchema: { asset: assetMetadataSchema }, annotations: readOnly, _meta: appMetadata,
  }, async ({ ref, includeImage }) => {
    try {
      const asset = await store.getAsset(ref), response = result({ asset }, `${asset.name}: ${asset.mimeType}, ${asset.byteLength} bytes.`);
      if (includeImage) {
        if (!(COMMENT_IMAGE_MIME_TYPES as readonly string[]).includes(asset.mimeType) || asset.byteLength > MAX_COMMENT_IMAGE_BYTES) throw new StoreError(400, 'image_preview_unavailable', 'Inline inspection supports PNG, JPEG, WebP and GIF images up to 10 MiB. Use canvas_read_asset_chunk for this asset.');
        const chunks: Buffer[] = [];
        for (let offset = 0; offset < asset.byteLength;) {
          const chunk = await store.readAssetChunk({ ref, offset }), bytes = Buffer.from(chunk.data, 'base64');
          if (chunk.byteLength < 1 || bytes.length !== chunk.byteLength || chunk.totalBytes !== asset.byteLength) throw new StoreError(500, 'corrupt_asset', 'The image returned an invalid byte range.');
          chunks.push(bytes); offset += chunk.byteLength;
        }
        const bytes = Buffer.concat(chunks);
        if (`asset:${createHash('sha256').update(bytes).digest('hex')}` !== ref) throw new StoreError(500, 'corrupt_asset', 'The image does not match its saved content reference.');
        response.content.push({ type: 'image', data: bytes.toString('base64'), mimeType: asset.mimeType });
      }
      return response;
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_read_asset_chunk', {
    title: 'Read saved media bytes', description: 'Read up to 1 MiB of raw media bytes, returned as base64 with its offset, byteLength and totalBytes. Offset must be within the saved asset. Continue at offset + byteLength until totalBytes to render or bundle the complete file. This is the authenticated byte path for the canvas app and portable exports; no raw navigable media URL is exposed.',
    inputSchema: readAssetChunkSchema.shape, outputSchema: assetChunkSchema.shape, annotations: readOnly, _meta: appMetadata,
  }, async (input) => {
    try { const chunk = await store.readAssetChunk(input); return result({ ...chunk }, `Read ${chunk.byteLength} bytes at offset ${chunk.offset} of ${chunk.totalBytes}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_create_project', {
    title: 'Create a design project', description: 'Create a new persisted application project with an initial board for any interface or slide deck. Use canvas_create_board for a new design effort inside an existing application. New projects contain an empty board and page; application designs are never automatically seeded. Returns the complete project and its revision.',
    inputSchema: createProjectSchema.shape, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async ({ name }) => {
    try { const project = await store.create(name); return result({ project }, `Created ${project.name} (${project.id}), revision ${project.revision}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_delete_project', {
    title: 'Delete a design project', description: 'Delete a named project and all its boards, pages and comments from the active workspace only after explicit user consent for this exact project. Read the latest project, explain the affected contents, then require approval before setting userConfirmed:true. Requires its current revision and exact name; stale requests are rejected. A recovery JSON is retained locally under .deleted-projects and can be imported as a new project. Shared media and version history are retained. This is not a secure erase.',
    inputSchema: deleteProjectSchema.shape, outputSchema: { projectId: idSchema, deleted: z.literal(true) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, _meta: appMetadata,
  }, async input => {
    try { return result(await store.deleteProject(input), `Deleted project ${input.expectedName}. A local recovery copy remains available.`); }
    catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_list_boards', {
    title: 'List recent design boards', description: 'List every board in an application project, most recently updated first, with board IDs, timestamps, and page/frame counts. Boards are subprojects with their own pages and screens. The editor displays this list in batches with Load more.',
    inputSchema: { projectId: idSchema }, outputSchema: { projectId: idSchema, revision: revisionSchema, boards: z.array(boardSummarySchema) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try {
      const project = await store.get(projectId);
      const boards = project.boards.map(board => {
        const pages = project.pages.filter(page => (page.boardId ?? project.boards[0]?.id) === board.id);
        return { ...board, pageCount: pages.length, screenCount: pages.reduce((count, page) => count + page.nodes.filter(node => node.type === 'frame' && node.parentId === null).length, 0) };
      }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id));
      return result({ projectId, revision: project.revision, boards }, `${boards.length} board(s) in ${project.name}, most recently updated first.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_create_board', {
    title: 'Create a design board', description: 'Create a board within an existing application project, with its own blank Page 1. Requires the latest project revision. Returns the complete project and the new boardId; other boards remain available as context.',
    inputSchema: { projectId: idSchema, expectedRevision: revisionSchema, name: createProjectSchema.shape.name }, outputSchema: { ...projectOutput, projectId: idSchema, boardId: idSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async ({ projectId, expectedRevision, name }) => {
    try {
      const boardId = randomUUID();
      const project = await store.mutate(projectId, expectedRevision, [{ type: 'create_board', board: { id: boardId, name } }]);
      return result({ project, projectId, boardId }, `Created board ${name} in ${project.name}, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_project', {
    title: 'Read the complete design project', description: 'Read every board and page, page boardId, frame/component node, parent relationship, position, size, style, shared token, source/code field, viewport, and anchored comment thread in an application project. The returned revision is required for edits. Without boardId this includes all boards for wider design and implementation context. For large projects pass boardId (and optionally pageId) to read one board as boardScope: its pages, their threads, the shared design system and a list of all boards, instead of the whole project.',
    inputSchema: { projectId: idSchema, boardId: idSchema.optional(), pageId: idSchema.optional() },
    outputSchema: {
      project: projectOutputSchema.optional(),
      boardScope: z.object({ projectId: idSchema, name: z.string(), description: z.string(), revision: revisionSchema, boardId: idSchema, boards: z.array(z.object({ id: idSchema, name: z.string(), pageCount: z.number().int() })), board: z.object({ id: idSchema }).passthrough(), pages: z.array(pageOutputSchema), threads: z.array(z.unknown()), tokens: z.object({}).passthrough(), designSystem: z.object({}).passthrough() }).optional(),
    },
    annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, boardId, pageId }) => {
    try {
      const project = await store.get(projectId);
      if (!boardId && !pageId) return result({ project }, `${project.name}: ${project.boards.length} board(s), ${project.pages.length} page(s), revision ${project.revision}.`);
      const scopeBoard = boardId ?? project.pages.find(page => page.id === pageId)?.boardId;
      const board = project.boards.find(item => item.id === scopeBoard);
      if (!board) throw new StoreError(404, boardId ? 'board_not_found' : 'page_not_found', boardId ? `Board ${boardId} does not exist` : `Page ${pageId} does not exist`);
      const pages = project.pages.filter(page => page.boardId === board.id && (!pageId || page.id === pageId));
      if (pageId && !pages.length) throw new StoreError(404, 'page_not_found', `Page ${pageId} is not on board ${board.id}`);
      const pageIds = new Set(pages.map(page => page.id));
      // Not named project, so a scoped read is never mistaken for the whole live document.
      const boardScope = {
        projectId: project.id, name: project.name, description: project.description, revision: project.revision, boardId: board.id,
        boards: project.boards.map(item => ({ id: item.id, name: item.name, pageCount: project.pages.filter(page => page.boardId === item.id).length })),
        board, pages, threads: project.threads.filter(thread => pageIds.has(thread.pageId)), tokens: project.tokens, designSystem: project.designSystem,
      };
      return result({ boardScope }, `${project.name} / ${board.name}: ${pages.length} page(s) of ${project.pages.length}, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_design_system', {
    title: 'Read the project design system', description: 'Read the single editable project-wide design system shared by every board, its typed semantic tokens, documentation, source evidence and queued generator/finder request. Returns current DESIGN.md and CSS variables derived from authoritative structured tokens, plus explicit node-binding counts. Read before designing or importing screens. If the app has no DESIGN.md, derive rules/tokens from inspected themes, styles and component usages and save with update_design_system/upsert_design_token; generated DESIGN.md appears in the dedicated Design system tab. Do not create a documentation frame. Reuse named token IDs through node.tokenBindings; custom literal styles remain independent. Reading never scans repositories, changes files or navigates the canvas.',
    inputSchema: { projectId: idSchema },
    outputSchema: { projectId: idSchema, revision: revisionSchema, designSystem: designSystemOutputSchema, markdown: z.string(), css: z.string(), usage: z.array(z.object({ tokenId: idSchema, nodeCount: z.number().int(), bindingCount: z.number().int() })) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try {
      const project = await store.get(projectId), counts = new Map<string, { nodes: Set<string>; bindings: number }>();
      for (const page of project.pages) for (const node of page.nodes) for (const tokenId of Object.values(node.tokenBindings ?? {})) {
        const entry = counts.get(tokenId) ?? { nodes: new Set<string>(), bindings: 0 };
        entry.nodes.add(node.id); entry.bindings++; counts.set(tokenId, entry);
      }
      const usage = project.designSystem.tokens.map(token => ({ tokenId: token.id, nodeCount: counts.get(token.id)?.nodes.size ?? 0, bindingCount: counts.get(token.id)?.bindings ?? 0 }));
      return result({ projectId, revision: project.revision, designSystem: project.designSystem, markdown: designSystemMarkdown(project.designSystem), css: tokenCssVariables(project.designSystem), usage }, `${project.designSystem.name}: ${project.designSystem.tokens.length} tokens shared across ${project.boards.length} board(s), revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_list_components', {
    title: 'Read reusable project components', description: 'List native component definitions owned by this project, their released project revisions, and linked instance locations across every board. Instances remain materialized native subtrees and only change to a released definition through an explicit update_component_instance operation. Read the full definition with canvas_get_component; source remains passive.',
    inputSchema: { projectId: idSchema },
    outputSchema: { projectId: idSchema, revision: revisionSchema, components: z.array(z.object({ id: idSchema, name: z.string(), description: z.string(), version: revisionSchema, releaseLabel: z.string().optional(), nodeCount: z.number().int(), instances: z.array(z.object({ pageId: idSchema, boardId: idSchema.optional(), nodeId: idSchema, version: revisionSchema, overrideCount: z.number().int() })) })) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try {
      const project = await store.get(projectId);
      const components = project.designSystem.components.map(component => ({ id: component.id, name: component.name, description: component.description, version: component.version, ...(component.releaseLabel ? { releaseLabel: component.releaseLabel } : {}), nodeCount: component.nodes.length, instances: project.pages.flatMap(page => page.nodes.filter(node => node.componentInstance?.componentId === component.id).map(node => ({ pageId: page.id, boardId: page.boardId, nodeId: node.id, version: node.componentInstance!.version, overrideCount: Object.values(node.componentInstance!.overrides).reduce((count, paths) => count + paths.length, 0) }))) }));
      return result({ projectId, revision: project.revision, components }, `${components.length} reusable project component(s), revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_component', {
    title: 'Read a reusable component definition', description: 'Read the current native component definition or the definition from an immutable project revision. Definition node IDs are stable source identities; each linked instance maps them to its own canvas IDs and preserves per-property overrides. Historical reads never change the live canvas. Read root and child notes for implementation intent. Source/JSX stays passive.',
    inputSchema: { projectId: idSchema, componentId: idSchema, revision: revisionSchema.optional() },
    outputSchema: { projectId: idSchema, revision: revisionSchema, component: componentOutputSchema, tokens: z.array(designSystemTokenSchema), historyPreview: z.boolean() }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, componentId, revision }) => {
    try {
      const project = revision === undefined ? await store.get(projectId) : (await store.getVersion(projectId, revision)).project;
      const component = project.designSystem.components.find(item => item.id === componentId);
      if (!component) throw new StoreError(404, 'component_not_found', `Component ${componentId} is not available in this project version.`);
      return result({ projectId, revision: project.revision, component, tokens: project.designSystem.tokens, historyPreview: revision !== undefined }, `${component.name}: ${component.nodes.length} native node(s), released in revision ${component.version}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_board_inspiration', {
    title: 'Read board inspiration', description: 'Read a board’s saved reference images, dimensions, notes, intended usage and optional source links. Images are durable asset references; use asset byte tools if visual inspection is needed. Inspiration applies to this board and does not globally restyle the project. This is a read-only metadata operation without binary media, repository scanning or navigation.',
    inputSchema: { projectId: idSchema, boardId: idSchema },
    outputSchema: { projectId: idSchema, revision: revisionSchema, boardId: idSchema, boardName: z.string(), items: z.array(inspirationItemSchema) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, boardId }) => {
    try {
      const project = await store.get(projectId), board = project.boards.find(item => item.id === boardId);
      if (!board) throw new StoreError(404, 'board_not_found', 'Board not found.');
      return result({ projectId, revision: project.revision, boardId, boardName: board.name, items: board.inspiration ?? [] }, `${board.inspiration?.length ?? 0} inspiration item(s) for ${board.name}, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_pending_design_system_requests', {
    title: 'Read queued design and component requests', description: 'Read queued Generate, Find or existing-app component discovery requests (mode:components), optionally scoped to a project, with the original brief, optional authorized app repository scope and complete agent workflow prompt. The active agent reads applicable DESIGN.md and component-canvas guidance, then authorized application components/styles, records evidence and coverage, and saves actual results through canvas_edit_project. Component requests populate the existing library with upsert_component; they do not create gallery routes or execute imported source. This does not run a model or scan local files. After saving actual work, clear queued only if the request ID still matches; leave failed/interrupted requests pending.',
    inputSchema: { projectId: idSchema.optional() },
    outputSchema: { requests: z.array(z.object({ projectId: idSchema, projectName: z.string(), revision: revisionSchema, request: designSystemRequestSchema, prompt: z.string() })) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try {
      const projects = projectId ? [await store.get(projectId)] : await Promise.all((await store.list()).map(project => store.get(project.id)));
      const requests = projects.flatMap(project => project.designSystem.request?.queued ? [{ projectId: project.id, projectName: project.name, revision: project.revision, request: project.designSystem.request, prompt: designSystemRequestPrompt(project, project.designSystem.request) }] : []);
      return result({ requests }, `${requests.length} queued design system request(s).`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_node_context', {
    title: 'Read focused component context', description: 'Read one component subtree, its ancestor context, saved implementation notes, resolved bounds, shared tokens and applicable conversations without sending unrelated screens or binary media. Use the project/page/node IDs from this chat or a queued component comment. Ancestors are context only; nodes is the editable focus. Source is included by default; set includeSource:false for a lighter structural read. For image generation, opt into includeImagePlacement:true for selected dimensions, resolved boxes, aspect ratios, bounded candidate slots, nearby container context, source/lock/hidden flags and stack constraints. Candidates are guidance; choose semantic placement from the request and real layout. Does not navigate or mutate the canvas.',
    inputSchema: { projectId: idSchema, pageId: idSchema, nodeId: idSchema, includeSource: z.boolean().default(true), includeImagePlacement: z.boolean().default(false) },
    outputSchema: { projectId: idSchema, projectName: z.string(), revision: revisionSchema, boardId: idSchema, boardName: z.string(), pageId: idSchema, pageName: z.string(), nodeId: idSchema, sourceIncluded: z.boolean(), bounds: boundsSchema, tokens: tokensSchema, designSystem: z.object({ name: z.string(), tokens: z.array(designSystemTokenSchema) }), ancestors: z.array(contextNodeSchema), nodes: z.array(contextNodeSchema), threads: z.array(threadSchema), imagePlacement: imagePlacementSchema.optional() },
    annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, pageId, nodeId, includeSource, includeImagePlacement }) => {
    try {
      const context = nodeContext(await store.get(projectId), pageId, nodeId, includeSource, includeImagePlacement);
      return result(context, `Read ${context.nodes.length} focused layer(s) and ${context.ancestors.length} ancestor(s), revision ${context.revision}.`);
    } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_watch_project', {
    title: 'Watch live canvas changes', description: 'Wait up to ten seconds for a saved project revision newer than afterRevision. Return the complete project immediately when it changes; otherwise return an unchanged heartbeat without project data. The canvas app uses this to show committed frame and component batches while the assistant builds. This does not modify designs, history, or pane selection.',
    inputSchema: { projectId: idSchema, afterRevision: revisionSchema, delta: z.boolean().optional().describe('Return only what changed since afterRevision when that revision is still in history') },
    outputSchema: { projectId: idSchema, revision: revisionSchema, changed: z.boolean(), project: projectOutputSchema.optional(), delta: deltaOutputSchema.optional() }, annotations: readOnly,
    _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async ({ projectId, afterRevision, delta: wantsDelta }, { signal }) => {
    try {
      const project = await store.waitForChange(projectId, afterRevision, signal);
      const delta = project && wantsDelta ? await store.projectDelta(project, afterRevision) : undefined;
      return result({ projectId, revision: project?.revision ?? afterRevision, changed: !!project, ...(delta ? { delta } : project ? { project } : {}) }, project ? `Canvas updated to revision ${project.revision}.` : 'No saved canvas changes.');
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_list_versions', {
    title: 'List saved project versions', description: 'Read saved project version metadata, most recent revision first. Each save snapshots the entire application project, including all boards, source, shared tokens, and conversations. Existing projects begin with their current saved state as a baseline. This does not change the live canvas.',
    inputSchema: { projectId: idSchema }, outputSchema: { projectId: idSchema, versions: z.array(projectVersionSummarySchema) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try { const versions = await store.listVersions(projectId); return result({ projectId, versions }, `${versions.length} saved project version(s), most recent first.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_version', {
    title: 'Read a saved project version', description: 'Read a historical project snapshot and its version metadata without changing the live canvas. Returns historyPreview:true so clients keep it separate from current project state. Use it for comparison and context; restoration requires the user clicking Apply in History.',
    inputSchema: { projectId: idSchema, revision: revisionSchema }, outputSchema: { ...projectOutput, version: projectVersionSummarySchema, historyPreview: z.literal(true) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, revision }) => {
    try {
      const { project, version } = await store.getVersion(projectId, revision);
      return result({ project, version, historyPreview: true }, `Historical preview of ${project.name}, revision ${version.revision}. The live project is unchanged.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_list_library_versions', {
    title: 'List design system or component versions', description: 'Read immutable design-system history, or history of exactly one component with scope:component and componentId. Uses the existing project revision snapshots and named releases without nesting snapshots inside the design system. Old projects receive their existing library baseline. This never changes designs.',
    inputSchema: { projectId: idSchema, scope: libraryScopeSchema, componentId: idSchema.optional() }, outputSchema: { projectId: idSchema, versions: z.array(projectVersionSummarySchema) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, scope, componentId }) => {
    try { const versions = await store.listLibraryVersions(projectId, scope, componentId); return result({ projectId, versions }, `${versions.length} saved ${scope === 'system' ? 'design system' : 'component'} version(s).`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_library_version', {
    title: 'Read a design system or component version', description: 'Read a saved scoped library version for comparison without changing live data. Returns historical design-system tokens/documentation and the selected component when scope:component. Only the person clicking Apply can restore it.',
    inputSchema: { projectId: idSchema, revision: revisionSchema, scope: libraryScopeSchema, componentId: idSchema.optional() }, outputSchema: { designSystem: designSystemOutputSchema, version: projectVersionSummarySchema, component: componentOutputSchema.optional(), historyPreview: z.literal(true) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, revision, scope, componentId }) => {
    try { const saved = await store.getLibraryVersion(projectId, revision, scope, componentId); return result({ ...saved, historyPreview: true }, `Historical ${scope === 'system' ? 'design system' : 'component'} preview, revision ${revision}.`); } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_restore_library_version', {
    title: 'Apply a design system or component version', description: 'For the library Versions Apply button only, after the person explicitly selects and applies a saved scoped version. Restores only the design system or selected definition as a new project revision; retains other canvas work, comments and all history. Linked instances do not update automatically. A stale expectedRevision is rejected. Removing an in-use definition or deleting a commented/overridden instance member is rejected safely.',
    inputSchema: { projectId: idSchema, expectedRevision: revisionSchema, revision: revisionSchema, scope: libraryScopeSchema, componentId: idSchema.optional() }, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async ({ projectId, expectedRevision, revision, scope, componentId }) => {
    try { const project = await store.restoreLibraryVersion(projectId, expectedRevision, revision, scope, componentId); return result({ project }, `Applied ${scope === 'system' ? 'design system' : 'component'} revision ${revision}; current project revision is ${project.revision}.`); } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_restore_version', {
    title: 'Apply a saved project version', description: 'For the History panel Apply button only, after the user explicitly selects and applies a saved version. Restores the whole application project across all boards as a new revision, preserving all saved history. Requires the current expectedRevision; a stale Apply is rejected without changing the live project.',
    inputSchema: { projectId: idSchema, expectedRevision: revisionSchema, revision: revisionSchema }, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async ({ projectId, expectedRevision, revision }) => {
    try {
      const project = await store.restoreVersion(projectId, expectedRevision, revision);
      return result({ project }, `Applied saved revision ${revision} across ${project.name}; current revision is ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_edit_project', {
    title: 'Edit the canvas project', description: 'Atomically edit any application project, board, page, frame/component, code/source, style, shared design token, or comment thread with typed operations. For application UI, use canvas_write_react or update_react_files plus react bindings on frame/code nodes: real TSX/JSX modules, shared source and exact npm dependencies. Shadcn is optional. Native reconstruction is reserved for explicit layer/diagram/wireframe work. For that native mode, reconstruct imported screens as native frames with separately selectable child containers, controls, text and media; instantiate_component materializes reusable native descendants. Keep routes/source paths in notes, not placeholder artwork. Use the import-app guidance for existing-app population; whole-screen code/source is opaque to canvas selection. upsert_component {component} saves a validated independent library definition directly without creating a canvas instance or staging page; send version:0 and the server stamps the saved revision. Existing instances remain pinned and unrelated definitions are retained. set_component_notes {componentId,notes} updates only the definition root notes and stamps a new version while preserving current source and other component fields. Board operations create_board/update_board/delete_board manage subprojects. rename_project, update_board and delete_board require userConfirmed:true, set only after explicit user approval of the exact target and proposed change. Use canvas_delete_project to delete an entire project after consent. apply_design_system_document {markdown} atomically applies the current generated DESIGN.md name, description, raw documentation and Tokens table; preserve its section comments, stable --ds-<id> variables and protected component/source catalog. Token values propagate to explicit native bindings and source CSS variables across boards; custom styles remain independent. Use update_design_system for ordinary prose-only documentation patches. update_design_token {tokenId,patch} and update_inspiration {boardId,itemId,patch} update existing records without replacing untouched fields; sourceUrl:null clears an inspiration link. The editor autosaves valid field edits after typing or leaving the field, while creating, sending, releasing, restoring and exporting remain explicit actions. snap_node aligns a nearby free-positioned node using parent/sibling/canvas edge and center anchors; optional distance is 0–100 design units (default 8), with locked/hidden/stack positions protected. Set page.boardId when creating a page or update_page.patch.boardId to move one. expectedRevision must equal the latest project revision; a stale edit is rejected without changes. For new designs, save frame shells early with generation:{status:"building"}, then add coherent component groups in small batches so the open canvas updates throughout the build. Reuse each returned revision for the next batch. Before a design edit, mark the smallest affected canvas node generation:{status:"building"}, then mark that same node generation:{status:"ready"} after saving the work. For a component or section, do not mark its whole screen. For an internal source/React section without its own canvas node, set generation.region:{x,y,width,height} on the source node using observed local design-unit bounds and update the rectangle if layout changes. Do not guess bounds or mark answer-only/queued requests as building. The store timestamps actual work for the ASCII wipe; a building descendant takes precedence over its ancestor. Prefer focused node patches; replace_page deliberately replaces a page and should not hide ongoing generation until a final transaction. Deleting a board removes its pages and threads; deleting the last board is rejected. Returns projectId and revision, plus the complete saved project by default. Set includeProject:false for compact acknowledgements during progressive builds; chain the returned revision and read the full project again when needed.',
    inputSchema: {
      projectId: idSchema, expectedRevision: revisionSchema, operations: operationsSchema,
      includeProject: z.boolean().default(false).describe('Return the complete saved project. Usually unnecessary: chain the returned revision, and the live canvas receives the saved document separately.'),
      delta: z.boolean().optional().describe('Canvas editor use: return only the pages changed since expectedRevision'),
    },
    outputSchema: { projectId: idSchema, revision: revisionSchema, project: projectOutputSchema.optional(), delta: deltaOutputSchema.optional() },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }, _meta: appMetadata,
  }, async ({ projectId, expectedRevision, operations, includeProject, delta: wantsDelta }) => {
    try {
      const project = await store.mutate(projectId, expectedRevision, operations as Operation[]);
      const delta = wantsDelta ? await store.projectDelta(project, expectedRevision) : undefined;
      return result({ projectId, revision: project.revision, ...(delta ? { delta } : includeProject || wantsDelta ? { project } : {}) }, `Saved ${project.name}, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_prepare_canvas', {
    title: 'Check and reuse this chat’s canvas',
    description: 'Call before canvas_open_canvas. Check this conversation’s live canvas presence without opening a tab. If a pane is open, reuse it and optionally navigate it to projectId/boardId/pageId. Pass canvasInstanceId from this chat’s attached canvas context when available. Returns action:reuse, open, or wait; call canvas_open_canvas only for action:open. A quiet/suspended pane is unknown, never assumed closed. Never infer this chat’s pane from project recency or another chat.',
    inputSchema: { projectId: idSchema.optional(), boardId: idSchema.optional(), pageId: idSchema.optional(), canvasInstanceId: idSchema.optional() },
    outputSchema: { status: z.enum(['open', 'closed', 'unknown']), action: z.enum(['reuse', 'open', 'wait']), needsOpen: z.boolean(), canvasInstanceId: idSchema.optional(), selection: canvasSelectionSchema.nullable().optional(), requestedSelection: canvasSelectionSchema.optional(), navigation: z.enum(['unchanged', 'queued']).optional() },
    annotations: { ...readOnly, readOnlyHint: false }, _meta: appMetadata,
  }, async ({ projectId, boardId, pageId, canvasInstanceId }, { _meta }) => {
    try {
      const key = conversationSelectionKey(_meta), panes = canvasPanes(store), pane = panes.find(key, canvasInstanceId);
      if ((!pane || panes.status(pane) !== 'open') && panes.opening(key)) return result({ status: 'unknown', action: 'wait', needsOpen: false }, 'A canvas launch is already pending. Wait for its app context; do not call canvas_open_canvas again while it loads.');
      if (!pane) {
        const knownClosed = !!key && !canvasInstanceId;
        return result({ status: knownClosed ? 'closed' : 'unknown', action: knownClosed ? 'open' : 'wait', needsOpen: knownClosed }, knownClosed
          ? 'No canvas is registered for this conversation. Call canvas_open_canvas once with the intended target; do not repeat while it loads.'
          : 'Canvas presence is unknown. Reuse any attached canvas; do not open another tab based on missing presence. Pass its canvasInstanceId, or reopen only when the user says it is closed.');
      }
      const status = panes.status(pane);
      if (status !== 'open') return result({ status, action: status === 'closed' ? 'open' : 'wait', needsOpen: status === 'closed', canvasInstanceId: pane.id, selection: pane.selection }, status === 'closed'
        ? 'This canvas was closed. Call canvas_open_canvas once to reopen it.'
        : 'This canvas may be suspended. Keep the existing tab; a missing heartbeat is not evidence that it is closed.');
      const selectedId = projectId ?? pane.selection?.projectId;
      if (!selectedId && (boardId || pageId)) throw new StoreError(400, 'project_required', 'Choose a project before navigating to a board or page.');
      let target: CanvasSelection | undefined;
      if (selectedId && (projectId || boardId || pageId)) {
        const previous = pane.selection?.projectId === selectedId ? pane.selection : undefined;
        target = resolveSelection(await store.get(selectedId), {
          boardId: boardId ?? (pageId ? undefined : previous?.boardId),
          pageId: pageId ?? (!boardId || boardId === previous?.boardId ? previous?.pageId : undefined),
        });
      }
      const currentStatus = panes.status(pane);
      if (currentStatus !== 'open') return result({ status: currentStatus, action: currentStatus === 'closed' ? 'open' : 'wait', needsOpen: currentStatus === 'closed', canvasInstanceId: pane.id }, 'The canvas became unavailable while resolving the target. Follow the returned action; do not assume it is still open.');
      const navigation = target ? panes.navigate(pane, target) : 'unchanged';
      return result({ status, action: 'reuse', needsOpen: false, canvasInstanceId: pane.id, selection: pane.selection, ...(target ? { requestedSelection: target } : {}), navigation }, navigation === 'queued'
        ? 'Navigation queued in the existing canvas. Do not call canvas_open_canvas; the same pane will load this target.'
        : 'The canvas is already open. Continue reading/editing without calling canvas_open_canvas.');
    } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_sync_presence', {
    title: 'Keep this canvas available for reuse', description: 'App-only presence and navigation channel. Registers this mounted pane, waits for navigation, and reports closure without editing any design. Missing heartbeats are not treated as a closed tab.',
    inputSchema: { instanceId: idSchema, scope: z.enum(['thread', 'library']), selection: canvasSelectionSchema.nullable(), active: z.boolean(), closed: z.boolean(), sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), acknowledgedNavigationId: idSchema.optional(), waitMs: z.number().int().min(0).max(10000).default(10000) },
    outputSchema: { tracked: z.boolean(), navigation: z.object({ id: idSchema, selection: canvasSelectionSchema }).optional() },
    annotations: { ...readOnly, readOnlyHint: false },
    _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async (input, { _meta, signal }) => {
    try { return result(await canvasPanes(store).sync(input, conversationSelectionKey(_meta), signal), 'Canvas presence synchronized.'); }
    catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_open_canvas', {
    title: 'Codex Design canvas', description: 'Create a canvas pane only when it is not already open. In embedded Codex, call canvas_prepare_canvas first and invoke this launcher only for action:open, or when the user explicitly confirms the canvas is closed. Do not call again for edits, completion, or board/page changes: canvas_prepare_canvas navigates the existing pane. This resource-associated launcher can create a host tab on every call. Use this conversation’s projectId/boardId and optional pageId. Without IDs restore only its saved selection or show a chooser; never use global project recency. Standalone browser connections use this launcher directly.',
    inputSchema: { projectId: idSchema.optional(), boardId: idSchema.optional(), pageId: idSchema.optional() },
    outputSchema: { canvasScope: z.literal('thread'), canvasLaunchId: idSchema, canvasTargetExplicit: z.boolean(), needsSelection: z.literal(true).optional(), project: projectOutputSchema.optional(), projectId: idSchema.optional(), boardId: idSchema.optional(), pageId: idSchema.optional(), projects: z.array(projectSummarySchema).optional(), standaloneUrl: z.string().optional() }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: options.browser ? appMetadata : { ...appMetadata, ui: { resourceUri: CANVAS_RESOURCE_URI, visibility: ['model', 'app'] }, 'openai/ui': { entrypoints: [{ type: 'thread' }] }, 'openai/outputTemplate': CANVAS_RESOURCE_URI, 'openai/toolInvocation/invoking': 'Opening this chat’s canvas', 'openai/toolInvocation/invoked': 'Canvas ready' },
  }, async ({ projectId, boardId, pageId }, { _meta }) => {
    try {
      const canvasLaunchId = randomUUID();
      const key = conversationSelectionKey(_meta);
      const saved = key ? await store.getCanvasSelection(key) : null;
      const selectedId = projectId ?? saved?.projectId;
      if (!selectedId) {
        if (boardId || pageId) throw new StoreError(400, 'project_required', 'Choose a project before opening a board or page.');
        const projects = await store.list();
        if (!options.browser) canvasPanes(store).reserveLaunch(key);
        return openCanvasResult({ canvasScope: 'thread', canvasLaunchId, canvasTargetExplicit: false, needsSelection: true, projects }, 'Choose or create a project for this conversation’s canvas. No project is bound to this chat yet.', options.browser ? options.baseUrl : undefined);
      }
      const project = await store.get(selectedId);
      const previous = saved?.projectId === selectedId ? saved : undefined;
      const selection = resolveSelection(project, {
        boardId: boardId ?? (pageId ? undefined : previous?.boardId),
        pageId: pageId ?? (!boardId || boardId === previous?.boardId ? previous?.pageId : undefined),
      });
      if (key) await store.setCanvasSelection(key, selection);
      const board = project.boards.find(board => board.id === selection.boardId)!;
      const standaloneUrl = options.baseUrl ? `${options.baseUrl.replace(/\/$/, '')}/?project=${encodeURIComponent(project.id)}&board=${encodeURIComponent(board.id)}${selection.pageId ? `&page=${encodeURIComponent(selection.pageId)}` : ''}` : undefined;
      if (!options.browser) canvasPanes(store).reserveLaunch(key);
      return openCanvasResult({ canvasScope: 'thread', canvasLaunchId, canvasTargetExplicit: !!(projectId || boardId || pageId), project, ...selection, ...(standaloneUrl ? { standaloneUrl } : {}) }, `Opened ${project.name} / ${board.name} for this conversation, revision ${project.revision}.`, standaloneUrl);
    } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_open_app', {
    title: 'Codex Design', description: 'Open the global Codex Design project browser from the app sidebar. This launcher has its own selection and does not select a canvas for another conversation. Conversation design work uses canvas_open_canvas.',
    inputSchema: {}, outputSchema: { canvasScope: z.literal('library'), canvasLaunchId: idSchema, needsSelection: z.literal(true), projects: z.array(projectSummarySchema) }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: CANVAS_RESOURCE_URI, visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private', 'openai/ui': { entrypoints: [{ type: 'global' }] }, 'openai/outputTemplate': CANVAS_RESOURCE_URI },
  }, async () => {
    try { return result({ canvasScope: 'library', canvasLaunchId: randomUUID(), needsSelection: true, projects: await store.list() }, 'Choose a project to browse in Codex Design.'); } catch (error) { return toolError(error); }
  });

  if (!options.browser) server.registerTool('canvas_set_selection', {
    title: 'Remember this canvas selection', description: 'Remember the project, board and page chosen in this conversation’s canvas. Stores a private UI preference without editing the design or creating a history revision. Hosts without a conversation identity retain selection through the pane’s app context instead.',
    inputSchema: canvasSelectionSchema.shape, outputSchema: { saved: z.boolean(), selection: canvasSelectionSchema },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async (selection, { _meta }) => {
    try {
      const selected = resolveSelection(await store.get(selection.projectId), selection);
      const key = conversationSelectionKey(_meta);
      if (key) await store.setCanvasSelection(key, selected);
      return result({ saved: !!key, selection: selected }, key ? 'Remembered this conversation’s canvas selection.' : 'Canvas selection is retained by this pane’s app context.');
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_pending_comments', {
    title: 'Read queued design comments', description: 'Find open component or canvas threads queued for Codex. Returns complete threads with project, board, page, and node anchors and current revisions. Each request includes a bounded target snapshot, hierarchy, source excerpt, user message and a focused context read. Image requests marked intent:generate_image include native image-generation and placement instructions. Ordinary image-generation requests should also use the native image tool and focused image placement context. Omit projectId to check all projects. Read focused context or the project before applying changes.',
    inputSchema: { projectId: idSchema.optional() },
    outputSchema: { comments: z.array(z.object({ projectId: idSchema, projectName: z.string(), revision: revisionSchema, boardId: idSchema, boardName: z.string(), pageName: z.string(), nodeName: z.string().nullable(), thread: threadSchema, request: z.string().optional() })) },
    annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try {
      const projects: DesignProject[] = projectId ? [await store.get(projectId)] : await Promise.all((await store.list()).map(({ id }) => store.get(id)));
      const comments = projects.flatMap(project => project.threads.filter(thread => thread.queued && thread.status === 'open').map(thread => {
        const page = project.pages.find(page => page.id === thread.pageId);
        const board = project.boards.find(board => board.id === page?.boardId) ?? project.boards[0];
        return { projectId: project.id, projectName: project.name, revision: project.revision, boardId: board.id, boardName: board.name, pageName: page?.name ?? '', nodeName: page?.nodes.find(node => node.id === thread.nodeId)?.name ?? null, thread, request: commentPrompt(project, thread) };
      }));
      return result({ comments }, `${comments.length} queued design thread(s).`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_reply_to_comment', {
    title: 'Reply to a design thread', description: 'Append an assistant reply to an anchored thread after acting on or answering the user request, and clear its queued flag. Optionally resolve the thread. Requires the latest project expectedRevision. This records an actual assistant response; it does not generate one.',
    inputSchema: { projectId: idSchema, expectedRevision: revisionSchema, threadId: idSchema, content: messageSchema.shape.content, resolve: z.boolean().default(false) }, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async ({ projectId, expectedRevision, threadId, content, resolve }) => {
    try {
      const operations: Operation[] = [{ type: 'add_message', threadId, message: { id: randomUUID(), role: 'assistant', content, createdAt: new Date().toISOString() }, queued: false }];
      if (resolve) operations.push({ type: 'update_thread', threadId, patch: { status: 'resolved' } });
      const project = await store.mutate(projectId, expectedRevision, operations);
      return result({ project }, `Replied to thread ${threadId}; project revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_import_project', {
    title: 'Import a design project', description: 'Import complete Codex Design project JSON or a version-1 codex-design-library envelope as a separate saved project, preserving boards, pages, nodes, source code, shared tokens, and anchored threads. Legacy documents without boards receive a Main board. The imported structure is validated before saving. Imports start a new history baseline; current component links are rebased, while outdated instances whose release history is absent are detached with their native appearance and conversations intact.',
    inputSchema: { project: projectImportSchema }, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async ({ project: input }) => {
    try { const project = await store.importProject(input); return result({ project }, `Imported ${project.name} (${project.id}).`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_export_project', {
    title: 'Export design and implementation handoff', description: 'Optional state:{frameId,scenarioId,values} resolves a static scenario with no inspection highlights and no saved mutation. Read scoped source files for a project, board, page or selected node subtree(s). Supply pageId with nodeIds for a selection; boardId, when supplied, must match the page. format supports source, html, react, passive svg or spatial svg-map. Use format library without board/page/node scope for the project design system and reusable components, or componentId for one definition with its shared tokens. Library files follow the imported design-system reference: DESIGN.md, COMPONENTS.md, named JSX, sibling .d.ts/.prompt.md, CSS and passive @dsCard HTML, plus versioned editable JSON. Import its JSON with canvas_import_project to initialize a new project. Read assets/assetPaths and save the media bytes alongside these files. svg-map preserves page/selection canvas positions and embeds image assets; map controls background, scale, labels and margin. For complete .cxdp, PNG or JPEG files use format cxdp/png/jpeg with optional image settings and expectedRevision; the response file handle is saved with canvas_save_export or canvas_read_export_chunk. Images use isolated Chrome/Chromium. The default remains page HTML when pageId is supplied, otherwise the source bundle. Media bytes are not duplicated into this response: assets metadata and assetPaths tell the caller which authenticated canvas_read_asset_chunk references to save alongside the files. The caller chooses where to save files.',
    inputSchema: { projectId: idSchema, boardId: idSchema.optional(), pageId: idSchema.optional(), nodeIds: z.array(idSchema).min(1).max(100).optional(), format: z.enum(['source', 'html', 'react', 'svg', 'svg-map', 'png', 'jpeg', 'cxdp', 'project', 'library']).optional(), componentId: idSchema.optional(), image: imageSettingsSchema.optional(), expectedRevision: revisionSchema.optional(), map: canvasMapSettingsSchema.optional(), state: z.object({frameId:idSchema,scenarioId:idSchema.optional(),values:stateValuesSchema.default({})}).strict().optional() },
    outputSchema: { projectId: idSchema, revision: revisionSchema, boardId: idSchema.optional(), file: z.object({exportId:z.string(),name:z.string(),mimeType:z.string(),byteLength:z.number(),sha256:z.string(),expiresAt:z.string()}).passthrough().optional(), files: z.record(z.string()), assets: z.array(assetMetadataSchema), assetPaths: z.record(z.string()), map: z.object({ width: z.number(), height: z.number(), pixelWidth: z.number(), pixelHeight: z.number(), warnings: z.array(z.string()) }).optional() }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, boardId, pageId, nodeIds, format, componentId, image, expectedRevision, map, state }) => {
    try {
      if (format === 'cxdp' || format === 'project' || format === 'png' || format === 'jpeg') {
        const file = await prepareFileExport(store, {projectId,expectedRevision,boardId,pageId,nodeIds,componentId,format:format === 'project' ? 'cxdp' : format,image:image ?? map,state});
        return result({projectId,revision:file.revision,files:{},assets:[],assetPaths:{},file}, `Prepared ${file.name} (${file.byteLength} bytes). Save with canvas_save_export or read canvas_read_export_chunk.`);
      }
      if (nodeIds && !pageId) throw new StoreError(400, 'invalid_export_scope', 'Selection export requires pageId and nodeIds.');
      let project = await store.get(projectId);
      if(state){
        if(!pageId || ['source','library'].includes(format??'')) throw new StoreError(400,'invalid_state_export','A state export needs pageId and a static format such as html or react. Editable source/library exports preserve base design and all state definitions.');
        const preview=resolveState(project,pageId,state);
        project={...project,pages:project.pages.map(page=>page.id===pageId?{...page,nodes:preview.nodes}:page)};
      }
      if (format === 'library') {
        if (boardId || pageId || nodeIds) throw new StoreError(400, 'invalid_export_scope', 'Library export is project-wide; use componentId for one reusable definition.');
        const portable = libraryProject(project, componentId);
        const assets = await Promise.all(projectAssetRefs(portable).map(ref => store.getAsset(ref)));
        const assetUrls = Object.fromEntries(assets.map(asset => [asset.ref, `assets/${assetFilename(asset)}`]));
        const files = exportLibrary(project, { assetUrls }, componentId).files;
        files['manifest.json'] = JSON.stringify({ format: 'codex-design-archive', version: 1, kind: 'library', projectId, revision: project.revision, assets: assets.map(asset => ({ ...asset, path: assetUrls[asset.ref] })) }, null, 2);
        return result({ projectId, revision: project.revision, files, assets, assetPaths: Object.fromEntries(Object.entries(assetUrls).map(([ref, path]) => [path, ref])) }, `Exported ${portable.designSystem.components.length} component definitions and the shared design system from ${project.name}. Import the library ZIP or versioned JSON to initialize a separate project.`);
      }
      if (componentId) throw new StoreError(400, 'invalid_export_scope', 'componentId is available with format library.');
      const target: ExportTarget = { scope: nodeIds ? 'selection' : pageId ? 'page' : boardId ? 'board' : 'project', boardId, pageId, nodeIds };
      const scoped = exportTargetProject(project, target);
      const selectedFormat = format || (pageId ? 'html' : 'source');
      if (selectedFormat === 'svg-map') {
        const imageRefs = new Set(scoped.pages.flatMap(page => page.nodes.flatMap(node => node.type === 'image' ? [node.media?.src] : node.type === 'video' ? [node.media?.poster] : []).filter(isAssetRef)));
        const embeddedUrls: Record<string, string> = {};
        let mediaBytes = 0;
        for (const ref of imageRefs) {
          const asset = await store.getAsset(ref), chunks: Buffer[] = [];
          mediaBytes += asset.byteLength;
          if (mediaBytes > 48 * 1024 * 1024) throw new StoreError(413, 'export_too_large', 'Canvas-map media exceeds 48 MiB. Export a smaller scope or use fewer image assets.');
          for (let offset = 0; offset < asset.byteLength;) {
            const chunk = await store.readAssetChunk({ ref, offset });
            if (chunk.byteLength < 1) throw new StoreError(500, 'corrupt_asset', 'A canvas-map asset returned an empty byte range.');
            chunks.push(Buffer.from(chunk.data, 'base64')); offset += chunk.byteLength;
          }
          embeddedUrls[ref] = `data:${asset.mimeType};base64,${Buffer.concat(chunks).toString('base64')}`;
        }
        const exported = exportCanvasMap(project, target, map, { assetUrls: embeddedUrls });
        const { svg, ...dimensions } = exported;
        return result({ projectId, revision: project.revision, ...(boardId ? { boardId } : {}), files: { 'canvas-map.svg': svg }, assets: [], assetPaths: {}, map: dimensions }, `Exported ${exported.width} × ${exported.height} canvas-map SVG from ${project.name}.${exported.warnings.length ? ` ${exported.warnings.join(' ')}` : ''}`);
      }
      const mediaScope = selectedFormat === 'source' ? scoped : { ...scoped, boards: scoped.boards.map(board => ({ ...board, inspiration: undefined })) };
      const assets = await Promise.all(projectAssetRefs(mediaScope).map(ref => store.getAsset(ref)));
      const assetUrls = Object.fromEntries(assets.map(asset => [asset.ref, `assets/${assetFilename(asset)}`]));
      const assetPaths = Object.fromEntries(Object.entries(assetUrls).map(([ref, filename]) => [filename, ref]));
      let files: Record<string, string>;
      if (selectedFormat === 'react') files = exportTargetReact(project, target, { assetUrls }).files;
      else if (selectedFormat === 'svg') files = { 'selection.svg': exportTargetSvg(project, target) };
      else if (selectedFormat === 'html') files = { [nodeIds ? 'selection.html' : `${pageId}.html`]: exportTargetHtml(project, target, { assetUrls }) };
      else {
        files = exportProjectBundle(scoped, { assetUrls }).files;
        if (nodeIds) Object.assign(files, { 'selection.html': exportTargetHtml(project, target, { assetUrls }), 'original-scope.json': JSON.stringify(exportTargetProject(project, target, { originalSelectionLayout: true }), null, 2) }, exportTargetReact(project, target, { assetUrls }).files);
        files['manifest.json'] = JSON.stringify({ format: 'codex-design-archive', version: 1, kind: 'source', projectId, revision: project.revision, target, assets: assets.map(asset => ({ ...asset, path: assetUrls[asset.ref] })) }, null, 2);
      }
      if (state) files['application-state.json']=JSON.stringify({projectId,revision:project.revision,pageId,...state},null,2);
      if (selectedFormat === 'source' || selectedFormat === 'react') Object.assign(files, libraryReferenceFiles(project, { assetUrls }));
      return result({ projectId, revision: project.revision, ...(boardId ? { boardId } : {}), files, assets, assetPaths }, `Exported ${Object.keys(files).length} source file(s) and ${assets.length} media reference(s) from ${project.name}, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  registerExportTools(server, store, options.allowExportFiles === true);
  return server;
}
