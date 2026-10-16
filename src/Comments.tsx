import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CheckCheck, Copy, Eye, EyeOff, Image as ImageIcon, LoaderCircle, MessageCircle, Paperclip, X } from 'lucide-react';
import type { CommentThread, DesignProject } from '../shared/types';
import { commentPrompt } from '../shared/comments';
import { useLocalDraft } from './useLocalDraft';
import { COMMENT_IMAGE_MIME_TYPES, MAX_COMMENT_IMAGES, MAX_COMMENT_IMAGE_BYTES, type CommentAttachment } from '../shared/media';
import { commentAttachmentSchema } from '../shared/validation';
import { client } from './client';
import { mediaDimensions, mediaFile } from './media-import';
import { useAssetSource } from './MediaNode';
import ChatGptLogo from './ChatGptLogo';

const imageAccept = [...COMMENT_IMAGE_MIME_TYPES, '.png', '.jpg', '.jpeg', '.webp', '.gif'].join(',');

export type CommentTarget = { nodeId: string | null; x: number; y: number; threadId?: string };
export function CommentList({ project, showPins, onTogglePins, onOpen, onClose }: { project: DesignProject; showPins: boolean; onTogglePins: () => void; onOpen: (thread: CommentThread) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, []);
  const conversations = useMemo(() => {
    const pages = new Map(project.pages.map(page => [page.id, { page, nodes: new Map(page.nodes.map(node => [node.id, node.name])) }]));
    const boards = new Map(project.boards.map(board => [board.id, board.name]));
    return project.threads.map(thread => {
      const location = pages.get(thread.pageId), first = thread.messages[0], latest = thread.messages.at(-1);
      const context = [location && boards.get(location.page.boardId || ''), location?.page.name, thread.nodeId && location?.nodes.get(thread.nodeId)].filter(Boolean).join(' › ');
      return { thread, first, latest, context: context || 'Canvas conversation', available: !!location, reply: thread.messages.filter(message => message.role === 'assistant').at(-1) };
    }).sort((a, b) => (Date.parse(b.latest?.createdAt || b.thread.createdAt) || 0) - (Date.parse(a.latest?.createdAt || a.thread.createdAt) || 0) || a.thread.id.localeCompare(b.thread.id));
  }, [project]);
  return <div ref={panel} id="all-comments" className="dropdown comment-list" role="dialog" aria-labelledby="all-comments-title" tabIndex={-1} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onClose(); } }}>
    <header><h2 id="all-comments-title">All comments <span>{conversations.length}</span></h2><button className="icon-button" aria-label="Show comment pins" title={showPins ? 'Hide comment pins' : 'Show comment pins'} aria-pressed={showPins} onClick={onTogglePins}>{showPins ? <Eye size={15}/> : <EyeOff size={15}/>}</button><button className="icon-button" aria-label="Close comments list" onClick={onClose}><X size={16}/></button></header>
    <div className="comment-list-scope">{project.name} · All boards</div>
    <div className="comment-list-scroll">{(['open', 'resolved'] as const).map(status => {
      const items = conversations.filter(item => item.thread.status === status);
      return <section className="comment-list-group" key={status} aria-labelledby={`comments-${status}`}><h3 id={`comments-${status}`}>{status === 'open' ? 'Open' : 'Resolved'} <span>{items.length}</span></h3>{items.length ? items.map(({ thread, first, latest, context, available, reply }) => <button key={thread.id} className={`comment-list-item ${status}`} disabled={!available} onClick={() => onOpen(thread)}>
        <span className="comment-list-byline"><span className={`message-avatar ${first?.role || 'user'}`} aria-hidden="true">{first?.role === 'assistant' ? <ChatGptLogo/> : 'Y'}</span><strong>{first?.role === 'assistant' ? 'Codex' : 'You'}</strong><time dateTime={latest?.createdAt || thread.createdAt} title={`Last activity · ${new Date(latest?.createdAt || thread.createdAt).toLocaleString()}`}>{new Date(latest?.createdAt || thread.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>{reply && <ChatGptLogo size={13} label="Includes a Codex message"/>}{status === 'resolved' && <CheckCheck className="comment-list-resolved" size={15} aria-label="Resolved"/>}</span>
        <span className="comment-list-context" title={context}>{context}</span><span className="comment-list-message">{first?.content || 'Empty conversation'}</span>
        {status === 'resolved' && reply && reply.id !== first?.id && <span className="comment-list-reply"><strong><ChatGptLogo size={12}/>Codex</strong><span>{reply.content}</span></span>}
        <span className="comment-list-meta"><span>{thread.messages.length > 1 ? `${thread.messages.length - 1} ${thread.messages.length === 2 ? 'reply' : 'replies'}` : 'Open conversation'}</span>{thread.queued && <span className="comment-list-queued">Queued for Codex</span>}{!available && <span>Page unavailable</span>}</span>
      </button>) : <p className="comment-list-empty">{status === 'open' ? 'No open conversations.' : 'No resolved conversations.'}</p>}</section>;
    })}</div>
  </div>;
}

function CommentImage({ attachment, onRemove, disabled }: { attachment: CommentAttachment; onRemove?: () => void; disabled?: boolean }) {
  const source = useAssetSource(attachment.ref);
  return <div className="tw:relative tw:w-[88px] tw:shrink-0" title={source.error || attachment.name}>
    <div className="tw:flex tw:h-16 tw:items-center tw:justify-center tw:overflow-hidden tw:rounded-md tw:border tw:border-[#494949] tw:bg-[#202020]">
      {source.url ? <img src={source.url} alt={attachment.name} className="tw:h-full tw:w-full tw:object-contain" draggable={false}/> : <ImageIcon size={18} aria-label={source.error ? 'Image unavailable' : 'Loading image'}/>}
    </div>
    <span className="tw:block tw:truncate tw:pt-1 tw:text-[10px] tw:text-[#aaa]">{attachment.name}</span>
    {onRemove && <button type="button" className="tw:absolute tw:-top-1 tw:-right-1 tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-[#555] tw:bg-[#333] tw:p-0 tw:text-white tw:hover:bg-[#444] tw:disabled:opacity-50" disabled={disabled} aria-label={`Remove ${attachment.name}`} onClick={onRemove}><X size={12}/></button>}
  </div>;
}

export default function CommentPopover({ project, target, pageId, position, onClose, onSend, onResolve, onCopy }: { project: DesignProject; target: CommentTarget; pageId: string; position: { left: number; top: number }; onClose: () => void; onSend: (content: string, attachments: CommentAttachment[]) => Promise<boolean>; onResolve: (thread: CommentThread) => Promise<boolean>; onCopy: (text: string) => void }) {
  const local = useLocalDraft(`${project.id}/${pageId}/comment/${target.threadId || target.nodeId || `${target.x},${target.y}`}`, { message: '', attachments: '[]' });
  const draft = local.value.message;
  const attachments = useMemo(() => {
    try { const parsed = commentAttachmentSchema.array().max(MAX_COMMENT_IMAGES).safeParse(JSON.parse(local.value.attachments)); return parsed.success ? parsed.data : []; }
    catch { return []; }
  }, [local.value.attachments]);
  const savedAttachments = useRef(attachments); savedAttachments.current = attachments;
  const setAttachments = (value: CommentAttachment[]) => { savedAttachments.current = value; local.setValue({ attachments: JSON.stringify(value) }); };
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), [dragging, setDragging] = useState(false);
  const compose = useRef<HTMLTextAreaElement>(null), popover = useRef<HTMLDivElement>(null), picker = useRef<HTMLInputElement>(null);
  const uploading = useRef<AbortController | null>(null), sending = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; uploading.current?.abort(); }; }, []);
  useEffect(() => { if (!busy) compose.current?.focus({ preventScroll: true }); }, [target.nodeId, target.threadId, target.x, target.y, busy]);
  const thread = project.threads.find(t => t.id === target.threadId), page = project.pages.find(p => p.id === pageId), node = page?.nodes.find(n => n.id === target.nodeId);
  const parent = node?.parentId ? page?.nodes.find(n => n.id === node.parentId) : null;
  const attach = async (input: File[]) => {
    if (!input.length || uploading.current || sending.current) return;
    const controller = new AbortController(); uploading.current = controller; setError(''); compose.current?.focus({ preventScroll: true });
    try {
      if (savedAttachments.current.length + input.length > MAX_COMMENT_IMAGES) throw new Error(`Attach up to ${MAX_COMMENT_IMAGES} images per comment.`);
      const files = input.map(file => {
        const image = mediaFile(file);
        if (!(COMMENT_IMAGE_MIME_TYPES as readonly string[]).includes(image.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
        if (image.size > MAX_COMMENT_IMAGE_BYTES) throw new Error(`${image.name}: choose an image up to 10 MiB.`);
        return image;
      });
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1}/${files.length} · ${file.name}`);
        await mediaDimensions(file, controller.signal);
        const asset = await client.uploadAsset(file, file.name, (loaded, total) => {
          if (mounted.current && !controller.signal.aborted) setProgress(`Uploading ${index + 1}/${files.length} · ${Math.round(loaded / total * 100)}%`);
        }, controller.signal);
        controller.signal.throwIfAborted();
        const attachment = commentAttachmentSchema.parse(asset);
        if (!savedAttachments.current.some(item => item.ref === attachment.ref)) setAttachments([...savedAttachments.current, attachment]);
      }
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The image could not be uploaded. Try again.');
    } finally {
      if (uploading.current === controller) uploading.current = null;
      if (mounted.current) setProgress('');
    }
  };
  const submit = async () => {
    if ((!draft.trim() && !savedAttachments.current.length) || sending.current || uploading.current) return;
    sending.current = true; popover.current?.focus({ preventScroll: true }); setBusy(true); setError('');
    try {
      if (await onSend(draft.trim(), savedAttachments.current)) { local.setValue({ message: '', attachments: '[]' }); await local.flush(); }
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not send. Your draft is kept.'); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  const resolve = async () => {
    if (!thread || sending.current || uploading.current) return;
    sending.current = true; popover.current?.focus({ preventScroll: true }); setBusy(true);
    try { await onResolve(thread); }
    catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not update this conversation.'); }
    finally { sending.current = false; if (mounted.current) setBusy(false); }
  };
  const close = () => { uploading.current?.abort(); onClose(); };
  return <div ref={popover} tabIndex={-1} className={`comment-popover tw:overflow-y-auto! tw:overscroll-contain ${dragging ? 'tw:outline-2 tw:-outline-offset-2 tw:outline-[#6eafff]' : ''}`} role="dialog" aria-label="Component conversation" aria-busy={busy || !!progress} style={{ ...position, maxHeight: `calc(100% - ${position.top + 12}px)` }} onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } }}
    onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = busy || uploading.current ? 'none' : 'copy'; setDragging(!busy && !uploading.current); } }}
    onDragLeave={e => { e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragging(false); void attach(Array.from(e.dataTransfer.files)); }}
    onPaste={e => { const files = Array.from(e.clipboardData.files); if (files.length) { e.preventDefault(); e.stopPropagation(); void attach(files); } }}>
    <header><span title={node?.name}>{parent?.name || node?.name || page?.name} {parent ? `› ${node?.name}` : '› conversation'}</span>{thread && <button className="icon-button" aria-label={thread.status === 'resolved' ? 'Reopen conversation' : 'Resolve conversation'} title={thread.status === 'resolved' ? 'Reopen conversation' : 'Resolve conversation'} disabled={busy || !!progress} onClick={() => { void resolve(); }}><CheckCheck size={17}/></button>}<button className="icon-button" aria-label="Close conversation" onClick={close}><X size={16}/></button></header>
    {thread && <div className="comment-messages">{thread.messages.map(message => <div className={`comment-message ${message.role}`} key={message.id}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <ChatGptLogo/> : 'Y'}</div><div><div className="message-byline"><strong>{message.role === 'assistant' ? 'Codex' : 'You'}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div><p>{message.content}</p>{!!message.attachments?.length && <div className="tw:flex tw:gap-2 tw:overflow-x-auto tw:py-1" aria-label="Attached images">{message.attachments.map(attachment => <CommentImage key={attachment.ref} attachment={attachment}/>)}</div>}</div></div>)}</div>}
    <div className="comment-compose"><div className="comment-compose-tools"><span className="mention">@Codex</span></div><textarea ref={compose} aria-label="Comment" disabled={busy} placeholder={thread ? 'Reply or ask for another change…' : 'What would you like to change?'} rows={3} value={draft} maxLength={20000} onChange={e => local.setValue({ message: e.target.value })} onBlur={local.onBlur} onCompositionStart={local.onCompositionStart} onCompositionEnd={local.onCompositionEnd} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); if (!e.repeat) void submit(); } }}/>
      {!!attachments.length && <div className="tw:flex tw:gap-2 tw:overflow-x-auto tw:pt-2 tw:pb-1" aria-label="Images to attach">{attachments.map(attachment => <CommentImage key={attachment.ref} attachment={attachment} disabled={busy || !!progress} onRemove={() => { setAttachments(savedAttachments.current.filter(item => item.ref !== attachment.ref)); setError(''); }}/>)}</div>}
      {!!progress && <div className="tw:flex tw:items-center tw:gap-1 tw:py-1 tw:text-[10px] tw:text-[#aaa]" role="status"><LoaderCircle className="spin tw:shrink-0" size={12}/><span className="tw:min-w-0 tw:flex-1 tw:truncate">{progress}</span><button type="button" className="icon-button" aria-label="Cancel image upload" onClick={() => uploading.current?.abort()}><X size={12}/></button></div>}
      {!!error && <p className="tw:my-1 tw:text-[11px] tw:text-[#ffb4a9]" role="alert">{error}</p>}
    </div>
    <footer><input ref={picker} type="file" className="tw:hidden!" accept={imageAccept} multiple aria-label="Choose comment images" onChange={e => { const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = ''; void attach(files); }}/><button type="button" className="icon-button" aria-label="Attach images" title="Attach images" disabled={busy || !!progress || attachments.length >= MAX_COMMENT_IMAGES} onClick={() => picker.current?.click()}><Paperclip size={16}/></button><button className="comment-send" aria-label="Send to Codex" title="Send to Codex · Enter" disabled={(!draft.trim() && !attachments.length) || busy || !!progress} onClick={() => { void submit(); }}><ArrowUp size={20}/></button></footer>
    {thread?.queued && <div className="queued-notice"><MessageCircle size={13}/><span>Queued for Codex</span><button aria-label="Copy comment request" title="Copy request for Codex" onClick={() => onCopy(commentPrompt(project, thread))}><Copy size={13}/></button></div>}
    {thread?.status === 'resolved' && <div className="resolved-notice"><CheckCheck size={13}/>Conversation resolved</div>}
  </div>;
}
