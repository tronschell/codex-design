import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { DesignNode, DesignSystem } from '../shared/types';
import { LIVE_CODE_SANDBOX, nodeCss, nodeLinkStyle, resolvedNodes, safeCodeDocument, textListStyle, vectorDataUrl } from '../shared/export';
import { isSafeLink } from '../shared/links';
import './design-node.css';
import { recordCanvasWork } from './canvas-profile';
import MediaNode from './MediaNode';
import ShaderNode from './ShaderNode';
import FrameGeneration from './FrameGeneration';
import CanvasTextEditor from './CanvasTextEditor';
import { setLiveFrame, useIsLiveFrame } from './live-frame';

export interface NodeViewProps {
  node: DesignNode;
  nodes: DesignNode[];
  selectedId?: string | null;
  onSelect?: (id: string, event: PointerEvent) => void;
  onTextEdit?: (id: string, value: string) => unknown;
  interactive?: boolean;
  preview?: boolean;
  designSystem?: DesignSystem;
}
type LiveTarget = { nodeId: string; key: string };
export interface CanvasNodesProps {
  nodes: DesignNode[];
  liveTarget?: LiveTarget;
  visibleRootIds?: ReadonlySet<string>;
  onSelect?: NodeViewProps['onSelect'];
  onTextEdit?: NodeViewProps['onTextEdit'];
  interactive?: boolean;
  designSystem?: DesignSystem;
}

type TreeProps = Omit<NodeViewProps, 'nodes' | 'selectedId'> & { liveTarget?: LiveTarget; childrenByParent: Map<string, DesignNode[]>; ancestors: ReadonlySet<string>; linkedAncestor?: boolean; inheritedPointerEvents?: 'auto' | 'none' };
const rootAncestors: ReadonlySet<string> = new Set();

type ChildIndex = { childrenByParent: Map<string, DesignNode[]>; roots: DesignNode[] };
function indexChildren(nodes: DesignNode[], previous?: ChildIndex): ChildIndex {
  recordCanvasWork('treeIndexes');
  const childrenByParent = new Map<string, DesignNode[]>(), roots: DesignNode[] = [];
  for (const node of nodes) {
    if (!node.parentId) roots.push(node);
    else {
      const siblings = childrenByParent.get(node.parentId);
      if (siblings) siblings.push(node);
      else childrenByParent.set(node.parentId, [node]);
    }
  }
  if (!previous) return { childrenByParent, roots };
  // Reuse sibling arrays unless something below them changed, so memoized subtrees skip rendering.
  const byId = new Map(nodes.map(node => [node.id, node])), stale = new Set<string>();
  const invalidate = (id: string) => { for (let node = byId.get(id); node && !stale.has(node.id); node = node.parentId ? byId.get(node.parentId) : undefined) stale.add(node.id); };
  for (const [id, children] of childrenByParent) {
    const old = previous.childrenByParent.get(id);
    if (!old || old.length !== children.length || children.some((child, index) => child !== old[index])) invalidate(id);
  }
  for (const id of previous.childrenByParent.keys()) if (!childrenByParent.has(id)) invalidate(id);
  for (const id of childrenByParent.keys()) if (!stale.has(id)) childrenByParent.set(id, previous.childrenByParent.get(id)!);
  return { childrenByParent, roots };
}

// The shared index changes on every edit; a layer re-renders only when its own node or child list does.
const sameLayer = (a: TreeProps, b: TreeProps) => (Object.keys(b) as (keyof TreeProps)[]).every(key => key === 'childrenByParent' ? a.childrenByParent.get(a.node.id) === b.childrenByParent.get(b.node.id) : Object.is(a[key], b[key])) && Object.keys(a).length === Object.keys(b).length;

