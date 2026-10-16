import { randomUUID } from 'node:crypto';
import type { CanvasSelection } from '../shared/types.ts';
import type { ProjectStore } from './store.ts';

type Navigation = { id: string; selection: CanvasSelection };
type Pane = {
  id: string;
  conversationKey?: string;
  scope: 'thread' | 'library';
  selection: CanvasSelection | null;
  seenAt: number;
  activeAt: number;
  sequence: number;
  closed: boolean;
  navigation?: Navigation;
  waiters: Set<() => void>;
};

const FRESH_FOR_MS = 120_000;
const sameSelection = (a: CanvasSelection | null, b: CanvasSelection) => a?.projectId === b.projectId && a.boardId === b.boardId && a.pageId === b.pageId;

// Presence is transient and belongs to this runtime, never to design documents or saved history.
// Share it across HTTP MCP instances that use the same store, without sharing it across stores.
const registries = new WeakMap<ProjectStore, CanvasPanes>();
export function canvasPanes(store: ProjectStore) {
  let panes = registries.get(store);
  if (!panes) { panes = new CanvasPanes(); registries.set(store, panes); }
  return panes;
}

class CanvasPanes {
  private panes = new Map<string, Pane>();
  private launches = new Set<string>();

  opening(conversationKey?: string) { return !!conversationKey && this.launches.has(conversationKey); }
  reserveLaunch(conversationKey?: string) { if (conversationKey) this.launches.add(conversationKey); }

  find(conversationKey?: string, instanceId?: string): Pane | undefined {
    const explicit = instanceId ? this.panes.get(instanceId) : undefined;
    const allowed = (pane: Pane) => pane.scope === 'thread' && (!conversationKey || !pane.conversationKey || pane.conversationKey === conversationKey);
    const scoped = conversationKey ? [...this.panes.values()].filter(pane => pane.scope === 'thread' && pane.conversationKey === conversationKey) : [];
    if (explicit && allowed(explicit) && this.status(explicit) === 'open') return explicit;
    const open = scoped.filter(pane => this.status(pane) === 'open').sort((a, b) => b.activeAt - a.activeAt || b.seenAt - a.seenAt)[0];
    return open ?? (explicit && allowed(explicit) && !explicit.closed ? explicit : undefined)
      ?? scoped.filter(pane => !pane.closed).sort((a, b) => b.seenAt - a.seenAt)[0]
      ?? (explicit && allowed(explicit) ? explicit : scoped.sort((a, b) => b.seenAt - a.seenAt)[0]);
  }

  status(pane: Pane): 'open' | 'closed' | 'unknown' {
    if (pane.closed) return 'closed';
    // A background/suspended tab can stop responding. Silence must not authorize a duplicate tab.
    return Date.now() - pane.seenAt <= FRESH_FOR_MS ? 'open' : 'unknown';
  }

  navigate(pane: Pane, selection: CanvasSelection): 'unchanged' | 'queued' {
    if (sameSelection(pane.selection, selection)) { pane.navigation = undefined; return 'unchanged'; }
    if (!pane.navigation || !sameSelection(pane.navigation.selection, selection)) pane.navigation = { id: randomUUID(), selection };
    for (const wake of pane.waiters) wake();
    return 'queued';
  }

  async sync(input: {
    instanceId: string; scope: 'thread' | 'library'; selection: CanvasSelection | null;
    active: boolean; closed: boolean; sequence: number; acknowledgedNavigationId?: string; waitMs: number;
  }, conversationKey: string | undefined, signal: AbortSignal) {
    const now = Date.now();
    let pane = this.panes.get(input.instanceId);
    if (pane && pane.conversationKey && conversationKey && pane.conversationKey !== conversationKey) throw new Error('This canvas instance belongs to another conversation.');
    if (!pane) {
      for (const [id, old] of this.panes) if (old.closed && now - old.seenAt > 86_400_000) this.panes.delete(id);
      if (this.panes.size >= 512) throw new Error('Too many canvas sessions. Close unused canvases before opening another.');
      pane = { id: input.instanceId, conversationKey, scope: input.scope, selection: input.selection, seenAt: now, activeAt: now, sequence: -1, closed: false, waiters: new Set() };
      this.panes.set(pane.id, pane);
    }
    if (pane.scope !== input.scope) throw new Error('A canvas instance cannot change its scope.');
    if (input.sequence <= pane.sequence) return { tracked: true };
    pane.sequence = input.sequence;
    pane.conversationKey ??= conversationKey;
    pane.selection = input.selection;
    pane.seenAt = now;
    if (input.active) pane.activeAt = now;
    pane.closed = input.closed;
    if (!input.closed && conversationKey) this.launches.delete(conversationKey);
    if (input.closed || pane.navigation?.id === input.acknowledgedNavigationId) pane.navigation = undefined;
    if (input.closed) for (const wake of pane.waiters) wake();
    if (!input.closed && !pane.navigation && input.waitMs > 0) await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); pane!.waiters.delete(finish); signal.removeEventListener('abort', abort); };
      const finish = () => { cleanup(); resolve(); };
      const abort = () => { cleanup(); reject(signal.reason ?? new Error('Canvas presence request cancelled.')); };
      const timer = setTimeout(finish, input.waitMs);
      pane!.waiters.add(finish);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
    return { tracked: true, ...(pane.navigation && !pane.closed ? { navigation: pane.navigation } : {}) };
  }
}
