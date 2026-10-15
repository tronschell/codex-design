import { useEffect, useState } from 'react';
import type { DesignNode, NodeInteractionState, NodeStateStyle, NodeStyle } from '../shared/types';
import { NODE_STATE_LABELS } from '../shared/node-states';
import { nodeStyleSchema } from '../shared/validation';
import { ColorField, Field } from './InspectorFields';

export type StateView = { id: string; state: NodeInteractionState } | null;
const choices = ['default', 'hover', 'active', 'focus'] as const;
const segment = 'tw:flex tw:h-6 tw:min-w-0 tw:flex-1 tw:items-center tw:justify-center tw:rounded-[4px] tw:border-0 tw:bg-transparent tw:px-1 tw:text-[11px] tw:leading-none tw:text-[#b1b1b1] tw:hover:bg-[#303030] tw:hover:text-[#e7e7e7] tw:aria-pressed:bg-[#414141] tw:aria-pressed:text-[#eee] tw:focus-visible:outline tw:focus-visible:outline-1 tw:focus-visible:outline-[#6ba6ff]';

// Edits a layer's hover/pressed/focus styles. The chosen state is previewed on the selected layer only, so every other layer renders exactly as before.
export default function StateStyles({ node, disabled, onChange, onView }: { node: DesignNode; disabled?: boolean; onChange: (states: NonNullable<NodeStyle['states']>) => unknown; onView: (view: StateView) => void }) {
  const [state, setState] = useState<(typeof choices)[number]>('default'), [error, setError] = useState('');
  useEffect(() => { onView(state === 'default' ? null : { id: node.id, state }); }, [state, node.id, onView]);
  useEffect(() => () => onView(null), [onView]);
  const s = node.styles, current = state === 'default' ? undefined : s.states?.[state], text = node.type === 'text';
  const write = (patch: Partial<NodeStateStyle>) => {
    if (state === 'default') return false;
    const next: NodeStateStyle = { ...current, ...patch };
    for (const key of Object.keys(next) as (keyof NodeStateStyle)[]) if (next[key] === undefined) delete next[key];
    const states = { ...s.states, [state]: next };
    const parsed = nodeStyleSchema.safeParse({ ...s, states });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Use a valid CSS value.'); return false; }
    setError(''); return onChange(states);
  };
  const color = (key: 'fill' | 'color' | 'borderColor' | 'outlineColor', label: string, fallback: string) => <ColorField label={`${label} (${state})`} value={current?.[key] ?? s[key] ?? fallback} disabled={disabled} onChange={value => write({ [key]: value })}/>;
  return <details className="inspector-section inspector-disclosure" onToggle={event => { if (!event.currentTarget.open) setState('default'); }}>
    <summary>States</summary>
    <div className="tw:flex tw:items-stretch tw:gap-0.5 tw:rounded-[6px] tw:border tw:border-solid tw:border-[#383838] tw:bg-[#252525] tw:p-0.5" role="group" aria-label="Layer state">
      {choices.map(choice => <button key={choice} type="button" className={segment} aria-pressed={state === choice} onClick={() => { setError(''); setState(choice); }}>{choice === 'default' ? 'Default' : NODE_STATE_LABELS[choice]}</button>)}
    </div>
    {state === 'default'
      ? <p className="inspector-hint">Choose Hover, Pressed or Focus to style that state. HTML and React exports apply it as CSS; only the selected layer previews here.</p>
      : <>
        {text ? color('color', 'Text', '#e8eaed') : color('fill', 'Fill', 'transparent')}
        <Field label={`Opacity (${state})`} type="number" min={0} max={1} step={0.05} value={current?.opacity ?? s.opacity ?? 1} disabled={disabled} onChange={value => write({ opacity: value.trim() ? Number(value) : undefined })}/>
        {!text && color('borderColor', 'Border', 'transparent')}
        {color('outlineColor', 'Outline', 'transparent')}
        {!text && <Field label={`Shadow (${state})`} title="CSS box-shadow, for example 0 8px 24px rgba(0,0,0,.4)" value={current?.shadow ?? s.shadow ?? 'none'} disabled={disabled} onChange={value => write({ shadow: value.trim() && value.trim() !== 'none' ? value.trim() : undefined })}/>}
        <div className="tw:flex tw:justify-end"><button type="button" className="secondary-button" disabled={disabled || !current} onClick={() => { const { [state]: _removed, ...rest } = s.states ?? {}; setError(''); onChange(rest); }}>Reset {NODE_STATE_LABELS[state].toLowerCase()}</button></div>
        <p className="inspector-hint">Exports use :hover, :active and :focus-within. Unset values keep the default style.</p>
      </>}
    {error && <p className="asset-import-error" role="alert">{error}</p>}
  </details>;
}
