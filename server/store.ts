import { randomUUID } from 'node:crypto';
import { watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { createDemoProject } from '../shared/seed.ts';
import { defaultTokens, type BindableStyleProperty, type CanvasSelection, type DesignProject, type Operation, type ProjectSummary, type ProjectVersion, type ProjectVersionSummary } from '../shared/types.ts';
import { canvasSelectionSchema, createProjectSchema, idSchema, MAX_INPUT_BYTES, operationsSchema, projectSchema, revisionSchema } from '../shared/validation.ts';
import { ProjectHistory, StoreError } from './history.ts';
import { AssetStore } from './assets.ts';
import { resolvedNodes } from '../shared/export.ts';
import { parentLocalDelta, visualBounds } from '../shared/effects.ts';
import { createSnapScene, snapBox } from '../shared/snapping.ts';
import type { AssetChunk, AssetMetadata, AssetUpload, AssetUploadCancellation } from '../shared/media.ts';
import { LEGACY_TOKEN_IDS, compatibleTokenKinds, defaultDesignSystem, resolveNodeTokens } from '../shared/design-system.ts';
export { StoreError } from './history.ts';

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, input: unknown, code = 'invalid_input'): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new StoreError(400, code, result.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; '), result.error.issues);
  return result.data;
}

function serialize(input: unknown): string {
  let json: string | undefined;
  try { json = JSON.stringify(input); } catch { throw new StoreError(400, 'invalid_input', 'Input must be JSON serializable'); }
  if (json === undefined) throw new StoreError(400, 'invalid_input', 'Input must be JSON serializable');
  if (Buffer.byteLength(json) > MAX_INPUT_BYTES) throw new StoreError(413, 'input_too_large', 'Project or transaction exceeds the 2 MiB limit');
  return json;
}

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

function touchGeneration(project: DesignProject, operation: Operation, now: string) {
  if (operation.type !== 'create_node' && operation.type !== 'update_node' && operation.type !== 'delete_node' && operation.type !== 'snap_node' && operation.type !== 'replace_page') return;
  const page = project.pages.find(item => item.id === operation.pageId);
  if (!page?.nodes.some(node => node.type === 'frame' && node.generation?.status === 'building')) return;
  const byId = new Map(page.nodes.map(node => [node.id, node]));
  const ids = operation.type === 'create_node' ? [operation.node.id] : operation.type === 'replace_page' ? page.nodes.filter(node => node.type === 'frame').map(node => node.id) : [operation.nodeId];
  for (const id of ids) {
    let node = byId.get(id);
    const seen = new Set<string>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      if (node.type === 'frame' && node.generation?.status === 'building') node.generation.updatedAt = now;
      node = node.parentId ? byId.get(node.parentId) : undefined;
    }
  }
}
const canvasSelectionKeySchema = z.string().regex(/^[a-f0-9]{64}$/i, 'Canvas selection keys must be a SHA-256 hex digest').transform((key) => key.toLowerCase());

