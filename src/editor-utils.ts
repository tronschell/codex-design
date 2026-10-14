import type { DesignNode, DesignPage, Viewport } from '../shared/types';
import { parentLocalPoint, visualBounds } from '../shared/effects';

export const uid = () => crypto.randomUUID();
export const clampZoom = (zoom: number) => Math.min(4, Math.max(0.05, zoom));
export function subtree(nodeId: string, nodes: DesignNode[]): DesignNode[] {
  const ids = new Set([nodeId]);
  let changed = true;
  while (changed) { changed = false; for (const node of nodes) if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true; } }
  return nodes.filter(node => ids.has(node.id));
}
export function duplicateNodes(nodeId: string, nodes: DesignNode[]) {
  const group = subtree(nodeId, nodes), ids = new Map(group.map(node => [node.id, uid()]));
  return group.map(node => ({ ...structuredClone(node), id: ids.get(node.id)!, parentId: node.id === nodeId ? node.parentId : ids.get(node.parentId!)!, name: node.id === nodeId ? `${node.name} copy` : node.name, x: node.x + (node.id === nodeId ? 40 : 0), y: node.y + (node.id === nodeId ? 40 : 0) }));
}
export function bounds(nodes: DesignNode[]) {
  const roots = nodes.filter(node => !node.parentId && !node.hidden).map(node=>visualBounds(node,nodes));
  if (!roots.length) return { x: 0, y: 0, width: 1000, height: 800 };
  const x = Math.min(...roots.map(node => node.x)), y = Math.min(...roots.map(node => node.y));
  return { x, y, width: Math.max(...roots.map(node => node.x + node.width)) - x, height: Math.max(...roots.map(node => node.y + node.height)) - y };
}
export function fitViewport(page: DesignPage, width: number, height: number): Viewport {
  const box = bounds(page.nodes), zoom = clampZoom(Math.min((width - 180) / box.width, (height - 200) / box.height, 1));
  return { zoom, x: (width - box.width * zoom) / 2 - box.x * zoom, y: (height - box.height * zoom) / 2 - box.y * zoom + 25 };
}
export function insertionBounds(nodes: DesignNode[], parentId: string | null, view: Viewport, stage: { width: number; height: number }, size: { width: number; height: number }, point?: { x: number; y: number }) {
  const parent = nodes.find(node => node.id === parentId && node.type === 'frame');
  const scale = Math.min(1, (parent ? Math.max(16, parent.width - 32) : 1000) / size.width, (parent ? Math.max(16, parent.height - 32) : 800) / size.height);
  const width = Math.max(1, Math.round(size.width * scale)), height = Math.max(1, Math.round(size.height * scale));
  const center = point ? parentLocalPoint(parent?.id ?? null, nodes, point) : parent ? { x: parent.width / 2, y: parent.height / 2 } : { x: (stage.width / 2 - view.x) / view.zoom, y: (stage.height / 2 - view.y) / view.zoom };
  if (!center) throw new Error('Cannot place media inside a collapsed transform. Adjust its scale first.');
  return { parentId: parent?.id || null, x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2), width, height };
}
export function layoutFrameLabels(nodes: DesignNode[], zoom: number) {
  const roots = nodes.filter(node => !node.parentId && !node.hidden).map(node => {
    const box = visualBounds(node,nodes);
    return {node,left:box.x*zoom,top:box.y*zoom,width:box.width*zoom,height:box.height*zoom};
  });
  const labels: { node: DesignNode; left: number; top: number; width: number; height: number }[] = [];
  const frames = roots.filter(item => item.node.type === 'frame').sort((a, b) => a.top - b.top || a.left - b.left || a.node.id.localeCompare(b.node.id));
  for (const frame of frames) {
    if (frame.width < 48) continue;
    const bottom = frame.top - 1;
    let top = frame.top - 28;
    // Chrome occupies only clear space above its frame, even when zoom makes gutters tiny.
    for (const obstacles of [roots, labels]) for (const obstacle of obstacles) {
      if (obstacle.node.id === frame.node.id || obstacle.left >= frame.left + frame.width || obstacle.left + obstacle.width <= frame.left) continue;
      if (obstacle.top < bottom && obstacle.top + obstacle.height > top) top = Math.max(top, obstacle.top + obstacle.height + 1);
    }
    const height = Math.min(22, bottom - top);
    if (height >= 16) labels.push({ node: frame.node, left: frame.left, top, width: frame.width, height });
  }
  return labels;
}
export function newNode(type: DesignNode['type'], x: number, y: number, parentId: string | null = null): DesignNode {
  return { id: uid(), type, name: type === 'frame' ? 'New screen' : type === 'text' ? 'Text' : type[0].toUpperCase() + type.slice(1), parentId, x: Math.round(x), y: Math.round(y), width: type === 'frame' ? 390 : type === 'text' ? 340 : 200, height: type === 'frame' ? 844 : type === 'text' ? 54 : type === 'line' || type === 'arrow' ? 2 : 140, content: type === 'text' ? 'Your text here' : undefined, styles: type === 'text' ? { color: '#e8eaed', fontSize: 32, fontWeight: 500 } : { fill: type === 'frame' ? '#0b0c0e' : '#414141', radius: type === 'ellipse' ? 999 : 0, color: '#e8eaed' } };
}
