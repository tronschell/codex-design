import { z } from 'zod';
import type { DesignNode, DesignProject } from '../shared/types';
import { exportProjectBundle, safeCodeDocument, vectorDataUrl } from '../shared/export';
import { nodeInnerSize, nodePadding, visibleBounds } from '../shared/effects';
import { createShaderRenderer, shaderRuntimeOptions } from '../shared/shaders';
import { designSystemMarkdown, tokenCssVariables } from '../shared/design-system';
import { canvasMapLayout, canvasMapPngReason, exportCanvasMap, exportFilename, exportHandoffPrompt, exportTargetHtml, exportTargetProject, exportTargetReact, exportTargetSvg, type CanvasMapSettings, type ExportFormat, type ExportTarget } from '../shared/export-formats';
import { ASSET_MIME_TYPES, MAX_ASSET_BYTES, assetFilename, isAssetRef, projectAssetRefs, type AssetMetadata } from '../shared/media';
import { MAX_INPUT_BYTES, projectSchema, projectImportSchema, designLibrarySchema } from '../shared/validation';
import { exportLibrary, libraryProject, libraryReferenceFiles } from '../shared/library-export';
import { MAX_ARCHIVE_BYTES, unzipFiles, zipFiles, type ArchiveFiles } from '../shared/zip';
import { client } from './client';

export interface ExportText { label: string; text: string }
export interface ExportFile { name: string; data: string | Uint8Array; mimeType: string }
type LoadedAsset = { asset: AssetMetadata; bytes: Uint8Array };
const utf8 = new TextDecoder('utf-8', { fatal: true });

async function loadAssets(project: DesignProject, includeInspiration = true, signal?: AbortSignal, maxBytes = MAX_ARCHIVE_BYTES - MAX_INPUT_BYTES): Promise<LoadedAsset[]> {
  const assets: LoadedAsset[] = [];
  let total = 0;
  const document = includeInspiration ? project : { ...project, boards: project.boards.map(board => ({ ...board, inspiration: undefined })) };
  for (const ref of projectAssetRefs(document)) {
    const item = await client.readAsset(ref, signal);
    total += item.bytes.byteLength;
    if (total > maxBytes) throw new Error(`This scope contains more than ${Math.floor(maxBytes / 1024 / 1024)} MiB of media. Export a smaller scope.`);
    assets.push(item);
  }
  return assets;
}

function dataUrl({ asset, bytes }: LoadedAsset, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const reader = new FileReader();
    const abort = () => reader.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    reader.onabort = () => { cleanup(); reject(signal?.reason ?? new DOMException('Export cancelled.', 'AbortError')); };
    reader.onerror = () => { cleanup(); reject(new Error(`Could not prepare media ${asset.name} for export.`)); };
    reader.onload = () => { cleanup(); resolve(String(reader.result)); };
    signal?.addEventListener('abort', abort, { once: true });
    try { reader.readAsDataURL(new Blob([bytes.buffer as ArrayBuffer], { type: asset.mimeType })); }
    catch (error) { cleanup(); reject(error); }
  });
}

async function embeddedAssetUrls(project: DesignProject, signal?: AbortSignal, maxBytes?: number) {
  const urls: Record<string, string> = {};
  for (const item of await loadAssets(project, false, signal, maxBytes)) urls[item.asset.ref] = await dataUrl(item, signal);
  return urls;
}

function loadExportImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const image = new Image(), timer = setTimeout(() => finish(new Error('An export image took too long to render. Export a smaller scope.')), 30_000);
    const abort = () => finish(signal?.reason ?? new DOMException('Export cancelled.', 'AbortError'));
    const finish = (error?: unknown) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null;
      if (error) { image.src = ''; reject(error); } else resolve(image);
    };
    image.onload = () => finish(); image.onerror = () => finish(new Error('The browser could not render an embedded image or HTML source layer. Try SVG canvas map or a source export.'));
    signal?.addEventListener('abort', abort, { once: true }); image.src = url;
  });
}

