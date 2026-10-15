import type { DesignNode, NodeInteractionState, NodeStateStyle } from './types.ts';

export const NODE_STATES: readonly NodeInteractionState[] = ['hover', 'active', 'focus'];
// Rules are emitted in this order so later states win ties: pressing a focused, hovered control shows Pressed.
export const NODE_STATE_CASCADE: readonly NodeInteractionState[] = ['focus', 'hover', 'active'];
export const NODE_STATE_LABELS: Record<NodeInteractionState, string> = { hover: 'Hover', active: 'Pressed', focus: 'Focus' };
// Layers are divs, so focus means a focused link inside the layer. :focus-visible keeps a mouse click from leaving focus styling stuck.
export const NODE_STATE_SELECTORS: Record<NodeInteractionState, string> = { hover: ':hover', active: ':active', focus: ':has(:focus-visible)' };

// The node as it looks in one state; nodes without that state are returned untouched so callers keep identity.
export function applyNodeState(node: DesignNode, state: NodeInteractionState): DesignNode {
  const override: NodeStateStyle | undefined = node.styles.states?.[state];
  if (!override) return node;
  const { states: _states, ...base } = node.styles;
  const styles = { ...base, ...override, ...(override.fill === undefined ? {} : { fillMode: 'solid' as const }) };
  // A border added only for a state would shrink the box and shift positioned children; draw it as an inset outline instead.
  if (override.borderColor !== undefined && base.borderColor === undefined && !node.tokenBindings?.borderColor && base.outlineColor === undefined && override.outlineColor === undefined) {
    const width = base.borderWidth ?? 1;
    Object.assign(styles, { outlineColor: override.borderColor, outlineWidth: width, outlineOffset: -width });
    delete styles.borderColor;
  }
  return { ...node, styles };
}

// Drops state keys a layer type never renders, empty states and a live flag on non-code layers, so saved data matches what exports emit.
// Mutates only the node's own fields; styles and states are replaced, never edited, because they may be shared with the previous revision.
export function normalizeNodeData(node: DesignNode): DesignNode {
  if (node.live !== undefined && (!node.live || node.type !== 'code')) delete node.live;
  const states = node.styles.states;
  if (!states) return node;
  const inert = new Set<string>(node.type === 'text' ? ['fill'] : node.type === 'arrow' ? ['color', 'borderColor'] : ['color']);
  const next: NonNullable<typeof states> = {};
  for (const state of NODE_STATES) {
    const entries = Object.entries(states[state] ?? {}).filter(([key, value]) => value !== undefined && !inert.has(key));
    if (entries.length) next[state] = Object.fromEntries(entries) as NodeStateStyle;
  }
  if (JSON.stringify(next) === JSON.stringify(states)) return node;
  const { states: _states, ...styles } = node.styles;
  node.styles = Object.keys(next).length ? { ...styles, states: next } : styles;
  return node;
}
