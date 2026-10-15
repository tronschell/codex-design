import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { DesignProject, LibraryScope, ProjectVersion, ProjectVersionSummary } from '../shared/types.ts';
import type { ProjectDelta } from '../shared/project-delta.ts';
import { MAX_DOCUMENT_BYTES, documentLimitLabel, projectSchema, projectVersionSummarySchema, revisionSchema } from '../shared/validation.ts';

export class StoreError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'StoreError';
  }
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const hash = (json: string) => createHash('sha256').update(json).digest('hex');
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({ format: z.union([z.literal(1), z.literal(2)]), firstRevision: revisionSchema }).strict();
// Format 1 records hash a complete project.json; format 2 records hash snapshot.json, whose blobs are named by their own hashes.
// Early format 2 records also hashed the reassembled project; that redundant check still runs when present.
const recordSchema = z.union([
  z.object({ version: projectVersionSummarySchema, hash: hashSchema }).strict(),
  z.object({ format: z.literal(2), version: projectVersionSummarySchema, hash: hashSchema, projectHash: hashSchema.optional() }).strict(),
]);
const snapshotSchema = z.object({ format: z.literal(2), parts: z.array(z.object({ key: z.string().min(1).max(100), value: z.unknown().optional(), blob: hashSchema.optional(), pages: z.array(hashSchema).optional() }).strict()) }).strict();
type Snapshot = z.infer<typeof snapshotSchema>;
const pendingSchema = z.object({ previousRevision: revisionSchema, revision: revisionSchema, hash: hashSchema }).strict().refine((value) => value.revision === value.previousRevision + 1, 'Invalid pending revision');
const corrupt = (message: string) => new StoreError(500, 'corrupt_history', message);
const snapshotLimit = MAX_DOCUMENT_BYTES + 64 * 1024; // Legacy board normalization can enrich an already-full saved document.

async function syncDirectory(directory: string) {
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeFileSynced(filename: string, json: string) {
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(json); await handle.sync(); } finally { await handle.close(); }
}

async function writeAtomic(filename: string, json: string) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await writeFileSynced(temporary, json);
    await rename(temporary, filename);
    await syncDirectory(path.dirname(filename));
  } finally { await rm(temporary, { force: true }); }
}

async function readBounded(filename: string, limit: number): Promise<string> {
  try {
    const info = await lstat(filename);
    if (!info.isFile() || info.size < 1 || info.size > limit) throw corrupt('A saved history file has an invalid size or file type.');
    return await readFile(filename, 'utf8');
  } catch (error) {
    if (missing(error)) throw corrupt('A saved history file is missing. Restore the workspace backup before continuing.');
    throw error;
  }
}

// Pages, the design system and threads are stored once by content hash, so a save writes only the parts it changed.
// The full project JSON is assembled from the same fragments, giving one serialization per saved revision.
const blobKeys = new Set(['designSystem', 'threads']);
// Saved project objects are never mutated (edits apply to a clone and unchanged parts are reused by identity),
// so a page, design system or thread list keeps its serialized form and hash across saves.
const fragmentCache = new WeakMap<object, { json: string; key: string }>();
function fragment(value: object) {
  let cached = fragmentCache.get(value);
  if (!cached) { const json = JSON.stringify(value); cached = { json, key: hash(json) }; fragmentCache.set(value, cached); }
  return cached;
}
interface EncodedProject { json: string; snapshot: string; snapshotHash: string; blobs: Map<string, string> }
function encodeProject(project: DesignProject): EncodedProject {
  const fragments: string[] = [], parts: Snapshot['parts'] = [], blobs = new Map<string, string>();
  const blob = (value: object) => { const { json, key } = fragment(value); blobs.set(key, json); return { json, key }; };
  for (const [key, value] of Object.entries(project)) {
    if (value === undefined) continue;
    if (key === 'pages') {
      const pages = (value as DesignProject['pages']).map(blob);
      fragments.push(`"pages":[${pages.map(page => page.json).join(',')}]`); parts.push({ key, pages: pages.map(page => page.key) });
    } else if (blobKeys.has(key)) {
      const stored = blob(value);
      fragments.push(`${JSON.stringify(key)}:${stored.json}`); parts.push({ key, blob: stored.key });
    } else {
      fragments.push(`${JSON.stringify(key)}:${JSON.stringify(value)}`); parts.push({ key, value });
    }
  }
  const snapshot = JSON.stringify({ format: 2, parts });
  return { json: `{${fragments.join(',')}}`, snapshot, snapshotHash: hash(snapshot), blobs };
}

