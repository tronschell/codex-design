import type { DesignProject } from './types';

type Page = DesignProject['pages'][number];
/** A saved project relative to an older revision the receiver already holds: unchanged pages are id references, unchanged threads and design system are omitted. */
export interface ProjectDelta {
  baseRevision: number;
  project: Omit<DesignProject, 'pages' | 'threads' | 'designSystem'> & { pages: (Page | { id: string; unchanged: true })[]; threads?: DesignProject['threads']; designSystem?: DesignProject['designSystem'] };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rebuilds the full (still unvalidated) document from the receiver's copy at baseRevision; undefined means read the whole project instead. */
export function applyProjectDelta(base: DesignProject, delta: unknown): unknown {
  if (!isRecord(delta) || delta.baseRevision !== base.revision || !isRecord(delta.project) || delta.project.id !== base.id || !Array.isArray(delta.project.pages)) return undefined;
  const pages = new Map(base.pages.map(page => [page.id, page])), merged: unknown[] = [];
  for (const page of delta.project.pages) {
    if (!isRecord(page) || page.unchanged !== true) { merged.push(page); continue; }
    const prior = typeof page.id === 'string' ? pages.get(page.id) : undefined;
    if (!prior) return undefined;
    merged.push(prior);
  }
  return { ...delta.project, pages: merged, threads: delta.project.threads ?? base.threads, designSystem: delta.project.designSystem ?? base.designSystem };
}
