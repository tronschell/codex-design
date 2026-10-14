import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { DesignNode, DesignSystem } from '../shared/types';
import { nodeCss, nodeLinkStyle, resolvedNodes, safeCodeDocument, textListStyle, vectorDataUrl } from '../shared/export';
import { isSafeLink } from '../shared/links';
import './design-node.css';
import { recordCanvasWork } from './canvas-profile';
import MediaNode from './MediaNode';
import ShaderNode from './ShaderNode';
import FrameGeneration from './FrameGeneration';

export interface NodeViewProps {
  node: DesignNode;
  nodes: DesignNode[];
  selectedId?: string | null;
  onSelect?: (id: string, event: PointerEvent) => void;
  onTextEdit?: (id: string, value: string) => void;
  interactive?: boolean;
  preview?: boolean;
  designSystem?: DesignSystem;
}
export interface CanvasNodesProps {
  nodes: DesignNode[];
  visibleRootIds?: ReadonlySet<string>;
  onSelect?: NodeViewProps['onSelect'];
  onTextEdit?: NodeViewProps['onTextEdit'];
  interactive?: boolean;
  designSystem?: DesignSystem;
}

type TreeProps = Omit<NodeViewProps, 'nodes' | 'selectedId'> & { childrenByParent: Map<string, DesignNode[]>; ancestors: ReadonlySet<string>; linkedAncestor?: boolean; inheritedPointerEvents?: 'auto' | 'none' };
const rootAncestors: ReadonlySet<string> = new Set();

function indexChildren(nodes: DesignNode[]) {
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
  return { childrenByParent, roots };
}

const TreeNode = memo(function NodeLayer({ node, childrenByParent, ancestors, onSelect, onTextEdit, interactive = true, preview, designSystem, linkedAncestor = false, inheritedPointerEvents = 'auto' }: TreeProps) {
  recordCanvasWork('nodeRenders');
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (!editing || !textRef.current) return;
    textRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(textRef.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);
  if (!visible) return null;
  const canEdit = interactive && !preview && !node.locked;
  const href = node.href && isSafeLink(node.href) ? node.href : '';
  const pointerEvents = node.styles.pointerEvents ?? inheritedPointerEvents;
  const link = preview && href ? <a aria-label={node.name} href={href} target={href.startsWith('#') ? undefined : '_blank'} rel={href.startsWith('#') ? undefined : 'noopener noreferrer'} style={{...nodeLinkStyle,pointerEvents}}/> : null;
  const mediaNode = preview && (linkedAncestor || !!href) && (node.type === 'image' || node.type === 'video') ? { ...node, styles: { ...node.styles, pointerEvents: node.type === 'image' && linkedAncestor && node.styles.pointerEvents === undefined ? 'none' as const : pointerEvents } } : node;
  const list = node.styles.listStyleType, List = list === 'decimal' ? 'ol' : 'ul';
  const finishEditing = () => {
    setEditing(false);
    const value = textRef.current?.innerText ?? '';
    if (value !== (node.content ?? '')) onTextEdit?.(node.id, value);
  };
  return <div
    ref={node.type === 'text' ? textRef : undefined}
    className={`design-node design-node-${node.type}${canEdit ? ' is-interactive' : ''}${editing ? ' is-editing' : ''}`}
    id={preview ? node.id : undefined}
    data-node-id={node.id}
    data-node-type={node.type}
    style={style}
    onPointerDown={canEdit && onSelect ? event => { event.stopPropagation(); if (!editing) onSelect(node.id, event); } : undefined}
    onDoubleClick={canEdit && onTextEdit && node.type === 'text' ? event => { event.stopPropagation(); setEditing(true); } : undefined}
    contentEditable={node.type === 'text' && editing}
    suppressContentEditableWarning
    onBlur={editing ? finishEditing : undefined}
    onKeyDown={editing ? event => {
      event.stopPropagation();
      if (event.key === 'Escape') { if (textRef.current) textRef.current.innerText = node.content ?? ''; textRef.current?.blur(); }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); textRef.current?.blur(); }
    } : undefined}
    aria-label={node.name}
    aria-busy={building || undefined}
  >
    {node.type === 'video' && link}
    {node.type === 'text' ? !editing && list && list !== 'none' ? <List style={{...textListStyle,listStyleType:list}}>{(node.content ?? '').split(/\r?\n/).map((line,index)=><li key={index}>{line || <br/>}</li>)}</List> : node.content ?? '' : node.type === 'code' ? code.vector ? <img alt={node.name} src={code.vector} draggable={false} style={{objectFit:node.styles.objectFit??'fill'}} /> : <iframe title={node.name} sandbox="" referrerPolicy="no-referrer" srcDoc={code.document} tabIndex={-1} /> : node.type === 'image' || node.type === 'video' ? node.type === 'video' && preview && href ? <div style={{position:'relative',width:'100%',height:'100%'}}><MediaNode node={mediaNode} preview={preview}/></div> : <MediaNode node={mediaNode} preview={preview}/> : node.type === 'shader' ? <ShaderNode shader={node.shader} name={node.name}/> : node.type === 'arrow' ? <span className="design-arrow-head" /> : null}
    {node.type !== 'video' && link}
    {(childrenByParent.get(node.id) ?? []).map(child => <TreeNode key={child.id} node={child} childrenByParent={childrenByParent} ancestors={descendants} onSelect={onSelect} onTextEdit={onTextEdit} interactive={interactive} preview={preview} designSystem={designSystem} linkedAncestor={linkedAncestor || !!href} inheritedPointerEvents={pointerEvents} />)}
    {building && <FrameGeneration updatedAt={node.generation?.updatedAt}/>}
  </div>;
});

// The editor supplies resolved positions, so every visible root shares one page index.
export const CanvasNodes = memo(function CanvasScene({ nodes, visibleRootIds, onSelect, onTextEdit, interactive, designSystem }: CanvasNodesProps) {
  const { childrenByParent, roots } = useMemo(() => indexChildren(nodes), [nodes]);
  return <>{roots.filter(node => !visibleRootIds || visibleRootIds.has(node.id)).map(node => <TreeNode key={node.id} node={node} childrenByParent={childrenByParent} ancestors={rootAncestors} onSelect={onSelect} onTextEdit={onTextEdit} interactive={interactive} designSystem={designSystem} />)}</>;
});

export function NodeView({ node, nodes, onSelect, onTextEdit, interactive, preview, designSystem }: NodeViewProps) {
  const { childrenByParent } = useMemo(() => indexChildren(resolvedNodes(nodes, designSystem)), [nodes, designSystem]);
  return <TreeNode node={node} childrenByParent={childrenByParent} ancestors={rootAncestors} onSelect={onSelect} onTextEdit={onTextEdit} interactive={interactive} preview={preview} designSystem={designSystem} />;
}
