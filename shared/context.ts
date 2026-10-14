import type { DesignNode, DesignProject } from './types.js';
import { resolvedNodes } from './export.js';
import { nodeBoxSize, nodePadding, visualBounds } from './effects.js';

const IMAGE_CONTEXT_LIMIT = 10;
const imageBoxName = /(?:^|[^a-z])(?:image|photo|picture|illustration|artwork|thumbnail|avatar|poster|media)(?:[^a-z]|$)/i;
const boundsOf = (node: DesignNode) => ({ x: node.x, y: node.y, width: node.width, height: node.height });
const resolvedBoundsOf = (node: DesignNode) => ({ x: node.x, y: node.y, ...nodeBoxSize(node) });

export function imagePlacementContext(project: DesignProject, pageId: string, nodeId: string) {
  const page = project.pages.find(page => page.id === pageId);
  if (!page) throw new Error(`Page ${pageId} was not found in this project.`);
  const byId = new Map(page.nodes.map(node => [node.id, node])), selected = byId.get(nodeId);
  if (!selected) throw new Error(`Node ${nodeId} was not found on this page.`);
  const resolvedList = resolvedNodes(page.nodes, project.designSystem);
  const resolved = new Map(resolvedList.map(node=>[node.id,node]));
  const children = new Map<string, DesignNode[]>();
  for (const node of page.nodes) if (node.parentId) {
    const siblings = children.get(node.parentId);
    if (siblings) siblings.push(node); else children.set(node.parentId, [node]);
  }
  const ancestorsOf = (node: DesignNode) => {
    const ancestors: DesignNode[] = [], seen = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      ancestors.push(parent); parentId = parent.parentId;
    }
    return ancestors;
  };
  const layoutOf = (node: DesignNode) => ({
    direction: node.styles.layout ?? 'free', align: node.styles.align ?? 'start', justify: node.styles.justify ?? 'start',
    gap: node.styles.gap ?? 0, padding: node.styles.padding ?? 0, paddingX: nodePadding(node).x, paddingY: nodePadding(node).y,
    marginX: node.styles.marginX ?? 0, marginY: node.styles.marginY ?? 0,
  });
  const describe = (node: DesignNode) => {
    const ancestors = ancestorsOf(node), parent = ancestors[0], positioned = resolved.get(node.id)!;
    const absoluteBounds = visualBounds(positioned,resolvedList), size = nodeBoxSize(positioned);
    const parentStyles = parent ? resolved.get(parent.id)!.styles : null;
    const parentOverflow = parentStyles?.overflow ?? (parent && ['frame', 'code', 'image', 'video', 'shader'].includes(parent.type) ? 'hidden' : 'visible');
    const visibleSiblings = parent ? (children.get(parent.id) ?? []).filter(child => !child.hidden) : [];
    const parentStack = parent?.styles.layout === 'vertical' || parent?.styles.layout === 'horizontal';
    return {
      id: node.id, type: node.type, name: node.name, parentId: node.parentId,
      localBounds: boundsOf(node), resolvedLocalBounds: resolvedBoundsOf(positioned), absoluteBounds,
      aspectRatio: size.height > 0 ? size.width / size.height : null,
      locked: !!node.locked, hidden: !!node.hidden,
      effectiveLocked: !!node.locked || ancestors.some(ancestor => ancestor.locked),
      effectiveHidden: !!node.hidden || ancestors.some(ancestor => ancestor.hidden),
      sourceBacked: node.source !== undefined, childCount: children.get(node.id)?.length ?? 0,
      layout: layoutOf(positioned),
      parentLayout: parent ? {
        id: parent.id, ...layoutOf(resolved.get(parent.id)!), position: parentStack && !node.hidden ? 'stack' as const : 'free' as const,
        visibleChildIndex: node.hidden ? null : visibleSiblings.findIndex(child => child.id === node.id),
        visibleChildCount: visibleSiblings.length,
        clipsChildren: [parentStyles?.overflowX ?? parentOverflow, parentStyles?.overflowY ?? parentOverflow].some(value => value !== 'visible'),
      } : null,
      ...(node.type === 'image' ? { imageFit: positioned.styles.objectFit ?? node.media?.fit ?? 'cover' } : {}),
    };
  };
  const isContainer = (node: DesignNode) => node.type === 'frame' || node.type === 'code'
    || ((node.type === 'rectangle' || node.type === 'ellipse') && children.has(node.id));
  const container = isContainer(selected) ? selected : ancestorsOf(selected).find(isContainer);
  const included = new Set<string>(), pending = [selected.id];
  while (pending.length) {
    const id = pending.pop()!;
    if (included.has(id)) continue;
    included.add(id); pending.push(...(children.get(id) ?? []).map(child => child.id));
  }
  const scoped = [selected, ...page.nodes.filter(node => node.id !== selected.id && included.has(node.id))];
  if (container && container.id !== selected.id) scoped.push(...(children.get(container.id) ?? []).filter(node => !included.has(node.id)));
  const candidates = scoped.flatMap(node => {
    const action = node.type === 'image' ? 'replace_image' as const
      : (node.type === 'rectangle' || node.type === 'ellipse' || (node.type === 'frame' && node.parentId !== null))
        && !children.has(node.id) && node.source === undefined && !node.content && imageBoxName.test(node.name) ? 'use_explicit_box' as const : null;
    return action ? [{ node, action, scope: node.id === selected.id ? 'selection' as const : included.has(node.id) ? 'selected_subtree' as const : 'nearest_container' as const }] : [];
  });
  const containerChildren = container ? children.get(container.id) ?? [] : [];
  return {
    projectId: project.id, pageId, nodeId, revision: project.revision,
    selected: describe(selected),
    nearestContainer: container ? { node: describe(container), children: containerChildren.slice(0, IMAGE_CONTEXT_LIMIT).map(describe), childrenTruncated: containerChildren.length > IMAGE_CONTEXT_LIMIT } : null,
    candidates: candidates.slice(0, IMAGE_CONTEXT_LIMIT).map(candidate => ({
      node: describe(candidate.node), action: candidate.action, scope: candidate.scope,
      reason: candidate.action === 'replace_image' ? 'Existing image layer; preserve its geometry and styles.' : 'Image-purpose name on an empty box; confirm its role against the request and surrounding content.',
    })),
    candidateLimit: IMAGE_CONTEXT_LIMIT, candidatesTruncated: candidates.length > IMAGE_CONTEXT_LIMIT,
    guidance: [
      'Candidates are structural hints, not semantic placement decisions. Read source and nearby layout before choosing; read more focused context if bounded children omit relevant content.',
      'Replace an existing image by changing media.src while retaining geometry, parent, styles, fit and sibling order unless the request explicitly changes them.',
      'Within a container, choose a suitable placeholder or explicit image child box without covering text or controls. Do not infer a whole-frame fill; no candidate means no automatic placement.',
      'Retain source-backed node source and type. Use an explicitly sized image child only where the source, layout and request establish an appropriate image region.',
      'Respect locks, hidden ancestors, clipping and padding. Stack child sizes are fixed; adding or resizing a child can reposition siblings. Preserve existing layout and conversations.',
    ],
  };
}

