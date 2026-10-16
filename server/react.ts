import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { idSchema, nodeSchema, revisionSchema, nativeComponentDefinitionSchema } from '../shared/validation';
import { reactBindingSchema, reactFileChangesSchema, reactDependencyChangesSchema } from '../shared/react-project';
import type { DesignNode, Operation } from '../shared/types';
import { ProjectStore, StoreError } from './store';

export function registerReactTool(server: McpServer, store: ProjectStore) {
  server.registerTool('canvas_write_react', {
    title: 'Build a React application screen or shared component',
    description: 'Default authoring path for application screens and components. Save real TSX/JSX modules with imports, hooks, event handlers and npm dependencies in a project-wide React application, then mount an entry export in a frame or component. Files are merged by relative path; null deletes. @/ resolves to src/. Dependencies are exact npm versions, installed with lifecycle scripts disabled; any browser-compatible React library can be used. Shadcn is optional source code, not a required library. Shared module edits rebuild all referencing screens atomically; a compile error leaves the saved application untouched. Existing nodes retain geometry, children and discussions. New nodes require placement. Register reusable inner components in components in this same call, each with a frame/code root bound to its defining module export and realistic preview props. This populates the Components library and enables clicking an inner component to edit it on its own page. Include provider adapters when needed. Canvas geometry and comments remain native. Read existing files and revision before editing. React source and dependency manifests are preserved in exports. Use native nodes for explicitly requested diagram/wireframe/layer editing.',
    inputSchema: {
      projectId: idSchema, pageId: idSchema, nodeId: idSchema, expectedRevision: revisionSchema,
      components: z.array(nativeComponentDefinitionSchema).max(200).optional().describe('Reusable inner component definitions with React-bound roots and useful preview props. Include when creating screen components; keep existing IDs when updating.'),
      files: reactFileChangesSchema, dependencies: reactDependencyChangesSchema.optional(), component: reactBindingSchema,
      placement: nodeSchema.pick({ parentId: true, x: true, y: true, width: true, height: true, name: true }).extend({ type: z.enum(['frame', 'code']).default('frame') }).strict().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    _meta: { ui: { visibility: ['model'] }, 'openai/widgetAccessible': false },
  }, async ({ projectId, pageId, nodeId, expectedRevision, files, dependencies, component, placement, components }) => {
    try {
      const project = await store.get(projectId), page = project.pages.find(page => page.id === pageId);
      if (!page) throw new StoreError(404, 'page_not_found', 'The selected page does not exist.');
      if (project.revision !== expectedRevision) throw new StoreError(409, 'revision_conflict', 'Read the latest React application source and rebase this edit.');
      const existing = page.nodes.find(node => node.id === nodeId);
      if (existing && !['frame', 'code'].includes(existing.type)) throw new StoreError(400, 'invalid_react_target', 'Choose a frame or source component.');
      if (!existing && !placement) throw new StoreError(400, 'invalid_react_placement', 'New React screens/components require placement.');
      if (existing && placement) throw new StoreError(400, 'invalid_react_placement', 'Existing React screens keep their geometry. Use canvas_edit_project to move or resize them.');
      let ancestor = existing ?? page.nodes.find(node => node.id === placement?.parentId);
      const seen = new Set<string>();
      while (ancestor && !seen.has(ancestor.id)) {
        if (ancestor.locked || ancestor.hidden) throw new StoreError(400, 'node_not_editable', 'Unlock and show this screen and its ancestors first.');
        seen.add(ancestor.id); ancestor = page.nodes.find(node => node.id === ancestor?.parentId);
      }
      const operations: Operation[] = [{ type: 'update_react_files', files, dependencies }, ...(components ?? []).map(component => ({ type: 'upsert_component' as const, component })), existing
        ? { type: 'update_node', pageId, nodeId, patch: { react: component } }
        : { type: 'create_node', pageId, node: { id: nodeId, ...placement!, react: component, styles: {} } as DesignNode }];
      const saved = await store.mutate(projectId, expectedRevision, operations);
      const value = { projectId, pageId, nodeId, revision: saved.revision, entry: component.entry, files: Object.keys(saved.designSystem.react!.files), dependencies: saved.designSystem.react!.dependencies, componentIds: saved.designSystem.components.map(item => item.id) };
      return { content: [{ type: 'text' as const, text: JSON.stringify(value) }], structuredContent: value };
    } catch (error) { return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ code: error instanceof StoreError ? error.code : 'invalid_react_source', message: error instanceof Error ? error.message : 'React compilation failed.' }) }] }; }
  });
}
