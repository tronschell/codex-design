import { useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, X, Search, Plus, Workflow, Pin, WandSparkles, ArrowRight, Link2, LoaderCircle } from 'lucide-react';
import type { DesignNode, DesignPage, DesignProject, Operation, Viewport } from '../shared/types';
import type { DiagramEndpoint, DiagramKind, Point, RelationKind } from '../shared/diagram-types';
import type { DiagramLayoutResult } from '../shared/diagram-layout-types';
import { DIAGRAMS, STENCILS, diagramById, stencilById, makeDiagram, makeDiagramElement } from '../shared/diagram-catalog';
import { PORTS, choosePort, diagramFrame, diagramPerimeterDistance, portWorld } from '../shared/diagrams';
import { stencilIcon } from '../shared/diagram-render';
import { parentLocalPoint } from '../shared/effects';
import { client } from './client';
import { uid } from './editor-utils';
import { isTextInput } from './shortcuts';
import './diagramming.css';
type Props={project:DesignProject|null;page:DesignPage|undefined;nodes:DesignNode[];selection:string|null;view:Viewport;stage:RefObject<HTMLDivElement|null>;readOnly:boolean;open:boolean;setOpen:(open:boolean)=>void;select:(id:string)=>void;change:(ops:Operation[])=>Promise<DesignProject|null>;preview:(patch:Record<string,Partial<DesignNode>>|null)=>void;focus:(id:string)=>void;notify:(message:string)=>void};
type Connection={from:DiagramEndpoint;position:Point;start?:Point;edgeId?:string;end?:'from'|'to'};
export function DiagramGlyph({kind}:{kind:string}){return <span className="diagram-glyph" aria-hidden="true" dangerouslySetInnerHTML={{__html:stencilIcon(kind)}}/>;}
export function useDiagramWorkspace(p:Props){
 const [catalog,setCatalog]=useState(false),[query,setQuery]=useState(''),[placing,setPlacing]=useState<string|null>(null),[ports,setPorts]=useState<string|null>(null),[connection,setConnection]=useState<Connection|null>(null),[quick,setQuick]=useState<Point|null>(null),[relation,setRelation]=useState<RelationKind>('flow'),[layout,setLayout]=useState<DiagramLayoutResult|null>(null),[working,setWorking]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null),current=useRef(p);current.current=p;
 const [activeFrameId,setActiveFrameId]=useState<string|null>(null);
 const selected=p.nodes.find(n=>n.id===p.selection),selectedFrame=selected?diagramFrame(p.nodes,selected.id):undefined,frame=selectedFrame??p.nodes.find(n=>n.id===activeFrameId),pack=frame?.diagram?diagramById.get(frame.diagram.kind):undefined;
 useEffect(()=>{if(selectedFrame)setActiveFrameId(selectedFrame.id);},[selectedFrame?.id]);
 const effectiveRelation=pack?.relations.includes(relation)?relation:pack?.relations[0]??'flow';
 const world=(event:{clientX:number;clientY:number})=>{const box=p.stage.current!.getBoundingClientRect();return{x:(event.clientX-box.left-p.view.x)/p.view.zoom,y:(event.clientY-box.top-p.view.y)/p.view.zoom};};
 const screen=(point:Point)=>({left:p.view.x+point.x*p.view.zoom,top:p.view.y+point.y*p.view.zoom});
 const cancel=()=>{setConnection(null);setQuick(null);setPlacing(null);setPorts(null);};
 useEffect(()=>{cancel();setLayout(null);controller.current?.abort();p.preview(null);},[p.project?.id,p.page?.id,p.readOnly]);
 useEffect(()=>{if(ports!==p.selection&&!connection)setPorts(null);},[p.selection]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{if(layout&&layout.revision!==p.project?.revision){setLayout(null);p.preview(null);setError('The diagram changed. Arrange again to preview the latest version.');}},[p.project?.revision]);
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{if(isTextInput(e.target)||p.readOnly||e.key==='Enter'&&(e.target as Element).closest('button'))return;
   if(e.key==='Escape'&&(connection||placing||ports||quick||layout||working)){e.preventDefault();e.stopImmediatePropagation();cancel();controller.current?.abort();setWorking(false);setLayout(null);p.preview(null);return;}
   if((e.key.toLowerCase()==='c'||e.key==='Enter')&&selected?.diagramElement&&!e.metaKey&&!e.ctrlKey){e.preventDefault();e.stopImmediatePropagation();setPorts(selected.id);p.setOpen(true);requestAnimationFrame(()=>p.stage.current?.querySelector<HTMLButtonElement>('[data-diagram-port="'+selected.id+'-n50"]')?.focus());}
  };window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
 },[p.selection,p.readOnly,connection,placing,ports,quick,layout,working]);
 const save=async(operations:Operation[])=>{setError('');try{return await p.change(operations);}catch(e){setError(e instanceof Error?e.message:'Could not save this diagram.');return null;}};
 const makeEdge=(from:DiagramEndpoint,to:DiagramEndpoint,parent:string):DesignNode=>({id:uid(),parentId:parent,type:'code',name:effectiveRelation+' connection',x:0,y:0,width:8,height:8,styles:{fill:'transparent'},diagramEdge:{from,to,kind:effectiveRelation,route:'orthogonal',...(pack?.layout==='sequence'||pack?.id==='communication'?{sequence:p.nodes.filter(n=>n.parentId===parent&&n.diagramEdge).length+1}: {})}});
 const connect=async(to:DiagramEndpoint)=>{if(!connection||!p.page)return;const source=p.nodes.find(n=>n.id===connection.from.nodeId),owner=source&&diagramFrame(p.nodes,source.id),target=diagramFrame(p.nodes,to.nodeId);if(!owner||owner.id!==target?.id){setError('Connect elements inside the same diagram.');return;}
  const original=connection.edgeId?p.page.nodes.find(n=>n.id===connection.edgeId):undefined;
  const edge=original?{...original,diagramEdge:{...original.diagramEdge!,[connection.end??'to']:to,waypoints:[]}}:makeEdge(connection.from,to,owner.id);
  if(await save([{type:original?'update_node':'create_node',pageId:p.page.id,...(original?{nodeId:edge.id,patch:{diagramEdge:edge.diagramEdge}}:{node:edge})} as Operation])){cancel();p.select(edge.id);}
 };
 const add=async(kind:string,at?:Point)=>{if(!p.page||!frame)return;const position=at??{x:frame.x+80,y:frame.y+80},local=parentLocalPoint(frame.id,p.nodes,position);if(!local)return;
  const node=makeDiagramElement(uid(),frame.id,kind,local.x,local.y);const ops:Operation[]=[{type:'create_node',pageId:p.page.id,node}];
  if(connection)ops.push({type:'create_node',pageId:p.page.id,node:makeEdge(connection.from,{nodeId:node.id,port:'auto'},frame.id)});
  if(await save(ops)){cancel();p.select(node.id);}
 };
 const create=async(kind:DiagramKind,template=true)=>{if(!p.page)return;const box=p.stage.current!.getBoundingClientRect(),at=world({clientX:box.left+box.width/2-300,clientY:box.top+box.height/2-200}),id=uid();const nodes=makeDiagram(id,kind,Math.round(at.x),Math.round(at.y),undefined,template);
  if(await save(nodes.map(node=>({type:'create_node',pageId:p.page!.id,node})))){p.select(id);setCatalog(false);setQuery('');setTimeout(()=>current.current.focus(id),100);}
 };
 const arrange=async()=>{if(!p.project||!p.page||!frame)return;controller.current?.abort();const control=new AbortController();controller.current=control;setWorking(true);setError('');
  try{const result=await client.layoutDiagram(p.project.id,p.page.id,frame.id,control.signal);if(control.signal.aborted)return;if(current.current.project?.revision!==result.revision)throw Error('The diagram changed. Arrange again.');setLayout(result);p.preview(Object.fromEntries(result.operations.flatMap(op=>op.type==='update_node'?[[op.nodeId,op.patch]]:[])));}
  catch(e){if(!control.signal.aborted)setError(e instanceof Error?e.message:'Could not arrange this diagram.');}finally{if(controller.current===control)setWorking(false);}
 };
 const startPort=(node:DesignNode,port:DiagramEndpoint['port'],e?:ReactPointerEvent)=>{e?.stopPropagation();if(p.readOnly)return;
  if(connection){void connect({nodeId:node.id,port});return;}
  const at=portWorld(node,port,p.nodes);setConnection({from:{nodeId:node.id,port},position:at,start:e?{x:e.clientX,y:e.clientY}:undefined});setQuick(null);setPorts(node.id);
  if(e)p.stage.current?.setPointerCapture(e.pointerId);
 };
 const hit=(e:{clientX:number;clientY:number})=>{const el=document.elementFromPoint(e.clientX,e.clientY),port=el?.closest('[data-diagram-port]')?.getAttribute('data-diagram-port'),id=port?port.slice(0,port.lastIndexOf('-')):el?.closest('[data-node-id]')?.getAttribute('data-node-id');return p.nodes.find(n=>n.id===id&&n.diagramElement);};
 const onNodeDown=(id:string,e:ReactPointerEvent)=>{if(p.readOnly)return false;const node=p.nodes.find(n=>n.id===id);if(!node)return false;
  if(placing){void add(placing,world(e));return true;}
  if(connection&&node.diagramElement){void connect({nodeId:id,port:choosePort(node,world(e),p.nodes)});return true;}
  if(node.diagramEdge){p.select(id);p.setOpen(true);return true;}
  if(node.diagramElement){p.setOpen(true);const distance=diagramPerimeterDistance(node,world(e),p.nodes);if(distance*p.view.zoom<10&&!e.shiftKey){p.select(id);setPorts(id);return true;}}
  return false;
 };
 const onCanvasDown=(e:ReactPointerEvent)=>{if(p.readOnly)return false;if(placing){void add(placing,world(e));return true;}if(connection){setQuick(world(e));return true;}return false;};
 const move=(e:ReactPointerEvent)=>{if(!connection||quick)return false;setConnection({...connection,position:world(e)});return true;};
 const up=(e:ReactPointerEvent)=>{if(!connection)return false;const dragged=connection.start&&Math.hypot(e.clientX-connection.start.x,e.clientY-connection.start.y)>6;
  if(p.stage.current?.hasPointerCapture(e.pointerId))p.stage.current.releasePointerCapture(e.pointerId);
  if(dragged){const target=hit(e);if(target)void connect({nodeId:target.id,port:choosePort(target,world(e),p.nodes)});else setQuick(world(e));}return true;
 };
 const drop=(kind:string,e:{clientX:number;clientY:number})=>{if(!p.readOnly&&frame&&stencilById.has(kind))void add(kind,world(e));};
 const displayed=pack?.stencils.map(id=>stencilById.get(id)!).filter(s=>(s.name+' '+s.id).toLowerCase().includes(query.toLowerCase()))??[];
 const from=connection&&p.nodes.find(n=>n.id===connection.from.nodeId),fromPoint=from&&portWorld(from,connection!.from.port,p.nodes),endPoint=connection?.position;
 const portNodes=connection?p.nodes.filter(n=>n.diagramElement&&diagramFrame(p.nodes,n.id)?.id===frame?.id&&!n.hidden):ports?p.nodes.filter(n=>n.id===ports):[];
 const ui=<>
  {p.open&&!p.readOnly&&<aside className="diagram-library feature-panel" aria-label="Diagram library" onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
   <header><strong>{catalog||!pack?'Diagram library':pack.name}</strong><button aria-label="Close diagram library" onClick={()=>p.setOpen(false)}><X size={15}/></button></header>
   {pack&&!catalog&&<button className="diagram-family-button" onClick={()=>{setCatalog(true);setQuery('');}}><Workflow size={15}/><span>Browse all diagrams</span><span className="feature-count">20</span></button>}
   {catalog&&pack&&<button className="diagram-back" onClick={()=>{setCatalog(false);setQuery('');}}><ChevronLeft size={14}/>Back to {pack.name}</button>}
   <label className="diagram-search"><Search size={14}/><input aria-label="Search diagram library" placeholder={catalog||!pack?'Find a diagram…':'Find a shape…'} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={12}/></button>}</label>
   <div className="diagram-library-scroll">
    {catalog||!pack?([...new Set(DIAGRAMS.map(d=>d.family))].map(group=>{const list=DIAGRAMS.filter(d=>d.family===group&&(d.name+' '+d.description).toLowerCase().includes(query.toLowerCase()));return list.length?<section key={group}><h3>{group}</h3>{list.map(d=><div key={d.id} className="diagram-type-row"><button onClick={()=>void create(d.id)} title={d.description}><DiagramGlyph kind={d.stencils[0]}/><span>{d.name}<small>{d.description}</small></span></button><button title={'Create blank '+d.name+' diagram'} aria-label={'Create blank '+d.name+' diagram'} onClick={()=>void create(d.id,false)}><Plus size={14}/></button></div>)}</section>:null;})):
    <>{(['Elements','Interfaces','Structure','Content'] as const).map(group=>{const shapes=displayed.filter(s=>s.group===group);return shapes.length?<section key={group}><h3>{group}</h3><div className="diagram-stencils">{shapes.map(s=><button key={s.id} className={placing===s.id?'is-active':''} draggable onDragStart={e=>{e.dataTransfer.setData('application/x-codex-stencil',s.id);e.dataTransfer.effectAllowed='copy';}} aria-pressed={placing===s.id} title={s.name+' · drag to the canvas or click to place'} onClick={()=>{setPlacing(s.id);setPorts(null);setError('');}}><DiagramGlyph kind={s.id}/><span>{s.name}</span></button>)}</div></section>:null;})}
    {!displayed.length&&<p className="feature-empty">No shapes match “{query}”. <button onClick={()=>setQuery('')}>Clear search</button></p>}
    <section><h3>Relationships</h3><div className="diagram-relations">{pack.relations.map(kind=><button key={kind} aria-pressed={effectiveRelation===kind} className={effectiveRelation===kind?'is-active':''} onClick={()=>{setRelation(kind);if(selected?.diagramElement)setPorts(selected.id);}}><RelationGlyph kind={kind}/><span>{kind.replaceAll('-',' ')}</span></button>)}</div></section>
    <div className="diagram-help"><Link2 size={14}/><span>Click an edge to reveal connection points. Drag a point to connect.<small>C opens points on a selected node.</small></span></div>
    </>}
    {(catalog||!pack)&&!DIAGRAMS.some(d=>(d.name+' '+d.description).toLowerCase().includes(query.toLowerCase()))&&<p className="feature-empty">No matching diagrams. <button onClick={()=>setQuery('')}>Clear search</button></p>}
   </div>
  </aside>}
  {frame&&!p.readOnly&&<div className="diagram-layout-bar feature-panel" onPointerDown={e=>e.stopPropagation()}><label title="Arrange automatically when elements or connections are added"><input type="checkbox" checked={frame.diagram!.autoPlace} onChange={e=>void save([{type:'update_node',pageId:p.page!.id,nodeId:frame.id,patch:{diagram:{...frame.diagram!,autoPlace:e.target.checked}}}])}/>Auto place</label><select aria-label="Layout direction" value={frame.diagram!.direction} onChange={e=>void save([{type:'update_node',pageId:p.page!.id,nodeId:frame.id,patch:{diagram:{...frame.diagram!,direction:e.target.value as 'RIGHT'|'DOWN'}}}])}><option value="RIGHT">Left to right</option><option value="DOWN">Top to bottom</option></select><select aria-label="Layout spacing" value={frame.diagram!.spacing} onChange={e=>void save([{type:'update_node',pageId:p.page!.id,nodeId:frame.id,patch:{diagram:{...frame.diagram!,spacing:e.target.value as 'comfortable'|'compact'}}}])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select><button disabled={working} onClick={()=>void arrange()}>{working?<LoaderCircle size={14} className="spin"/>:<WandSparkles size={14}/>}Arrange</button>{selected?.diagramElement&&<button aria-pressed={!!selected.diagramElement.pinned} title="Keep this element in place during arrangement" onClick={()=>void save([{type:'update_node',pageId:p.page!.id,nodeId:selected.id,patch:{diagramElement:{...selected.diagramElement!,pinned:!selected.diagramElement!.pinned}}}])}><Pin size={14}/>{selected.diagramElement.pinned?'Pinned':'Pin'}</button>}</div>}
  {(working||layout)&&<div className="diagram-layout-preview feature-panel" role="status" onPointerDown={e=>e.stopPropagation()}>{layout?<><strong>Arrangement preview</strong><span>{layout.metrics.beforeCrossings} → {layout.metrics.afterCrossings} crossings · {layout.metrics.movedNodes} moved</span>{layout.warnings.map(w=><small key={w}>{w}</small>)}<div><button onClick={()=>{setLayout(null);p.preview(null);}}>Cancel</button><button className="feature-primary" onClick={async()=>{if(current.current.project?.revision!==layout.revision){setError('The diagram changed. Arrange again.');return;}if(!layout.operations.length){setLayout(null);p.preview(null);return;}const result=await save(layout.operations);if(result){setLayout(null);p.preview(null);}}}>Apply arrangement</button></div></>:<><span>Finding an arrangement…</span><button onClick={()=>{controller.current?.abort();setWorking(false);}}>Cancel</button></>}</div>}
  {placing&&<div className="diagram-mode feature-panel" role="status" onPointerDown={e=>e.stopPropagation()}><Plus size={14}/>Click to place {stencilById.get(placing)?.name}<button onClick={()=>setPlacing(null)}>Cancel</button></div>}
  {connection&&fromPoint&&endPoint&&<svg className="diagram-connection-preview" aria-hidden="true"><path d={'M'+screen(fromPoint).left+' '+screen(fromPoint).top+'L'+screen(endPoint).left+' '+screen(endPoint).top}/></svg>}
  {portNodes.flatMap(node=>(Math.min(node.width,node.height)*p.view.zoom<70?PORTS.filter(port=>port.endsWith('50')):PORTS).map(port=>{const at=screen(portWorld(node,port,p.nodes));return <button key={node.id+port} data-diagram-port={node.id+'-'+port} className={'diagram-port'+(connection?.from.nodeId===node.id?' is-source':'')} style={{left:at.left,top:at.top}} aria-label={(connection?'Connect to ':'Start connection from ')+node.name+' '+port} title={node.name+' · '+port} onPointerDown={e=>startPort(node,port,e)} onClick={e=>{if(e.detail===0)startPort(node,port);}}/>;}))}
  {selected?.diagramEdge&&!p.readOnly&&(['from','to'] as const).map(end=>{const target=p.nodes.find(n=>n.id===selected.diagramEdge![end].nodeId);if(!target)return null;const endpoint=selected.diagramEdge![end],at=screen(portWorld(target,endpoint.port==='auto'?choosePort(target,{x:selected.x+selected.width/2,y:selected.y+selected.height/2},p.nodes):endpoint.port,p.nodes));return <button key={end} className="diagram-port diagram-endpoint" style={{left:at.left,top:at.top}} aria-label={'Reconnect '+end+' endpoint'} onPointerDown={e=>{e.stopPropagation();const fixed=selected.diagramEdge![end==='from'?'to':'from'];setConnection({from:fixed,position:world(e),start:{x:e.clientX,y:e.clientY},edgeId:selected.id,end});p.stage.current?.setPointerCapture(e.pointerId);}}/>;})}
  {quick&&<div className="diagram-quick-add feature-panel" style={{left:Math.max(12,Math.min((p.stage.current?.clientWidth??800)-230,screen(quick).left)),top:Math.max(70,Math.min((p.stage.current?.clientHeight??600)-300,screen(quick).top))}} onPointerDown={e=>e.stopPropagation()}><header><strong>Add next element</strong><button aria-label="Cancel connection" onClick={cancel}><X size={14}/></button></header><div>{pack?.stencils.slice(0,12).map(kind=><button key={kind} onClick={()=>void add(kind,quick)}><DiagramGlyph kind={kind}/>{stencilById.get(kind)?.name}<ArrowRight size={12}/></button>)}</div></div>}
  {error&&<div className="diagram-error feature-panel" role="alert" onPointerDown={e=>e.stopPropagation()}><span>{error}</span><button aria-label="Dismiss diagram error" onClick={()=>setError('')}><X size={14}/></button></div>}
 </>;
 return{ui,onNodeDown,onCanvasDown,move,up,drop,cancel,active:!!connection||!!placing,layoutActive:!!layout||working};
}
function RelationGlyph({kind}:{kind:RelationKind}){const dashed=['dependency','realization','reply','include','extend'].includes(kind),triangle=['generalization','realization'].includes(kind),diamond=['aggregation','composition'].includes(kind);return <svg width="44" height="22" viewBox="0 0 44 22" aria-hidden="true"><path d="M3 11H39" stroke="currentColor" fill="none" strokeWidth="1.4" strokeDasharray={dashed?'4 3':undefined}/>{diamond?<path d="M3 11l7-4 7 4-7 4z" fill={kind==='composition'?'currentColor':'#242424'} stroke="currentColor"/>:null}{triangle?<path d="M39 11l-9-5v10z" fill="#242424" stroke="currentColor"/>:<path d="M33 7l6 4-6 4" fill="none" stroke="currentColor" strokeWidth="1.4"/>}</svg>;}
