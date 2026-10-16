import { Worker } from 'node:worker_threads';
import type { DesignPage, DesignProject, Operation } from '../shared/types';
import type { DiagramLayoutResult } from '../shared/diagram-layout-types';
import { diagramFrame } from '../shared/diagrams';
export function layoutDiagram(project:DesignProject,pageId:string,frameId:string,signal?:AbortSignal):Promise<DiagramLayoutResult>{
 const page=project.pages.find(p=>p.id===pageId);if(!page)throw Error('Page does not exist.');
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('../dist/diagram-layout-worker.mjs',import.meta.url));let done=false;
  const finish=(error?:Error,value?:any)=>{if(done)return;done=true;clearTimeout(timeout);signal?.removeEventListener('abort',abort);void worker.terminate();if(error)reject(error);else resolve({frameId,revision:project.revision,...value});};
  const abort=()=>finish(new Error('Layout cancelled.'));
  const timeout=setTimeout(()=>finish(new Error('Layout took too long. Pin settled groups or split this diagram into smaller frames.')),15000);
  worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!done)finish(new Error('Layout worker exited ('+code+').'));});
  worker.on('message',value=>value.error?finish(new Error(value.error)):finish(undefined,value));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
  worker.postMessage({nodes:page.nodes,pageId,frameId});
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
