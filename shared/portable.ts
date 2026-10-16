import { z } from 'zod';
import { MAX_ARCHIVE_BYTES, unzipFiles, zipFiles, type ArchiveFiles } from './zip';
import { assetFilename, ASSET_MIME_TYPES, isAssetRef, MAX_ASSET_BYTES, projectAssetRefs, type AssetMetadata } from './media';
import { MAX_DOCUMENT_BYTES, projectSchema } from './validation';
import type { DesignProject } from './types';

export const PROJECT_EXTENSION = 'cxdp';
export const PROJECT_MIME = 'application/vnd.codex-design.project+zip';
export type PortableAsset = {asset: AssetMetadata; bytes: Uint8Array};
const manifestSchema = z.object({
  format: z.literal('codex-design-project'), version: z.literal(1), kind: z.enum(['project','board','page','selection','library','component']),
  assets: z.array(z.object({ref: z.string().refine(isAssetRef), name: z.string().max(500), mimeType: z.enum(ASSET_MIME_TYPES), byteLength: z.number().int().min(1).max(MAX_ASSET_BYTES), path: z.string().min(1).max(256)}).strict()).max(10000),
}).passthrough();

export function portableFiles(project: DesignProject, assets: PortableAsset[], kind: z.infer<typeof manifestSchema>['kind'], extra: ArchiveFiles = {}): ArchiveFiles {
  const entries = assets.map(({asset})=>({...asset,path:`assets/${assetFilename(asset)}`}));
  return { ...extra, 'design.json': JSON.stringify(project,null,2),
    'manifest.json': JSON.stringify({format:'codex-design-project',version:1,kind,projectId:project.id,revision:project.revision,assets:entries},null,2),
    ...Object.fromEntries(assets.map(({bytes},index)=>[entries[index].path,bytes])) };
}
export function portableFile(project: DesignProject, assets: PortableAsset[], kind: z.infer<typeof manifestSchema>['kind'], extra: ArchiveFiles = {}) {
  return zipFiles(portableFiles(project,assets,kind,extra));
}

// Validate all media before uploading anything or creating a project. No archive paths are extracted to disk.
export async function readPortable(bytes: Uint8Array): Promise<{project: DesignProject; assets: PortableAsset[]}> {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('Portable projects are limited to 256 MiB.');
  const files = unzipFiles(bytes), decode = new TextDecoder('utf-8',{fatal:true});
  if (!files['manifest.json'] || files['manifest.json'].byteLength > 8 * 1024 * 1024 || !files['design.json'] || files['design.json'].byteLength > MAX_DOCUMENT_BYTES * 4) throw new Error('The portable file is missing its manifest or editable document, or exceeds the document size limit.');
  const manifest = manifestSchema.parse(JSON.parse(decode.decode(files['manifest.json'])));
  const project = projectSchema.parse(JSON.parse(decode.decode(files['design.json'])));
  if (new TextEncoder().encode(JSON.stringify(project)).byteLength > MAX_DOCUMENT_BYTES) throw new Error('The portable project exceeds the document size limit.');
  const entries = new Map(manifest.assets.map(asset=>[asset.ref,asset]));
  if (entries.size !== manifest.assets.length) throw new Error('The portable manifest contains duplicate media.');
  const assets: PortableAsset[]=[];
  for (const ref of projectAssetRefs(project)) {
    const entry=entries.get(ref), data=entry ? files[entry.path] : undefined;
    if (!entry || !data || entry.path !== `assets/${assetFilename(entry)}` || data.byteLength !== entry.byteLength) throw new Error(`Missing or damaged portable media: ${ref}`);
    // Copy: a Node Buffer's slice() is a view, so its .buffer would hash the whole archive.
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(data).buffer)),b=>b.toString(16).padStart(2,'0')).join('');
    if (`asset:${hash}` !== ref) throw new Error(`Media checksum does not match: ${entry.name}`);
    const {path:_path,...asset}=entry; assets.push({asset,bytes:data});
  }
  return {project,assets};
}
