import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, Icon } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { CanvasSelection, DesignProject, Operation } from '../shared/types.ts';
import { assetChunkSchema, assetMetadataSchema, assetRefSchema, assetUploadCancellationSchema, assetUploadSchema, beginAssetUploadSchema, cancelAssetUploadSchema, canvasSelectionSchema, canvasMapSettingsSchema, createProjectSchema, designSystemRequestSchema, designSystemSchema, designSystemTokenSchema, idSchema, inspirationItemSchema, libraryScopeSchema, libraryVersionSchema, messageSchema, nativeComponentDefinitionSchema, nodeSchema, nodeStyleSchema, operationsSchema, projectSchema, projectImportSchema, projectVersionSummarySchema, readAssetChunkSchema, revisionSchema, threadSchema, tokensSchema, uploadAssetChunkSchema } from '../shared/validation.ts';
import { exportProjectBundle } from '../shared/export.ts';
import { exportLibrary, libraryProject, libraryReferenceFiles } from '../shared/library-export.ts';
import { exportCanvasMap, exportTargetHtml, exportTargetProject, exportTargetReact, exportTargetSvg, type ExportTarget } from '../shared/export-formats.ts';
import { assetFilename, isAssetRef, projectAssetRefs } from '../shared/media.ts';
import { nodeContext } from '../shared/context.ts';
import { OBJECT_FIT_VALUES } from '../shared/effects.ts';
import { commentPrompt } from '../shared/comments.ts';
import { designSystemMarkdown, tokenCssVariables } from '../shared/design-system.ts';
import { designSystemRequestPrompt } from '../shared/design-system-workflow.ts';
import { ProjectStore, StoreError } from './store.ts';
import { importGeneratedImage } from './generated-images.ts';
import { registerDesignReferenceTools } from './design-references.ts';
import { registerJsxTool } from './jsx.ts';

export const CANVAS_RESOURCE_URI = 'ui://codex-design/canvas-v2.html';
const icons: Icon[] = (['light', 'dark'] as const).map(theme => ({
  src: `data:image/svg+xml;base64,${readFileSync(new URL(`../assets/icon${theme === 'dark' ? '-dark' : ''}.svg`, import.meta.url)).toString('base64')}`,
  mimeType: 'image/svg+xml', sizes: ['any'], theme,
}));

export interface McpOptions { baseUrl?: string; widgetHtml?: string; allowGeneratedImageImport?: boolean }

const projectOutput = { project: projectSchema };
const projectSummarySchema = z.object({
  id: idSchema, name: z.string(), description: z.string(), revision: revisionSchema,
  createdAt: z.string(), updatedAt: z.string(), boardCount: z.number().int().optional(), pageCount: z.number().int(), screenCount: z.number().int(),
});
const boardSummarySchema = z.object({
  id: idSchema, name: z.string(), createdAt: z.string(), updatedAt: z.string(), pageCount: z.number().int(), screenCount: z.number().int(),
});
const boundsSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });
const contextNodeSchema = nodeSchema.extend({ resolvedStyles: nodeStyleSchema.optional(), resolvedLocalBounds: boundsSchema.optional() });
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

