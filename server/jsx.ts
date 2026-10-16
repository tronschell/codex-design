import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { idSchema, nodeSchema, revisionSchema } from '../shared/validation.ts';
import type { DesignNode, Operation } from '../shared/types.ts';
import { ProjectStore, StoreError } from './store.ts';

export function registerJsxTool(server: McpServer, store: ProjectStore, textResults = false) {
  server.registerTool('canvas_write_jsx', {
    title: 'Render and save JSX with the original device/window starters',
    description: 'Legacy static JSX preview. For application screens and shared components use canvas_write_react, which preserves modules, hooks, events and npm imports. Create or update one source-backed canvas component from static JSX markup. This is not a JSX-to-native importer: all internal elements remain inside one opaque source object. For editable screen imports, read the import-app guidance and use canvas_edit_project to compose native frames, controls, text, media and component instances. Reserve this tool for isolated source visuals or an explicitly requested source preview. Instantiates the original bundled IOSDevice/IOSNavBar/IOSList, AndroidDevice, MacWindow, ChromeWindow and their helpers. Accepts literal text/props/style objects, arrays and nested JSX; rejects imports, variable lookups, calls, event handlers and arbitrary JavaScript. CSS variables reference the project design system. Device chrome defaults to a blank safe area with no clock/status icons/camera/bezel; device opts into the original chrome. Retains original JSX and starter names beside passive HTML for context, history and source exports. Existing code nodes retain geometry, source siblings and conversations; new nodes require placement. The node is selectable/commentable as one source component; its internal HTML is not a native editable layer tree. Read the current project/revision and open its canvas before saving. Browser-lifecycle starters and proprietary DCLogic are unavailable; use documented canvas equivalents.',
    inputSchema: {
      projectId: idSchema, pageId: idSchema, nodeId: idSchema, expectedRevision: revisionSchema,
      jsx: z.string().trim().min(1).max(100_000), deviceChrome: z.enum(['safe-area', 'device']).default('safe-area'),
      placement: nodeSchema.pick({ parentId: true, x: true, y: true, width: true, height: true, name: true }).strict().optional(),
    },
    outputSchema: { projectId: idSchema, pageId: idSchema, nodeId: idSchema, revision: revisionSchema, starters: z.array(z.string()), components: z.array(z.string()), warnings: z.array(z.string()) },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: { ui: { visibility: ['model'] }, 'openai/widgetAccessible': false },
  }, async ({ projectId, pageId, nodeId, expectedRevision, jsx, deviceChrome, placement }) => {
    try {
      const project = await store.get(projectId), page = project.pages.find(item => item.id === pageId);
      if (!page) throw new StoreError(404, 'page_not_found', 'The selected page does not exist in this project.');
      if (project.revision !== expectedRevision) throw new StoreError(409, 'revision_conflict', 'Read the latest project and rebase this JSX edit.');
      const existing = page.nodes.find(item => item.id === nodeId);
      if (existing && existing.type !== 'code') throw new StoreError(400, 'jsx_target_type', 'Use a new source component instead of replacing a native text, frame or media node.');
      if (!existing && !placement) throw new StoreError(400, 'jsx_placement_required', 'A new JSX component requires name, parentId, x, y, width and height.');
      if (existing && placement) throw new StoreError(400, 'jsx_existing_placement', 'Existing JSX components retain geometry. Move or resize with canvas_edit_project.');
      let ancestor = existing ?? (placement?.parentId ? page.nodes.find(item => item.id === placement.parentId) : undefined);
      const seen = new Set<string>();
      while (ancestor && !seen.has(ancestor.id)) {
        if (ancestor.locked || ancestor.hidden) throw new StoreError(400, 'node_not_editable', 'Unlock and show this component and its ancestors before editing.');
        seen.add(ancestor.id); ancestor = ancestor.parentId ? page.nodes.find(item => item.id === ancestor!.parentId) : undefined;
      }
      const { renderJsx } = await import(new URL('../dist/jsx-renderer.mjs', import.meta.url).href) as typeof import('./jsx-renderer.ts');
      const rendered = await renderJsx(jsx, deviceChrome);
      const authoring = { source: jsx, starters: rendered.starters, deviceChrome };
      const operation: Operation = existing ? { type: 'update_node', pageId, nodeId, patch: { source: rendered.html, jsx: authoring, react: null } }
        : { type: 'create_node', pageId, node: { id: nodeId, type: 'code', ...placement!, styles: {}, source: rendered.html, jsx: authoring } as DesignNode };
      const saved = await store.mutate(projectId, expectedRevision, [operation]);
      const value = { projectId, pageId, nodeId, revision: saved.revision, starters: rendered.starters, components: rendered.components, warnings: ['Saved as one source object, not native child layers. Internal elements require JSX editing. Editable screen imports must use native frames, component instances and separate control/text/media nodes; do not treat a whole-screen source object as a completed editable import.'] };
      return { content: [{ type: 'text' as const, text: `Saved JSX component ${nodeId}, revision ${saved.revision}.${textResults ? `\n${JSON.stringify(value)}` : ''}` }], structuredContent: value };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ code: error instanceof StoreError ? error.code : error instanceof Error && 'code' in error && error.code === 'invalid_jsx' ? 'invalid_jsx' : 'JSX_ERROR', message: error instanceof Error ? error.message : 'Unable to render JSX.' }) }] };
    }
  });
}
