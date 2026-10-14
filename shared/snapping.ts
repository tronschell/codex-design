import type { DesignNode } from './types.js';
import { nodeInnerSize, nodePadding, visualBounds } from './effects.js';

export interface SnapBox { x: number; y: number; width: number; height: number }
export interface SnapGuide { axis: 'x' | 'y'; position: number; start: number; end: number }
interface SnapCandidate { position: number; start: number; end: number; priority: number; id: string }
export interface SnapScene { x: SnapCandidate[]; y: SnapCandidate[] }

export function createSnapScene(nodes: DesignNode[], node: DesignNode): SnapScene {
  const scene: SnapScene = { x: [], y: [] }, byId = new Map(nodes.map(item => [item.id, item]));
  const children = new Map<string, DesignNode[]>();
  for (const item of nodes) if (item.parentId) { const siblings = children.get(item.parentId); if (siblings) siblings.push(item); else children.set(item.parentId, [item]); }
  const excluded = new Set<string>(), pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (excluded.has(current.id)) continue;
    excluded.add(current.id); pending.push(...(children.get(current.id) ?? []));
  }
  const ancestors = new Set<string>();
  let parentId = node.parentId;
  while (parentId && !ancestors.has(parentId)) { ancestors.add(parentId); parentId = byId.get(parentId)?.parentId ?? null; }
  const hidden = (item: DesignNode) => {
    const seen = new Set<string>();
    let current: DesignNode | undefined = item;
    while (current && !seen.has(current.id)) {
      if (current.hidden) return true;
      seen.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return false;
  };
  if (hidden(node)) return scene;
  const add = (box: SnapBox, priority: number, id: string) => {
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) return;
    for (const position of [box.x, box.x + box.width / 2, box.x + box.width]) scene.x.push({ position, start: box.y, end: box.y + box.height, priority, id });
    for (const position of [box.y, box.y + box.height / 2, box.y + box.height]) scene.y.push({ position, start: box.x, end: box.x + box.width, priority, id });
  };
  for (const target of nodes) {
    if (excluded.has(target.id) || hidden(target) || (ancestors.has(target.id) && target.id !== node.parentId)) continue;
    if (target.id === node.parentId) {
      const size = nodeInnerSize(target), padding = nodePadding(target);
      const width = Math.max(0, size.width - padding.x * 2), height = Math.max(0, size.height - padding.y * 2);
      add(visualBounds({ ...node, type: 'rectangle', parentId: target.id, x: padding.x, y: padding.y, width, height, styles: {}, effects: undefined }, nodes), 0, target.id);
    } else if (target.parentId === node.parentId) add(visualBounds(target, nodes), 1, target.id);
    else if (!target.parentId) add(visualBounds(target, nodes), 2, target.id);
  }
  scene.x.push({ position: 0, start: 0, end: 0, priority: 3, id: '' });
  scene.y.push({ position: 0, start: 0, end: 0, priority: 3, id: '' });
  const sort = (a: SnapCandidate, b: SnapCandidate) => a.position - b.position || a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  scene.x.sort(sort); scene.y.sort(sort);
  return scene;
}

function lowerBound(candidates: SnapCandidate[], position: number, after = false): number {
  let low = 0, high = candidates.length;
  while (low < high) {
    const middle = (low + high) >>> 1, value = candidates[middle].position;
    if (value < position || (after && value === position)) low = middle + 1; else high = middle;
  }
  return low;
}

interface SnapMatch { target: SnapCandidate; delta: number; distance: number }
function nearest(candidates: SnapCandidate[], positions: number[], tolerance: number, minimum = -Infinity, maximum = Infinity): SnapMatch | null {
  const low = lowerBound(candidates, minimum), high = lowerBound(candidates, maximum, true);
  let match: SnapMatch | null = null;
  for (const position of positions) {
    const insertion = lowerBound(candidates, position);
    for (const index of [Math.max(low, insertion), Math.min(high - 1, insertion - 1)]) {
      if (index < low || index >= high) continue;
      const target = candidates[lowerBound(candidates, candidates[index].position)], delta = target.position - position, distance = Math.abs(delta);
      if (distance > tolerance) continue;
      if (!match || distance < match.distance || (distance === match.distance && (target.priority < match.target.priority || (target.priority === match.target.priority && target.position < match.target.position)))) match = { target, delta, distance };
    }
  }
  return match;
}

export function snapBox(scene: SnapScene, box: SnapBox, tolerance: number, edges?: { x?: 'start' | 'end'; y?: 'start' | 'end' }): { box: SnapBox; guides: SnapGuide[] } {
  const result = { ...box }, guides: SnapGuide[] = [];
  if (![box.x, box.y, box.width, box.height, tolerance].every(Number.isFinite) || tolerance < 0) return { box: result, guides };
  if (edges?.x && result.width < 8) { if (edges.x === 'start') result.x += result.width - 8; result.width = 8; }
  if (edges?.y && result.height < 8) { if (edges.y === 'start') result.y += result.height - 8; result.height = 8; }
  const x = edges ? edges.x ? [edges.x === 'start' ? result.x : result.x + result.width] : [] : [result.x, result.x + result.width / 2, result.x + result.width];
  const y = edges ? edges.y ? [edges.y === 'start' ? result.y : result.y + result.height] : [] : [result.y, result.y + result.height / 2, result.y + result.height];
  const horizontal = nearest(scene.x, x, tolerance, edges?.x === 'end' ? result.x + 8 : -Infinity, edges?.x === 'start' ? result.x + result.width - 8 : Infinity);
  const vertical = nearest(scene.y, y, tolerance, edges?.y === 'end' ? result.y + 8 : -Infinity, edges?.y === 'start' ? result.y + result.height - 8 : Infinity);
  if (horizontal) {
    if (edges?.x === 'start') { result.x += horizontal.delta; result.width -= horizontal.delta; }
    else if (edges?.x === 'end') result.width += horizontal.delta;
    else result.x += horizontal.delta;
  }
  if (vertical) {
    if (edges?.y === 'start') { result.y += vertical.delta; result.height -= vertical.delta; }
    else if (edges?.y === 'end') result.height += vertical.delta;
    else result.y += vertical.delta;
  }
  if (horizontal) guides.push({ axis: 'x', position: horizontal.target.position, start: Math.min(result.y, horizontal.target.start), end: Math.max(result.y + result.height, horizontal.target.end) });
  if (vertical) guides.push({ axis: 'y', position: vertical.target.position, start: Math.min(result.x, vertical.target.start), end: Math.max(result.x + result.width, vertical.target.end) });
  return { box: result, guides };
}
