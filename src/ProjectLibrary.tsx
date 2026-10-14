import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Clock3, Copy, Download, Hand, ImagePlus, LoaderCircle, Maximize2, PanelRight, Plus, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { DesignNode, DesignProject, DesignSystemToken, DesignSystemTokenKind, InspirationItem, Operation, Viewport } from '../shared/types';
import { designSystemMarkdown, LEGACY_TOKEN_IDS, tokenCssVariables } from '../shared/design-system';
import { designSystemRequestPrompt } from '../shared/design-system-workflow';
import { sendFollowUp } from './bridge';
import { client } from './client';
import { uid } from './editor-utils';
import { mediaDimensions, mediaFile } from './media-import';
import MediaNode from './MediaNode';
import './project-library.css';
import { usePanelResize } from './usePanelResize';
import { Select } from './Select';

export interface ProjectLibraryProps {
  project: DesignProject;
  boardId: string;
  mode: 'system' | 'inspiration';
  readOnly: boolean;
  onChange: (operations: Operation[]) => Promise<DesignProject | null>;
  onClose: () => void;
  onNotify: (message: string) => void;
}

const groups: { name: string; kinds: DesignSystemTokenKind[] }[] = [
  { name: 'Color', kinds: ['color', 'opacity'] },
  { name: 'Typography', kinds: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'] },
  { name: 'Spacing', kinds: ['spacing'] },
  { name: 'Corners', kinds: ['radius'] },
  { name: 'Borders', kinds: ['borderWidth'] },
  { name: 'Shadows', kinds: ['shadow'] },
  { name: 'Motion', kinds: ['duration', 'easing'] },
  { name: 'Breakpoints', kinds: ['breakpoint'] },
  { name: 'Layers', kinds: ['zIndex'] },
];
const tokenFields: Record<DesignSystemTokenKind, { label: string; placeholder: string; min?: number; max?: number; step?: string }> = {
  color: { label: 'Color', placeholder: '#4497ff' },
  fontFamily: { label: 'Font family', placeholder: 'Inter, system-ui, sans-serif' },
  fontSize: { label: 'Font size · px', placeholder: '16', min: 1, max: 1024 },
  fontWeight: { label: 'Font weight', placeholder: '500', min: 1, max: 1000 },
  lineHeight: { label: 'Line height · ratio', placeholder: '1.5', min: .1, max: 10 },
  letterSpacing: { label: 'Letter spacing · px', placeholder: '0', min: -1000, max: 1000 },
  spacing: { label: 'Spacing · px', placeholder: '16', min: 0, max: 100000 },
  radius: { label: 'Corner radius · px', placeholder: '8', min: 0, max: 100000 },
  borderWidth: { label: 'Border width · px', placeholder: '1', min: 0, max: 1000 },
  opacity: { label: 'Opacity · 0–1', placeholder: '1', min: 0, max: 1 },
  shadow: { label: 'Box shadow', placeholder: '0 4px 16px #00000033' },
  duration: { label: 'Duration · ms', placeholder: '200', min: 0, max: 600000 },
  easing: { label: 'Easing', placeholder: 'cubic-bezier(.2, 0, 0, 1)' },
  breakpoint: { label: 'Breakpoint · px', placeholder: '768', min: 0, max: 100000 },
  zIndex: { label: 'Z-index', placeholder: '10', min: -2147483647, max: 2147483647, step: '1' },
};
const stringKinds = new Set<DesignSystemTokenKind>(['color', 'fontFamily', 'shadow', 'easing']);
const views = new Map<string, Viewport>();
const initialView: Viewport = { x: 32, y: 76, zoom: 1 };
const emptyToken = () => ({ id: '', name: '', kind: 'color' as DesignSystemTokenKind, value: '', description: '' });
const emptyReference = () => ({ name: '', notes: '', usage: '', sourceUrl: '' });
type Current = () => boolean;
type DraftState<T> = { key: string; value: T; base: T; conflicts: (keyof T)[]; deleted: boolean; hadSaved: boolean };

function useLibraryDraft<T extends Record<string, string>>(key: string, saved: T | null, blank: () => T) {
  const [state, setState] = useState<DraftState<T>>(() => ({ key, value: saved ?? blank(), base: saved ?? blank(), conflicts: [], deleted: false, hadSaved: !!saved }));
  const latest = useRef(state), signature = JSON.stringify(saved);
  const reset = (value = saved ?? blank()) => {
    const next: DraftState<T> = { key, value, base: value, conflicts: [], deleted: false, hadSaved: !!saved };
    latest.current = next; setState(next);
  };
  useLayoutEffect(() => {
    const previous = latest.current;
    if (previous.key !== key) { reset(); return; }
    if (!saved) {
      if (previous.hadSaved) { const next = { ...previous, deleted: true }; latest.current = next; setState(next); }
      return;
    }
    const value = { ...saved }, conflicts = new Set(previous.conflicts);
    for (const field of Object.keys(saved) as (keyof T)[]) {
      if (previous.value[field] !== previous.base[field]) {
        value[field] = previous.value[field];
        if (saved[field] !== previous.base[field] && value[field] !== saved[field]) conflicts.add(field);
      }
      if (value[field] === saved[field]) conflicts.delete(field);
    }
    const next: DraftState<T> = { key, value, base: saved, conflicts: [...conflicts], deleted: false, hadSaved: true };
    latest.current = next; setState(next);
  }, [key, signature]);
  const setValue = (patch: Partial<T>) => {
    const previous = latest.current, value = { ...previous.value, ...patch };
    const next = { ...previous, value, conflicts: previous.conflicts.filter(field => value[field] !== previous.base[field]) };
    latest.current = next; setState(next);
  };
  return { ...state, setValue, reset };
}

const draftFieldLabels: Record<string, string> = { name: 'name', description: 'description', documentation: 'documentation', kind: 'type', value: 'value', notes: 'what you like', usage: 'intended use', sourceUrl: 'source link' };
function DraftConflicts({ fields, saved }: { fields: string[]; saved: Record<string, string> }) {
  if (!fields.length) return null;
  return <details className="library-draft-warning"><summary>Changed elsewhere: {fields.map(field => draftFieldLabels[field] ?? field).join(', ')}. Your edits are kept.</summary><p className="library-field-note">Review the saved values below; Save keeps your edited fields and the latest untouched fields.</p>{fields.map(field => <label key={field}>Saved {draftFieldLabels[field] ?? field}<textarea readOnly rows={3} value={saved[field]}/></label>)}</details>;
}

function displayValue(token: DesignSystemToken) {
  const unit = ['fontSize', 'letterSpacing', 'spacing', 'radius', 'borderWidth', 'breakpoint'].includes(token.kind) ? 'px' : token.kind === 'duration' ? 'ms' : '';
  return `${token.value}${unit}`;
}

function TokenPreview({ token }: { token: DesignSystemToken }) {
  const value = Number(token.value);
  if (token.kind === 'color') return <span className="library-token-preview library-color-preview" style={{ backgroundColor: String(token.value) }} />;
  if (token.kind === 'opacity') return <span className="library-token-preview library-opacity-preview"><span style={{ opacity: value }} /></span>;
  if (['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'].includes(token.kind)) {
    const style: CSSProperties = {};
    if (token.kind === 'fontFamily') style.fontFamily = String(token.value);
    if (token.kind === 'fontSize') style.fontSize = Math.min(36, Math.max(10, value));
    if (token.kind === 'fontWeight') style.fontWeight = value;
    if (token.kind === 'lineHeight') style.lineHeight = value;
    if (token.kind === 'letterSpacing') style.letterSpacing = Math.min(8, Math.max(-2, value));
    return <span className="library-token-preview library-type-preview"><span style={style}>{token.kind === 'lineHeight' ? <>Aa<br />Bb</> : 'Aa'}</span></span>;
  }
  if (token.kind === 'spacing') return <span className="library-token-preview library-spacing-preview"><i /><span style={{ width: Math.min(96, Math.max(0, value)) }} /><i /></span>;
  if (token.kind === 'radius' || token.kind === 'borderWidth' || token.kind === 'shadow') {
    const style: CSSProperties = token.kind === 'radius' ? { borderRadius: Math.min(28, value) } : token.kind === 'borderWidth' ? { borderWidth: Math.min(10, value) } : { boxShadow: String(token.value) };
    return <span className="library-token-preview library-shape-preview"><span style={style} /></span>;
  }
  if (token.kind === 'duration') return <span className="library-token-preview library-duration-preview"><span style={{ width: Math.min(106, Math.max(4, value / 6)) }} /><i /></span>;
  if (token.kind === 'easing') {
    const presets: Record<string, number[]> = { linear: [0, 0, 1, 1], ease: [.25, .1, .25, 1], 'ease-in': [.42, 0, 1, 1], 'ease-out': [0, 0, .58, 1], 'ease-in-out': [.42, 0, .58, 1] };
    const custom = /^cubic-bezier\(([^)]+)\)$/.exec(String(token.value)), curve = presets[String(token.value)] ?? custom?.[1].split(',').map(Number);
    return <span className="library-token-preview library-easing-preview">{curve?.length === 4 ? <svg width="106" height="40" viewBox="0 0 106 40" aria-hidden="true"><path className="library-curve-axis" d="M4 3V36H102" /><path d={`M4 36C${4 + curve[0] * 98} ${36 - curve[1] * 32} ${4 + curve[2] * 98} ${36 - curve[3] * 32} 102 4`} /></svg> : <code>{String(token.value)}</code>}</span>;
  }
  if (token.kind === 'breakpoint') return <span className="library-token-preview library-breakpoint-preview"><span style={{ width: Math.min(112, Math.max(24, value / 12)) }} /><i /></span>;
  return <span className="library-token-preview library-layer-preview"><i /><i /><i /></span>;
}

