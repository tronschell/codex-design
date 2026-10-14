import type { DesignNode, TransformEffect } from './types.js';

export const EFFECT_TYPES = ['drop-shadow', 'inner-shadow', 'text-shadow', 'layer-blur', 'background-blur', 'transform'] as const;
export const OVERFLOW_VALUES = ['visible', 'hidden', 'clip', 'scroll', 'auto'] as const;
export const CURSOR_VALUES = ['auto', 'default', 'none', 'context-menu', 'help', 'pointer', 'progress', 'wait', 'cell', 'crosshair', 'text', 'vertical-text', 'alias', 'copy', 'move', 'no-drop', 'not-allowed', 'grab', 'grabbing', 'all-scroll', 'col-resize', 'row-resize', 'n-resize', 'e-resize', 's-resize', 'w-resize', 'ne-resize', 'nw-resize', 'se-resize', 'sw-resize', 'ew-resize', 'ns-resize', 'nesw-resize', 'nwse-resize', 'zoom-in', 'zoom-out'] as const;
export const POINTER_EVENTS_VALUES = ['auto', 'none'] as const;
export const OBJECT_FIT_VALUES = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;
export const WHITE_SPACE_VALUES = ['normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line', 'break-spaces'] as const;
export const TEXT_OVERFLOW_VALUES = ['clip', 'ellipsis'] as const;
export const TEXT_DECORATION_VALUES = ['none', 'underline', 'overline', 'line-through'] as const;
export const BOX_SIZING_VALUES = ['border-box', 'content-box'] as const;
export const ADVANCED_STYLE_PROPERTIES = ['zIndex', 'overflow', 'overflowX', 'overflowY', 'cursor', 'pointerEvents', 'objectFit', 'whiteSpace', 'textOverflow', 'textDecorationLine', 'textDecorationColor', 'boxSizing', 'aspectRatio', 'transition', 'animation'] as const;

export const safeCssText = (value: string) => !/[;{}<>\\\x00-\x1f\x7f!@]/.test(value) && !/\/\*|\*\/|(?:url|var|env|expression)\s*\(/i.test(value);
export const safeColor = (value: string) => {
  if (!safeCssText(value) || value.length > 500) return false;
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) || /^[a-z]+$/i.test(value)) return true;
  return /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([a-z\d\s.,%+\-/]*\)$/i.test(value);
};

export const safeEffectColor = (value: string) => safeColor(value) && !/^(?:inherit|initial|unset|revert|revert-layer)$/i.test(value);

export function effectCss(node: DesignNode): Record<string, string> {
  const boxShadows: string[] = [], textShadows: string[] = [], filters: string[] = [], backdropFilters: string[] = [], transforms: string[] = [];
  for (const effect of node.effects ?? []) {
    if (effect.enabled === false) continue;
    if (effect.type === 'layer-blur') filters.push(`blur(${effect.radius}px)`);
    else if (effect.type === 'background-blur') backdropFilters.push(`blur(${effect.radius}px)`);
    else if (effect.type === 'transform') transforms.push(`translate(${effect.translateX}px, ${effect.translateY}px) rotate(${effect.rotate}deg) skew(${effect.skewX}deg, ${effect.skewY}deg) scale(${effect.scaleX}, ${effect.scaleY})`);
    else if (effect.type === 'drop-shadow' || effect.type === 'inner-shadow' || effect.type === 'text-shadow') {
      const color = effect.opacity === 1 ? effect.color : `color-mix(in srgb, ${effect.color} ${effect.opacity * 100}%, transparent)`;
      const shadow = `${effect.x}px ${effect.y}px ${effect.blur}px`;
      if (effect.type === 'text-shadow') textShadows.push(`${shadow} ${color}`);
      else boxShadows.push(`${effect.type === 'inner-shadow' ? 'inset ' : ''}${shadow} ${effect.spread}px ${color}`);
    }
  }
  return {
    ...(boxShadows.length ? { boxShadow: boxShadows.join(', ') } : {}),
    ...(textShadows.length ? { textShadow: textShadows.join(', ') } : {}),
    ...(filters.length ? { filter: filters.join(' ') } : {}),
    ...(backdropFilters.length ? { backdropFilter: backdropFilters.join(' '), WebkitBackdropFilter: backdropFilters.join(' ') } : {}),
    ...(transforms.length ? { transform: transforms.join(' '), transformOrigin: '50% 50%' } : {}),
  };
}

