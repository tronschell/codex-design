import { colorParts, withOpacity } from './color-picker';
import { AutosaveInput } from './AutosaveFields';

export function Field({ label, value, onChange, type = 'text', suffix, min, max, readOnly = false, disabled = false, step = 'any', title, autoSave = true }: { label: string; value: string | number; onChange: (value: string) => unknown; autoSave?: boolean; type?: string; suffix?: string; min?: number; max?: number; readOnly?: boolean; disabled?: boolean; step?: string | number; title?: string }) {
  return <label className="property-field"><span>{label}</span><div className="field-input">{autoSave ? <AutosaveInput key={label} aria-label={label} type={type} step={type === 'number' ? step : undefined} disabled={disabled} value={String(value)} onSave={onChange} normalize={value => value.trim()} min={min} max={max} readOnly={readOnly} title={readOnly ? 'Position follows the parent stack.' : title}/> : <input aria-label={label} type={type} value={String(value)} disabled={disabled} readOnly={readOnly} min={min} max={max} step={type === 'number' ? step : undefined} title={title} onChange={event => onChange(event.target.value)}/>} {suffix && <span>{suffix}</span>}</div></label>;
}

export function ColorField({ label, value, onChange, title, disabled = false, autoSave = true }: { label: string; value: string; onChange: (color: string) => unknown; autoSave?: boolean; title?: string; disabled?: boolean }) {
  const color = colorParts(value);
  return <div className="color-field"><label className="color-swatch" title={title ?? `${label} color`} style={{ background: value }}><input aria-label={`${label} picker`} type="color" disabled={disabled} value={color.hex} onChange={e => onChange(withOpacity(e.target.value, color.opacity > 0 ? color.opacity : 1))} /></label><Field autoSave={autoSave} label={label} value={value} onChange={autoSave ? value => { if (!CSS.supports('color', value.trim())) throw new Error('Enter a valid CSS color.'); return onChange(value.trim()); } : onChange} title={title} disabled={disabled} /></div>;
}