async function readMetadata<T>(filename: string, schema: z.ZodType<T, z.ZodTypeDef, any>, limit = 8192): Promise<T> {
  let input: unknown;
  try { input = JSON.parse(await readBounded(filename, limit)); }
  catch (error) { if (error instanceof SyntaxError) throw corrupt('Saved history metadata is not valid JSON.'); throw error; }
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw corrupt('Saved history metadata has an invalid structure.');
  return parsed.data;
}

// Every method is called while ProjectStore holds the shared filesystem write lock.
export class ProjectHistory {
  private readonly root: string;
  constructor(private readonly dataDir: string) { this.root = path.join(dataDir, 'history'); }

  // Snapshot hashes of committed project objects; the store passes its cached copy back as the next save's previous project.
  private readonly committed = new WeakMap<DesignProject, string>();

  async save(project: DesignProject, label: string, previous?: DesignProject, restoredFrom?: number, library?: ProjectVersionSummary['library']): Promise<void> {
    const encoded = encodeProject(project), json = encoded.json;
    if (Buffer.byteLength(json) > MAX_DOCUMENT_BYTES) throw new StoreError(413, 'input_too_large', `Project exceeds the ${documentLimitLabel} limit`);
    const version = projectVersionSummarySchema.parse({ revision: project.revision, createdAt: project.updatedAt, label: label.slice(0, 500), ...(restoredFrom === undefined ? {} : { restoredFrom }), ...(library ? { library } : {}) });
    if (!previous) {
      await this.initialize(project, version, encoded);
    } else {
      if (project.id !== previous.id || project.revision !== previous.revision + 1) throw corrupt('A saved version must follow the current project revision.');
      const { manifest } = await this.ensure(previous);
      const directory = this.directory(project.id);
      // Mark the history as format 2 before its first content-addressed revision so older readers refuse it instead of misreading it.
      if (manifest.format === 1) {
        const upgraded = JSON.stringify({ format: 2, firstRevision: manifest.firstRevision });
        await writeAtomic(path.join(directory, 'manifest.json'), upgraded);
        await writeAtomic(this.marker(project.id), upgraded);
      }
      // The journal distinguishes an uncommitted snapshot from genuine older history.
      await writeAtomic(path.join(directory, 'pending.json'), JSON.stringify({ previousRevision: previous.revision, revision: project.revision, hash: encoded.snapshotHash }));
      await this.writeVersion(directory, project.revision, encoded, version);
    }
    // This atomic replacement is the commit point; its complete snapshot already exists.
    await writeAtomic(path.join(this.dataDir, `${project.id}.json`), json);
    if (previous) {
      await rm(path.join(this.directory(project.id), 'pending.json'));
      await syncDirectory(this.directory(project.id));
    }
    this.committed.set(project, encoded.snapshotHash);
  }

