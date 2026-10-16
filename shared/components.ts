import { remapFeatureReferences } from './diagrams';
import type { ComponentInstance, DesignNode, NativeComponentDefinition } from './types.ts';

export const COMPONENT_NODE_PROPERTIES = ['type', 'name', 'x', 'y', 'width', 'height', 'content', 'notes', 'href', 'source', 'live', 'react', 'jsx', 'media', 'shader', 'effects', 'locked', 'hidden', 'diagram', 'diagramElement', 'diagramEdge', 'applicationState', 'stateBinding', 'stateRules', 'journey'] as const;

export function componentSubtree(nodes: DesignNode[], rootId: string): DesignNode[] {
  const children = new Map<string, string[]>();
  for (const node of nodes) if (node.parentId !== null) {
    const siblings = children.get(node.parentId) ?? [];
    siblings.push(node.id); children.set(node.parentId, siblings);
  }
  const ids = new Set<string>(), pending = [rootId];
  while (pending.length) { const id = pending.pop()!; if (ids.has(id)) continue; ids.add(id); pending.push(...(children.get(id) ?? [])); }
  return nodes.filter(node => ids.has(node.id));
}

export function componentInstanceRoot(nodes: DesignNode[], nodeId: string): DesignNode | undefined {
  return nodes.find(node => node.componentInstance && Object.values(node.componentInstance.nodeMap).includes(nodeId));
}

export function componentChangedProperties(before: DesignNode, after: DesignNode): string[] {
  const paths: string[] = COMPONENT_NODE_PROPERTIES.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  for (const key of new Set([...Object.keys(before.styles), ...Object.keys(after.styles)])) if (JSON.stringify(before.styles[key as keyof typeof before.styles]) !== JSON.stringify(after.styles[key as keyof typeof after.styles])) paths.push(`styles.${key}`);
  for (const key of new Set([...Object.keys(before.tokenBindings ?? {}), ...Object.keys(after.tokenBindings ?? {})])) if (before.tokenBindings?.[key as keyof typeof before.tokenBindings] !== after.tokenBindings?.[key as keyof typeof after.tokenBindings]) paths.push(`tokenBindings.${key}`);
  return paths;
}

export function recordComponentOverrides(nodes: DesignNode[], before: DesignNode, after: DesignNode) {
  const root = componentInstanceRoot(nodes, before.id), instance = root?.componentInstance;
  if (!instance) return;
  const definitionId = Object.entries(instance.nodeMap).find(([, id]) => id === before.id)?.[0];
  if (!definitionId) return;
  const changed = componentChangedProperties(before, after).filter(path => before.id !== root.id || !['x', 'y'].includes(path));
  if (changed.length) instance.overrides[definitionId] = [...new Set([...(Object.hasOwn(instance.overrides, definitionId) ? instance.overrides[definitionId] : []), ...changed])];
}

export function applyComponentOverride(target: DesignNode, local: DesignNode, path: string) {
  const [field, key] = path.split('.');
  const destination = key ? ((target as unknown as Record<string, Record<string, unknown>>)[field] ??= {}) : target as unknown as Record<string, unknown>;
  const source = key ? (local as unknown as Record<string, Record<string, unknown>>)[field] : local as unknown as Record<string, unknown>;
  const property = key ?? field;
  if (source && Object.hasOwn(source, property) && source[property] !== undefined) destination[property] = structuredClone(source[property]);
  else delete destination[property];
  if (target.tokenBindings && !Object.keys(target.tokenBindings).length) delete target.tokenBindings;
}

export function materializeComponent(definition: NativeComponentDefinition, instance: ComponentInstance, placement: Pick<DesignNode, 'x' | 'y' | 'parentId'>): DesignNode[] {
  return definition.nodes.map(original => {
    const node = structuredClone(original);
    node.id = instance.nodeMap[original.id];
    node.parentId = original.id === definition.rootNodeId ? placement.parentId : instance.nodeMap[original.parentId!];
    if (node.href?.startsWith('#') && Object.hasOwn(instance.nodeMap, node.href.slice(1))) node.href = `#${instance.nodeMap[node.href.slice(1)]}`;
    if (original.id === definition.rootNodeId) { node.x = placement.x; node.y = placement.y; node.componentInstance = instance; }
    remapFeatureReferences(node, new Map(Object.entries(instance.nodeMap)));
    return node;
  });
}
