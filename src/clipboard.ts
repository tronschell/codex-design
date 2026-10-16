import { stateContextSchema } from '../shared/feature-schema';
import { remapFeatureReferences } from '../shared/diagrams';
import { z } from 'zod';
import type { BindableStyleProperty, DesignNode, DesignProject, Operation } from '../shared/types';
import { compatibleTokenKinds } from '../shared/design-system';
import { hasTransformedAncestor, nodeBoxSize, nodeInnerSize, parentLocalDelta, visualBounds } from '../shared/effects';
import { resolvedNodes } from '../shared/export';
import { MAX_DOCUMENT_BYTES, MAX_INPUT_BYTES, documentLimitLabel, idSchema, nodeSchema, operationsSchema, projectSchema, threadSchema } from '../shared/validation';
import { remapComponentInstance, selectionRoots, subtree, uid } from './editor-utils';

export const CLIPBOARD_MIME = 'application/x-codex-design-selection+json';
const format = 'codex-design-selection';
const pointSchema = z.object({ x: nodeSchema.shape.x, y: nodeSchema.shape.y }).strict();
const clipboardSchema = z.object({
  format: z.literal(format), version: z.literal(1), projectId: idSchema, pageId: idSchema,
  stateContexts: z.record(idSchema,stateContextSchema).optional(),
  nodes: z.array(nodeSchema).min(1).max(2000), threads: z.array(threadSchema).max(2000),
  roots: z.array(z.object({ id: idSchema, canvasPosition: pointSchema.nullable(), parentContext: z.string().max(MAX_INPUT_BYTES) }).strict()).min(1).max(2000),
}).strict();
type ClipboardSelection = z.infer<typeof clipboardSchema>;

function boundedJson(value: unknown, message: string, limit = MAX_INPUT_BYTES) {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).byteLength > limit) throw new Error(message);
  return text;
}

