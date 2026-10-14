import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Link2, Minus, Plus } from 'lucide-react';
import type { BindableStyleProperty, DesignNode, DesignSystem, GradientFill, GradientStop, NodeStyle } from '../shared/types';
import { BLEND_MODES, gradientCss } from '../shared/appearance';
import { compatibleTokenKinds } from '../shared/design-system';
import { safeCssText, safeEffectColor } from '../shared/effects';
import { Select } from './Select';
import './appearance-controls.css';

type Props = {
  node: DesignNode;
  effective: DesignNode;
  system: DesignSystem;
  disabled: boolean;
  onChange: (styles: Partial<NodeStyle>) => Promise<boolean>;
  onBind: (property: BindableStyleProperty, id: string) => Promise<boolean>;
};
type InputProps = {
  label: string;
  value: string | number;
  onCommit: (value: string) => void;
  disabled: boolean;
  identity: string;
  reset: number;
  type?: 'text' | 'number';
  min?: number;
  max?: number;
  suffix?: string;
  shortLabel?: string;
  stacked?: boolean;
  hiddenLabel?: boolean;
  title?: string;
};
const compact = (value: number) => Number(value.toFixed(2));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const colorIsValid = (value: string) => safeEffectColor(value) && CSS.supports('color', value);

function DraftField({ label, value, onCommit, disabled, identity, reset, type = 'text', min, max, suffix, shortLabel, stacked, hiddenLabel, title }: InputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false), dirty = useRef(false), focusIdentity = useRef(identity), latest = useRef(String(value));
  latest.current = String(value);
  useLayoutEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  useLayoutEffect(() => { focused.current = false; dirty.current = false; setDraft(latest.current); }, [identity, reset]);
  const cancel = () => { dirty.current = false; setDraft(latest.current); };
  const commit = () => {
    focused.current = false;
    if (disabled || focusIdentity.current !== identity || !dirty.current) { cancel(); return; }
    dirty.current = false;
    let next = draft.trim();
    if (type === 'number') {
      if (!next || !Number.isFinite(Number(next))) { cancel(); return; }
      next = String(clamp(Number(next), min ?? -Infinity, max ?? Infinity));
    }
    setDraft(next);
    if (next !== latest.current) onCommit(next);
    else setDraft(latest.current);
  };
  return <label className={`property-field appearance-field${stacked ? ' appearance-stacked' : ''}${hiddenLabel ? ' appearance-hidden-label' : ''}`}>
    <span>{shortLabel ?? label}</span>
    <div className="field-input"><input aria-label={label} type={type} step={type === 'number' ? 'any' : undefined} min={min} max={max} value={draft} disabled={disabled} title={title} onFocus={() => { focused.current = true; focusIdentity.current = identity; }} onChange={event => { dirty.current = true; setDraft(event.target.value); }} onBlur={commit} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Enter') event.currentTarget.blur();
      if (event.key === 'Escape') { event.preventDefault(); cancel(); event.currentTarget.blur(); }
    }}/>{suffix && <span>{suffix}</span>}</div>
  </label>;
}

let colorContext: CanvasRenderingContext2D | null | undefined;
function colorParts(value: string) {
  const hex = /^#([a-f\d]{3,4}|[a-f\d]{6}|[a-f\d]{8})$/i.exec(value)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map(channel => channel + channel).join('') : hex;
    return { hex: `#${expanded.slice(0, 6)}`, opacity: expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1 };
  }
  colorContext ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!colorContext || !colorIsValid(value)) return { hex: '#171717', opacity: 1 };
  colorContext.clearRect(0, 0, 1, 1); colorContext.fillStyle = '#000000'; colorContext.fillStyle = value; colorContext.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data;
  return { hex: `#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`, opacity: alpha / 255 };
}
function withOpacity(value: string, opacity: number) {
  const { hex } = colorParts(value);
  return opacity === 1 ? hex : `${hex}${Math.round(clamp(opacity, 0, 1) * 255).toString(16).padStart(2, '0')}`;
}

