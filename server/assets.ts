import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { DesignProject } from '../shared/types.ts';
import { MAX_ASSET_BYTES, MAX_ASSET_CHUNK_BYTES, type AssetChunk, type AssetMetadata, type AssetMimeType, type AssetUpload, type AssetUploadCancellation } from '../shared/media.ts';
import { assetMetadataSchema, assetRefSchema, assetUploadIdSchema, beginAssetUploadSchema, cancelAssetUploadSchema, readAssetChunkSchema, uploadAssetChunkSchema } from '../shared/validation.ts';
import { StoreError } from './history.ts';

const UPLOAD_LIFETIME_MS = 60 * 60 * 1000;
const MAX_PENDING_UPLOADS = 8;
const uploadRecordSchema = beginAssetUploadSchema.extend({ createdAt: z.number().int().min(0) }).strict();
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const corrupt = () => new StoreError(500, 'corrupt_asset', 'Saved media has invalid metadata, size, or file type.');

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, any>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new StoreError(400, 'invalid_asset', parsed.error.issues.map(issue => `${issue.path.join('.') || 'asset'}: ${issue.message}`).join('; '));
  return parsed.data;
}

async function directory(filename: string) {
  if (!(await lstat(filename)).isDirectory()) throw corrupt();
}

async function syncDirectory(filename: string) {
  const handle = await open(filename, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeSynced(filename: string, bytes: string | Buffer) {
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}

async function readBounded(filename: string, limit: number): Promise<Buffer> {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size < 1 || info.size > limit) throw corrupt();
    return await handle.readFile();
  } finally { await handle.close(); }
}

async function readMetadata<T>(filename: string, schema: z.ZodType<T, z.ZodTypeDef, any>): Promise<T> {
  let value: unknown;
  try { value = JSON.parse((await readBounded(filename, 8192)).toString('utf8')); }
  catch (error) { if (error instanceof SyntaxError) throw corrupt(); throw error; }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw corrupt();
  return parsed.data;
}

