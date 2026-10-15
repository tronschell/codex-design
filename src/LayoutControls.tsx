import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, ArrowDown, ArrowRight, FlipHorizontal2, FlipVertical2, Move, RotateCw } from 'lucide-react';
import type { DesignNode, NodeStyle, TransformEffect } from '../shared/types';
import { nodeInnerSize, nodePadding, visualBounds } from '../shared/effects';
import { Field } from './InspectorFields';
import { Select } from './Select';

type Props = {
  node: DesignNode;
  effective: DesignNode;
  nodes: DesignNode[];
  disabled: boolean;
  gapControl: (disabled: boolean, save: (action: () => Promise<boolean>) => Promise<boolean>) => ReactNode;
  paddingControl: (disabled: boolean, save: (action: () => Promise<boolean>) => Promise<boolean>) => ReactNode;
  onPatch: (patch: Partial<DesignNode>) => Promise<boolean>;
  onStyle: (styles: Partial<NodeStyle>) => Promise<boolean>;
};
const rounded = (value: number) => Number(value.toFixed(2));
const alignmentOptions = [
  { label: 'Align left', axis: 'x', edge: 'start', Icon: AlignStartVertical },
  { label: 'Align horizontal centers', axis: 'x', edge: 'center', Icon: AlignCenterVertical },
  { label: 'Align right', axis: 'x', edge: 'end', Icon: AlignEndVertical },
  { label: 'Align top', axis: 'y', edge: 'start', Icon: AlignStartHorizontal },
  { label: 'Align vertical centers', axis: 'y', edge: 'center', Icon: AlignCenterHorizontal },
  { label: 'Align bottom', axis: 'y', edge: 'end', Icon: AlignEndHorizontal },
] as const;