function ColorControl({ label, shortLabel, value, onCommit, disabled, identity, reset, stacked = false, opacity = 1 }: { label: string; shortLabel?: string; value: string; onCommit: (value: string) => void; disabled: boolean; identity: string; reset: number; stacked?: boolean; opacity?: number }) {
  const input = useRef<HTMLInputElement>(null), pickerIdentity = useRef(identity), dirty = useRef(false);
  const [picker, setPicker] = useState(() => colorParts(value).hex);
  const current = useRef({ value, disabled, identity, onCommit }); current.current = { value, disabled, identity, onCommit };
  useLayoutEffect(() => { if (!dirty.current) setPicker(colorParts(value).hex); }, [value]);
  useLayoutEffect(() => { dirty.current = false; setPicker(colorParts(value).hex); }, [identity, reset]);
  const commitPicker = () => {
    const latest = current.current;
    if (!dirty.current) return;
    dirty.current = false;
    if (latest.disabled || pickerIdentity.current !== latest.identity) { setPicker(colorParts(latest.value).hex); return; }
    const color = input.current?.value;
    const opacity = colorParts(latest.value).opacity;
    if (color) latest.onCommit(withOpacity(color, opacity > 0 ? opacity : 1));
  };
  useLayoutEffect(() => {
    const pickerInput = input.current;
    // Native change fires when the picker accepts a color; input events only preview its swatch.
    pickerInput?.addEventListener('change', commitPicker);
    return () => pickerInput?.removeEventListener('change', commitPicker);
  }, []);
  return <div className={`appearance-color-field${stacked ? ' appearance-stacked' : ''}`}>
    <span>{shortLabel ?? label}</span><div className="appearance-color-value">
      <label className="appearance-swatch" title={`${label} picker`}><span style={{ backgroundColor: dirty.current ? picker : value, opacity }}/><input ref={input} type="color" aria-label={`${label} picker`} value={picker} disabled={disabled} onFocus={() => { pickerIdentity.current = identity; }} onInput={event => { if (!disabled && pickerIdentity.current === identity) { dirty.current = true; setPicker(event.currentTarget.value); } }} onBlur={commitPicker}/></label>
      <DraftField label={label} hiddenLabel value={value} onCommit={onCommit} disabled={disabled} identity={identity} reset={reset} title="CSS color or hex value"/>
    </div>
  </div>;
}

function OpacityRange({ value, disabled, identity, reset, onCommit }: { value: number; disabled: boolean; identity: string; reset: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  const active = useRef(false), dirty = useRef(false), source = useRef(identity), latest = useRef(value), draftRef = useRef(value);
  latest.current = value;
  const update = (next: number) => { draftRef.current = next; setDraft(next); };
  useLayoutEffect(() => { if (!active.current) update(value); }, [value]);
  useLayoutEffect(() => { active.current = false; dirty.current = false; update(latest.current); }, [identity, reset]);
  const cancel = () => { active.current = false; dirty.current = false; update(latest.current); };
  const commit = () => {
    active.current = false;
    if (disabled || source.current !== identity || !dirty.current) { cancel(); return; }
    dirty.current = false;
    if (draftRef.current !== latest.current) onCommit(draftRef.current);
  };
  return <input className="appearance-opacity-range" type="range" aria-label="Layer opacity slider" min={0} max={100} step={1} value={compact(draft * 100)} disabled={disabled} onPointerDown={() => { source.current = identity; active.current = true; }} onChange={event => { if (disabled || source.current !== identity) return; dirty.current = true; update(Number(event.target.value) / 100); }} onPointerUp={commit} onPointerCancel={cancel} onBlur={commit} onKeyDown={event => {
    event.stopPropagation(); active.current = true; source.current = identity;
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
  }} onKeyUp={event => { event.stopPropagation(); if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit(); }}/>
}

function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const id = useId();
  return <section className="inspector-section appearance-section" aria-labelledby={id}><header><h3 id={id}>{title}</h3>{actions}</header><div className="appearance-section-content">{children}</div></section>;
}