function safeSvg(bytes: Buffer): boolean {
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim(); } catch { return false; }
  if (!/^(?:<\?xml[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|\/?>)/i.test(text)) return false;
  if (!/(?:<\/svg\s*>|\/>)\s*$/.test(text) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) return false;
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed|audio|video)(?:\s|\/?>)/i.test(text)) return false;
  if (/\s+on[\w-]+\s*=|javascript\s*:|@import/i.test(text)) return false;
  for (const match of text.matchAll(/\b(?:[\w-]+:)?(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) if (!match[2].trim().startsWith('#')) return false;
  for (const match of text.matchAll(/url\s*\(([^)]*)\)/gi)) if (!match[1].trim().replace(/^["']|["']$/g, '').startsWith('#')) return false;
  for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>|\bstyle\s*=\s*(["'])(.*?)\2/gi)) if (/\\|&#/.test(match[1] ?? match[3])) return false;
  return true;
}

function matchesMime(bytes: Buffer, mimeType: AssetMimeType): boolean {
  switch (mimeType) {
    case 'image/png': return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/jpeg': return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
    case 'image/webp': return bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 <= bytes.length;
    case 'image/svg+xml': return safeSvg(bytes);
    case 'video/webm': return bytes.length >= 12 && bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) && bytes.subarray(0, 4096).includes(Buffer.from('webm'));
    case 'video/mp4':
    case 'video/quicktime': {
      let offset = 0;
      while (offset + 12 <= Math.min(bytes.length, 4096)) {
        const size = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        if (type === 'ftyp' && size >= 16 && offset + size <= bytes.length) {
          const brands = [bytes.toString('ascii', offset + 8, offset + 12)];
          for (let index = offset + 16; index + 4 <= offset + size; index += 4) brands.push(bytes.toString('ascii', index, index + 4));
          return mimeType === 'video/quicktime' ? brands.includes('qt  ') : brands.some(brand => /^(?:isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/.test(brand));
        }
        if (mimeType === 'video/quicktime' && ['moov', 'mdat', 'wide'].includes(type) && (size === 0 || size >= 8 && offset + size <= bytes.length)) return true;
        if (size < 8 || offset + size > bytes.length || !['free', 'skip', 'wide'].includes(type)) return false;
        offset += size;
      }
      return false;
    }
  }
}

// ProjectStore holds its shared filesystem write lock for begin/append/cancel, including HTTP and stdio callers.
export class AssetStore {
  private readonly root: string;
  private readonly uploads: string;
  private initializing?: Promise<void>;

  constructor(dataDir: string) {
    this.root = path.join(dataDir, 'assets');
    this.uploads = path.join(this.root, 'uploads');
  }

  private async init() {
    this.initializing ??= (async () => {
      await mkdir(this.root, { recursive: true, mode: 0o700 }); await directory(this.root);
      await mkdir(this.uploads, { recursive: true, mode: 0o700 }); await directory(this.uploads);
    })();
    await this.initializing;
    await directory(this.root); await directory(this.uploads);
  }

  async begin(input: unknown): Promise<AssetUpload> {
    const metadata = parse(beginAssetUploadSchema, input);
    await this.init();
    let pending = 0;
    for (const entry of await readdir(this.uploads, { withFileTypes: true })) {
      if (!assetUploadIdSchema.safeParse(entry.name).success && !/^\.new-[a-f0-9-]{36}$/.test(entry.name)) throw corrupt();
      if (!entry.isDirectory()) throw corrupt();
      const filename = path.join(this.uploads, entry.name);
      const info = await lstat(path.join(filename, 'data')).catch(error => { if (!missing(error)) throw error; return lstat(filename); });
      if (Date.now() - info.mtimeMs > UPLOAD_LIFETIME_MS) await rm(filename, { recursive: true, force: true });
      else pending++;
    }
    if (pending >= MAX_PENDING_UPLOADS) throw new StoreError(429, 'asset_upload_busy', 'Eight media uploads are already in progress. Finish or cancel a pending upload, or retry after an abandoned upload expires in one hour.');
    const uploadId = randomUUID();
    const temporary = path.join(this.uploads, `.new-${uploadId}`);
    await mkdir(temporary, { mode: 0o700 });
    try {
      await writeSynced(path.join(temporary, 'upload.json'), JSON.stringify({ ...metadata, createdAt: Date.now() }));
      await writeSynced(path.join(temporary, 'data'), Buffer.alloc(0));
      await syncDirectory(temporary);
      await rename(temporary, this.uploadDirectory(uploadId));
      await syncDirectory(this.uploads);
    } finally { await rm(temporary, { recursive: true, force: true }); }
    return { uploadId, offset: 0, byteLength: metadata.byteLength };
  }

  async cancel(input: string): Promise<AssetUploadCancellation> {
    const { uploadId } = parse(cancelAssetUploadSchema, { uploadId: input });
    await this.init();
    const upload = this.uploadDirectory(uploadId);
    try { await directory(upload); }
    catch (error) {
      if (missing(error)) return { uploadId, cancelled: false };
      throw error;
    }
    await rm(upload, { recursive: true });
    await syncDirectory(this.uploads);
    return { uploadId, cancelled: true };
  }

  async append(input: unknown): Promise<AssetUpload> {
    const { uploadId, offset, data } = parse(uploadAssetChunkSchema, input);
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > MAX_ASSET_CHUNK_BYTES || bytes.toString('base64') !== data) throw new StoreError(400, 'invalid_asset', 'Media chunks must contain canonical base64 for at most 1 MiB of bytes.');
    await this.init();
    const upload = this.uploadDirectory(uploadId);
    try {
      await directory(upload);
      const metadata = await readMetadata(path.join(upload, 'upload.json'), uploadRecordSchema);
      const handle = await open(path.join(upload, 'data'), constants.O_RDWR | constants.O_NOFOLLOW);
      let nextOffset: number;
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size > metadata.byteLength) throw corrupt();
        if (Date.now() - info.mtimeMs > UPLOAD_LIFETIME_MS) throw new StoreError(410, 'asset_upload_expired', 'The media upload expired. Start the upload again.');
        if (info.size !== offset) throw new StoreError(409, 'asset_upload_offset', `Media upload expects offset ${info.size}, received ${offset}.`, { offset: info.size });
        nextOffset = offset + bytes.length;
        if (nextOffset > metadata.byteLength) throw new StoreError(413, 'asset_too_large', 'Media chunk exceeds the upload’s declared size.');
        let written = 0;
        while (written < bytes.length) {
          const count = (await handle.write(bytes, written, bytes.length - written, offset + written)).bytesWritten;
          if (!count) throw new Error('Unable to write media bytes.');
          written += count;
        }
        await handle.sync();
      } finally { await handle.close(); }
      if (nextOffset < metadata.byteLength) return { uploadId, offset: nextOffset, byteLength: metadata.byteLength };
      const complete = await readBounded(path.join(upload, 'data'), MAX_ASSET_BYTES);
      if (complete.length !== metadata.byteLength || !matchesMime(complete, metadata.mimeType)) {
        await rm(upload, { recursive: true, force: true });
        throw new StoreError(400, 'invalid_asset_type', 'The file bytes do not match the selected supported image or video format. SVG files must be self-contained and cannot contain scripts or external references.');
      }
      const ref = `asset:${createHash('sha256').update(complete).digest('hex')}`;
      let asset: AssetMetadata;
      try {
        asset = await this.get(ref);
        if (asset.byteLength !== complete.length || !matchesMime(complete, asset.mimeType)) throw corrupt();
        const saved = path.join(this.assetDirectory(ref), 'data');
        if (!(await readBounded(saved, MAX_ASSET_BYTES)).equals(complete)) {
          await rename(path.join(upload, 'data'), saved);
          await syncDirectory(this.assetDirectory(ref));
        }
        await rm(upload, { recursive: true, force: true });
      } catch (error) {
        if (!(error instanceof StoreError) || error.code !== 'asset_not_found') throw error;
        asset = { ref, mimeType: metadata.mimeType, byteLength: complete.length, name: metadata.name };
        await writeSynced(path.join(upload, 'metadata.json'), JSON.stringify(asset));
        await syncDirectory(upload);
        await rename(upload, this.assetDirectory(ref));
        await syncDirectory(this.root); await syncDirectory(this.uploads);
        await rm(path.join(this.assetDirectory(ref), 'upload.json'), { force: true });
      }
      return { uploadId, offset: nextOffset, byteLength: metadata.byteLength, asset };
    } catch (error) {
      if (missing(error)) throw new StoreError(404, 'asset_upload_not_found', 'The media upload was not found. Start the upload again.');
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') throw corrupt();
      throw error;
    }
  }

  async get(input: string): Promise<AssetMetadata> {
    const ref = parse(assetRefSchema, input);
    await this.init();
    try {
      const filename = this.assetDirectory(ref);
      await directory(filename);
      const metadata = await readMetadata(path.join(filename, 'metadata.json'), assetMetadataSchema);
      const info = await lstat(path.join(filename, 'data'));
      if (metadata.ref !== ref || !info.isFile() || info.size !== metadata.byteLength) throw corrupt();
      return metadata;
    } catch (error) {
      if (missing(error)) throw new StoreError(404, 'asset_not_found', `Media ${ref} is not available. Import the original media file before using this reference.`);
      if ((error as NodeJS.ErrnoException).code === 'ELOOP') throw corrupt();
      throw error;
    }
  }

  async readChunk(input: unknown): Promise<AssetChunk> {
    const { ref, offset, byteLength } = parse(readAssetChunkSchema, input);
    const asset = await this.get(ref);
    if (offset >= asset.byteLength) throw new StoreError(416, 'invalid_asset_range', 'The media chunk offset must be within the saved file.');
    const bytes = Buffer.alloc(Math.min(byteLength, asset.byteLength - offset));
    const handle = await open(path.join(this.assetDirectory(ref), 'data'), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size !== asset.byteLength) throw corrupt();
      let read = 0;
      while (read < bytes.length) {
        const count = (await handle.read(bytes, read, bytes.length - read, offset + read)).bytesRead;
        if (!count) throw corrupt();
        read += count;
      }
    } finally { await handle.close(); }
    return { ref, offset, byteLength: bytes.length, totalBytes: asset.byteLength, data: bytes.toString('base64') };
  }

  async validateProject(project: DesignProject): Promise<void> {
    const assets = new Map<string, AssetMetadata>();
    const asset = async (ref: string) => {
      if (!assets.has(ref)) assets.set(ref, await this.get(ref));
      return assets.get(ref)!;
    };
    for (const nodes of [...project.pages.map(page => page.nodes), ...project.designSystem.components.map(component => component.nodes)]) for (const node of nodes) {
      if (!node.media) continue;
      const source = await asset(node.media.src);
      if ((node.type === 'image' && !source.mimeType.startsWith('image/')) || (node.type === 'video' && !source.mimeType.startsWith('video/'))) throw new StoreError(400, 'invalid_asset_type', `Media for “${node.name}” must be a ${node.type} file.`);
      if (node.media.poster && !(await asset(node.media.poster)).mimeType.startsWith('image/')) throw new StoreError(400, 'invalid_asset_type', 'A video poster must reference an uploaded image.');
    }
    for (const board of project.boards) for (const item of board.inspiration ?? []) if (!(await asset(item.assetRef)).mimeType.startsWith('image/')) throw new StoreError(400, 'invalid_asset_type', `Inspiration “${item.name}” must reference an uploaded image.`);
  }

  private uploadDirectory(uploadId: string) { return path.join(this.uploads, parse(assetUploadIdSchema, uploadId)); }
  private assetDirectory(ref: string) { return path.join(this.root, parse(assetRefSchema, ref).slice('asset:'.length)); }
}