  async list(project: DesignProject): Promise<ProjectVersionSummary[]> {
    const { revisions } = await this.ensure(project);
    const versions: ProjectVersionSummary[] = [];
    for (const revision of revisions) {
      const record = await this.readRecord(project.id, revision);
      const filename = path.join(this.directory(project.id), String(revision), 'format' in record ? 'snapshot.json' : 'project.json');
      let info;
      try { info = await lstat(filename); } catch (error) { if (missing(error)) throw corrupt(`Snapshot for revision ${revision} is missing.`); throw error; }
      if (!info.isFile() || info.size < 1 || info.size > snapshotLimit) throw corrupt(`Snapshot for revision ${revision} has an invalid size or file type.`);
      if (record.version.restoredFrom !== undefined && record.version.restoredFrom < revisions[0]) throw corrupt(`Restore source for revision ${revision} is missing from history.`);
      versions.push(record.version);
    }
    return versions.reverse();
  }

  /** The project relative to a revision the caller holds, or undefined when that revision predates content-addressed history. */
  async delta(project: DesignProject, baseRevision: number): Promise<ProjectDelta | undefined> {
    if (baseRevision >= project.revision) return undefined;
    const record = await this.readRecord(project.id, baseRevision);
    if (!('format' in record)) return undefined;
    const snapshot = await this.readSnapshot(project.id, baseRevision, record.hash);
    const held = new Set(snapshot.parts.flatMap(part => part.pages ?? (part.blob ? [part.blob] : [])));
    const { pages, threads, designSystem, ...rest } = project;
    return {
      baseRevision,
      project: {
        ...rest, pages: pages.map(page => held.has(fragment(page).key) ? { id: page.id, unchanged: true as const } : page),
        ...(held.has(fragment(threads).key) ? {} : { threads }), ...(held.has(fragment(designSystem).key) ? {} : { designSystem }),
      },
    };
  }

  async get(project: DesignProject, revision: number): Promise<ProjectVersion> {
    const { revisions } = await this.ensure(project);
    if (revision < revisions[0] || revision > project.revision) throw new StoreError(404, 'version_not_found', `Revision ${revision} is not available in this project's recorded history.`);
    return this.readVersion(project.id, revision);
  }

  async listLibrary(project: DesignProject, scope: LibraryScope, componentId?: string): Promise<ProjectVersionSummary[]> {
    const versions = await this.list(project), relevant: ProjectVersionSummary[] = [];
    let previous: string | undefined;
    for (const version of [...versions].reverse()) {
      if (version.library) {
        if (scope === 'system' ? version.library.system : version.library.componentIds.includes(componentId!)) relevant.push(version);
        continue;
      }
      // Older snapshots have no scope metadata; compare their immutable library content once.
      const saved = await this.readVersion(project.id, version.revision);
      const value = scope === 'system' ? saved.project.designSystem : saved.project.designSystem.components.find(component => component.id === componentId);
      const signature = JSON.stringify(value);
      if (signature !== previous && value !== undefined) relevant.push(version);
      previous = signature;
    }
    return relevant.reverse();
  }

  private directory(projectId: string) { return path.join(this.root, projectId); }
  private marker(projectId: string) { return path.join(this.dataDir, `.history-${projectId}.json`); }

  private async initialize(project: DesignProject, version: ProjectVersionSummary, encoded = encodeProject(project)) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await syncDirectory(this.dataDir);
    const temporary = path.join(this.root, `.${project.id}-${randomUUID()}.tmp`);
    await mkdir(temporary, { mode: 0o700 });
    try {
      await this.writeVersion(temporary, project.revision, encoded, version);
      await writeFileSynced(path.join(temporary, 'manifest.json'), JSON.stringify({ format: 2, firstRevision: project.revision }));
      await syncDirectory(temporary);
      await rename(temporary, this.directory(project.id));
      await syncDirectory(this.root);
      await writeAtomic(this.marker(project.id), JSON.stringify({ format: 2, firstRevision: project.revision }));
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }

