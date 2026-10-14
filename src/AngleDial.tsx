import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { isMac } from './shortcuts';

type Props = { value: number; disabled: boolean; identity: string; reset: number; onBegin: () => boolean; onPreview: (value: number) => void; onCommit: () => void; onCancel: () => void };
type Session = { pointer?: number; raw: number };
type Modifiers = { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean };
const limit = (value: number) => Math.max(-3600, Math.min(3600, value));
const snap = (event: Modifiers) => event.shiftKey || event.metaKey || event.ctrlKey;

export default function AngleDial(props: Props) {
  const button = useRef<HTMLButtonElement>(null), session = useRef<Session | null>(null), latest = useRef(props);
  const [snapping, setSnapping] = useState(false);
  latest.current = props;
  const end = (commit: boolean) => {
    const active = session.current; session.current = null;
    if (!active) return;
    setSnapping(false);
    if (active.pointer !== undefined && button.current?.hasPointerCapture(active.pointer)) button.current.releasePointerCapture(active.pointer);
    if (commit && !latest.current.disabled) latest.current.onCommit(); else latest.current.onCancel();
  };
  const preview = (raw: number, event: Modifiers) => {
    if (!session.current || latest.current.disabled) return;
    session.current.raw = limit(raw); setSnapping(snap(event));
    latest.current.onPreview(limit(Number((snap(event) ? Math.round(raw / 15) * 15 : raw).toFixed(1))));
  };
  const point = (x: number, y: number, event: Modifiers) => {
    const active = session.current, bounds = button.current?.getBoundingClientRect();
    if (!active || !bounds) return;
    const dx = x - bounds.left - bounds.width / 2, dy = y - bounds.top - bounds.height / 2;
    if (Math.hypot(dx, dy) < 3) return;
    const degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    // Keep equivalent turns near the current value when crossing the top of the dial.
    preview(degrees + Math.round((active.raw - degrees) / 360) * 360, event);
  };
  useLayoutEffect(() => { if (session.current) end(false); }, [props.identity, props.reset, props.disabled]);
  useLayoutEffect(() => {
    const cancel = () => end(false);
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden); if (session.current) { session.current = null; latest.current.onCancel(); } };
  }, []);
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || latest.current.disabled) return;
    if (event.key === 'Escape') { event.preventDefault(); end(false); return; }
    if (['Shift', 'Control', 'Meta'].includes(event.key)) { if (session.current) preview(session.current.raw, event); return; }
    if (event.key === 'Enter') { event.preventDefault(); if (session.current?.pointer === undefined) end(true); return; }
    if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (session.current?.pointer !== undefined) return;
    if (!session.current) { if (!latest.current.onBegin()) return; session.current = { raw: latest.current.value }; }
    const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1;
    const value = session.current.raw;
    preview(snap(event) ? (direction > 0 ? Math.floor(value / 15) + 1 : Math.ceil(value / 15) - 1) * 15 : value + direction, event);
  };
  return <button ref={button} type="button" role="slider" className={`appearance-angle-dial${snapping ? ' is-snapping' : ''}`} disabled={props.disabled} aria-label="Gradient angle dial" aria-valuemin={-3600} aria-valuemax={3600} aria-valuenow={props.value} aria-valuetext={`${props.value} degrees`} title={`Drag angle · Shift or ${isMac ? '⌘' : 'Ctrl'} snaps to 15° · Arrow keys adjust by 1°`} onPointerDown={event => {
    if (event.button !== 0 || latest.current.disabled) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    if (session.current || !latest.current.onBegin()) return;
    session.current = { pointer: event.pointerId, raw: latest.current.value };
    event.currentTarget.setPointerCapture(event.pointerId); point(event.clientX, event.clientY, event);
  }} onPointerMove={event => { if (session.current?.pointer === event.pointerId) point(event.clientX, event.clientY, event); }} onPointerUp={event => {
    if (session.current?.pointer !== event.pointerId) return;
    point(event.clientX, event.clientY, event); end(true);
  }} onPointerCancel={() => end(false)} onLostPointerCapture={event => { if (session.current?.pointer === event.pointerId) end(false); }} onBlur={() => end(session.current?.pointer === undefined && document.hasFocus())} onKeyDown={keyDown} onKeyUp={event => {
    event.stopPropagation();
    if (session.current && ['Shift', 'Control', 'Meta'].includes(event.key)) preview(session.current.raw, event);
    if (session.current?.pointer === undefined && ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) end(true);
  }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path className="angle-dial-ticks" d="M12 2v2m8 8h2M12 20v2M2 12h2"/><g transform={`rotate(${props.value} 12 12)`}><path d="M12 12V5"/><circle cx="12" cy="5" r="1.4"/></g><circle cx="12" cy="12" r="1.25"/></svg>
  </button>;
}
