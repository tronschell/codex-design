export type ArchiveFiles = Record<string, string | Uint8Array>;
export const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function safePath(path: string) {
  if (!path || path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[a-z]:/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('The archive contains an unsafe file path.');
  return path;
}

// Store-only archives keep binary media portable without adding a compression dependency.
export function zipFiles(files: ArchiveFiles): Uint8Array {
  const local: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0, centralSize = 0;
  if (Object.keys(files).length > 10_000) throw new Error('The export contains too many files. Export a smaller scope.');
  for (const [filename, source] of Object.entries(files)) {
    const name = encoder.encode(safePath(filename)), data = typeof source === 'string' ? encoder.encode(source) : source;
    if (name.length > 65535) throw new Error('An export file name is too long.');
    if (offset + centralSize + data.length + name.length * 2 + 98 > MAX_ARCHIVE_BYTES) throw new Error('The archive exceeds 256 MiB. Export a smaller scope.');
    const crc = crc32(data);
    const header = new Uint8Array(30 + name.length), view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x800, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true); header.set(name, 30); local.push(header, data);
    const entry = new Uint8Array(46 + name.length), cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true); entry.set(name, 46); central.push(entry);
    offset += header.length + data.length; centralSize += entry.length;
  }
  const end = new Uint8Array(22), ev = new DataView(end.buffer), count = central.length;
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, count, true); ev.setUint16(10, count, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const chunk of [...local, ...central, end]) { result.set(chunk, at); at += chunk.length; }
  return result;
}

export function unzipFiles(bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.length > MAX_ARCHIVE_BYTES) throw new Error('Project archives must be no larger than 256 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const invalid = () => new Error('This ZIP archive is damaged or unsupported. Import an original Codex Design export.');
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.length) break;
  }
  if (end < 0 || end < bytes.length - 65557) throw invalid();
  const count = view.getUint16(end + 10, true), centralSize = view.getUint32(end + 12, true), centralAt = view.getUint32(end + 16, true);
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || count > 10_000 || centralAt + centralSize !== end) throw invalid();
  const files: Record<string, Uint8Array> = Object.create(null);
  let at = centralAt, total = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || view.getUint32(at, true) !== 0x02014b50) throw invalid();
    const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), size = view.getUint32(at + 24, true);
    if (method !== 0) throw new Error('Compressed ZIP archives are not supported. Import the original unmodified Codex Design ZIP or its design.json.');
    if ((flags & ~0x800) || view.getUint32(at + 20, true) !== size || view.getUint16(at + 34, true)) throw invalid();
    const nameSize = view.getUint16(at + 28, true), entrySize = 46 + nameSize + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    if (at + entrySize > end) throw invalid();
    let path: string;
    try { path = safePath(decoder.decode(bytes.subarray(at + 46, at + 46 + nameSize))); } catch { throw invalid(); }
    if (Object.hasOwn(files, path)) throw new Error('The archive contains duplicate files. Import an original Codex Design export.');
    const localAt = view.getUint32(at + 42, true), crc = view.getUint32(at + 16, true);
    if (localAt + 30 > centralAt || view.getUint32(localAt, true) !== 0x04034b50 || view.getUint16(localAt + 6, true) !== flags || view.getUint16(localAt + 8, true) !== method || view.getUint32(localAt + 14, true) !== crc || view.getUint32(localAt + 18, true) !== size || view.getUint32(localAt + 22, true) !== size) throw invalid();
    const localNameSize = view.getUint16(localAt + 26, true), dataAt = localAt + 30 + localNameSize + view.getUint16(localAt + 28, true);
    if (dataAt + size > centralAt || decoder.decode(bytes.subarray(localAt + 30, localAt + 30 + localNameSize)) !== path) throw invalid();
    total += size;
    if (total > MAX_ARCHIVE_BYTES) throw new Error('The archive expands beyond 256 MiB. Import a smaller export.');
    const data = bytes.subarray(dataAt, dataAt + size);
    if (crc32(data) !== crc) throw new Error(`The archive file ${path} is damaged. Export the project again.`);
    files[path] = data;
    at += entrySize;
  }
  if (at !== centralAt + centralSize) throw invalid();
  return files;
}