async function rasterizeMapSvg(svg: string, width: number, height: number, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  signal?.throwIfAborted();
  if (new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')) throw new Error('The export contains HTML that cannot be represented as SVG. Use HTML or Source ZIP to retain it.');
  const image = await loadExportImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, signal);
  signal?.throwIfAborted();
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The browser could not allocate the PNG canvas. Choose a lower scale or a smaller scope.');
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  } catch (error) { canvas.width = canvas.height = 0; throw error; }
  finally { image.src = ''; }
}

function canvasPng(canvas: HTMLCanvasElement, name: string): string {
  const png = canvas.toDataURL('image/png');
  if (!png.startsWith('data:image/png;')) throw new Error(`“${name}” exceeds this browser's canvas limits. Choose a lower scale or a smaller scope.`);
  return png;
}

function passiveSourceSvg(node: DesignNode, project: DesignProject, width: number, height: number): string {
  const source = new DOMParser().parseFromString(safeCodeDocument(node.source ?? '', project.designSystem), 'text/html');
  if (source.querySelector('iframe,object,embed')) throw new Error(`“${node.name}” contains an embedded document. Use HTML or Source ZIP to preserve that source.`);
  if (source.querySelector('video,audio')) throw new Error(`“${node.name}” contains source media. Use a native image/video layer or HTML / Source ZIP to preserve it.`);
  source.querySelectorAll('script,iframe,object,embed,link,base,meta,animate,animateTransform,animateMotion,set').forEach(element => element.remove());
  const resource = (url: string) => /^(?:data:|#|$)/i.test(url.trim());
  for (const element of source.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (/^on/.test(name) || name === 'srcdoc' || name === 'action' || name === 'formaction') element.removeAttribute(attribute.name);
      else if (name === 'srcset' && attribute.value) throw new Error(`“${node.name}” uses responsive source images. Use HTML or Source ZIP to preserve that source.`);
      else if (['src', 'href', 'xlink:href', 'poster'].includes(name) && !resource(attribute.value)) {
        if (element.localName === 'a') element.removeAttribute(attribute.name);
        else throw new Error(`“${node.name}” refers to an external source resource. Embed its images and fonts before exporting a canvas map.`);
      }
    }
  }
  const css = [...source.querySelectorAll('style')].map(style => style.textContent ?? '').concat([...source.querySelectorAll('[style]')].map(element => element.getAttribute('style') ?? '')).join('\n');
  if (/@import\b/i.test(css) || [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gis)].some(match => !resource(match[2]))) throw new Error(`“${node.name}” uses external CSS resources. Embed its images and fonts, or use HTML / Source ZIP.`);
  const freeze = source.createElement('style'); freeze.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'; source.head.append(freeze);
  const markup = new XMLSerializer().serializeToString(source.documentElement);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
}

function videoStill(node: DesignNode, src: string, width: number, height: number, scale: number, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
    const timer = setTimeout(() => finish(new Error(`“${node.name}” did not provide a video frame. Add a poster, or use HTML / Source ZIP.`)), 20_000);
    const abort = () => finish(signal?.reason ?? new DOMException('Export cancelled.', 'AbortError'));
    const finish = (error?: unknown, result?: string) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); video.onloadeddata = null; video.onerror = null; video.pause(); video.removeAttribute('src'); video.load();
      if (error) reject(error); else resolve(result!);
    };
    video.onerror = () => finish(new Error(`“${node.name}” could not be decoded by this browser. Add a video poster or use a source export.`));
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      try {
        const context = canvas.getContext('2d'); if (!context) throw new Error('The browser could not allocate a video still. Choose a lower scale.');
        const fit = node.styles.objectFit ?? node.media?.fit ?? 'cover';
        const contain = Math.min(width / video.videoWidth, height / video.videoHeight);
        const ratio = fit === 'contain' ? contain : fit === 'none' ? scale : fit === 'scale-down' ? Math.min(scale, contain) : Math.max(width / video.videoWidth, height / video.videoHeight);
        const w = fit === 'fill' ? width : video.videoWidth * ratio, h = fit === 'fill' ? height : video.videoHeight * ratio;
        context.drawImage(video, (width - w) / 2, (height - h) / 2, w, h); finish(undefined, canvasPng(canvas, node.name));
      } catch (error) { finish(error); }
      finally { canvas.width = canvas.height = 0; }
    };
    signal?.addEventListener('abort', abort, { once: true }); video.src = src; video.load();
  });
}

