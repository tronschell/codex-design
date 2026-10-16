import { useMemo } from 'react';
import type { DesignProject } from '../shared/types';
import type { StatePreview } from '../shared/application-state-types';
import { diffStateNodes, resolveState, stateSubtree } from '../shared/application-state';
import { resolvedNodes } from '../shared/export';
export function useApplicationPreview(project:DesignProject|null,pageId:string|undefined,preview:StatePreview|null){
 return useMemo(()=>{
  if(!project||!pageId||!preview)return{project,error:'',differences:[],values:{}};
  try{
   const result=resolveState(project,pageId,preview);
   const before=preview.compareScenarioId?resolveState(project,pageId,{frameId:preview.frameId,scenarioId:preview.compareScenarioId,values:{}}).nodes:preview.baselineValues?resolveState(project,pageId,{frameId:preview.frameId,values:preview.baselineValues}).nodes:project.pages.find(p=>p.id===pageId)!.nodes;
   const after=resolvedNodes(result.nodes,project.designSystem);
   return{project:{...project,pages:project.pages.map(page=>page.id===pageId?{...page,nodes:result.nodes}:page)},error:'',differences:diffStateNodes(resolvedNodes(before,project.designSystem),after,stateSubtree(after,preview.frameId),result.provenance),values:result.values};
  }catch(error){return{project,error:error instanceof Error?error.message:'Could not preview this state.',differences:[],values:{}};}
 },[project,pageId,preview]);
}
