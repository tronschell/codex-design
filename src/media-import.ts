import { ASSET_MIME_TYPES, MAX_ASSET_BYTES, type AssetMimeType } from '../shared/media';

const extensions: Record<string, AssetMimeType> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
export const mediaAccept = [...ASSET_MIME_TYPES, ...Object.keys(extensions).map(extension => `.${extension}`)].join(',');

export function mediaFile(file: File): File {
  const mimeType = ASSET_MIME_TYPES.find(type => type === file.type.toLowerCase()) || extensions[file.name.split('.').at(-1)?.toLowerCase() || ''];
  if (!mimeType) throw new Error('Choose a PNG, JPEG, WebP, GIF, SVG, MP4, WebM or MOV file.');
  if (!file.size || file.size > MAX_ASSET_BYTES) throw new Error(`${file.name}: media files must be between 1 byte and 32 MiB.`);
  return file.type === mimeType ? file : new File([file], file.name, { type: mimeType });
}

export function mediaDimensions(file: File, signal?: AbortSignal): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Media import cancelled.', 'AbortError')); return; }
    const url = URL.createObjectURL(file), video = file.type.startsWith('video/');
    const element = video ? document.createElement('video') : new Image();
    const cleanup = () => {
      clearTimeout(timeout); signal?.removeEventListener('abort', abort); element.onload = null; element.onerror = null;
      if (element instanceof HTMLVideoElement) { element.onloadedmetadata = null; element.removeAttribute('src'); element.load(); }
      if (element instanceof HTMLImageElement) element.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    const abort = () => { cleanup(); reject(new DOMException('Media import cancelled.', 'AbortError')); };
    const fail = () => { cleanup(); reject(new Error(`Cannot read ${file.name}. Choose an image or a video format supported by this browser.`)); };
    const ready = () => {
      const width = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
      const height = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;
      cleanup();
      if (!width || !height || width * height > 32_000_000) { reject(new Error(`${file.name}: choose media with dimensions below 32 megapixels.`)); return; }
      resolve({ width, height });
    };
    const timeout = setTimeout(fail, 15_000);
    signal?.addEventListener('abort', abort, { once: true });
    element.onerror = fail;
    if (element instanceof HTMLVideoElement) { element.preload = 'metadata'; element.onloadedmetadata = ready; }
    else element.onload = ready;
    element.src = url;
  });
}
