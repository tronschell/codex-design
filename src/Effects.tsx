import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Eye, EyeOff, Plus, X } from 'lucide-react';
import type { BlurEffect, DesignNode, NodeEffect, ShadowEffect, TransformEffect } from '../shared/types';
import { EFFECT_TYPES, safeEffectColor } from '../shared/effects';
import { ColorField, Field } from './InspectorFields';
import { Select } from './Select';
import './effects.css';

type Props = { node: DesignNode; onChange: (effects: NodeEffect[]) => Promise<boolean>; disabled?: boolean };
type EffectPatch = Partial<Omit<ShadowEffect, 'id' | 'type'> & Omit<BlurEffect, 'id' | 'type'> & Omit<TransformEffect, 'id' | 'type'>>;
const labels: Record<NodeEffect['type'], string> = { 'drop-shadow': 'Drop shadow', 'inner-shadow': 'Inner shadow', 'layer-blur': 'Layer blur', 'background-blur': 'Background blur', 'text-shadow': 'Text shadow', transform: 'Transform' };
const options = Object.entries(labels).map(([value, label]) => ({ value, label }));
const emptyEffects: NodeEffect[] = [];
const compact = (value: number) => Number(value.toFixed(2));

function newEffect(type: NodeEffect['type']): NodeEffect {
  const id = crypto.randomUUID();
  if (type === 'transform') return { id, type, enabled: true, rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 };
  if (type === 'layer-blur' || type === 'background-blur') return { id, type, enabled: true, radius: 8 };
  return { id, type, enabled: true, x: 4, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 0.25 };
}

function summary(effect: NodeEffect): string {
  if (effect.type === 'layer-blur' || effect.type === 'background-blur') return `${compact(effect.radius)}px`;
  if (effect.type === 'transform') return `${compact(effect.rotate)}° · ${compact(effect.scaleX)} × ${compact(effect.scaleY)}`;
  if ('blur' in effect) return `${compact(effect.x)}, ${compact(effect.y)} · ${compact(effect.blur)}px`;
  return '';
}

