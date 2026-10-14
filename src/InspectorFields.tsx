import { useEffect, useRef, useState } from 'react';
import { colorParts, withOpacity } from './color-picker';

export function Field({ label, value, onChange, type = 'text', suffix, min, max, readOnly = false, disabled = false, step = 'any', title }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; suffix?: string; min?: number; max?: number; readOnly?: boolean; disabled?: boolean; step?: string | number; title?: string }) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => { setDraft(String(value)); }, [value]);
  return <label className="property-field"><span>{label}</span><div className="field-input"><input aria-label={label} type={type} step={type === 'number' ? step : undefined} disabled={disabled} value={draft} min={min} max={max} readOnly={readOnly} title={readOnly ? 'Position follows the parent stack.' : title} onChange={e => setDraft(e.target.value)} onBlur={() => { if (cancelled.current) { cancelled.current = false; return; } if (readOnly || disabled) { setDraft(String(value)); return; } let next = draft; if (type === 'number') { const number = Number(draft); if (!Number.isFinite(number) || !draft.trim()) { setDraft(String(value)); return; } next = String(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, number))); } setDraft(next); if (next !== String(value)) onChange(next); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelled.current = true; setDraft(String(value)); e.currentTarget.blur(); } }} />{suffix && <span>{suffix}</span>}</div></label>;
}

export function ColorField({ label, value, onChange, title, disabled = false }: { label: string; value: string; onChange: (color: string) => void; title?: string; disabled?: boolean }) {
  const color = colorParts(value);
  return <div className="color-field"><label className="color-swatch" title={title ?? `${label} color`} style={{ background: value }}><input aria-label={`${label} picker`} type="color" disabled={disabled} value={color.hex} onChange={e => onChange(withOpacity(e.target.value, color.opacity > 0 ? color.opacity : 1))} /></label><Field label={label} value={value} onChange={onChange} title={title} disabled={disabled} /></div>;
}
