import { memo, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Video } from 'lucide-react';
import type { DesignNode } from '../shared/types';
import { isAssetRef } from '../shared/media';
import { client } from './client';

type AssetUrl = { users: number; promise: Promise<string>; url?: string };
const assetUrls = new Map<string, AssetUrl>();

function acquireAssetUrl(ref: string) {
  let entry = assetUrls.get(ref);
  if (!entry) {
    const pending: AssetUrl = { users: 0, promise: Promise.resolve('') };
    pending.promise = client.readAsset(ref).then(({ asset, bytes }) => {
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: asset.mimeType }));
      pending.url = url;
      if (!pending.users) { URL.revokeObjectURL(url); if (assetUrls.get(ref) === pending) assetUrls.delete(ref); }
      return url;
    }, error => { if (assetUrls.get(ref) === pending) assetUrls.delete(ref); throw error; });
    entry = pending; assetUrls.set(ref, entry);
  }
  entry.users++;
  return { promise: entry.promise, release() {
    entry.users--;
    if (!entry.users && entry.url) { URL.revokeObjectURL(entry.url); if (assetUrls.get(ref) === entry) assetUrls.delete(ref); }
  } };
}

function useAssetSource(ref?: string) {
  const [state, setState] = useState({ ref, url: '', error: '' });
  useEffect(() => {
    setState({ ref, url: '', error: '' });
    if (!ref) return;
    if (!isAssetRef(ref)) { setState({ ref, url: '', error: 'Import a local file to use it on the canvas.' }); return; }
    let active = true;
    const asset = acquireAssetUrl(ref);
    void asset.promise.then(url => { if (active) setState({ ref, url, error: '' }); }, error => {
      if (active) setState({ ref, url: '', error: error instanceof Error ? error.message : 'This asset could not be loaded. Import the file again.' });
    });
    return () => { active = false; asset.release(); };
  }, [ref]);
  return state.ref === ref ? state : { ref, url: '', error: '' };
}

export default memo(function MediaNode({ node, preview = false }: { node: DesignNode; preview?: boolean }) {
  const source = useAssetSource(node.media?.src), poster = useAssetSource(node.type === 'video' ? node.media?.poster : undefined);
  const video = useRef<HTMLVideoElement>(null);
  const [decodeError, setDecodeError] = useState('');
  useEffect(() => { setDecodeError(''); }, [source.url]);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = typeof IntersectionObserver === 'undefined', attemptedAutoplay = false;
    const sync = () => {
      if (!preview || !visible || document.hidden || motion.matches) { element.pause(); return; }
      if (node.media?.autoplay && !attemptedAutoplay) { attemptedAutoplay = true; void element.play().catch(() => { /* Native controls remain available when autoplay is blocked. */ }); }
    };
    const playing = () => { if (!preview || !visible || document.hidden) element.pause(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0); sync(); });
    observer?.observe(element); document.addEventListener('visibilitychange', sync); motion.addEventListener('change', sync); element.addEventListener('play', playing);
    sync();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); motion.removeEventListener('change', sync); element.removeEventListener('play', playing); element.pause(); };
  }, [source.url, node.media?.autoplay, preview]);
  const error = source.error || decodeError;
  const style = { objectFit: node.styles.objectFit ?? node.media?.fit ?? 'cover', ...(preview ? {pointerEvents:node.styles.pointerEvents??'auto'} : {}) } as const;
  const Icon = node.type === 'video' ? Video : ImageIcon;
  return <>
    {source.url && (node.type === 'video' ? <video ref={video} className={`design-media${preview ? ' is-preview' : ''}`} src={source.url} poster={poster.url || undefined} style={style} controls={preview} playsInline preload="metadata" muted={node.media?.muted !== false} loop={node.media?.loop === true} tabIndex={preview ? 0 : -1} aria-label={node.media?.alt ?? node.name} onError={() => setDecodeError('This browser cannot decode the video. Import an MP4 or WebM file.')} /> : <img className="design-media" src={source.url} style={style} alt={node.media?.alt ?? node.name} draggable={false} onError={() => setDecodeError('This image could not be decoded. Import the file again.')} />)}
    {(error || !source.url) && <div className={`design-media-status${error ? ' is-error' : ''}`} role="status" title={error || undefined}><Icon size={20} aria-hidden="true"/><strong>{error ? 'Media unavailable' : node.media?.src ? 'Loading…' : node.type === 'video' ? 'Video' : 'Image'}</strong>{error && <span>{error}</span>}</div>}
    {!error && source.url && poster.error && <span className="design-media-caption" role="status" title={poster.error}>Poster unavailable</span>}
  </>;
});
