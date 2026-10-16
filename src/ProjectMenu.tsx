import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, ChevronRight, Clock3, FolderOpen, Frame, Plus, Search, Upload, X } from 'lucide-react';
import type { DesignNode, DesignProject, DesignSystem, Operation, ProjectSummary } from '../shared/types';
import { componentSubtree } from '../shared/components';
import { resolvedNodes } from '../shared/export';
import { visualBounds } from '../shared/effects';
import { CanvasNodes } from './DesignNode';
import { client } from './client';
import { useLocalDraft } from './useLocalDraft';
import WorkspaceActions from './WorkspaceActions';

type CreatedTarget = { projectId: string; boardId: string };
type Props = {
  project: DesignProject | null;
  projects: ProjectSummary[];
  boardId?: string;
  open: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onOpenBoard: (projectId: string, boardId: string) => void;
  onCreateProject: (name: string) => Promise<CreatedTarget | null>;
  onCreateBoard: (name: string, project: DesignProject) => Promise<CreatedTarget | null>;
  onManageProject: (project: DesignProject, operations: Operation[] | 'delete') => Promise<DesignProject | null>;
  onImport: () => void;
  importError?: string;
  captureNavigation: () => () => boolean;
};
type Cover = { nodes: DesignNode[]; system: DesignSystem };
type ReadProject = (id: string, revision: number) => Promise<DesignProject>;
const quietButton = 'tw:inline-flex tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-md tw:border tw:border-[#484848] tw:bg-[#2b2b2b] tw:px-3 tw:py-1.5 tw:text-[12px] tw:text-[#ededed] tw:hover:bg-[#353535] tw:disabled:opacity-50';
const cardClass = 'tw:group tw:min-w-0 tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-[#414141] tw:bg-[#2a2a2a] tw:p-0 tw:text-left tw:hover:border-[#777] tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-[#4497ff] tw:disabled:opacity-50';
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const count = (n: number, label: string) => `${n} ${label}${n === 1 ? '' : 's'}`;

function coverFor(project: DesignProject, boardId?: string): Cover {
  const pages = project.pages.filter(page => !boardId || page.boardId === boardId);
  const page = pages.find(page => page.nodes.some(node => node.type === 'frame' && !node.parentId && !node.hidden)) ?? pages.find(page => page.nodes.some(node => !node.parentId && !node.hidden));
  const system = { ...project.designSystem, components: [], sources: [], documentation: '' };
  if (!page) return { nodes: [], system };
  const frames = page.nodes.filter(node => node.type === 'frame' && !node.parentId && !node.hidden);
  const roots = (frames.length ? frames : page.nodes.filter(node => !node.parentId && !node.hidden)).slice(0, 3);
  let x = 0;
  const nodes = roots.flatMap(root => {
    const subtree = componentSubtree(page.nodes, root.id).map(node => ({ ...node, styles: { ...node.styles, animation: undefined, transition: undefined }, shader: node.shader ? { ...node.shader, animate: false } : undefined }));
    const item = subtree.find(node => node.id === root.id)!;
    item.x = x; item.y = 0; x += item.width + 48;
    return subtree;
  });
  return { nodes, system };
}

function LayoutCover({ cover }: { cover: Cover }) {
  const shell = useRef<HTMLDivElement>(null), [width, setWidth] = useState(320);
  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const scene = useMemo(() => {
    const nodes = resolvedNodes(cover.nodes, cover.system);
    const boxes = nodes.filter(node => !node.parentId).map(node => visualBounds(node, nodes));
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y));
    const w = Math.max(...boxes.map(box => box.x + box.width)) - left, h = Math.max(...boxes.map(box => box.y + box.height)) - top;
    const scale = Math.max(.001, Math.min((width - 32) / Math.max(1, w), 148 / Math.max(1, h), 1));
    return { nodes, style: { transform: `translate(${(width - w * scale) / 2 - left * scale}px, ${(180 - h * scale) / 2 - top * scale}px) scale(${scale})` } };
  }, [cover, width]);
  return <div ref={shell} inert className="tw:pointer-events-none tw:relative tw:h-[180px] tw:overflow-hidden tw:bg-[#191919] tw:[contain:paint]" aria-hidden="true">
    {scene ? <div className="tw:absolute tw:top-0 tw:left-0 tw:origin-top-left tw:[&_.design-node]:pointer-events-none tw:[&_iframe]:pointer-events-none" style={scene.style}><CanvasNodes nodes={scene.nodes} designSystem={cover.system} interactive={false}/></div> : <div className="tw:flex tw:h-full tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:text-[#a8a8a8]"><Frame size={22}/><span className="tw:text-[12px]">No frames yet</span></div>}
  </div>;
}

