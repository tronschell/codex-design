import type { DesignProject, LibraryScope, LibraryVersion, Operation, ProjectSummary, ProjectVersion, ProjectVersionSummary } from '../shared/types';
import { assetChunkSchema, assetMetadataSchema, assetRefSchema, assetUploadSchema, assetUploadCancellationSchema, cancelAssetUploadSchema, beginAssetUploadSchema, libraryVersionRequestSchema, libraryVersionSchema, projectSchema, projectVersionSchema, projectVersionSummarySchema, readAssetChunkSchema, validateProjectUpdate } from '../shared/validation';
import { MAX_ASSET_CHUNK_BYTES, type AssetChunk, type AssetMetadata, type AssetUpload } from '../shared/media';
import { callTool, embedded } from './bridge';
import { applyProjectDelta } from '../shared/project-delta';
import { recordCanvasWork } from './canvas-profile';

export const AUTH_REQUIRED_EVENT = 'codex-design:auth-required';
export const TOKEN_CHANGED_EVENT = 'codex-design:token-changed';
const apiBase = (window.__CODEX_DESIGN_API_BASE__ || '').replace(/\/+$/, '');
const tokenKey = `codex-design:token:${apiBase || location.origin}`;
let token = '';
try { token = sessionStorage.getItem(tokenKey) || ''; } catch { /* Some embedded hosts disable browser storage. */ }

export class ApiError extends Error {
  constructor(message: string, public status = 500, public code?: string) { super(message); this.name = 'ApiError'; }
}
export type ProjectWatch = { projectId: string; revision: number; changed: boolean; project?: DesignProject };

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The design request was cancelled.', 'AbortError');
}

export function configureToken(value: string) {
  token = value.trim();
  try { if (token) sessionStorage.setItem(tokenKey, token); else sessionStorage.removeItem(tokenKey); }
  catch { /* The token remains available for this open canvas when storage is disabled. */ }
  window.dispatchEvent(new Event(TOKEN_CHANGED_EVENT));
}
export function apiUrl(path: string) { return `${apiBase}/api${path}`; }

async function http<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try { response = await fetch(apiUrl(path), { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
  catch { checkAborted(signal); throw new ApiError('Cannot connect to the design server. Check that it is running and try again.', 0, 'connection_failed'); }
  if (response.status === 401) window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT, { detail: { message: 'A valid bearer token is required.' } }));
  let result: any;
  try { result = await response.json(); }
  catch { checkAborted(signal); throw new ApiError(`The server returned an unreadable response (${response.status}).`, response.status || 502, 'invalid_response'); }
  if (!response.ok) {
    const message = typeof result?.error === 'string' ? result.error : typeof result?.error?.message === 'string' ? result.error.message : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, result?.error?.code);
  }
  return result as T;
}

async function tool(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  try {
    const result = await callTool(name, args);
    return result.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent as Record<string, unknown> : result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const text = error instanceof Error ? error.message : 'The plugin could not complete this action.';
    let detail: { message?: string; code?: string } = {};
    try { detail = JSON.parse(text); } catch { /* Bridge connection errors are already readable. */ }
    const code = typeof detail?.code === 'string' ? detail.code : undefined;
    const status = code === 'revision_conflict' || code === 'asset_upload_offset' ? 409 : code?.endsWith('_not_found') ? 404 : code === 'input_too_large' || code === 'asset_too_large' ? 413 : code === 'asset_upload_busy' ? 429 : code === 'asset_upload_expired' ? 410 : code?.startsWith('invalid_') || code === 'last_page' ? 400 : 502;
    throw new ApiError(typeof detail?.message === 'string' ? detail.message : text, status, code);
  }
}

export function projectFromResult(result?: Record<string, unknown>): DesignProject | undefined {
  const data = result?.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent as Record<string, unknown> : result;
  if (result?.historyPreview === true || data?.historyPreview === true) return undefined;
  const parsed = projectSchema.safeParse(data?.project);
  return parsed.success ? parsed.data : undefined;
}
// A delta response is rebuilt on the editor's copy at its base revision: unchanged pages keep their validated objects and
// only changed parts are parsed. undefined asks the caller to read the whole project (the base no longer matches).
function savedProject(base: DesignProject, result: Record<string, unknown>): DesignProject | undefined {
  const data = result?.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent as Record<string, unknown> : result;
  if (data?.delta === undefined) return projectFromResult(result);
  const merged = applyProjectDelta(base, data.delta);
  if (merged === undefined) return undefined;
  const parsed = validateProjectUpdate(base, merged);
  if (!parsed.success) throw new ApiError('The server returned an invalid design update. Reopen the canvas and try again.', 502, 'invalid_response');
  return parsed.data;
}
function requireProject(result: Record<string, unknown>): DesignProject {
  const project = projectFromResult(result);
  if (!project) throw new ApiError('The server returned an invalid design project. Reopen the canvas and try again.', 502, 'invalid_response');
  return project;
}

