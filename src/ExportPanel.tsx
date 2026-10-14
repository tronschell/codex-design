import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, Code2, Copy, Download, FileArchive, FileCode2, FileJson2, Image, Layers, LoaderCircle, X } from 'lucide-react';
import type { DesignProject } from '../shared/types';
import { exportFormatReason, exportHandoffPrompt, exportTargetProject, type ExportFormat, type ExportScope, type ExportTarget } from '../shared/export-formats';
import { embedded, sendFollowUp } from './bridge';
import { downloadExport, exportFile, exportTexts, type ExportText } from './export-utils';
import { Select } from './Select';
import './export.css';

export interface ExportPanelProps {
  project: DesignProject;
  boardId: string;
  pageId: string;
  selectedIds: string[];
  onClose: () => void;
  onNotify: (message: string) => void;
}

const formats: { id: ExportFormat; name: string; detail: string; description: string; Icon: typeof Code2 }[] = [
  { id: 'react', name: 'React + CSS', detail: 'JSX and stylesheet', description: 'Editable React markup and plain CSS at the original design dimensions. Source layers stay sandboxed; media and controlled shader code are included.', Icon: Code2 },
  { id: 'html', name: 'HTML', detail: 'Standalone page', description: 'A browser preview with embedded media, original dimensions and isolated source layers. No build step is required.', Icon: FileCode2 },
  { id: 'svg', name: 'SVG', detail: 'Vector source layer', description: 'The original passive SVG source, sized to the selected layer. Select a single SVG source layer without container styling.', Icon: Image },
  { id: 'source', name: 'Source ZIP', detail: 'Code, media and context', description: 'HTML previews, React and CSS, original media, editable design.json, shared tokens and component conversations for this scope.', Icon: FileArchive },
  { id: 'project', name: 'Editable backup', detail: 'Project ZIP with media', description: 'The editable document, source, media, tokens and conversations. Import this ZIP through the project menu to create a new saved copy.', Icon: FileJson2 },
  { id: 'png', name: 'PNG', detail: 'Capture unavailable', description: '', Icon: Image },
];