export default function LayoutControls({ node, effective, nodes, disabled, gapControl, paddingControl, onPatch, onStyle }: Props) {
  const parent = nodes.find(candidate => candidate.id === node.parentId);
  const stackChild = !node.hidden && (parent?.styles.layout === 'horizontal' || parent?.styles.layout === 'vertical');
  const layout = node.styles.layout ?? 'free', stacked = layout !== 'free';
  const container = !['text', 'code', 'image', 'video', 'shader', 'line', 'arrow'].includes(node.type);
  const transform = node.effects?.find((effect): effect is TransformEffect => effect.type === 'transform' && effect.enabled !== false);
  const transformAvailable = !!transform || (node.effects?.length ?? 0) < 32;
  const section = useRef<HTMLElement>(null), pending = useRef(false), mounted = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [reset] = useState(0);
  const locked = disabled || saving;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async (action: () => Promise<boolean>) => {
    pending.current = true;
    if (mounted.current) { setSaving(true); setError(''); }
    let success = false;
    try { success = await action(); } catch { /* The autosave field retains its draft. */ }
    pending.current = false;
    if (mounted.current) { setSaving(false); if (!success) setError('Could not save this change. Your draft is kept in the field.'); }
    return success;
  };
  const patchTransform = (patch: Partial<TransformEffect>) => {
    if (!transformAvailable) return;
    const next: TransformEffect = { id: crypto.randomUUID(), type: 'transform', enabled: true, rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0, ...transform, ...patch };
    const effects = transform ? node.effects!.map(effect => effect.id === transform.id ? next : effect) : [...(node.effects ?? []), next];
    return save(() => onPatch({ effects }));
  };
  const align = (axis: 'x' | 'y', edge: 'start' | 'center' | 'end') => {
    if (!parent || stackChild) return;
    // Calculate the visual box in parent-local coordinates, retaining any layer transforms.
    const bounds = visualBounds({ ...effective, parentId: null, x: 0, y: 0 }, []);
    const inner = nodeInnerSize(parent), padding = nodePadding(parent);
    const length = axis === 'x' ? inner.width : inner.height, size = axis === 'x' ? bounds.width : bounds.height;
    const inset = axis === 'x' ? padding.x : padding.y;
    const target = edge === 'start' ? inset : edge === 'end' ? length - inset - size : (length - size) / 2;
    const coordinate = rounded(target - bounds[axis]);
    if (Number.isFinite(coordinate) && Math.abs(coordinate) <= 10_000_000) save(() => onPatch({ [axis]: coordinate }));
  };
  const transformHint = transform ? 'Edits the first enabled Transform effect. Other transforms stay intact.' : 'Adds a Transform effect. Other effects stay intact.';
  return <>
    <section ref={section} tabIndex={-1} className="inspector-section layout-section" aria-label="Layout" aria-busy={saving}>
      <h3>Layout{saving && <span className="layout-saving" role="status">Saving…</span>}</h3>
      <div className="layout-alignments" role="toolbar" aria-label="Align layer within parent">
        {alignmentOptions.map(({ label, axis, edge, Icon }) => <button type="button" key={label} aria-label={label} title={!parent ? 'Select a layer inside a container to align it.' : stackChild ? 'Position follows the parent stack. Use its alignment controls.' : `${label} within ${parent.name}`} disabled={locked || !parent || stackChild} onClick={() => align(axis, edge)}><Icon size={15}/></button>)}
      </div>
      <div className="layout-geometry-grid" key={reset}>
        <Field label="X" value={rounded(stackChild ? effective.x : node.x)} type="number" min={-10_000_000} max={10_000_000} readOnly={stackChild} disabled={locked} onChange={value => save(() => onPatch({ x: Number(value) }))}/>
        <Field label="Y" value={rounded(stackChild ? effective.y : node.y)} type="number" min={-10_000_000} max={10_000_000} readOnly={stackChild} disabled={locked} onChange={value => save(() => onPatch({ y: Number(value) }))}/>
        <span className="layout-rotation" title={transformHint}><RotateCw size={12}/><Field label="Rotation" value={rounded(transform?.rotate ?? 0)} type="number" min={-3600} max={3600} suffix="°" disabled={locked || !transformAvailable} onChange={value => patchTransform({ rotate: Number(value) })}/></span>
        <Field label="W" value={rounded(node.width)} type="number" min={0} max={1_000_000} disabled={locked} title="Fixed width in canvas pixels" onChange={value => save(() => onPatch({ width: Number(value) }))}/>
        <Field label="H" value={rounded(node.height)} type="number" min={0} max={1_000_000} disabled={locked} title="Fixed height in canvas pixels" onChange={value => save(() => onPatch({ height: Number(value) }))}/>
        <div className="layout-flips" role="group" aria-label="Flip layer">
          <button type="button" aria-label="Flip horizontally" aria-pressed={(transform?.scaleX ?? 1) < 0} title={`Flip horizontally. ${transformHint}`} disabled={locked || !transformAvailable} onClick={() => patchTransform({ scaleX: -(transform?.scaleX ?? 1) })}><FlipHorizontal2 size={15}/></button>
          <button type="button" aria-label="Flip vertically" aria-pressed={(transform?.scaleY ?? 1) < 0} title={`Flip vertically. ${transformHint}`} disabled={locked || !transformAvailable} onClick={() => patchTransform({ scaleY: -(transform?.scaleY ?? 1) })}><FlipVertical2 size={15}/></button>
        </div>
      </div>
      {stackChild && <p className="inspector-hint">Position follows the parent stack.</p>}
      {container && <>
        <div className="layout-mode-control" role="group" aria-label="Container layout">
          {([{ value: 'free', label: 'Free', Icon: Move }, { value: 'horizontal', label: 'Horizontal', Icon: ArrowRight }, { value: 'vertical', label: 'Vertical', Icon: ArrowDown }] as const).map(({value, label, Icon}) => <button type="button" key={value} aria-pressed={layout === value} title={value === 'free' ? 'Free positioning retains the current child positions.' : `${label} stack`} disabled={locked} onClick={() => save(() => onStyle({ layout: value }))}><Icon size={13}/>{label}</button>)}
        </div>
        {stacked && <div className="layout-stack-settings" key={`stack-${reset}`}>
          <label className="select-field"><span>Align</span><Select label="Stack alignment" value={node.styles.align ?? 'start'} disabled={locked} onChange={value => save(() => onStyle({ align: value as NodeStyle['align'] }))} options={[{value:'start',label:layout === 'vertical' ? 'Left' : 'Top'},{value:'center',label:'Center'},{value:'end',label:layout === 'vertical' ? 'Right' : 'Bottom'}]}/></label>
          <label className="select-field"><span>Distribute</span><Select label="Stack distribution" value={node.styles.justify ?? 'start'} disabled={locked} onChange={value => save(() => onStyle({ justify: value as NodeStyle['justify'] }))} options={[{value:'start',label:layout === 'vertical' ? 'Top' : 'Left'},{value:'center',label:'Center'},{value:'end',label:layout === 'vertical' ? 'Bottom' : 'Right'},{value:'space-between',label:'Space between'}]}/></label>
          {gapControl(locked, save)}
        </div>}
      </>}
      {error && <p className="layout-error" role="alert">{error}</p>}
    </section>
    <section className="inspector-section layout-spacing" aria-label="Spacing">
      <h3>Spacing</h3>
      {stacked && container && <div key={`inset-${reset}`}>{paddingControl(locked, save)}</div>}
      <div className="two-fields" key={`padding-${reset}`}><Field label="Pad H" value={effective.styles.paddingX ?? effective.styles.padding ?? 0} type="number" min={0} max={100_000} suffix="px" disabled={locked} title="Horizontal padding overrides uniform padding." onChange={value => save(() => onStyle({ paddingX: Number(value) }))}/><Field label="Pad V" value={effective.styles.paddingY ?? effective.styles.padding ?? 0} type="number" min={0} max={100_000} suffix="px" disabled={locked} title="Vertical padding overrides uniform padding." onChange={value => save(() => onStyle({ paddingY: Number(value) }))}/></div>
      {stackChild && <div className="two-fields" key={`margin-${reset}`}><Field label="Mar H" value={effective.styles.marginX ?? 0} type="number" min={0} max={100_000} suffix="px" disabled={locked} onChange={value => save(() => onStyle({ marginX: Number(value) }))}/><Field label="Mar V" value={effective.styles.marginY ?? 0} type="number" min={0} max={100_000} suffix="px" disabled={locked} onChange={value => save(() => onStyle({ marginY: Number(value) }))}/></div>}
    </section>
  </>;
}