  private async writeVersion(directory: string, revision: number, encoded: EncodedProject, version: ProjectVersionSummary) {
    await this.writeBlobs(path.join(directory, 'blobs'), encoded.blobs);
    const temporary = path.join(directory, `.version-${randomUUID()}`);
    await mkdir(temporary, { mode: 0o700 });
    try {
      await writeFileSynced(path.join(temporary, 'snapshot.json'), encoded.snapshot);
      await writeFileSynced(path.join(temporary, 'version.json'), JSON.stringify({ format: 2, version, hash: encoded.snapshotHash }));
      await syncDirectory(temporary);
      await rename(temporary, path.join(directory, String(revision)));
      await syncDirectory(directory);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }

  // Blobs are immutable and named by their hash, so an existing file is already the required content.
  // ponytail: no blob garbage collection; retention keeps every revision, add a mark-and-sweep when pruning lands.
  private async writeBlobs(directory: string, blobs: Map<string, string>) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    let written = false;
    for (const [key, json] of blobs) {
      const filename = path.join(directory, `${key}.json`);
      try { await lstat(filename); continue; } catch (error) { if (!missing(error)) throw error; }
      const temporary = path.join(directory, `.blob-${randomUUID()}`);
      try { await writeFileSynced(temporary, json); await rename(temporary, filename); written = true; }
      finally { await rm(temporary, { force: true }); }
    }
    if (written) await syncDirectory(directory);
  }

  private async readBlob(projectId: string, key: string): Promise<string> {
    const json = await readBounded(path.join(this.directory(projectId), 'blobs', `${key}.json`), snapshotLimit);
    if (hash(json) !== key) throw corrupt('A saved history page failed its checksum.');
    return json;
  }