type Matrix = [number, number, number, number, number, number];
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const transformsFor = (node: DesignNode) => (node.effects ?? []).filter((effect): effect is TransformEffect => effect.type === 'transform' && effect.enabled !== false);
function ancestors(node: DesignNode, nodes: DesignNode[]): DesignNode[] {
  const result: DesignNode[] = [], seen = new Set<string>();
  let current: DesignNode | undefined = node;
  while (current && !seen.has(current.id)) {
    result.push(current); seen.add(current.id);
    const parentId: string | null = current.parentId;
    current = parentId ? nodes.find(item => item.id === parentId) : undefined;
  }
  return result;
}
function borderInsets(node: DesignNode) {
  if (node.type === 'line' || node.type === 'arrow') return { x: 0, y: Math.max(1, node.styles.borderWidth ?? node.height) };
  const border = node.styles.borderColor ? node.styles.borderWidth ?? 1 : 0;
  return { x: border, y: border };
}
export function nodePadding(node: DesignNode) {
  return { x: node.styles.paddingX ?? node.styles.padding ?? 0, y: node.styles.paddingY ?? node.styles.padding ?? 0 };
}
export function nodeBoxSize(node: DesignNode) {
  const border = borderInsets(node), padding = node.styles.paddingX !== undefined || node.styles.paddingY !== undefined ? nodePadding(node) : { x: 0, y: 0 };
  const width = border.x * 2 + padding.x * 2, height = border.y * (node.type === 'line' || node.type === 'arrow' ? 1 : 2) + padding.y * 2;
  return node.styles.boxSizing === 'content-box' ? { width: node.width + width, height: node.height + height } : { width: Math.max(node.width, width), height: Math.max(node.height, height) };
}
export function nodeInnerSize(node: DesignNode) {
  const border = borderInsets(node), size = nodeBoxSize(node);
  return { width: Math.max(0, size.width - border.x * 2), height: Math.max(0, size.height - border.y * (node.type === 'line' || node.type === 'arrow' ? 1 : 2)) };
}
function worldMatrix(node: DesignNode, nodes: DesignNode[]): Matrix {
  let matrix = identity(), inset = { x: 0, y: 0 };
  for (const current of ancestors(node, nodes).reverse()) {
    const size = nodeBoxSize(current), cx = size.width / 2, cy = size.height / 2;
    matrix = multiply(matrix, translation(current.x + inset.x + cx, current.y + inset.y + cy));
    for (const effect of transformsFor(current)) {
      const radians = effect.rotate * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
      matrix = multiply(matrix, translation(effect.translateX, effect.translateY));
      matrix = multiply(matrix, [cos, sin, -sin, cos, 0, 0]);
      matrix = multiply(matrix, [1, Math.tan(effect.skewY * Math.PI / 180), Math.tan(effect.skewX * Math.PI / 180), 1, 0, 0]);
      matrix = multiply(matrix, [effect.scaleX, 0, 0, effect.scaleY, 0, 0]);
    }
    matrix = multiply(matrix, translation(-cx, -cy));
    inset = borderInsets(current);
  }
  return matrix;
}

export function hasTransformedAncestor(node: DesignNode, nodes: DesignNode[]): boolean {
  return ancestors(node, nodes).some(current => transformsFor(current).length > 0);
}

export function visualBounds(node: DesignNode, nodes: DesignNode[]): { x: number; y: number; width: number; height: number } {
  const [a, b, c, d, e, f] = worldMatrix(node, nodes), size = nodeBoxSize(node);
  const points = [[0, 0], [size.width, 0], [0, size.height], [size.width, size.height]].map(([x, y]) => ({ x: a * x + c * y + e, y: b * x + d * y + f }));
  const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
  const width = Math.max(...points.map(point => point.x)) - x, height = Math.max(...points.map(point => point.y)) - y;
  if ([x, y, width, height].every(Number.isFinite)) return { x, y, width, height };
  // shortcut: overflowing transforms use layout bounds; use scaled affine math if such extreme coordinates need editing.
  const position = { x: 0, y: 0 };
  ancestors(node, nodes).forEach((current, index) => { const inset = index ? borderInsets(current) : { x: 0, y: 0 }; position.x += current.x + inset.x; position.y += current.y + inset.y; });
  return { ...position, ...size };
}

function inverseVector(matrix: Matrix, delta: { x: number; y: number }): { x: number; y: number } | null {
  const [a, b, c, d] = matrix, determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
  const result = { x: (d * delta.x - c * delta.y) / determinant, y: (a * delta.y - b * delta.x) / determinant };
  return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null;
}

export function parentLocalDelta(node: DesignNode, nodes: DesignNode[], delta: { x: number; y: number }): { x: number; y: number } | null {
  const parent = nodes.find(item => item.id === node.parentId);
  return parent ? inverseVector(worldMatrix(parent, nodes), delta) : delta;
}

export function parentLocalPoint(parentId: string | null, nodes: DesignNode[], point: { x: number; y: number }): { x: number; y: number } | null {
  if (!parentId) return point;
  const parent = nodes.find(item => item.id === parentId);
  if (!parent) return null;
  const matrix = worldMatrix(parent, nodes), local = inverseVector(matrix, { x: point.x - matrix[4], y: point.y - matrix[5] });
  if (!local) return null;
  const inset = borderInsets(parent);
  return { x: local.x - inset.x, y: local.y - inset.y };
}
