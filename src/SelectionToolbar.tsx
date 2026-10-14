import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlignCenter, AlignLeft, AlignRight, Bold, Check, ChevronDown, Radius, Italic, Link, List, MessageCirclePlus, MoreVertical, SquareDashed, Type, Underline, X } from 'lucide-react';
import type { BindableStyleProperty, DesignNode, DesignProject, NodeStyle, Operation } from '../shared/types';
import { safeColor } from '../shared/effects';
import { isSafeLink } from '../shared/links';
import { Field, ColorField } from './InspectorFields';
import { Select } from './Select';
import './selection-toolbar.css';

type Menu = 'type' | 'color' | 'radius' | 'spacing' | 'link';
type Props = {
  project: DesignProject; pageId: string; node: DesignNode; effective: DesignNode;
  anchor: { left: number; top: number; width: number; height: number };
  viewport: { width: number; height: number }; editable: boolean; stackChild: boolean; disabled: boolean;
  onChange: (operations: Operation[]) => Promise<DesignProject | null>;
  onComment: () => void; onInspect: () => void; onDuplicate: () => void; onDelete: () => void;
};
const typography = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] as const;
const names = { fontFamily: 'Font', fontSize: 'Size', fontWeight: 'Weight', lineHeight: 'Line height', letterSpacing: 'Tracking' };