export function Effects({ node, onChange, disabled = false }: Props) {
  const [effects, setEffects] = useState(node.effects ?? emptyEffects);
  const latest = useRef(effects), saved = useRef(node.effects ?? emptyEffects), pending = useRef(false), mounted = useRef(true);
  const [saving, setSaving] = useState(false);
  const locked = disabled || saving;
  const [openedId, setOpenedId] = useState<string | null>(null), [colorError, setColorError] = useState(''), [saveError, setSaveError] = useState('');
  const triggers = useRef(new Map<string, HTMLButtonElement>()), addControl = useRef<HTMLSpanElement>(null), popup = useRef<HTMLDivElement>(null), section = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const popupId = useId(), headingId = useId();
  const selected = effects.find(effect => effect.id === openedId);

  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => {
    saved.current = node.effects ?? emptyEffects;
    if (!pending.current) { latest.current = saved.current; setEffects(saved.current); }
  }, [node.effects]);
  useLayoutEffect(() => { if (disabled || openedId && !selected) setOpenedId(null); }, [disabled, openedId, selected]);

  const change = (next: NodeEffect[], focusTarget: HTMLElement | null = section.current) => {
    if (disabled || pending.current) return;
    // The project queue owns every accepted save, including after this selection unmounts.
    pending.current = true;
    (popup.current ?? focusTarget ?? section.current)?.focus({ preventScroll: true });
    latest.current = next; setEffects(next); setSaving(true); setSaveError('');
    const complete = (success: boolean) => {
      pending.current = false;
      if (!mounted.current) return;
      setSaving(false);
      if (!success) {
        if (section.current?.contains(document.activeElement) || popup.current?.contains(document.activeElement)) section.current?.focus({ preventScroll: true });
        latest.current = saved.current; setEffects(saved.current);
        setSaveError('The effects could not be saved. Your saved settings have been restored.');
      }
    };
    try { void onChange(next).then(complete, () => complete(false)); }
    catch { complete(false); }
  };
  const patch = (id: string, value: EffectPatch) => change(latest.current.map(effect => effect.id === id ? { ...effect, ...value } : effect), triggers.current.get(id) ?? section.current);
  const close = (restoreFocus = true) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && popup.current?.contains(active)) active.blur();
    if (restoreFocus && openedId) (triggers.current.get(openedId) ?? section.current)?.focus({ preventScroll: true });
    else if (pending.current && popup.current?.contains(document.activeElement)) section.current?.focus({ preventScroll: true });
    setOpenedId(null); setColorError('');
  };
  const add = (value: string) => {
    if (disabled || pending.current || latest.current.length >= 32 || !EFFECT_TYPES.includes(value as NodeEffect['type'])) return;
    const effect = newEffect(value as NodeEffect['type']);
    change([...latest.current, effect]); setColorError(''); setPosition({ visibility: 'hidden' }); setOpenedId(effect.id);
  };
  const remove = (id: string) => {
    if (disabled || pending.current) return;
    const index = latest.current.findIndex(effect => effect.id === id), next = latest.current.filter(effect => effect.id !== id);
    if (openedId === id) close(false);
    const target = triggers.current.get(next[Math.min(index, next.length - 1)]?.id) ?? section.current;
    change(next, target);
  };

  useLayoutEffect(() => {
    if (!openedId || !popup.current) return;
    const anchor = triggers.current.get(openedId), panel = popup.current;
    if (!anchor) return;
    const place = () => {
      const viewport = window.visualViewport, inset = 8, gap = 8;
      const viewportLeft = viewport?.offsetLeft ?? 0, viewportTop = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight;
      const bounds = anchor.getBoundingClientRect();
      if (bounds.bottom < viewportTop || bounds.top > viewportTop + height || !anchor.isConnected) { close(false); return; }
      const panelWidth = Math.min(288, Math.max(0, width - inset * 2));
      const preferredLeft = bounds.left - panelWidth - gap;
      const left = Math.max(viewportLeft + inset, Math.min(preferredLeft >= viewportLeft + inset ? preferredLeft : bounds.right - panelWidth, viewportLeft + width - panelWidth - inset));
      const top = Math.max(viewportTop + inset, Math.min(bounds.top - 4, viewportTop + height - Math.min(panel.scrollHeight, height - inset * 2) - inset));
      setPosition({ left, top, width: panelWidth, maxHeight: Math.max(0, height - inset * 2), visibility: 'visible' });
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.contains(target) || anchor.contains(target)) return;
      if (document.activeElement instanceof HTMLElement && panel.contains(document.activeElement)) document.activeElement.blur();
      close(false);
    };
    place();
    (panel.querySelector<HTMLInputElement>('input:not(:disabled)') ?? panel.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? panel).focus({ preventScroll: true });
    const observer = new ResizeObserver(place); observer.observe(panel); observer.observe(anchor);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.addEventListener('pointerdown', outside, true);
    window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('pointerdown', outside, true);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [openedId]);

  const popupKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'color') popup.current?.focus({ preventScroll: true });
    else if (event.key === 'Tab') {
      const controls = popup.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
      if (controls?.length && (event.shiftKey && event.target === controls[0] || !event.shiftKey && event.target === controls[controls.length - 1])) { event.preventDefault(); close(); }
    }
  };
  const number = (label: string, value: number, key: keyof EffectPatch, min: number, max: number, suffix?: string) => <Field label={label} type="number" value={value} min={min} max={max} suffix={suffix} disabled={locked} onChange={input => { if (selected) patch(selected.id, { [key]: Math.max(min, Math.min(max, Number(input))) }); }}/>;
  const shadow = selected && 'blur' in selected ? selected : null;

  return <section ref={section} tabIndex={-1} className="inspector-section effects-section" aria-labelledby={headingId} onKeyDown={event => event.stopPropagation()}>
    <h3 id={headingId}>Effects<span className="effect-actions">{saving && <span className="effect-saving" role="status">Saving…</span>}<span ref={addControl}><Select label={effects.length >= 32 ? 'Add effect (32 effect limit)' : 'Add effect'} className="effect-add-select" value="" options={options} onChange={add} disabled={locked || effects.length >= 32} triggerContent={<Plus size={15} aria-hidden="true"/>}/></span></span></h3>
    {effects.map(effect => <div key={effect.id} className={`effect-row${effect.enabled === false ? ' effect-disabled' : ''}`}>
      <button type="button" ref={element => { if (element) triggers.current.set(effect.id, element); else triggers.current.delete(effect.id); }} className={`effect-summary${openedId === effect.id ? ' active' : ''}`} aria-label={`Edit ${labels[effect.type]}`} aria-haspopup="dialog" aria-expanded={openedId === effect.id} aria-controls={openedId === effect.id ? popupId : undefined} disabled={disabled} title={`${labels[effect.type]} · ${summary(effect)}`} onClick={() => { if (openedId === effect.id) close(); else { setColorError(''); setPosition({ visibility: 'hidden' }); setOpenedId(effect.id); } }}><span>{labels[effect.type]}</span><span className="effect-summary-value">{'color' in effect && <span className="select-swatch" aria-hidden="true"><span style={{backgroundColor:effect.color,opacity:effect.opacity}}/></span>}<span>{summary(effect)}</span>{'opacity' in effect && <span>{compact(effect.opacity*100)}%</span>}</span><ChevronRight size={12} aria-hidden="true"/></button>
      <button type="button" className="icon-button effect-toggle" aria-label={`${effect.enabled === false ? 'Enable' : 'Disable'} ${labels[effect.type]}`} aria-pressed={effect.enabled !== false} title={`${effect.enabled === false ? 'Enable' : 'Disable'} ${labels[effect.type]}`} disabled={locked} onClick={() => patch(effect.id, { enabled: effect.enabled === false })}>{effect.enabled === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
      <button type="button" className="icon-button effect-remove" aria-label={`Remove ${labels[effect.type]}`} title={`Remove ${labels[effect.type]}`} disabled={locked} onClick={() => remove(effect.id)}><X size={13}/></button>
    </div>)}
    {effects.length >= 32 && <p className="inspector-hint">Maximum of 32 effects.</p>}
    {saveError && <p className="effect-error" role="alert">{saveError}</p>}
    {selected && !disabled && createPortal(<div ref={popup} id={popupId} className="effect-popover" style={position} role="dialog" aria-busy={saving} aria-label={labels[selected.type]} tabIndex={-1} onKeyDown={popupKeys} onKeyUp={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <header className="effect-popover-header"><h4>{labels[selected.type]}</h4><span className="effect-actions">{saving && <span className="effect-saving" aria-hidden="true">Saving…</span>}<button type="button" className="icon-button" aria-label={`Close ${labels[selected.type]} settings`} onClick={() => close()}><X size={14}/></button></span></header>
      <div className="effect-popover-fields" key={selected.id}>
        {shadow ? <>
          <div className="two-fields">{number('X', shadow.x, 'x', -100000, 100000, 'px')}{number('Y', shadow.y, 'y', -100000, 100000, 'px')}</div>
          {shadow.type === 'text-shadow' ? number('Blur', shadow.blur, 'blur', 0, 1000, 'px') : <div className="two-fields">{number('Blur', shadow.blur, 'blur', 0, 1000, 'px')}{number('Spread', shadow.spread, 'spread', -100000, 100000, 'px')}</div>}
          <ColorField label="Color" value={shadow.color} disabled={locked} title="CSS color or hex value" onChange={input => {
            const value = input.trim();
            if (!safeEffectColor(value) || !CSS.supports('color', value)) { setColorError('Use a valid CSS color, such as #000000 or rgb(0 0 0).'); return; }
            setColorError(''); patch(shadow.id, { color: value });
          }}/>
          {colorError && <p className="effect-error" role="alert">{colorError}</p>}
          <Field label="Opacity" type="number" value={compact(shadow.opacity * 100)} min={0} max={100} suffix="%" disabled={locked} onChange={input => patch(shadow.id, { opacity: Math.max(0, Math.min(100, Number(input))) / 100 })}/>
        </> : selected.type === 'transform' ? <>
          {number('Rotate', selected.rotate, 'rotate', -3600, 3600, '°')}
          <div className="two-fields">{number('Scale X', selected.scaleX, 'scaleX', -100, 100, '×')}{number('Scale Y', selected.scaleY, 'scaleY', -100, 100, '×')}</div>
          <div className="two-fields">{number('Skew X', selected.skewX, 'skewX', -89, 89, '°')}{number('Skew Y', selected.skewY, 'skewY', -89, 89, '°')}</div>
          <div className="two-fields">{number('Move X', selected.translateX, 'translateX', -100000, 100000, 'px')}{number('Move Y', selected.translateY, 'translateY', -100000, 100000, 'px')}</div>
        </> : 'radius' in selected ? number('Radius', selected.radius, 'radius', 0, 1000, 'px') : null}
      </div>
    </div>, document.body)}
  </section>;
}