async function prepareCanvasMap(project: DesignProject, target: ExportTarget, map: CanvasMapSettings, signal?: AbortSignal) {
  const layout = canvasMapLayout(project, target, map);
  const mediaScope = { ...layout.project, designSystem: { ...layout.project.designSystem, components: [] }, pages: layout.pages.map(page => ({ ...page.page, nodes: page.nodes.filter(node => ['image', 'video'].includes(node.type) && (!page.included || page.included.has(node.id)) && !!visibleBounds(node, page.nodes)).map(node => node.type === 'video' && node.media?.poster ? { ...node, media: { ...node.media, src: node.media.poster } } : node) })) };
  const assetUrls = await embeddedAssetUrls(mediaScope, signal, 48 * 1024 * 1024), nodeImages: Record<string, string> = {};
  const stillRefs = new Set(layout.pages.flatMap(page => page.nodes.flatMap(node => node.type === 'image' ? [node.media?.src] : node.type === 'video' ? [node.media?.poster] : [])));
  let embeddedBytes = Object.entries(assetUrls).reduce((bytes, [ref, url]) => bytes + (stillRefs.has(ref) ? url.length : 0), 0);
  for (const page of layout.pages) for (const node of page.nodes) {
    signal?.throwIfAborted();
    if ((page.included && !page.included.has(node.id)) || !visibleBounds(node, page.nodes)) continue;
    const inner = nodeInnerSize(node), padding = node.styles.paddingX !== undefined || node.styles.paddingY !== undefined ? nodePadding(node) : { x: 0, y: 0 };
    const width = Math.max(1, inner.width - padding.x * 2), height = Math.max(1, inner.height - padding.y * 2), pixelWidth = Math.ceil(width * layout.scale), pixelHeight = Math.ceil(height * layout.scale);
    if (node.type === 'code' && !vectorDataUrl(node.source ?? '')) {
      const reason = canvasMapPngReason({ pixelWidth, pixelHeight }); if (reason) throw new Error(`“${node.name}”: ${reason}`);
      const canvas = await rasterizeMapSvg(passiveSourceSvg(node, project, width, height), pixelWidth, pixelHeight, signal);
      try { nodeImages[node.id] = canvasPng(canvas, node.name); }
      catch (error) { if (error instanceof DOMException && error.name === 'SecurityError') throw new Error(`The browser cannot capture HTML in “${node.name}”. Use a source export or another browser.`); throw error; }
      finally { canvas.width = canvas.height = 0; }
    } else if (node.type === 'shader') {
      const canvas = document.createElement('canvas'); let failure = '';
      const renderer = createShaderRenderer(canvas, { ...shaderRuntimeOptions(node.shader), animate: false, capture: { width: pixelWidth, height: pixelHeight } }, message => { failure = message; });
      try { if (failure) throw new Error(`“${node.name}”: ${failure}`); nodeImages[node.id] = canvasPng(canvas, node.name); }
      finally { renderer.dispose(); canvas.width = canvas.height = 0; }
    } else if (node.type === 'video' && !node.media?.poster) {
      const reason = canvasMapPngReason({ pixelWidth, pixelHeight }); if (reason) throw new Error(`“${node.name}”: ${reason}`);
      nodeImages[node.id] = await videoStill(node, assetUrls[node.media?.src ?? ''] ?? '', pixelWidth, pixelHeight, layout.scale, signal);
    }
    embeddedBytes += nodeImages[node.id]?.length ?? 0;
    if (embeddedBytes > 64 * 1024 * 1024) throw new Error('This canvas map exceeds 64 MiB of embedded images and stills. Export a smaller scope or a lower scale.');
  }
  signal?.throwIfAborted();
  return exportCanvasMap(project, target, map, { assetUrls, nodeImages });
}