export function nodeContext(project: DesignProject, pageId: string, nodeId: string, includeSource = true, includeImagePlacement = false) {
  const page = project.pages.find(page => page.id === pageId);
  if (!page) throw new Error(`Page ${pageId} was not found in this project.`);
  const byId = new Map(page.nodes.map(node => [node.id, node])), node = byId.get(nodeId);
  if (!node) throw new Error(`Node ${nodeId} was not found on this page.`);
  const board = project.boards.find(board => board.id === page.boardId) || project.boards[0];
  const children = new Map<string, string[]>();
  for (const child of page.nodes) if (child.parentId) {
    const siblings = children.get(child.parentId);
    if (siblings) siblings.push(child.id); else children.set(child.parentId, [child.id]);
  }
  const included = new Set<string>(), pending = [node.id];
  while (pending.length) {
    const id = pending.pop()!;
    if (included.has(id)) continue;
    included.add(id); pending.push(...children.get(id) || []);
  }
  const ancestors: DesignNode[] = [], seen = new Set([node.id]);
  let parent = node.parentId;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    const ancestor = byId.get(parent);
    if (!ancestor) break;
    ancestors.unshift(ancestor); parent = ancestor.parentId;
  }
  const resolvedList = resolvedNodes(page.nodes, project.designSystem);
  const resolved = new Map(resolvedList.map(node=>[node.id,node]));
  const positioned = resolved.get(node.id)!;
  const bounds = visualBounds(positioned,resolvedList);
  const scopedNodes = page.nodes.filter(node => included.has(node.id));
  const tokenIds = new Set([...ancestors, ...scopedNodes].flatMap(node => Object.values(node.tokenBindings ?? {})));
  const scope = (node: DesignNode) => {
    const positioned = resolved.get(node.id)!, bounds = resolvedBoundsOf(positioned);
    return {
      ...(includeSource ? node : { ...node, source: undefined, jsx: undefined, ...(node.shader ? { shader: { ...node.shader, fragment: undefined } } : {}) }),
      ...(positioned.styles !== node.styles ? { resolvedStyles: positioned.styles } : {}),
      ...(bounds.x !== node.x || bounds.y !== node.y || bounds.width !== node.width || bounds.height !== node.height ? { resolvedLocalBounds: bounds } : {}),
    };
  };
  return {
    projectId: project.id, projectName: project.name, revision: project.revision,
    boardId: board.id, boardName: board.name, pageId: page.id, pageName: page.name, nodeId,
    tokens: project.tokens, designSystem: { name: project.designSystem.name, tokens: project.designSystem.tokens.filter(token => tokenIds.has(token.id)) }, bounds, sourceIncluded: includeSource,
    ancestors: ancestors.map(scope), nodes: scopedNodes.map(scope),
    threads: project.threads.filter(thread => thread.pageId === page.id && (thread.nodeId === null || included.has(thread.nodeId) || seen.has(thread.nodeId))),
    ...(includeImagePlacement ? { imagePlacement: imagePlacementContext(project, pageId, nodeId) } : {}),
  };
}