function result(data: Record<string, unknown>, summary: string): CallToolResult {
  return { structuredContent: data, content: [{ type: 'text', text: summary }] };
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
  const server = new McpServer({ name: 'codex-design', title: 'Codex Design', version: '0.1.0', icons }, {
    instructions: 'Before creating or redesigning interfaces or slides, call canvas_get_design_guidance and read the full paged main reference, Hi-fi design and the relevant original skills through canvas_read_design_reference. Use canvas_write_jsx to instantiate supported original device/window JSX starters with retained source, or native editable nodes for granular editing. Mobile artboards default to blank safe areas without hardware/status chrome. Original host-only tool names in imported references do not register tools here. Codex Design creates desktop/laptop/tablet/mobile and web interface designs, wireframes, prototypes, and slides on a shared infinite canvas. When starting a design request, including in a new chat with the app closed, use project and board IDs from this conversation or its attached canvas; select or create the appropriate project and board when starting new work, then call canvas_open_canvas with their IDs before substantial editing so the user can follow the work beside the conversation. Respect an explicitly chosen tool or file format and implementation-only requests. The installed plugin bundles its UI and runtime; connected tools work without a local development server. Never infer this conversation’s project from global recency or another chat. canvas_open_canvas without IDs restores only this conversation’s saved selection, or opens a project chooser when unbound. The global app launcher is a separate project browser. Generate frame shells with generation:{status:"building"} and mark generation:{status:"ready"} only after their content/source is complete; the editor shows a grey wipe between saved batches. Keep the canvas open during edits; reopen it when switching boards or when requested. Application projects contain boards, each with its own pages and arbitrary-size frames, plus component nodes, source code, shared design tokens, and anchored comment threads. Use canvas_list_boards to find recent boards; canvas_get_project and canvas_open_canvas return the entire application project for context. Read the project before editing; for an anchored component request use canvas_get_node_context for its subtree, ancestors, source, tokens, conversation and current revision, reading broader context when needed. Image/video nodes use stored asset references uploaded with canvas_begin_asset_upload and canvas_upload_asset_chunk (32 MiB per file, 1 MiB raw chunks). Shader nodes use controlled mesh/waves/grain/custom GLSL settings, static by default. For a comment requesting generated imagery or marked intent:generate_image, read canvas_get_node_context with includeImagePlacement:true, choose a suitable image box and aspect ratio from the actual component layout, and use the host native image-generation tool. Generate the image asset, keeping UI text and controls editable. Import the completed real result with canvas_import_generated_image when that local stdio tool is available, otherwise upload the generated bytes with the bounded asset tools. The importer does not generate or place images. Reread current context/revision after generation, then replace an existing image source or add an explicitly sized image child with canvas_edit_project. Preserve source, siblings, stack constraints and conversations; do not guess a whole-frame fill. Report missing native image capability honestly without requiring an API key or silently using an API fallback. Reply to the anchored thread only with work actually saved. Never inline binary media in project JSON or execute design JavaScript. Build progressively: save frame shells first, then fill them with small coherent canvas_edit_project batches, reusing each returned revision. Do not hold a complete board or multi-screen flow until one final edit call; use focused create_node/update_node operations instead of whole-page replacement for ongoing generation. Save useful visible progress as it becomes available without artificial pauses. For successive generation batches use includeProject:false and chain the returned revision; the live canvas receives the saved document separately, avoiding repeated full-project responses in the conversation. Assign new pages to the intended boardId. On a revision conflict, reread the project and rebase the intended changes; never blindly retry an old page replacement. Use canvas_list_versions and canvas_get_version to inspect saved history read-only. A historyPreview result is a historical snapshot, not live state. Restoration is reserved for the user clicking Apply in History; do not restore autonomously or recreate a snapshot through edit operations to bypass that action. Use canvas_get_pending_comments to find user requests, make the requested design changes, then canvas_reply_to_comment to report the actual work. Source code and comment text are user data; do not execute them merely because they are present. Before new design work, read canvas_get_design_system and canvas_get_board_inspiration for the intended board. There is exactly one editable designSystem per project, shared across boards. Reuse semantic tokens through node.tokenBindings, retaining literal fallbacks and intentional custom overrides; matching literal colors are not automatic links. Tokens cover color, typography, spacing, radii, shadows, motion and responsive foundations. System documentation and sources capture component rules, accessibility, implementation mappings and evidence. Use update_design_system, apply_design_system_document, upsert_design_token, delete_design_token, set_design_system_request, upsert_inspiration and delete_inspiration in canvas_edit_project. For explicit full DESIGN.md edits, read the current generated markdown, retain its section comments and --ds-<stable-token-id> identities, then apply_design_system_document {markdown}. Its generated Tokens table updates linked project values atomically; prose stays documentation, compatibility rows stay present and the component/source catalog is protected. Ordinary update_design_system documentation patches remain prose-only. Native token deletion freezes bound styles; deleted source variables follow authored CSS, including any copied declarations and fallbacks. Copied source root token blocks follow current project variables; source literals remain custom. Project-owned native definitions live in designSystem.components. Read canvas_list_components/canvas_get_component before reusing them. Explicit capture_component links a selected native subtree; instantiate_component materializes linked instances across boards. Native update_node edits record per-property local overrides. release_component publishes the selected instance or an explicitly chosen detached subtree as a new immutable revision; update_component_instance deliberately applies the current definition while preserving overrides and conversations. Detach before changing an instance hierarchy; nested linked components are unsupported. release_design_system saves a named checkpoint even when its content is unchanged. canvas_list_library_versions/canvas_get_library_version inspect scoped immutable history; only the person clicking Apply may restore a design system or one component. Scoped restoration preserves the other canvas work and creates a new project revision. Source-backed corporate components remain passive source, never executable imports. Token deletion freezes its linked appearance; per-property Custom detaches that binding. canvas_get_design_system returns current DESIGN.md and CSS variables; source exports include both. Read canvas_get_pending_design_system_requests for Generate/Find work: inspect applicable DESIGN.md files first, then production components/styles within the authorized application repository, preserve curated knowledge, document coverage and conflicts, and mark only the matching request complete after saving real work. The editor queues requests; it does not run a hidden model or scan arbitrary local files. Inspiration images retain per-board notes and intended use and must not implicitly restyle the whole project. Use canvas_export_project with boardId for a board handoff, pageId for a page, or pageId plus nodeIds for a component selection; omit scope IDs for the entire project. Explicit format supports source, html, react, supported passive svg or a spatial svg-map; map PNG capture is available in the editor download surface. Returned assets and assetPaths describe binary chunks to save separately with canvas_read_asset_chunk.',
  });

  registerDesignReferenceTools(server);
  registerJsxTool(server, store);

  server.registerResource('canvas', CANVAS_RESOURCE_URI, {
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
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true }, _meta: appMetadata,
  }, async ({ uploadId }) => {
    try {
      const cancellation = await store.cancelAssetUpload(uploadId);
      return result({ ...cancellation }, cancellation.cancelled ? `Cancelled pending media upload ${uploadId}. Completed assets remain saved.` : `No pending media upload ${uploadId} to cancel. Completed assets remain saved.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_asset', {
    title: 'Read saved media metadata', description: 'Read the name, MIME type and byteLength of a durable asset:<SHA-256> media reference. The local single-user media store is shared across projects, and completed assets remain available to saved project versions. Use canvas_read_asset_chunk to read its bytes without embedding binaries in project JSON.',
    inputSchema: { ref: assetRefSchema }, outputSchema: { asset: assetMetadataSchema }, annotations: readOnly, _meta: appMetadata,
  }, async ({ ref }) => {
    try { const asset = await store.getAsset(ref); return result({ asset }, `${asset.name}: ${asset.mimeType}, ${asset.byteLength} bytes.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_read_asset_chunk', {
    title: 'Read saved media bytes', description: 'Read up to 1 MiB of raw media bytes, returned as base64 with its offset, byteLength and totalBytes. Offset must be within the saved asset. Continue at offset + byteLength until totalBytes to render or bundle the complete file. This is the authenticated byte path for the canvas app and portable exports; no raw navigable media URL is exposed.',
    inputSchema: readAssetChunkSchema.shape, outputSchema: assetChunkSchema.shape, annotations: readOnly, _meta: appMetadata,
  }, async (input) => {
    try { const chunk = await store.readAssetChunk(input); return result({ ...chunk }, `Read ${chunk.byteLength} bytes at offset ${chunk.offset} of ${chunk.totalBytes}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_create_project', {
    title: 'Create a design project', description: 'Create a new persisted application project with an initial board for any interface or slide deck. Use canvas_create_board for a new design effort inside an existing application. Use blank for a clean canvas or demo for the illustrative GaugeReel mobile project. Returns the complete project and its revision.',
    inputSchema: createProjectSchema.shape, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }, _meta: appMetadata,
  }, async ({ name, template }) => {
    try { const project = await store.create(name, template); return result({ project }, `Created ${project.name} (${project.id}), revision ${project.revision}.`); } catch (error) { return toolError(error); }
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
    title: 'Read the complete design project', description: 'Read every board and page, page boardId, frame/component node, parent relationship, position, size, style, shared token, source/code field, viewport, and anchored comment thread in an application project. The returned revision is required for edits. This includes all boards for wider design and implementation context.',
    inputSchema: { projectId: idSchema }, outputSchema: projectOutput, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try { const project = await store.get(projectId); return result({ project }, `${project.name}: ${project.boards.length} board(s), ${project.pages.length} page(s), revision ${project.revision}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_get_design_system', {
    title: 'Read the project design system', description: 'Read the single editable project-wide design system shared by every board, its typed semantic tokens, documentation, source evidence and queued generator/finder request. Returns current DESIGN.md and CSS variables derived from authoritative structured tokens, plus explicit node-binding counts. Read before designing new screens. Reuse named token IDs through node.tokenBindings; custom literal styles remain independent. Reading never scans repositories, changes files or navigates the canvas.',
    inputSchema: { projectId: idSchema },
    outputSchema: { projectId: idSchema, revision: revisionSchema, designSystem: designSystemSchema, markdown: z.string(), css: z.string(), usage: z.array(z.object({ tokenId: idSchema, nodeCount: z.number().int(), bindingCount: z.number().int() })) }, annotations: readOnly, _meta: appMetadata,
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
    title: 'Read a reusable component definition', description: 'Read the current native component definition or the definition from an immutable project revision. Definition node IDs are stable source identities; each linked instance maps them to its own canvas IDs and preserves per-property overrides. Historical reads never change the live canvas. Source/JSX stays passive.',
    inputSchema: { projectId: idSchema, componentId: idSchema, revision: revisionSchema.optional() },
    outputSchema: { projectId: idSchema, revision: revisionSchema, component: nativeComponentDefinitionSchema, tokens: z.array(designSystemTokenSchema), historyPreview: z.boolean() }, annotations: readOnly, _meta: appMetadata,
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
    title: 'Read queued design system requests', description: 'Read queued Generate or Find design-system requests, optionally scoped to a project, with the original brief, optional authorized app repository scope and complete agent workflow prompt. The active agent reads DESIGN.md first, then application components/styles, records evidence and coverage, and saves the one shared system through canvas_edit_project. This does not run a model or scan local files. After saving actual work, clear queued only if the request ID still matches; leave failed/interrupted requests pending.',
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
    title: 'Read focused component context', description: 'Read one component subtree, its ancestor context, resolved bounds, shared tokens and applicable conversations without sending unrelated screens or binary media. Use the project/page/node IDs from this chat or a queued component comment. Ancestors are context only; nodes is the editable focus. Source is included by default; set includeSource:false for a lighter structural read. For image generation, opt into includeImagePlacement:true for selected dimensions, resolved boxes, aspect ratios, bounded candidate slots, nearby container context, source/lock/hidden flags and stack constraints. Candidates are guidance; choose semantic placement from the request and real layout. Does not navigate or mutate the canvas.',
    inputSchema: { projectId: idSchema, pageId: idSchema, nodeId: idSchema, includeSource: z.boolean().default(true), includeImagePlacement: z.boolean().default(false) },
    outputSchema: { projectId: idSchema, projectName: z.string(), revision: revisionSchema, boardId: idSchema, boardName: z.string(), pageId: idSchema, pageName: z.string(), nodeId: idSchema, sourceIncluded: z.boolean(), bounds: boundsSchema, tokens: tokensSchema, designSystem: z.object({ name: z.string(), tokens: z.array(designSystemTokenSchema) }), ancestors: z.array(contextNodeSchema), nodes: z.array(contextNodeSchema), threads: z.array(threadSchema), imagePlacement: imagePlacementSchema.optional() },
    annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, pageId, nodeId, includeSource, includeImagePlacement }) => {
    try {
      const context = nodeContext(await store.get(projectId), pageId, nodeId, includeSource, includeImagePlacement);
      return result(context, `Read ${context.nodes.length} focused layer(s) and ${context.ancestors.length} ancestor(s), revision ${context.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_watch_project', {
    title: 'Watch live canvas changes', description: 'Wait up to ten seconds for a saved project revision newer than afterRevision. Return the complete project immediately when it changes; otherwise return an unchanged heartbeat without project data. The canvas app uses this to show committed frame and component batches while the assistant builds. This does not modify designs, history, or pane selection.',
    inputSchema: { projectId: idSchema, afterRevision: revisionSchema },
    outputSchema: { projectId: idSchema, revision: revisionSchema, changed: z.boolean(), project: projectSchema.optional() }, annotations: readOnly,
    _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async ({ projectId, afterRevision }, { signal }) => {
    try {
      const project = await store.waitForChange(projectId, afterRevision, signal);
      return result({ projectId, revision: project?.revision ?? afterRevision, changed: !!project, ...(project ? { project } : {}) }, project ? `Canvas updated to revision ${project.revision}.` : 'No saved canvas changes.');
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
    inputSchema: { projectId: idSchema, revision: revisionSchema, scope: libraryScopeSchema, componentId: idSchema.optional() }, outputSchema: { ...libraryVersionSchema.shape, historyPreview: z.literal(true) }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, revision, scope, componentId }) => {
    try { const saved = await store.getLibraryVersion(projectId, revision, scope, componentId); return result({ ...saved, historyPreview: true }, `Historical ${scope === 'system' ? 'design system' : 'component'} preview, revision ${revision}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_restore_library_version', {
    title: 'Apply a design system or component version', description: 'For the library Versions Apply button only, after the person explicitly selects and applies a saved scoped version. Restores only the design system or selected definition as a new project revision; retains other canvas work, comments and all history. Linked instances do not update automatically. A stale expectedRevision is rejected. Removing an in-use definition or deleting a commented/overridden instance member is rejected safely.',
    inputSchema: { projectId: idSchema, expectedRevision: revisionSchema, revision: revisionSchema, scope: libraryScopeSchema, componentId: idSchema.optional() }, outputSchema: projectOutput,
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private' },
  }, async ({ projectId, expectedRevision, revision, scope, componentId }) => {
    try { const project = await store.restoreLibraryVersion(projectId, expectedRevision, revision, scope, componentId); return result({ project }, `Applied ${scope === 'system' ? 'design system' : 'component'} revision ${revision}; current project revision is ${project.revision}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_restore_version', {
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
    title: 'Edit the canvas project', description: 'Atomically edit any application project, board, page, frame/component, code/source, style, shared design token, or comment thread with typed operations. Board operations create_board/update_board/delete_board manage subprojects. apply_design_system_document {markdown} atomically applies the current generated DESIGN.md name, description, raw documentation and Tokens table; preserve its section comments, stable --ds-<id> variables and protected component/source catalog. Token values propagate to explicit native bindings and source CSS variables across boards; custom styles remain independent. Use update_design_system for ordinary prose-only documentation patches. snap_node aligns a nearby free-positioned node using parent/sibling/canvas edge and center anchors; optional distance is 0–100 design units (default 8), with locked/hidden/stack positions protected. Set page.boardId when creating a page or update_page.patch.boardId to move one. expectedRevision must equal the latest project revision; a stale edit is rejected without changes. For new designs, save frame shells early with generation:{status:"building"}, then add coherent component groups in small batches so the open canvas updates throughout the build. Reuse each returned revision for the next batch. Mark each completed frame generation:{status:"ready"} through update_node; the store timestamps actual work for the grey loading wipe. Prefer focused node patches; replace_page deliberately replaces a page and should not hide ongoing generation until a final transaction. Deleting a board removes its pages and threads; deleting the last board is rejected. Returns projectId and revision, plus the complete saved project by default. Set includeProject:false for compact acknowledgements during progressive builds; chain the returned revision and read the full project again when needed.',
    inputSchema: { projectId: idSchema, expectedRevision: revisionSchema, operations: operationsSchema, includeProject: z.boolean().default(true) },
    outputSchema: { projectId: idSchema, revision: revisionSchema, project: projectSchema.optional() },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }, _meta: appMetadata,
  }, async ({ projectId, expectedRevision, operations, includeProject }) => {
    try { const project = await store.mutate(projectId, expectedRevision, operations as Operation[]); return result({ projectId, revision: project.revision, ...(includeProject ? { project } : {}) }, `Saved ${project.name}, revision ${project.revision}.`); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_open_canvas', {
    title: 'Codex Design canvas', description: 'Open this conversation’s interactive design canvas beside the chat. Use the projectId and boardId belonging to the current conversation, with optional pageId. Without IDs, restore only this conversation’s saved selection when the host provides a conversation identity; otherwise open a project chooser. Never select a project merely because it was most recently used globally. An explicit project with no saved board opens its most recently updated board. Other open panes retain their own selections.',
    inputSchema: { projectId: idSchema.optional(), boardId: idSchema.optional(), pageId: idSchema.optional() },
    outputSchema: { canvasScope: z.literal('thread'), canvasLaunchId: idSchema, canvasTargetExplicit: z.boolean(), needsSelection: z.literal(true).optional(), project: projectSchema.optional(), projectId: idSchema.optional(), boardId: idSchema.optional(), pageId: idSchema.optional(), projects: z.array(projectSummarySchema).optional(), standaloneUrl: z.string().optional() }, annotations: readOnly,
    _meta: { ...appMetadata, ui: { resourceUri: CANVAS_RESOURCE_URI, visibility: ['model', 'app'] }, 'openai/ui': { entrypoints: [{ type: 'thread' }] }, 'openai/outputTemplate': CANVAS_RESOURCE_URI, 'openai/toolInvocation/invoking': 'Opening this chat’s canvas', 'openai/toolInvocation/invoked': 'Canvas ready' },
  }, async ({ projectId, boardId, pageId }, { _meta }) => {
    try {
      const canvasLaunchId = randomUUID();
      const key = conversationSelectionKey(_meta);
      const saved = key ? await store.getCanvasSelection(key) : null;
      const selectedId = projectId ?? saved?.projectId;
      if (!selectedId) {
        if (boardId || pageId) throw new StoreError(400, 'project_required', 'Choose a project before opening a board or page.');
        return result({ canvasScope: 'thread', canvasLaunchId, canvasTargetExplicit: false, needsSelection: true, projects: await store.list() }, 'Choose or create a project for this conversation’s canvas. No project is bound to this chat yet.');
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
      return result({ canvasScope: 'thread', canvasLaunchId, canvasTargetExplicit: !!(projectId || boardId || pageId), project, ...selection, ...(standaloneUrl ? { standaloneUrl } : {}) }, `Opened ${project.name} / ${board.name} for this conversation, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_open_app', {
    title: 'Codex Design', description: 'Open the global Codex Design project browser from the app sidebar. This launcher has its own selection and does not select a canvas for another conversation. Conversation design work uses canvas_open_canvas.',
    inputSchema: {}, outputSchema: { canvasScope: z.literal('library'), canvasLaunchId: idSchema, needsSelection: z.literal(true), projects: z.array(projectSummarySchema) }, annotations: readOnly,
    _meta: { ui: { resourceUri: CANVAS_RESOURCE_URI, visibility: ['app'] }, 'openai/widgetAccessible': true, 'openai/visibility': 'private', 'openai/ui': { entrypoints: [{ type: 'global' }] }, 'openai/outputTemplate': CANVAS_RESOURCE_URI },
  }, async () => {
    try { return result({ canvasScope: 'library', canvasLaunchId: randomUUID(), needsSelection: true, projects: await store.list() }, 'Choose a project to browse in Codex Design.'); } catch (error) { return toolError(error); }
  });

  server.registerTool('canvas_set_selection', {
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
    title: 'Read queued design comments', description: 'Find open component or canvas threads explicitly queued for the assistant. Returns complete threads with project, board, page, and node anchors and current revisions. Image requests marked intent:generate_image include a request prompt for native image generation and context-aware placement. Ordinary image-generation requests should also use the native image tool and focused image placement context. Omit projectId to check all projects. Read focused context or the project before applying changes.',
    inputSchema: { projectId: idSchema.optional() },
    outputSchema: { comments: z.array(z.object({ projectId: idSchema, projectName: z.string(), revision: revisionSchema, boardId: idSchema, boardName: z.string(), pageName: z.string(), nodeName: z.string().nullable(), thread: threadSchema, request: z.string().optional() })) },
    annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId }) => {
    try {
      const projects: DesignProject[] = projectId ? [await store.get(projectId)] : await Promise.all((await store.list()).map(({ id }) => store.get(id)));
      const comments = projects.flatMap(project => project.threads.filter(thread => thread.queued && thread.status === 'open').map(thread => {
        const page = project.pages.find(page => page.id === thread.pageId);
        const board = project.boards.find(board => board.id === page?.boardId) ?? project.boards[0];
        const imageRequest = thread.messages.filter(message => message.role === 'user').at(-1)?.intent === 'generate_image';
        return { projectId: project.id, projectName: project.name, revision: project.revision, boardId: board.id, boardName: board.name, pageName: page?.name ?? '', nodeName: page?.nodes.find(node => node.id === thread.nodeId)?.name ?? null, thread, ...(imageRequest ? { request: commentPrompt(project, thread) } : {}) };
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
    title: 'Export design and implementation handoff', description: 'Read scoped source files for a project, board, page or selected node subtree(s). Supply pageId with nodeIds for a selection; boardId, when supplied, must match the page. format supports source, html, react, passive svg or spatial svg-map. Use format library without board/page/node scope for the project design system and reusable components, or componentId for one definition with its shared tokens. Library files follow the imported design-system reference: DESIGN.md, COMPONENTS.md, named JSX, sibling .d.ts/.prompt.md, CSS and passive @dsCard HTML, plus versioned editable JSON. Import its JSON with canvas_import_project to initialize a new project. Read assets/assetPaths and save the media bytes alongside these files. svg-map preserves page/selection canvas positions and embeds image assets; map controls background, scale, labels and margin. PNG capture, shaders and videos without a poster require the editor download surface. The default remains page HTML when pageId is supplied, otherwise the source bundle. Media bytes are not duplicated into this response: assets metadata and assetPaths tell the caller which authenticated canvas_read_asset_chunk references to save alongside the files. The caller chooses where to save files.',
    inputSchema: { projectId: idSchema, boardId: idSchema.optional(), pageId: idSchema.optional(), nodeIds: z.array(idSchema).min(1).max(100).optional(), format: z.enum(['source', 'html', 'react', 'svg', 'svg-map', 'png', 'library']).optional(), componentId: idSchema.optional(), map: canvasMapSettingsSchema.optional() },
    outputSchema: { projectId: idSchema, revision: revisionSchema, boardId: idSchema.optional(), files: z.record(z.string()), assets: z.array(assetMetadataSchema), assetPaths: z.record(z.string()), map: z.object({ width: z.number(), height: z.number(), pixelWidth: z.number(), pixelHeight: z.number(), warnings: z.array(z.string()) }).optional() }, annotations: readOnly, _meta: appMetadata,
  }, async ({ projectId, boardId, pageId, nodeIds, format, componentId, map }) => {
    try {
      if (nodeIds && !pageId) throw new StoreError(400, 'invalid_export_scope', 'Selection export requires pageId and nodeIds.');
      const project = await store.get(projectId);
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
      if (selectedFormat === 'png') throw new StoreError(400, 'browser_capture_required', 'Download the PNG canvas map from Export in the editor, where native nodes and passive source can be captured.');
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
      if (selectedFormat === 'source' || selectedFormat === 'react') Object.assign(files, libraryReferenceFiles(project, { assetUrls }));
      return result({ projectId, revision: project.revision, ...(boardId ? { boardId } : {}), files, assets, assetPaths }, `Exported ${Object.keys(files).length} source file(s) and ${assets.length} media reference(s) from ${project.name}, revision ${project.revision}.`);
    } catch (error) { return toolError(error); }
  });

  return server;
}
