import { useState } from 'react';
import type { DesignNode, NodeStyle } from '../shared/types';
import { BOX_SIZING_VALUES, CURSOR_VALUES, OBJECT_FIT_VALUES, OVERFLOW_VALUES, POINTER_EVENTS_VALUES, TEXT_DECORATION_VALUES, TEXT_OVERFLOW_VALUES, WHITE_SPACE_VALUES } from '../shared/effects';
import { nodeStyleSchema } from '../shared/validation';
import { ColorField, Field } from './InspectorFields';
import { Select } from './Select';

export default function Advanced({ node, disabled, onChange }: { node: DesignNode; disabled?: boolean; onChange: (patch: Partial<NodeStyle>) => void }) {
  const [error, setError] = useState('');
  const s = node.styles;
  const update = (patch: Partial<NodeStyle>) => {
    const parsed = nodeStyleSchema.safeParse({ ...s, ...patch });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Use a valid CSS value.'); return; }
    setError(''); onChange(patch);
  };
  const choice = <K extends keyof NodeStyle>(property: K, label: string, fallback: string, values: readonly string[]) => <div className="select-field"><span>{label}</span><Select label={label} disabled={disabled} value={String(s[property] ?? fallback)} options={values.map(value=>({value,label:value}))} onChange={value=>update({[property]:value})}/></div>;
  const clips = ['frame', 'code', 'image', 'video', 'shader'].includes(node.type);
  return <details className="inspector-section inspector-disclosure advanced-settings">
    <summary>Advanced</summary>
    <Field label="Z-index" value={s.zIndex??'auto'} disabled={disabled} onChange={value=>update({zIndex:value.trim()==='auto'||!value.trim()?'auto':Number(value)})}/>
    {choice('overflow','Overflow',clips?'hidden':'visible',OVERFLOW_VALUES)}
    {choice('cursor','Cursor','default',CURSOR_VALUES)}
    {choice('pointerEvents','Pointer events','auto',POINTER_EVENTS_VALUES)}
    {choice('objectFit','Object fit',node.media?.fit??(node.type==='image'||node.type==='video'?'cover':'fill'),OBJECT_FIT_VALUES)}
    {choice('overflowX','Overflow X',s.overflow??(clips?'hidden':'visible'),OVERFLOW_VALUES)}
    {choice('overflowY','Overflow Y',s.overflow??(clips?'hidden':'visible'),OVERFLOW_VALUES)}
    {choice('whiteSpace','White space',node.type==='text'?'pre-wrap':'normal',WHITE_SPACE_VALUES)}
    {choice('textOverflow','Text overflow','clip',TEXT_OVERFLOW_VALUES)}
    {choice('textDecorationLine','Decoration','none',TEXT_DECORATION_VALUES)}
    <ColorField label="Decoration color" value={s.textDecorationColor??s.color??'#e8eaed'} disabled={disabled} onChange={value=>update({textDecorationColor:value})}/>
    {choice('boxSizing','Box sizing','border-box',BOX_SIZING_VALUES)}
    <Field label="Aspect ratio" title="CSS aspect ratio. Fixed design width and height take precedence." value={s.aspectRatio??'auto'} disabled={disabled} onChange={value=>update({aspectRatio:value.trim()||'auto'})}/>
    <Field label="Transition" title="CSS transition, for example opacity 200ms ease. Motion is paused while editing." value={s.transition??'none'} disabled={disabled} onChange={value=>update({transition:value.trim()||'none'})}/>
    <Field label="Animation" title="CSS animation. Named keyframes must exist in the destination stylesheet. Motion is paused while editing." value={s.animation??'none'} disabled={disabled} onChange={value=>update({animation:value.trim()||'none'})}/>
    <p className="inspector-hint">Cursor and pointer events apply in preview and exports. Layers stay selectable while editing.</p>
    {error&&<p className="asset-import-error" role="alert">{error}</p>}
  </details>;
}
