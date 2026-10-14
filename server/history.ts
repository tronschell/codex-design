import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { DesignProject, LibraryScope, ProjectVersion, ProjectVersionSummary } from '../shared/types.ts';
import { MAX_INPUT_BYTES, projectSchema, projectVersionSummarySchema, revisionSchema } from '../shared/validation.ts';

export class StoreError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'StoreError';
  }
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const hash = (json: string) => createHash('sha256').update(json).digest('hex');
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({ format: z.literal(1), firstRevision: revisionSchema }).strict();
const recordSchema = z.object({ version: projectVersionSummarySchema, hash: hashSchema }).strict();
const pendingSchema = z.object({ previousRevision: revisionSchema, revision: revisionSchema, hash: hashSchema }).strict().refine((value) => value.revision === value.previousRevision + 1, 'Invalid pending revision');
const corrupt = (message: string) => new StoreError(500, 'corrupt_history', message);
const snapshotLimit = MAX_INPUT_BYTES + 64 * 1024; // Legacy board normalization can enrich an already-full saved document.

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

  async save(project: DesignProject, label: string, previous?: DesignProject, restoredFrom?: number, library?: ProjectVersionSummary['library']): Promise<void> {
    const json = JSON.stringify(project);
    if (Buffer.byteLength(json) > MAX_INPUT_BYTES) throw new StoreError(413, 'input_too_large', 'Project exceeds the 2 MiB limit');
    const version = projectVersionSummarySchema.parse({ revision: project.revision, createdAt: project.updatedAt, label: label.slice(0, 500), ...(restoredFrom === undefined ? {} : { restoredFrom }), ...(library ? { library } : {}) });
    if (!previous) {
      await this.initialize(project, version);
    } else {
      if (project.id !== previous.id || project.revision !== previous.revision + 1) throw corrupt('A saved version must follow the current project revision.');
      await this.ensure(previous);
      const directory = this.directory(project.id);
      // The journal distinguishes an uncommitted snapshot from genuine older history.
      await writeAtomic(path.join(directory, 'pending.json'), JSON.stringify({ previousRevision: previous.revision, revision: project.revision, hash: hash(json) }));
      await this.writeVersion(directory, project, version);
    }
    // This atomic replacement is the commit point; its complete snapshot already exists.
    await writeAtomic(path.join(this.dataDir, `${project.id}.json`), json);
    if (previous) {
      await rm(path.join(this.directory(project.id), 'pending.json'));
      await syncDirectory(this.directory(project.id));
    }
  }

  async list(project: DesignProject): Promise<ProjectVersionSummary[]> {
    const revisions = await this.ensure(project);
    const versions: ProjectVersionSummary[] = [];
    for (const revision of revisions) {
      const record = await this.readRecord(project.id, revision);
      const filename = path.join(this.directory(project.id), String(revision), 'project.json');
      let info;
      try { info = await lstat(filename); } catch (error) { if (missing(error)) throw corrupt(`Snapshot for revision ${revision} is missing.`); throw error; }
      if (!info.isFile() || info.size < 1 || info.size > snapshotLimit) throw corrupt(`Snapshot for revision ${revision} has an invalid size or file type.`);
      if (record.version.restoredFrom !== undefined && record.version.restoredFrom < revisions[0]) throw corrupt(`Restore source for revision ${revision} is missing from history.`);
      versions.push(record.version);
    }
    return versions.reverse();
  }

  async get(project: DesignProject, revision: number): Promise<ProjectVersion> {
    const revisions = await this.ensure(project);
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

  private async initialize(project: DesignProject, version: ProjectVersionSummary) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await syncDirectory(this.dataDir);
    const temporary = path.join(this.root, `.${project.id}-${randomUUID()}.tmp`);
    await mkdir(temporary, { mode: 0o700 });
    try {
      await this.writeVersion(temporary, project, version);
      await writeFileSynced(path.join(temporary, 'manifest.json'), JSON.stringify({ format: 1, firstRevision: project.revision }));
      await syncDirectory(temporary);
      await rename(temporary, this.directory(project.id));
      await syncDirectory(this.root);
      await writeAtomic(this.marker(project.id), JSON.stringify({ format: 1, firstRevision: project.revision }));
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }

  private async writeVersion(directory: string, project: DesignProject, version: ProjectVersionSummary) {
    const temporary = path.join(directory, `.version-${randomUUID()}`);
    const json = JSON.stringify(project);
    await mkdir(temporary, { mode: 0o700 });
    try {
      await writeFileSynced(path.join(temporary, 'project.json'), json);
      await writeFileSynced(path.join(temporary, 'version.json'), JSON.stringify({ version, hash: hash(json) }));
      await syncDirectory(temporary);
      await rename(temporary, path.join(directory, String(project.revision)));
      await syncDirectory(directory);
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }

  private async ensure(project: DesignProject): Promise<number[]> {
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
      if (entry.name === 'manifest.json' || /^\.version-[a-f0-9-]{36}$/.test(entry.name) || /^pending\.json\.[a-f0-9-]{36}\.tmp$/.test(entry.name)) continue;
      if (!entry.isDirectory() || !/^(0|[1-9]\d*)$/.test(entry.name) || !revisionSchema.safeParse(Number(entry.name)).success) throw corrupt('The history directory contains an invalid version entry.');
      revisions.push(Number(entry.name));
    }
    revisions.sort((a, b) => a - b);
    if (manifest.firstRevision > project.revision || revisions.length !== project.revision - manifest.firstRevision + 1 || revisions.some((revision, index) => revision !== manifest.firstRevision + index)) {
      throw corrupt('Project history has missing or unexpected revisions.');
    }
    const saved = await this.readVersion(project.id, project.revision);
    if (JSON.stringify(saved.project) !== JSON.stringify(project)) throw corrupt('The current project does not match its saved history snapshot.');
    return revisions;
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

  private async readVersion(projectId: string, revision: number): Promise<ProjectVersion> {
    const record = await this.readRecord(projectId, revision);
    const json = await readBounded(path.join(this.directory(projectId), String(revision), 'project.json'), snapshotLimit);
    if (hash(json) !== record.hash) throw corrupt(`Snapshot checksum failed for revision ${revision}.`);
    let input: unknown;
    try { input = JSON.parse(json); } catch { throw corrupt(`Snapshot for revision ${revision} is not valid JSON.`); }
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success || parsed.data.id !== projectId || parsed.data.revision !== revision || parsed.data.updatedAt !== record.version.createdAt) throw corrupt(`Snapshot for revision ${revision} has an invalid project structure.`);
    return { project: parsed.data, version: record.version };
  }
}