function newGradient(color: string): GradientFill {
  return { type: 'linear', angle: 90, interpolation: 'srgb', stops: [{ id: crypto.randomUUID(), color, position: 0, opacity: 1 }, { id: crypto.randomUUID(), color, position: 100, opacity: 0 }] };
}

export default function AppearanceControls({ node, effective, system, disabled, onChange, onBind }: Props) {
  const [styles, setStyles] = useState(effective.styles), [saving, setSaving] = useState(false), [error, setError] = useState(''), [reset, setReset] = useState(0);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(node.styles.gradient?.stops[0]?.id ?? null);
  const latest = useRef(styles), saved = useRef(effective.styles), pending = useRef(false), operation = useRef(0), mounted = useRef(true);
  const context = useRef({ id: node.id, disabled }); context.current = { id: node.id, disabled }; saved.current = effective.styles;
  const panel = useRef<HTMLDivElement>(null), track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: string; nodeId: string; pointer?: number; moved: boolean; base: NodeStyle } | null>(null);
  const fallbackGradient = useRef<GradientFill | null>(null);
  const locked = disabled || saving;
  const line = node.type === 'line' || node.type === 'arrow', text = node.type === 'text';
  const supportsFill = !text && !line, supportsRadius = !text && !line && node.type !== 'ellipse';
  const fillMode = styles.fillMode ?? 'solid', radiusMode = styles.radiusMode ?? 'uniform';
  const gradient = styles.gradient ?? (fallbackGradient.current ??= newGradient(styles.fill ?? '#171717'));
  const stop = gradient.stops.find(item => item.id === selectedStopId) ?? gradient.stops[0];
  const radius = styles.radius ?? 0;
  const corners = styles.cornerRadii ?? { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
  const setCurrent = (next: NodeStyle) => { latest.current = next; setStyles(next); };
  const cancelGesture = () => { if (gesture.current) { gesture.current = null; setCurrent(saved.current); } };

  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current++; }; }, []);
  useLayoutEffect(() => {
    operation.current++; pending.current = false; gesture.current = null; fallbackGradient.current = null;
    setCurrent(effective.styles); setSaving(false); setError(''); setReset(value => value + 1); setSelectedStopId(node.styles.gradient?.stops[0]?.id ?? null);
  }, [node.id]);
  useLayoutEffect(() => { if (!pending.current && !gesture.current) setCurrent(effective.styles); }, [effective.styles]);
  useLayoutEffect(() => { if (disabled) { cancelGesture(); setReset(value => value + 1); } }, [disabled]);
  useLayoutEffect(() => { const cancel = () => cancelGesture(); window.addEventListener('blur', cancel); return () => window.removeEventListener('blur', cancel); }, []);

  const mutate = (action: () => Promise<boolean>, next = latest.current) => {
    if (!mounted.current || context.current.disabled || context.current.id !== node.id || pending.current) return;
    const targetId = node.id, token = ++operation.current, beforeSaved = saved.current;
    pending.current = true;
    if (panel.current?.contains(document.activeElement)) panel.current.focus({ preventScroll: true });
    setCurrent(next); setSaving(true); setError('');
    const complete = (success: boolean) => {
      if (!mounted.current || operation.current !== token || context.current.id !== targetId) return;
      pending.current = false; setSaving(false);
      if (!success) {
        setCurrent(saved.current); setReset(value => value + 1);
        setError('Could not save appearance. Your saved settings have been restored.');
      } else if (saved.current !== beforeSaved) setCurrent(saved.current);
    };
    try { void action().then(complete, () => complete(false)); } catch { complete(false); }
  };
  const change = (patch: Partial<NodeStyle>) => mutate(() => onChange(patch), { ...latest.current, ...patch });
  const reject = (message: string) => { setError(message); setReset(value => value + 1); };
  const color = (label: string, patch: (value: string) => Partial<NodeStyle>) => (input: string) => {
    const value = input.trim();
    if (!colorIsValid(value)) { reject(`Use a valid ${label.toLowerCase()}, such as #4497ff or rgb(68 151 255).`); return; }
    change(patch(value));
  };
  const common = { disabled: locked, identity: node.id, reset };
  const number = (label: string, value: number, onCommit: (value: number) => void, options: Partial<Pick<InputProps, 'min' | 'max' | 'suffix' | 'shortLabel' | 'stacked' | 'hiddenLabel' | 'title' | 'identity'>> = {}) => <DraftField {...common} label={label} value={compact(value)} type="number" onCommit={input => onCommit(Number(input))} {...options}/>;
  const tokenControl = (property: BindableStyleProperty, label: string) => {
    const tokenId = node.tokenBindings?.[property] ?? '', tokens = system.tokens.filter(token => compatibleTokenKinds(property).includes(token.kind)), linked = tokens.find(token => token.id === tokenId);
    const hint = tokenId ? `Linked to ${linked?.name ?? 'unavailable token'}. Custom edits detach this token.` : `Link ${label.toLowerCase()} to a design token.`;
    return <span className={`appearance-token-link${tokenId ? ' is-linked' : ''}`} title={hint}><Select label={`${label} token: ${linked?.name ?? (tokenId ? 'Unavailable token' : 'Custom')}`} className="appearance-token-select" disabled={locked} value={tokenId} options={[{ value: '', label: 'Custom' }, ...(tokenId && !linked ? [{ value: tokenId, label: 'Unavailable token', disabled: true }] : []), ...tokens.map(token => ({ value: token.id, label: `${token.name} · ${token.value}`, ...(token.kind === 'color' ? { color: String(token.value) } : {}) }))]} triggerContent={<Link2 size={13} aria-hidden="true"/>} onChange={id => mutate(() => onBind(property, id))}/></span>;
  };
  const linked = (property: BindableStyleProperty, label: string, field: ReactNode) => <div className="appearance-linked-control">{field}{tokenControl(property, label)}</div>;
  const patchGradient = (patch: Partial<GradientFill>) => change({ gradient: { ...(latest.current.gradient ?? gradient), ...patch } });
  const patchStop = (patch: Partial<Omit<GradientStop, 'id'>>) => {
    const current = latest.current.gradient ?? gradient;
    patchGradient({ stops: current.stops.map(item => item.id === stop.id ? { ...item, ...patch } : item).sort((a, b) => a.position - b.position) });
  };
  const addStop = (position?: number) => {
    if (locked || pending.current || gradient.stops.length >= 12) return;
    const ordered = [...gradient.stops].sort((a, b) => a.position - b.position);
    if (position === undefined) {
      let start = 0, end = ordered[0].position;
      for (let index = 0; index < ordered.length; index++) {
        const next = ordered[index + 1]?.position ?? 100;
        if (next - ordered[index].position > end - start) { start = ordered[index].position; end = next; }
      }
      position = compact((start + end) / 2);
    }
    const next: GradientStop = { id: crypto.randomUUID(), color: stop.color, opacity: stop.opacity, position: clamp(position, 0, 100) };
    setSelectedStopId(next.id); patchGradient({ stops: [...ordered, next].sort((a, b) => a.position - b.position) });
  };
  const removeStop = (id = stop.id) => {
    if (locked || pending.current || gradient.stops.length <= 2) return;
    const index = gradient.stops.findIndex(item => item.id === id), next = gradient.stops.filter(item => item.id !== id);
    setSelectedStopId(next[Math.min(index, next.length - 1)].id); patchGradient({ stops: next });
  };
  const previewStop = (id: string, position: number) => {
    const current = latest.current.gradient ?? gradient;
    setCurrent({ ...latest.current, gradient: { ...current, stops: current.stops.map(item => item.id === id ? { ...item, position: compact(clamp(position, 0, 100)) } : item) } });
    if (gesture.current) gesture.current.moved = true;
  };
  const finishGesture = () => {
    const current = gesture.current; gesture.current = null;
    if (!current || !current.moved) return;
    if (context.current.disabled || context.current.id !== current.nodeId || pending.current) { setCurrent(saved.current); return; }
    if (JSON.stringify(current.base.gradient) !== JSON.stringify(latest.current.gradient)) change({ gradient: latest.current.gradient });
  };
  const stopPointerDown = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (locked || pending.current || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    if (pending.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedStopId(id); gesture.current = { id, nodeId: node.id, pointer: event.pointerId, moved: false, base: latest.current };
  };
  const stopPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current, bounds = track.current?.getBoundingClientRect();
    if (!current || current.pointer !== event.pointerId || !bounds?.width || pending.current || context.current.disabled || context.current.id !== current.nodeId) return;
    previewStop(current.id, (event.clientX - bounds.left) / bounds.width * 100);
  };
  const stopKeyDown = (event: KeyboardEvent<HTMLButtonElement>, item: GradientStop) => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); cancelGesture(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeStop(item.id); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key) || locked || pending.current) return;
    event.preventDefault(); setSelectedStopId(item.id);
    gesture.current ??= { id: item.id, nodeId: node.id, moved: false, base: latest.current };
    const position = (latest.current.gradient ?? gradient).stops.find(current => current.id === item.id)?.position ?? item.position;
    previewStop(item.id, event.key === 'Home' ? 0 : event.key === 'End' ? 100 : position + (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) * (event.shiftKey ? 10 : 1));
  };

  return <div ref={panel} className="appearance-controls" role="group" aria-label="Appearance" aria-busy={saving} tabIndex={-1} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    {saving && <div className="appearance-save-status" role="status">Saving appearance…</div>}
    {error && <p className="appearance-error" role="alert">{error}</p>}
    {supportsRadius && <Section title="Radius" actions={<div className="appearance-segments appearance-radius-mode" role="group" aria-label="Corner radius mode">
      {(['uniform', 'individual'] as const).map(mode => <button key={mode} type="button" disabled={locked} aria-pressed={radiusMode === mode} onClick={() => change({ radiusMode: mode, ...(mode === 'individual' && !styles.cornerRadii ? { cornerRadii: corners } : {}) })}>{mode === 'uniform' ? 'All' : 'Individual'}</button>)}
    </div>}>
      {radiusMode === 'uniform' ? linked('radius', 'Radius', number('Corner radius', radius, value => change({ radius: value }), { min: 0, max: 100000, suffix: 'px', shortLabel: 'Radius' })) : <div className="appearance-corners">
        {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner, index) => <div key={corner}>{number(`${['Top left', 'Top right', 'Bottom left', 'Bottom right'][index]} radius`, corners[corner], value => change({ cornerRadii: { ...corners, [corner]: value } }), { min: 0, max: 100000, suffix: 'px', shortLabel: ['TL', 'TR', 'BL', 'BR'][index] })}</div>)}
      </div>}
    </Section>}
    <Section title="Blending">
      <div className="appearance-select-row"><span>Mode</span><Select label="Blend mode" value={styles.blendMode ?? 'normal'} disabled={locked} options={BLEND_MODES.map(value => ({ value, label: value.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '), disabled: !CSS.supports('mix-blend-mode', value) }))} onChange={value => change({ blendMode: value as NodeStyle['blendMode'] })}/></div>
      <div className="appearance-layer-opacity"><span>Opacity</span><OpacityRange value={styles.opacity ?? 1} disabled={locked} identity={node.id} reset={reset} onCommit={value => change({ opacity: value })}/>{number('Layer opacity', (styles.opacity ?? 1) * 100, value => change({ opacity: value / 100 }), { min: 0, max: 100, suffix: '%', hiddenLabel: true })}{tokenControl('opacity', 'Opacity')}</div>
    </Section>
    {supportsFill && <Section title="Fill">
      <div className="appearance-segments appearance-fill-mode" role="group" aria-label="Fill mode">{(['solid', 'gradient', 'none'] as const).map(mode => <button key={mode} type="button" disabled={locked} aria-pressed={fillMode === mode} onClick={() => {
        const initial = mode === 'gradient' && !styles.gradient ? newGradient(styles.fill ?? '#171717') : undefined;
        if (initial) setSelectedStopId(initial.stops[0].id);
        change({ fillMode: mode, ...(initial ? { gradient: initial } : {}) });
      }}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
      {fillMode === 'solid' && <div className="appearance-fill-color-row">
        {linked('fill', 'Fill', <ColorControl {...common} label="Fill color" shortLabel="Color" value={styles.fill ?? 'transparent'} opacity={styles.fillOpacity ?? 1} stacked onCommit={color('fill color', value => ({ fill: value }))}/>)}
        {number('Fill opacity', (styles.fillOpacity ?? 1) * 100, value => change({ fillOpacity: value / 100 }), { min: 0, max: 100, suffix: '%', stacked: true, shortLabel: 'Opacity', title: 'Fill opacity combines with the color’s own opacity.' })}
      </div>}
      {fillMode === 'gradient' && <div className="appearance-gradient-editor">
        <div className="appearance-gradient-kind"><Select label="Gradient type" value={gradient.type} disabled={locked} options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }]} onChange={value => patchGradient({ type: value as GradientFill['type'] })}/>{gradient.type === 'linear' && number('Gradient angle', gradient.angle, value => patchGradient({ angle: value }), { min: -3600, max: 3600, suffix: '°', shortLabel: 'Angle' })}</div>
        <div className="appearance-gradient-strip">
          <div ref={track} className="appearance-gradient-track" title="Double-click to add a color stop" onDoubleClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); addStop(compact((event.clientX - bounds.left) / bounds.width * 100)); }}><div style={{ background: gradientCss({ ...gradient, type: 'linear', angle: 90 }) }}/></div>
          <div className="appearance-gradient-pins">{gradient.stops.map((item, index) => <button key={item.id} type="button" role="slider" className={`appearance-gradient-stop${item.id === stop.id ? ' is-selected' : ''}`} style={{ left: `${item.position}%` }} disabled={locked} aria-label={`Gradient stop ${index + 1} position`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.position} aria-valuetext={`${item.position} percent, ${item.color}`} title={`${item.color} · ${item.position}%. Drag or use arrow keys to move.`} onClick={() => setSelectedStopId(item.id)} onFocus={() => setSelectedStopId(item.id)} onPointerDown={event => stopPointerDown(event, item.id)} onPointerMove={stopPointerMove} onPointerUp={event => { if (gesture.current?.pointer === event.pointerId) finishGesture(); }} onPointerCancel={cancelGesture} onLostPointerCapture={() => { if (gesture.current?.pointer !== undefined) cancelGesture(); }} onKeyDown={event => stopKeyDown(event, item)} onKeyUp={event => { event.stopPropagation(); if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) finishGesture(); }} onBlur={finishGesture}><span><i style={{ backgroundColor: item.color, opacity: item.opacity }}/></span></button>)}</div>
        </div>
        <div className="appearance-stop-heading"><span>Stops <span>{gradient.stops.length}/12</span></span><div><button type="button" className="icon-button" disabled={locked || gradient.stops.length <= 2} aria-label="Remove selected gradient stop" title={gradient.stops.length <= 2 ? 'A gradient needs at least two stops' : 'Remove selected stop'} onClick={() => removeStop()}><Minus size={13}/></button><button type="button" className="icon-button" disabled={locked || gradient.stops.length >= 12} aria-label="Add gradient stop" title="Add color stop" onClick={() => addStop()}><Plus size={13}/></button></div></div>
        <div className="appearance-stop-color-row"><ColorControl {...common} identity={`${node.id}/stop/${stop.id}`} label="Stop color" value={stop.color} opacity={stop.opacity} stacked onCommit={color('stop color', value => ({ gradient: { ...(latest.current.gradient ?? gradient), stops: (latest.current.gradient ?? gradient).stops.map(item => item.id === stop.id ? { ...item, color: value } : item) } }))}/>{number('Stop opacity', stop.opacity * 100, value => patchStop({ opacity: value / 100 }), { min: 0, max: 100, suffix: '%', stacked: true, shortLabel: 'Opacity', identity: `${node.id}/stop/${stop.id}` })}</div>
        <div className="appearance-gradient-values">{number('Stop position', stop.position, value => patchStop({ position: value }), { min: 0, max: 100, suffix: '%', shortLabel: 'Position', identity: `${node.id}/stop/${stop.id}` })}<Select label="Gradient interpolation" value={gradient.interpolation} disabled={locked} options={[{ value: 'srgb', label: 'sRGB' }, { value: 'oklab', label: 'Oklab' }]} onChange={value => patchGradient({ interpolation: value as GradientFill['interpolation'] })}/></div>
      </div>}
      {fillMode === 'none' && <p className="appearance-no-fill">No fill</p>}
    </Section>}
    <Section title={line ? 'Stroke' : 'Border'}>
      {line && linked('fill', 'Stroke color', <ColorControl {...common} label="Stroke color" shortLabel="Color" value={styles.fill ?? styles.color ?? '#777777'} onCommit={color('stroke color', value => ({ fill: value }))}/>)}
      {!line && linked('borderColor', 'Border color', <ColorControl {...common} label="Border color" shortLabel="Color" value={styles.borderColor ?? '#343434'} onCommit={color('border color', value => ({ borderColor: value }))}/>)}
      {linked('borderWidth', line ? 'Stroke width' : 'Border width', number(line ? 'Stroke width' : 'Border width', line ? Math.max(1, styles.borderWidth ?? node.height) : styles.borderWidth ?? (styles.borderColor ? 1 : 0), value => change({ borderWidth: value, ...(!line && !styles.borderColor ? { borderColor: '#343434' } : {}) }), { min: line ? 1 : 0, max: 1000, suffix: 'px', shortLabel: 'Width' }))}
    </Section>
    {!line && <Section title="Outline">
      <ColorControl {...common} label="Outline color" shortLabel="Color" value={styles.outlineColor ?? '#4497ff'} onCommit={color('outline color', value => ({ outlineColor: value }))}/>
      <div className="appearance-outline-values">{number('Outline width', styles.outlineWidth ?? (styles.outlineColor ? 1 : 0), value => change({ outlineWidth: value, ...(!styles.outlineColor ? { outlineColor: '#4497ff' } : {}) }), { min: 0, max: 1000, suffix: 'px', shortLabel: 'Width' })}{number('Outline offset', styles.outlineOffset ?? 0, value => change({ outlineOffset: value }), { min: -100000, max: 100000, suffix: 'px', shortLabel: 'Offset' })}</div>
    </Section>}
    <Section title="Shadow">{linked('shadow', 'Shadow', <DraftField {...common} label="CSS shadow" shortLabel="CSS" value={styles.shadow ?? 'none'} onCommit={input => {
      if (!safeCssText(input) || !CSS.supports('box-shadow', input)) { reject('Use a valid CSS shadow, such as 0 4px 12px #00000040, or none.'); return; }
      change({ shadow: input });
    }}/>)}</Section>
  </div>;
}
