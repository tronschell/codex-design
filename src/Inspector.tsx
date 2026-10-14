import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowRight, Check, ChevronDown, ChevronRight, Code2, Copy, Eye, EyeOff, Frame, Image as ImageIcon, Layers, LocateFixed, LockKeyhole, Plus, Search, Sparkles, Square, Trash2, Type, Unlink2, Unlock, Upload, Video, X } from 'lucide-react';
import type { BindableStyleProperty, DesignNode, DesignPage, DesignProject, DesignSystem, MediaConfig, NodeStyle, Operation, ShaderConfig } from '../shared/types';
import { exportNodeCode, resolvedNodes } from '../shared/export';
import { compatibleTokenKinds } from '../shared/design-system';
import { defaultShader, shaderFragmentSource, shaderPresets } from '../shared/shaders';
import { ASSET_MIME_TYPES } from '../shared/media';
import { isSafeLink } from '../shared/links';
import { client } from './client';
import { recordCanvasWork } from './canvas-profile';
import { Field, ColorField } from './InspectorFields';
import { Select } from './Select';
import { usePanelResize } from './usePanelResize';
import { Effects } from './Effects';
import Advanced from './Advanced';
export { Field } from './InspectorFields';

type Props = { project: DesignProject; page: DesignPage; selectedIds: string[]; navigationPending: boolean; onSelect: (id: string, additive?: boolean) => void; onChange: (ops: Operation[]) => Promise<DesignProject | null>; onClose: () => void; onDelete: () => void; onDuplicate: () => void; onFocus: (id: string) => void; onOpenDesignSystem?: () => void };

function readableSource(html: string) {
  recordCanvasWork('codeFormats');
  const document = new DOMParser().parseFromString(html, 'text/html');
  const markup = document.querySelector('main')?.innerHTML || html;
  let depth = 0;
  return markup.replace(/>\s*</g, '>\n<').split('\n').map(line => {
    const trimmed = line.trim();
    if (/^<\//.test(trimmed)) depth = Math.max(0, depth - 1);
    const indent = '  '.repeat(depth);
    const formatted = trimmed.replace(/ style="([^"]*)"/, (_match, css: string) => `\n${indent}  style="\n${css.replaceAll('&quot;', "'").split(';').filter(Boolean).map(rule => `${indent}    ${rule.replace(':', ': ')};`).join('\n')}\n${indent}  "`);
    if (/^<[a-z]/i.test(trimmed) && !/<\//.test(trimmed) && !/\/>$/.test(trimmed) && !/^<(img|input|hr|br|meta|link)\b/i.test(trimmed)) depth++;
    return indent + formatted;
  }).join('\n');
}
function TokenField({ label, property, node, system, value, onChange, onBind, type = 'text', suffix, min, max }: { label: string; property: BindableStyleProperty; node: DesignNode; system: DesignSystem; value: string | number; onChange: (value: string) => void; onBind: (id: string) => void; type?: 'text' | 'number' | 'color'; suffix?: string; min?: number; max?: number }) {
  const tokenId = node.tokenBindings?.[property] ?? '';
  const tokens = system.tokens.filter(token => compatibleTokenKinds(property).includes(token.kind));
  const linked = tokens.find(token => token.id === tokenId);
  const hint = tokenId ? `${linked?.name ?? 'Unavailable token'} · ${value}${suffix ?? ''}. Editing this value detaches the token.` : 'Custom value. Choose a named token to link it.';
  return <div className={`token-field${tokenId ? ' is-linked' : ''}`}><div className="token-field-value">{type === 'color' ? <ColorField label={label} value={String(value)} onChange={onChange} title={hint}/> : <Field label={label} value={value} onChange={onChange} type={type} suffix={suffix} min={min} max={max} title={hint}/>}</div><div className="token-link" title={hint}><Select label={`${label} token`} value={tokenId} onChange={onBind} options={[{value:'',label:'Custom'},...(tokenId&&!linked?[{value:tokenId,label:'Unavailable token',disabled:true}]:[]),...tokens.map(token=>({value:token.id,label:`${token.name} · ${token.value}`,...(token.kind==='color'?{color:String(token.value)}:{})}))]}/>{tokenId && <button className="icon-button" aria-label={`Detach ${label.toLowerCase()} token`} title="Detach token and keep its current value" onClick={() => onBind('')}><Unlink2 size={12}/></button>}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="inspector-section"><h3>{title}<Plus size={15} aria-hidden="true" /></h3>{children}</section>;
}
function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="property-toggle"><span>{label}</span><input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)}/></label>;
}