export default function SelectionToolbar({ project, pageId, node, effective, anchor, viewport, editable, stackChild, disabled, onChange, onComment, onInspect, onDuplicate, onDelete }: Props) {
  const toolbar = useRef<HTMLDivElement>(null), popup = useRef<HTMLDivElement>(null), triggers = useRef(new Map<Menu, HTMLButtonElement>());
  const mounted = useRef(true), pending = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 32 }), [menu, setMenu] = useState<Menu | null>(null);
  const [tab, setTab] = useState<'theme' | 'custom'>('theme'), [query, setQuery] = useState('');
  const [color, setColor] = useState(''), [href, setHref] = useState(node.href ?? ''), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [fieldVersion, setFieldVersion] = useState(0);
  const [popupPosition, setPopupPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const locked = disabled || saving, blocked = locked || !editable, text = node.type === 'text', s = effective.styles;
  const colorProperty = text ? 'color' : 'fill', currentColor = s[colorProperty] ?? (text ? '#e8eaed' : 'transparent');
  const typeToken = project.designSystem.tokens.find(token => token.id === node.tokenBindings?.fontSize);
  const themeTokens = useMemo(() => project.designSystem.tokens.filter(token => menu === 'color' ? token.kind === 'color' : typography.includes(token.kind as typeof typography[number])).filter(token => (token.name + ' ' + token.value).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [project.designSystem.tokens, menu, query]);
  const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - size.width / 2, viewport.width - size.width - 8));
  const above = anchor.top - size.height - 12;
  const top = Math.max(48, Math.min(above >= 48 ? above : anchor.top + anchor.height + 12, viewport.height - size.height - 8));

  useLayoutEffect(() => {
    mounted.current = true;
    const element = toolbar.current;
    if (!element) return;
    const measure = () => setSize(previous => { const width = element.offsetWidth, height = element.offsetHeight; return previous.width === width && previous.height === height ? previous : { width, height }; });
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => { mounted.current = false; observer.disconnect(); };
  }, []);
  const close = (restoreFocus = true) => {
    if (document.activeElement instanceof HTMLElement && popup.current?.contains(document.activeElement)) document.activeElement.blur();
    if (restoreFocus) { const trigger = menu ? triggers.current.get(menu) : null; (trigger && !pending.current && !trigger.disabled ? trigger : toolbar.current)?.focus({ preventScroll: true }); }
    setMenu(null); setError('');
  };
  const open = (next: Menu) => {
    if (menu === next) { close(); return; }
    setMenu(next); setTab('theme'); setQuery(''); setError(''); setColor(String(currentColor)); setHref(node.href ?? ''); setPopupPosition({ visibility: 'hidden' });
  };
  const save = async (patch: Partial<DesignNode>, finish = false) => {
    if (disabled || pending.current) return false;
    pending.current = true; (popup.current ?? toolbar.current)?.focus({ preventScroll: true }); setSaving(true); setError('');
    let success = false;
    try { success = !!await onChange([{ type: 'update_node', pageId, nodeId: node.id, patch }]); }
    catch { /* The saved document stays authoritative after a rejected edit. */ }
    finally { pending.current = false; if (mounted.current) { setSaving(false); if (!success) { setFieldVersion(value => value + 1); setError('Could not save. Review the current settings and try again.'); } else if (finish) close(); } }
    return success;
  };
  const style = (value: Partial<NodeStyle>, finish = false) => {
    if (!editable) return;
    const tokenBindings = { ...node.tokenBindings }; let detached = false;
    for (const property of Object.keys(value) as BindableStyleProperty[]) if (tokenBindings[property]) { delete tokenBindings[property]; detached = true; }
    void save({ styles: value, ...(detached ? { tokenBindings } : {}) }, finish);
  };
  const bind = (property: BindableStyleProperty, id: string, finish = true) => { if (editable) void save({ tokenBindings: { ...node.tokenBindings, [property]: id } }, finish); };

  useLayoutEffect(() => {
    if (!menu || !popup.current) return;
    const control = triggers.current.get(menu), panel = popup.current;
    if (!control) return;
    const place = () => {
      const v = window.visualViewport, x = v?.offsetLeft ?? 0, y = v?.offsetTop ?? 0, width = v?.width ?? window.innerWidth, height = v?.height ?? window.innerHeight;
      const rect = control.getBoundingClientRect(), panelWidth = Math.min(288, width - 16);
      const below = Math.max(0, y + height - rect.bottom - 14), above = Math.max(0, rect.top - y - 14), upwards = above > below && below < Math.min(320, panel.scrollHeight);
      const maxHeight = upwards ? above : below, panelHeight = Math.min(panel.scrollHeight, maxHeight);
      setPopupPosition({ position: 'fixed', left: Math.max(x + 8, Math.min(rect.left, x + width - panelWidth - 8)), top: Math.max(y + 8, upwards ? rect.top - panelHeight - 6 : rect.bottom + 6), width: panelWidth, maxHeight, visibility: 'visible' });
    };
    const outside = (event: PointerEvent) => { const target = event.target as HTMLElement; if (!toolbar.current?.contains(target) && !panel.contains(target) && !target.closest('.select-popup')) close(false); };
    place();
    const observer = new ResizeObserver(place); observer.observe(panel); observer.observe(control);
    window.addEventListener('pointerdown', outside, true); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    vListen(true);
    function vListen(add: boolean) { const v = window.visualViewport; if (add) { v?.addEventListener('resize', place); v?.addEventListener('scroll', place); } else { v?.removeEventListener('resize', place); v?.removeEventListener('scroll', place); } }
    return () => { observer.disconnect(); window.removeEventListener('pointerdown', outside, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); vListen(false); };
  }, [menu, left, top, size.width, size.height]);

  useLayoutEffect(() => {
    if (!menu) return;
    const frame = requestAnimationFrame(() => { const panel = popup.current; (panel?.querySelector<HTMLInputElement>('input:not(:disabled)') ?? panel)?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [menu]);

  const button = (id: Menu, label: string, icon: ReactNode, extraClass = '') => <button type="button" ref={element => { if (element) triggers.current.set(id, element); else triggers.current.delete(id); }} className={'quick-button ' + extraClass + (menu === id ? ' active' : '')} aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={menu === id} aria-controls={menu === id ? 'selection-properties-popup' : undefined} disabled={blocked} onClick={() => open(id)}>{icon}</button>;
  const number = (label: string, property: keyof NodeStyle, fallback: number, min = 0, max = 100000, disabledField = false) => <Field label={label} type="number" value={s[property] as number | undefined ?? fallback} min={min} max={max} suffix={property === 'fontWeight' ? undefined : 'px'} disabled={blocked || disabledField} onChange={value => style({ [property]: Number(value) })}/>;
  const radiusTokens = project.designSystem.tokens.filter(token => token.kind === 'radius');
  const more = (action: string) => {
    close(false);
    if (action === 'inspect') onInspect();
    else if (action === 'duplicate') { toolbar.current?.focus({ preventScroll: true }); onDuplicate(); }
    else if (action === 'delete' && editable) onDelete();
    else if (action === 'hide' && editable) void save({ hidden: true });
    else if (action === 'lock') void save({ locked: !node.locked });
  };
  const Align = s.textAlign === 'center' ? AlignCenter : s.textAlign === 'right' ? AlignRight : AlignLeft;
  return <div ref={toolbar} className="selection-toolbar" role="toolbar" aria-label={text ? 'Text quick properties' : 'Object quick properties'} aria-busy={saving} tabIndex={-1} style={{ left, top, maxWidth: Math.max(0, viewport.width - 16), visibility: size.width ? 'visible' : 'hidden' }} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } }} onWheel={event => event.stopPropagation()}>
    {text && button('type', 'Typography styles', <><Type size={13}/><span>{typeToken?.name ?? (s.fontSize ?? 16) + ' px'}</span><ChevronDown size={12}/></>, 'quick-type')}
    {button('color', text ? 'Text color' : 'Fill color', <span className="quick-swatch" aria-hidden="true"><span style={{ background: currentColor }}/></span>)}
    {text ? <>
      <button className={'quick-button' + ((s.fontWeight ?? 400) >= 600 ? ' active' : '')} aria-label="Bold" title="Bold" aria-pressed={(s.fontWeight ?? 400) >= 600} disabled={blocked} onClick={() => style({ fontWeight: (s.fontWeight ?? 400) >= 600 ? 400 : 700 })}><Bold size={16}/></button>
      <button className={'quick-button' + (s.fontStyle === 'italic' ? ' active' : '')} aria-label="Italic" title="Italic" aria-pressed={s.fontStyle === 'italic'} disabled={blocked} onClick={() => style({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic size={16}/></button>
      <button className={'quick-button' + (s.textDecorationLine === 'underline' ? ' active' : '')} aria-label="Underline" title="Underline" aria-pressed={s.textDecorationLine === 'underline'} disabled={blocked} onClick={() => style({ textDecorationLine: s.textDecorationLine === 'underline' ? 'none' : 'underline' })}><Underline size={16}/></button>
      {button('link', 'Link', <Link size={16}/>, node.href ? 'has-value' : '')}<span className="quick-divider"/>
      <Select className="quick-select" label="List style" value={s.listStyleType ?? 'none'} options={[{value:'none',label:'No list'},{value:'disc',label:'Bulleted list'},{value:'decimal',label:'Numbered list'}]} disabled={blocked} onChange={value => style({listStyleType:value as NodeStyle['listStyleType']})} triggerContent={<List size={16}/>}/>
      <Select className="quick-select" label="Text alignment" value={s.textAlign ?? 'left'} options={[{value:'left',label:'Align left'},{value:'center',label:'Align center'},{value:'right',label:'Align right'}]} disabled={blocked} onChange={value => style({textAlign:value as NodeStyle['textAlign']})} triggerContent={<Align size={16}/>}/>
    </> : <>
      <Select className="quick-select" label="Object layout" value={s.layout ?? 'free'} options={[{value:'free',label:'Free position · preserve arrangement'},{value:'vertical',label:'Vertical stack'},{value:'horizontal',label:'Horizontal stack'}]} disabled={blocked} onChange={value => style({layout:value as NodeStyle['layout']})} triggerContent={<AlignLeft size={16}/>}/><span className="quick-divider"/>
      {button('radius', 'Corner radius', <Radius size={16}/>)}{button('spacing', 'Padding and margin', <SquareDashed size={16}/>)}
    </>}
    <span className="quick-divider"/><button className="quick-button" aria-label="Comment on this component" title="Comment on this component" disabled={locked} onClick={onComment}><MessageCirclePlus size={16}/></button>
    <Select className="quick-select" label="More object actions" value="" disabled={locked} options={[{value:'inspect',label:'Open Properties'},{value:'duplicate',label:'Duplicate'},{value:'hide',label:'Hide',disabled:!editable},{value:'lock',label:node.locked?'Unlock':'Lock'},{value:'delete',label:'Delete',disabled:!editable}]} onChange={more} triggerContent={<MoreVertical size={16}/>}/>
    {saving && <span className="quick-saving" role="status">Saving…</span>}
    {error && !menu && <span className="quick-error" role="alert">{error}</span>}
    {menu && createPortal(<div ref={popup} id="selection-properties-popup" className="selection-properties-popup" role="dialog" aria-label={{type:'Typography styles',color:text?'Text color':'Fill color',radius:'Corner radius',spacing:'Padding and margin',link:'Link'}[menu]} aria-busy={saving} tabIndex={-1} style={popupPosition} onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close(); } }}>
      <header><strong>{{type:'Typography',color:text?'Text color':'Fill',radius:'Corner radius',spacing:'Spacing',link:'Link'}[menu]}</strong><button type="button" className="icon-button" aria-label="Close quick properties" onClick={() => close()}><X size={14}/></button></header>
      {(menu === 'type' || menu === 'color') && <><div className="quick-tabs" role="tablist" aria-label="Style source">{(['theme','custom'] as const).map(value => <button type="button" key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'theme' ? 'Theme' : 'Custom'}</button>)}</div>{tab === 'theme' ? <><input className="quick-search" aria-label={menu === 'color' ? 'Search colors' : 'Search typography'} placeholder={menu === 'color' ? 'Search colors' : 'Search typography'} value={query} onChange={event => setQuery(event.target.value)}/><div className="quick-token-list">{menu === 'color' && <button type="button" className="quick-token" disabled={blocked} onClick={() => style({[colorProperty]:'transparent'},true)}><span>{text ? 'Transparent' : 'No fill'}</span><span className="quick-swatch"/></button>}{themeTokens.map(token => {
        const property = menu === 'color' ? colorProperty : token.kind as BindableStyleProperty;
        return <button type="button" className="quick-token" key={token.id} disabled={blocked} onClick={() => bind(property,token.id)}><span><strong>{token.name}</strong><small>{menu === 'color' ? token.value : names[property as keyof typeof names] + ' · ' + token.value + (property === 'fontSize' || property === 'letterSpacing' ? ' px' : '')}</small></span>{node.tokenBindings?.[property] === token.id && <Check size={13} aria-label="Linked"/>}{menu === 'color' && <span className="quick-swatch" aria-hidden="true"><span style={{background:String(token.value)}}/></span>}</button>;
      })}{!themeTokens.length && <p className="inspector-hint">No matching {menu === 'color' ? 'colors' : 'typography tokens'}. Use Custom or add tokens in the project design system.</p>}</div></> : menu === 'color' ? <form className="quick-fields" onSubmit={event => { event.preventDefault(); const value = color.trim(); if (!safeColor(value) || !CSS.supports('color',value)) { setError('Enter a valid CSS color.'); return; } style({[colorProperty]:value},true); }}><ColorField label="Color" value={color} onChange={setColor} disabled={blocked}/><button type="submit" className="secondary-button" disabled={blocked}>Apply color</button></form> : <div className="quick-fields" key={fieldVersion}><Field label="Font" value={s.fontFamily ?? project.tokens.fontFamily} disabled={blocked} onChange={value => style({fontFamily:value})}/>{number('Size','fontSize',16,1,1024)}{number('Weight','fontWeight',400,1,1000)}<Field label="Line height" type="number" min={0.1} max={10} value={s.lineHeight ?? 1.24} disabled={blocked} onChange={value => style({lineHeight:Number(value)})}/>{number('Tracking','letterSpacing',(s.fontSize ?? 16) * ((s.fontSize ?? 16) >= 24 ? -0.035 : -0.01),-1000,1000)}</div>}</>}
      {menu === 'radius' && <div className="quick-fields" key={fieldVersion}>{number('Radius','radius',0)}{radiusTokens.length > 0 && <Select label="Radius token" value={node.tokenBindings?.radius ?? ''} disabled={blocked} options={[{value:'',label:'Custom'},...radiusTokens.map(token => ({value:token.id,label:token.name+' · '+token.value+' px'}))]} onChange={id => id ? bind('radius',id,false) : style({radius:s.radius ?? 0})}/>}</div>}
      {menu === 'spacing' && <div className="quick-fields" key={fieldVersion}><strong>Padding</strong><div className="two-fields" role="group" aria-label="Padding">{number('H','paddingX',s.padding ?? 0)}{number('V','paddingY',s.padding ?? 0)}</div><strong>Margin</strong><div className="two-fields" role="group" aria-label="Margin">{number('H','marginX',0,0,100000,!stackChild)}{number('V','marginY',0,0,100000,!stackChild)}</div>{!stackChild && <p className="inspector-hint">Margins apply inside a parent stack.</p>}{s.layout && s.layout !== 'free' && <>{number('Gap','gap',0)}<Select label="Stack alignment" value={s.align ?? 'start'} disabled={blocked} options={[{value:'start',label:'Align start'},{value:'center',label:'Align center'},{value:'end',label:'Align end'}]} onChange={value => style({align:value as NodeStyle['align']})}/><Select label="Stack distribution" value={s.justify ?? 'start'} disabled={blocked} options={[{value:'start',label:'Distribute start'},{value:'center',label:'Distribute center'},{value:'end',label:'Distribute end'},{value:'space-between',label:'Space between'}]} onChange={value => style({justify:value as NodeStyle['justify']})}/></>}</div>}
      {menu === 'link' && <form className="quick-fields" onSubmit={event => { event.preventDefault(); const value = href.trim(); if (!isSafeLink(value)) { setError('Use https://, http://, mailto:, tel: or a # fragment.'); return; } void save({href:value},true); }}><label className="quick-link-label">URL<input type="text" aria-label="Link URL" value={href} maxLength={2048} placeholder="https://example.com" disabled={blocked} onChange={event => setHref(event.target.value)}/></label><div className="quick-form-actions"><button type="submit" className="secondary-button" disabled={blocked}>Apply link</button>{node.href && <button type="button" className="text-button" disabled={blocked} onClick={() => { void save({href:''},true); }}>Remove link</button>}</div><p className="inspector-hint">Links work in preview and exported interfaces.</p></form>}
      {error && <p className="quick-popup-error" role="alert">{error}</p>}
    </div>,document.body)}
  </div>;
}
