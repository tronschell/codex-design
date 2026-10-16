import { diamondGeometry, diamondPerimeter } from './diagram-geometry';
import type { DesignNode, DesignProject } from './types';
import type { DiagramPort, Point } from './diagram-types';
import { CONTAINERS, diagramById, stencilById } from './diagram-catalog';
import { diagramShapeSvg, svgDocument } from './diagram-render';
import { nodeWorldPoint, parentLocalPoint, visualBounds } from './effects';
import { validateStateNodes } from './application-state';
export const PORTS:DiagramPort[]=['n25','n50','n75','e25','e50','e75','s25','s50','s75','w25','w50','w75'];
export function diagramFrame(nodes:DesignNode[],id:string):DesignNode|undefined {const index=new Map(nodes.map(n=>[n.id,n])),seen=new Set<string>();let n=index.get(id);while(n&&!seen.has(n.id)){if(n.diagram)return n;seen.add(n.id);n=n.parentId?index.get(n.parentId):undefined;}return undefined;}
export function portLocal(node:DesignNode,port:DiagramPort):Point{
 const side=port==='auto'?'e':port[0],t=port==='auto'?.5:Number(port.slice(1))/100;
 let x=side==='w'?0:side==='e'?node.width:node.width*t,y=side==='n'?0:side==='s'?node.height:node.height*t;
 if(['set','usecase','initial','final','history'].includes(node.diagramElement?.kind??'')){if(side==='n'||side==='s')y=node.height/2+(side==='n'?-1:1)*node.height/2*Math.sqrt(1-(2*t-1)**2);else x=node.width/2+(side==='w'?-1:1)*node.width/2*Math.sqrt(1-(2*t-1)**2);}
 if(['decision','milestone'].includes(node.diagramElement?.kind??''))return diamondPerimeter(node.width,node.height,{x,y});
 return{x,y};
}
export function diagramPerimeterDistance(node:DesignNode,point:Point,nodes:DesignNode[]):number {
 if(['decision','milestone'].includes(node.diagramElement?.kind??'')){
  const points=diamondGeometry(node.width,node.height).points.map(p=>nodeWorldPoint(node,nodes,p));
  return Math.min(...points.map((a,i)=>{const b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);}));
 }
 const b=visualBounds(node,nodes);
 return Math.min(Math.abs(point.x-b.x),Math.abs(point.x-b.x-b.width),Math.abs(point.y-b.y),Math.abs(point.y-b.y-b.height));
}
export const portWorld=(node:DesignNode,port:DiagramPort,nodes:DesignNode[])=>nodeWorldPoint(node,nodes,portLocal(node,port));
export function choosePort(node:DesignNode,target:Point,nodes:DesignNode[]):DiagramPort{
 let best:DiagramPort='e50',distance=Infinity;for(const p of PORTS){const at=portWorld(node,p,nodes),d=(at.x-target.x)**2+(at.y-target.y)**2;if(d<distance){distance=d;best=p;}}return best;
}
const normal=(port:DiagramPort):Point=>port[0]==='n'?{x:0,y:-1}:port[0]==='s'?{x:0,y:1}:port[0]==='w'?{x:-1,y:0}:{x:1,y:0};
type Box={x:number;y:number;width:number;height:number};
const hits=(a:Point,b:Point,r:Box)=>Math.abs(a.x-b.x)<.01?a.x>r.x+.01&&a.x<r.x+r.width-.01&&Math.max(a.y,b.y)>r.y+.01&&Math.min(a.y,b.y)<r.y+r.height-.01:Math.abs(a.y-b.y)<.01?a.y>r.y+.01&&a.y<r.y+r.height-.01&&Math.max(a.x,b.x)>r.x+.01&&Math.min(a.x,b.x)<r.x+r.width-.01:false;
const length=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function simplify(points:Point[]):Point[]{return points.filter((p,i)=>!i||length(points[i-1],p)>.01).filter((p,i,a)=>!i||i===a.length-1||!(Math.abs(a[i-1].x-p.x)<.01&&Math.abs(a[i+1].x-p.x)<.01||Math.abs(a[i-1].y-p.y)<.01&&Math.abs(a[i+1].y-p.y)<.01));}
function orthogonal(a:Point,b:Point,obstacles:Box[]):Point[]{
 const candidates:Point[][]=[[a,{x:b.x,y:a.y},b],[a,{x:a.x,y:b.y},b]];
 const xs=new Set([a.x,b.x,(a.x+b.x)/2]),ys=new Set([a.y,b.y,(a.y+b.y)/2]);
 for(const r of obstacles){xs.add(r.x-1);xs.add(r.x+r.width+1);ys.add(r.y-1);ys.add(r.y+r.height+1);}
 for(const x of xs)candidates.push([a,{x,y:a.y},{x,y:b.y},b]);
 for(const y of ys)candidates.push([a,{x:a.x,y},{x:b.x,y},b]);
 const score=(ps:Point[])=>ps.slice(1).reduce((v,p,i)=>v+length(ps[i],p)+(obstacles.some(r=>hits(ps[i],p,r))?1e9:0),ps.length*18);
 candidates.sort((x,y)=>score(x)-score(y));if(score(candidates[0])<1e9)return simplify(candidates[0]);
 // Visibility graph on obstacle boundaries: neighboring grid coordinates suffice for an orthogonal shortest path.
 const xx=[...xs].sort((a,b)=>a-b),yy=[...ys].sort((a,b)=>a-b);
 if(xx.length*yy.length>50000)return simplify(candidates[0]);
 const key=(x:number,y:number)=>y*xx.length+x,start=key(xx.indexOf(a.x),yy.indexOf(a.y)),end=key(xx.indexOf(b.x),yy.indexOf(b.y));
 const distance=new Map<number,number>([[start,0]]),parent=new Map<number,number>(),open=[{id:start,score:length(a,b)}],closed=new Set<number>();let iterations=0;
 while(open.length&&iterations++<50000){
  open.sort((a,b)=>b.score-a.score);const current=open.pop()!.id;if(closed.has(current))continue;if(current===end){const path:Point[]=[];let at:number|undefined=end;while(at!==undefined){path.push({x:xx[at%xx.length],y:yy[Math.floor(at/xx.length)]});at=parent.get(at);}return simplify(path.reverse());}
  closed.add(current);const x=current%xx.length,y=Math.floor(current/xx.length),p={x:xx[x],y:yy[y]};
  for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||ny<0||nx>=xx.length||ny>=yy.length)continue;const next=key(nx,ny),q={x:xx[nx],y:yy[ny]};if(closed.has(next)||obstacles.some(r=>hits(p,q,r)))continue;const cost=distance.get(current)!+length(p,q)+2;if(cost<(distance.get(next)??Infinity)){distance.set(next,cost);parent.set(next,current);open.push({id:next,score:cost+length(q,b)});}}
 }
 return simplify(candidates[0]);
}
export function edgePoints(node:DesignNode,nodes:DesignNode[]):Point[]{
 const edge=node.diagramEdge;if(!edge)return[];const index=new Map(nodes.map(n=>[n.id,n])),from=index.get(edge.from.nodeId),to=index.get(edge.to.nodeId);if(!from||!to)return[];
 const frame=diagramFrame(nodes,node.id),sequence=frame?.diagram?.kind==='sequence';
 if(sequence&&from.diagramElement?.kind==='lifeline'&&to.diagramElement?.kind==='lifeline'){
  const y=Math.min(from.height-24,to.height-24,84+(edge.sequence??1)*52);
  const a=parentLocalPoint(node.parentId,nodes,nodeWorldPoint(from,nodes,{x:from.width/2,y}))!,b=parentLocalPoint(node.parentId,nodes,nodeWorldPoint(to,nodes,{x:to.width/2,y}))!;
  return from.id===to.id?[a,{x:a.x+60,y:a.y},{x:a.x+60,y:a.y+26},{x:a.x,y:a.y+26}]:[a,b];
 }
 let fp=edge.from.port,tp=edge.to.port;
 if(from.id===to.id){if(fp==='auto')fp='e25';if(tp==='auto')tp='e75';}
 else{if(fp==='auto')fp=choosePort(from,nodeWorldPoint(to,nodes,{x:to.width/2,y:to.height/2}),nodes);if(tp==='auto')tp=choosePort(to,portWorld(from,fp,nodes),nodes);}
 const a=parentLocalPoint(node.parentId,nodes,portWorld(from,fp,nodes)),b=parentLocalPoint(node.parentId,nodes,portWorld(to,tp,nodes));if(!a||!b)return[];
 if(edge.waypoints?.length)return[a,...edge.waypoints,b];
 if(edge.route==='straight')return[a,b];
 const outside=(shape:DesignNode,port:DiagramPort,at:Point)=>{
  const unit=normal(port),local=portLocal(shape,port),probe=parentLocalPoint(node.parentId,nodes,nodeWorldPoint(shape,nodes,{x:local.x+unit.x*24,y:local.y+unit.y*24}));
  const worldBox=visualBounds(shape,nodes),lo=parentLocalPoint(node.parentId,nodes,worldBox)!,hi=parentLocalPoint(node.parentId,nodes,{x:worldBox.x+worldBox.width,y:worldBox.y+worldBox.height})!;
  // Route outside endpoint bounds before turning, including rotated or diamond shapes.
  const dx=probe?probe.x-at.x:unit.x,dy=probe?probe.y-at.y:unit.y;
  if(Math.abs(dx)>=Math.abs(dy))return{x:dx>=0?Math.max(at.x+24,hi.x+24):Math.min(at.x-24,lo.x-24),y:at.y};
  return{x:at.x,y:dy>=0?Math.max(at.y+24,hi.y+24):Math.min(at.y-24,lo.y-24)};
 };
 const as=outside(from,fp,a),bs=outside(to,tp,b);
 if(from.id===to.id){const right=Math.max(a.x,b.x)+54;return simplify([a,{x:right,y:a.y},{x:right,y:b.y},b]);}
 const obstacles=nodes.filter(n=>n.diagramElement&&!n.hidden&&!CONTAINERS.has(n.diagramElement.kind)&&diagramFrame(nodes,n.id)?.id===frame?.id).map(n=>{const box=visualBounds(n,nodes),p=parentLocalPoint(node.parentId,nodes,box)!,q=parentLocalPoint(node.parentId,nodes,{x:box.x+box.width,y:box.y+box.height})!;return{x:Math.min(p.x,q.x)-12,y:Math.min(p.y,q.y)-12,width:Math.abs(q.x-p.x)+24,height:Math.abs(q.y-p.y)+24};});
 return simplify([a,...orthogonal(as,bs,obstacles),b]);
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function pathForPoints(points:Point[],rounded=false):string {
 if(!points.length)return'';if(!rounded||points.length<3)return points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');
 let d='M'+points[0].x+' '+points[0].y;
 for(let i=1;i<points.length-1;i++){const prev=points[i-1],p=points[i],next=points[i+1],r=Math.min(10,length(prev,p)/2,length(p,next)/2),a={x:p.x+(prev.x-p.x)*r/Math.max(1,length(prev,p)),y:p.y+(prev.y-p.y)*r/Math.max(1,length(prev,p))},b={x:p.x+(next.x-p.x)*r/Math.max(1,length(next,p)),y:p.y+(next.y-p.y)*r/Math.max(1,length(next,p))};d+='L'+a.x+' '+a.y+'Q'+p.x+' '+p.y+' '+b.x+' '+b.y;}
 const end=points.at(-1)!;return d+'L'+end.x+' '+end.y;
}
const generatedEdges = new WeakMap<DesignNode,string>();
export const diagramEdgeMarkup = (node:DesignNode) => generatedEdges.get(node) ?? '';
export function edgeDrawing(node:DesignNode,nodes:DesignNode[]):DesignNode {
 const e=node.diagramEdge!,points=edgePoints(node,nodes);if(points.length<2)return node.source?{...node,diagramEdge:undefined}:{...node,hidden:true};const caption=e.label||(['include','extend'].includes(e.kind)?'«'+e.kind+'»':'');
 const pad=Math.max(22,Math.min(220,caption.length*3.6)),x=Math.min(...points.map(p=>p.x))-pad,y=Math.min(...points.map(p=>p.y))-28,w=Math.max(1,Math.max(...points.map(p=>p.x))-x+pad),h=Math.max(1,Math.max(...points.map(p=>p.y))-y+28);
 const local=points.map(p=>({x:p.x-x,y:p.y-y})),color=escape(node.styles.color??'#9eafc5'),marker=node.id+'-end',start=node.id+'-start';
 const arrow=e.kind==='generalization'||e.kind==='realization'?'<path d="M1 1L11 6 1 11Z" fill="#171717" stroke="'+color+'" stroke-width="1.5"/>':e.kind==='one-many'?'<path d="M1 6h10M3 1l8 5-8 5" fill="none" stroke="'+color+'" stroke-width="1.5"/>':(e.kind==='message'||e.kind==='extension')?'<path d="M1 1L11 6 1 11Z" fill="'+color+'"/>':'<path d="M2 1L10 6 2 11" fill="none" stroke="'+color+'" stroke-width="1.5"/>';
 const hasEnd=!['association','aggregation','composition','assembly'].includes(e.kind),hasStart=['aggregation','composition'].includes(e.kind),dash=['dependency','realization','reply','include','extend'].includes(e.kind)?' stroke-dasharray="6 5"':'',path=pathForPoints(local,e.route==='curved');
 let body='<defs><marker id="'+marker+'" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="12" markerHeight="12" orient="auto" markerUnits="userSpaceOnUse">'+arrow+'</marker><marker id="'+start+'" viewBox="0 0 18 12" refX="1" refY="6" markerWidth="18" markerHeight="12" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 6L9 1 17 6 9 11Z" fill="'+(e.kind==='composition'?color:'#171717')+'" stroke="'+color+'"/></marker></defs>';
 body+='<path d="'+path+'" fill="none" stroke="transparent" stroke-width="20" pointer-events="stroke" data-edge-hit="true"/><path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="1.6" pointer-events="none"'+dash+(hasEnd?' marker-end="url(#'+marker+')"':'')+(hasStart?' marker-start="url(#'+start+')"':'')+'/>';
 const text=(label:string,p:Point)=>'<g pointer-events="none"><rect x="'+(p.x-label.length*3.3-6)+'" y="'+(p.y-13)+'" width="'+(label.length*6.6+12)+'" height="20" rx="4" fill="#171717"/><text x="'+p.x+'" y="'+p.y+'" text-anchor="middle" fill="#c7d6e8" font-family="system-ui,sans-serif" font-size="11">'+escape(label)+'</text></g>';
 if(caption){const i=Math.max(1,Math.floor(local.length/2)),a=local[i-1],b=local[i];body+=text((e.sequence&&diagramFrame(nodes,node.id)?.diagram?.kind==='communication'?e.sequence+'. ':'')+caption,{x:(a.x+b.x)/2,y:(a.y+b.y)/2-8});}
 if(e.startLabel)body+=text(e.startLabel,{x:local[0].x+20,y:local[0].y-12});if(e.endLabel)body+=text(e.endLabel,{x:local.at(-1)!.x-20,y:local.at(-1)!.y-12});
 const result={...node,x,y,width:w,height:h,source:svgDocument(body,w,h),styles:{...node.styles,fill:'transparent',borderWidth:0,borderColor:undefined,overflow:'visible' as const,zIndex:0}};generatedEdges.set(result,result.source);return result;
}
export function resolveDiagramNodes(nodes:DesignNode[]):DesignNode[]{
 if(!nodes.some(n=>n.diagramElement||n.diagramEdge))return nodes;
 return nodes.map(n=>n.diagramElement?{...n,source:diagramShapeSvg(n),styles:{...n.styles,fill:'transparent',borderColor:undefined,overflow:'visible',zIndex:CONTAINERS.has(n.diagramElement.kind)?0:1}}:n.diagramEdge?edgeDrawing(n,nodes):n);
}
export function featureErrors(project:DesignProject):string[]{
 const errors:string[]=[],all=project.pages.flatMap(p=>p.nodes);
 for(const page of project.pages){
  errors.push(...validateStateNodes(page.nodes,all));
  const index=new Map(page.nodes.map(n=>[n.id,n]));
  for(const n of page.nodes){
   if(n.diagram&&(n.type!=='frame'||n.parentId!==null))errors.push(n.name+': diagram roots must be top-level frames');
   if(n.diagramElement&&!stencilById.has(n.diagramElement.kind))errors.push(n.name+': unknown stencil '+n.diagramElement.kind);
   if((n.diagramElement||n.diagramEdge)&&(n.type!=='code'||n.react||n.live))errors.push(n.name+': diagrams require passive code nodes');
   if(n.diagramElement?.start&&n.diagramElement.end&&n.diagramElement.end<n.diagramElement.start)errors.push(n.name+': end date must follow start date');
   if(n.diagramEdge){
    const frame=diagramFrame(page.nodes,n.id),e=n.diagramEdge,a=index.get(e.from.nodeId),b=index.get(e.to.nodeId);
    if(!frame||n.parentId!==frame.id)errors.push(n.name+': connector must belong directly to a diagram frame');
    if(!a?.diagramElement||!b?.diagramElement||diagramFrame(page.nodes,a.id)?.id!==frame?.id||diagramFrame(page.nodes,b.id)?.id!==frame?.id)errors.push(n.name+': both endpoints must reference nodes in the same diagram');
    if(frame&&!diagramById.get(frame.diagram!.kind)!.relations.includes(e.kind))errors.push(n.name+': '+e.kind+' is not a relationship in this diagram');
    if(e.kind==='assembly'&&a&&b&&![a.diagramElement?.kind,b.diagramElement?.kind].every(k=>['component','part','composite','port','provided','required'].includes(k??'')))errors.push('Assembly connects components, parts, ports or interfaces');
    if(e.kind==='generalization'&&a&&b&&a.diagramElement?.kind!==b.diagramElement?.kind)errors.push('Generalization requires matching classifier kinds');
   }
  }
 }
 for(const c of project.designSystem.components)errors.push(...validateStateNodes(c.nodes,[...all,...c.nodes]));
 return errors;
}
export function remapFeatureReferences(node:DesignNode,map:ReadonlyMap<string,string>){
 if(node.diagramEdge){const a=map.get(node.diagramEdge.from.nodeId),b=map.get(node.diagramEdge.to.nodeId);node.diagramEdge={...node.diagramEdge,from:{...node.diagramEdge.from,nodeId:a??node.diagramEdge.from.nodeId},to:{...node.diagramEdge.to,nodeId:b??node.diagramEdge.to.nodeId}};}
 if(node.stateBinding&&map.has(node.stateBinding.contextNodeId))node.stateBinding={...node.stateBinding,contextNodeId:map.get(node.stateBinding.contextNodeId)!};
 if(node.stateRules)node.stateRules=node.stateRules.map(r=>({...r,effects:r.effects.map(e=>({...e,targetNodeId:map.get(e.targetNodeId)??e.targetNodeId}))}));
 if(node.journey&&map.has(node.journey.targetNodeId))node.journey={...node.journey,targetNodeId:map.get(node.journey.targetNodeId)!};
}
export function crossingCount(nodes:DesignNode[]):number{
 const routes=nodes.filter(n=>n.diagramEdge).map(n=>({node:n,points:edgePoints(n,nodes)}));let count=0;
 for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++){const a=routes[i],b=routes[j];if([a.node.diagramEdge!.from.nodeId,a.node.diagramEdge!.to.nodeId].some(id=>[b.node.diagramEdge!.from.nodeId,b.node.diagramEdge!.to.nodeId].includes(id)))continue;
  for(let u=1;u<a.points.length;u++)for(let v=1;v<b.points.length;v++){const p=a.points[u-1],q=a.points[u],r=b.points[v-1],s=b.points[v];const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(cross(p,q,r)*cross(p,q,s)<0&&cross(r,s,p)*cross(r,s,q)<0)count++;}
 }return count;
}
