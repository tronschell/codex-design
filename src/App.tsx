import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Code2, Copy, Download, Frame, Hand, HelpCircle, History, ImagePlus, Images, LoaderCircle, Maximize2, MessageCircle, Monitor, MoreHorizontal, MousePointer2, Palette, PanelRight, Pencil, Play, Plus, Presentation, RectangleHorizontal, Redo2, Smartphone, StickyNote, Tablet, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { CommentMessage, CommentThread, DesignNode, DesignPage, DesignProject, Operation, ShaderConfig, Viewport } from '../shared/types';
import { resolvedNodes } from '../shared/export';
import { CanvasNodes, NodeView } from './DesignNode';
import Inspector from './Inspector';
import SelectionToolbar from './SelectionToolbar';
import ProjectMenu from './ProjectMenu';
import HistoryPanel from './HistoryPanel';
import ExportPanel from './ExportPanel';
import ProjectLibrary from './ProjectLibrary';
import { resolveProjectTokens } from '../shared/design-system';
import { hasTransformedAncestor, parentLocalDelta, parentLocalPoint, visibleBounds, visualBounds } from '../shared/effects';
import { createSnapScene, snapBox, type SnapBox, type SnapScene, type SnapGuide } from '../shared/snapping';
import { importProjectFile } from './export-utils';
import InsertMenu from './InsertMenu';
import { mediaAccept, mediaDimensions, mediaFile } from './media-import';
import CommentPopover, { CommentList, type CommentTarget } from './Comments';
import { commentPrompt } from '../shared/comments';
import { client, configureToken } from './client';
import { embedded, fullscreen, sendFollowUp, updateModelContext } from './bridge';
import { clampZoom, duplicateNodes, fitViewport, insertionBounds, layoutFrameLabels, newNode, selectionBounds, selectionRoots, uid } from './editor-utils';
import { useProject } from './useProject';
import { recordCanvasReady, recordCanvasView } from './canvas-profile';

type Tool = 'select' | 'hand' | 'text' | 'frame' | 'note' | 'pen' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'code' | 'comment';
type Menu = 'project' | 'page' | 'shapes' | 'zoom' | 'frames' | 'insert' | 'comments' | null;
type ObjectGesture = { kind: 'drag' | 'resize'; targets: DesignNode[]; selectionKey: string; box: SnapBox; nodes: DesignNode[]; scene: SnapScene | null; corner?: string; startX: number; startY: number; moved: boolean; pointer: { clientX: number; clientY: number } };
type MarqueeGesture = { kind: 'marquee'; startX: number; startY: number; clientX: number; clientY: number; additive: boolean; initial: string[]; nodes: DesignNode[]; candidates: { id: string; box: SnapBox }[]; moved: boolean };
type Gesture = { kind: 'pan'; startX: number; startY: number; view: Viewport } | ObjectGesture | MarqueeGesture | { kind: 'draw'; tool: Tool; startX: number; startY: number; x: number; y: number; parentId: string | null; points: { x: number; y: number }[] };
type HistoryEntry = { projectId: string; pageId: string; before: DesignPage; after: DesignPage; beforeThreads: CommentThread[]; afterThreads: CommentThread[] };
type ChangeBox = { id: string; x: number; y: number; width: number; height: number; removed?: boolean };
const clippedRootTypes = new Set<DesignNode['type']>(['frame', 'code', 'image', 'video', 'shader']);

