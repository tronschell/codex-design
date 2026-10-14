import { constants, type BigIntStats } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { MAX_ASSET_BYTES, MAX_ASSET_CHUNK_BYTES, type AssetMetadata, type AssetMimeType } from '../shared/media.ts';
import { ProjectStore, StoreError } from './store.ts';

const invalidFile = () => new StoreError(400, 'invalid_generated_image', 'Use the absolute path of a native image_gen PNG, JPEG or WebP result within CODEX_HOME/generated_images. Parent-directory traversal and symlinks are not allowed.');
const changedFile = () => new StoreError(409, 'generated_image_changed', 'The generated image changed while it was being imported. Wait for image_gen to finish, then retry.');
const sameFile = (left: BigIntStats, right: BigIntStats) => left.dev === right.dev && left.ino === right.ino;

function relativeChild(directory: string, filename: string): string | undefined {
  const relative = path.relative(directory, filename);
  return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? relative : undefined;
}

function rasterMimeType(bytes: Buffer): AssetMimeType {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 <= bytes.length) return 'image/webp';
  throw new StoreError(400, 'invalid_generated_image_type', 'The generated file must have a supported PNG, JPEG or WebP raster signature.');
}

async function readGeneratedImage(filePath: string) {
  try {
    if (typeof filePath !== 'string' || !filePath || filePath.length > 4096 || !path.isAbsolute(filePath) || /[\x00-\x1f\x7f\\]/.test(filePath) || filePath.split(path.sep).includes('..')) throw invalidFile();
    const configuredHome = path.resolve(process.env.CODEX_HOME || path.join(homedir(), '.codex'));
    const directory = path.join(await realpath(configuredHome), 'generated_images');
    const relative = relativeChild(path.join(configuredHome, 'generated_images'), filePath) ?? relativeChild(directory, filePath);
    if (!relative) throw invalidFile();
    const filename = path.join(directory, relative);
    const parents: { filename: string; info: BigIntStats }[] = [];
    let parent = directory;
    for (const part of ['', ...relative.split(path.sep).slice(0, -1)]) {
      parent = path.join(parent, part);
      const info = await lstat(parent, { bigint: true });
      if (!info.isDirectory()) throw invalidFile();
      parents.push({ filename: parent, info });
    }
    const before = await lstat(filename, { bigint: true });
    if (!before.isFile() || await realpath(filename) !== filename) throw invalidFile();
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const info = await handle.stat({ bigint: true });
      if (!info.isFile() || !sameFile(before, info)) throw changedFile();
      if (info.size < 1n || info.size > BigInt(MAX_ASSET_BYTES)) throw new StoreError(413, 'asset_too_large', 'Generated images must contain 1 byte to 32 MiB.');
      const verifyPath = async () => {
        for (const entry of parents) {
          const current = await lstat(entry.filename, { bigint: true });
          if (!current.isDirectory() || !sameFile(entry.info, current)) throw changedFile();
        }
        const current = await lstat(filename, { bigint: true });
        if (!current.isFile() || !sameFile(info, current) || await realpath(filename) !== filename) throw changedFile();
      };
      await verifyPath();
      // A fixed allocation and one extra byte reject growth without an unbounded readFile.
      const bytes = Buffer.alloc(Number(info.size) + 1);
      let offset = 0;
      while (offset < bytes.length) {
        const count = (await handle.read(bytes, offset, bytes.length - offset, offset)).bytesRead;
        if (!count) break;
        offset += count;
      }
      const after = await handle.stat({ bigint: true });
      if (offset !== Number(info.size) || after.size !== info.size || after.mtimeNs !== info.mtimeNs || after.ctimeNs !== info.ctimeNs) throw changedFile();
      await verifyPath();
      const image = bytes.subarray(0, offset);
      return { bytes: image, mimeType: rasterMimeType(image), name: path.basename(filename) };
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw invalidFile();
  }
}

export async function importGeneratedImage(store: ProjectStore, filePath: string): Promise<{ asset: AssetMetadata }> {
  const { bytes, mimeType, name } = await readGeneratedImage(filePath);
  const upload = await store.beginAssetUpload({ name, mimeType, byteLength: bytes.length });
  try {
    let asset: AssetMetadata | undefined;
    for (let offset = 0; offset < bytes.length; offset += MAX_ASSET_CHUNK_BYTES) {
      const chunk = bytes.subarray(offset, offset + MAX_ASSET_CHUNK_BYTES);
      asset = (await store.uploadAssetChunk({ uploadId: upload.uploadId, offset, data: chunk.toString('base64') })).asset;
    }
    if (!asset) throw new StoreError(500, 'generated_image_import_failed', 'The generated image upload did not complete. Retry the import.');
    return { asset };
  } catch (error) {
    try { await store.cancelAssetUpload(upload.uploadId); }
    catch { throw new StoreError(500, 'generated_image_import_cleanup_failed', 'The generated image import failed and its incomplete upload could not be cancelled. The pending upload expires after one hour.'); }
    throw error;
  }
}
