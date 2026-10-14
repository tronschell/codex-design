import type { DesignProject } from './types.ts';

export const MAX_ASSET_BYTES = 32 * 1024 * 1024;
export const MAX_ASSET_CHUNK_BYTES = 1024 * 1024;
export const ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime'] as const;
export type AssetMimeType = typeof ASSET_MIME_TYPES[number];
export interface AssetMetadata { ref: string; mimeType: AssetMimeType; byteLength: number; name: string }
export interface AssetUpload { uploadId: string; offset: number; byteLength: number; asset?: AssetMetadata }
export interface AssetUploadCancellation { uploadId: string; cancelled: boolean }
export interface AssetChunk { ref: string; offset: number; byteLength: number; totalBytes: number; data: string }

export const ASSET_REF_PATTERN = /^asset:[a-f0-9]{64}$/;
export const isAssetRef = (value: unknown): value is string => typeof value === 'string' && ASSET_REF_PATTERN.test(value);

export function projectAssetRefs(project: DesignProject): string[] {
  return [...new Set([
    ...project.pages.flatMap(page => page.nodes.flatMap(node => [node.media?.src, node.media?.poster].filter(isAssetRef))),
    ...project.boards.flatMap(board => (board.inspiration ?? []).map(item => item.assetRef).filter(isAssetRef)),
  ])];
}

export function assetExtension(mimeType: AssetMimeType): string {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' })[mimeType];
}

export function assetFilename(asset: Pick<AssetMetadata, 'ref' | 'mimeType'>): string {
  if (!isAssetRef(asset.ref)) throw new Error('Invalid media asset reference.');
  return `${asset.ref.slice('asset:'.length)}.${assetExtension(asset.mimeType)}`;
}
