import { diagramEdgeMarkup } from '../shared/diagrams';
import ReactFrame from './ReactFrame';
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { DesignNode, DesignSystem } from '../shared/types';
import { LIVE_CODE_SANDBOX, nodeCss, nodeLinkStyle, resolvedNodes, safeCodeDocument, textListStyle, vectorDataUrl } from '../shared/export';
import { isSafeLink } from '../shared/links';
import { nodeIndex } from '../shared/effects';
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
  onOpenComponent?: (id: string) => void;
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
  onOpenComponent?: NodeViewProps['onOpenComponent'];
  interactive?: boolean;
  designSystem?: DesignSystem;
}

type TreeProps = Omit<NodeViewProps, 'nodes' | 'selectedId'> & { liveTarget?: LiveTarget; childrenByParent: Map<string, DesignNode[]>; buildingAncestors: ReadonlySet<string>; ancestors: ReadonlySet<string>; linkedAncestor?: boolean; lockedAncestor?: boolean; inheritedPointerEvents?: 'auto' | 'none' };
const rootAncestors: ReadonlySet<string> = new Set();

type ChildIndex = { childrenByParent: Map<string, DesignNode[]>; roots: DesignNode[]; buildingAncestors: Set<string> };
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
  const byId = nodeIndex(nodes), buildingAncestors = new Set<string>();
  for (const node of nodes) {
    if (node.hidden || node.generation?.status !== 'building') continue;
    const parents: DesignNode[] = [], seen = new Set([node.id]);
    for (let parent = byId.get(node.parentId ?? ''); parent && !seen.has(parent.id); parent = byId.get(parent.parentId ?? '')) {
      seen.add(parent.id); parents.push(parent);
    }
    if (!parents.some(parent => parent.hidden)) for (const parent of parents) buildingAncestors.add(parent.id);
  }
  if (!previous) return { childrenByParent, roots, buildingAncestors };
  // Reuse sibling arrays unless something below them changed, so memoized subtrees skip rendering.
  const stale = new Set<string>();
  const invalidate = (id: string) => { for (let node = byId.get(id); node && !stale.has(node.id); node = node.parentId ? byId.get(node.parentId) : undefined) stale.add(node.id); };
  for (const [id, children] of childrenByParent) {
    const old = previous.childrenByParent.get(id);
    if (!old || old.length !== children.length || children.some((child, index) => child !== old[index])) invalidate(id);
  }
  for (const id of previous.childrenByParent.keys()) if (!childrenByParent.has(id)) invalidate(id);
  for (const id of childrenByParent.keys()) if (!stale.has(id)) childrenByParent.set(id, previous.childrenByParent.get(id)!);
  return { childrenByParent, roots, buildingAncestors };
}

// The shared index changes on every edit; a layer re-renders only when its own node or child list does.
const sameLayer = (a: TreeProps, b: TreeProps) => (Object.keys(b) as (keyof TreeProps)[]).every(key => key === 'childrenByParent' ? a.childrenByParent.get(a.node.id) === b.childrenByParent.get(b.node.id) : key === 'buildingAncestors' ? a.buildingAncestors.has(a.node.id) === b.buildingAncestors.has(b.node.id) : Object.is(a[key], b[key])) && Object.keys(a).length === Object.keys(b).length;

function ScriptedFrame({ id, name, passive, source, designSystem }: { id: string; name: string; passive: string; source: string; designSystem?: DesignSystem }) {
  const active = useIsLiveFrame(id), frame = useRef<HTMLIFrameElement>(null), loads = useRef(0);
  const srcDoc = useMemo(() => active ? safeCodeDocument(source, designSystem, true) : passive, [active, passive, source, designSystem]);
  useEffect(() => {
    loads.current = 0;
    if (!active) return;
    // The sandboxed document's prelude posts this on Esc, which the canvas cannot otherwise see.
    const exit = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data === 'codex-live-exit') setLiveFrame(null); };
    window.addEventListener('message', exit);
    frame.current?.focus();
    return () => window.removeEventListener('message', exit);
  }, [active]);
  // The key remounts the frame so a new sandbox applies and leaving resets script state to the static first paint.
  return <iframe key={active ? 'live' : 'passive'} ref={frame} title={name} sandbox={active ? LIVE_CODE_SANDBOX : ''} referrerPolicy="no-referrer" srcDoc={srcDoc} tabIndex={active ? 0 : -1} onLoad={active ? () => { if (++loads.current > 1) setLiveFrame(null); } : undefined} className={active ? 'tw:pointer-events-auto! tw:outline tw:outline-1 tw:-outline-offset-1 tw:outline-[#4c8dff]' : undefined} />;
}

