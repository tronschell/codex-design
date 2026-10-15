import type { DesignNode, NodeInteractionState, NodeStateStyle } from './types.ts';

export const NODE_STATES: readonly NodeInteractionState[] = ['hover', 'active', 'focus'];
export const NODE_STATE_LABELS: Record<NodeInteractionState, string> = { hover: 'Hover', active: 'Pressed', focus: 'Focus' };
// :focus never matches a plain div, so focus uses :focus-within, which a link overlay inside the node triggers.
export const NODE_STATE_SELECTORS: Record<NodeInteractionState, string> = { hover: ':hover', active: ':active', focus: ':focus-within' };

// The node as it looks in one state; nodes without that state are returned untouched so callers keep identity.
export function applyNodeState(node: DesignNode, state: NodeInteractionState): DesignNode {
  const override: NodeStateStyle | undefined = node.styles.states?.[state];
  if (!override) return node;
  const { states: _states, ...base } = node.styles;
  // A state fill must show even over a gradient or empty base fill.
  return { ...node, styles: { ...base, ...override, ...(override.fill === undefined ? {} : { fillMode: 'solid' as const }) } };
}
