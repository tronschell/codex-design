import { Worker } from 'node:worker_threads';
import type { DesignProject, Operation } from '../shared/types';
import type { DiagramLayoutResult } from '../shared/diagram-layout-types';
import { diagramFrame } from '../shared/diagrams';
type Settle=(error?:Error,value?:any)=>void;
let shared:{worker:Worker;pending:Map<number,Settle>;kill:(error:Error)=>void}|undefined,nextRequest=0;
// One long-lived worker: loading the ELK bundle costs about 70–100 ms per start. A stuck layout kills it; the next call starts a fresh one.
function layoutWorker(){
 if(shared)return shared;
 const worker=new Worker(new URL('../dist/diagram-layout-worker.mjs',import.meta.url)),pending=new Map<number,Settle>();
 const kill=(error:Error)=>{if(shared?.worker===worker)shared=undefined;const waiting=[...pending.values()];pending.clear();void worker.terminate();for(const settle of waiting)settle(error);};
 worker.on('error',kill);worker.on('exit',code=>kill(new Error('Layout worker exited ('+code+').')));
 worker.on('message',({id,...value})=>pending.get(id)?.(value.error?new Error(value.error):undefined,value));
 // An idle worker never keeps the process alive; each pending layout's timeout timer does until it settles.
 worker.unref();
 return shared={worker,pending,kill};
}
export function layoutDiagram(project:DesignProject,pageId:string,frameId:string,signal?:AbortSignal):Promise<DiagramLayoutResult>{
 const page=project.pages.find(p=>p.id===pageId);if(!page)throw Error('Page does not exist.');
 return new Promise((resolve,reject)=>{
  const {worker,pending,kill}=layoutWorker(),id=nextRequest++;let done=false;
  const finish:Settle=(error,value)=>{if(done)return;done=true;pending.delete(id);clearTimeout(timeout);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve({frameId,revision:project.revision,...value});};
  // Cancelling drops this caller's result without stopping layouts queued by other callers.
  const abort=()=>finish(new Error('Layout cancelled.'));
  const timeout=setTimeout(()=>{const error=new Error('Layout took too long. Pin settled groups or split this diagram into smaller frames.');finish(error);kill(error);},15000);
  pending.set(id,finish);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
  worker.postMessage({id,nodes:page.nodes,pageId,frameId});
 });
}
export async function autoArrange(project:DesignProject,previous:DesignProject,operations:Operation[]){
 const targets=new Map<string,Set<string>>();
 for(const operation of operations){
  if(!['create_node','delete_node','update_node'].includes(operation.type)||!('pageId'in operation))continue;
  const page=project.pages.find(p=>p.id===operation.pageId),oldPage=previous.pages.find(p=>p.id===operation.pageId);if(!page)continue;
  const id=operation.type==='create_node'?operation.node.id:'nodeId'in operation?operation.nodeId:'';
  const node=page.nodes.find(n=>n.id===id)??oldPage?.nodes.find(n=>n.id===id);
  if(!node)continue;
  if(operation.type==='update_node'){
   const before=oldPage?.nodes.find(n=>n.id===id),edge=operation.patch.diagramEdge;
   const endpointsChanged=!!edge&&JSON.stringify([edge.from,edge.to])!==JSON.stringify([before?.diagramEdge?.from,before?.diagramEdge?.to]);
   if(!operation.patch.diagram&&!endpointsChanged&&!('parentId'in operation.patch))continue;
  }
  const frame=node.diagram?node:diagramFrame(page.nodes,node.id)??(oldPage&&diagramFrame(oldPage.nodes,node.id));
  const current=page.nodes.find(n=>n.id===frame?.id);
  if(!current?.diagram?.autoPlace)continue;
  const ids=targets.get(page.id)??new Set();ids.add(current.id);targets.set(page.id,ids);
 }
 for(const[pageId,ids]of targets)for(const frameId of ids){
  const result=await layoutDiagram(project,pageId,frameId),page=project.pages.find(p=>p.id===pageId)!;
  // Layout is part of the same atomic edit and therefore the same undo entry.
  for(const op of result.operations)if(op.type==='update_node')Object.assign(page.nodes.find(n=>n.id===op.nodeId)!,op.patch);
 }
}
