import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from 'react';
import './panel-resize.css';

export function usePanelResize(storageKey: string, defaultWidth = 336, label = 'Settings panel width') {
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const ref = useCallback((element: HTMLElement | null) => { setPanel(element); }, []);
  const [preferredWidth, setPreferredWidth] = useState(() => {
    try { const saved = Number(localStorage.getItem(storageKey)); if (Number.isFinite(saved) && saved >= 260 && saved <= 640) return saved; } catch { /* Width preferences are optional. */ }
    return defaultWidth;
  });
  const [bounds, setBounds] = useState({ min: 260, max: 640 });
  const width = Math.round(Math.min(bounds.max, Math.max(bounds.min, preferredWidth)));
  const currentWidth = useRef(width); currentWidth.current = width;
  const drag = useRef<{ pointerId: number; x: number; width: number; element: HTMLElement; cursor: string; userSelect: string } | null>(null);

  const remember = (value: number) => { try { localStorage.setItem(storageKey, String(value)); } catch { /* Width preferences are optional. */ } };
  const update = (value: number, persist = false) => {
    const next = Math.round(Math.min(bounds.max, Math.max(bounds.min, value)));
    currentWidth.current = next; setPreferredWidth(next);
    if (persist) remember(next);
  };
  const finish = (persist = true) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    document.body.style.cursor = active.cursor; document.body.style.userSelect = active.userSelect;
    if (active.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
    if (persist) remember(currentWidth.current);
  };

  useLayoutEffect(() => {
    const parent = panel?.parentElement;
    if (!parent) return;
    const measure = () => {
      const parentWidth = parent.clientWidth;
      if (!parentWidth) return;
      const max = Math.round(Math.min(640, Math.max(0, parentWidth - Math.min(180, parentWidth * .25))));
      setBounds(previous => previous.max === max ? previous : { min: Math.min(260, max), max });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(parent);
    const blur = () => finish(); window.addEventListener('blur', blur);
    return () => { observer.disconnect(); window.removeEventListener('blur', blur); finish(false); };
  }, [panel]);

  const handleProps: HTMLAttributes<HTMLDivElement> = {
    className: 'panel-resize-handle', role: 'separator', tabIndex: 0,
    'aria-label': label, 'aria-orientation': 'vertical', 'aria-valuemin': bounds.min, 'aria-valuemax': bounds.max, 'aria-valuenow': width, 'aria-valuetext': `${width} pixels`,
    title: 'Drag to resize · Arrow keys adjust width · Double-click to reset',
    onPointerDown: event => {
      event.stopPropagation();
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      finish();
      drag.current = { pointerId: event.pointerId, x: event.clientX, width: currentWidth.current, element: event.currentTarget, cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none';
    },
    onPointerMove: event => { const active = drag.current; if (active?.pointerId === event.pointerId) { event.stopPropagation(); update(active.width + active.x - event.clientX); } },
    onPointerUp: event => { if (drag.current?.pointerId === event.pointerId) { event.stopPropagation(); finish(); } },
    onPointerCancel: event => { if (drag.current?.pointerId === event.pointerId) { update(drag.current.width); finish(false); } },
    onLostPointerCapture: () => finish(),
    onDoubleClick: event => { event.preventDefault(); event.stopPropagation(); update(defaultWidth, true); },
    onKeyDown: event => {
      event.stopPropagation();
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); update(drag.current.width); finish(false); return; }
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 24 : 8;
      update(event.key === 'Home' ? bounds.min : event.key === 'End' ? bounds.max : currentWidth.current + (event.key === 'ArrowLeft' ? step : -step), true);
    },
  };
  const style: CSSProperties = { width, flexBasis: width, minWidth: 0, maxWidth: '100%' };
  return { ref, style, handleProps };
}