export async function exportTexts(project: DesignProject, target: ExportTarget, format: ExportFormat, signal?: AbortSignal, map: CanvasMapSettings = {}): Promise<ExportText[]> {
  signal?.throwIfAborted();
  if (format === 'svg') return [{ label: 'SVG', text: exportTargetSvg(project, target) }];
  if (format === 'svg-map') return [{ label: 'SVG', text: (await prepareCanvasMap(project, target, map, signal)).svg }];
  if (format !== 'react' && format !== 'html') throw new Error('This format is available as a file download.');
  const scoped = exportTargetProject(project, target), options = { assetUrls: await embeddedAssetUrls(scoped, signal) };
  signal?.throwIfAborted();
  if (format === 'html') return [{ label: 'HTML', text: exportTargetHtml(project, target, options) }];
  const generated = exportTargetReact(project, target, options);
  return [{ label: 'React', text: generated.jsx }, { label: 'CSS', text: generated.css }];
}

export async function exportFile(project: DesignProject, target: ExportTarget, format: ExportFormat, signal?: AbortSignal, map: CanvasMapSettings = {}): Promise<ExportFile> {
  signal?.throwIfAborted();
  const scoped = exportTargetProject(project, target), scopeName = target.scope === 'selection' ? scoped.pages[0]?.nodes.find(node => node.id === target.nodeIds?.[0])?.name : target.scope === 'page' ? scoped.pages[0]?.name : target.scope === 'board' ? scoped.boards[0]?.name : 'project';
  const name = exportFilename(`${project.name}-${scopeName ?? target.scope}`);
  if (format === 'html' || format === 'svg') {
    const [source] = await exportTexts(project, target, format, signal);
    return { name: `${name}.${format}`, data: source.text, mimeType: format === 'svg' ? 'image/svg+xml' : 'text/html' };
  }
  if (format === 'png' || format === 'svg-map') {
    const layout = canvasMapLayout(project, target, map), reason = format === 'png' ? canvasMapPngReason(layout) : null;
    if (reason) throw new Error(reason);
    const generated = await prepareCanvasMap(project, target, map, signal);
    if (format === 'svg-map') return { name: `${name}-canvas.svg`, data: generated.svg, mimeType: 'image/svg+xml' };
    const canvas = await rasterizeMapSvg(generated.svg, generated.pixelWidth, generated.pixelHeight, signal);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed. Choose a lower scale or SVG canvas map.')), 'image/png'));
      signal?.throwIfAborted();
      return { name: `${name}-canvas-${map.scale ?? 2}x.png`, data: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/png' };
    } catch (error) { if (error instanceof DOMException && error.name === 'SecurityError') throw new Error('This browser does not support HTML/CSS canvas capture. Download SVG canvas map or use another browser.'); throw error; }
    finally { canvas.width = canvas.height = 0; }
  }
  const assets = await loadAssets(scoped, format !== 'react', signal);
  signal?.throwIfAborted();
  const assetUrls: Record<string, string> = {}, files: ArchiveFiles = {};
  const manifestAssets = assets.map(({ asset, bytes }) => {
    const path = `assets/${assetFilename(asset)}`;
    assetUrls[asset.ref] = path; files[path] = bytes;
    return { ...asset, path };
  });
  if (format === 'react') {
    Object.assign(files, exportTargetReact(project, target, { assetUrls }).files);
  } else {
    Object.assign(files, format === 'source' ? exportProjectBundle(scoped, { assetUrls }).files : { 'design.json': JSON.stringify(scoped, null, 2) });
    if (target.scope === 'selection') files['original-scope.json'] = JSON.stringify(exportTargetProject(project, target, { originalSelectionLayout: true }), null, 2);
    if (format === 'source') {
      if (target.scope === 'selection') {
        files['selection.html'] = exportTargetHtml(project, target, { assetUrls });
        Object.assign(files, exportTargetReact(project, target, { assetUrls }).files);
      } else {
        scoped.pages.forEach((page, index) => {
          const directory = `react/${index + 1}-${exportFilename(page.name)}`;
          const relativeAssets = Object.fromEntries(Object.entries(assetUrls).map(([ref, path]) => [ref, `../../${path}`]));
          const generated = exportTargetReact(scoped, { scope: 'page', pageId: page.id, boardId: page.boardId }, { assetUrls: relativeAssets });
          for (const [path, source] of Object.entries(generated.files)) files[`${directory}/${path}`] = source;
        });
      }
    }
  }
  files['DESIGN.md'] = designSystemMarkdown(project.designSystem);
  files['tokens.css'] = tokenCssVariables(project.designSystem);
  if (format === 'source' || format === 'react') Object.assign(files, libraryReferenceFiles(project, { assetUrls }));
  files['manifest.json'] = JSON.stringify({ format: 'codex-design-archive', version: 1, kind: format, projectId: project.id, revision: project.revision, target, assets: manifestAssets }, null, 2);
  files['BUILD_WITH_CODEX.md'] = `${exportHandoffPrompt(project, target)}\n`;
  const notes = `\n\n## Portable media and editable source\n\nMedia bytes are included in assets/ and described in manifest.json. Import this unmodified ZIP through the project menu to restore its design.json and media as a new project. React files use the included design.css; import Design.jsx into an existing React app. Their fixed canvas coordinates preserve the approved visual design; application behavior still needs implementation. HTML code layers remain script-free, network-blocked sandboxed iframes. Shader layers run only the included controlled WebGL renderer. Video playback is subject to browser codec support and autoplay policy.\n\nExport scope: ${target.scope}. Revision: ${project.revision}. ${target.scope === 'selection' ? 'The editable document includes ancestor shells with frozen layout positions so omitted siblings do not reflow the selection. original-scope.json retains the original scoped node coordinates, layout settings and source context. selection.html and Design.jsx contain only the selected subtree.' : ''}\n`;
  files['README.md'] = `${files['README.md'] ?? `# ${project.name}\n\n${format === 'project' ? 'Editable Codex Design backup. Import this ZIP through the project menu.' : 'React and CSS implementation source.'}`}${notes}`;
  return { name: `${name}-${format === 'project' ? 'editable' : format}.zip`, data: zipFiles(files), mimeType: 'application/zip' };
}