function parseSelection(input: unknown): ClipboardSelection {
  const parsed = clipboardSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid Codex Design clipboard: ${parsed.error.issues[0]?.message ?? 'unreadable objects'}. Copy the selection again.`);
  const data = parsed.data, byId = new Map(data.nodes.map(node => [node.id, node]));
  if (data.nodes.length + data.threads.length > 2000) throw new Error('This selection exceeds the 2,000-operation limit. Copy fewer objects or conversations.');
  const ids = new Set<string>([data.projectId, data.pageId]);
  const addId = (id: string) => {
    if (ids.has(id)) throw new Error('The clipboard contains duplicate IDs. Copy the selection again.');
    ids.add(id);
  };
  data.nodes.forEach(node => addId(node.id));
  const roots = new Set(data.roots.map(root => root.id));
  if (roots.size !== data.roots.length || data.roots.some(root => !byId.has(root.id))) throw new Error('The clipboard has invalid selection roots. Copy the selection again.');
  const complete = new Set<string>();
  for (const node of data.nodes) {
    if (roots.has(node.id) !== !byId.has(node.parentId ?? '')) throw new Error('The clipboard has an incomplete object hierarchy. Copy the selection again.');
    const path = new Set<string>();
    let current: DesignNode | undefined = node;
    while (current && !complete.has(current.id)) {
      if (path.has(current.id)) throw new Error('The clipboard contains a parent cycle. Copy the selection again.');
      path.add(current.id);
      current = byId.get(current.parentId ?? '');
    }
    path.forEach(id => complete.add(id));
  }
  for (const thread of data.threads) {
    if (thread.pageId !== data.pageId || thread.nodeId === null || !byId.has(thread.nodeId)) throw new Error('The clipboard has a conversation without its object. Copy the selection again.');
    addId(thread.id);
    thread.messages.forEach(message => addId(message.id));
  }
  return data;
}

function parentChain(node: DesignNode, byId: ReadonlyMap<string, DesignNode>) {
  const chain: DesignNode[] = [], seen = new Set<string>([node.id]);
  let parent = byId.get(node.parentId ?? '');
  while (parent) {
    if (seen.has(parent.id)) throw new Error('This object has a parent cycle. Repair its hierarchy before copying.');
    seen.add(parent.id); chain.push(parent); parent = byId.get(parent.parentId ?? '');
  }
  return chain;
}

function parentContext(chain: DesignNode[]) {
  // Only ancestor geometry is retained; ancestor source, siblings and project data never enter the clipboard.
  return JSON.stringify(chain.map(node => ({
    id: node.id, parentId: node.parentId, x: node.x, y: node.y, size: nodeBoxSize(node), inner: nodeInnerSize(node),
    transforms: node.effects?.filter(effect => effect.type === 'transform' && effect.enabled !== false) ?? [],
  })));
}

export function serializeSelection(project: DesignProject, pageId: string, nodeIds: string[]): string {
  const page = project.pages.find(page => page.id === pageId);
  if (!page || !nodeIds.length || nodeIds.some(id => !page.nodes.some(node => node.id === id))) throw new Error('Select objects on the current page before copying.');
  const nodes = resolvedNodes(page.nodes, project.designSystem), byId = new Map(nodes.map(node => [node.id, node]));
  const selectedRoots = selectionRoots(nodeIds, nodes), included = new Set(selectedRoots.flatMap(root => subtree(root.id, nodes).map(node => node.id)));
  let contextBytes = 0;
  const roots = selectedRoots.map(node => {
    const chain = parentChain(node, byId), parent = chain[0];
    const canvasPosition = parent && hasTransformedAncestor(parent, nodes) ? null : visualBounds({ ...node, effects: undefined }, nodes);
    const context = parentContext(chain);
    contextBytes += new TextEncoder().encode(context).byteLength;
    if (contextBytes > MAX_INPUT_BYTES) throw new Error('The selection has too much parent geometry. Copy fewer objects or include their parent frame.');
    return { id: node.id, canvasPosition: canvasPosition ? { x: canvasPosition.x, y: canvasPosition.y } : null, parentContext: context };
  });
  const data = parseSelection({
    format, version: 1, projectId: project.id, pageId, roots,
    stateContexts: Object.fromEntries(project.pages.flatMap(page=>page.nodes).filter(node=>node.applicationState && nodes.some(n=>included.has(n.id)&&n.stateBinding?.contextNodeId===node.id)).map(node=>[node.id,node.applicationState])),
    nodes: nodes.filter(node => included.has(node.id)),
    threads: project.threads.filter(thread => thread.pageId === pageId && thread.nodeId !== null && included.has(thread.nodeId)).map(thread => ({ ...thread, queued: false })),
  });
  return boundedJson(data, 'The copied selection exceeds 2 MiB. Copy fewer objects or smaller source layers.');
}

export function preparePaste(text: string, project: DesignProject, pageId: string, offset = { x: 40, y: 40 }): { operations: Operation[]; rootIds: string[] } | null {
  const branded = /^\s*\{\s*"format"\s*:\s*"codex-design-selection"/.test(text);
  if (text.length > MAX_INPUT_BYTES) {
    if (branded) throw new Error('The copied selection exceeds 2 MiB. Copy fewer objects.');
    return null;
  }
  let input: unknown;
  try { input = JSON.parse(text); }
  catch {
    if (branded) throw new Error('The Codex Design clipboard is unreadable. Copy the selection again.');
    return null;
  }
  if (!input || typeof input !== 'object' || !('format' in input) || input.format !== format) return null;
  if (new TextEncoder().encode(text).byteLength > MAX_INPUT_BYTES) throw new Error('The copied selection exceeds 2 MiB. Copy fewer objects.');
  const data = parseSelection(input), page = project.pages.find(page => page.id === pageId);
  if (!page) throw new Error('Choose a current page before pasting objects.');
  if (!pointSchema.safeParse(offset).success) throw new Error('The paste offset is outside the canvas coordinate range.');
  const sameProject = data.projectId === project.id, samePage = sameProject && data.pageId === pageId;
  const destination = resolvedNodes(page.nodes, project.designSystem), byId = new Map(destination.map(node => [node.id, node]));
  const roots = new Map(data.roots.map(root => [root.id, root])), ids = new Map(data.nodes.map(node => [node.id, uid()]));
  const tokens = new Map(project.designSystem.tokens.map(token => [token.id, token]));
  const copies = data.nodes.map(original => {
    const node = structuredClone(original), root = roots.get(node.id);
    node.id = ids.get(original.id)!;
    node.effects = node.effects?.map(effect => ({ ...effect, id: uid() }));
    if (node.href?.startsWith('#') && ids.has(node.href.slice(1))) node.href = `#${ids.get(node.href.slice(1))!}`;
    if (node.diagramEdge && (!ids.has(node.diagramEdge.from.nodeId) || !ids.has(node.diagramEdge.to.nodeId))) delete node.diagramEdge;
    if (!sameProject && node.stateBinding && !ids.has(node.stateBinding.contextNodeId)) {
      const context = data.stateContexts?.[node.stateBinding.contextNodeId];
      if (!context) throw new Error('Copy the frame with its state context to paste it into another project.');
      node.applicationState = structuredClone(context); node.stateBinding = {...node.stateBinding,contextNodeId:node.id};
    }
    remapFeatureReferences(node, ids);
    if (sameProject) remapComponentInstance(node, ids);
    else delete node.componentInstance;
    if (node.tokenBindings) {
      const bindings = Object.entries(node.tokenBindings).filter(([property, tokenId]) => {
        const token = tokenId ? tokens.get(tokenId) : undefined;
        return sameProject && token && compatibleTokenKinds(property as BindableStyleProperty).includes(token.kind);
      });
      if (bindings.length) node.tokenBindings = Object.fromEntries(bindings);
      else delete node.tokenBindings;
    }
    if (!root) node.parentId = ids.get(original.parentId!)!;
    else {
      const chain = samePage ? parentChain(original, byId) : [], parent = chain[0];
      const keepParent = samePage && original.parentId !== null && parent && !['vertical', 'horizontal'].includes(parent.styles.layout ?? '') && chain.every(ancestor => !ancestor.locked && !ancestor.hidden) && parentContext(chain) === root.parentContext;
      if (keepParent) {
        const delta = parentLocalDelta(original, destination, offset);
        if (!delta) throw new Error(`Cannot paste “${node.name}” inside a collapsed parent transform. Adjust its scale or copy the parent frame.`);
        node.x += delta.x; node.y += delta.y;
      } else {
        if (!root.canvasPosition) throw new Error(`Cannot preserve “${node.name}” outside its transformed parent. Paste on the original unchanged page, or copy the parent frame too.`);
        node.parentId = null;
        node.x = root.canvasPosition.x + offset.x; node.y = root.canvasPosition.y + offset.y;
      }
    }
    return node;
  });
  const threads = data.threads.map(thread => ({
    ...thread, id: uid(), pageId, nodeId: ids.get(thread.nodeId!)!, x: thread.x + offset.x, y: thread.y + offset.y, queued: false,
    messages: thread.messages.map(message => ({ ...message, id: uid() })),
  }));
  const operations: Operation[] = [...copies.map(node => ({ type: 'create_node' as const, pageId, node })), ...threads.map(thread => ({ type: 'create_thread' as const, thread }))];
  const parsedOperations = operationsSchema.safeParse(operations);
  if (!parsedOperations.success) throw new Error(`Cannot paste these objects: ${parsedOperations.error.issues[0]?.message ?? 'invalid operation'}. Try a smaller offset or selection.`);
  boundedJson({ expectedRevision: project.revision, operations: parsedOperations.data }, 'The paste transaction exceeds 2 MiB. Copy fewer objects or smaller source layers.');
  const next = { ...project, pages: project.pages.map(item => item.id === pageId ? { ...item, nodes: [...item.nodes, ...copies] } : item), threads: [...project.threads, ...threads] };
  const parsedProject = projectSchema.safeParse(next);
  if (!parsedProject.success) throw new Error(`Cannot paste into this project: ${parsedProject.error.issues[0]?.message ?? 'invalid document'}. Paste a smaller selection or choose another page.`);
  boundedJson(parsedProject.data, `Pasting would exceed the project’s ${documentLimitLabel} limit. Paste fewer objects or choose another project.`, MAX_DOCUMENT_BYTES);
  return { operations: parsedOperations.data, rootIds: data.roots.map(root => ids.get(root.id)!) };
}