function objectEditable(node: DesignNode, byId: ReadonlyMap<string, DesignNode>) {
  const seen = new Set<string>();
  let current: DesignNode | undefined = node;
  while (current && !seen.has(current.id)) {
    if (current.locked || current.hidden) return false;
    seen.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return true;
}

function versionChanges(snapshot: DesignProject, previous: DesignProject | null, preferredPageId: string) {
  snapshot = resolveProjectTokens(snapshot);
  previous = previous ? resolveProjectTokens(previous) : null;
  const pages = snapshot.pages.filter(page => previous && (
    JSON.stringify(page) !== JSON.stringify(previous.pages.find(old => old.id === page.id)) ||
    JSON.stringify(snapshot.threads.filter(thread => thread.pageId === page.id)) !== JSON.stringify(previous.threads.filter(thread => thread.pageId === page.id))
  ));
  const page = pages.find(page => page.id === preferredPageId) || pages[0] || snapshot.pages.find(page => page.id === preferredPageId) || snapshot.pages[0];
  const boxes: ChangeBox[] = [];
  if (page && previous) {
    const before = resolvedNodes(previous.pages.find(old => old.id === page.id)?.nodes || []), after = resolvedNodes(page.nodes);
    const oldNodes = new Map(before.map(node => [node.id, node])), newNodes = new Map(after.map(node => [node.id, node]));
    const signature = (node?: DesignNode) => node ? JSON.stringify({ ...node, generation: undefined }) : undefined;
    const changed = new Set(after.filter(node => signature(node) !== signature(oldNodes.get(node.id))).map(node => node.id));
    const oldThreads = new Map(previous.threads.map(thread => [thread.id, thread]));
    for (const thread of snapshot.threads.filter(thread => thread.pageId === page.id)) {
      if (thread.nodeId && JSON.stringify(thread) !== JSON.stringify(oldThreads.get(thread.id))) changed.add(thread.nodeId);
    }
    const removed = new Set(before.filter(node => !newNodes.has(node.id)).map(node => node.id));
    for (const node of after) if (changed.has(node.id) && (!node.parentId || !changed.has(node.parentId))) boxes.push({ id: node.id, ...visualBounds(node, after) });
    for (const node of before) if (removed.has(node.id) && (!node.parentId || !removed.has(node.parentId))) boxes.push({ id: node.id, ...visualBounds(node, before), removed: true });
  }
  return { page, boxes };
}
const presets = [
  { name: 'Mobile', detail: '390 × 844', width: 390, height: 844, Icon: Smartphone },
  { name: 'Tablet', detail: '834 × 1194', width: 834, height: 1194, Icon: Tablet },
  { name: 'Laptop', detail: '1280 × 800', width: 1280, height: 800, Icon: Monitor },
  { name: 'Desktop', detail: '1440 × 900', width: 1440, height: 900, Icon: Monitor },
  { name: 'Slide · 16:9', detail: '1920 × 1080', width: 1920, height: 1080, Icon: Presentation },
  { name: 'Slide · 4:3', detail: '1200 × 900', width: 1200, height: 900, Icon: Presentation },
];

function IconButton({ label, children, onClick, active, disabled, className = '' }: { label: string; children: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return <button className={`icon-button ${active ? 'active' : ''} ${className}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}>{children}</button>;
}
function initialBoardId() {
  return embedded ? '' : new URLSearchParams(location.search).get('board') || '';
}
function finishCanvasTextEdit() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches('.canvas-world .is-editing[contenteditable="true"]')) active.blur();
}

export default function App() {
  const { project: liveProject, projects, ref: projectRef, loading, hydrated, paneSelection, bindSelection, saving, error, setError, load, refreshProjects, setSnapshot, captureNavigation, commit, restoreVersion, boardNavigation } = useProject();
  const [historyOpen, setHistoryOpen] = useState(false), [historyPreview, setHistoryPreview] = useState<DesignProject | null>(null);
  const [library, setLibrary] = useState<'system' | 'inspiration' | null>(null);
  const [changeFlash, setChangeFlash] = useState<{ key: number; pageId: string; boxes: ChangeBox[] } | null>(null);
  const historyReturn = useRef<{ boardId: string; pageId: string; view: Viewport; inspector: boolean } | null>(null);
  const project = historyOpen && historyPreview?.id === liveProject?.id ? historyPreview : liveProject;
  const [boardId, setBoardId] = useState(initialBoardId);
  const [pageId, setPageId] = useState(() => embedded ? '' : new URLSearchParams(location.search).get('page') || '');
  const [storedSelectionIds, setSelectionIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ box: SnapBox | null; ids: string[] } | null>(null);
  const selectionIds = marquee?.ids ?? storedSelectionIds;
  const selection = selectionIds.at(-1) ?? null, selectionKey = JSON.stringify(selectionIds), multiple = selectionIds.length > 1;
  const setSelection = useCallback((id: string | null) => setSelectionIds(id ? [id] : []), []);
  const [tool, setTool] = useState<Tool>('select'), [menu, setMenu] = useState<Menu>(null), [inspector, setInspector] = useState(false);
  const [view, commitView] = useState<Viewport>({ x: 90, y: 130, zoom: .31 });
  const viewRef = useRef(view), cameraFrame = useRef(0);
  const flushView = useCallback(() => {
    if (!cameraFrame.current) return;
    cancelAnimationFrame(cameraFrame.current); cameraFrame.current = 0;
    commitView(viewRef.current);
  }, []);
  const setView = useCallback((next: Viewport | ((previous: Viewport) => Viewport)) => {
    if (cameraFrame.current) cancelAnimationFrame(cameraFrame.current);
    cameraFrame.current = 0;
    viewRef.current = typeof next === 'function' ? next(viewRef.current) : next;
    commitView(viewRef.current);
  }, []);
  const queueView = useCallback((next: Viewport | ((previous: Viewport) => Viewport)) => {
    viewRef.current = typeof next === 'function' ? next(viewRef.current) : next;
    if (!cameraFrame.current) cameraFrame.current = requestAnimationFrame(() => {
      cameraFrame.current = 0; commitView(viewRef.current);
    });
  }, []);
  useEffect(() => () => { if (cameraFrame.current) cancelAnimationFrame(cameraFrame.current); }, []);
  recordCanvasView(view);
  const [previewPatch, setPreviewPatch] = useState<Record<string, Partial<DesignNode>> | null>(null), [drawing, setDrawing] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null), [showComments, setShowComments] = useState(true);
  const selectLayer = useCallback((id: string, additive = false) => {
    setSelectionIds(previous => additive ? previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id] : [id]);
    setCommentTarget(null);
  }, []);
  const [commentNavigation, setCommentNavigation] = useState<{ projectId: string; pageId: string; threadId: string } | null>(null);
  const commentMore = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState(''), [modal, setModal] = useState<'export' | 'help' | 'auth' | null>(null), [previewId, setPreviewId] = useState<string | null>(null);
  const [pageNameDraft, setPageNameDraft] = useState(''), [renamingPage, setRenamingPage] = useState(false), [newPageName, setNewPageName] = useState('');
  const [preset, setPreset] = useState(presets[0]), [token, setToken] = useState(''), [grid, setGrid] = useState(false);
  const [snapping, setSnapping] = useState(() => { try { return localStorage.getItem('codex-design:snapping') !== 'false'; } catch { return true; } });
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  useEffect(() => { try { localStorage.setItem('codex-design:snapping', String(snapping)); } catch { /* Optional local preference. */ } }, [snapping]);
  const [, setHistoryVersion] = useState(0), [hovered, setHovered] = useState<string | null>(null);
  const multiToolbar = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null), importRef = useRef<HTMLInputElement>(null), mediaRef = useRef<HTMLInputElement>(null), gesture = useRef<Gesture | null>(null), space = useRef(false);
  const [mediaProgress, setMediaProgress] = useState(''), [dropActive, setDropActive] = useState(false);
  const mediaController = useRef<AbortController | null>(null);
  const importingMedia = useRef(false), activeCanvas = useRef<{ projectId: string; pageId: string; readOnly: boolean } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const width = stage.clientWidth, height = stage.clientHeight;
      if (width && height) setStageSize(old => old.width === width && old.height === height ? old : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const flashSequence = useRef(0);
  const undoStack = useRef<HistoryEntry[]>([]), redoStack = useRef<HistoryEntry[]>([]), viewCache = useRef(new Map<string, Viewport>()), toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bound = !historyOpen && paneSelection?.projectId === project?.id ? paneSelection : null;
  const board = project?.boards.find(item => item.id === (bound?.boardId || boardId)) || (!bound ? project?.boards[0] : undefined);
  const boardPages = useMemo(() => project?.pages.filter(item => item.boardId === board?.id) || [], [project?.pages, board?.id]);
  const page = boardPages.find(p => p.id === (bound?.pageId || pageId)) || boardPages[0];
  useLayoutEffect(() => { activeCanvas.current = project && page ? { projectId: project.id, pageId: page.id, readOnly: historyOpen || !!library } : null; });
  useEffect(() => () => { activeCanvas.current = null; }, []);
  useLayoutEffect(() => () => { mediaController.current?.abort(); }, [project?.id, page?.id, historyOpen, loading, library]);
  useEffect(() => { if (liveProject && page) recordCanvasReady(); }, [liveProject?.id, page?.id]);
  const renderProject = useMemo(() => project ? resolveProjectTokens(project) : null, [project]);
  const renderPage = renderProject?.pages.find(item => item.id === page?.id);
  const baseNodes = useMemo(() => resolvedNodes(renderPage?.nodes || []), [renderPage?.nodes]);
  const nodes = useMemo(() => previewPatch ? resolvedNodes((renderPage?.nodes || []).map(node => previewPatch[node.id] ? { ...node, ...previewPatch[node.id] } : node)) : baseNodes, [baseNodes, renderPage?.nodes, previewPatch]);
  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const selected = selection ? nodeById.get(selection) : undefined;
  const storedSelected = useMemo(() => page?.nodes.find(node => node.id === selection), [page?.nodes, selection]);
  const selectedNodes = useMemo(() => selectionIds.flatMap(id => nodeById.get(id) ?? []), [selectionIds, nodeById]);
  const selectedRoots = useMemo(() => selectionRoots(selectionIds, baseNodes), [selectionIds, baseNodes]);
  const visibleSelection = useMemo(() => selectedNodes.filter(node => {
    let current: DesignNode | undefined = node; const seen = new Set<string>();
    while (current) { if (current.hidden || seen.has(current.id)) return false; seen.add(current.id); current = current.parentId ? nodeById.get(current.parentId) : undefined; }
    return true;
  }), [selectedNodes, nodeById]);
  const movableSelection = selectedRoots.length > 0 && selectedRoots.every(node => objectEditable(node,nodeById) && !['vertical','horizontal'].includes(nodeById.get(node.parentId ?? '')?.styles.layout ?? '') && parentLocalDelta(node,baseNodes,{x:0,y:0}) !== null);
  const roots = useMemo(() => nodes.filter(node => !node.parentId), [nodes]);
  const cancelGesture = useCallback(() => { gesture.current = null; setMarquee(null); setPreviewPatch(null); setDrawing(null); setSnapGuides([]); }, []);
  useLayoutEffect(() => { cancelGesture(); }, [project?.id, project?.revision, page?.id, loading, historyOpen, library, tool, modal, previewId, cancelGesture]);
  useLayoutEffect(() => { const g=gesture.current; if(g&&(g.kind==='drag'||g.kind==='resize')&&selectionKey!==g.selectionKey)cancelGesture(); }, [selectionKey,cancelGesture]);
  useEffect(() => {
    const releaseSpace = () => { space.current = false; if (stageRef.current) stageRef.current.style.cursor = ''; };
    const reset = () => { releaseSpace(); flushView(); cancelGesture(); };
    const hidden = () => { if (document.hidden) reset(); };
    // Capture key release even when a popup consumes its bubbling keyboard events.
    const keyUp = (event: KeyboardEvent) => { if (event.code === 'Space') releaseSpace(); };
    window.addEventListener('blur', reset);
    window.addEventListener('keyup', keyUp, true);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('keyup', keyUp, true);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [cancelGesture, flushView]);
  const screens = useMemo(() => roots.filter(node => node.type === 'frame'), [roots]);
  const visibleRootKey = useMemo(() => {
    if (library) return '[]';
    if (!stageSize.width || !stageSize.height) return JSON.stringify(roots.map(node => node.id));
    let selectedRoot = selected;
    const ancestors = new Set<string>();
    while (selectedRoot?.parentId && !ancestors.has(selectedRoot.id)) {
      ancestors.add(selectedRoot.id); selectedRoot = nodeById.get(selectedRoot.parentId);
    }
    // Keep overflowing roots and the edited tree; clipped frames get a 200px prefetch gutter.
    return JSON.stringify(roots.filter(node => {
      if (node.id === selectedRoot?.id || !clippedRootTypes.has(node.type) || [node.styles.overflow,node.styles.overflowX,node.styles.overflowY].includes('visible') || node.effects?.some(effect=>effect.enabled!==false&&effect.type!=='transform')) return true;
      const box = visualBounds(node, nodes);
      return view.x+(box.x+box.width)*view.zoom>=-200&&view.x+box.x*view.zoom<=stageSize.width+200&&view.y+(box.y+box.height)*view.zoom>=-200&&view.y+box.y*view.zoom<=stageSize.height+200;
    }).map(node=>node.id));
  }, [roots, nodes, selected, nodeById, stageSize, view, library]);
  const visibleRootIds = useMemo<ReadonlySet<string>>(() => new Set(JSON.parse(visibleRootKey) as string[]), [visibleRootKey]);
  const frameLabels = useMemo(() => layoutFrameLabels(nodes, view.zoom), [nodes, view.zoom]);
  const notify = useCallback((message: string) => { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4400); }, []);
  const copy = useCallback((text: string) => { void navigator.clipboard.writeText(text).then(() => notify('Copied to clipboard.')).catch(() => notify('Clipboard unavailable. Select and copy the source from the Code panel.')); }, [notify]);
  const selectBoard = (id: string) => {
    const target = !historyOpen && liveProject ? bindSelection({ projectId: liveProject.id, boardId: id }) : null;
    setBoardId(id); setPageId(target?.pageId || ''); setMenu(null);
  };
  const selectPage = (id: string) => {
    if (!historyOpen && liveProject && board) bindSelection({ projectId: liveProject.id, boardId: board.id, pageId: id });
    setPageId(id);
  };
  const closeHistory = () => {
    const previous = historyReturn.current;
    setHistoryOpen(false); setHistoryPreview(null); setChangeFlash(null);
    if (previous) { setBoardId(previous.boardId); setPageId(previous.pageId); setView(previous.view); setInspector(previous.inspector); }
    historyReturn.current = null;
  };
  const openHistory = () => {
    if (historyOpen) { closeHistory(); return; }
    flushView(); setLibrary(null);
    historyReturn.current = { boardId, pageId: page?.id || '', view: viewRef.current, inspector };
    cancelGesture(); setPreviewId(null); setCommentTarget(null); setMenu(null); setTool('select'); setInspector(false); setHistoryOpen(true);
  };
  const openLibrary = (mode: 'system' | 'inspiration') => {
    if (!project || historyOpen || loading) return;
    finishCanvasTextEdit(); flushView(); space.current = false;
    if (stageRef.current) stageRef.current.style.cursor = '';
    cancelGesture(); setPreviewId(null); setCommentTarget(null); setMenu(null); setModal(null); setTool('select'); setHovered(null); setDropActive(false);
    setLibrary(current => current === mode ? null : mode);
  };
  const previewVersion = (snapshot: DesignProject, previous: DesignProject | null) => {
    const changes = versionChanges(snapshot, previous, pageId);
    setHistoryPreview(snapshot); setSelection(null); setCommentTarget(null); setPreviewId(null);
    if (changes.page) {
      setBoardId(changes.page.boardId || snapshot.boards[0].id); setPageId(changes.page.id);
      setChangeFlash({ key: ++flashSequence.current, pageId: changes.page.id, boxes: changes.boxes });
    }
  };
  const applyVersion = async (revision: number) => {
    const next = await restoreVersion(revision);
    if (!next) return false;
    setHistoryOpen(false); setHistoryPreview(null); setChangeFlash(null); setSelection(null);
    setInspector(historyReturn.current?.inspector || false); historyReturn.current = null;
    undoStack.current = []; redoStack.current = []; setHistoryVersion(value => value + 1);
    notify(`Version ${revision} applied. The previous design remains in history.`);
    return true;
  };

  useEffect(() => { const handler = () => setModal('auth'); window.addEventListener('codex-design:auth-required', handler); return () => window.removeEventListener('codex-design:auth-required', handler); }, []);
  useEffect(() => {
    if (!project || !board) return;
    setBoardId(board.id);
    setRenamingPage(false); setNewPageName('');
  }, [project?.id, board?.id, historyOpen]);
  useEffect(() => {
    if (!project || !board) return;
    try { if (!embedded && !historyOpen) { const url = new URL(location.href); url.searchParams.set('project', project.id); url.searchParams.set('board', board.id); if (page) url.searchParams.set('page', page.id); history.replaceState(null, '', url); } }
    catch { /* Embedded hosts may provide an opaque URL with no writable history. */ }
  }, [project?.id, board?.id, page?.id, historyOpen]);
  useEffect(() => { if (boardNavigation) { setHistoryOpen(false); setHistoryPreview(null); setChangeFlash(null); historyReturn.current = null; setBoardId(boardNavigation.boardId); setPageId(boardNavigation.pageId || ''); } }, [boardNavigation]);
  useEffect(() => { if (embedded && hydrated && !loading && !liveProject) setMenu('project'); }, [hydrated, loading, liveProject?.id]);
  useEffect(() => { setLibrary(null); setHistoryOpen(false); setHistoryPreview(null); setChangeFlash(null); historyReturn.current = null; }, [liveProject?.id]);
  useEffect(() => {
    if (!project || !page) return;
    setPageId(page.id); setSelection(null); setCommentTarget(null); setPreviewId(null); setModal(null);
    const key = `${project.id}/${page.id}`, cached = viewCache.current.get(key);
    if (cached) setView(cached);
    else {
      const width = stageRef.current?.clientWidth || window.innerWidth;
      const zoom = page.nodes.length ? Math.min(.42, Math.max(.28, (width - 250) / 3250)) : .65;
      setView(page.nodes.length ? { x: Math.max(40, (width - 3174 * zoom) / 2 - 80 * zoom), y: 185, zoom } : { x: 120, y: 130, zoom });
    }
    undoStack.current = []; redoStack.current = []; setHistoryVersion(n => n + 1);
  }, [project?.id, page?.id]);
  useEffect(() => { if (project && page && !historyOpen) viewCache.current.set(`${project.id}/${page.id}`, view); }, [view, project?.id, page?.id, historyOpen]);
  useEffect(() => { const ids = new Set(page?.nodes.map(node => node.id)); setSelectionIds(previous => { const next = previous.filter(id => ids.has(id)); return next.length === previous.length ? previous : next; }); }, [page?.nodes]);
  useEffect(() => {
    if (!hydrated || loading || historyOpen || marquee || !liveProject || !board || !page || paneSelection?.projectId !== liveProject.id) return;
    const selectedContext = selectedNodes.map(node => ({ id: node.id, name: node.name, type: node.type }));
    updateModelContext({ projectId: liveProject.id, projectName: liveProject.name, boardId: board.id, boardName: board.name, revision: liveProject.revision, pageId: page.id, libraryMode: library, selectedNode: selectedContext.length === 1 ? selectedContext[0] : null, selectedNodes: selectedContext, openThreadId: commentTarget?.threadId || null });
  }, [hydrated, loading, liveProject?.id, liveProject?.revision, historyOpen, !!marquee, paneSelection?.projectId, board?.id, board?.name, page?.id, selectionKey, commentTarget?.threadId, library]);
  useEffect(() => {
    if (!changeFlash || changeFlash.pageId !== page?.id) return;
    const box = stageRef.current;
    if (box && changeFlash.boxes.length) {
      const left = Math.min(...changeFlash.boxes.map(item => item.x)), top = Math.min(...changeFlash.boxes.map(item => item.y));
      const right = Math.max(...changeFlash.boxes.map(item => item.x + item.width)), bottom = Math.max(...changeFlash.boxes.map(item => item.y + item.height));
      const zoom = clampZoom(Math.min((box.clientWidth - 100) / Math.max(1, right - left), (box.clientHeight - 180) / Math.max(1, bottom - top), .8));
      setView({ zoom, x: (box.clientWidth - (right - left) * zoom) / 2 - left * zoom, y: (box.clientHeight - (bottom - top) * zoom) / 2 - top * zoom + 20 });
    }
    const timer = setTimeout(() => setChangeFlash(null), 850);
    return () => clearTimeout(timer);
  }, [changeFlash?.key, page?.id]);
  useEffect(() => { if (!menu) return; const capture = menu === 'comments'; const close = (e: globalThis.PointerEvent) => { if (!(e.target as Element).closest(capture ? '.comment-control' : '.dropdown,.floating-toolbar,.project-switch')) setMenu(null); }; window.addEventListener('pointerdown', close, capture); return () => window.removeEventListener('pointerdown', close, capture); }, [menu]);
  useEffect(() => { const stage = stageRef.current; if (!stage) return; const wheel = (event: WheelEvent) => {
    if ((event.target as Element).closest('.comment-popover,.dropdown,.selection-toolbar')) return;
    event.preventDefault();
    if (gesture.current?.kind === 'marquee') return;
    if (event.ctrlKey || event.metaKey) {
      const box = stage.getBoundingClientRect(), px = event.clientX - box.left, py = event.clientY - box.top;
      queueView(old => { const zoom = clampZoom(old.zoom * Math.exp(-event.deltaY * .008)); return { zoom, x: px - (px - old.x) * zoom / old.zoom, y: py - (py - old.y) * zoom / old.zoom }; });
    } else queueView(old => ({ ...old, x: old.x - event.deltaX, y: old.y - event.deltaY }));
  }; stage.addEventListener('wheel', wheel, { passive: false }); return () => stage.removeEventListener('wheel', wheel); }, [queueView]);
  useEffect(() => { if (tool !== 'comment') setHovered(null); }, [tool]);
  useEffect(() => { setMenu(current => current === 'comments' ? null : current); }, [project?.id, page?.id, loading, historyOpen, library, modal, previewId]);

  const change = useCallback((operations: Operation[], record = true) => {
    if (historyOpen) return Promise.resolve(null);
    const targetPage = page?.id;
    return commit(operations, record && targetPage ? (before, after) => {
      const bp = before.pages.find(p => p.id === targetPage), ap = after.pages.find(p => p.id === targetPage);
      if (!bp || !ap || JSON.stringify(bp) === JSON.stringify(ap)) return;
      undoStack.current.push({ projectId: before.id, pageId: targetPage, before: structuredClone(bp), after: structuredClone(ap), beforeThreads: structuredClone(before.threads.filter(t => t.pageId === targetPage)), afterThreads: structuredClone(after.threads.filter(t => t.pageId === targetPage)) });
      if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; setHistoryVersion(v => v + 1);
    } : undefined);
  }, [commit, page?.id, historyOpen]);
  const undo = useCallback(async (redo = false) => {
    const from = redo ? redoStack.current : undoStack.current, to = redo ? undoStack.current : redoStack.current;
    const entry = from.at(-1); if (!entry || !projectRef.current || saving || historyOpen) return;
    if (entry.projectId !== projectRef.current.id || entry.pageId !== page?.id) return;
    const currentPage = projectRef.current.pages.find(p => p.id === entry.pageId);
    if (JSON.stringify(currentPage) !== JSON.stringify(redo ? entry.before : entry.after)) {
      undoStack.current = []; redoStack.current = []; setHistoryVersion(v => v + 1);
      notify('This page changed in another session. Undo history was cleared to preserve those changes.');
      return;
    }
    const p = redo ? entry.after : entry.before, threads = redo ? entry.afterThreads : entry.beforeThreads;
    const operations: Operation[] = [{ type: 'replace_page', pageId: p.id, page: p }];
    for (const thread of threads) if (!projectRef.current.threads.some(t => t.id === thread.id)) operations.push({ type: 'create_thread', thread });
    if (await commit(operations)) { from.pop(); to.push(entry); setHistoryVersion(v => v + 1); }
  }, [commit, page?.id, saving, historyOpen, notify]);
  const remove = useCallback(() => {
    if (!selectedRoots.length || !page || saving || loading) return;
    const locked = selectedRoots.some(node => {
      let current: DesignNode | undefined = node; const seen = new Set<string>();
      while (current && !seen.has(current.id)) { if (current.locked) return true; seen.add(current.id); current = current.parentId ? nodeById.get(current.parentId) : undefined; }
      return false;
    });
    if (locked) { notify('Unlock the selected layers and their parents before deleting.'); return; }
    const isCurrent = captureNavigation();
    void change(selectedRoots.map(node => ({ type: 'delete_node', pageId: page.id, nodeId: node.id }))).then(next => {
      if (next && isCurrent()) setSelectionIds(current => current === selectionIds ? [] : current);
    });
  }, [selectedRoots, page, saving, loading, nodeById, notify, captureNavigation, change, selectionIds]);
  const duplicate = useCallback(() => {
    if (!selectedRoots.length || !page || saving || loading) return;
    const copies = duplicateNodes(selectionIds, page.nodes), copyIds = new Set<string>(copies.map(node => node.id)), isCurrent = captureNavigation();
    void change(copies.map(node => ({ type: 'create_node', pageId: page.id, node }))).then(next => {
      if (next && isCurrent()) setSelectionIds(current => current === selectionIds ? copies.filter(node => !copyIds.has(node.parentId ?? '')).map(node => node.id) : current);
    });
  }, [selectedRoots, page, saving, loading, selectionIds, captureNavigation, change]);
  const zoomTo = (zoom: number) => { const width = stageRef.current?.clientWidth || 1000, height = stageRef.current?.clientHeight || 800; setView(old => { const z = clampZoom(zoom); return { zoom: z, x: width / 2 - (width / 2 - old.x) * z / old.zoom, y: height / 2 - (height / 2 - old.y) * z / old.zoom }; }); };
  const fit = () => { if (page && stageRef.current) setView(fitViewport({...page,nodes}, stageRef.current.clientWidth, stageRef.current.clientHeight)); setMenu(null); };
  const focus = useCallback((id: string) => { const n = nodeById.get(id); if (!n || !stageRef.current) return; const box = visualBounds(n,nodes), width = stageRef.current.clientWidth, height = stageRef.current.clientHeight, zoom = clampZoom(Math.min((width - 180) / Math.max(1,box.width), (height - 180) / Math.max(1,box.height), 1.5)); setView({ zoom, x: (width - box.width * zoom) / 2 - box.x * zoom, y: (height - box.height * zoom) / 2 - box.y * zoom + 20 }); setSelection(id); }, [nodeById, nodes, setView]);
  const fitSelection = () => {
    const box = selectionBounds(visibleSelection,nodes), stage = stageRef.current;
    if (!box || !stage) return;
    const zoom = clampZoom(Math.min((stage.clientWidth-180)/Math.max(1,box.width),(stage.clientHeight-180)/Math.max(1,box.height),1.5));
    setView({zoom,x:(stage.clientWidth-box.width*zoom)/2-box.x*zoom,y:(stage.clientHeight-box.height*zoom)/2-box.y*zoom+20});
  };
  const changeLayer = useCallback((operations: Operation[]) => change(operations), [change]);
  const changeLibrary = useCallback((operations: Operation[]) => change(operations, false), [change]);
  const closeInspector = useCallback(() => setInspector(false), []);
  const editText = useCallback((id: string, content: string) => { if (page) void change([{ type: 'update_node', pageId: page.id, nodeId: id, patch: { content } }]); }, [page?.id, change]);
  const nearestFrame = useCallback((id: string | null) => {
    let node = id ? nodeById.get(id) : undefined;
    while (node && node.type !== 'frame') node = node.parentId ? nodeById.get(node.parentId) : undefined;
    return node?.id || null;
  }, [nodeById]);
  const importMedia = useCallback(async (input: File[], position?: { x: number; y: number }, parentId = nearestFrame(selection)) => {
    if (!project || !page || historyOpen || library || loading || importingMedia.current || !input.length) return;
    const owner = { projectId: project.id, pageId: page.id }, isCurrent = captureNavigation();
    const stillHere = () => isCurrent() && activeCanvas.current?.projectId === owner.projectId && activeCanvas.current.pageId === owner.pageId && !activeCanvas.current.readOnly;
    const controller = new AbortController();
    mediaController.current = controller; importingMedia.current = true; setMenu(null);
    let placed = 0;
    try {
      if (input.length > 16) throw new Error('Import up to 16 media files at a time.');
      const files = input.map(mediaFile);
      for (const [index, file] of files.entries()) {
        if (!stillHere() || controller.signal.aborted) break;
        setMediaProgress(`Importing ${index + 1}/${files.length} · ${file.name}`);
        const size = await mediaDimensions(file, controller.signal);
        if (!stillHere() || controller.signal.aborted) break;
        const asset = await client.uploadAsset(file, file.name, (loaded, total) => setMediaProgress(`Importing ${index + 1}/${files.length} · ${Math.round(loaded / total * 100)}%`), controller.signal);
        if (!stillHere() || controller.signal.aborted) break;
        const bounds = insertionBounds(nodes, parentId, viewRef.current, { width: stageRef.current?.clientWidth || 1000, height: stageRef.current?.clientHeight || 800 }, size, position && { x: position.x + index * 24, y: position.y + index * 24 });
        const type = asset.mimeType.startsWith('video/') ? 'video' : 'image';
        const node: DesignNode = { ...newNode(type, bounds.x, bounds.y, bounds.parentId), ...bounds, name: file.name.slice(0, 160), media: { src: asset.ref, fit: 'contain', alt: file.name.replace(/\.[^.]+$/, '').slice(0, 2000), ...(type === 'video' ? { muted: true, loop: false, autoplay: false } : {}) }, styles: { fill: 'transparent' } };
        if (!await change([{ type: 'create_node', pageId: owner.pageId, node }])) break;
        placed++;
        if (!stillHere() || controller.signal.aborted) break;
        setSelection(node.id); setTool('select'); setMenu(null);
      }
      if (placed && stillHere() && !controller.signal.aborted) notify(`${placed === 1 ? 'Media added' : `${placed} media files added`}. Original files stay available in exports and saved versions.`);
    } catch (error) { if (!controller.signal.aborted && stillHere()) setError(`${placed ? `${placed} file(s) added. ` : ''}${(error as Error).message}`); }
    finally {
      if (controller.signal.aborted && stillHere()) notify(placed ? `Import stopped. ${placed} added file(s) remain on the canvas.` : 'Media import cancelled.');
      mediaController.current = null; importingMedia.current = false; setMediaProgress(''); setDropActive(false);
    }
  }, [project?.id, page?.id, historyOpen, library, loading, captureNavigation, nearestFrame, selection, nodes, change, notify, setError]);
  const cancelMediaImport = () => { const controller = mediaController.current; if (!controller) return; controller.abort(); setMediaProgress('Stopping import…'); setMenu(null); };
  const addShader = async (shader: ShaderConfig) => {
    if (!page || historyOpen) return;
    const bounds = insertionBounds(nodes, nearestFrame(selection), viewRef.current, stageSize, { width: 640, height: 400 });
    const node: DesignNode = { ...newNode('shader', bounds.x, bounds.y, bounds.parentId), ...bounds, name: shader.preset === 'custom' ? 'Custom shader' : `${shader.preset[0].toUpperCase()}${shader.preset.slice(1)} shader`, shader, styles: { fill: '#202020' } };
    if (await change([{ type: 'create_node', pageId: page.id, node }])) { setSelection(node.id); setTool('select'); setMenu(null); }
  };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (historyOpen || library || modal || previewId || (event.target as Element).closest('input,textarea,select,[contenteditable="true"]')) return;
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length) { event.preventDefault(); void importMedia(files); }
    };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  }, [importMedia, historyOpen, library, modal, previewId]);
  const addFrame = async (p = preset) => {
    if (!page || !stageRef.current) return;
    const centerX = (stageRef.current.clientWidth / 2 - view.x) / view.zoom, centerY = (stageRef.current.clientHeight / 2 - view.y) / view.zoom;
    let anchor = selected;
    while (anchor?.parentId) anchor = nodes.find(n => n.id === anchor?.parentId);
    if (anchor?.type !== 'frame') anchor = screens.at(-1);
    const node = { ...newNode('frame', anchor ? anchor.x + anchor.width + 100 : centerX - p.width / 2, anchor ? anchor.y : centerY - p.height / 2), width: p.width, height: p.height, name: `${p.name.startsWith('Slide') ? 'Slide' : p.name} ${screens.length + 1}`, styles: { fill: p.name.startsWith('Slide') ? '#ffffff' : '#0b0c0e' } };
    const next = await change([{ type: 'create_node', pageId: page.id, node }]);
    if (next) { setSelection(node.id); setTool('select'); setMenu(null); const box = stageRef.current; const zoom = clampZoom(Math.min((box.clientWidth - 200) / node.width, (box.clientHeight - 200) / node.height, .8)); setView({ zoom, x: (box.clientWidth - node.width * zoom) / 2 - node.x * zoom, y: (box.clientHeight - node.height * zoom) / 2 - node.y * zoom + 25 }); }
  };
  const createProject = async (name: string, template: 'blank' | 'demo') => {
    if (historyOpen) return false;
    try { const next = await client.create(name.trim() || (template === 'demo' ? 'GaugeReel Mobile' : 'Untitled project'), template); await setSnapshot(next); setBoardId(next.boards[0].id); setPageId(next.pages[0].id); setMenu(null); notify('Project created.'); return true; }
    catch (e) { setError((e as Error).message); return false; }
  };
  const createBoard = async (name: string) => {
    if (!project) return false;
    const id = uid(), next = await change([{ type: 'create_board', board: { id, name: name.trim() || 'Untitled board' } }], false);
    if (!next) return false;
    selectBoard(id); notify('Board created.'); return true;
  };
  const createPage = async () => { if (!project || !board) return; const p: DesignPage = { id: uid(), boardId: board.id, name: newPageName.trim() || `Page ${boardPages.length + 1}`, nodes: [], viewport: { x: 120, y: 100, zoom: .65 } }; if (await change([{ type: 'create_page', page: p }], false)) { selectPage(p.id); setNewPageName(''); setMenu(null); } };

  const point = (e: { clientX: number; clientY: number }) => { const box = stageRef.current!.getBoundingClientRect(), current = viewRef.current; return { x: (e.clientX - box.left - current.x) / current.zoom, y: (e.clientY - box.top - current.y) / current.zoom }; };
  const capture = (pointerId: number) => { try { stageRef.current?.setPointerCapture(pointerId); } catch { /* Pointer may already be released. */ } };
  const beginDraw = (e: ReactPointerEvent, parentId: string | null = null) => {
    if (!page) return;
    const pos = point(e);
    if (tool !== 'frame' && !parentLocalPoint(parentId, nodes, pos)) { notify('Adjust the parent transform scale before drawing inside it.'); return; }
    gesture.current = { kind: 'draw', tool, startX: pos.x, startY: pos.y, x: pos.x, y: pos.y, parentId: tool === 'frame' ? null : parentId, points: [pos] };
    capture(e.pointerId);
  };
  const beginMarquee = (e: ReactPointerEvent) => {
    if (e.button !== 0 || !page || loading || library || modal || previewId) return;
    const pos = point(e);
    const candidates = baseNodes.flatMap(node => {
      if (!objectEditable(node,nodeById)) return [];
      const box = visibleBounds(node,baseNodes);
      return box ? [{id:node.id,box}] : [];
    });
    gesture.current={kind:'marquee',startX:pos.x,startY:pos.y,clientX:e.clientX,clientY:e.clientY,additive:e.shiftKey,initial:storedSelectionIds,nodes:baseNodes,candidates,moved:false};
    setMarquee({box:null,ids:e.shiftKey?storedSelectionIds:[]}); setCommentTarget(null);
    e.preventDefault(); stageRef.current?.focus({preventScroll:true}); capture(e.pointerId);
  };
  const marqueePreview = (g: MarqueeGesture, e: {clientX:number;clientY:number}) => {
    if (!g.moved && Math.hypot(e.clientX-g.clientX,e.clientY-g.clientY)<4) return {box:null,ids:g.additive?g.initial:[]};
    g.moved=true;
    const stage=stageRef.current!.getBoundingClientRect();
    const pos=point({clientX:Math.max(stage.left,Math.min(stage.right,e.clientX)),clientY:Math.max(stage.top,Math.min(stage.bottom,e.clientY))});
    const box={x:Math.min(g.startX,pos.x),y:Math.min(g.startY,pos.y),width:Math.abs(pos.x-g.startX),height:Math.abs(pos.y-g.startY)};
    const hits=g.candidates.filter(({box:target})=>target.x>=box.x-1e-6&&target.y>=box.y-1e-6&&target.x+target.width<=box.x+box.width+1e-6&&target.y+target.height<=box.y+box.height+1e-6);
    const ids=selectionRoots(hits.map(hit=>hit.id),g.nodes).map(node=>node.id);
    return {box,ids:g.additive?[...new Set([...g.initial,...ids])]:ids};
  };
  const canvasDown = (e: ReactPointerEvent) => {
    flushView();
    finishCanvasTextEdit();
    if (e.button === 2) return; setMenu(null);
    if (e.button === 1 || space.current || tool === 'hand') { e.preventDefault(); gesture.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, view: viewRef.current }; capture(e.pointerId); return; }
    if (historyOpen) return;
    if (tool === 'comment') { const pos = point(e); setCommentTarget({ nodeId: null, ...pos }); return; }
    if (tool !== 'select') { beginDraw(e); return; }
    beginMarquee(e);
  };
  const nodeDown = (id: string, e: ReactPointerEvent) => {
    flushView();
    finishCanvasTextEdit();
    if (e.button === 2) return;
    if (tool === 'hand' || space.current || e.button === 1) { canvasDown(e); return; }
    if (historyOpen) { setSelection(id); return; }
    const node = nodeById.get(id);
    if (!node) return;
    if (tool === 'comment') { const pos = point(e); setSelection(id); setCommentTarget({ nodeId: id, ...pos }); return; }
    if (tool !== 'select') { let frame = node; while (frame.parentId) frame = nodes.find(n => n.id === frame.parentId)!; beginDraw(e, frame.type === 'frame' ? frame.id : null); return; }
    if (e.shiftKey) { cancelGesture(); selectLayer(id,true); e.preventDefault(); return; }
    const ids = selectionIds.includes(id) ? selectionIds : [id], targets = selectionRoots(ids,baseNodes), box = selectionBounds(targets,baseNodes);
    if (!selectionIds.includes(id)) setSelection(id);
    setCommentTarget(null);
    if (!saving && !loading && box && targets.every(target => objectEditable(target,nodeById) && !['vertical','horizontal'].includes(nodeById.get(target.parentId ?? '')?.styles.layout ?? '') && parentLocalDelta(target,baseNodes,{x:0,y:0}) !== null)) gesture.current = { kind: 'drag', targets, selectionKey:JSON.stringify(ids), box, nodes: baseNodes, scene: createSnapScene(baseNodes,targets[0],targets), startX: e.clientX, startY: e.clientY, moved: false, pointer: {clientX:e.clientX,clientY:e.clientY} };
  };
  const nodeDownRef = useRef(nodeDown);
  useLayoutEffect(() => { nodeDownRef.current = nodeDown; });
  const selectNode = useCallback((id: string, event: ReactPointerEvent) => nodeDownRef.current(id, event), []);
  const objectPreview = (g: ObjectGesture, pointer: {clientX:number;clientY:number}, bypass: boolean) => {
    const zoom = viewRef.current.zoom, dx = (pointer.clientX-g.startX)/zoom, dy = (pointer.clientY-g.startY)/zoom;
    if (!g.moved && Math.hypot(pointer.clientX-g.startX,pointer.clientY-g.startY)<4) return null;
    g.moved = true; g.pointer = pointer;
    const west = g.corner?.includes('w'), north = g.corner?.includes('n');
    const boxes = g.targets.map(node => visualBounds(node,g.nodes));
    const minimumWidth = g.box.width * Math.max(...g.targets.map((node,index) => (boxes[index].width-node.width+8)/Math.max(1,boxes[index].width)));
    const minimumHeight = g.box.height * Math.max(...g.targets.map((node,index) => (boxes[index].height-node.height+8)/Math.max(1,boxes[index].height)));
    const resize = (box: SnapBox) => {
      const width = Math.max(minimumWidth,box.width), height = Math.max(minimumHeight,box.height);
      return {width,height,x:g.box.x+(west?g.box.width-width:0),y:g.box.y+(north?g.box.height-height:0)};
    };
    let box = g.kind === 'drag' ? {...g.box,x:g.box.x+dx,y:g.box.y+dy} : resize({...g.box,width:g.box.width+(west?-dx:dx),height:g.box.height+(north?-dy:dy)});
    let guides: SnapGuide[] = [];
    if (snapping && !bypass && g.scene) {
      const result = snapBox(g.scene,box,6/zoom,g.kind==='resize'?{x:west?'start':'end',y:north?'start':'end'}:undefined);
      box = g.kind === 'resize' ? resize(result.box) : result.box;
      guides = result.guides;
    }
    const patches: Record<string,Partial<DesignNode>> = {};
    for (const [index,node] of g.targets.entries()) {
      const original = boxes[index], sx = box.width/Math.max(1,g.box.width), sy = box.height/Math.max(1,g.box.height);
      const delta = parentLocalDelta(node,g.nodes,g.kind === 'drag' ? {x:box.x-g.box.x,y:box.y-g.box.y} : {x:box.x+(original.x-g.box.x)*sx-original.x,y:box.y+(original.y-g.box.y)*sy-original.y});
      if (!delta) return null;
      patches[node.id] = {x:node.x+delta.x,y:node.y+delta.y,...(g.kind==='resize'?{width:Math.max(8,node.width+original.width*(sx-1)),height:Math.max(8,node.height+original.height*(sy-1))}:{})};
    }
    if (g.kind==='resize') {
      const actual = selectionBounds(g.targets.map(node=>({...node,...patches[node.id]})),g.nodes)!;
      guides = guides.filter(guide=>Math.abs((guide.axis==='x'?(west?actual.x:actual.x+actual.width):(north?actual.y:actual.y+actual.height))-guide.position)<1e-6);
    }
    return {patches,guides};
  };
  const showObjectPreview = (g: ObjectGesture, pointer: {clientX:number;clientY:number}, bypass: boolean) => {
    const result = objectPreview(g,pointer,bypass);
    if (result) { setPreviewPatch(result.patches); setSnapGuides(result.guides); }
    return result;
  };
  const canvasMove = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) { if (tool === 'comment') { const el = (e.target as Element).closest('[data-node-id]'); setHovered(el?.getAttribute('data-node-id') || null); } return; }
    if (g.kind === 'pan') { queueView({ ...g.view, x: g.view.x + e.clientX - g.startX, y: g.view.y + e.clientY - g.startY }); return; }
    if (g.kind === 'marquee') {
      const next=marqueePreview(g,e);
      setMarquee(previous=>({...next,ids:previous&&previous.ids.length===next.ids.length&&previous.ids.every((id,index)=>id===next.ids[index])?previous.ids:next.ids})); return;
    }
    if (g.kind === 'drag' || g.kind === 'resize') {
      if (showObjectPreview(g,{clientX:e.clientX,clientY:e.clientY},e.altKey)) capture(e.pointerId);
      return;
    }
    if (g.kind !== 'draw') return;
    const pos = point(e); g.x = pos.x; g.y = pos.y; if (g.tool === 'pen') g.points.push(pos);
    setDrawing({ x: Math.min(g.startX,pos.x), y: Math.min(g.startY,pos.y), width: Math.abs(pos.x-g.startX), height: Math.abs(pos.y-g.startY) });
  };
  const canvasUp = async (e: ReactPointerEvent) => {
    flushView();
    const g = gesture.current; gesture.current = null; setSnapGuides([]);
    if (!g || !page) return;
    if (stageRef.current?.hasPointerCapture(e.pointerId)) stageRef.current.releasePointerCapture(e.pointerId);
    if (g.kind === 'marquee') { setSelectionIds(marqueePreview(g,e).ids); setMarquee(null); return; }
    if (g.kind === 'drag' || g.kind === 'resize') {
      const result = objectPreview(g,{clientX:e.clientX,clientY:e.clientY},e.altKey);
      const operations: Operation[] = result ? g.targets.flatMap(node => { const patch = result.patches[node.id]; return Object.entries(patch).some(([key,value])=>node[key as keyof DesignNode]!==value) ? [{type:'update_node' as const,pageId:page.id,nodeId:node.id,patch}] : []; }) : [];
      if (operations.length) await change(operations);
      setPreviewPatch(null); return;
    }
    if (g.kind !== 'draw') return;
    setDrawing(null);
    const start = parentLocalPoint(g.parentId, nodes, { x: g.startX, y: g.startY }), end = parentLocalPoint(g.parentId, nodes, { x: g.x, y: g.y });
    if (!start || !end) { notify('Adjust the parent transform scale before drawing inside it.'); return; }
    const dx = Math.abs(end.x - start.x), dy = Math.abs(end.y - start.y), clicked = Math.hypot(g.x-g.startX,g.y-g.startY) < 8;
    const type = g.tool === 'note' || g.tool === 'frame' ? 'frame' : g.tool === 'pen' ? 'code' : g.tool as DesignNode['type'];
    let node = newNode(type, Math.min(start.x, end.x), Math.min(start.y, end.y), g.parentId);
    if (type === 'frame' && g.tool !== 'note') node = { ...node, name: `${preset.name.startsWith('Slide') ? 'Slide' : preset.name} ${screens.length + 1}`, width: clicked ? preset.width : Math.max(40,dx), height: clicked ? preset.height : Math.max(40,dy), styles: { fill: preset.name.startsWith('Slide') ? '#ffffff' : '#0b0c0e' } };
    else if (!clicked) node = { ...node, width: Math.max(2,dx), height: type === 'line' || type === 'arrow' ? 2 : Math.max(8,dy) };
    const operations: Operation[] = [];
    if (g.tool === 'note') {
      node = { ...node, name: 'Note', width: clicked ? 260 : Math.max(100,dx), height: clicked ? 180 : Math.max(80,dy), styles: { fill: '#d8c789', radius: 2 } };
      const text = { ...newNode('text',20,20,node.id), name: 'Note text', width: node.width-40, height: node.height-40, content: 'Add a note…', styles: { color: '#28251c',fontSize:24 } };
      operations.push({ type: 'create_node', pageId: page.id, node }, { type: 'create_node',pageId:page.id,node:text });
    } else if (g.tool === 'pen') {
      const points = g.points.map(p => parentLocalPoint(g.parentId, nodes, p));
      if (points.some(p => !p)) { notify('Adjust the parent transform scale before drawing inside it.'); return; }
      const localPoints = points as { x: number; y: number }[];
      const minX = Math.min(...localPoints.map(p=>p.x)), minY = Math.min(...localPoints.map(p=>p.y)), width = Math.max(4,Math.max(...localPoints.map(p=>p.x))-minX), height = Math.max(4,Math.max(...localPoints.map(p=>p.y))-minY);
      const path = localPoints.map((p,i)=>`${i ? 'L' : 'M'}${(p.x-minX).toFixed(1)} ${(p.y-minY).toFixed(1)}`).join(' ');
      node = { ...node, x:minX, y:minY, width, height, name:'Drawing',source:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path d="${path}" fill="none" stroke="#e8eaed" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>` };
      operations.push({ type:'create_node',pageId:page.id,node });
    } else { if (type === 'code') { node.width = clicked ? 480 : node.width; node.height = clicked ? 320 : node.height; node.source = '<style>body{margin:0;background:#1d1f24;color:#e8eaed;font:24px system-ui;display:grid;place-items:center;min-height:100vh}</style><h1>Your component</h1>'; } operations.push({ type:'create_node',pageId:page.id,node }); }
    if (await change(operations)) { setSelection(node.id); setTool('select'); }
  };

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (gesture.current?.kind === 'marquee') { if (!['Shift','Control','Meta','Alt'].includes(e.key)) e.preventDefault(); if(e.key==='Escape'){flushView();cancelGesture();} return; }
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return;
      const command = e.metaKey || e.ctrlKey;
      if (e.key==='Alt') { const g=gesture.current; if(g&&(g.kind==='drag'||g.kind==='resize'))showObjectPreview(g,g.pointer,true); return; }
      if (e.key === 'Escape') { if (!gesture.current&&!menu&&!commentTarget&&!previewId&&!modal&&!library&&!historyOpen) setSelection(null); flushView(); cancelGesture(); setMenu(null); setCommentTarget(null); setPreviewId(null); setModal(null); setTool('select'); setLibrary(null); if (historyOpen && !saving) closeHistory(); return; }
      if (modal || previewId) return;
      if (library) return;
      if (e.code === 'Space') { if ((e.target as HTMLElement).closest('button')) return; e.preventDefault(); space.current = true; if (stageRef.current) stageRef.current.style.cursor = 'grab'; return; }
      if (historyOpen) {
        if (command && ['+','=','-'].includes(e.key)) { e.preventDefault(); zoomTo(view.zoom*(e.key==='-'?.8:1.25)); }
        else if (command && ['z','d'].includes(e.key.toLowerCase())) e.preventDefault();
        else if (e.key === '1') fit();
        else if (e.key === '0') zoomTo(1);
        return;
      }
      if (command && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); if (project) setModal('export'); return; }
      if (command && !e.shiftKey && e.key.toLowerCase() === 'i') { e.preventDefault(); if (page && !importingMedia.current) mediaRef.current?.click(); return; }
      if ((command&&['z','d'].includes(e.key.toLowerCase()))||['Backspace','Delete'].includes(e.key)) cancelGesture();
      if (command && e.key.toLowerCase() === 'z') { e.preventDefault(); void undo(e.shiftKey); return; }
      if (command && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); remove(); return; }
      if (command && ['+','=','-'].includes(e.key)) { e.preventDefault(); zoomTo(view.zoom*(e.key==='-'?.8:1.25)); return; }
      if (selectedRoots.length && page && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault(); cancelGesture();
        if (saving || loading || !movableSelection) return;
        const amount=e.shiftKey?10:1, movement={x:e.key==='ArrowLeft'?-amount:e.key==='ArrowRight'?amount:0,y:e.key==='ArrowUp'?-amount:e.key==='ArrowDown'?amount:0};
        void change(selectedRoots.map(node => { const delta=parentLocalDelta(node,baseNodes,movement)!; return {type:'update_node',pageId:page.id,nodeId:node.id,patch:{x:node.x+delta.x,y:node.y+delta.y}}; })); return;
      }
      if (command) return;
      const shortcuts:Record<string,Tool> = {v:'select',h:'hand',t:'text',f:'frame',r:'rectangle',o:'ellipse',l:e.shiftKey?'arrow':'line',p:'pen',c:'comment',n:'note'};
      const next = shortcuts[e.key.toLowerCase()]; if (next) { setTool(next); setMenu(null); }
      if (e.key==='1') fit(); if(e.key==='0') zoomTo(1); if(e.key==='?') setModal('help');
    };
    const keyUp = (e:KeyboardEvent)=>{if(e.key==='Alt'){const g=gesture.current;if(g&&(g.kind==='drag'||g.kind==='resize'))showObjectPreview(g,g.pointer,false);}};
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);return()=>{window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);};
  }, [selectedRoots,movableSelection,baseNodes,page,view,undo,duplicate,remove,change,modal,previewId,historyOpen,saving,loading,library,snapping,menu,commentTarget]);

  const openComment = (thread: CommentThread) => {
    if (!project || loading || historyOpen || library) return;
    const targetPage = project.pages.find(item => item.id === thread.pageId);
    if (!targetPage) { notify('This conversation’s page is no longer available.'); return; }
    const target = bindSelection({ projectId: project.id, boardId: targetPage.boardId, pageId: targetPage.id });
    if (!target || target.pageId !== targetPage.id) return;
    finishCanvasTextEdit(); flushView(); cancelGesture();
    setBoardId(target.boardId); setPageId(target.pageId); setTool('select'); setPreviewId(null); setModal(null); setMenu(null); setShowComments(true);
    setCommentNavigation({ projectId: project.id, pageId: target.pageId, threadId: thread.id });
  };
  // Run after the page-change reset so cross-board navigation retains its selected conversation.
  useEffect(() => {
    if (!commentNavigation) return;
    setCommentNavigation(null);
    if (loading || historyOpen || library || project?.id !== commentNavigation.projectId || page?.id !== commentNavigation.pageId) return;
    const thread = project.threads.find(item => item.id === commentNavigation.threadId && item.pageId === page.id);
    if (!thread || !stageRef.current) return;
    const anchor = thread.nodeId ? nodeById.get(thread.nodeId) : undefined, bounds = anchor ? visualBounds(anchor, nodes) : thread;
    if (anchor) focus(anchor.id);
    else { const zoom = viewRef.current.zoom; setView({ zoom, x: stageRef.current.clientWidth / 2 - thread.x * zoom, y: stageRef.current.clientHeight / 2 - thread.y * zoom }); setSelection(null); }
    setCommentTarget({ nodeId: anchor?.id || null, x: anchor ? bounds.x + Math.min(anchor.width, 80) : thread.x, y: bounds.y, threadId: thread.id });
  }, [commentNavigation, project, page?.id, loading, historyOpen, library, nodeById, nodes, focus, setView]);

  const sendComment = async (content:string, sendToCodex:boolean, intent?:CommentMessage['intent']) => {
    if (!project || !page || !commentTarget) return false;
    const target = commentTarget, isCurrent = captureNavigation();
    if (target.threadId && !project.threads.some(thread => thread.id === target.threadId)) { notify('This conversation is no longer available.'); return false; }
    const now=new Date().toISOString(), message={id:uid(),role:'user' as const,content,createdAt:now,...(intent?{intent}:{})};
    const thread:CommentThread = commentTarget.threadId ? project.threads.find(t=>t.id===commentTarget.threadId)! : {id:uid(),pageId:page.id,nodeId:commentTarget.nodeId,x:commentTarget.x,y:commentTarget.y,status:'open',queued:sendToCodex,messages:[],createdAt:now};
    const next=await change(commentTarget.threadId?[{type:'add_message',threadId:thread.id,message,queued:sendToCodex},{type:'update_thread',threadId:thread.id,patch:{status:'open'}}]:[{type:'create_thread',thread:{...thread,messages:[message]}}],false);
    if(!next)return false;
    if (isCurrent() && !activeCanvas.current?.readOnly) { setCommentTarget(current => current === target ? {...target,threadId:thread.id} : current); setShowComments(true); }
    if(sendToCodex){try{const delivered=await sendFollowUp(commentPrompt(next,next.threads.find(t=>t.id===thread.id)!));notify(delivered?'Sent to Codex. The conversation will update here.':'Comment saved and queued. Copy the request from this conversation to your connected Codex chat.');}catch{notify('Comment saved and queued. Copy the request to your connected Codex chat.');}}
    else notify('Comment saved.');
    return true;
  };
  const selectedBox = selectionBounds(selectionRoots(visibleSelection.map(node=>node.id),nodes),nodes);
  const resizableSelection = selectedRoots.length > 0 && selectedRoots.every(node=>objectEditable(node,nodeById)&&!hasTransformedAncestor(node,baseNodes)) && (!multiple || movableSelection);
  const hoveredNode = tool==='comment' && !commentTarget && hovered ? nodeById.get(hovered) : null;
  const hoveredBox = hoveredNode ? visualBounds(hoveredNode,nodes) : null;
  const commentPosition = commentTarget && stageRef.current ? {left:Math.max(16,Math.min(stageRef.current.clientWidth-400,view.x+commentTarget.x*view.zoom+22)),top:Math.max(90,Math.min(stageRef.current.clientHeight-330,view.y+commentTarget.y*view.zoom+12))} : {left:20,top:100};
  const currentPreview=nodes.find(n=>n.id===previewId), previewIndex=screens.findIndex(n=>n.id===previewId), previewZoom=currentPreview?Math.max(.1,Math.min((window.innerHeight-180)/currentPreview.height,(window.innerWidth-180)/currentPreview.width,1)):1;

  return <div className={`app ${historyOpen ? 'history-mode' : ''}`}>
    <header className="titlebar"><ProjectMenu project={project} projects={projects} readOnly={historyOpen} boardId={board?.id} open={menu==='project'} onToggle={()=>{setMenu(menu==='project'?null:'project');void refreshProjects().catch(()=>{});}} onSelectProject={id=>{if(historyOpen)return;setBoardId('');setPageId('');void load(id);setMenu(null);}} onSelectBoard={selectBoard} onCreateProject={createProject} onCreateBoard={createBoard} onImport={()=>importRef.current?.click()}/>
    <span className="save-status">{mediaProgress?<><LoaderCircle size={12} className="spin"/><span className="media-progress-text">{mediaProgress}</span></>:historyOpen?<><History size={12}/>Preview · v{project?.revision}</>:saving?<><LoaderCircle size={12} className="spin"/>Saving…</>:project?<><Check size={12}/>All changes saved</>:null}</span><div className="titlebar-actions"><IconButton label="Project design system" active={library==='system'} disabled={!project||historyOpen||loading} onClick={()=>openLibrary('system')}><Palette size={17}/></IconButton><IconButton label="Board inspiration" active={library==='inspiration'} disabled={!project||historyOpen||loading} onClick={()=>openLibrary('inspiration')}><Images size={17}/></IconButton><IconButton label="Version history" active={historyOpen} disabled={!liveProject||!!saving} onClick={openHistory}><History size={17}/></IconButton><div className="comment-control"><IconButton label="Tag a component · C" disabled={!project||loading||historyOpen||!!library} active={tool==='comment'} onClick={()=>{setTool(tool==='comment'?'select':'comment');setCommentTarget(null);setMenu(null);}}><MessageCircle size={17}/>{project?.threads.some(t=>t.queued)&&<span className="notification-dot"/>}</IconButton><button ref={commentMore} className="comment-more" disabled={!project||loading||historyOpen||!!library} aria-label="All comments" aria-haspopup="dialog" aria-expanded={menu==='comments'} aria-controls={menu==='comments'?'all-comments':undefined} title="More comment options · All comments" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();setMenu(null);}}} onClick={()=>{finishCanvasTextEdit();cancelGesture();setCommentTarget(null);setMenu(menu==='comments'?null:'comments');}}><ChevronDown size={12}/></button>{menu==='comments'&&project&&!loading&&!historyOpen&&!library&&<CommentList key={project.id} project={project} showPins={showComments} onTogglePins={()=>setShowComments(value=>!value)} onOpen={openComment} onClose={()=>{setMenu(null);commentMore.current?.focus({preventScroll:true});}}/>}</div><button className="share-button" title="Export · ⌘⇧E" disabled={!project||historyOpen||!!library} onClick={()=>setModal('export')}><Download size={13}/>Export</button><IconButton label="Toggle fullscreen" onClick={()=>{void fullscreen().catch(()=>notify('Fullscreen is not available in this view.'));}}><Maximize2 size={17}/></IconButton></div></header>
    <div className="workspace">
      <main ref={stageRef} tabIndex={-1} className={`canvas-stage tool-${tool} ${grid?'show-grid':''} ${dropActive?'is-file-drop':''}`} aria-label="Infinite design canvas" aria-hidden={!!library} onPointerDown={canvasDown} onPointerMove={canvasMove} onPointerLeave={()=>setHovered(null)} onPointerUp={e=>{void canvasUp(e);}} onPointerCancel={()=>{flushView();cancelGesture();}} onLostPointerCapture={()=>{if(gesture.current)cancelGesture();}} onContextMenu={e=>e.preventDefault()} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=historyOpen?'none':'copy';if(!historyOpen&&!importingMedia.current)setDropActive(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setDropActive(false);}} onDrop={e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();setDropActive(false);if(historyOpen){notify('Close History to add media.');return;}const target=(e.target as Element).closest('[data-node-id]')?.getAttribute('data-node-id')||null;void importMedia(Array.from(e.dataTransfer.files),point(e),nearestFrame(target));}} style={{...(grid?{backgroundPosition:`${view.x}px ${view.y}px`,backgroundSize:`${Math.max(8,40*view.zoom)}px ${Math.max(8,40*view.zoom)}px`}:{}),...(library?{display:'none'}:{})}}>
        <div className="canvas-world" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.zoom})`}}><CanvasNodes nodes={nodes} designSystem={project?.designSystem} visibleRootIds={visibleRootIds} interactive={!historyOpen&&!library} onSelect={selectNode} onTextEdit={historyOpen||library||tool==='comment'?undefined:editText}/></div>
        {frameLabels.map(({node,left,top,width,height})=><div key={node.id} className={`canvas-frame-label${width<100?' compact':''}`} style={{left:view.x+left,top:view.y+top,width,height,lineHeight:`${height}px`}} onPointerDown={e=>{e.stopPropagation();nodeDown(node.id,e);}}><button className="frame-name" title={node.name} onDoubleClick={e=>{if(!e.shiftKey){setSelection(node.id);setInspector(true);}}}>{!historyOpen && !library && node.generation?.status === 'building' ? `Building · ${node.name}` : node.name}</button><button className="frame-play" title={`Preview ${node.name}`} aria-label={`Preview ${node.name}`} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setPreviewId(node.id);}}><Play size={10}/><span>PLAY</span></button></div>)}
        {multiple&&tool==='select'&&visibleSelection.map(node=>{const box=visualBounds(node,nodes);return <div key={node.id} className="selection-overlay selection-member" aria-hidden="true" style={{left:view.x+box.x*view.zoom,top:view.y+box.y*view.zoom,width:box.width*view.zoom,height:box.height*view.zoom}}/>;})}
        {selectedBox&&(tool!=='comment'||commentTarget?.nodeId===selected?.id)&&<div className={`selection-overlay${multiple?' selection-group':''}`} style={{left:view.x+selectedBox.x*view.zoom,top:view.y+selectedBox.y*view.zoom,width:selectedBox.width*view.zoom,height:selectedBox.height*view.zoom}}>
          {tool==='select'&&!marquee&&!historyOpen&&!saving&&!loading&&resizableSelection&&['nw','ne','sw','se'].map(corner=><button key={corner} className={`resize-handle ${corner}`} aria-label={`Resize selection ${corner}`} title={multiple?'Resize selected bounds; child contents retain their size':`Resize ${corner}`} onPointerDown={e=>{
            e.stopPropagation(); if(e.button!==0)return;
            const box=selectionBounds(selectedRoots,baseNodes)!,node=selectedRoots[0],parent=nodeById.get(node.parentId??'');
            gesture.current={kind:'resize',targets:selectedRoots,selectionKey,box,nodes:baseNodes,scene:['vertical','horizontal'].includes(parent?.styles.layout??'')?null:createSnapScene(baseNodes,node,selectedRoots),corner,startX:e.clientX,startY:e.clientY,moved:false,pointer:{clientX:e.clientX,clientY:e.clientY}};capture(e.pointerId);
          }}/>)}
          {tool==='select'&&<span className="size-label">{multiple?`${selectionIds.length} objects · `:''}{Math.round(selectedBox.width)} × {Math.round(selectedBox.height)}</span>}
        </div>}
        {multiple&&!inspector&&!historyOpen&&!library&&!previewId&&!modal&&!commentTarget&&!loading&&tool==='select'&&!gesture.current&&!drawing&&!previewPatch&&selectedBox&&stageSize.width>0&&stageSize.height>0&&view.x+(selectedBox.x+selectedBox.width)*view.zoom>0&&view.x+selectedBox.x*view.zoom<stageSize.width&&view.y+(selectedBox.y+selectedBox.height)*view.zoom>0&&view.y+selectedBox.y*view.zoom<stageSize.height&&<div ref={multiToolbar} tabIndex={-1} className="selection-toolbar multi-selection-toolbar" role="toolbar" aria-label="Selected objects" style={{left:Math.max(8,Math.min(stageSize.width-220,view.x+(selectedBox.x+selectedBox.width/2)*view.zoom-106)),top:Math.max(52,Math.min(stageSize.height-42,view.y+selectedBox.y*view.zoom-42)),maxWidth:Math.max(0,stageSize.width-16)}} onPointerDown={e=>e.stopPropagation()}>
          <span role="status">{selectionIds.length} selected</span><IconButton label="Duplicate selection · ⌘D" disabled={!!saving} onClick={()=>{multiToolbar.current?.focus({preventScroll:true});duplicate();}}><Copy size={15}/></IconButton><IconButton label="Delete selection" disabled={!!saving} onClick={()=>{multiToolbar.current?.focus({preventScroll:true});remove();}}><Trash2 size={15}/></IconButton><IconButton label="Export selection" disabled={!!saving} onClick={()=>setModal('export')}><Download size={15}/></IconButton><IconButton label="Deselect all" onClick={()=>setSelection(null)}><X size={15}/></IconButton>
        </div>}
        {!multiple&&!inspector&&!historyOpen&&!library&&!previewId&&!modal&&!commentTarget&&!loading&&tool==='select'&&!gesture.current&&!drawing&&!previewPatch&&project&&page&&selected&&storedSelected&&!selected.hidden&&selectedBox&&selectedBox.width>0&&selectedBox.height>0&&view.x+(selectedBox.x+selectedBox.width)*view.zoom>0&&view.x+selectedBox.x*view.zoom<stageSize.width&&view.y+(selectedBox.y+selectedBox.height)*view.zoom>0&&view.y+selectedBox.y*view.zoom<stageSize.height&&<SelectionToolbar key={`${project.id}/${page.id}/${selected.id}`} project={project} pageId={page.id} node={storedSelected} effective={selected} anchor={{left:view.x+selectedBox.x*view.zoom,top:view.y+selectedBox.y*view.zoom,width:selectedBox.width*view.zoom,height:selectedBox.height*view.zoom}} viewport={stageSize} editable={objectEditable(selected,nodeById)} stackChild={!!selected.parentId&&['vertical','horizontal'].includes(nodeById.get(selected.parentId)?.styles.layout??'')} disabled={!!saving} onChange={changeLayer} onComment={()=>{setMenu(null);setShowComments(true);setCommentTarget({nodeId:selected.id,x:selectedBox.x+Math.min(selected.width,80),y:selectedBox.y});}} onInspect={()=>{setMenu(null);setInspector(true);}} onDuplicate={duplicate} onDelete={remove}/>}
        {!!snapGuides.length&&<svg className="snap-guides" aria-hidden="true">{snapGuides.map(guide=>{
          const vertical=guide.axis==='x',position=(vertical?view.x:view.y)+guide.position*view.zoom;
          const start=Math.max(0,(vertical?view.y:view.x)+guide.start*view.zoom-8),end=Math.min(vertical?stageSize.height:stageSize.width,(vertical?view.y:view.x)+guide.end*view.zoom+8);
          return <path key={guide.axis} d={vertical?`M${position},${start}V${end}M${position-3},${start}h6M${position-3},${end}h6`:`M${start},${position}H${end}M${start},${position-3}v6M${end},${position-3}v6`}/>;
        })}</svg>}
        {hoveredBox&&<div className="hover-outline" style={{left:view.x+hoveredBox.x*view.zoom,top:view.y+hoveredBox.y*view.zoom,width:hoveredBox.width*view.zoom,height:hoveredBox.height*view.zoom}}/>}
        {drawing&&<div className="drawing-preview" style={{left:view.x+drawing.x*view.zoom,top:view.y+drawing.y*view.zoom,width:drawing.width*view.zoom,height:drawing.height*view.zoom,borderRadius:tool==='ellipse'?'50%':0}}/>}
        {marquee?.box&&<div className="marquee-selection" aria-hidden="true" style={{left:view.x+marquee.box.x*view.zoom,top:view.y+marquee.box.y*view.zoom,width:marquee.box.width*view.zoom,height:marquee.box.height*view.zoom}}/>}
        {changeFlash?.pageId===page?.id&&changeFlash?.boxes.map(box=><div key={`${changeFlash.key}/${box.id}`} className={`version-change-flash ${box.removed?'removed':''}`} style={{left:view.x+box.x*view.zoom,top:view.y+box.y*view.zoom,width:Math.max(3,box.width*view.zoom),height:Math.max(3,box.height*view.zoom)}}/>)}
        {historyOpen&&<div className="history-preview-banner"><History size={13}/><span>Version {project?.revision} · Preview only</span></div>}
        {!loading&&historyOpen&&!nodes.length&&<div className="canvas-empty history-empty"><Frame size={28}/><p>This page was empty in this version.</p></div>}
        {showComments&&project?.threads.filter(thread=>thread.pageId===page?.id&&(thread.status==='open'||thread.id===commentTarget?.threadId)).map(thread=>{const anchor=nodes.find(n=>n.id===thread.nodeId),pos=anchor?visualBounds(anchor,nodes):thread;return <button key={thread.id} disabled={historyOpen} className={`comment-pin ${thread.status==='resolved'?'resolved':''} ${thread.id===commentTarget?.threadId?'selected':''}`} style={{left:view.x+(anchor?pos.x+Math.min(anchor.width,80):thread.x)*view.zoom,top:view.y+(anchor?pos.y:thread.y)*view.zoom}} aria-label={`Open conversation on ${anchor?.name||'canvas'}`} title={thread.messages.at(-1)?.content} onPointerDown={e=>e.stopPropagation()} onClick={()=>{setMenu(null);setSelection(thread.nodeId);setCommentTarget({nodeId:thread.nodeId,x:anchor?pos.x+Math.min(anchor.width,80):thread.x,y:anchor?pos.y:thread.y,threadId:thread.id});}}>{thread.messages.at(-1)?.role==='assistant'?<Code2 size={15}/>:'Y'}{thread.queued&&<span/>}</button>;})}
        {commentTarget&&project&&page&&<CommentPopover key={`${project.id}/${commentTarget.threadId||`${commentTarget.nodeId}-${commentTarget.x}`}`} project={project} pageId={page.id} target={commentTarget} position={commentPosition} onClose={()=>setCommentTarget(null)} onSend={sendComment} onResolve={async thread=>!!await change([{type:'update_thread',threadId:thread.id,patch:{status:thread.status==='resolved'?'open':'resolved',queued:false}}],false)} onCopy={copy}/>}
        <div className="floating-toolbar toolbar-left" onPointerDown={e=>e.stopPropagation()}><button className="page-trigger" aria-expanded={menu==='page'} onClick={()=>setMenu(menu==='page'?null:'page')}><span>{page?.name||'Page 1'}</span><ChevronDown size={12}/></button><span className="tool-divider"/>{([{id:'select',label:'Select · V',Icon:MousePointer2},{id:'hand',label:'Hand · H',Icon:Hand},{id:'text',label:'Text · T',Icon:Type},{id:'frame',label:`Frame · F · ${preset.name}`,Icon:Frame},{id:'note',label:'Note · N',Icon:StickyNote},{id:'pen',label:'Pencil · P',Icon:Pencil}] as const).map(({id,label,Icon})=><button key={id} disabled={historyOpen} className={`tool-button ${tool===id?'active':''} ${id==='note'||id==='pen'?'secondary-tool':''}`} aria-label={label} title={label} aria-pressed={tool===id} onClick={()=>{setTool(id);setMenu(id==='frame'?(menu==='frames'?null:'frames'):null);}}><Icon size={19}/></button>)}<button disabled={historyOpen} className={`tool-button shape-trigger ${['rectangle','ellipse','line','arrow','code'].includes(tool)?'active':''}`} title="Shapes and code" aria-label="Shapes and code" aria-expanded={menu==='shapes'} onClick={()=>setMenu(menu==='shapes'?null:'shapes')}><Copy size={19}/><ChevronDown size={11}/></button><button className="tool-button" aria-label={mediaProgress ? 'Cancel media import' : 'Insert media and shaders'} title={mediaProgress ? `${mediaProgress} · Cancel import` : 'Insert media and shaders · ⌘I to import'} aria-expanded={mediaProgress ? undefined : menu==='insert'} disabled={historyOpen||!page||mediaController.current?.signal.aborted} onClick={()=>mediaProgress ? cancelMediaImport() : setMenu(menu==='insert'?null:'insert')}>{mediaProgress ? <X size={19}/> : <ImagePlus size={19}/>}</button>
          {menu==='page'&&<div className="dropdown page-menu">{boardPages.map(p=><div key={p.id} className="page-menu-row"><button className="dropdown-item" onClick={()=>{selectPage(p.id);setMenu(null);}}><span>{p.name}</span>{p.id===page?.id&&<Check size={16}/>}</button><button className="icon-button" aria-label={`Rename ${p.name}`} disabled={historyOpen} onClick={()=>{selectPage(p.id);setPageNameDraft(p.name);setRenamingPage(!renamingPage);}}><MoreHorizontal size={17}/></button></div>)}{renamingPage&&page&&<form className="menu-form" onSubmit={e=>{e.preventDefault();void change([{type:'update_page',pageId:page.id,patch:{name:pageNameDraft.trim()||page.name}}],false);setRenamingPage(false);}}><input autoFocus aria-label="Page name" value={pageNameDraft} onChange={e=>setPageNameDraft(e.target.value)} maxLength={160}/><button className="icon-button" aria-label="Save page name" type="submit"><Check size={16}/></button><button className="icon-button danger" type="button" disabled={boardPages.length<2} aria-label="Delete current page" title="Delete current page" onClick={()=>{void change([{type:'delete_page',pageId:page.id}],false);setRenamingPage(false);setMenu(null);}}><Trash2 size={14}/></button></form>}<div className="menu-divider"/><form className="menu-form new-page" onSubmit={e=>{e.preventDefault();void createPage();}}><Plus size={17}/><input disabled={historyOpen} aria-label="New page name" placeholder="New page" value={newPageName} onChange={e=>setNewPageName(e.target.value)} maxLength={160}/><button disabled={historyOpen} aria-label="Create page" className="icon-button" type="submit"><ArrowRight size={16}/></button></form></div>}
          {menu==='shapes'&&<div className="dropdown shape-menu">{([{id:'rectangle',name:'Rectangle',key:'R',Icon:RectangleHorizontal},{id:'ellipse',name:'Oval',key:'O',Icon:Circle},{id:'arrow',name:'Arrow',key:'⇧ L',Icon:ArrowUpRight},{id:'line',name:'Line',key:'L',Icon:ArrowRight},{id:'code',name:'Code component',key:'',Icon:Code2}] as const).map(item=><button key={item.id} className="dropdown-item" onClick={()=>{setTool(item.id);setMenu(null);}}><item.Icon size={18}/><span>{item.name}</span><kbd>{item.key}</kbd></button>)}</div>}
          {menu==='insert'&&<InsertMenu disabled={historyOpen||!!mediaProgress||!page} onPickMedia={()=>{setMenu(null);mediaRef.current?.click();}} onAddShader={shader=>{void addShader(shader);}}/>}
          {menu==='frames'&&<div className="dropdown frame-preset-menu"><div className="menu-heading">Create a frame</div>{presets.map(p=><button className="dropdown-item preset-option" key={p.name} onClick={()=>{setPreset(p);void addFrame(p);}}><p.Icon size={17}/><span>{p.name}</span><small>{p.detail}</small></button>)}<div className="menu-divider"/><button className="dropdown-item" onClick={()=>{setTool('frame');setMenu(null);notify('Drag on the canvas to draw a frame at any size.');}}><Frame size={17}/><span>Draw a custom frame</span><kbd>F</kbd></button></div>}
        </div>
        <div className="floating-toolbar toolbar-right" onPointerDown={e=>e.stopPropagation()}><IconButton label="Preview selected screen" disabled={!screens.length} onClick={()=>setPreviewId((selected?.type==='frame'&&!selected.parentId?selected:screens[0])?.id||null)}><Play size={17}/></IconButton><span className="tool-divider"/><IconButton label="Toggle inspector" disabled={historyOpen} active={inspector} onClick={()=>setInspector(!inspector)}><PanelRight size={18}/></IconButton><span className="tool-divider"/><button className="zoom-trigger" aria-label="Canvas zoom" aria-expanded={menu==='zoom'} onClick={()=>setMenu(menu==='zoom'?null:'zoom')}>{Math.round(view.zoom*100)}%<ChevronDown size={13}/></button>{menu==='zoom'&&<div className="dropdown zoom-menu"><button className="dropdown-item" onClick={()=>{zoomTo(view.zoom*1.25);setMenu(null);}}><ZoomIn size={16}/><span>Zoom in</span><kbd>⌘ +</kbd></button><button className="dropdown-item" onClick={()=>{zoomTo(view.zoom*.8);setMenu(null);}}><ZoomOut size={16}/><span>Zoom out</span><kbd>⌘ −</kbd></button><div className="menu-divider"/><button className="dropdown-item" onClick={fit}><Maximize2 size={15}/><span>Fit all content</span><kbd>1</kbd></button><button className="dropdown-item" disabled={!selectedBox} onClick={()=>{fitSelection();setMenu(null);}}><Frame size={15}/><span>Fit selection</span></button>{[.25,.5,1,2].map(z=><button key={z} className="dropdown-item" onClick={()=>{zoomTo(z);setMenu(null);}}><span>{z*100}%</span>{Math.abs(view.zoom-z)<.005&&<Check size={14}/>}</button>)}<div className="menu-divider"/><button className="dropdown-item" aria-pressed={snapping} title="Align edges and centers within frames and across the canvas. Hold Option/Alt to bypass." onClick={()=>{setSnapping(!snapping);setSnapGuides([]);setMenu(null);}}><span>Snap to objects</span>{snapping&&<Check size={14}/>}</button><button className="dropdown-item" onClick={()=>{setGrid(!grid);setMenu(null);}}><span>Show pixel grid</span>{grid&&<Check size={14}/>}</button></div>}</div>
        {loading&&<div className="loading-state"><LoaderCircle size={24} className="spin"/><p>Opening your canvas…</p></div>}
        {dropActive&&<div className="file-drop-label">Drop images or videos here</div>}
        {tool!=='select'&&tool!=='hand'&&<div className="mode-hint" onPointerDown={e=>e.stopPropagation()}>{tool==='comment'?<><MessageCircle size={14}/>Click a component to start a conversation</>:tool==='frame'?<><Frame size={14}/>Draw a frame · click for {preset.width} × {preset.height}</>:tool==='text'?<><Type size={14}/>Click or drag to place text</>:tool==='pen'?<><Pencil size={14}/>Draw on the canvas</>:<>Click or drag to place a {tool}</>}<kbd>esc</kbd></div>}
        <div className="canvas-hint" onPointerDown={e=>e.stopPropagation()}><IconButton label="Undo · ⌘Z" disabled={historyOpen||!undoStack.current.length||!!saving} onClick={()=>{void undo();}}><Undo2 size={15}/></IconButton><IconButton label="Redo · ⇧⌘Z" disabled={historyOpen||!redoStack.current.length||!!saving} onClick={()=>{void undo(true);}}><Redo2 size={15}/></IconButton><IconButton label="Keyboard shortcuts · ?" onClick={()=>setModal('help')}><HelpCircle size={15}/></IconButton></div>
        {!library&&toast&&<div className="toast" role="status" onPointerDown={e=>e.stopPropagation()}><Check size={15}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={13}/></button></div>}
        {!library&&error&&<div className="error-banner" role="alert" onPointerDown={e=>e.stopPropagation()}><span>{error}</span><button className="text-button" onClick={()=>{if(project)void load(project.id);else location.reload();}}>Retry</button><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={15}/></button></div>}
      </main>
      {library&&toast&&<div className="toast" role="status"><Check size={15}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={13}/></button></div>}
      {library&&error&&<div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={()=>{if(project)void load(project.id);}}>Retry</button><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={15}/></button></div>}
      {historyOpen&&liveProject&&<HistoryPanel key={liveProject.id} project={liveProject} saving={!!saving} onClose={closeHistory} onPreview={previewVersion} onApply={applyVersion}/> }
      {library&&project&&board&&<ProjectLibrary key={`${project.id}/${library}/${library==='inspiration'?board.id:''}`} project={project} boardId={board.id} mode={library} readOnly={historyOpen||loading} onChange={changeLibrary} onClose={()=>setLibrary(null)} onNotify={notify}/>}
      {!historyOpen&&!library&&inspector&&project&&page&&<Inspector project={project} page={page} selectedIds={selectionIds} navigationPending={loading||!!saving} onSelect={selectLayer} onChange={changeLayer} onClose={closeInspector} onDelete={remove} onDuplicate={duplicate} onFocus={focus} onOpenDesignSystem={()=>openLibrary('system')}/>}
    </div>
    <input type="file" hidden ref={importRef} accept="application/json,.json,application/zip,.zip" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = '';
      if (!file) return;
      const isCurrent = captureNavigation();
      try {
        const next = await importProjectFile(file);
        void refreshProjects().catch(() => {});
        if (isCurrent() && !activeCanvas.current?.readOnly) { await setSnapshot(next); setMenu(null); notify('Project imported as a new copy.'); }
        else notify(`${next.name} imported. Find it in Projects.`);
      } catch (error) { setError((error as Error).message); }
    }}/>
    <input type="file" hidden ref={mediaRef} aria-label="Import images or videos" accept={mediaAccept} multiple onChange={e=>{const files=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';void importMedia(files);}}/>
    {modal==='export'&&project&&board&&page&&<ExportPanel key={`${project.id}/${board.id}/${page.id}`} project={project} boardId={board.id} pageId={page.id} selectedIds={selectionIds} onClose={()=>setModal(null)} onNotify={notify}/>}
    {(modal==='help'||modal==='auth')&&<div className="modal-backdrop" onPointerDown={()=>{if(modal!=='auth')setModal(null);}}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={modal==='help'?'Keyboard shortcuts':'Connect to workspace'} onPointerDown={e=>e.stopPropagation()}>
        <div className="modal-header"><h2>{modal==='help'?'Keyboard shortcuts':'Connect to your workspace'}</h2>{modal!=='auth'&&<IconButton label="Close dialog" onClick={()=>setModal(null)}><X size={19}/></IconButton>}</div>
        <div className="modal-body">{modal==='auth'?<form className="auth-form" onSubmit={e=>{e.preventDefault();configureToken(token);setToken('');setModal(null);}}><p>This editor requires the access token configured on its server. It stays in this browser session.</p><label>Access token<input autoFocus aria-label="Workspace access token" type="password" value={token} onChange={e=>setToken(e.target.value)}/></label><button className="primary-button" disabled={!token.trim()}>Connect</button></form>:<div className="shortcut-list">{[['Select','V'],['Add / remove selection','⇧ click'],['Box select / add','Drag / ⇧ drag'],['Hand / pan','H or Space'],['Text','T'],['Frame','F'],['Rectangle / oval','R / O'],['Line / arrow','L / ⇧L'],['Pencil / note','P / N'],['Tag a component','C'],['Import image / video','⌘I'],['Export','⌘⇧E'],['Duplicate selection','⌘D'],['Undo / redo','⌘Z / ⇧⌘Z'],['Nudge / larger nudge','Arrows / ⇧Arrows'],['Bypass snapping','Hold Option / Alt'],['Fit all / actual size','1 / 0'],['Zoom','⌘ + scroll'],['Cancel / close','Esc']].map(([label,key])=><div key={label}><span>{label}</span><kbd>{key}</kbd></div>)}</div>}</div>
      </section>
    </div>}
    {currentPreview&&<div className="preview-backdrop" role="dialog" aria-modal="true" aria-label={`Preview ${currentPreview.name}`}><div className="preview-topbar"><button className="text-button" onClick={()=>setPreviewId(null)}><ArrowLeft size={17}/>Back to canvas</button><span>{currentPreview.name}</span><IconButton label="Close preview" onClick={()=>setPreviewId(null)}><X size={20}/></IconButton></div><div className="preview-screen" style={{width:currentPreview.width*previewZoom,height:currentPreview.height*previewZoom}}><div style={{position:'relative',width:currentPreview.width,height:currentPreview.height,transform:`scale(${previewZoom})`,transformOrigin:'0 0'}}><NodeView node={{...currentPreview,x:0,y:0}} nodes={nodes} designSystem={project?.designSystem} interactive={false} preview/></div></div><div className="preview-nav"><IconButton label="Previous frame" disabled={previewIndex<=0} onClick={()=>setPreviewId(screens[previewIndex-1].id)}><ChevronLeft size={18}/></IconButton><span>{previewIndex+1} / {screens.length}</span><IconButton label="Next frame" disabled={previewIndex>=screens.length-1} onClick={()=>setPreviewId(screens[previewIndex+1].id)}><ChevronRight size={18}/></IconButton><span className="preview-size">{currentPreview.width} × {currentPreview.height}</span></div></div>}
  </div>;
}