function changeLabel(project: DesignProject, operation: Operation): string {
  const page = 'pageId' in operation ? project.pages.find((item) => item.id === operation.pageId) : undefined;
  const node = 'nodeId' in operation ? page?.nodes.find((item) => item.id === operation.nodeId) : undefined;
  const board = 'boardId' in operation ? project.boards.find((item) => item.id === operation.boardId) : undefined;
  const thread = 'threadId' in operation ? project.threads.find((item) => item.id === operation.threadId) : operation.type === 'create_thread' ? operation.thread : undefined;
  const threadPage = thread ? project.pages.find((item) => item.id === thread.pageId) : undefined;
  const anchor = threadPage?.nodes.find((item) => item.id === thread?.nodeId)?.name ?? threadPage?.name ?? 'canvas';
  switch (operation.type) {
    case 'rename_project': return `Updated project “${operation.name}”`;
    case 'create_board': return `Created board “${operation.board.name}”`;
    case 'update_board': return `Renamed board “${board?.name ?? operation.boardId}” to “${operation.patch.name}”`;
    case 'delete_board': return `Deleted board “${board?.name ?? operation.boardId}”`;
    case 'create_page': return `Created page “${operation.page.name}”`;
    case 'update_page': return operation.patch.name !== undefined ? `Renamed page “${page?.name ?? operation.pageId}” to “${operation.patch.name}”` : operation.patch.boardId !== undefined ? `Moved page “${page?.name ?? operation.pageId}”` : `Adjusted view on “${page?.name ?? operation.pageId}”`;
    case 'replace_page': return `Updated page “${operation.page.name}”`;
    case 'delete_page': return `Deleted page “${page?.name ?? operation.pageId}”`;
    case 'create_node': return `Added “${operation.node.name}”`;
    case 'update_node': return `Updated “${operation.patch.name ?? node?.name ?? operation.nodeId}”`;
    case 'delete_node': return `Deleted “${node?.name ?? operation.nodeId}”`;
    case 'snap_node': return `Snapped “${node?.name ?? operation.nodeId}”`;
    case 'create_thread': return `Commented on “${anchor}”`;
    case 'add_message': return `Replied on “${anchor}”`;
    case 'update_thread': return `${operation.patch.status === 'resolved' ? 'Resolved conversation' : operation.patch.queued ? 'Queued conversation' : 'Updated conversation'} on “${anchor}”`;
    case 'set_tokens': return 'Updated project styles';
    case 'update_design_system': return 'Updated project design system';
    case 'upsert_design_token': return `Updated design token “${operation.token.name}”`;
    case 'delete_design_token': return `Deleted design token “${project.designSystem.tokens.find(token => token.id === operation.tokenId)?.name ?? operation.tokenId}”`;
    case 'set_design_system_request': return operation.request ? `Requested design system ${operation.request.mode === 'find' ? 'discovery' : 'generation'}` : 'Cleared design system request';
    case 'upsert_inspiration': return `Updated inspiration “${operation.item.name}” on “${board?.name ?? operation.boardId}”`;
    case 'delete_inspiration': return `Removed inspiration from “${board?.name ?? operation.boardId}”`;
  }
}

function boardContents(project: DesignProject, boardId: string): string {
  const board = project.boards.find((item) => item.id === boardId);
  const pages = project.pages.filter((page) => page.boardId === boardId);
  const pageIds = new Set(pages.map((page) => page.id));
  return JSON.stringify({ name: board?.name, createdAt: board?.createdAt, inspiration: board?.inspiration, pages, threads: project.threads.filter((thread) => pageIds.has(thread.pageId)) });
}

export class ProjectStore {
  private initializing?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(projectId: string) => void>();
  private readonly history: ProjectHistory;
  private readonly assets: AssetStore;

  constructor(private readonly dataDir: string) { this.history = new ProjectHistory(dataDir); this.assets = new AssetStore(dataDir); }

  async init(): Promise<void> {
    this.initializing ??= (async () => {
      await mkdir(this.dataDir, { recursive: true });
      await this.withWriteLock(async () => {
        const marker = path.join(this.dataDir, '.initialized');
        try { await stat(marker); return; } catch (error) { if (!isMissing(error)) throw error; }
        if ((await this.projectIds()).length === 0) {
          const project = parse(projectSchema, createDemoProject(randomUUID()), 'invalid_project');
          await this.history.save(project, `Created “${project.name}”`);
        }
        await writeFile(marker, '1\n', { flag: 'wx', mode: 0o600 });
      });
    })();
    return this.initializing;
  }