// Esc inside the scripted frame hands control back to the canvas, which cannot see key events from the sandboxed document.
const exitScript = '<script>addEventListener("keydown",function(e){if(e.key==="Escape")parent.postMessage("codex-live-exit","*")})</script>';
function ScriptedFrame({ id, name, passive, source, designSystem }: { id: string; name: string; passive: string; source: string; designSystem?: DesignSystem }) {
  const active = useIsLiveFrame(id), frame = useRef<HTMLIFrameElement>(null);
  const srcDoc = useMemo(() => active ? safeCodeDocument(source, designSystem, true) + exitScript : passive, [active, passive, source, designSystem]);
  useEffect(() => {
    if (!active) return;
    const exit = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data === 'codex-live-exit') setLiveFrame(null); };
    window.addEventListener('message', exit);
    frame.current?.focus();
    return () => window.removeEventListener('message', exit);
  }, [active]);
  // The key remounts the frame so a new sandbox applies and leaving resets script state to the static first paint.
  return <iframe key={active ? 'live' : 'passive'} ref={frame} title={name} sandbox={active ? LIVE_CODE_SANDBOX : ''} referrerPolicy="no-referrer" srcDoc={srcDoc} tabIndex={active ? 0 : -1} className={active ? 'tw:pointer-events-auto! tw:outline tw:outline-1 tw:-outline-offset-1 tw:outline-[#4c8dff]' : undefined} />;
}