export function downloadExport(file: ExportFile) {
  const data = typeof file.data === 'string' ? file.data : file.data.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([data], { type: file.mimeType }));
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function exportLibraryFile(project: DesignProject, componentId?: string, signal?: AbortSignal): Promise<ExportFile> {
  signal?.throwIfAborted();
  const portable = libraryProject(project, componentId), assets = await loadAssets(portable, false, signal);
  signal?.throwIfAborted();
  const files: ArchiveFiles = {}, assetUrls: Record<string, string> = {};
  const manifestAssets = assets.map(({ asset, bytes }) => {
    const path = `assets/${assetFilename(asset)}`;
    assetUrls[asset.ref] = path; files[path] = bytes;
    return { ...asset, path };
  });
  Object.assign(files, exportLibrary(project, { assetUrls }, componentId).files);
  files['manifest.json'] = JSON.stringify({ format: 'codex-design-archive', version: 1, kind: 'library', projectId: project.id, revision: project.revision, assets: manifestAssets }, null, 2);
  signal?.throwIfAborted();
  return { name: `${exportFilename(project.designSystem.name)}-${componentId ? 'component' : 'library'}.zip`, data: zipFiles(files), mimeType: 'application/zip' };
}

const archiveManifest = z.object({
  format: z.literal('codex-design-archive'), version: z.literal(1),
  assets: z.array(z.object({ ref: z.string().refine(isAssetRef), mimeType: z.enum(ASSET_MIME_TYPES), byteLength: z.number().int().min(1).max(MAX_ASSET_BYTES), name: z.string().max(500), path: z.string().min(1).max(256) }).strict()).max(10_000),
}).passthrough();

