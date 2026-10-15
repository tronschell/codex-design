import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasSelection, DesignProject, LibraryScope, Operation, ProjectSummary } from '../shared/types';
import { ApiError, client, projectFromResult, TOKEN_CHANGED_EVENT } from './client';
import { acceptCanvasLaunch, embedded, getCanvasLaunch, onCanvasLaunch, onToolResult, type CanvasLaunch, type CanvasTarget } from './bridge';

function summary(project: DesignProject): ProjectSummary {
  const { id, name, description, revision, createdAt, updatedAt, pages } = project;
  return { id, name, description, revision, createdAt, updatedAt, boardCount: project.boards.length, pageCount: pages.length, screenCount: pages.reduce((count, page) => count + page.nodes.filter((node) => node.type === 'frame' && node.parentId === null).length, 0) };
}
function includeProject(list: ProjectSummary[], project: DesignProject) {
  const existing = list.find((item) => item.id === project.id);
  if (existing && existing.revision > project.revision) return list;
  return [...list.filter((item) => item.id !== project.id), summary(project)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
// Reuses every unchanged subtree of the previous snapshot so memoized canvas layers and undo entries share objects.
// Arrays of records with string ids are matched by id, so inserts and reorders keep untouched nodes.
export function share<T>(prev: unknown, next: T): T {
  if (prev === next || !prev || !next || typeof prev !== 'object' || typeof next !== 'object' || Array.isArray(prev) !== Array.isArray(next)) return next;
  if (Array.isArray(next)) {
    const old = prev as unknown[], byId = new Map(old.map(item => [(item as { id?: unknown } | null)?.id, item]));
    let same = old.length === next.length;
    const items = next.map((item, index) => {
      const id = (item as { id?: unknown } | null)?.id, value = share(typeof id === 'string' ? byId.get(id) : old[index], item);
      if (value !== old[index]) same = false;
      return value;
    });
    return (same ? prev : items) as T;
  }
  const old = prev as Record<string, unknown>, fields: Record<string, unknown> = {};
  let same = Object.keys(old).length === Object.keys(next).length;
  for (const [key, item] of Object.entries(next)) {
    const value = fields[key] = share(old[key], item);
    if (value !== old[key] || !(key in old)) same = false;
  }
  return (same ? prev : fields) as T;
}
function rememberProject(id: string) {
  if (embedded) return;
  try { const url = new URL(location.href); url.searchParams.set('project', id); history.replaceState(null, '', url); }
  catch { /* A standalone host may provide an opaque URL. */ }
}
function resolveSelection(project: DesignProject, target: CanvasTarget): CanvasSelection {
  const requestedPage = project.pages.find(page => page.id === target.pageId);
  const boardId = target.boardId || requestedPage?.boardId || project.boards[0]?.id;
  if (!boardId || !project.boards.some(board => board.id === boardId)) throw new Error('This canvas board is no longer available. Choose a project and board.');
  const page = project.pages.find(page => page.boardId === boardId && page.id === target.pageId) || project.pages.find(page => page.boardId === boardId);
  return { projectId: project.id, boardId, ...(page ? { pageId: page.id } : {}) };
}
const selectionKey = (value: CanvasSelection | null) => value ? `${value.projectId}/${value.boardId}/${value.pageId || ''}` : '';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'The design request could not be completed.';
function projectFromLaunch(id: string, target: CanvasTarget, launch?: CanvasLaunch): DesignProject | undefined {
  const output = launch?.output;
  if (!embedded || !launch?.selection || (output?.canvasScope !== 'thread' && output?.canvasScope !== 'library') || output.projectId !== id || typeof output.boardId !== 'string' || (output.pageId !== undefined && typeof output.pageId !== 'string')) return;
  for (const requested of [target, launch.selection]) {
    if (requested.projectId !== id || (requested.boardId && requested.boardId !== output.boardId) || (requested.pageId && requested.pageId !== output.pageId)) return;
  }
  const snapshot = projectFromResult(output);
  if (!snapshot || snapshot.id !== id) return;
  try {
    const opened = resolveSelection(snapshot, { projectId: id, boardId: output.boardId, pageId: output.pageId });
    if (output.pageId !== undefined && opened.pageId !== output.pageId) return;
    if (selectionKey(resolveSelection(snapshot, target)) !== selectionKey(opened) || selectionKey(resolveSelection(snapshot, launch.selection)) !== selectionKey(opened)) return;
    return snapshot;
  } catch { /* A stale launch selection requires a current project read. */ }
}

export function useProject() {
  const [project, setProject] = useState<DesignProject | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(0), [loading, setLoading] = useState(true), [hydrated, setHydrated] = useState(false);
  const [paneSelection, setPaneSelection] = useState<CanvasSelection | null>(null);
  const [boardNavigation, setBoardNavigation] = useState<CanvasSelection | null>(null);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const binding = useRef<CanvasSelection | null>(null);
  const ref = useRef<DesignProject | null>(null), queue = useRef<Promise<unknown>>(Promise.resolve()), pending = useRef(0);
  const mounted = useRef(true), selection = useRef(0), navigation = useRef(0), listRequest = useRef(0), loadingProject = useRef<string | null>(null);
  const watchLoop = useRef<Promise<void>>(Promise.resolve()), watchFallbackUntil = useRef(0);
  const clearPane = useCallback(() => {
    ref.current = null; binding.current = null;
    if (mounted.current) { setProject(null); setPaneSelection(null); setBoardNavigation(null); }
  }, []);
  const applySnapshot = useCallback((value: DesignProject) => {
    if (!mounted.current || (ref.current?.id === value.id && ref.current.revision > value.revision)) return value;
    if (ref.current?.id === value.id) value = share(ref.current, value);
    setProjects(list => includeProject(list, value));
    if (binding.current?.projectId === value.id) {
      try {
        const next = resolveSelection(value, binding.current);
        if (selectionKey(next) !== selectionKey(binding.current)) { binding.current = next; setPaneSelection(next); }
      } catch (error) { clearPane(); setError(errorMessage(error)); return value; }
    }
    ref.current = value; setProject(value);
    return value;
  }, [clearPane]);
  const activate = useCallback((value: DesignProject, target: CanvasTarget) => {
    const next = resolveSelection(value, target);
    binding.current = next; setPaneSelection(next); setBoardNavigation(next);
    applySnapshot(value); rememberProject(value.id);
  }, [applySnapshot]);
  const bindSelection = useCallback((target: CanvasTarget) => {
    const current = ref.current;
    if (!current || current.id !== target.projectId) return null;
    const next = resolveSelection(current, target);
    if (loadingProject.current) { navigation.current++; loadingProject.current = null; setLoading(false); }
    if (selectionKey(next) !== selectionKey(binding.current)) {
      binding.current = next; setPaneSelection(next); setBoardNavigation(next);
    }
    return next;
  }, []);
  const refreshProjects = useCallback(async () => {
    const request = ++listRequest.current;
    const list = await client.list();
    if (mounted.current && request === listRequest.current) setProjects(ref.current ? includeProject(list, ref.current) : list);
    return list;
  }, []);
  const load = useCallback(async (id: string, target: CanvasTarget = { projectId: id }, launch?: CanvasLaunch) => {
    const intent = ++navigation.current;
    loadingProject.current = id;
    setLoading(true); setError('');
    // Let already queued edits finish before changing the document epoch.
    await queue.current.catch(() => {});
    if (!mounted.current || intent !== navigation.current) return null;
    const request = ++selection.current;
    try {
      const snapshot = projectFromLaunch(id, target, launch);
      const current = ref.current;
      const next = snapshot ? (current?.id === id && current.revision >= snapshot.revision ? current : snapshot) : await client.get(id);
      if (!mounted.current || request !== selection.current || intent !== navigation.current) return null;
      resolveSelection(next, target);
      if (launch) acceptCanvasLaunch(launch);
      activate(next, target);
      return next;
    } catch (error) {
      if (mounted.current && request === selection.current && intent === navigation.current) { clearPane(); setError(errorMessage(error)); }
      return null;
    } finally {
      if (mounted.current && request === selection.current && intent === navigation.current) { loadingProject.current = null; setLoading(false); setHydrated(true); }
    }
  }, [activate, clearPane]);
  const setSnapshot = useCallback(async (value: DesignProject) => {
    const intent = ++navigation.current;
    loadingProject.current = value.id; setLoading(true);
    await queue.current.catch(() => {});
    if (!mounted.current || intent !== navigation.current) return false;
    selection.current++;
    activate(value, { projectId: value.id });
    loadingProject.current = null; setLoading(false); setHydrated(true);
    return true;
  }, [activate]);
  const captureNavigation = useCallback(() => {
    const intent = navigation.current, pane = binding.current;
    return () => mounted.current && intent === navigation.current && pane === binding.current;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; selection.current++; navigation.current++; listRequest.current++; };
  }, []);
  useEffect(() => {
    const updateVisibility = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);
  useEffect(() => {
    let live = true;
    const initialize = async () => {
      const intent = navigation.current;
      setLoading(true); setError('');
      try {
        const launch = embedded ? await getCanvasLaunch() : null;
        if (!live || intent !== navigation.current) return;
        if (embedded) {
          const target = binding.current || launch?.selection;
          if (target) {
            const loading = load(target.projectId, target, launch || undefined);
            void refreshProjects().catch(() => {});
            await loading;
          } else {
            await refreshProjects();
            if (!live || intent !== navigation.current) return;
            clearPane(); setLoading(false); setHydrated(true);
          }
        } else {
          const query = new URLSearchParams(location.search), bound = binding.current;
          const requestedId = bound?.projectId || query.get('project');
          if (requestedId) {
            const target = bound || { projectId: requestedId, boardId: query.get('board') || undefined, pageId: query.get('page') || undefined };
            const loading = load(requestedId, target);
            void refreshProjects().catch(() => {});
            await loading;
          } else {
            await refreshProjects();
            if (!live || intent !== navigation.current) return;
            clearPane(); setLoading(false); setHydrated(true);
          }
        }
      } catch (error) { if (live && intent === navigation.current) { setError(errorMessage(error)); setLoading(false); setHydrated(true); } }
    };
    void initialize();
    const retry = () => { void initialize(); };
    window.addEventListener(TOKEN_CHANGED_EVENT, retry);
    return () => { live = false; window.removeEventListener(TOKEN_CHANGED_EVENT, retry); };
  }, [clearPane, load, refreshProjects]);
  useEffect(() => onCanvasLaunch(launch => { if (launch.selection) void load(launch.selection.projectId, launch.selection, launch); }), [load]);

  const commit = useCallback((operations: Operation[], onApplied?: (before: DesignProject, after: DesignProject) => void): Promise<DesignProject | null> => {
    const targetId = ref.current?.id, request = selection.current;
    if (!targetId || loadingProject.current) return Promise.resolve(null);
    const current = () => mounted.current && selection.current === request && ref.current?.id === targetId;
    pending.current++; setSaving(pending.current);
    const task = queue.current.then(async () => {
      const before = ref.current;
      if (!before || !current()) return null;
      let next: DesignProject;
      try { next = await client.mutate(before.id, before.revision, operations); }
      catch (error) {
        if (!current()) return null;
        const message = errorMessage(error); setError(message);
        try { const saved = await client.get(targetId); if (current()) { applySnapshot(saved); setError(`${message} The latest saved design has been reloaded.`); } }
        catch { /* Retain the visible snapshot if the server cannot be reached. */ }
        return null;
      }
      if (!current()) return null;
      next = applySnapshot(next); setError('');
      try { onApplied?.(before, next); } catch (error) { console.error('Saved design callback failed:', error); }
      return next;
    }).finally(() => { pending.current--; if (mounted.current) setSaving(pending.current); });
    queue.current = task.catch(() => {});
    return task;
  }, [applySnapshot]);

  const restoreVersion = useCallback((revision: number, scope?: LibraryScope, componentId?: string): Promise<DesignProject | null> => {
    const project = ref.current, request = selection.current;
    if (!project || pending.current || loadingProject.current) return Promise.resolve(null);
    pending.current++; setSaving(pending.current);
    const current = () => mounted.current && request === selection.current && ref.current?.id === project.id;
    const task = queue.current.then(async () => {
      if (!current()) return null;
      try {
        const next = scope ? await client.restoreLibraryVersion(project.id, project.revision, revision, scope, componentId) : await client.restoreVersion(project.id, project.revision, revision);
        if (!current()) return null;
        applySnapshot(next); setError(''); return next;
      } catch (error) {
        if (current()) {
          setError(errorMessage(error));
          try { const latest = await client.get(project.id); if (current()) applySnapshot(latest); }
          catch { /* Retain the last saved document if refresh is unavailable. */ }
        }
        return null;
      }
    }).finally(() => { pending.current--; if (mounted.current) setSaving(pending.current); });
    queue.current = task.catch(() => {});
    return task;
  }, [applySnapshot]);

  useEffect(() => {
    if (!hydrated) return;
    const unsubscribe = onToolResult(result => {
      const next = projectFromResult(result);
      if (!next || !mounted.current) return;
      setProjects(list => includeProject(list, next));
      // Generic tool results update only the live bound project; they never navigate a pane.
      if (pending.current || loadingProject.current || next.id !== ref.current?.id) return;
      if (next.revision > ref.current.revision) applySnapshot(next);
    });
    return unsubscribe;
  }, [applySnapshot, hydrated]);

  useEffect(() => {
    if (!hydrated || !visible) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshProjects().catch(() => {}); };
    const interval = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [hydrated, visible, refreshProjects]);

  useEffect(() => {
    const projectId = project?.id;
    if (!hydrated || !visible || loading || !projectId) return;
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, finishDelay: (() => void) | undefined;
    const controller = new AbortController();
    const active = () => !stopped && mounted.current && document.visibilityState !== 'hidden' && ref.current?.id === projectId && binding.current?.projectId === projectId;
    const delay = (milliseconds: number) => new Promise<void>(resolve => { finishDelay = resolve; timer = setTimeout(() => { timer = undefined; finishDelay = undefined; resolve(); }, milliseconds); });
    // Embedded calls cannot be cancelled mid-request. Drain the previous loop before opening another watch.
    const task = watchLoop.current.catch(() => {}).then(async () => {
      let failures = 0;
      while (active()) {
        if (pending.current) { await queue.current.catch(() => {}); continue; }
        if (loadingProject.current) break;
        const current = ref.current!, request = selection.current, fallback = Date.now() < watchFallbackUntil.current;
        try {
          const next: DesignProject | undefined = fallback ? await client.get(projectId, controller.signal) : (await client.watch(projectId, current.revision, controller.signal)).project;
          if (!active()) break;
          if (request !== selection.current) continue;
          if (pending.current || loadingProject.current) continue;
          if (next) {
            if (next.id !== projectId) throw new ApiError('The server returned a different project.', 502, 'invalid_response');
            if (next.revision > ref.current!.revision) { applySnapshot(next); void refreshProjects().catch(() => {}); }
          }
          failures = 0;
          if (fallback && active()) await delay(embedded ? 2500 : 5000);
        } catch (error) {
          if (!active() || controller.signal.aborted) break;
          if (error instanceof ApiError && error.code === 'watch_unsupported') { watchFallbackUntil.current = Date.now() + 60000; continue; }
          failures++;
          await delay(Math.min(30000, (embedded ? 2500 : 5000) * 2 ** Math.min(failures - 1, 4)));
        }
      }
    });
    watchLoop.current = task.catch(() => {});
    return () => { stopped = true; controller.abort(); if (timer) clearTimeout(timer); finishDelay?.(); };
  }, [applySnapshot, hydrated, loading, project?.id, refreshProjects, visible]);

  return { project, projects, ref, loading, hydrated, paneSelection, bindSelection, saving, error, setError, load, refreshProjects, setSnapshot, captureNavigation, commit, restoreVersion, boardNavigation };
}