  async list(): Promise<ProjectSummary[]> {
    await this.init();
    const projects = await Promise.all((await this.projectIds()).map((id) => this.read(id)));
    return projects.map(({ id, name, description, revision, createdAt, updatedAt, boards, pages }) => ({
      id, name, description, revision, createdAt, updatedAt,
      boardCount: boards.length,
      pageCount: pages.length,
      screenCount: pages.reduce((count, page) => count + page.nodes.filter((node) => node.type === 'frame' && node.parentId === null).length, 0),
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<DesignProject> {
    parse(idSchema, id);
    await this.init();
    return this.read(id);
  }

  async beginAssetUpload(input: unknown): Promise<AssetUpload> {
    await this.init();
    return this.withWriteLock(() => this.assets.begin(input));
  }

  async uploadAssetChunk(input: unknown): Promise<AssetUpload> {
    await this.init();
    return this.withWriteLock(() => this.assets.append(input));
  }

  async cancelAssetUpload(uploadId: string): Promise<AssetUploadCancellation> {
    await this.init();
    return this.withWriteLock(() => this.assets.cancel(uploadId));
  }

  async getAsset(ref: string): Promise<AssetMetadata> {
    await this.init();
    return this.assets.get(ref);
  }

  async readAssetChunk(input: unknown): Promise<AssetChunk> {
    await this.init();
    return this.assets.readChunk(input);
  }

  async waitForChange(projectId: string, afterRevision: number, signal?: AbortSignal): Promise<DesignProject | null> {
    parse(idSchema, projectId); parse(revisionSchema, afterRevision);
    if (signal?.aborted) throw signal.reason ?? new DOMException('The canvas watch was aborted.', 'AbortError');
    return new Promise((resolve, reject) => {
      let settled = false, reading = false, dirty = false;
      let watcher: FSWatcher | undefined;
      let fallback: ReturnType<typeof setInterval> | undefined;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let unsubscribe: (() => void) | undefined;
      const finish = (project: DesignProject | null, error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout); clearInterval(fallback);
        unsubscribe?.(); watcher?.close(); watcher = undefined;
        signal?.removeEventListener('abort', onAbort);
        if (error !== undefined) reject(error); else resolve(project);
      };
      const onAbort = () => finish(null, signal?.reason ?? new DOMException('The canvas watch was aborted.', 'AbortError'));
      const check = async () => {
        if (settled) return;
        if (reading) { dirty = true; return; }
        reading = true;
        try {
          do {
            dirty = false;
            const project = await this.read(projectId);
            if (settled) return;
            if (project.revision > afterRevision) { finish(project); return; }
          } while (dirty && !settled);
        } catch (error) { finish(null, error); }
        finally { reading = false; }
      };
      const startFallback = () => {
        if (settled || fallback) return;
        fallback = setInterval(() => { void check(); }, 500);
        fallback.unref();
      };
      unsubscribe = this.subscribe((id) => { if (id === projectId) void check(); });
      signal?.addEventListener('abort', onAbort, { once: true });
      timeout = setTimeout(() => finish(null), 10_000);
      timeout.unref();
      try {
        const filename = `${projectId}.json`;
        watcher = watch(this.dataDir, { persistent: false }, (_event, changedFile) => {
          if (changedFile?.toString() === filename) void check();
          else if (changedFile === null) { startFallback(); void check(); }
        });
        watcher.on('error', () => {
          watcher?.close(); watcher = undefined;
          startFallback(); void check();
        });
      } catch { startFallback(); }
      if (signal?.aborted) onAbort(); else void check();
    });
  }

  async getCanvasSelection(key: string): Promise<CanvasSelection | null> {
    const digest = parse(canvasSelectionKeySchema, key);
    await this.init();
    return this.withWriteLock(async () => {
      const directory = path.join(this.dataDir, '.canvas-selections');
      let selection: CanvasSelection;
      try {
        if (!(await lstat(directory)).isDirectory()) return null;
        const filename = path.join(directory, `${digest}.json`);
        const info = await lstat(filename);
        if (!info.isFile() || info.size < 1 || info.size > 4096) return null;
        const parsed = canvasSelectionSchema.safeParse(JSON.parse(await readFile(filename, 'utf8')));
        if (!parsed.success) return null;
        selection = parsed.data;
      } catch { return null; }
      let project: DesignProject;
      try { project = await this.read(selection.projectId); }
      catch (error) { if (error instanceof StoreError && error.status === 404) return null; throw error; }
      if (!project.boards.some((board) => board.id === selection.boardId)) return null;
      if (selection.pageId !== undefined && !project.pages.some((page) => page.id === selection.pageId && page.boardId === selection.boardId)) return { projectId: selection.projectId, boardId: selection.boardId };
      return selection;
    });
  }

  async setCanvasSelection(key: string, selection: CanvasSelection): Promise<void> {
    const digest = parse(canvasSelectionKeySchema, key);
    const selected = parse(canvasSelectionSchema, selection);
    await this.init();
    await this.withWriteLock(async () => {
      const project = await this.read(selected.projectId);
      if (!project.boards.some((board) => board.id === selected.boardId)) throw new StoreError(404, 'board_not_found', `Board ${selected.boardId} does not exist in this project`);
      if (selected.pageId !== undefined && !project.pages.some((page) => page.id === selected.pageId && page.boardId === selected.boardId)) throw new StoreError(404, 'page_not_found', `Page ${selected.pageId} does not exist on this board`);
      const directory = path.join(this.dataDir, '.canvas-selections');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if (!(await lstat(directory)).isDirectory()) throw new StoreError(500, 'invalid_selection_store', 'Canvas preferences must be stored in a regular directory');
      const filename = path.join(directory, `${digest}.json`);
      const temporary = `${filename}.${randomUUID()}.tmp`;
      try {
        const handle = await open(temporary, 'wx', 0o600);
        try { await handle.writeFile(JSON.stringify(selected)); await handle.sync(); } finally { await handle.close(); }
        await rename(temporary, filename);
        for (const parent of [directory, this.dataDir]) {
          const handle = await open(parent, 'r');
          try { await handle.sync(); } finally { await handle.close(); }
        }
      } finally { await rm(temporary, { force: true }); }
    });
  }

  async create(name: string, template: 'blank' | 'demo' = 'blank'): Promise<DesignProject> {
    const input = parse(createProjectSchema, { name, template });
    await this.init();
    return this.withWriteLock(async () => {
      const id = randomUUID();
      const boardId = `board_${randomUUID()}`;
      const now = new Date().toISOString();
      const project = parse(projectSchema, input.template === 'demo' ? createDemoProject(id, input.name) : {
        id, name: input.name, description: '', revision: 0,
        boards: [{ id: boardId, name: 'Main board', createdAt: now, updatedAt: now }],
        pages: [{ id: `page_${randomUUID()}`, boardId, name: 'Page 1', nodes: [], viewport: { x: 0, y: 0, zoom: 1 } }],
        threads: [], tokens: { ...defaultTokens }, designSystem: defaultDesignSystem(), createdAt: now, updatedAt: now,
      }, 'invalid_project');
      await this.history.save(project, `Created “${project.name}”`);
      this.emit(project.id);
      return project;
    });
  }

  async mutate(projectId: string, expectedRevision: number, operations: Operation[]): Promise<DesignProject> {
    parse(idSchema, projectId);
    parse(revisionSchema, expectedRevision);
    serialize(operations);
    const changes = parse(operationsSchema, operations);
    await this.init();
    return this.withWriteLock(async () => {
      const previous = await this.read(projectId);
      this.checkRevision(previous, expectedRevision);
      const project = structuredClone(previous);
      const now = new Date().toISOString();
      const touchedBoards = new Set<string>();
      const labels: string[] = [];
      for (const operation of changes) {
        labels.push(changeLabel(project, operation));
        touchGeneration(project, operation, now);
        this.apply(project, operation, now, touchedBoards);
        touchGeneration(project, operation, now);
      }
      for (const board of project.boards) if (touchedBoards.has(board.id)) board.updatedAt = now;
      project.revision += 1;
      project.updatedAt = now;
      const validated = parse(projectSchema, project, 'invalid_project');
      await this.assets.validateProject(validated);
      const label = labels.length === 1 ? labels[0] : `${labels[0]} · ${labels.length - 1} more ${labels.length === 2 ? 'change' : 'changes'}`;
      await this.history.save(validated, label, previous);
      this.emit(projectId);
      return validated;
    });
  }

  async importProject(input: unknown): Promise<DesignProject> {
    serialize(input);
    const imported = parse(projectSchema, input, 'invalid_project');
    await this.init();
    return this.withWriteLock(async () => {
      const now = new Date().toISOString();
      const project = { ...imported, id: randomUUID(), revision: 0, createdAt: now, updatedAt: now };
      await this.assets.validateProject(project);
      await this.history.save(project, `Imported “${project.name}”`);
      this.emit(project.id);
      return project;
    });
  }

  async listVersions(projectId: string): Promise<ProjectVersionSummary[]> {
    parse(idSchema, projectId);
    await this.init();
    return this.withWriteLock(async () => this.history.list(await this.read(projectId)));
  }

  async getVersion(projectId: string, revision: number): Promise<ProjectVersion> {
    parse(idSchema, projectId); parse(revisionSchema, revision);
    await this.init();
    return this.withWriteLock(async () => this.history.get(await this.read(projectId), revision));
  }

  async restoreVersion(projectId: string, expectedRevision: number, revision: number): Promise<DesignProject> {
    parse(idSchema, projectId); parse(revisionSchema, expectedRevision); parse(revisionSchema, revision);
    await this.init();
    return this.withWriteLock(async () => {
      const current = await this.read(projectId);
      this.checkRevision(current, expectedRevision);
      const historical = await this.history.get(current, revision);
      const now = new Date().toISOString();
      const restored = parse(projectSchema, {
        ...historical.project, id: current.id, revision: current.revision + 1, createdAt: current.createdAt, updatedAt: now,
        boards: historical.project.boards.map((board) => {
          const existing = current.boards.find((item) => item.id === board.id);
          const changed = !existing || boardContents(current, board.id) !== boardContents(historical.project, board.id);
          return { ...board, updatedAt: changed ? now : existing.updatedAt };
        }),
      }, 'invalid_project');
      await this.assets.validateProject(restored);
      await this.history.save(restored, `Restored version ${revision}`, current, revision);
      this.emit(projectId);
      return restored;
    });
  }

  private checkRevision(project: DesignProject, expectedRevision: number) {
    if (project.revision !== expectedRevision) throw new StoreError(409, 'revision_conflict', `Project changed: expected revision ${expectedRevision}, current revision is ${project.revision}. Fetch the project and retry.`, { expectedRevision, currentRevision: project.revision });
  }

  subscribe(listener: (projectId: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(projectId: string) {
    for (const listener of this.listeners) {
      try { listener(projectId); } catch { /* A disconnected observer must not roll back a saved edit. */ }
    }
  }

  private async projectIds(): Promise<string[]> {
    return (await readdir(this.dataDir)).filter((file) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}\.json$/.test(file)).map((file) => file.slice(0, -5));
  }

  private async read(id: string): Promise<DesignProject> {
    const filename = path.join(this.dataDir, `${id}.json`);
    try {
      if ((await stat(filename)).size > MAX_INPUT_BYTES) throw new StoreError(500, 'corrupt_project', `Saved project ${id} exceeds the size limit`);
      let input: unknown;
      try { input = JSON.parse(await readFile(filename, 'utf8')); }
      catch (error) { if (error instanceof SyntaxError) throw new StoreError(500, 'corrupt_project', `Saved project ${id} is not valid JSON`); throw error; }
      const parsed = projectSchema.safeParse(input);
      if (!parsed.success || parsed.data.id !== id) throw new StoreError(500, 'corrupt_project', `Saved project ${id} has an invalid structure`);
      return parsed.data;
    } catch (error) {
      if (isMissing(error)) throw new StoreError(404, 'project_not_found', `Project ${id} does not exist`);
      throw error;
    }
  }

  private withWriteLock<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const release = await this.acquireLock();
      try { return await work(); } finally { await release(); }
    });
    this.queue = result.catch(() => {});
    return result;
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    const directory = path.join(this.dataDir, '.write-lock');
    const token = randomUUID();
    const claim = path.join(this.dataDir, `.claim-${token}`);
    const deadline = Date.now() + 10_000;
    await mkdir(claim);
    try {
      await writeFile(path.join(claim, 'owner.json'), JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
      while (true) {
        try {
          // Publishing a nonempty directory makes the lock and owner atomic.
          await rename(claim, directory);
          return async () => {
            try {
              const owner = JSON.parse(await readFile(path.join(directory, 'owner.json'), 'utf8'));
              if (owner.token === token) {
                const released = path.join(this.dataDir, `.released-${token}`);
                await rename(directory, released);
                await rm(released, { recursive: true, force: true });
              }
            } catch (error) { if (!isMissing(error)) throw error; }
          };
        } catch (error) {
          if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
          await this.recoverAbandonedLock(directory);
          if (Date.now() >= deadline) throw new StoreError(503, 'store_busy', 'Another process is saving this workspace. Retry shortly.');
          await delay(25 + Math.random() * 50);
        }
      }
    } finally {
      await rm(claim, { recursive: true, force: true });
    }
  }

  private async recoverAbandonedLock(directory: string) {
    try {
      const owner = JSON.parse(await readFile(path.join(directory, 'owner.json'), 'utf8')) as { pid: number; token: string };
      if (!Number.isInteger(owner.pid) || owner.pid < 1 || !idSchema.safeParse(owner.token).success) return;
      try { process.kill(owner.pid, 0); return; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return; }
      // Only a dead process's lock can be reclaimed; active saves have no timeout.
      const current = JSON.parse(await readFile(path.join(directory, 'owner.json'), 'utf8')) as { token: string };
      if (current.token !== owner.token) return;
      // Keep this tombstone so two reclaimers cannot rename a newer live lock.
      const abandoned = path.join(this.dataDir, `.abandoned-${owner.token}`);
      await rename(directory, abandoned);
    } catch (error) {
      if (!isMissing(error)) {
        if (error instanceof SyntaxError || ['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
        throw error;
      }
    }
  }

  private apply(project: DesignProject, operation: Operation, now: string, touchedBoards: Set<string>) {
    const board = (id: string) => {
      const value = project.boards.find((item) => item.id === id);
      if (!value) throw new StoreError(404, 'board_not_found', `Board ${id} does not exist`);
      touchedBoards.add(id);
      return value;
    };
    const page = (id: string) => {
      const value = project.pages.find((item) => item.id === id);
      if (!value) throw new StoreError(404, 'page_not_found', `Page ${id} does not exist`);
      if (value.boardId) touchedBoards.add(value.boardId);
      return value;
    };
    const thread = (id: string) => {
      const value = project.threads.find((item) => item.id === id);
      if (!value) throw new StoreError(404, 'thread_not_found', `Thread ${id} does not exist`);
      page(value.pageId);
      return value;
    };
    switch (operation.type) {
      case 'rename_project': project.name = operation.name; if (operation.description !== undefined) project.description = operation.description; break;
      case 'create_board':
        project.boards.push({ ...operation.board, createdAt: now, updatedAt: now });
        touchedBoards.add(operation.board.id);
        project.pages.push({ id: `page_${randomUUID()}`, boardId: operation.board.id, name: 'Page 1', nodes: [], viewport: { x: 120, y: 100, zoom: 0.65 } });
        break;
      case 'update_board': Object.assign(board(operation.boardId), operation.patch); break;
      case 'delete_board': {
        board(operation.boardId);
        if (project.boards.length === 1) throw new StoreError(400, 'last_board', 'A project must keep at least one board');
        const deletedPages = new Set(project.pages.filter((item) => item.boardId === operation.boardId).map((item) => item.id));
        project.boards = project.boards.filter((item) => item.id !== operation.boardId);
        project.pages = project.pages.filter((item) => !deletedPages.has(item.id));
        project.threads = project.threads.filter((item) => !deletedPages.has(item.pageId));
        break;
      }
      case 'create_page': {
        const targetBoard = board(operation.page.boardId ?? project.boards[0].id);
        project.pages.push({ ...operation.page, boardId: targetBoard.id });
        break;
      }
      case 'update_page': {
        const target = page(operation.pageId);
        if (operation.patch.boardId !== undefined) target.boardId = board(operation.patch.boardId).id;
        if (operation.patch.name !== undefined) target.name = operation.patch.name;
        if (operation.patch.viewport !== undefined) target.viewport = operation.patch.viewport;
        break;
      }
      case 'replace_page': {
        const target = page(operation.pageId);
        if (operation.page.id !== operation.pageId) throw new StoreError(400, 'invalid_operation', 'A replacement page must keep its page ID');
        const targetBoard = board(operation.page.boardId ?? target.boardId ?? project.boards[0].id);
        project.pages[project.pages.findIndex((item) => item.id === operation.pageId)] = { ...operation.page, boardId: targetBoard.id };
        const retained = new Set(operation.page.nodes.map((node) => node.id));
        project.threads = project.threads.filter((item) => item.pageId !== operation.pageId || item.nodeId === null || retained.has(item.nodeId));
        break;
      }
      case 'delete_page': {
        const target = page(operation.pageId);
        if (project.pages.filter((item) => item.boardId === target.boardId).length === 1) throw new StoreError(400, 'last_board_page', 'A board must keep at least one page');
        project.pages = project.pages.filter((item) => item.id !== operation.pageId);
        project.threads = project.threads.filter((item) => item.pageId !== operation.pageId);
        break;
      }
      case 'create_node': page(operation.pageId).nodes.push(operation.node); break;
      case 'update_node': {
        const target = page(operation.pageId);
        const node = target.nodes.find((item) => item.id === operation.nodeId);
        if (!node) throw new StoreError(404, 'node_not_found', `Node ${operation.nodeId} does not exist`);
        if ((node.styles.layout === 'vertical' || node.styles.layout === 'horizontal') && operation.patch.styles?.layout === 'free') {
          const positions = new Map(resolvedNodes(target.nodes, project.designSystem).map((item) => [item.id, { x: item.x, y: item.y }]));
          // Freeze only this stack's participating children before removing its layout.
          for (const child of target.nodes) if (child.parentId === node.id && !child.hidden) Object.assign(child, positions.get(child.id));
        }
        const styles = { ...node.styles, ...operation.patch.styles };
        if ((operation.patch.source !== undefined && operation.patch.jsx === undefined) || (operation.patch.type !== undefined && operation.patch.type !== 'code')) delete node.jsx;
        Object.assign(node, operation.patch, { styles });
        break;
      }
      case 'snap_node': {
        const target = page(operation.pageId), node = target.nodes.find(item => item.id === operation.nodeId);
        if (!node) throw new StoreError(404, 'node_not_found', `Node ${operation.nodeId} does not exist`);
        const nodes = resolvedNodes(target.nodes, project.designSystem), byId = new Map(nodes.map(item => [item.id, item])), positioned = byId.get(node.id)!;
        const seen = new Set<string>();
        let current: typeof positioned | undefined = positioned;
        while (current && !seen.has(current.id)) {
          if (current.hidden || current.locked) throw new StoreError(400, 'node_not_editable', 'Unlock and show the node and its ancestors before snapping.');
          seen.add(current.id); current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        const parent = node.parentId ? byId.get(node.parentId) : undefined;
        if (parent?.styles.layout === 'vertical' || parent?.styles.layout === 'horizontal') throw new StoreError(400, 'stack_positioned_node', 'The parent stack controls this node’s position. Use free positioning before snapping.');
        const bounds = visualBounds(positioned, nodes), snapped = snapBox(createSnapScene(nodes, positioned), bounds, operation.distance ?? 8);
        const delta = parentLocalDelta(positioned, nodes, { x: snapped.box.x - bounds.x, y: snapped.box.y - bounds.y });
        if (!delta) throw new StoreError(400, 'singular_parent_transform', 'This parent transform is collapsed or too extreme to map snapping safely.');
        node.x += delta.x; node.y += delta.y;
        break;
      }
      case 'delete_node': {
        const target = page(operation.pageId);
        if (!target.nodes.some((item) => item.id === operation.nodeId)) throw new StoreError(404, 'node_not_found', `Node ${operation.nodeId} does not exist`);
        const children = new Map<string, string[]>();
        for (const node of target.nodes) if (node.parentId !== null) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
        const deleted = new Set<string>();
        const pending = [operation.nodeId];
        while (pending.length) {
          const id = pending.pop()!;
          if (deleted.has(id)) continue;
          deleted.add(id);
          pending.push(...(children.get(id) ?? []));
        }
        target.nodes = target.nodes.filter((item) => !deleted.has(item.id));
        project.threads = project.threads.filter((item) => item.pageId !== operation.pageId || item.nodeId === null || !deleted.has(item.nodeId));
        break;
      }
      case 'create_thread': page(operation.thread.pageId); project.threads.push(operation.thread); break;
      case 'add_message': {
        const target = thread(operation.threadId);
        target.messages.push(operation.message);
        if (operation.queued !== undefined) target.queued = operation.queued;
        break;
      }
      case 'update_thread': Object.assign(thread(operation.threadId), operation.patch); break;
      case 'set_tokens': {
        Object.assign(project.tokens, operation.tokens);
        const defaults = defaultDesignSystem(project.tokens).tokens;
        for (const key of Object.keys(operation.tokens) as (keyof typeof LEGACY_TOKEN_IDS)[]) {
          const token = project.designSystem.tokens.find(item => item.id === LEGACY_TOKEN_IDS[key]);
          if (token) token.value = project.tokens[key];
          else {
            const replacement = defaults.find(item => item.id === LEGACY_TOKEN_IDS[key])!;
            const names = new Set(project.designSystem.tokens.map(item => item.name.toLowerCase()));
            const base = replacement.name;
            for (let suffix = 2; names.has(replacement.name.toLowerCase()); suffix++) replacement.name = `${base} ${suffix}`;
            project.designSystem.tokens.push(replacement);
          }
        }
        break;
      }
      case 'update_design_system': Object.assign(project.designSystem, operation.patch); break;
      case 'upsert_design_token': {
        for (const target of project.pages) for (const node of target.nodes) for (const [property, tokenId] of Object.entries(node.tokenBindings ?? {})) if (tokenId === operation.token.id && !compatibleTokenKinds(property as BindableStyleProperty).includes(operation.token.kind)) throw new StoreError(400, 'incompatible_token_kind', `Design token ${operation.token.id} is bound to ${property}. Detach its bindings before changing its kind.`);
        const index = project.designSystem.tokens.findIndex(token => token.id === operation.token.id);
        if (index < 0) project.designSystem.tokens.push(operation.token);
        else project.designSystem.tokens[index] = operation.token;
        for (const key of Object.keys(LEGACY_TOKEN_IDS) as (keyof typeof LEGACY_TOKEN_IDS)[]) if (LEGACY_TOKEN_IDS[key] === operation.token.id) Object.assign(project.tokens, { [key]: operation.token.value });
        break;
      }
      case 'delete_design_token': {
        if (!project.designSystem.tokens.some(token => token.id === operation.tokenId)) throw new StoreError(404, 'token_not_found', `Design token ${operation.tokenId} does not exist`);
        for (const target of project.pages) for (const node of target.nodes) {
          const bindings = node.tokenBindings;
          if (!bindings || !Object.values(bindings).includes(operation.tokenId)) continue;
          const resolved = resolveNodeTokens(node, project.designSystem);
          const remaining = { ...bindings }, styles = { ...node.styles };
          for (const property of Object.keys(bindings) as (keyof typeof bindings)[]) if (bindings[property] === operation.tokenId) {
            Object.assign(styles, { [property]: resolved.styles[property] });
            delete remaining[property];
          }
          node.styles = styles;
          if (Object.keys(remaining).length) node.tokenBindings = remaining;
          else delete node.tokenBindings;
          if (target.boardId) touchedBoards.add(target.boardId);
        }
        project.designSystem.tokens = project.designSystem.tokens.filter(token => token.id !== operation.tokenId);
        break;
      }
      case 'set_design_system_request':
        if (operation.request === null) delete project.designSystem.request;
        else project.designSystem.request = operation.request;
        break;
      case 'upsert_inspiration': {
        const target = board(operation.boardId);
        const items = target.inspiration ??= [];
        const index = items.findIndex(item => item.id === operation.item.id);
        if (index < 0) items.push(operation.item);
        else items[index] = operation.item;
        break;
      }
      case 'delete_inspiration': {
        const target = board(operation.boardId);
        if (!target.inspiration?.some(item => item.id === operation.itemId)) throw new StoreError(404, 'inspiration_not_found', `Inspiration ${operation.itemId} does not exist on board ${operation.boardId}`);
        target.inspiration = target.inspiration.filter(item => item.id !== operation.itemId);
        break;
      }
    }
  }
}