  private async ensure(project: DesignProject): Promise<{ revisions: number[]; manifest: z.infer<typeof manifestSchema> }> {
    const directory = this.directory(project.id);
    try {
      if (!(await lstat(directory)).isDirectory()) throw corrupt('The project history directory has an invalid file type.');
    } catch (error) {
      if (!missing(error)) throw error;
      try { await lstat(this.marker(project.id)); throw corrupt('This project’s recorded history directory is missing.'); }
      catch (markerError) { if (!missing(markerError)) throw markerError; }
      await this.initialize(project, { revision: project.revision, createdAt: project.updatedAt, label: 'Current saved version — history started' });
    }
    const manifest = await readMetadata(path.join(directory, 'manifest.json'), manifestSchema);
    let markerExists = true;
    try { await lstat(this.marker(project.id)); } catch (error) { if (missing(error)) markerExists = false; else throw error; }
    if (markerExists) {
      const marker = await readMetadata(this.marker(project.id), manifestSchema);
      if (marker.firstRevision !== manifest.firstRevision) throw corrupt('The history baseline does not match its project marker.');
    } else await writeAtomic(this.marker(project.id), JSON.stringify(manifest));
    await this.recover(project);
    const revisions: number[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'manifest.json' || (entry.name === 'blobs' && entry.isDirectory()) || /^\.version-[a-f0-9-]{36}$/.test(entry.name) || /^pending\.json\.[a-f0-9-]{36}\.tmp$/.test(entry.name)) continue;
      if (!entry.isDirectory() || !/^(0|[1-9]\d*)$/.test(entry.name) || !revisionSchema.safeParse(Number(entry.name)).success) throw corrupt('The history directory contains an invalid version entry.');
      revisions.push(Number(entry.name));
    }
    revisions.sort((a, b) => a - b);
    if (manifest.firstRevision > project.revision || revisions.length !== project.revision - manifest.firstRevision + 1 || revisions.some((revision, index) => revision !== manifest.firstRevision + index)) {
      throw corrupt('Project history has missing or unexpected revisions.');
    }
    // Compare hashes; read the snapshot back only when they differ, such as a legacy document normalized on read.
    const head = await this.readRecord(project.id, project.revision);
    const current = 'format' in head ? this.committed.get(project) ?? encodeProject(project).snapshotHash : hash(JSON.stringify(project));
    if (current !== head.hash) {
      const saved = await this.readVersion(project.id, project.revision);
      if (JSON.stringify(saved.project) !== JSON.stringify(project)) throw corrupt('The current project does not match its saved history snapshot.');
    }
    return { revisions, manifest };
  }

  private async recover(project: DesignProject) {
    const directory = this.directory(project.id);
    const pendingFile = path.join(directory, 'pending.json');
    try { await lstat(pendingFile); } catch (error) { if (missing(error)) return; throw error; }
    const pending = await readMetadata(pendingFile, pendingSchema);
    if (project.revision === pending.previousRevision) {
      const versionDirectory = path.join(directory, String(pending.revision));
      let exists = true;
      try { await lstat(versionDirectory); } catch (error) { if (missing(error)) exists = false; else throw error; }
      if (exists) {
        const record = await this.readRecord(project.id, pending.revision);
        if (record.hash !== pending.hash) throw corrupt('An interrupted history save does not match its journal.');
        const abandoned = path.join(directory, `.version-${randomUUID()}`);
        await rename(versionDirectory, abandoned);
        await syncDirectory(directory);
        await rm(abandoned, { recursive: true, force: true });
      }
    } else if (project.revision === pending.revision) {
      const record = await this.readRecord(project.id, pending.revision);
      const saved = await this.readVersion(project.id, pending.revision);
      if (record.hash !== pending.hash || JSON.stringify(saved.project) !== JSON.stringify(project)) throw corrupt('The committed project does not match its interrupted history save.');
    } else throw corrupt('The project revision does not match its history recovery journal.');
    await rm(pendingFile);
    await syncDirectory(directory);
  }

  private async readRecord(projectId: string, revision: number) {
    const record = await readMetadata(path.join(this.directory(projectId), String(revision), 'version.json'), recordSchema, 64 * 1024);
    if (record.version.revision !== revision || (record.version.restoredFrom !== undefined && record.version.restoredFrom >= revision)) throw corrupt(`Metadata for revision ${revision} has an invalid revision.`);
    return record;
  }

  private async readSnapshot(projectId: string, revision: number, expectedHash: string): Promise<Snapshot> {
    const stored = await readBounded(path.join(this.directory(projectId), String(revision), 'snapshot.json'), snapshotLimit);
    if (hash(stored) !== expectedHash) throw corrupt(`Snapshot checksum failed for revision ${revision}.`);
    try { const parsed = snapshotSchema.safeParse(JSON.parse(stored)); if (!parsed.success) throw new Error(); return parsed.data; }
    catch { throw corrupt(`Snapshot for revision ${revision} has an invalid structure.`); }
  }

  private async readVersion(projectId: string, revision: number): Promise<ProjectVersion> {
    const record = await this.readRecord(projectId, revision);
    let json: string;
    if ('format' in record) {
      const snapshot = await this.readSnapshot(projectId, revision, record.hash);
      const fragments: string[] = [];
      for (const part of snapshot.parts) {
        const value = part.pages ? `[${(await Promise.all(part.pages.map(key => this.readBlob(projectId, key)))).join(',')}]` : part.blob ? await this.readBlob(projectId, part.blob) : JSON.stringify(part.value);
        fragments.push(`${JSON.stringify(part.key)}:${value}`);
      }
      json = `{${fragments.join(',')}}`;
      if (record.projectHash && hash(json) !== record.projectHash) throw corrupt(`Snapshot checksum failed for revision ${revision}.`);
    } else {
      json = await readBounded(path.join(this.directory(projectId), String(revision), 'project.json'), snapshotLimit);
      if (hash(json) !== record.hash) throw corrupt(`Snapshot checksum failed for revision ${revision}.`);
    }
    let input: unknown;
    try { input = JSON.parse(json); } catch { throw corrupt(`Snapshot for revision ${revision} is not valid JSON.`); }
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success || parsed.data.id !== projectId || parsed.data.revision !== revision || parsed.data.updatedAt !== record.version.createdAt) throw corrupt(`Snapshot for revision ${revision} has an invalid project structure.`);
    return { project: parsed.data, version: record.version };
  }
}
