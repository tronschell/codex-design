import { canvasMapLayout, canvasMapPngReason, type CanvasMapSettings, type ExportTarget } from './export-formats';
import type { DesignProject } from './types';
import { crc32 } from './zip';

export interface ImageExportSettings extends CanvasMapSettings { width?: number; height?: number; dpi?: number; quality?: number }
export function imageExportDetails(project: DesignProject, target: ExportTarget, format: 'png' | 'jpeg', settings: ImageExportSettings = {}) {
  const layout = canvasMapLayout(project, target, settings);
  const dpi = settings.dpi ?? 96, quality = settings.quality ?? 90;
  if (!Number.isInteger(dpi) || dpi < 1 || dpi > 2400) throw new Error('DPI must be an integer from 1 to 2,400.');
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new Error('JPEG quality must be from 1 to 100.');
  for (const size of [settings.width, settings.height]) if (size !== undefined && (!Number.isInteger(size) || size < 1 || size > 16384)) throw new Error('Image dimensions must be whole pixels from 1 to 16,384.');
  const width = settings.width ?? (settings.height ? Math.max(1, Math.round(settings.height * layout.width / layout.height)) : layout.pixelWidth);
  const height = settings.height ?? (settings.width ? Math.max(1, Math.round(settings.width * layout.height / layout.width)) : layout.pixelHeight);
  const reason = canvasMapPngReason({pixelWidth: width, pixelHeight: height});
  if (reason) throw new Error(reason);
  // Explicit dimensions fit the artwork without stretching, leaving background padding when ratios differ.
  const scale = Math.min(width / layout.width, height / layout.height);
  const pixels = width * height;
  return { width, height, dpi, quality, scale, printWidth: width / dpi, printHeight: height / dpi,
    estimatedMinBytes: Math.ceil(pixels * (format === 'png' ? 0.02 : 0.02 + quality / 5000)),
    estimatedMaxBytes: Math.ceil(pixels * (format === 'png' ? 4 : 0.5 + quality / 50)),
    estimateMethod: 'Heuristic range from pixel count and format; content and compression determine actual size.',
    background: format === 'jpeg' && layout.background === 'transparent' ? '#ffffff' : layout.background };
}

export function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

// PNG pHYs stores pixels/metre; JPEG JFIF stores dots/inch. DPI never resamples the image.
export function imageDpi(bytes: Uint8Array, format: 'png' | 'jpeg', dpi: number): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(dpi) || dpi < 1 || dpi > 2400) throw new Error('Invalid export DPI.');
  if (format === 'jpeg') {
    if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Invalid JPEG output.');
    const result = bytes.slice();
    for (let at = 2; at + 4 <= result.length;) {
      if (result[at] !== 255 || result[at + 1] === 218 || result[at + 1] === 217) break;
      const length = result[at + 2] * 256 + result[at + 3];
      if (length < 2 || at + length + 2 > result.length) throw new Error('Invalid JPEG metadata.');
      if (result[at + 1] === 224 && length >= 16 && new TextDecoder().decode(result.subarray(at + 4, at + 9)) === 'JFIF\0') {
        result[at + 11] = 1;
        new DataView(result.buffer).setUint16(at + 12, dpi); new DataView(result.buffer).setUint16(at + 14, dpi);
        return result;
      }
      at += length + 2;
    }
    const jfif = new Uint8Array([255,224,0,16,74,70,73,70,0,1,2,1,dpi >> 8,dpi & 255,dpi >> 8,dpi & 255,0,0]);
    const output = new Uint8Array(bytes.length + jfif.length); output.set(bytes.subarray(0,2)); output.set(jfif,2); output.set(bytes.subarray(2),20); return output;
  }
  if (bytes.length < 33 || bytes[0] !== 137 || new TextDecoder().decode(bytes.subarray(1,4)) !== 'PNG') throw new Error('Invalid PNG output.');
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer), ppm = Math.round(dpi / 0.0254);
  view.setUint32(0,9); chunk.set([112,72,89,115],4); view.setUint32(8,ppm); view.setUint32(12,ppm); chunk[16] = 1; view.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts: Uint8Array[] = [bytes.subarray(0,8)];
  const input = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for (let at = 8; at < bytes.length;) {
    if (at + 12 > bytes.length) throw new Error('Invalid PNG chunk.');
    const end = at + input.getUint32(at) + 12;
    if (end > bytes.length) throw new Error('Invalid PNG chunk length.');
    const name = new TextDecoder().decode(bytes.subarray(at+4,at+8));
    if (name !== 'pHYs') parts.push(bytes.subarray(at,end));
    if (name === 'IHDR') parts.push(chunk);
    at = end;
  }
  const output = new Uint8Array(parts.reduce((size,part)=>size+part.length,0)); let offset=0;
  for (const part of parts) { output.set(part,offset); offset+=part.length; } return output;
}