export default function ExportPanel({ project, boardId, pageId, selectedIds, onClose, onNotify }: ExportPanelProps) {
  const [scope, setScope] = useState<ExportScope>(selectedIds.length ? 'selection' : 'board');
  const [format, setFormat] = useState<ExportFormat>(selectedIds.length ? 'react' : 'source');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [copied, setCopied] = useState('');
  const [sources, setSources] = useState<ExportText[]>([]), [sourceIndex, setSourceIndex] = useState(0);
  const panel = useRef<HTMLElement>(null), busyRef = useRef(false), mounted = useRef(true), activeRequest = useRef<AbortController | null>(null);
  const page = project.pages.find(page => page.id === pageId), board = project.boards.find(board => board.id === boardId);
  const selected = useMemo(() => { const ids = new Set(selectedIds); return page?.nodes.filter(node => ids.has(node.id)) ?? []; }, [page?.nodes, selectedIds]);
  const availableScope = scope === 'selection' && !selected.length ? 'page' : scope;
  const target = useMemo<ExportTarget>(() => ({ scope: availableScope, boardId, pageId, ...(availableScope === 'selection' ? { nodeIds: selected.map(node => node.id) } : {}) }), [availableScope, boardId, pageId, selected]);
  const details = formats.find(item => item.id === format)!;
  const scoped = useMemo(() => exportTargetProject(project, target), [project, target]);
  const layerCount = scoped.pages.reduce((count, page) => count + page.nodes.length, 0);
  const reason = exportFormatReason(project, target, format), textFormat = ['react', 'html', 'svg'].includes(format);
  const source = sources[sourceIndex];
  const handoff = exportHandoffPrompt(project, target);

  useLayoutEffect(() => {
    mounted.current = true;
    const previous = document.activeElement;
    panel.current?.querySelector<HTMLButtonElement>('[role="combobox"]')?.focus();
    return () => { mounted.current = false; activeRequest.current?.abort(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  useLayoutEffect(() => {
    const interrupted = !!activeRequest.current && !activeRequest.current.signal.aborted;
    activeRequest.current?.abort();
    setSources([]); setSourceIndex(0); setCopied('');
    setError(interrupted ? 'The design or export scope changed. Export again for the current revision.' : '');
  }, [project.revision, target, format]);

  const close = () => { activeRequest.current?.abort(); onClose(); };
  const run = async (label: string, action: (signal: AbortSignal) => Promise<void>) => {
    if (busyRef.current) return;
    const request = new AbortController();
    activeRequest.current = request;
    busyRef.current = true; setBusy(label); setError('');
    try { await action(request.signal); }
    catch (error) { if (mounted.current && !request.signal.aborted) setError(error instanceof Error ? error.message : 'The export failed. Try again.'); }
    finally { activeRequest.current = null; busyRef.current = false; if (mounted.current) setBusy(''); }
  };
  const prepare = async (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (sources.length) return sources;
    const generated = await exportTexts(project, target, format, signal);
    signal.throwIfAborted();
    if (mounted.current) { setSources(generated); setSourceIndex(0); }
    return generated;
  };
  const copy = (index: number) => void run('copy', async signal => {
    const generated = await prepare(signal), item = generated[index];
    signal.throwIfAborted();
    if (!item) return;
    if (mounted.current) setSourceIndex(index);
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable. Select and copy the source below, or download the file.');
    await navigator.clipboard.writeText(item.text);
    signal.throwIfAborted();
    if (mounted.current) setCopied(item.label);
    onNotify(`${item.label} copied.`);
  });
  const changeScope = (scope: ExportScope) => {
    setScope(scope);
    if ((scope === 'board' || scope === 'project') && (format === 'react' || format === 'html' || format === 'svg')) setFormat('source');
  };

  return <div className="export-backdrop" onPointerDown={close}>
    <section ref={panel} className="export-panel" role="dialog" aria-modal="true" aria-labelledby="export-heading" aria-busy={!!busy} onPointerDown={event => event.stopPropagation()} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === 'Tab') {
        const controls = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), textarea');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header className="export-panel-header"><h2 id="export-heading">Export</h2><span>v{project.revision}</span><button type="button" className="icon-button" aria-label="Close export" title={busy ? 'Close and cancel export' : 'Close export'} onClick={close}><X size={16}/></button></header>
      <div className="export-scope-row"><span className="export-scope-label">Scope</span><Select label="Export scope" value={availableScope} disabled={!!busy} onChange={value=>changeScope(value as ExportScope)} options={[
        {value:'selection',label:`Selection · ${selected.length > 1 ? `${selected.length} objects` : selected[0]?.name ?? 'Select a layer first'}`,disabled:!selected.length},
        {value:'page',label:`Page · ${page?.name}`},
        {value:'board',label:`Board · ${board?.name}`},
        {value:'project',label:`Project · ${project.name}`},
      ]}/></div>
      <div className="export-scope-summary"><Layers size={12}/><span>{scoped.pages.length} {scoped.pages.length === 1 ? 'page' : 'pages'} · {layerCount} {layerCount === 1 ? 'layer' : 'layers'} · {scoped.threads.length} conversations</span></div>
      <div className="export-format-layout">
        <nav className="export-format-list" aria-label="Export format">{formats.map(item => {
          const disabledReason = exportFormatReason(project, target, item.id);
          return <button type="button" key={item.id} className={format === item.id ? 'selected' : ''} disabled={!!busy || !!disabledReason} aria-pressed={format === item.id} title={disabledReason ?? item.detail} onClick={() => setFormat(item.id)}><item.Icon size={15}/><span><strong>{item.name}</strong><small>{disabledReason && item.id !== 'png' ? item.id === 'svg' ? 'Single SVG layer only' : 'Selection or page only' : item.detail}</small></span>{format === item.id && <Check size={12}/>}</button>;
        })}</nav>
        <div className="export-format-detail"><h3>{details.name}</h3><p>{details.description}</p>{reason && <p className="export-format-note">{reason}</p>}
          {(format === 'react' || format === 'html') && <p className="export-format-note">Visual structure is exported at its design size. Connect application behavior in your codebase.</p>}
          {(format === 'source' || format === 'project') && availableScope === 'selection' && <p className="export-format-note">Ancestor shells keep the selection in place. Original layout settings are retained in original-scope.json. Previews contain only the selected subtree.</p>}
          {textFormat && !reason && <button type="button" className="text-button export-preview-button" disabled={!!busy} onClick={() => void run('preview', async signal => { await prepare(signal); })}>{busy === 'preview' ? <LoaderCircle size={13} className="spin"/> : <Code2 size={13}/>}Preview source</button>}
          <div className="export-file-actions">{textFormat && !reason && <><button type="button" className="secondary-button" disabled={!!busy} onClick={() => copy(0)}>{copied === (format === 'react' ? 'React' : format.toUpperCase()) ? <Check size={13}/> : <Copy size={13}/>}Copy {format === 'react' ? 'React' : format.toUpperCase()}</button>{format === 'react' && <button type="button" className="secondary-button" disabled={!!busy} onClick={() => copy(1)}>{copied === 'CSS' ? <Check size={13}/> : <Copy size={13}/>}Copy CSS</button>}</>}
            <button type="button" className="primary-button" disabled={!!busy || !!reason} onClick={() => void run('download', async signal => { const file = await exportFile(project, target, format, signal); signal.throwIfAborted(); downloadExport(file); onNotify('Export downloaded.'); })}>{busy === 'download' ? <LoaderCircle size={13} className="spin"/> : <Download size={13}/>}Download {format === 'source' || format === 'project' || format === 'react' ? 'ZIP' : format.toUpperCase()}</button>
          </div>
        </div>
      </div>
      {!!sources.length && <div className="export-source"><div role="tablist" aria-label="Exported source">{sources.map((item, index) => <button type="button" key={item.label} role="tab" aria-selected={sourceIndex === index} onClick={() => setSourceIndex(index)}>{item.label}</button>)}<span>{source?.text.length.toLocaleString()} characters</span></div><textarea aria-label={`${source?.label} source`} readOnly spellCheck={false} value={source?.text.slice(0, 100_000) ?? ''}/>{(source?.text.length ?? 0) > 100_000 && <p>Preview limited to 100,000 characters. Copy and download include the complete source.</p>}</div>}
      {error && <p className="export-error" role="alert">{error}</p>}
      <footer className="export-handoff"><div><strong>Build with Codex</strong><p>Hand off this {scope} with its IDs, source context and approved revision.</p></div><button type="button" className="secondary-button" disabled={!!busy} aria-label="Copy Codex implementation prompt" title="Copy implementation prompt" onClick={() => void run('prompt', async signal => { signal.throwIfAborted(); if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.'); await navigator.clipboard.writeText(handoff); signal.throwIfAborted(); onNotify('Implementation prompt copied.'); })}><Copy size={13}/></button><button type="button" className="primary-button" disabled={!!busy} onClick={() => void run('handoff', async signal => {
        signal.throwIfAborted();
        if (embedded) {
          const delivered = await sendFollowUp(handoff);
          signal.throwIfAborted();
          if (delivered) { onNotify('Implementation request sent to Codex.'); onClose(); return; }
        }
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser.');
        await navigator.clipboard.writeText(handoff); signal.throwIfAborted(); onNotify('Implementation prompt copied. Paste it into Codex.');
      })}>{busy === 'handoff' ? <LoaderCircle size={13} className="spin"/> : <ArrowUpRight size={13}/>} {embedded ? 'Build with Codex' : 'Copy prompt'}</button></footer>
    </section>
  </div>;
}