function ProjectCover({ summary, read, container }: { summary: ProjectSummary; read: ReadProject; container: RefObject<HTMLDivElement | null> }) {
  const shell = useRef<HTMLDivElement>(null), [visible, setVisible] = useState(false);
  const [state, setState] = useState<{ revision: number; cover?: Cover; error?: boolean }>();
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { root: container.current, rootMargin: '80px' });
    if (shell.current) observer.observe(shell.current);
    return () => observer.disconnect();
  }, [container]);
  useEffect(() => {
    if (!visible || (state?.revision === summary.revision && (state.cover || state.error))) return;
    let active = true;
    void read(summary.id, summary.revision).then(project => { if (active) setState({ revision: summary.revision, cover: coverFor(project) }); }, () => { if (active) setState({ revision: summary.revision, error: true }); });
    return () => { active = false; };
  }, [visible, summary.id, summary.revision, read, state?.revision, state?.cover, state?.error]);
  return <div ref={shell}>{visible && state?.cover && state.revision === summary.revision ? <LayoutCover cover={state.cover}/> : <div className="tw:flex tw:h-[180px] tw:items-center tw:justify-center tw:bg-[#191919] tw:text-[12px] tw:text-[#a8a8a8]" aria-hidden="true">{state?.error ? 'Preview unavailable' : summary.screenCount ? <div className="tw:h-[112px] tw:w-[72%] tw:rounded-md tw:bg-[#252525]"/> : 'No frames yet'}</div>}</div>;
}

