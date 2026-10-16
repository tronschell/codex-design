import { parentPort } from 'node:worker_threads';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { DesignNode, Operation } from '../shared/types';
import { diagramById, CONTAINERS } from '../shared/diagram-catalog';
import { PORTS, crossingCount, resolveDiagramNodes } from '../shared/diagrams';
import { portLocal } from '../shared/diagrams';
const elk=new ELK();
parentPort!.on('message',async({id,nodes,frameId,pageId}:{id:number;nodes:DesignNode[];frameId:string;pageId:string})=>{
 try {
  const began=performance.now(), frame=nodes.find(n=>n.id===frameId);
  if(!frame?.diagram)throw Error('Select a diagram frame.');
  const config=frame.diagram, pack=diagramById.get(config.kind)!;
  const output=structuredClone(nodes), changed=new Map<string,DesignNode>(), warnings:string[]=[];
  const descendants=new Set([frameId]);let added=true;while(added){added=false;for(const n of output)if(n.parentId&&descendants.has(n.parentId)&&!descendants.has(n.id)){descendants.add(n.id);added=true;}}
  const elements=output.filter(n=>descendants.has(n.id)&&n.diagramElement&&!n.hidden);
  if(elements.length>750)throw Error('Arrange supports up to 750 elements per diagram. Split larger diagrams into frames.');
  const gap=config.spacing==='compact'?44:80, padding=56;
  const move=(n:DesignNode,x:number,y:number,width=n.width,height=n.height)=>{if(n.diagramElement?.pinned||n.locked)return;Object.assign(n,{x:Math.round(x),y:Math.round(y),width:Math.round(width),height:Math.round(height)});changed.set(n.id,n);};
  const overlaps=(a:DesignNode,b:DesignNode)=>a.x<b.x+b.width+20&&a.x+a.width+20>b.x&&a.y<b.y+b.height+20&&a.y+a.height+20>b.y;
  async function group(parent:DesignNode){
   const children=elements.filter(n=>n.parentId===parent.id);
   for(const container of children.filter(n=>CONTAINERS.has(n.diagramElement!.kind)))await group(container);
   if(!children.length)return;
   if(pack.layout==='graph'){
    const childIds=new Set(children.map(n=>n.id));
    const childFor=(id:string):string|undefined=>{let n=output.find(n=>n.id===id);const seen=new Set<string>();while(n&&!seen.has(n.id)){if(childIds.has(n.id))return n.id;seen.add(n.id);n=output.find(a=>a.id===n!.parentId);}return undefined;};
    const graph:ElkNode={id:parent.id,layoutOptions:{'elk.algorithm':'layered','elk.direction':config.direction,'elk.edgeRouting':'ORTHOGONAL','elk.spacing.nodeNode':String(gap),'elk.layered.spacing.nodeNodeBetweenLayers':String(gap+32),'elk.padding':'[top=56,left=56,bottom=56,right=56]','elk.layered.crossingMinimization.strategy':'LAYER_SWEEP','elk.randomSeed':'7'},children:children.map(n=>({id:n.id,width:n.width,height:n.height,layoutOptions:{'elk.portConstraints':'FIXED_POS'},ports:PORTS.map(p=>{const at=portLocal(n,p);return{id:n.id+'-'+p,x:at.x,y:at.y,width:0,height:0,layoutOptions:{'elk.port.side':({n:'NORTH',e:'EAST',s:'SOUTH',w:'WEST'} as Record<string,string>)[p[0]]}};})})),edges:[]};
    for(const e of output.filter(n=>n.diagramEdge&&descendants.has(n.id))){
     const edge=e.diagramEdge!,from=childFor(edge.from.nodeId),to=childFor(edge.to.nodeId);if(!from||!to||from===to)continue;
     graph.edges!.push({id:e.id,sources:[from===edge.from.nodeId&&edge.from.port!=='auto'?from+'-'+edge.from.port:from],targets:[to===edge.to.nodeId&&edge.to.port!=='auto'?to+'-'+edge.to.port:to]});
    }
    const layout=await elk.layout(graph);
    for(const n of children){const pos=layout.children!.find(c=>c.id===n.id)!;move(n,pos.x??padding,pos.y??padding);}
    const fixed=children.filter(n=>n.diagramElement?.pinned||n.locked), placed=[...fixed];
    for(const n of children.filter(n=>!fixed.includes(n))){let tries=0;while(placed.some(p=>overlaps(n,p))&&tries++<1000){n.y+=40;changed.set(n.id,n);}placed.push(n);}
    if(fixed.length)warnings.push('Pinned elements kept their positions. Unpinned elements were placed around them.');
   }else if(pack.layout==='sequence'){
    children.filter(n=>n.diagramElement!.kind==='lifeline').sort((a,b)=>(a.diagramElement!.order??a.x)-(b.diagramElement!.order??b.x)).forEach((n,i)=>move(n,padding+i*(180+gap),padding,n.width,Math.max(n.height,output.filter(e=>e.diagramEdge).length*52+150)));
   }else if(pack.layout==='timing'){
    children.filter(n=>n.diagramElement!.kind==='timing').sort((a,b)=>(a.diagramElement!.order??a.y)-(b.diagramElement!.order??b.y)).forEach((n,i)=>move(n,padding,padding+i*(170+gap/2),Math.max(n.width,680),n.height));
   }else if(pack.layout==='journey'){
    let x=padding;children.sort((a,b)=>(a.diagramElement!.order??a.x)-(b.diagramElement!.order??b.x)).forEach(n=>{move(n,x,padding);x+=n.width+gap;});
   }else if(pack.layout==='roadmap'){
    const tasks=children.filter(n=>['initiative','milestone'].includes(n.diagramElement!.kind));
    const dates=tasks.flatMap(n=>[Date.parse(n.diagramElement!.start??''),Date.parse(n.diagramElement!.end??'')]).filter(Number.isFinite);
    const start=dates.length?Math.min(...dates):Date.now(), end=dates.length?Math.max(...dates):start+90*86400000, scale=1000/Math.max(86400000,end-start),lanes=[...new Set(tasks.map(n=>n.diagramElement!.lane||'Planned'))];
    for(const n of tasks){const d=n.diagramElement!,s=Date.parse(d.start??''),e=Date.parse(d.end??'');move(n,padding+(Number.isFinite(s)?(s-start)*scale:0),padding+lanes.indexOf(d.lane||'Planned')*160,d.kind==='milestone'?100:Math.max(140,Number.isFinite(e)&&Number.isFinite(s)?(e-s)*scale:240),n.height);}
   }else if(pack.layout==='sets'){
    children.filter(n=>n.diagramElement!.kind==='set').forEach((n,i,all)=>{const angle=i*Math.PI*2/Math.max(1,all.length);move(n,260+Math.cos(angle)*95,200+Math.sin(angle)*95);});
   }
   const width=Math.max(parent.id===frameId?720:parent.width,...children.map(n=>n.x+n.width+padding)),height=Math.max(parent.id===frameId?420:parent.height,...children.map(n=>n.y+n.height+padding));
   if(!parent.locked&&(parent.width!==width||parent.height!==height)){parent.width=width;parent.height=height;changed.set(parent.id,parent);}
  }
  await group(output.find(n=>n.id===frameId)!);
  const operations:Operation[]=[...changed.values()].filter(n=>{const old=nodes.find(a=>a.id===n.id)!;return old.x!==n.x||old.y!==n.y||old.width!==n.width||old.height!==n.height;}).map(n=>({type:'update_node',pageId,nodeId:n.id,patch:{x:n.x,y:n.y,width:n.width,height:n.height}}));
  const beforeCrossings=crossingCount(resolveDiagramNodes(nodes.filter(n=>descendants.has(n.id)))),afterCrossings=crossingCount(resolveDiagramNodes(output.filter(n=>descendants.has(n.id))));
  if(afterCrossings>beforeCrossings)warnings.push('This arrangement has more crossings than the current layout. Keep the current layout if it reads better.');
  parentPort!.postMessage({id,operations,metrics:{beforeCrossings,afterCrossings,durationMs:Math.round(performance.now()-began),movedNodes:operations.filter(o=>'nodeId'in o&&o.nodeId!==frameId).length},warnings:[...new Set(warnings)]});
 }catch(error){parentPort!.postMessage({id,error:error instanceof Error?error.message:'Layout failed.'});}
});