const TreeNode = memo(function NodeLayer({ node, childrenByParent, buildingAncestors, ancestors, onSelect, onTextEdit, onOpenComponent, interactive = true, preview, designSystem, liveTarget, linkedAncestor = false, lockedAncestor = false, inheritedPointerEvents = 'auto' }: TreeProps) {
  recordCanvasWork('nodeRenders');
  const [editing, setEditing] = useState(false);
  const visible = !node.hidden && !ancestors.has(node.id);
  const canEdit = interactive && !preview && !node.locked;
  const textEditable = visible && canEdit && !lockedAncestor && node.type === 'text' && !!onTextEdit;
  const descendants = useMemo(() => visible ? new Set(ancestors).add(node.id) : ancestors, [ancestors, node.id, visible]);
  const building = interactive && !preview && node.generation?.status === 'building' && !buildingAncestors.has(node.id);
  // shortcut: source regions use supplied bounds; refresh them when source layout changes.
  const region = node.generation?.region;
  const screen = node.type === 'frame' && !node.parentId && !region;
  const style = useMemo(() => {
    if (!visible) return undefined;
    const css = nodeCss(node) as CSSProperties;
    if (preview && linkedAncestor && node.styles.pointerEvents === undefined) css.pointerEvents = 'none';
    if (!preview) { delete css.cursor; delete css.pointerEvents; css.transition = 'none'; css.animation = 'none'; }
    if (building && screen) css.background = '#242424';
    if (node.diagramEdge) css.pointerEvents = 'none';
    return css;
  }, [node, visible, preview, linkedAncestor, building, screen]);
  const code = useMemo(() => {
    if (!visible || node.type !== 'code') return { vector: null, document: '' };
    recordCanvasWork('vectorParses');
    const vector = vectorDataUrl(node.source ?? '');
    if (vector) return { vector, document: '' };
    recordCanvasWork('htmlDocuments');
    return { vector: null, document: safeCodeDocument(node.source ?? '', designSystem) };
  }, [node.type, node.source, visible, designSystem]);
  // Restoring editability must not reopen a session closed by a lock, tool or readonly view.
  if (editing && !textEditable) setEditing(false);
  if (!visible) return null;
  const liveKey = liveTarget && canEdit && (node.live || node.react) && liveTarget.nodeId === node.id ? liveTarget.key : undefined;
  const href = node.href && isSafeLink(node.href) ? node.href : '';
  const pointerEvents = node.styles.pointerEvents ?? inheritedPointerEvents;
  const link = preview && href ? <a aria-label={node.name} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel={href.startsWith('#') ? undefined : 'noopener noreferrer'} style={{...nodeLinkStyle,pointerEvents}}/> : null;
  const mediaNode = preview && (linkedAncestor || !!href) && (node.type === 'image' || node.type === 'video') ? { ...node, styles: { ...node.styles, pointerEvents: node.type === 'image' && linkedAncestor && node.styles.pointerEvents === undefined ? 'none' as const : pointerEvents } } : node;
  const list = node.styles.listStyleType, List = list === 'decimal' ? 'ol' : 'ul';
  if (editing && textEditable && onTextEdit) return <CanvasTextEditor node={node} style={style} onSave={onTextEdit} onFinish={() => setEditing(false)}/>;
  return <div
    className={`design-node design-node-${node.type}${canEdit ? ' is-interactive' : ''}${editing ? ' is-editing' : ''}`}
    id={preview ? node.id : undefined}
    data-node-id={node.id}
    data-node-type={node.type}
    style={style}
    onPointerDown={canEdit && onSelect ? event => { event.stopPropagation(); if (!editing) onSelect(node.id, event); } : undefined}
    onDoubleClick={textEditable ? event => { event.stopPropagation(); if (!event.shiftKey) setEditing(true); } : canEdit && liveKey ? event => { event.stopPropagation(); if (!event.shiftKey) setLiveFrame(liveKey); } : undefined}
    aria-label={node.name}
    aria-busy={building || undefined}
  >
    {node.type === 'video' && link}
    {node.diagramEdge ? <div style={{width:'100%',height:'100%',pointerEvents:'none'}} dangerouslySetInnerHTML={{__html:diagramEdgeMarkup(node)}}/> : node.react ? <ReactFrame node={node} system={designSystem} liveKey={liveKey} preview={preview} onOpenComponent={canEdit && !lockedAncestor ? onOpenComponent : undefined}/> : node.type === 'text' ? !editing && list && list !== 'none' ? <List style={{...textListStyle,listStyleType:list}}>{(node.content ?? '').split(/\r?\n/).map((line,index)=><li key={index}>{line || <br/>}</li>)}</List> : node.content ?? '' : node.type === 'code' ? code.vector ? <img alt={node.name} src={code.vector} draggable={false} style={{objectFit:node.styles.objectFit??'fill'}} /> : liveKey ? <ScriptedFrame id={liveKey} name={node.name} passive={code.document} source={node.source ?? ''} designSystem={designSystem} /> : <iframe title={node.name} sandbox="" referrerPolicy="no-referrer" srcDoc={code.document} tabIndex={-1} /> : node.type === 'image' || node.type === 'video' ? node.type === 'video' && preview && href ? <div style={{position:'relative',width:'100%',height:'100%'}}><MediaNode node={mediaNode} preview={preview}/></div> : <MediaNode node={mediaNode} preview={preview}/> : node.type === 'shader' ? <ShaderNode shader={node.shader} name={node.name}/> : node.type === 'arrow' ? <span className="design-arrow-head" /> : null}
    {node.type !== 'video' && link}
    {(childrenByParent.get(node.id) ?? []).map(child => <TreeNode key={child.id} node={child} childrenByParent={childrenByParent} buildingAncestors={buildingAncestors} ancestors={descendants} onSelect={onSelect} onTextEdit={onTextEdit} onOpenComponent={onOpenComponent} interactive={interactive} preview={preview} designSystem={designSystem} liveTarget={liveTarget} linkedAncestor={linkedAncestor || !!href} lockedAncestor={lockedAncestor || !!node.locked} inheritedPointerEvents={pointerEvents} />)}
    {building && <FrameGeneration updatedAt={node.generation?.updatedAt} label={screen ? 'Building screen' : `Updating ${node.name}`} compact={!screen || node.width < 180 || node.height < 64} region={region ? { ...region, width: Math.max(0, Math.min(region.width, node.width - region.x)), height: Math.max(0, Math.min(region.height, node.height - region.y)) } : undefined}/>}
  </div>;
}, sameLayer);