const TreeNode = memo(function NodeLayer({ node, childrenByParent, ancestors, onSelect, onTextEdit, interactive = true, preview, designSystem, liveTarget, linkedAncestor = false, inheritedPointerEvents = 'auto' }: TreeProps) {
  recordCanvasWork('nodeRenders');
  const [editing, setEditing] = useState(false);
  const visible = !node.hidden && !ancestors.has(node.id);
  const descendants = useMemo(() => visible ? new Set(ancestors).add(node.id) : ancestors, [ancestors, node.id, visible]);
  const building = interactive && !preview && node.type === 'frame' && node.generation?.status === 'building';
  const style = useMemo(() => {
    if (!visible) return undefined;
    const css = nodeCss(node) as CSSProperties;
    if (preview && linkedAncestor && node.styles.pointerEvents === undefined) css.pointerEvents = 'none';
    if (!preview) { delete css.cursor; delete css.pointerEvents; css.transition = 'none'; css.animation = 'none'; }
    if (building) css.background = '#242424';
    return css;
  }, [node, visible, preview, linkedAncestor, building]);
  const code = useMemo(() => {
    if (!visible || node.type !== 'code') return { vector: null, document: '' };
    recordCanvasWork('vectorParses');
    const vector = vectorDataUrl(node.source ?? '');
    if (vector) return { vector, document: '' };
    recordCanvasWork('htmlDocuments');
    return { vector: null, document: safeCodeDocument(node.source ?? '', designSystem) };
  }, [node.type, node.source, visible, designSystem]);
  if (!visible) return null;
  const canEdit = interactive && !preview && !node.locked;
  const liveKey = liveTarget && canEdit && node.live && liveTarget.nodeId === node.id ? liveTarget.key : undefined;
  const href = node.href && isSafeLink(node.href) ? node.href : '';
  const pointerEvents = node.styles.pointerEvents ?? inheritedPointerEvents;
  const link = preview && href ? <a aria-label={node.name} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel={href.startsWith('#') ? undefined : 'noopener noreferrer'} style={{...nodeLinkStyle,pointerEvents}}/> : null;
  const mediaNode = preview && (linkedAncestor || !!href) && (node.type === 'image' || node.type === 'video') ? { ...node, styles: { ...node.styles, pointerEvents: node.type === 'image' && linkedAncestor && node.styles.pointerEvents === undefined ? 'none' as const : pointerEvents } } : node;
  const list = node.styles.listStyleType, List = list === 'decimal' ? 'ol' : 'ul';
  if (editing && node.type === 'text' && onTextEdit) return <CanvasTextEditor node={node} style={style} onSave={onTextEdit} onFinish={() => setEditing(false)}/>;
  return <div
    className={`design-node design-node-${node.type}${canEdit ? ' is-interactive' : ''}${editing ? ' is-editing' : ''}`}
    id={preview ? node.id : undefined}
    data-node-id={node.id}
    data-node-type={node.type}
    style={style}
    onPointerDown={canEdit && onSelect ? event => { event.stopPropagation(); if (!editing) onSelect(node.id, event); } : undefined}
    onDoubleClick={canEdit && node.type === 'text' && onTextEdit ? event => { event.stopPropagation(); if (!event.shiftKey) setEditing(true); } : canEdit && node.type === 'code' && liveKey ? event => { event.stopPropagation(); if (!event.shiftKey) setLiveFrame(liveKey); } : undefined}
    aria-label={node.name}
    aria-busy={building || undefined}
  >
    {node.type === 'video' && link}
    {node.type === 'text' ? !editing && list && list !== 'none' ? <List style={{...textListStyle,listStyleType:list}}>{(node.content ?? '').split(/\r?\n/).map((line,index)=><li key={index}>{line || <br/>}</li>)}</List> : node.content ?? '' : node.type === 'code' ? code.vector ? <img alt={node.name} src={code.vector} draggable={false} style={{objectFit:node.styles.objectFit??'fill'}} /> : liveKey ? <ScriptedFrame id={liveKey} name={node.name} passive={code.document} source={node.source ?? ''} designSystem={designSystem} /> : <iframe title={node.name} sandbox="" referrerPolicy="no-referrer" srcDoc={code.document} tabIndex={-1} /> : node.type === 'image' || node.type === 'video' ? node.type === 'video' && preview && href ? <div style={{position:'relative',width:'100%',height:'100%'}}><MediaNode node={mediaNode} preview={preview}/></div> : <MediaNode node={mediaNode} preview={preview}/> : node.type === 'shader' ? <ShaderNode shader={node.shader} name={node.name}/> : node.type === 'arrow' ? <span className="design-arrow-head" /> : null}
    {node.type !== 'video' && link}
    {(childrenByParent.get(node.id) ?? []).map(child => <TreeNode key={child.id} node={child} childrenByParent={childrenByParent} ancestors={descendants} onSelect={onSelect} onTextEdit={onTextEdit} interactive={interactive} preview={preview} designSystem={designSystem} liveTarget={liveTarget} linkedAncestor={linkedAncestor || !!href} inheritedPointerEvents={pointerEvents} />)}
    {building && <FrameGeneration updatedAt={node.generation?.updatedAt}/>}
  </div>;
}, sameLayer);

// The editor supplies resolved positions, so every visible root shares one page index.
export const CanvasNodes = memo(function CanvasScene({ nodes, visibleRootIds, onSelect, onTextEdit, interactive, designSystem, liveTarget }: CanvasNodesProps) {
  const previous = useRef<ChildIndex>(undefined);
  const { childrenByParent, roots } = useMemo(() => previous.current = indexChildren(nodes, previous.current), [nodes]);
  return <>{roots.filter(node => !visibleRootIds || visibleRootIds.has(node.id)).map(node => <TreeNode key={node.id} node={node} childrenByParent={childrenByParent} ancestors={rootAncestors} onSelect={onSelect} onTextEdit={onTextEdit} interactive={interactive} designSystem={designSystem} liveTarget={liveTarget} />)}</>;
});

export function NodeView({ node, nodes, onSelect, onTextEdit, interactive, preview, designSystem }: NodeViewProps) {
  const { childrenByParent } = useMemo(() => indexChildren(resolvedNodes(nodes, designSystem)), [nodes, designSystem]);
  return <TreeNode node={node} childrenByParent={childrenByParent} ancestors={rootAncestors} onSelect={onSelect} onTextEdit={onTextEdit} interactive={interactive} preview={preview} designSystem={designSystem} />;
}