function BoardCard({ project, board, current, disabled, onOpen }: { project: DesignProject; board: DesignProject['boards'][number]; current: boolean; disabled?: boolean; onOpen: () => void }) {
  const cover = useMemo(() => coverFor(project, board.id), [project, board.id]);
  const pages = project.pages.filter(page => page.boardId === board.id), frames = pages.reduce((n, page) => n + page.nodes.filter(node => node.type === 'frame' && !node.parentId).length, 0);
  return <button type="button" disabled={disabled} onClick={onOpen} className="tw:block tw:w-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:text-inherit tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-[#4497ff]">
    <LayoutCover cover={cover}/>
    <div className="tw:p-3.5"><div className="tw:flex tw:items-start tw:gap-2"><strong className="tw:min-w-0 tw:flex-1 tw:break-words tw:text-[14px] tw:leading-5 tw:font-semibold">{board.name}</strong>{current && <Check size={15} className="tw:text-[#b9d8ff]"/>}</div><p className="tw:mt-1 tw:mb-3 tw:text-[11px] tw:leading-5 tw:text-[#b0b0b0]">{count(pages.length, 'page')} · {count(frames, 'frame')}</p><div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"><time dateTime={board.updatedAt} title={new Date(board.updatedAt).toLocaleString()} className="tw:text-[11px] tw:text-[#aaa]">Edited {date(board.updatedAt)}</time><span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-[12px] tw:text-[#ededed]">Open board<ArrowUpRight size={14}/></span></div></div>
  </button>;
}

function WorkspaceBrowser({ project, projects, boardId, readOnly, onToggle, onOpenBoard, onCreateProject, onCreateBoard, onManageProject, onImport, importError, captureNavigation }: Omit<Props, 'open'>) {
  const dialog = useRef<HTMLDialogElement>(null), search = useRef<HTMLInputElement>(null), scroller = useRef<HTMLDivElement>(null);
  const alive = useRef(true), context = useRef(0), currentProject = useRef(project); currentProject.current = project;
  const cache = useRef(new Map<string, { revision: number; promise: Promise<DesignProject> }>());
  const [selectedId, setSelectedId] = useState<string | null>(null), [selected, setSelected] = useState<DesignProject | null>(null);
  const [query, setQuery] = useState(''), [sort, setSort] = useState<'edited' | 'name'>('edited');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0), [creating, setCreating] = useState(false);
  const local = useLocalDraft(selectedId ? `${selectedId}/new-board` : 'new-project', { name: '' });
  const read = useCallback<ReadProject>((id, revision) => {
    const current = currentProject.current;
    if (current?.id === id && current.revision >= revision) return Promise.resolve(current);
    const cached = cache.current.get(id);
    if (cached && cached.revision >= revision) return cached.promise;
    const promise = client.get(id);
    cache.current.set(id, { revision, promise });
    while (cache.current.size > 4) cache.current.delete(cache.current.keys().next().value!);
    void promise.catch(() => { if (cache.current.get(id)?.promise === promise) cache.current.delete(id); });
    return promise;
  }, []);
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement as HTMLElement | null;
    alive.current = true; element.showModal(); search.current?.focus({ preventScroll: true });
    return () => { alive.current = false; context.current++; element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const summary = projects.find(item => item.id === selectedId);
  useEffect(() => {
    setSelected(null); setError('');
    if (!selectedId) return;
    let active = true;
    void read(selectedId, summary?.revision ?? 0).then(value => { if (active) setSelected(value); }, reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load this project.'); });
    return () => { active = false; };
  }, [selectedId, summary?.revision, read, retry]);
  const browse = (id: string | null) => { context.current++; setSelectedId(id); setQuery(''); setCreating(false); setError(''); scroller.current?.scrollTo({ top: 0 }); search.current?.focus({ preventScroll: true }); };
  const normalized = query.trim().toLocaleLowerCase();
  const visibleProjects = projects.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(normalized)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.name.localeCompare(b.name));
  const boards = (selected?.boards ?? []).filter(board => board.name.toLocaleLowerCase().includes(normalized)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.name.localeCompare(b.name));
  const submit = async () => {
    if (busy || readOnly || (selectedId && !selected)) return;
    const epoch = context.current, isCurrent = captureNavigation(); setBusy(true); setError('');
    try {
      const target = selected ? await onCreateBoard(local.value.name, selected) : await onCreateProject(local.value.name);
      if (!alive.current || epoch !== context.current || !isCurrent()) return;
      if (target) { local.setValue({ name: '' }); onOpenBoard(target.projectId, target.boardId); }
      else setError(`Could not create the ${selectedId ? 'board' : 'project'}. Please try again.`);
    } catch (reason) { if (alive.current && epoch === context.current && isCurrent()) setError(reason instanceof Error ? reason.message : 'Creation failed. Please try again.'); }
    finally { if (alive.current) setBusy(false); }
  };
  const manage = async (id: string, operations: Operation[] | 'delete', revision: number) => {
    if (readOnly || busy) throw new Error('Finish the current save before changing this item.');
    setBusy(true);
    try {
      const target = await client.get(id);
      cache.current.delete(id);
      if (target.revision !== revision) {
        if (alive.current && selectedId === id) setSelected(target);
        throw new Error('This project changed. Cancel and review the latest version before confirming again.');
      }
      const next = await onManageProject(target, operations);
      cache.current.delete(id);
      if (!alive.current) return;
      if (next) { if (selectedId === id) setSelected(next); }
      else if (selectedId === id) browse(null);
    } finally { if (alive.current) setBusy(false); }
  };
  const isCurrent = (id: string, targetBoard?: string) => project?.id === id && (!targetBoard || boardId === targetBoard);

  return createPortal(<dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby="workspace-browser-title" onCancel={event => { event.preventDefault(); onToggle(); }} onKeyDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onPointerDown={event => { if (event.target !== event.currentTarget) return; const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onToggle(); }} className="tw:m-auto tw:h-[min(760px,calc(100dvh-32px))] tw:max-h-[calc(100dvh-32px)] tw:w-[min(1120px,calc(100vw-32px))] tw:max-w-none tw:overflow-hidden tw:rounded-[14px] tw:border tw:border-[#444] tw:bg-[#242424] tw:p-0 tw:text-[#ededed] tw:shadow-[0_24px_80px_#0008] tw:backdrop:bg-black/55 tw:open:flex tw:open:flex-col tw:max-[600px]:h-[calc(100dvh-16px)] tw:max-[600px]:max-h-[calc(100dvh-16px)] tw:max-[600px]:w-[calc(100vw-16px)]">
    <header className="tw:flex tw:shrink-0 tw:items-start tw:gap-3 tw:border-b tw:border-[#3b3b3b] tw:px-6 tw:py-5 tw:max-[600px]:px-4 tw:max-[600px]:py-4">
      <div className="tw:min-w-0 tw:flex-1">{selectedId && <button type="button" className="tw:mb-2 tw:flex tw:items-center tw:gap-1 tw:border-0 tw:bg-transparent tw:p-0 tw:text-[12px] tw:text-[#bdbdbd] tw:hover:text-white" disabled={busy} onClick={() => browse(null)}><ArrowLeft size={13}/>All projects</button>}<h2 id="workspace-browser-title" className="tw:m-0 tw:break-words tw:text-[20px] tw:leading-7 tw:font-semibold">{selectedId ? selected?.name ?? summary?.name ?? 'Project' : 'Projects'}</h2><p className="tw:mt-1 tw:mb-0 tw:text-[12px] tw:leading-5 tw:text-[#b0b0b0]">{selectedId ? selected?.description || 'Choose a board to open its canvas.' : 'Find a project and pick a board to continue.'}</p></div>
      <button type="button" className="icon-button" aria-label="Close workspace browser" onClick={onToggle}><X size={18}/></button>
    </header>
    <div className="tw:flex tw:shrink-0 tw:flex-wrap tw:items-center tw:gap-2 tw:px-6 tw:pt-4 tw:pb-3 tw:max-[600px]:px-4">
      <label className="tw:flex tw:min-w-[160px] tw:flex-1 tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-[#484848] tw:bg-[#1e1e1e] tw:px-3 tw:focus-within:border-[#4497ff] tw:max-[600px]:basis-full"><Search size={16} className="tw:text-[#b0b0b0]"/><input ref={search} aria-label={selectedId ? 'Search boards' : 'Search projects'} placeholder={selectedId ? 'Search boards…' : 'Search projects…'} value={query} onChange={event => setQuery(event.target.value)} className="tw:h-9 tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:text-[13px] tw:text-[#ededed] tw:outline-none! tw:placeholder:text-[#aaa]"/>{query && <button type="button" aria-label="Clear search" className="icon-button" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={13}/></button>}</label>
      <label className="tw:relative tw:flex tw:items-center"><span className="tw:sr-only">Sort {selectedId ? 'boards' : 'projects'}</span><select value={sort} onChange={event => setSort(event.target.value as 'edited' | 'name')} className={`${quietButton} tw:h-9 tw:appearance-none tw:pl-2! tw:pr-6!`}><option value="edited">Last edited</option><option value="name">Name</option></select><ChevronDown size={13} className="tw:pointer-events-none tw:absolute tw:right-2 tw:text-[#aaa]"/></label>
      <button type="button" disabled={readOnly || busy} className={`${quietButton} tw:h-9 tw:px-2!`} onClick={onImport}><Upload size={14}/>Import project</button>
      <button type="button" disabled={readOnly || busy || (!!selectedId && !selected)} className="primary-button tw:inline-flex tw:h-9 tw:items-center tw:gap-1.5 tw:px-2! tw:text-[12px]!" aria-expanded={creating} onClick={() => setCreating(value => !value)}><Plus size={15}/>{selectedId ? 'New board' : 'New project'}</button>
    </div>
    {creating && <form className="tw:flex tw:shrink-0 tw:flex-wrap tw:gap-2 tw:px-6 tw:pb-3 tw:max-[600px]:px-4" onBlurCapture={local.onBlur} onCompositionStartCapture={local.onCompositionStart} onCompositionEndCapture={local.onCompositionEnd} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <input autoFocus aria-label={selectedId ? 'New board name' : 'New project name'} placeholder={selectedId ? 'Board name' : 'Project name'} disabled={busy} maxLength={160} value={local.value.name} onChange={event => local.setValue({ name: event.target.value })} className="tw:h-9 tw:min-w-[150px] tw:flex-1 tw:rounded-md tw:border tw:border-[#555] tw:bg-[#1e1e1e] tw:px-3 tw:text-[13px] tw:text-[#ededed] tw:placeholder:text-[#aaa]"/>
      <button className="primary-button tw:h-9 tw:px-4!" type="submit" disabled={busy || readOnly}>{busy ? 'Creating…' : selectedId ? 'Create board' : 'Create project'}</button><button className={quietButton} type="button" disabled={busy} onClick={() => setCreating(false)}>Cancel</button>
    </form>}
    {(error || importError) && <div role="alert" className="tw:mx-6 tw:mb-3 tw:flex tw:items-center tw:gap-3 tw:rounded-md tw:bg-[#382b2b] tw:px-3 tw:py-2 tw:text-[12px] tw:text-[#ffd4d4]"><span className="tw:flex-1">{error || importError}</span>{error && selectedId && !selected && <button type="button" className={quietButton} onClick={() => { cache.current.delete(selectedId); setRetry(value => value + 1); }}>Retry</button>}</div>}
    <div ref={scroller} className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:overscroll-contain tw:px-6 tw:pt-1 tw:pb-6 tw:max-[600px]:px-4">
      <div className="tw:mb-3 tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-[12px] tw:text-[#aaa]"><span>{selectedId ? 'Boards' : 'All projects'}</span><span role="status">{count(selectedId ? boards.length : visibleProjects.length, selectedId ? 'board' : 'project')}{normalized ? ' found' : ''}</span></div>
      <div className={`tw:grid tw:gap-4 tw:grid-cols-1 tw:min-[620px]:grid-cols-2 ${selectedId ? '' : 'tw:min-[1000px]:grid-cols-3'}`}>
        {!selectedId && visibleProjects.map(item => <article key={item.id} className={cardClass}><button type="button" disabled={busy} onClick={() => browse(item.id)} className="tw:block tw:w-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:text-inherit tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-[#4497ff]">
          <ProjectCover summary={item} read={read} container={scroller}/><div className="tw:p-3.5"><div className="tw:flex tw:items-start tw:gap-2"><strong className="tw:min-w-0 tw:flex-1 tw:break-words tw:text-[13px] tw:leading-5 tw:font-semibold">{item.name}</strong>{isCurrent(item.id) ? <span className="tw:rounded tw:bg-[#2a3d52] tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:text-[#b9d8ff]">Current</span> : <ChevronRight size={14} className="tw:mt-0.5 tw:text-[#aaa]"/>}</div><p className="tw:mt-1 tw:mb-3 tw:text-[11px] tw:leading-5 tw:text-[#b0b0b0]">{count(item.boardCount ?? 1, 'board')} · {count(item.pageCount, 'page')} · {count(item.screenCount, 'frame')}</p><time dateTime={item.updatedAt} title={new Date(item.updatedAt).toLocaleString()} className="tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-[#aaa]"><Clock3 size={12}/>Edited {date(item.updatedAt)}</time></div>
        </button><WorkspaceActions name={item.name} revision={item.revision} disabled={busy || readOnly} onAction={(operations, revision) => manage(item.id, operations, revision)}/></article>)}
        {selected && boards.map(board => <article key={board.id} className={cardClass}><BoardCard project={selected} board={board} current={isCurrent(selected.id, board.id)} disabled={busy || readOnly} onOpen={() => onOpenBoard(selected.id, board.id)}/><WorkspaceActions name={board.name} revision={selected.revision} boardId={board.id} lastBoard={selected.boards.length === 1} disabled={busy || readOnly} onAction={(operations, revision) => manage(selected.id, operations, revision)}/></article>)}
        {selectedId && !selected && !error && [0, 1].map(n => <div key={n} className="tw:h-[278px] tw:rounded-[10px] tw:bg-[#2b2b2b]" aria-hidden="true"/>)}
      </div>
      {(!selectedId && !visibleProjects.length || selected && !boards.length) && <div className="tw:flex tw:min-h-[200px] tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:text-center"><FolderOpen size={26} className="tw:text-[#999]"/><h3 className="tw:m-0 tw:text-[15px] tw:font-medium">{query ? 'No matches' : 'No projects yet'}</h3><p className="tw:m-0 tw:max-w-[36ch] tw:text-[12px] tw:leading-5 tw:text-[#b0b0b0]">{query ? 'Try another name or clear your search.' : 'Create a project or import a saved design to get started.'}</p>{query && <button type="button" className={`${quietButton} tw:mt-2`} onClick={() => { setQuery(''); search.current?.focus(); }}>Clear search</button>}</div>}
    </div>
  </dialog>, document.body);
}

export default function ProjectMenu(props: Props) {
  const board = props.project?.boards.find(item => item.id === props.boardId);
  return <div className="project-switch"><button className={`project-trigger ${props.open ? 'open' : ''}`} onClick={props.onToggle} aria-label={board ? `${props.project?.name} / ${board.name} · Browse projects and boards` : 'Browse projects and boards'} aria-haspopup="dialog" aria-expanded={props.open}><span className="project-title">{props.project?.name || 'Codex Design'}</span>{board && <><ChevronRight className="project-path-separator" size={12}/><span className="board-title">{board.name}</span></>}<ChevronDown size={14}/></button>{props.open && <WorkspaceBrowser {...props}/>}</div>;
}