function requireUpload(result: unknown): AssetUpload {
  const parsed = assetUploadSchema.safeParse(result);
  if (!parsed.success) throw new ApiError('The server returned an invalid media upload response.', 502, 'invalid_response');
  return parsed.data;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array {
  try {
    const binary = atob(data);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    if (bytesToBase64(bytes) !== data) throw new Error('Invalid base64');
    return bytes;
  } catch { throw new ApiError('The server returned invalid media bytes.', 502, 'invalid_response'); }
}

export const client = {
  async cancelAssetUpload(uploadId: string) {
    const parsed = cancelAssetUploadSchema.safeParse({ uploadId });
    if (!parsed.success) throw new ApiError('Use a valid pending media upload ID.', 400, 'invalid_asset');
    const result = embedded ? await tool('canvas_cancel_asset_upload', parsed.data) : await http<Record<string, unknown>>(`/assets/uploads/${encodeURIComponent(uploadId)}/cancel`, {});
    const cancellation = assetUploadCancellationSchema.safeParse(result);
    if (!cancellation.success || cancellation.data.uploadId !== uploadId) throw new ApiError('The server returned an invalid upload cancellation.', 502, 'invalid_response');
    return cancellation.data;
  },
  async uploadAsset(file: Blob, name?: string, onProgress?: (uploadedBytes: number, totalBytes: number) => void, signal?: AbortSignal): Promise<AssetMetadata> {
    checkAborted(signal);
    const parsed = beginAssetUploadSchema.safeParse({ name: name ?? (file instanceof File ? file.name : 'Media'), mimeType: file.type, byteLength: file.size });
    if (!parsed.success) throw new ApiError(parsed.error.issues.map(issue => issue.message).join('; '), 400, 'invalid_asset');
    const input = parsed.data;
    let upload: AssetUpload | undefined;
    try {
      // Read the upload ID before honoring cancellation so its temporary slot can be released.
      upload = requireUpload(embedded ? await tool('canvas_begin_asset_upload', input) : await http('/assets/uploads', input));
      if (upload.offset !== 0 || upload.byteLength !== file.size || upload.asset) throw new ApiError('The server returned an invalid new media upload.', 502, 'invalid_response');
      checkAborted(signal); onProgress?.(0, file.size);
      while (upload.offset < file.size) {
        checkAborted(signal);
        const offset = upload.offset;
        const bytes = new Uint8Array(await file.slice(offset, offset + MAX_ASSET_CHUNK_BYTES).arrayBuffer());
        checkAborted(signal);
        const data = bytesToBase64(bytes);
        const next = requireUpload(embedded ? await tool('canvas_upload_asset_chunk', { uploadId: upload.uploadId, offset, data }) : await http(`/assets/uploads/${encodeURIComponent(upload.uploadId)}/chunks`, { offset, data }, signal));
        if (next.uploadId !== upload.uploadId || next.offset !== offset + bytes.length || next.byteLength !== file.size || !!next.asset !== (next.offset === file.size)) throw new ApiError('The server returned an invalid media upload offset.', 502, 'invalid_response');
        upload = next;
        checkAborted(signal); onProgress?.(upload.offset, file.size);
      }
      if (!upload.asset || upload.asset.byteLength !== file.size) throw new ApiError('The media upload did not return a complete saved asset.', 502, 'invalid_response');
      return upload.asset;
    } catch (error) {
      if (upload && !upload.asset) {
        try { await client.cancelAssetUpload(upload.uploadId); }
        catch { /* Disconnected or older hosts retain the existing one-hour expiry fallback. */ }
      }
      checkAborted(signal);
      throw error;
    }
  },
  async getAsset(ref: string, signal?: AbortSignal): Promise<AssetMetadata> {
    if (!assetRefSchema.safeParse(ref).success) throw new ApiError('Use an uploaded asset:<SHA-256> media reference.', 400, 'invalid_asset');
    checkAborted(signal);
    const result = embedded ? await tool('canvas_get_asset', { ref }) : await http<Record<string, unknown>>(`/assets/${encodeURIComponent(ref.slice('asset:'.length))}`, undefined, signal);
    checkAborted(signal);
    const parsed = assetMetadataSchema.safeParse(result.asset);
    if (!parsed.success || parsed.data.ref !== ref) throw new ApiError('The server returned invalid media metadata.', 502, 'invalid_response');
    return parsed.data;
  },
  async readAssetChunk(ref: string, offset: number, byteLength = MAX_ASSET_CHUNK_BYTES, signal?: AbortSignal): Promise<AssetChunk> {
    const parsedInput = readAssetChunkSchema.safeParse({ ref, offset, byteLength });
    if (!parsedInput.success) throw new ApiError('Request a valid media reference and a chunk of at most 1 MiB.', 400, 'invalid_asset_range');
    checkAborted(signal);
    const result = embedded ? await tool('canvas_read_asset_chunk', parsedInput.data) : await http<Record<string, unknown>>(`/assets/${encodeURIComponent(ref.slice('asset:'.length))}/chunks?offset=${offset}&byteLength=${byteLength}`, undefined, signal);
    checkAborted(signal);
    const parsed = assetChunkSchema.safeParse(result);
    if (!parsed.success || parsed.data.ref !== ref || parsed.data.offset !== offset || parsed.data.byteLength !== Math.min(byteLength, parsed.data.totalBytes - offset) || parsed.data.byteLength < 1) throw new ApiError('The server returned an invalid media byte range.', 502, 'invalid_response');
    return parsed.data;
  },
  async readAsset(ref: string, signal?: AbortSignal): Promise<{ asset: AssetMetadata; bytes: Uint8Array }> {
    const asset = await client.getAsset(ref, signal);
    const bytes = new Uint8Array(asset.byteLength);
    let offset = 0;
    while (offset < bytes.length) {
      const chunk = await client.readAssetChunk(ref, offset, MAX_ASSET_CHUNK_BYTES, signal);
      const data = base64ToBytes(chunk.data);
      if (chunk.totalBytes !== asset.byteLength || data.length !== chunk.byteLength) throw new ApiError('The server returned incomplete media bytes.', 502, 'invalid_response');
      bytes.set(data, offset);
      offset += data.length;
    }
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (ref !== `asset:${hash}`) throw new ApiError('Saved media failed its content checksum. Import the original file again.', 502, 'corrupt_asset');
    }
    checkAborted(signal);
    return { asset, bytes };
  },
  async list(): Promise<ProjectSummary[]> {
    recordCanvasWork('projectLists');
    const result = embedded ? await tool('canvas_list_projects') : await http<{ projects: ProjectSummary[] }>('/projects');
    if (!result || !Array.isArray(result.projects)) throw new ApiError('The server returned an invalid project list.', 502, 'invalid_response');
    return result.projects as ProjectSummary[];
  },
  async get(id: string, signal?: AbortSignal): Promise<DesignProject> {
    recordCanvasWork('projectReads');
    checkAborted(signal);
    const result = embedded ? await tool('canvas_get_project', { projectId: id }) : { project: await http(`/projects/${encodeURIComponent(id)}`, undefined, signal) };
    checkAborted(signal);
    return requireProject(result);
  },
  async watch(base: DesignProject, signal?: AbortSignal): Promise<ProjectWatch> {
    checkAborted(signal);
    const id = base.id, afterRevision = base.revision;
    let result: Record<string, unknown>;
    try {
      result = embedded ? await tool('canvas_watch_project', { projectId: id, afterRevision, delta: true }) : await http(`/projects/${encodeURIComponent(id)}/changes?afterRevision=${encodeURIComponent(String(afterRevision))}&delta=1`, undefined, signal);
    } catch (error) {
      checkAborted(signal);
      const unsupported = error instanceof ApiError && (embedded
        ? /unknown tool|not registered|unrecognized tool|tool[^\n]*not found|tool[^\n]*does not exist|method not found/i.test(error.message)
        : [404, 405, 501].includes(error.status) && error.code !== 'project_not_found');
      if (unsupported) throw new ApiError('This runtime does not support revision watches yet.', 501, 'watch_unsupported');
      throw error;
    }
    checkAborted(signal);
    if (result.projectId !== id || !Number.isSafeInteger(result.revision) || (result.revision as number) < 0 || typeof result.changed !== 'boolean') throw new ApiError('The server returned an invalid revision update.', 502, 'invalid_response');
    const revision = result.revision as number;
    if (!result.changed) {
      if (result.project !== undefined || result.delta !== undefined || revision > afterRevision) throw new ApiError('The server returned an invalid revision heartbeat.', 502, 'invalid_response');
      return { projectId: id, revision, changed: false };
    }
    const project = savedProject(base, result) ?? await client.get(id, signal);
    if (revision <= afterRevision || project.id !== id || project.revision !== revision) throw new ApiError('The server returned an invalid project revision.', 502, 'invalid_response');
    return { projectId: id, revision, changed: true, project };
  },
  async listVersions(id: string): Promise<ProjectVersionSummary[]> {
    const result = embedded ? await tool('canvas_list_versions', { projectId: id }) : await http<{ versions: unknown }>(`/projects/${encodeURIComponent(id)}/history`);
    const parsed = projectVersionSummarySchema.array().safeParse(result?.versions);
    if (!parsed.success) throw new ApiError('The server returned an invalid version history. Refresh History and try again.', 502, 'invalid_response');
    return parsed.data;
  },
  async getVersion(id: string, revision: number): Promise<ProjectVersion> {
    const result = embedded ? await tool('canvas_get_version', { projectId: id, revision }) : await http<Record<string, unknown>>(`/projects/${encodeURIComponent(id)}/history/${encodeURIComponent(String(revision))}`);
    const parsed = projectVersionSchema.safeParse({ project: result?.project, version: result?.version });
    if (!parsed.success || parsed.data.project.id !== id || parsed.data.project.revision !== revision || parsed.data.version.revision !== revision) throw new ApiError('The server returned an invalid saved version. Refresh History and try again.', 502, 'invalid_response');
    return parsed.data;
  },
  async restoreVersion(id: string, expectedRevision: number, revision: number): Promise<DesignProject> {
    return requireProject(embedded ? await tool('canvas_restore_version', { projectId: id, expectedRevision, revision }) : { project: await http(`/projects/${encodeURIComponent(id)}/history/restore`, { expectedRevision, revision }) });
  },
  async listLibraryVersions(id: string, scope: LibraryScope, componentId?: string): Promise<ProjectVersionSummary[]> {
    const input = libraryVersionRequestSchema.parse({ scope, componentId });
    const query = new URLSearchParams({ scope, ...(componentId ? { componentId } : {}) });
    const result = embedded ? await tool('canvas_list_library_versions', { projectId: id, ...input }) : await http<Record<string, unknown>>(`/projects/${encodeURIComponent(id)}/library/history?${query}`);
    const parsed = projectVersionSummarySchema.array().safeParse(result?.versions);
    if (!parsed.success) throw new ApiError('The server returned invalid library history.', 502, 'invalid_response');
    return parsed.data;
  },
  async getLibraryVersion(id: string, revision: number, scope: LibraryScope, componentId?: string): Promise<LibraryVersion> {
    const input = libraryVersionRequestSchema.parse({ scope, componentId });
    const query = new URLSearchParams({ scope, ...(componentId ? { componentId } : {}) });
    const result = embedded ? await tool('canvas_get_library_version', { projectId: id, revision, ...input }) : await http<Record<string, unknown>>(`/projects/${encodeURIComponent(id)}/library/history/${revision}?${query}`);
    const parsed = libraryVersionSchema.safeParse({ designSystem: result.designSystem, version: result.version, ...(result.component ? { component: result.component } : {}) });
    if (!parsed.success || parsed.data.version.revision !== revision || (scope === 'component' && parsed.data.component?.id !== componentId)) throw new ApiError('The server returned an invalid library version.', 502, 'invalid_response');
    return parsed.data;
  },
  async restoreLibraryVersion(id: string, expectedRevision: number, revision: number, scope: LibraryScope, componentId?: string): Promise<DesignProject> {
    const input = { expectedRevision, revision, ...libraryVersionRequestSchema.parse({ scope, componentId }) };
    return requireProject(embedded ? await tool('canvas_restore_library_version', { projectId: id, ...input }) : { project: await http(`/projects/${encodeURIComponent(id)}/library/history/restore`, input) });
  },
  async create(name: string, template: 'blank' | 'demo'): Promise<DesignProject> {
    return requireProject(embedded ? await tool('canvas_create_project', { name, template }) : { project: await http('/projects', { name, template }) });
  },
  async mutate(base: DesignProject, operations: Operation[]): Promise<DesignProject> {
    const id = base.id, expectedRevision = base.revision;
    const result = embedded ? await tool('canvas_edit_project', { projectId: id, expectedRevision, operations, delta: true }) : await http<Record<string, unknown>>(`/projects/${encodeURIComponent(id)}/operations?delta=1`, { expectedRevision, operations });
    return savedProject(base, result) ?? await client.get(id);
  },
  async importProject(project: unknown): Promise<DesignProject> {
    return requireProject(embedded ? await tool('canvas_import_project', { project }) : { project: await http('/projects/import', { project }) });
  },
};