// The editor supplies resolved positions, so every visible root shares one page index.
export const CanvasNodes = memo(function CanvasScene({ nodes, visibleRootIds, onSelect, onTextEdit, onOpenComponent, interactive, designSystem, liveTarget }: CanvasNodesProps) {
  const previous = useRef<ChildIndex>(undefined);
  const { childrenByParent, roots, buildingAncestors } = useMemo(() => previous.current = indexChildren(nodes, previous.current), [nodes]);
  return <>{roots.filter(node => !visibleRootIds || visibleRootIds.has(node.id)).map(node => <TreeNode key={node.id} node={node} childrenByParent={childrenByParent} buildingAncestors={buildingAncestors} ancestors={rootAncestors} onSelect={onSelect} onTextEdit={onTextEdit} onOpenComponent={onOpenComponent} interactive={interactive} designSystem={designSystem} liveTarget={liveTarget} />)}</>;
});

export function NodeView({ node, nodes, onSelect, onTextEdit, onOpenComponent, interactive, preview, designSystem }: NodeViewProps) {
  const resolved = useMemo(() => resolvedNodes(nodes, designSystem), [nodes, designSystem]);
  const { childrenByParent, buildingAncestors } = useMemo(() => indexChildren(resolved), [resolved]);
  return <TreeNode node={resolved.find(item => item.id === node.id) ?? node} childrenByParent={childrenByParent} buildingAncestors={buildingAncestors} ancestors={rootAncestors} onSelect={onSelect} onTextEdit={onTextEdit} onOpenComponent={onOpenComponent} interactive={interactive} preview={preview} designSystem={designSystem} />;
}