function Inspector({ project, page, selectedIds, navigationPending, onSelect, onChange, onClose, onDelete, onDuplicate, onFocus, onOpenDesignSystem }: Props) {
  const selectedId = selectedIds.at(-1) ?? null, multiple = selectedIds.length > 1;
  const selectionSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const panel = usePanelResize('codex-design:inspector-width');
  const [tab, setTab] = useState<'Properties' | 'Code' | 'Tweaks'>('Properties');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [source, setSource] = useState(''), [copied, setCopied] = useState(false);
  const [query, setQuery] = useState(''), [assetError, setAssetError] = useState(''), [linkError, setLinkError] = useState('');
  const [revealRequest, setRevealRequest] = useState(0);
  const layerTree = useRef<HTMLDivElement>(null), revealedSelection = useRef('');
  const [uploadState, setUploadState] = useState<'uploading' | 'stopping' | null>(null);
  const uploading = uploadState !== null;
  const uploadController = useRef<AbortController | null>(null);
  const mediaInput = useRef<HTMLInputElement>(null), posterInput = useRef<HTMLInputElement>(null);
  const currentProject = useRef(project), currentPage = useRef(page.id), mounted = useRef(false);
  currentProject.current = project; currentPage.current = page.id;
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => () => { uploadController.current?.abort(); }, [project.id, page.id, selectedId, multiple, navigationPending]);
  const { byId, childrenByParent, roots } = useMemo(() => {
    const byId = new Map<string, DesignNode>(), childrenByParent = new Map<string, DesignNode[]>(), roots: DesignNode[] = [];
    for (const node of page.nodes) {
      byId.set(node.id, node);
      if (!node.parentId) roots.push(node);
      else {
        const siblings = childrenByParent.get(node.parentId);
        if (siblings) siblings.push(node);
        else childrenByParent.set(node.parentId, [node]);
      }
    }
    return { byId, childrenByParent, roots };
  }, [page.nodes]);
  const node = selectedId ? byId.get(selectedId) : undefined;
  const parentLayout = node?.parentId ? byId.get(node.parentId)?.styles.layout : undefined;
  const stackChild = !node?.hidden && (parentLayout === 'vertical' || parentLayout === 'horizontal');
  const effective = useMemo(() => resolvedNodes(page.nodes, project.designSystem).find(item => item.id === selectedId), [page.nodes, project.designSystem, selectedId]);
  const position = stackChild ? effective : node;
  const matchingIds = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return null;
    const ids = new Set<string>();
    for (const candidate of page.nodes) {
      if (!`${candidate.name}\n${candidate.content ?? ''}`.toLocaleLowerCase().includes(search)) continue;
      let current: DesignNode | undefined = candidate;
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) { seen.add(current.id); ids.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined; }
    }
    return ids;
  }, [query, page.nodes, byId]);
  useLayoutEffect(() => {
    if (!selectedId) { revealedSelection.current = ''; return; }
    let current = byId.get(selectedId);
    const ancestors = new Set<string>();
    while (current?.parentId && !ancestors.has(current.parentId)) {
      ancestors.add(current.parentId); current = byId.get(current.parentId);
    }
    const revealKey = JSON.stringify([project.id, page.id, selectedId, [...ancestors], revealRequest]);
    if (revealedSelection.current === revealKey) return;
    if ([...ancestors].some(id => !expanded.has(id))) {
      setExpanded(previous => new Set([...previous, ...ancestors]));
      return;
    }
    const tree = layerTree.current, row = tree?.querySelector<HTMLElement>('.layer-row.primary-selection');
    if (!tree || !row) return;
    const bounds = tree.getBoundingClientRect(), selected = row.getBoundingClientRect();
    const top = bounds.top + tree.clientTop, bottom = top + tree.clientHeight;
    // Scroll only the layer list, without moving the canvas or stealing keyboard focus.
    if (selected.top < top) tree.scrollTop += selected.top - top;
    else if (selected.bottom > bottom) tree.scrollTop += selected.bottom - bottom;
    revealedSelection.current = revealKey;
  }, [selectedId, project.id, page.id, byId, revealRequest, expanded, matchingIds]);
  useEffect(() => { setSource(node?.type === 'shader' ? shaderFragmentSource(node.shader) : node?.source || ''); }, [node?.id, node?.source, node?.type, node?.shader?.preset, node?.shader?.fragment]);
  useEffect(() => { setAssetError(''); }, [node?.id]);
  useEffect(() => { setLinkError(''); }, [node?.id, node?.href]);
  const patch = (value: Partial<DesignNode>) => node ? onChange([{ type: 'update_node', pageId: page.id, nodeId: node.id, patch: value }]) : Promise.resolve(null);
  const style = (value: Partial<NodeStyle>) => {
    if (!node) return;
    const tokenBindings = { ...node.tokenBindings };
    let detached = false;
    for (const property of Object.keys(value) as BindableStyleProperty[]) if (tokenBindings[property]) { delete tokenBindings[property]; detached = true; }
    patch({ styles: value, ...(detached ? { tokenBindings } : {}) });
  };
  const tokenField = (property: BindableStyleProperty, label: string, fallback: string | number, options: { type?: 'text' | 'number' | 'color'; suffix?: string; min?: number; max?: number } = {}) => {
    if (!node) return null;
    const value = effective?.styles[property] ?? fallback;
    return <TokenField label={label} property={property} node={node} system={project.designSystem} value={value} {...options} onChange={input => {
      const literal = options.type === 'number' ? Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity, Number(input))) : input;
      style({ [property]: literal });
    }} onBind={id => id ? patch({ tokenBindings: { ...node.tokenBindings, [property]: id } }) : style({ [property]: value })}/>;
  };
  const link = (input: string) => {
    const href = input.trim();
    if (!isSafeLink(href)) { setLinkError('Use an HTTP(S), mailto:, tel: or # link.'); return; }
    setLinkError(''); patch({ href });
  };
  const shader = (value: Partial<ShaderConfig>) => { if (node) patch({ shader: { ...defaultShader(), ...node.shader, ...value } }); };
  const media = (value: Partial<MediaConfig>) => { if (node?.media) patch({ media: { ...node.media, ...value } }); };
  const importMedia = async (file: File | undefined, poster = false) => {
    if (!file || !node || navigationPending || uploadController.current || (node.type !== 'image' && node.type !== 'video')) return;
    const target = node, targetPageId = page.id, targetProjectId = project.id;
    const controller = new AbortController(); uploadController.current = controller;
    controller.signal.addEventListener('abort', () => { if (mounted.current) setUploadState('stopping'); }, { once: true });
    setUploadState('uploading'); setAssetError('');
    try {
      const asset = await client.uploadAsset(file, file.name, undefined, controller.signal);
      if (controller.signal.aborted || !mounted.current || currentProject.current.id !== targetProjectId || currentPage.current !== targetPageId) return;
      const current = currentProject.current.pages.find(item => item.id === targetPageId)?.nodes.find(item => item.id === target.id);
      if (current && (current.type === 'image' || current.type === 'video')) onChange([{ type: 'update_node', pageId: targetPageId, nodeId: target.id, patch: { media: { src: current.media?.src ?? asset.ref, ...current.media, ...(poster ? { poster: asset.ref } : { src: asset.ref }) } } }]);
    } catch (error) { if (!controller.signal.aborted && mounted.current) setAssetError(error instanceof Error ? error.message : 'The file could not be imported. Try again.'); }
    finally { uploadController.current = null; if (mounted.current) setUploadState(null); }
  };
  const changeToken = (key: 'accent' | 'background' | 'foreground' | 'fontFamily', value: string) => {
    onChange([{ type: 'set_tokens', tokens: { [key]: value } }]);
  };
  const renderRow = (n: DesignNode, depth = 0): React.ReactNode => {
    recordCanvasWork('inspectorRows');
    const children = (childrenByParent.get(n.id) || []).filter(child => !matchingIds || matchingIds.has(child.id)), open = !!matchingIds || expanded.has(n.id);
    const Icon = n.type === 'frame' ? Frame : n.type === 'text' ? Type : n.type === 'code' ? Code2 : n.type === 'image' ? ImageIcon : n.type === 'video' ? Video : n.type === 'shader' ? Sparkles : Square;
    return <div key={n.id}><div className={`layer-row ${selectionSet.has(n.id) ? 'selected' : ''} ${selectedId === n.id ? 'primary-selection' : ''} ${n.hidden ? 'hidden-layer' : ''}`} style={{ paddingLeft: 5 + depth * 12 }}>
      <button className="layer-expander" aria-label={`${open ? 'Collapse' : 'Expand'} ${n.name}`} disabled={!children.length || !!matchingIds} onClick={() => setExpanded(prev => { const next = new Set(prev); if (open) next.delete(n.id); else next.add(n.id); return next; })}>{children.length ? open ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : null}</button>
      <button className="layer-select" aria-pressed={selectionSet.has(n.id)} onClick={event => onSelect(n.id,event.shiftKey)} onDoubleClick={event => { if (!event.shiftKey) onFocus(n.id); }}><Icon size={13}/><span>{n.name}</span>{n.locked && <LockKeyhole size={10}/>}</button>
    </div>{open && children.map(child => renderRow(child, depth + 1))}</div>;
  };
  const generated = useMemo(() => tab === 'Code' && !multiple && node && node.type !== 'code' && node.type !== 'shader' ? (recordCanvasWork('codeExports'), exportNodeCode(project, page.id, node.id)) : '', [tab, multiple, project, page.id, node?.id, node?.type]);
  const displayCode = useMemo(() => generated ? readableSource(generated) : '', [generated]);
  const shaderColors = node?.shader?.colors ?? defaultShader().colors!;
  const codePanel = node && <>
    {node.jsx && <details className="inspector-section"><summary>JSX authoring source</summary><pre className="code-preview"><code>{node.jsx.source}</code></pre><p className="inspector-hint">Codex can edit this JSX with canvas_write_jsx. Applying HTML below detaches the JSX source.</p></details>}
    <div className="code-heading"><Code2 size={15}/><span>{node.type === 'code' ? 'Editable HTML / CSS' : node.type === 'shader' ? 'Fragment shader · GLSL' : `${node.type} · generated source`}</span><button className="icon-button" aria-label="Copy element code" onClick={() => { void navigator.clipboard.writeText(node.type === 'code' || node.type === 'shader' ? source : generated).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>{copied ? <Check size={14}/> : <Copy size={14}/>}</button></div>
    {node.type === 'code' || (node.type === 'shader' && node.shader?.preset === 'custom') ? <>
      <textarea aria-label={node.type === 'shader' ? 'Fragment shader source' : 'Component source'} className="source-editor" spellCheck={false} maxLength={node.type === 'shader' ? 30000 : undefined} value={source} onChange={event => setSource(event.target.value)}/>
      <button className="primary-button save-source" disabled={source === (node.type === 'shader' ? shaderFragmentSource(node.shader) : node.source || '')} onClick={() => node.type === 'shader' ? shader({ fragment: source }) : patch({ source })}>{node.type === 'shader' ? 'Apply shader' : 'Apply code'}</button>
      <p className="inspector-hint source-hint">{node.type === 'shader' ? 'Uniforms: u_resolution (vec2), u_time, u_scale, u_seed (float), u_color1–4 (vec4). Compiler errors appear on the layer.' : 'HTML and CSS render in an isolated preview. Scripts are disabled.'}</p>
    </> : node.type === 'shader' ? <><pre className="code-preview shader-code-preview"><code>{source}</code></pre><button className="secondary-button save-source" onClick={() => shader({ preset: 'custom', fragment: shaderFragmentSource(node.shader) })}>Customize shader</button></> : <pre className="code-preview"><code>{displayCode}</code></pre>}
  </>;
  return <aside ref={panel.ref} style={panel.style} className="inspector" aria-label="Design inspector">
    <div {...panel.handleProps}/>
    <div className="inspector-tabs" role="tablist">{(['Properties', 'Code', 'Tweaks'] as const).map(name => <button key={name} role="tab" aria-selected={name === tab} className={name === tab ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}<button className="icon-button close-inspector" aria-label="Close inspector" onClick={onClose}><X size={17}/></button></div>
    <div className="layer-filter"><Search size={13} aria-hidden="true"/><input aria-label="Filter layers" placeholder="Filter layers" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className="icon-button" aria-label="Clear layer filter" onClick={() => setQuery('')}><X size={12}/></button>}<button className="icon-button" aria-label="Reveal selected layer" title={query ? 'Clear filter and reveal selected layer' : 'Reveal selected layer'} disabled={!node} onClick={() => { setQuery(''); setRevealRequest(request => request + 1); }}><LocateFixed size={13}/></button></div>
    <div ref={layerTree} className="layer-tree" aria-label="Layers">{roots.filter(root => !matchingIds || matchingIds.has(root.id)).map(n => renderRow(n))}{!page.nodes.length ? <div className="tree-empty"><Layers size={21}/><p>Your layers will appear here.</p></div> : matchingIds?.size === 0 && <div className="layer-filter-empty">No matching layers.</div>}</div>
    <div className="inspector-content">
      {tab === 'Tweaks' ? <><Section title="Project"><Field label="Name" value={project.name} onChange={name => onChange([{ type: 'rename_project', name }])}/><p className="inspector-hint">Linked tokens update across every board. Custom values remain custom.</p>{onOpenDesignSystem && <button className="secondary-button" onClick={onOpenDesignSystem}><Layers size={13}/>Open design system</button>}</Section><Section title="Colors"><ColorField label="Accent" value={project.tokens.accent} onChange={value => changeToken('accent', value)}/><ColorField label="Background" value={project.tokens.background} onChange={value => changeToken('background', value)}/><ColorField label="Foreground" value={project.tokens.foreground} onChange={value => changeToken('foreground', value)}/></Section><Section title="Typography"><Field label="Font family" value={project.tokens.fontFamily} onChange={value => changeToken('fontFamily', value)}/></Section><Section title="Design context"><p className="inspector-hint">{project.pages.length} pages · {project.pages.reduce((sum,p) => sum + p.nodes.filter(n => n.type === 'frame' && !n.parentId).length,0)} screens</p><p className="inspector-hint">All elements, code, tokens and component conversations are available to Codex through this plugin.</p><code className="project-id">{project.id}</code></Section></> : multiple ? <section className="inspector-section"><h3>{selectedIds.length} objects selected</h3><p className="inspector-hint">Shift-click to add or remove layers. Select one layer to edit its properties or source.</p><div className="selection-actions" role="toolbar" aria-label="Selected objects" tabIndex={-1}><button className="secondary-button" disabled={navigationPending} onClick={event=>{event.currentTarget.parentElement?.focus({preventScroll:true});onDuplicate();}}><Copy size={13}/>Duplicate</button><button className="secondary-button" disabled={navigationPending} onClick={event=>{event.currentTarget.parentElement?.focus({preventScroll:true});onDelete();}}><Trash2 size={13}/>Delete</button></div><p className="inspector-hint">Locked or hidden layers and stack positions stay protected. Free-positioned layers move together; nested selections are handled once.</p></section> : !node ? <div className="nothing-selected"><MouseIcon/><h3>Select something to inspect</h3><p>Click an element on the canvas or choose a layer above.</p><span>Double-click text to edit it.</span></div> : tab === 'Code' ? codePanel : <>
        <div className="selection-heading"><Field label="Layer name" value={node.name} onChange={name => patch({ name })}/><div className="selection-actions"><button className="icon-button" title="Duplicate layer · ⌘D" aria-label="Duplicate layer" onClick={onDuplicate}><Copy size={14}/></button><button className="icon-button" aria-label={node.hidden ? 'Show layer' : 'Hide layer'} onClick={() => patch({ hidden: !node.hidden })}>{node.hidden ? <EyeOff size={15}/> : <Eye size={15}/>}</button><button className="icon-button" aria-label={node.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => patch({ locked: !node.locked })}>{node.locked ? <LockKeyhole size={14}/> : <Unlock size={14}/>}</button><button className="icon-button danger" aria-label="Delete layer" onClick={onDelete}><Trash2 size={14}/></button></div></div>
        {node.type === 'frame' && node.generation?.status === 'building' && <Section title="Generation"><p className="inspector-hint">Codex is building this screen. Stopping the indicator keeps all saved content.</p><button className="secondary-button" disabled={navigationPending} onClick={() => patch({ generation: { status: 'ready' } })}>Stop loading indicator</button></Section>}
        <Section title="Size"><div className="two-fields"><Field label="Width" type="number" value={Math.round(node.width)} min={1} onChange={value => patch({ width: Math.max(1, Number(value)) })} suffix="px"/><Field label="Height" type="number" value={Math.round(node.height)} min={1} onChange={value => patch({ height: Math.max(1, Number(value)) })} suffix="px"/></div><label className="select-field"><span>Position</span><Select label="Position" value={stackChild?'stack':'absolute'} disabled onChange={()=>{}} options={[{value:'stack',label:'Stack'},{value:'absolute',label:'Absolute'}]}/></label><div className="two-fields"><Field label="X" type="number" value={Math.round(position?.x ?? node.x)} readOnly={stackChild} onChange={value => patch({ x: Number(value) })}/><Field label="Y" type="number" value={Math.round(position?.y ?? node.y)} readOnly={stackChild} onChange={value => patch({ y: Number(value) })}/></div></Section>
        {node.type !== 'text' && node.type !== 'code' && node.type !== 'image' && node.type !== 'video' && node.type !== 'shader' && <Section title="Layout">
          <label className="select-field"><span>Layout</span><Select label="Layout" value={node.styles.layout||'free'} onChange={value=>style({layout:value as NodeStyle['layout']})} options={[{value:'free',label:'Free position'},{value:'vertical',label:'Vertical stack'},{value:'horizontal',label:'Horizontal stack'}]}/></label>
          {node.styles.layout && node.styles.layout !== 'free' && <>
            <div className="direction-buttons"><span>Direction</span><button aria-label="Horizontal layout" aria-pressed={node.styles.layout === 'horizontal'} className={node.styles.layout === 'horizontal' ? 'active' : ''} onClick={() => style({ layout: 'horizontal' })}><ArrowRight size={16}/></button><button aria-label="Vertical layout" aria-pressed={node.styles.layout === 'vertical'} className={node.styles.layout === 'vertical' ? 'active' : ''} onClick={() => style({ layout: 'vertical' })}><ArrowDown size={16}/></button></div>
            <label className="select-field"><span>Align</span><Select label="Stack alignment" value={node.styles.align||'start'} onChange={value=>style({align:value as NodeStyle['align']})} options={[{value:'start',label:node.styles.layout==='vertical'?'Left':'Top'},{value:'center',label:'Center'},{value:'end',label:node.styles.layout==='vertical'?'Right':'Bottom'}]}/></label>
            <label className="select-field"><span>Distribute</span><Select label="Stack distribution" value={node.styles.justify||'start'} onChange={value=>style({justify:value as NodeStyle['justify']})} options={[{value:'start',label:node.styles.layout==='vertical'?'Top':'Left'},{value:'center',label:'Center'},{value:'end',label:node.styles.layout==='vertical'?'Bottom':'Right'},{value:'space-between',label:'Space between'}]}/></label>
            {tokenField('gap', 'Gap', 0, { type: 'number', min: 0, suffix: 'px' })}
          </>}
        </Section>}
        <Section title="Spacing">
          {node.styles.layout && node.styles.layout !== 'free' && tokenField('padding', 'Padding', 0, { type: 'number', min: 0, max: 100_000, suffix: 'px' })}
          <div className="two-fields"><Field label="Pad H" type="number" value={effective?.styles.paddingX ?? effective?.styles.padding ?? 0} min={0} max={100_000} suffix="px" disabled={navigationPending} title="Horizontal padding overrides the uniform Padding value." onChange={value => style({ paddingX: Number(value) })}/><Field label="Pad V" type="number" value={effective?.styles.paddingY ?? effective?.styles.padding ?? 0} min={0} max={100_000} suffix="px" disabled={navigationPending} title="Vertical padding overrides the uniform Padding value." onChange={value => style({ paddingY: Number(value) })}/></div>
          <div className="two-fields"><Field label="Mar H" type="number" value={effective?.styles.marginX ?? 0} min={0} max={100_000} suffix="px" disabled={navigationPending || !stackChild} title="Horizontal margin applies inside the parent stack." onChange={value => style({ marginX: Number(value) })}/><Field label="Mar V" type="number" value={effective?.styles.marginY ?? 0} min={0} max={100_000} suffix="px" disabled={navigationPending || !stackChild} title="Vertical margin applies inside the parent stack." onChange={value => style({ marginY: Number(value) })}/></div>
          {!stackChild && <p className="inspector-hint">Margins apply inside a parent stack.</p>}
        </Section>
        {(node.type === 'image' || node.type === 'video') && <Section title={node.type === 'video' ? 'Video' : 'Image'}>
          <input ref={mediaInput} type="file" hidden accept={ASSET_MIME_TYPES.filter(type => type.startsWith(node.type === 'video' ? 'video/' : 'image/')).join(',')} onChange={event => { void importMedia(event.target.files?.[0]); event.target.value = ''; }}/>
          <div className="asset-source-row"><span>{node.media?.src ? `Imported ${node.type}` : 'No file selected'}</span><div><button className="secondary-button" disabled={uploading || navigationPending} onClick={() => mediaInput.current?.click()}><Upload size={12}/>{uploading ? uploadState === 'stopping' ? 'Stopping…' : 'Importing…' : node.media?.src ? 'Replace file' : 'Choose file'}</button>{uploading && <button className="icon-button" aria-label="Cancel media upload" title="Cancel media upload" disabled={uploadState === 'stopping'} onClick={() => uploadController.current?.abort()}><X size={14}/></button>}</div></div>
          {assetError && <p className="asset-import-error" role="alert">{assetError}</p>}
          {node.media && <><label className="select-field"><span>Fit</span><Select label="Media fit" value={node.styles.objectFit??node.media.fit??'cover'} onChange={value=>style({objectFit:value as NodeStyle['objectFit']})} options={[{value:'cover',label:'Cover'},{value:'contain',label:'Contain'},{value:'fill',label:'Stretch'},{value:'none',label:'Original size'},{value:'scale-down',label:'Scale down'}]}/></label><Field label="Alt text" value={node.media.alt ?? ''} onChange={alt => media({ alt })}/>
            {node.type === 'video' && <><input ref={posterInput} type="file" hidden accept={ASSET_MIME_TYPES.filter(type => type.startsWith('image/')).join(',')} onChange={event => { void importMedia(event.target.files?.[0], true); event.target.value = ''; }}/><div className="asset-source-row"><span>Poster</span><div><button className="secondary-button" disabled={uploading || navigationPending} onClick={() => posterInput.current?.click()}>{node.media.poster ? 'Replace' : 'Choose image'}</button>{node.media.poster && <button className="icon-button" aria-label="Remove video poster" disabled={uploading || navigationPending} onClick={() => media({ poster: undefined })}><X size={13}/></button>}</div></div><ToggleField label="Autoplay" value={node.media.autoplay === true} onChange={autoplay => media({ autoplay })}/><ToggleField label="Loop" value={node.media.loop === true} onChange={loop => media({ loop })}/><ToggleField label="Muted" value={node.media.muted !== false} onChange={muted => media({ muted })}/><p className="inspector-hint">Playback controls appear in preview. Muted video supports autoplay in more browsers.</p></>}
          </>}
        </Section>}
        {node.type === 'shader' && <Section title="Shader"><label className="select-field"><span>Effect</span><Select label="Shader effect" value={node.shader?.preset??'mesh'} options={shaderPresets.map(preset=>({value:preset.id,label:preset.name}))} onChange={value=>{const preset=value as ShaderConfig['preset'];shader({preset,...(preset==='custom'&&node.shader?.fragment===undefined?{fragment:shaderFragmentSource(defaultShader('custom'))}:{})});}}/></label>
          {shaderColors.map((color, index) => <div key={index} className="shader-color-row"><ColorField label={`Color ${index + 1}`} value={color} onChange={value => shader({ colors: shaderColors.map((current, i) => i === index ? value : current) })}/>{shaderColors.length > 2 && <button className="icon-button" aria-label={`Remove shader color ${index + 1}`} onClick={() => shader({ colors: shaderColors.filter((_color, i) => i !== index) })}><X size={12}/></button>}</div>)}
          {shaderColors.length < 4 && <div className="shader-controls-actions"><button className="secondary-button" onClick={() => shader({ colors: [...shaderColors, '#e8eaed'] })}><Plus size={12}/>Add color</button></div>}
          <Field label="Scale" type="number" value={node.shader?.scale ?? 1} min={0.1} max={10} onChange={value => shader({ scale: Math.max(0.1, Math.min(10, Number(value))) })}/><Field label="Speed" type="number" value={node.shader?.speed ?? 1} min={0} max={5} onChange={value => shader({ speed: Math.max(0, Math.min(5, Number(value))) })}/><Field label="Seed" type="number" value={node.shader?.seed ?? 1} min={0} max={10000} onChange={value => shader({ seed: Math.max(0, Math.min(10000, Number(value))) })}/><ToggleField label="Animate" value={node.shader?.animate === true} onChange={animate => shader({ animate })}/><p className="inspector-hint">{node.shader?.preset === 'custom' ? 'Edit fragment GLSL in the Code tab. ' : ''}Animation respects reduced motion and pauses when hidden.</p>
        </Section>}
        {node.type === 'text' && <Section title="Text"><textarea className="content-editor" aria-label="Text content" key={`${node.id}-${node.content}`} defaultValue={node.content} onBlur={e => { if (e.target.value !== node.content) patch({ content: e.target.value }); }}/>
          {tokenField('fontFamily', 'Font', 'Inter, system-ui, sans-serif')}
          {tokenField('fontWeight', 'Weight', 400, { type: 'number', min: 1, max: 1000 })}
          <label className="select-field"><span>Style</span><Select label="Font style" value={node.styles.fontStyle ?? 'normal'} disabled={navigationPending} onChange={value => style({ fontStyle: value as NodeStyle['fontStyle'] })} options={[{value:'normal',label:'Normal'},{value:'italic',label:'Italic'}]}/></label>
          <label className="select-field"><span>List</span><Select label="Text list" value={node.styles.listStyleType ?? 'none'} disabled={navigationPending} onChange={value => style({ listStyleType: value as NodeStyle['listStyleType'] })} options={[{value:'none',label:'None'},{value:'disc',label:'Bulleted'},{value:'decimal',label:'Numbered'}]}/></label>
          {tokenField('fontSize', 'Font size', 16, { type: 'number', min: 1, suffix: 'px' })}
          {tokenField('lineHeight', 'Line height', 1.24, { type: 'number', min: 0.1 })}
          {tokenField('letterSpacing', 'Tracking', (effective?.styles.fontSize ?? 16) * ((effective?.styles.fontSize ?? 16) >= 24 ? -0.035 : -0.01), { type: 'number', suffix: 'px' })}
          {tokenField('color', 'Color', '#e8eaed', { type: 'color' })}
          <div className="alignment-control">{(['left','center','right'] as const).map((align,i) => { const Icon = [AlignLeft,AlignCenter,AlignRight][i]; return <button aria-label={`Align ${align}`} className={(node.styles.textAlign || 'left') === align ? 'active' : ''} key={align} onClick={() => style({ textAlign: align })}><Icon size={16}/></button>; })}</div></Section>}
        <Section title="Link">
          <Field key={node.id} label="URL" value={node.href ?? ''} disabled={navigationPending} title="HTTP(S), mailto:, tel: and # links open in preview and exports." onChange={link}/>
          {node.href && <div className="asset-source-row"><span>Preview and exports</span><div><button className="secondary-button" disabled={navigationPending} onClick={() => link('')}><Unlink2 size={12}/>Remove link</button></div></div>}
          {linkError && <p className="asset-import-error" role="alert">{linkError}</p>}
        </Section>
        <Section title="Appearance">
          {tokenField('fill', 'Fill', '#171717', { type: 'color' })}
          {tokenField('opacity', 'Opacity', 1, { type: 'number', min: 0, max: 1 })}
          {tokenField('radius', 'Radius', 0, { type: 'number', min: 0, suffix: 'px' })}
          {tokenField('borderColor', 'Border', '#343433', { type: 'color' })}
          {tokenField('borderWidth', 'Stroke', 0, { type: 'number', min: 0, suffix: 'px' })}
          {tokenField('shadow', 'Shadow', 'none')}
        </Section>
        <Effects key={`${project.id}/${page.id}/${node.id}`} node={node} disabled={navigationPending} onChange={effects=>patch({effects}).then(Boolean)}/>
        <Advanced key={`advanced/${project.id}/${page.id}/${node.id}`} node={effective??node} disabled={navigationPending} onChange={style}/>
      </>}
    </div>
  </aside>;
}
function MouseIcon() { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="m5 3 14 9-7 1-3 7-4-17Z"/></svg>; }
export default memo(Inspector);
