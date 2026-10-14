import { z } from 'zod';
import type { DesignProject } from '../shared/types';
import { exportProjectBundle } from '../shared/export';
import { designSystemMarkdown, tokenCssVariables } from '../shared/design-system';
import { exportFilename, exportHandoffPrompt, exportTargetHtml, exportTargetProject, exportTargetReact, exportTargetSvg, type ExportFormat, type ExportTarget } from '../shared/export-formats';
import { ASSET_MIME_TYPES, MAX_ASSET_BYTES, assetFilename, isAssetRef, projectAssetRefs, type AssetMetadata } from '../shared/media';
import { MAX_INPUT_BYTES, projectSchema } from '../shared/validation';
import { MAX_ARCHIVE_BYTES, unzipFiles, zipFiles, type ArchiveFiles } from '../shared/zip';
import { client } from './client';

export interface ExportText { label: string; text: string }
export interface ExportFile { name: string; data: string | Uint8Array; mimeType: string }
type LoadedAsset = { asset: AssetMetadata; bytes: Uint8Array };
const utf8 = new TextDecoder('utf-8', { fatal: true });

async function loadAssets(project: DesignProject, includeInspiration = true): Promise<LoadedAsset[]> {
  const assets: LoadedAsset[] = [];
  let total = 0;
  const document = includeInspiration ? project : { ...project, boards: project.boards.map(board => ({ ...board, inspiration: undefined })) };
  for (const ref of projectAssetRefs(document)) {
    const item = await client.readAsset(ref);
    total += item.bytes.byteLength;
    if (total > MAX_ARCHIVE_BYTES - MAX_INPUT_BYTES) throw new Error('This scope contains more than 254 MiB of media. Export a smaller scope.');
    assets.push(item);
  }
  return assets;
}

function dataUrl({ asset, bytes }: LoadedAsset): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not prepare media ${asset.name} for export.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: asset.mimeType }));
  });
}

async function embeddedAssetUrls(project: DesignProject) {
  const urls: Record<string, string> = {};
  for (const item of await loadAssets(project, false)) urls[item.asset.ref] = await dataUrl(item);
  return urls;
}

export async function exportTexts(project: DesignProject, target: ExportTarget, format: ExportFormat): Promise<ExportText[]> {
  if (format === 'svg') return [{ label: 'SVG', text: exportTargetSvg(project, target) }];
  if (format !== 'react' && format !== 'html') throw new Error('This format is available as a file download.');
  const scoped = exportTargetProject(project, target), options = { assetUrls: await embeddedAssetUrls(scoped) };
  if (format === 'html') return [{ label: 'HTML', text: exportTargetHtml(project, target, options) }];
  const generated = exportTargetReact(project, target, options);
  return [{ label: 'React', text: generated.jsx }, { label: 'CSS', text: generated.css }];
}

export async function exportFile(project: DesignProject, target: ExportTarget, format: ExportFormat): Promise<ExportFile> {
  const scoped = exportTargetProject(project, target), scopeName = target.scope === 'selection' ? scoped.pages[0]?.nodes.find(node => node.id === target.nodeIds?.[0])?.name : target.scope === 'page' ? scoped.pages[0]?.name : target.scope === 'board' ? scoped.boards[0]?.name : 'project';
  const name = exportFilename(`${project.name}-${scopeName ?? target.scope}`);
  if (format === 'html' || format === 'svg') {
    const [source] = await exportTexts(project, target, format);
    return { name: `${name}.${format}`, data: source.text, mimeType: format === 'svg' ? 'image/svg+xml' : 'text/html' };
  }
  if (format === 'png') throw new Error('PNG capture is not available. Choose a source format.');
  const assets = await loadAssets(scoped, format !== 'react'), assetUrls: Record<string, string> = {}, files: ArchiveFiles = {};
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
    const parsed = projectSchema.safeParse(input);
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