export async function importProjectFile(file: File): Promise<DesignProject> {
  const isZip = /\.zip$/i.test(file.name) || /(?:application\/zip|application\/x-zip-compressed)/i.test(file.type);
  if (file.size > (isZip ? MAX_ARCHIVE_BYTES : MAX_INPUT_BYTES)) throw new Error(isZip ? 'Project archives must be no larger than 256 MiB.' : 'Project JSON files must be no larger than 2 MiB.');
  if (!isZip) {
    let input: unknown;
    try { input = JSON.parse(await file.text()); } catch { throw new Error('The project JSON is unreadable. Choose a Codex Design project file.'); }
    const parsed = projectImportSchema.safeParse(input);
    if (!parsed.success) throw new Error(`Invalid project document: ${parsed.error.issues[0]?.message ?? 'Unknown structure'}`);
    return client.importProject(parsed.data);
  }
  const files = unzipFiles(new Uint8Array(await file.arrayBuffer()));
  if (!files['design.json']) throw new Error('This archive has no editable design.json. Choose an editable project or source ZIP.');
  if (files['design.json'].byteLength > MAX_INPUT_BYTES * 4) throw new Error('The editable document exceeds 8 MiB. Import a smaller scope.');
  let input: unknown, manifestInput: unknown;
  try { input = JSON.parse(utf8.decode(files['design.json'])); manifestInput = files['manifest.json'] ? JSON.parse(utf8.decode(files['manifest.json'])) : undefined; }
  catch { throw new Error('The archive contains an unreadable document or manifest. Export the project again.'); }
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid project document: ${parsed.error.issues[0]?.message ?? 'Unknown structure'}`);
  if (manifestInput && typeof manifestInput === 'object' && 'kind' in manifestInput && manifestInput.kind === 'library') {
    const manifest = archiveManifest.safeParse(manifestInput), libraryBytes = files['codex-design.library.json'];
    if (!manifest.success || !libraryBytes || libraryBytes.byteLength > MAX_INPUT_BYTES) throw new Error('This library needs its original version-1 manifest and editable JSON.');
    let libraryInput: unknown;
    try { libraryInput = JSON.parse(utf8.decode(libraryBytes)); }
    catch { throw new Error('The library JSON is unreadable. Export the library again.'); }
    const library = designLibrarySchema.safeParse(libraryInput);
    if (!library.success) throw new Error('This library format is unsupported or invalid. Use a version-1 Codex Design library.');
    if (JSON.stringify(library.data.project) !== JSON.stringify(parsed.data)) throw new Error('The library JSON and editable document disagree. Import an original library ZIP.');
  }
  if (new TextEncoder().encode(JSON.stringify(parsed.data)).byteLength > MAX_INPUT_BYTES) throw new Error('The normalized project document exceeds 2 MiB. Import a smaller scope.');
  const refs = projectAssetRefs(parsed.data);
  if (!refs.length) return client.importProject(parsed.data);
  const manifest = archiveManifest.safeParse(manifestInput);
  if (!manifest.success) throw new Error('The archive needs a valid media manifest. Import its original Codex Design ZIP.');
  const entries = new Map(manifest.data.assets.map(asset => [asset.ref, asset]));
  if (entries.size !== manifest.data.assets.length) throw new Error('The media manifest contains duplicate references.');
  // Validate every required binary before creating any assets or a project.
  const pending: { asset: typeof manifest.data.assets[number]; bytes: Uint8Array }[] = [];
  for (const ref of refs) {
    const asset = entries.get(ref), bytes = asset ? files[asset.path] : undefined;
    if (!asset || !bytes || asset.path !== `assets/${assetFilename(asset)}` || bytes.byteLength !== asset.byteLength) throw new Error(`The archive is missing or has damaged media for ${ref}. Export the project again.`);
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer as ArrayBuffer))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (`asset:${digest}` !== ref) throw new Error(`Media ${asset.name} does not match its saved content reference.`);
    pending.push({ asset, bytes });
  }
  for (const { asset, bytes } of pending) {
    const uploaded = await client.uploadAsset(new Blob([bytes.slice().buffer as ArrayBuffer], { type: asset.mimeType }), asset.name);
    if (uploaded.ref !== asset.ref) throw new Error(`Media ${asset.name} changed during import. The project was not created.`);
  }
  return client.importProject(parsed.data);
}