function referenceNode(item: InspirationItem): DesignNode {
  return { id: item.id, type: 'image', name: item.name, parentId: null, x: 0, y: 0, width: item.width, height: item.height, media: { src: item.assetRef, fit: 'contain', alt: item.name }, styles: {} };
}

function InspirationPreview({ item, container }: { item: InspirationItem; container: RefObject<HTMLElement | null> }) {
  const shell = useRef<HTMLSpanElement>(null), [visible, setVisible] = useState(false);
  const node = useMemo(() => referenceNode(item), [item]);
  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { root: container.current, rootMargin: '160px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);
  return <span ref={shell} className="library-reference-preview">{visible && <MediaNode node={node}/>}</span>;
}

export default function ProjectLibrary({ project, boardId, mode, readOnly, onChange, onClose, onNotify }: ProjectLibraryProps) {
  const panel = usePanelResize('codex-design:library-panel-width', 336, 'Library panel width');
  const system = project.designSystem, board = project.boards.find(item => item.id === boardId), inspiration = board?.inspiration ?? [];
  const scopeKey = `${project.id}/${mode}/${mode === 'inspiration' ? boardId : ''}`;
  const [view, setView] = useState<Viewport>(() => views.get(scopeKey) ?? initialView);
  const [panelOpen, setPanelOpen] = useState(true), [tab, setTab] = useState<'tokens' | 'docs' | 'requests'>('tokens');
  const [selectedTokenId, setSelectedTokenId] = useState(''), [selectedReferenceId, setSelectedReferenceId] = useState('');
  const selectedToken = system.tokens.find(token => token.id === selectedTokenId), selectedReference = inspiration.find(item => item.id === selectedReferenceId);
  const tokenState = useLibraryDraft(`${scopeKey}/token/${selectedTokenId}`, selectedToken ? { id: selectedToken.id, name: selectedToken.name, kind: selectedToken.kind, value: String(selectedToken.value), description: selectedToken.description ?? '' } : null, emptyToken);
  const referenceState = useLibraryDraft(`${scopeKey}/reference/${selectedReferenceId}`, selectedReference ? { name: selectedReference.name, notes: selectedReference.notes, usage: selectedReference.usage, sourceUrl: selectedReference.sourceUrl ?? '' } : null, emptyReference);
  const metadataState = useLibraryDraft(`${scopeKey}/metadata`, { name: system.name, description: system.description, documentation: system.documentation }, () => ({ name: '', description: '', documentation: '' }));
  const { value: tokenDraft, setValue: setTokenDraft } = tokenState, { value: referenceDraft, setValue: setReferenceDraft } = referenceState, { value: metadata, setValue: setMetadata } = metadataState;
  const retainedReference = useRef<{ key: string; item: InspirationItem | null }>({ key: referenceState.key, item: selectedReference ?? null });
  if (retainedReference.current.key !== `${scopeKey}/reference/${selectedReferenceId}`) retainedReference.current = { key: `${scopeKey}/reference/${selectedReferenceId}`, item: selectedReference ?? null };
  else if (selectedReference) retainedReference.current.item = selectedReference;
  const editableReference = selectedReference ?? (referenceState.deleted ? retainedReference.current.item : null);
  const [requestMode, setRequestMode] = useState<'generate' | 'find'>(system.request?.mode ?? 'generate');
  const [brief, setBrief] = useState(system.request?.brief ?? project.description), [repository, setRepository] = useState(system.request?.repository ?? '');
  const [delivery, setDelivery] = useState(''), [showRequest, setShowRequest] = useState(false), [preview, setPreview] = useState<'markdown' | 'css'>('markdown');
  const [hand, setHand] = useState(false), [spacePan, setSpacePan] = useState(false), [panning, setPanning] = useState(false), [dropActive, setDropActive] = useState(false);
  const [busy, setBusy] = useState(''), [stopping, setStopping] = useState(false), [error, setError] = useState('');
  const root = useRef<HTMLElement>(null), stage = useRef<HTMLElement>(null), fileInput = useRef<HTMLInputElement>(null), tokenName = useRef<HTMLInputElement>(null), queuedPrompt = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef(view), mounted = useRef(true), busyRef = useRef(false), focusName = useRef(false), suppressClick = useRef(false);
  const gesture = useRef<{ pointerId: number; x: number; y: number; view: Viewport; moved: boolean } | null>(null), upload = useRef<AbortController | null>(null);
  const context = useRef({ key: scopeKey, readOnly, project, onChange });
  context.current = { key: scopeKey, readOnly, project, onChange };
  const working = !!busy, disabled = readOnly || working;
  const field = tokenFields[tokenDraft.kind], numeric = !stringKinds.has(tokenDraft.kind);
  const numericInput = numeric && (!tokenDraft.value.trim() || Number.isFinite(Number(tokenDraft.value)));
  const compatibilityToken = Object.values(LEGACY_TOKEN_IDS).some(id => id === tokenDraft.id);
  const metadataChanged = metadata.name !== system.name || metadata.description !== system.description || metadata.documentation !== system.documentation;

  const tokenLayout = useMemo(() => {
    const columns = [0, 0, 0];
    return groups.flatMap(group => {
      const tokens = system.tokens.filter(token => group.kinds.includes(token.kind));
      if (!tokens.length) return [];
      const column = columns.indexOf(Math.min(...columns)), height = 28 + Math.ceil(tokens.length / 2) * 112;
      const box = { ...group, tokens, x: column * 348, y: columns[column], width: 316, height };
      columns[column] += height + 28;
      return [box];
    });
  }, [system.tokens]);
  const referenceLayout = useMemo(() => {
    const columns = [0, 0, 0];
    return inspiration.map(item => {
      const column = columns.indexOf(Math.min(...columns)), imageHeight = Math.min(420, Math.max(96, 300 * item.height / item.width));
      const height = imageHeight + 64, box = { item, x: column * 332, y: columns[column], width: 300, height, imageHeight };
      columns[column] += height + 28;
      return box;
    });
  }, [inspiration]);
  const content = mode === 'system' ? tokenLayout : referenceLayout;
  const contentSize = { width: Math.max(0, ...content.map(box => box.x + box.width)), height: Math.max(0, ...content.map(box => box.y + box.height)) };

  const moveView = useCallback((next: Viewport) => {
    viewRef.current = next; views.set(context.current.key, next); setView(next);
  }, []);
  const zoomAt = useCallback((zoom: number, x?: number, y?: number) => {
    const element = stage.current;
    if (!element) return;
    const before = viewRef.current, next = Math.min(3, Math.max(.01, zoom)), anchorX = x ?? element.clientWidth / 2, anchorY = y ?? element.clientHeight / 2;
    moveView({ zoom: next, x: anchorX - (anchorX - before.x) * next / before.zoom, y: anchorY - (anchorY - before.y) * next / before.zoom });
  }, [moveView]);
  const fit = () => {
    const element = stage.current;
    if (!element || !contentSize.width || !contentSize.height) return;
    const zoom = Math.min(1, Math.max(.01, Math.min((element.clientWidth - 48) / contentSize.width, (element.clientHeight - 112) / contentSize.height)));
    moveView({ zoom, x: (element.clientWidth - contentSize.width * zoom) / 2, y: 64 + (element.clientHeight - 96 - contentSize.height * zoom) / 2 });
  };

  const cancelPan = useCallback(() => {
    const active = gesture.current; gesture.current = null;
    if (active && stage.current?.hasPointerCapture(active.pointerId)) stage.current.releasePointerCapture(active.pointerId);
    setPanning(false); setSpacePan(false);
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancelPan(); };
    window.addEventListener('blur', cancelPan);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', cancelPan); document.removeEventListener('visibilitychange', hidden); };
  }, [cancelPan]);
  useLayoutEffect(() => {
    upload.current?.abort(); cancelPan(); setDropActive(false); setError(''); setDelivery(''); setShowRequest(false);
    const next = views.get(scopeKey) ?? initialView;
    viewRef.current = next; setView(next); setSelectedTokenId(''); setSelectedReferenceId('');
  }, [scopeKey, cancelPan]);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement;
    stage.current?.focus({ preventScroll: true });
    return () => { mounted.current = false; upload.current?.abort(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (readOnly) upload.current?.abort(); }, [readOnly]);
  useEffect(() => {
    setRequestMode(system.request?.mode ?? 'generate'); setBrief(system.request?.brief ?? project.description); setRepository(system.request?.repository ?? ''); setDelivery(''); setShowRequest(false);
  }, [system.request?.id, project.id]);
  useEffect(() => { if (focusName.current && panelOpen && tab === 'tokens') { tokenName.current?.focus(); focusName.current = false; } }, [selectedTokenId, panelOpen, tab, tokenDraft.id]);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('.project-library-toolbar, .project-library-message')) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const bounds = element.getBoundingClientRect(); zoomAt(viewRef.current.zoom * Math.exp(-event.deltaY * .008), event.clientX - bounds.left, event.clientY - bounds.top);
      } else moveView({ ...viewRef.current, x: viewRef.current.x - event.deltaX, y: viewRef.current.y - event.deltaY });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [moveView, zoomAt]);

  const run = async (label: string, action: (current: Current) => Promise<void>) => {
    if (busyRef.current) return;
    const owner = context.current.key, ownerReadOnly = context.current.readOnly;
    const current = () => mounted.current && context.current.key === owner && context.current.readOnly === ownerReadOnly;
    busyRef.current = true; setBusy(label); setError('');
    try { await action(current); }
    catch (failure) { if (current()) setError(failure instanceof Error ? failure.message : 'This action could not be completed. Try again.'); }
    finally { busyRef.current = false; if (mounted.current) { setBusy(''); setStopping(false); } }
  };
  const persist = async (operations: Operation[], current: Current) => {
    if (!current() || context.current.readOnly) return null;
    const next = await context.current.onChange(operations);
    if (!next) throw new Error('Changes could not be saved. Try again.');
    if (!current()) return null;
    context.current.project = next;
    return next;
  };
  const copy = async (text: string) => {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable. Select and copy the reference below, or download DESIGN.md.');
    await navigator.clipboard.writeText(text);
  };
  const close = () => { upload.current?.abort(); onClose(); };
  const addToken = () => {
    if (disabled) return;
    focusName.current = true; setSelectedTokenId(''); tokenState.reset(emptyToken()); setTab('tokens'); setPanelOpen(true);
    requestAnimationFrame(() => { if (mounted.current) tokenName.current?.focus(); });
  };
  const saveToken = () => void run('Saving token…', async current => {
    const name = tokenDraft.name.trim(), raw = tokenDraft.value.trim(), value = numeric ? Number(raw) : raw;
    if (!name || !raw || typeof value === 'number' && !Number.isFinite(value)) throw new Error('Give the token a name and a valid value.');
    if (system.tokens.some(token => token.id !== tokenDraft.id && token.name.toLowerCase() === name.toLowerCase())) throw new Error('Use a unique token name.');
    const token: DesignSystemToken = { id: tokenDraft.id || uid(), name, kind: tokenDraft.kind, value, ...(tokenDraft.description.trim() ? { description: tokenDraft.description.trim() } : {}) };
    const next = await persist([{ type: 'upsert_design_token', token }], current);
    if (next) { tokenState.reset({ ...token, value: String(token.value), description: token.description ?? '' }); setSelectedTokenId(token.id); onNotify('Design token saved.'); }
  });
  const saveMetadata = async (current: Current) => {
    if (!metadata.name.trim()) throw new Error('Give the design system a name.');
    const patch: { name?: string; description?: string; documentation?: string } = {};
    for (const field of ['name', 'description', 'documentation'] as const) if (metadata[field] !== metadataState.base[field]) patch[field] = field === 'name' ? metadata[field].trim() : metadata[field];
    if (!Object.keys(patch).length) return context.current.project;
    const next = await persist([{ type: 'update_design_system', patch }], current);
    if (next) metadataState.reset({ name: next.designSystem.name, description: next.designSystem.description, documentation: next.designSystem.documentation });
    return next;
  };
  const exportSystem = (action: 'copy' | 'download' | 'css') => void run(action === 'download' ? 'Preparing DESIGN.md…' : 'Copying…', async current => {
    if (action !== 'css' && metadataChanged && metadataState.conflicts.length && !readOnly) throw new Error('Review the changed documentation fields and save your edits before exporting DESIGN.md.');
    const latest = action !== 'css' && metadataChanged && !readOnly ? await saveMetadata(current) : context.current.project;
    if (!latest || !current()) return;
    const text = action === 'css' ? tokenCssVariables(latest.designSystem) : designSystemMarkdown(latest.designSystem);
    if (action === 'download') {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })), anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'DESIGN.md'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify('DESIGN.md downloaded.');
    } else { await copy(text); if (current()) onNotify(action === 'css' ? 'Token CSS copied.' : 'DESIGN.md copied.'); }
  });
  const saveReference = () => void run('Saving reference…', async current => {
    if (!editableReference) return;
    const name = referenceDraft.name.trim(), sourceUrl = referenceDraft.sourceUrl.trim();
    if (!name) throw new Error('Give this reference a name.');
    if (sourceUrl) { let parsed: URL; try { parsed = new URL(sourceUrl); } catch { throw new Error('Use a complete http:// or https:// source link.'); } if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http:// or https:// source link.'); }
    const item: InspirationItem = { ...editableReference, name, notes: referenceDraft.notes, usage: referenceDraft.usage, sourceUrl: sourceUrl || undefined };
    if (await persist([{ type: 'upsert_inspiration', boardId, item }], current)) { referenceState.reset({ name, notes: item.notes, usage: item.usage, sourceUrl }); onNotify('Inspiration saved.'); }
  });
  const importImages = (input: File[]) => {
    if (readOnly || mode !== 'inspiration' || !board || !input.length || busyRef.current) return;
    void run('Preparing images…', async current => {
      if (input.length > 16) throw new Error('Import up to 16 images at a time.');
      if (inspiration.length + input.length > 100) throw new Error('A board can hold up to 100 inspiration images.');
      const files = input.map(file => { const image = mediaFile(file); if (!image.type.startsWith('image/')) throw new Error('Choose PNG, JPEG, WebP, GIF or SVG inspiration images.'); return image; });
      const controller = new AbortController(); upload.current = controller;
      const stillHere = () => current() && !controller.signal.aborted && !context.current.readOnly;
      let added = 0;
      try {
        for (const [index, file] of files.entries()) {
          if (!stillHere()) break;
          setBusy(`Importing ${index + 1}/${files.length} · ${file.name}`);
          const size = await mediaDimensions(file, controller.signal);
          if (!stillHere()) break;
          const asset = await client.uploadAsset(file, file.name, (loaded, total) => { if (stillHere()) setBusy(`Importing ${index + 1}/${files.length} · ${Math.round(loaded / total * 100)}%`); }, controller.signal);
          if (!stillHere()) break;
          const item: InspirationItem = { id: uid(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Image', assetRef: asset.ref, ...size, notes: '', usage: '' };
          // A save already in flight may complete after cancellation; retain its accurate count.
          if (!await persist([{ type: 'upsert_inspiration', boardId, item }], current)) break;
          added++;
          if (!stillHere()) break;
          setSelectedReferenceId(item.id); setPanelOpen(true);
        }
        if (current()) onNotify(controller.signal.aborted ? added ? `Import stopped. ${added} saved image(s) remain in this board.` : 'Image import cancelled.' : `${added} inspiration image${added === 1 ? '' : 's'} saved.`);
      } catch (failure) {
        if (!controller.signal.aborted) throw failure;
        if (current()) onNotify(added ? `Import stopped. ${added} saved image(s) remain in this board.` : 'Image import cancelled.');
      } finally { if (upload.current === controller) upload.current = null; }
    });
  };
  const importRef = useRef(importImages); importRef.current = importImages;
  useEffect(() => {
    if (mode !== 'inspiration') return;
    const paste = (event: ClipboardEvent) => {
      if (context.current.readOnly || event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length) { event.preventDefault(); importRef.current(files); }
    };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  }, [mode]);
  const queueRequest = () => void run('Saving request…', async current => {
    if (!brief.trim()) throw new Error('Describe the app so Codex has context for this design system.');
    const request = { id: uid(), mode: requestMode, brief: brief.trim(), repository: repository.trim(), createdAt: new Date().toISOString(), queued: true };
    const next = await persist([{ type: 'set_design_system_request', request }], current);
    if (!next || !current()) return;
    setBusy('Sending request…');
    const prompt = designSystemRequestPrompt(next, request);
    let delivered = false;
    try { delivered = await sendFollowUp(prompt); } catch { /* The saved request remains available for a manual handoff. */ }
    if (!current()) return;
    if (delivered) { setDelivery('Sent to Codex. The request stays queued until Codex updates the project.'); onNotify('Design system request sent to Codex.'); return; }
    setShowRequest(true);
    try { await copy(prompt); if (current()) { setDelivery('Saved and copied. Paste the request into Codex to begin.'); onNotify('Request saved and copied. Paste it into Codex to begin.'); } }
    catch { if (current()) { setDelivery('Saved and queued. Copy the request below into Codex to begin.'); onNotify('Request saved and queued. Copy it into Codex to begin.'); } }
  });

  const pointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.button !== 1) return;
    if (!hand && !spacePan && event.button !== 1 && (event.target as Element).closest('button, a, input, textarea, select, summary')) return;
    event.preventDefault(); stage.current?.focus({ preventScroll: true }); stage.current?.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: viewRef.current, moved: false }; setPanning(true);
  };
  const finishPan = (event: ReactPointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    suppressClick.current = event.type !== 'pointercancel' && (active.moved || hand || spacePan || event.button === 1);
    if (stage.current?.hasPointerCapture(event.pointerId)) stage.current.releasePointerCapture(event.pointerId);
    gesture.current = null; setPanning(false);
  };
  const savedPrompt = system.request ? designSystemRequestPrompt(project, system.request) : '';

  return <section ref={root} className="project-library" aria-label={mode === 'system' ? 'Project design system' : 'Board inspiration'} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !(event.target as Element).closest('input, textarea, select, [contenteditable="true"]')) { event.preventDefault(); close(); } }} onKeyUp={event => { if (event.code === 'Space') setSpacePan(false); event.stopPropagation(); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setSpacePan(false); }}>
    <main ref={stage} className={`project-library-stage${hand || spacePan ? ' is-hand' : ''}${panning ? ' is-panning' : ''}${dropActive ? ' is-file-drop' : ''}`} tabIndex={0} aria-label={`${mode === 'system' ? 'Design system' : 'Inspiration'} canvas. Drag the background to pan; Control or Command and scroll to zoom.`} onPointerDown={pointerDown} onPointerMove={event => {
      const active = gesture.current;
      if (!active || active.pointerId !== event.pointerId) return;
      const dx = event.clientX - active.x, dy = event.clientY - active.y;
      active.moved ||= Math.abs(dx) + Math.abs(dy) > 3;
      moveView({ ...active.view, x: active.view.x + dx, y: active.view.y + dy });
    }} onPointerUp={finishPan} onPointerCancel={finishPan} onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }} onKeyDown={event => {
      if ((event.target as Element).closest('input, textarea, select, button, summary')) return;
      if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); setSpacePan(true); }
      else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(viewRef.current.zoom * 1.2); }
      else if (event.key === '-') { event.preventDefault(); zoomAt(viewRef.current.zoom / 1.2); }
      else if (event.key === '1') { event.preventDefault(); fit(); }
      else if (event.key === '0') { event.preventDefault(); zoomAt(1); }
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); moveView({ ...viewRef.current, x: viewRef.current.x + (event.key === 'ArrowLeft' ? 48 : event.key === 'ArrowRight' ? -48 : 0), y: viewRef.current.y + (event.key === 'ArrowUp' ? 48 : event.key === 'ArrowDown' ? -48 : 0) }); }
    }} onDragOver={event => {
      if (mode !== 'inspiration' || !event.dataTransfer.types.includes('Files')) return;
      event.preventDefault(); event.dataTransfer.dropEffect = disabled ? 'none' : 'copy'; if (!disabled) setDropActive(true);
    }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropActive(false); }} onDrop={event => {
      if (mode !== 'inspiration' || !event.dataTransfer.files.length) return;
      event.preventDefault(); setDropActive(false); importImages(Array.from(event.dataTransfer.files));
    }}>
      <div className="project-library-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
        {mode === 'system' ? tokenLayout.map(group => <section key={group.name} className="library-token-group" aria-label={`${group.name} tokens`} style={{ left: group.x, top: group.y, width: group.width }}>
          <header><h3>{group.name}</h3><span>{group.tokens.length}</span></header><div className="library-token-grid">{group.tokens.map(token => <button type="button" key={token.id} className={`library-token-card${selectedTokenId === token.id ? ' is-selected' : ''}`} aria-pressed={selectedTokenId === token.id} title={`${token.name} · ${displayValue(token)}${token.description ? `\n${token.description}` : ''}`} onClick={() => { setSelectedTokenId(token.id); setTab('tokens'); setPanelOpen(true); }}><TokenPreview token={token}/><span className="library-token-caption"><strong>{token.name}</strong><code>{displayValue(token)}</code></span></button>)}</div>
        </section>) : referenceLayout.map(box => <button type="button" key={box.item.id} className={`library-reference-card${selectedReferenceId === box.item.id ? ' is-selected' : ''}`} aria-pressed={selectedReferenceId === box.item.id} title={box.item.name} style={{ left: box.x, top: box.y, width: box.width, height: box.height }} onClick={() => { setSelectedReferenceId(box.item.id); setPanelOpen(true); }}><span className="library-reference-image" style={{ height: box.imageHeight }}><InspirationPreview item={box.item} container={stage}/></span><span className="library-reference-caption"><strong>{box.item.name}</strong><span>{box.item.notes || box.item.usage || `${box.item.width} × ${box.item.height}`}</span></span></button>)}
      </div>
      <div className="project-library-toolbar" onPointerDown={event => event.stopPropagation()}>
        <button type="button" className="library-icon" aria-label="Return to design canvas" title="Return to design canvas · Esc" onClick={close}><ArrowLeft size={16}/></button><span className="library-toolbar-title">{mode === 'system' ? 'Design system' : 'Inspiration'}</span><span className="library-toolbar-count">{mode === 'system' ? system.tokens.length : inspiration.length}</span><span className="library-toolbar-divider"/>
        <button type="button" className={`library-icon${hand ? ' is-active' : ''}`} aria-label="Hand tool" title="Hand tool · hold Space to pan" aria-pressed={hand} onClick={() => setHand(!hand)}><Hand size={15}/></button><button type="button" className="library-icon library-zoom-step" aria-label="Zoom out" title="Zoom out · −" onClick={() => zoomAt(viewRef.current.zoom / 1.2)}><ZoomOut size={15}/></button><button type="button" className="library-zoom" title="Reset zoom · 0" aria-label={`Zoom ${Math.round(view.zoom * 100)} percent. Reset to 100 percent.`} onClick={() => zoomAt(1)}>{Math.round(view.zoom * 100)}%</button><button type="button" className="library-icon library-zoom-step" aria-label="Zoom in" title="Zoom in · +" onClick={() => zoomAt(viewRef.current.zoom * 1.2)}><ZoomIn size={15}/></button><button type="button" className="library-icon" aria-label="Fit library content" title="Fit all content · 1" disabled={!content.length} onClick={fit}><Maximize2 size={15}/></button><span className="library-toolbar-divider"/><button type="button" className={`library-icon${panelOpen ? ' is-active' : ''}`} aria-label="Toggle library panel" title="Toggle library panel" aria-pressed={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><PanelRight size={15}/></button>
        {mode === 'inspiration' && <><span className="library-toolbar-divider"/><button type="button" className="library-icon" disabled={readOnly || working && !upload.current || stopping} aria-label={upload.current ? 'Cancel image import' : 'Import inspiration images'} title={upload.current ? 'Cancel image import' : 'Import images · paste or drop images on this canvas'} onClick={() => { if (upload.current) { upload.current.abort(); setStopping(true); setBusy('Stopping import…'); } else fileInput.current?.click(); }}>{upload.current ? <X size={16}/> : <ImagePlus size={16}/>}</button></>}
      </div>
      {(busy || error || dropActive) && <div className={`project-library-message${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'} onPointerDown={event => event.stopPropagation()}>{busy && !error && <LoaderCircle size={13} className="library-spinner"/>}<span>{error || (dropActive ? 'Drop images into this board' : busy)}</span>{error && <button type="button" className="library-icon" aria-label="Dismiss library error" onClick={() => setError('')}><X size={14}/></button>}</div>}
    </main>
    {panelOpen && <aside ref={panel.ref} style={panel.style} className="project-library-panel" aria-label={mode === 'system' ? 'Design system editor' : 'Inspiration editor'} aria-busy={working}>
      <div {...panel.handleProps}/>
      <header className="library-panel-header"><h2>{mode === 'system' ? system.name : 'Board inspiration'}</h2>{readOnly && <span>Read only</span>}<button type="button" className="library-icon" aria-label="Collapse library panel" title="Collapse library panel" onClick={() => setPanelOpen(false)}><X size={15}/></button></header>
      <div className="library-scope" title={mode === 'system' ? project.name : board?.name}>{mode === 'system' ? <><span>Project</span><strong>{project.name}</strong><small>All boards</small></> : <><span>Board</span><strong>{board?.name || 'Unavailable'}</strong><small>{inspiration.length}/100</small></>}</div>
      {mode === 'system' ? <>
        <div className="library-panel-tabs" role="tablist" aria-label="Design system sections">{([{ id: 'tokens', label: 'Tokens' }, { id: 'docs', label: 'Documentation' }, { id: 'requests', label: 'Codex' }] as const).map(item => <button type="button" role="tab" id={`library-tab-${item.id}`} aria-controls={`library-section-${item.id}`} aria-selected={tab === item.id} key={item.id} onClick={() => setTab(item.id)}>{item.label}{item.id === 'requests' && system.request?.queued && <span className="library-queued-dot"/>}</button>)}</div>
        <div className="library-panel-scroll" role="tabpanel" id={`library-section-${tab}`} aria-labelledby={`library-tab-${tab}`}>
          {tab === 'tokens' && <>
            <div className="library-token-picker"><Select label="Select design token" value={selectedToken || tokenState.deleted ? selectedTokenId : ''} onChange={setSelectedTokenId} options={[{value:'',label:'New token'},...(tokenState.deleted?[{value:selectedTokenId,label:`Deleted · ${tokenDraft.name}`}]:[]),...groups.flatMap(group=>system.tokens.filter(token=>group.kinds.includes(token.kind)).map(token=>({value:token.id,label:`${group.name} · ${token.name}${token.kind==='color'?` · ${token.value}`:''}`,...(token.kind==='color'?{color:String(token.value)}:{})})))]}/><button type="button" className="library-icon" aria-label="Add design token" title="Add design token" disabled={disabled} onClick={addToken}><Plus size={16}/></button></div>
            <form className="library-section library-editor-form" onSubmit={event => { event.preventDefault(); saveToken(); }}>
              <h3>{tokenState.deleted ? 'Deleted token draft' : selectedToken ? 'Edit token' : 'New token'}{selectedToken && <button type="button" className="library-icon library-delete" aria-label="Delete selected token" title="Delete token; saved versions retain it" disabled={disabled} onClick={() => void run('Deleting token…', async current => { if (await persist([{ type: 'delete_design_token', tokenId: selectedToken.id }], current)) { setSelectedTokenId(''); onNotify('Design token deleted. Earlier versions retain it.'); } })}><Trash2 size={13}/></button>}</h3>
              <DraftConflicts fields={tokenState.conflicts} saved={tokenState.base}/>{tokenState.deleted && <p className="library-draft-warning">Deleted elsewhere. Your draft is retained. Restore token adds it back; old layer bindings remain detached. Changing selection discards this draft.</p>}
              <label>Name<input ref={tokenName} required maxLength={160} readOnly={disabled} value={tokenDraft.name} placeholder="color.action.primary" onChange={event => setTokenDraft({ ...tokenDraft, name: event.target.value })}/></label>
              <label title={compatibilityToken ? 'Compatibility tokens keep their original type.' : undefined}>Type<Select label="Token type" disabled={disabled || compatibilityToken} value={tokenDraft.kind} onChange={kind=>setTokenDraft({...tokenDraft,kind:kind as DesignSystemTokenKind,value:''})} options={groups.flatMap(group=>group.kinds.map(kind=>({value:kind,label:`${group.name} · ${tokenFields[kind].label.split(' · ')[0]}`})))}/></label>
              <label>{field.label}<input required type={numericInput ? 'number' : 'text'} step={field.step ?? 'any'} min={field.min} max={field.max} maxLength={2000} readOnly={disabled} value={tokenDraft.value} placeholder={field.placeholder} onChange={event => setTokenDraft({ ...tokenDraft, value: event.target.value })}/></label>
              <label>Description<textarea maxLength={5000} rows={3} readOnly={disabled} value={tokenDraft.description} placeholder="Where and why to use this token" onChange={event => setTokenDraft({ ...tokenDraft, description: event.target.value })}/></label>
              <button type="submit" className="library-button library-primary" disabled={disabled || !tokenDraft.name.trim() || !tokenDraft.value.trim()}><Check size={13}/>{tokenState.deleted ? 'Restore token' : 'Save token'}</button>
            </form>
            <p className="library-note">Named tokens are shared by every board in this project.</p>
          </>}
          {tab === 'docs' && <>
            <form className="library-section library-editor-form" onSubmit={event => { event.preventDefault(); void run('Saving documentation…', async current => { if (await saveMetadata(current)) onNotify('Design system documentation saved.'); }); }}>
              <h3>System details</h3><DraftConflicts fields={metadataState.conflicts} saved={metadataState.base}/><label>Name<input maxLength={160} required readOnly={disabled} value={metadata.name} onChange={event => setMetadata({ ...metadata, name: event.target.value })}/></label><label>Description<textarea maxLength={5000} rows={2} readOnly={disabled} value={metadata.description} onChange={event => setMetadata({ ...metadata, description: event.target.value })}/></label><label>Documentation · Markdown<textarea className="library-documentation" maxLength={100000} rows={10} spellCheck={false} readOnly={disabled} value={metadata.documentation} placeholder="Usage guidance, principles and component conventions" onChange={event => setMetadata({ ...metadata, documentation: event.target.value })}/></label><p className="library-field-note">Token values are edited in Tokens. This documentation adds guidance to the generated reference.</p><button type="submit" className="library-button library-primary" disabled={disabled || !metadataChanged}><Check size={13}/>Save documentation</button>
            </form>
            <section className="library-section"><h3>DESIGN.md</h3><p className="library-field-note">Export includes current structured tokens, sources and documentation. Unsaved documentation is saved first.</p><div className="library-button-row"><button type="button" className="library-button" disabled={working || !readOnly && metadataChanged && !!metadataState.conflicts.length} onClick={() => exportSystem('copy')}><Copy size={13}/>Copy</button><button type="button" className="library-button" disabled={working || !readOnly && metadataChanged && !!metadataState.conflicts.length} onClick={() => exportSystem('download')}><Download size={13}/>Download DESIGN.md</button></div><details className="library-details"><summary>Generated reference</summary><div className="library-reference-tabs"><button type="button" aria-pressed={preview === 'markdown'} onClick={() => setPreview('markdown')}>DESIGN.md</button><button type="button" aria-pressed={preview === 'css'} onClick={() => setPreview('css')}>CSS variables</button></div><textarea readOnly rows={8} spellCheck={false} aria-label={preview === 'markdown' ? 'Generated DESIGN.md reference' : 'Generated CSS variables'} value={preview === 'markdown' ? designSystemMarkdown(system) : tokenCssVariables(system)}/>{preview === 'css' && <button type="button" className="library-button" disabled={working} onClick={() => exportSystem('css')}><Copy size={12}/>Copy CSS</button>}</details></section>
            {!!system.sources.length && <details className="library-section library-sources"><summary>Evidence sources <span>{system.sources.length}</span></summary><ul>{system.sources.map((source, index) => <li key={`${source.path}/${index}`}><div><code>{source.path}</code><small>{source.confidence}</small></div><span>{source.kind}</span>{source.notes && <p>{source.notes}</p>}</li>)}</ul></details>}
          </>}
          {tab === 'requests' && <>
            <form className="library-section library-editor-form" onSubmit={event => { event.preventDefault(); queueRequest(); }}><h3>Design system with Codex</h3><div className="library-request-mode" role="group" aria-label="Design system request mode"><button type="button" disabled={disabled} aria-pressed={requestMode === 'generate'} onClick={() => setRequestMode('generate')}>Generate</button><button type="button" disabled={disabled} aria-pressed={requestMode === 'find'} onClick={() => setRequestMode('find')}>Find existing</button></div><p className="library-field-note">{requestMode === 'generate' ? 'Ask Codex to propose a system for this app and save its tokens and guidance here.' : 'Ask Codex to inspect an existing repository for DESIGN.md, components, styles and configuration.'}</p><label>App brief<textarea required maxLength={20000} rows={6} readOnly={disabled} value={brief} placeholder="What the app does, who uses it and the interface it needs" onChange={event => setBrief(event.target.value)}/></label><label>Repository path · optional<input maxLength={2000} readOnly={disabled} value={repository} placeholder="Application repository" onChange={event => setRepository(event.target.value)}/></label><p className="library-field-note">Leave blank to use the application repository established in your Codex chat. Codex asks if the target repository is unknown. The request is saved before it is sent.</p><button type="submit" className="library-button library-primary" disabled={disabled || !brief.trim()}><ArrowUpRight size={13}/>{requestMode === 'generate' ? 'Request generation' : 'Request discovery'}</button></form>
            {system.request && <section className="library-section library-request-status"><h3><span><Clock3 size={13}/>{system.request.queued ? 'Queued request' : 'Saved request'}</span><button type="button" className="library-icon library-delete" disabled={disabled} title="Remove saved request" aria-label="Remove saved design system request" onClick={() => void run('Removing request…', async current => { if (await persist([{ type: 'set_design_system_request', request: null }], current)) onNotify('Saved request removed.'); })}><Trash2 size={13}/></button></h3><p className="library-request-meta">{system.request.mode === 'find' ? 'Find existing' : 'Generate'} · {new Date(system.request.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p><p className="library-field-note" role="status">{delivery || 'Codex updates this project when it handles the request. A queued request does not mean work has started.'}</p><div className="library-button-row"><button type="button" className="library-button" disabled={working} onClick={() => void run('Copying request…', async current => { setShowRequest(true); try { await copy(savedPrompt); if (current()) onNotify('Design system request copied.'); } catch (failure) { if (current()) requestAnimationFrame(() => { queuedPrompt.current?.focus(); queuedPrompt.current?.select(); }); throw failure; } })}><Copy size={13}/>Copy request</button><button type="button" className="library-button" aria-expanded={showRequest} onClick={() => setShowRequest(!showRequest)}>{showRequest ? 'Hide prompt' : 'View prompt'}</button></div>{showRequest && <textarea ref={queuedPrompt} className="library-queued-prompt" rows={10} readOnly spellCheck={false} aria-label="Saved design system request prompt" value={savedPrompt}/>}</section>}
          </>}
        </div>
      </> : <div className="library-panel-scroll">
        <section className="library-section"><div className="library-button-row"><button type="button" className="library-button" disabled={disabled || inspiration.length >= 100 || !board} onClick={() => fileInput.current?.click()}><ImagePlus size={13}/>Import images</button>{upload.current && <button type="button" className="library-button" disabled={stopping} onClick={() => { upload.current?.abort(); setStopping(true); setBusy('Stopping import…'); }}><X size={13}/>Cancel</button>}</div><p className="library-field-note">Paste or drop images on this canvas. Originals are saved with this board.</p>{(!!inspiration.length || referenceState.deleted) && <label className="library-reference-picker">Reference<Select label="Select inspiration image" value={editableReference?.id??''} onChange={setSelectedReferenceId} options={[{value:'',label:'Select an image'},...(referenceState.deleted?[{value:selectedReferenceId,label:`Deleted · ${referenceDraft.name}`}]:[]),...inspiration.map(item=>({value:item.id,label:item.name}))]}/></label>}</section>
        {editableReference ? <form className="library-section library-editor-form" onSubmit={event => { event.preventDefault(); saveReference(); }}><h3>{referenceState.deleted ? 'Deleted reference draft' : 'Reference details'}{selectedReference && <button type="button" className="library-icon library-delete" disabled={disabled} title="Delete reference; saved versions retain it" aria-label="Delete selected inspiration image" onClick={() => void run('Deleting reference…', async current => { if (await persist([{ type: 'delete_inspiration', boardId, itemId: selectedReference.id }], current)) { setSelectedReferenceId(''); onNotify('Inspiration deleted. Earlier versions retain the image.'); } })}><Trash2 size={13}/></button>}</h3><DraftConflicts fields={referenceState.conflicts} saved={referenceState.base}/>{referenceState.deleted && <p className="library-draft-warning">Deleted elsewhere. Your edits and the saved image reference are retained. Restore reference adds it back to this board. Changing selection discards this draft.</p>}<label>Name<input required maxLength={160} readOnly={disabled} value={referenceDraft.name} onChange={event => setReferenceDraft({ ...referenceDraft, name: event.target.value })}/></label><label>What you like<textarea maxLength={5000} rows={5} readOnly={disabled} value={referenceDraft.notes} placeholder="Layout, typography, color, hierarchy or interaction details" onChange={event => setReferenceDraft({ ...referenceDraft, notes: event.target.value })}/></label><label>Intended use<textarea maxLength={5000} rows={4} readOnly={disabled} value={referenceDraft.usage} placeholder="Where this reference should inform the board" onChange={event => setReferenceDraft({ ...referenceDraft, usage: event.target.value })}/></label><label>Source link · optional<input type="url" maxLength={2000} readOnly={disabled} value={referenceDraft.sourceUrl} placeholder="https://…" onChange={event => setReferenceDraft({ ...referenceDraft, sourceUrl: event.target.value })}/></label><div className="library-reference-meta"><span>{editableReference.width} × {editableReference.height}</span>{editableReference.sourceUrl && <a href={editableReference.sourceUrl} target="_blank" rel="noopener noreferrer">Open source<ArrowUpRight size={11}/></a>}</div><button type="submit" className="library-button library-primary" disabled={disabled || !referenceDraft.name.trim()}><Check size={13}/>{referenceState.deleted ? 'Restore reference' : 'Save reference'}</button></form> : <p className="library-note">{inspiration.length ? 'Select an image to edit what you like and how it should inform this board.' : 'No inspiration images saved for this board.'}</p>}
      </div>}
    </aside>}
    <input ref={fileInput} className="library-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg" multiple disabled={disabled || mode !== 'inspiration'} aria-label="Import inspiration image files" onChange={event => { importImages(Array.from(event.target.files ?? [])); event.target.value = ''; }}/>
  </section>;
}
