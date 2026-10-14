import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { DesignSystem, NativeComponentDefinition } from '../shared/types';
import { resolvedNodes } from '../shared/export';
import { visualBounds } from '../shared/effects';
import { NodeView } from './DesignNode';

export default function ComponentPreview({ definition, system, container }: { definition: NativeComponentDefinition; system: DesignSystem; container?: RefObject<HTMLElement | null> }) {
  const shell = useRef<HTMLDivElement>(null), [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(296);
  useEffect(() => {
    if (!shell.current) return;
    setWidth(shell.current.clientWidth || 296);
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    resize?.observe(shell.current);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { root: container?.current ?? null, rootMargin: '120px' });
    if (observer) observer.observe(shell.current); else setVisible(true);
    return () => { observer?.disconnect(); resize?.disconnect(); };
  }, [container]);
  const nodes = useMemo(() => resolvedNodes(definition.nodes, system), [definition.nodes, system]);
  const root = nodes.find(node => node.id === definition.rootNodeId);
  if (!root) return null;
  const box = visualBounds(root, nodes), scale = Math.min(1, Math.max(1, width - 28) / Math.max(1, box.width), 132 / Math.max(1, box.height));
  return <div ref={shell} className="library-component-preview" aria-hidden="true">{visible && <div style={{ transform: `translate(${(width - box.width * scale) / 2 - box.x * scale}px, ${(156 - box.height * scale) / 2 - box.y * scale}px) scale(${scale})` }}><NodeView node={root} nodes={nodes} designSystem={system} interactive={false}/></div>}</div>;
}

