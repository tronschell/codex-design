import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, CheckCheck, Code2, Copy, Eye, EyeOff, ImagePlus, MessageCircle, X } from 'lucide-react';
import type { CommentMessage, CommentThread, DesignProject } from '../shared/types';
import { commentPrompt } from '../shared/comments';
import { useLocalDraft } from './useLocalDraft';

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
        <span className="comment-list-byline"><span className={`message-avatar ${first?.role || 'user'}`} aria-hidden="true">{first?.role === 'assistant' ? <Code2 size={13}/> : 'Y'}</span><strong>{first?.role === 'assistant' ? 'Codex' : 'You'}</strong><time dateTime={latest?.createdAt || thread.createdAt} title={`Last activity · ${new Date(latest?.createdAt || thread.createdAt).toLocaleString()}`}>{new Date(latest?.createdAt || thread.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>{reply && <Code2 size={13} aria-label="Includes a Codex message"/>}{status === 'resolved' && <CheckCheck className="comment-list-resolved" size={15} aria-label="Resolved"/>}</span>
        <span className="comment-list-context" title={context}>{context}</span><span className="comment-list-message">{first?.content || 'Empty conversation'}</span>
        {status === 'resolved' && reply && reply.id !== first?.id && <span className="comment-list-reply"><strong><Code2 size={12}/>Codex</strong><span>{reply.content}</span></span>}
        <span className="comment-list-meta"><span>{thread.messages.length > 1 ? `${thread.messages.length - 1} ${thread.messages.length === 2 ? 'reply' : 'replies'}` : 'Open conversation'}</span>{thread.queued && <span className="comment-list-queued">Queued for Codex</span>}{!available && <span>Page unavailable</span>}</span>
      </button>) : <p className="comment-list-empty">{status === 'open' ? 'No open conversations.' : 'No resolved conversations.'}</p>}</section>;
    })}</div>
  </div>;
}

export default function CommentPopover({ project, target, pageId, position, onClose, onSend, onResolve, onCopy }: { project: DesignProject; target: CommentTarget; pageId: string; position: { left: number; top: number }; onClose: () => void; onSend: (content: string, intent?: CommentMessage['intent']) => Promise<boolean>; onResolve: (thread: CommentThread) => Promise<boolean>; onCopy: (text: string) => void }) {
  const local = useLocalDraft(`${project.id}/${pageId}/comment/${target.threadId || target.nodeId || `${target.x},${target.y}`}`, { message: '', intent: '' });
  const draft = local.value.message, intent: CommentMessage['intent'] = local.value.intent === 'generate_image' ? 'generate_image' : undefined;
  const setDraft = (message: string) => local.setValue({message}), setIntent = (intent?: CommentMessage['intent']) => local.setValue({intent: intent ?? ''});
  const [busy, setBusy] = useState(false);
  const compose = useRef<HTMLTextAreaElement>(null), popover = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!busy) compose.current?.focus({ preventScroll: true }); }, [target.nodeId, target.threadId, target.x, target.y, busy]);
  const thread = project.threads.find(t => t.id === target.threadId), page = project.pages.find(p => p.id === pageId), node = page?.nodes.find(n => n.id === target.nodeId);
  const parent = node?.parentId ? page?.nodes.find(n => n.id === node.parentId) : null;
  const submit = async () => { if (!draft.trim() || busy) return; popover.current?.focus({ preventScroll: true }); setBusy(true); try { if (await onSend(draft.trim(), intent)) { setDraft(''); setIntent(undefined); } } finally { setBusy(false); } };
  const resolve = async () => { if (!thread || busy) return; popover.current?.focus({ preventScroll: true }); setBusy(true); try { await onResolve(thread); } finally { setBusy(false); } };
  return <div ref={popover} tabIndex={-1} className="comment-popover" role="dialog" aria-label="Component conversation" aria-busy={busy} style={position} onPointerDown={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
    <header><span title={node?.name}>{parent?.name || node?.name || page?.name} {parent ? `› ${node?.name}` : '› conversation'}</span>{thread && <button className="icon-button" aria-label={thread.status === 'resolved' ? 'Reopen conversation' : 'Resolve conversation'} title={thread.status === 'resolved' ? 'Reopen conversation' : 'Resolve conversation'} disabled={busy} onClick={() => { void resolve(); }}><CheckCheck size={17}/></button>}<button className="icon-button" aria-label="Close conversation" onClick={onClose}><X size={16}/></button></header>
    {thread && <div className="comment-messages">{thread.messages.map(message => <div className={`comment-message ${message.role}`} key={message.id}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-16-2 18"/></svg> : 'Y'}</div><div><div className="message-byline"><strong>{message.role === 'assistant' ? 'Codex' : 'You'}</strong>{message.intent === 'generate_image' && <span className="comment-image-label"><ImagePlus size={11} aria-hidden="true"/>Image request</span>}<time>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div><p>{message.content}</p></div></div>)}</div>}
    <div className="comment-compose"><div className="comment-compose-tools"><span className="mention">@Codex</span>{node && <button type="button" className={`comment-image-toggle${intent ? ' active' : ''}`} aria-label="Generate an image in this component" aria-pressed={intent === 'generate_image'} title="Ask Codex to generate and fit an image in this component" disabled={busy} onClick={() => { setIntent(intent ? undefined : 'generate_image'); compose.current?.focus(); }}><ImagePlus size={12}/>Image</button>}</div><textarea ref={compose} aria-label="Comment" aria-describedby={`comment-send-hint${intent ? ' image-request-hint' : ''}`} disabled={busy} placeholder={intent ? 'Describe the image for this area…' : thread ? 'Reply or ask for another change…' : 'What would you like to change?'} rows={3} value={draft} maxLength={20000} onChange={e => setDraft(e.target.value)} onBlur={local.onBlur} onCompositionStart={local.onCompositionStart} onCompositionEnd={local.onCompositionEnd} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); if (!e.repeat) void submit(); } }}/>{intent && <p id="image-request-hint" className="comment-image-hint">Requests an image sized and placed for this component.</p>}</div>
    <footer><span id="comment-send-hint" className="comment-send-hint">Enter to send · Shift+Enter for a new line</span><button className="comment-send" aria-label="Send to Codex" title="Send to Codex · Enter" disabled={!draft.trim() || busy} onClick={() => { void submit(); }}><ArrowUp size={20}/></button></footer>
    {thread?.queued && <div className="queued-notice"><MessageCircle size={13}/><span>Queued for Codex</span><button aria-label="Copy comment request" title="Copy request for Codex" onClick={() => onCopy(commentPrompt(project, thread))}><Copy size={13}/></button></div>}
    {thread?.status === 'resolved' && <div className="resolved-notice"><CheckCheck size={13}/>Conversation resolved</div>}
  </div>;
}
