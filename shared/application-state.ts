import type { DesignNode, DesignProject } from './types';
import type { ApplicationStateContext, StateCondition, StatePropertyPatch, StatePreview, StateRule, StateValue, StateValues } from './application-state-types';
import { visualBounds } from './effects';
export interface StateDifference { nodeId:string; name:string; kind:'Added'|'Hidden'|'Changed'|'Moved'; properties:{property:string;before:unknown;after:unknown;rule?:string}[]; before?:{x:number;y:number;width:number;height:number}; after?:{x:number;y:number;width:number;height:number} }
export const stateDefaults=(context:ApplicationStateContext):StateValues=>Object.fromEntries(context.variables.map(v=>[v.id,v.default]));
export function conditionMatches(condition:StateCondition,values:StateValues):boolean {
 if('all'in condition)return condition.all.every(c=>conditionMatches(c,values));
 if('any'in condition)return condition.any.some(c=>conditionMatches(c,values));
 return'eq'in condition?Object.is(values[condition.key],condition.eq):condition.in.some(v=>Object.is(values[condition.key],v));
}
export function validateValues(context:ApplicationStateContext,values:StateValues,partial=false):string[] {
 const errors:string[]=[],known=new Set(context.variables.map(v=>v.id));
 for(const key of Object.keys(values))if(!known.has(key))errors.push('Unknown state input: '+key);
 for(const v of context.variables){
  if(partial&&!Object.hasOwn(values,v.id))continue;const x=values[v.id];
  if(v.type==='enum'&&(typeof x!=='string'||!v.options?.includes(x)))errors.push(v.name+': choose '+(v.options??[]).join(', '));
  if(v.type==='boolean'&&typeof x!=='boolean')errors.push(v.name+': use true or false');
  if(v.type==='number'&&(typeof x!=='number'||!Number.isFinite(x)||(v.min!==undefined&&x<v.min)||(v.max!==undefined&&x>v.max)))errors.push(v.name+': number outside its allowed range');
  if(v.type==='string'&&(typeof x!=='string'||x.length>(v.max??2000)||x.length<(v.min??0)))errors.push(v.name+': text outside its allowed length');
 }
 if(!partial&&!errors.length)for(const c of context.constraints??[])if(conditionMatches(c.forbidden,values))errors.push(c.message);
 return errors;
}
function validateCondition(context:ApplicationStateContext,c:StateCondition):string[] {
 if('all'in c||'any'in c)return('all'in c?c.all:c.any).flatMap(v=>validateCondition(context,v));
 return('eq'in c?[c.eq]:c.in).flatMap(value=>validateValues(context,{[c.key]:value},true));
}
type Clause=Map<string,StateValue[]>;
function clauses(c:StateCondition):Clause[]{
 if('any'in c)return c.any.flatMap(clauses).slice(0,1025);
 if('all'in c){
  let out:Clause[]=[new Map()];
  for(const child of c.all){const next:Clause[]=[];for(const a of out)for(const b of clauses(child)){const merged=new Map(a);let valid=true;for(const [key,values]of b){const prior=merged.get(key),intersection=prior?prior.filter(x=>values.some(y=>Object.is(x,y))):values;if(!intersection.length){valid=false;break;}merged.set(key,intersection);}if(valid)next.push(merged);if(next.length>1024)throw Error('Simplify conditions: more than 1,024 alternatives');}out=next;}
  return out;
 }
 return[new Map([[c.key,'eq'in c?[c.eq]:c.in]])];
}
function overlap(a:StateCondition,b:StateCondition):boolean {
 const left=clauses(a),right=clauses(b);if(left.length>1024||right.length>1024)throw Error('Simplify rule conditions');
 return left.some(x=>right.some(y=>[...x].every(([k,v])=>!y.has(k)||v.some(t=>y.get(k)!.some(u=>Object.is(t,u))))));
}
const entries=(set:StatePropertyPatch):[string,unknown][]=>Object.entries(set).flatMap(([k,v])=>k==='styles'?Object.entries(v as object).map(([s,value])=>['styles.'+s,value] as [string,unknown]):[[k,v]]);
export function stateSubtree(nodes:DesignNode[],root:string):Set<string>{
 const children=new Map<string,string[]>();for(const n of nodes)if(n.parentId)children.set(n.parentId,[...(children.get(n.parentId)??[]),n.id]);
 const ids=new Set<string>(),pending=[root];while(pending.length){const id=pending.pop()!;if(ids.has(id))continue;ids.add(id);pending.push(...(children.get(id)??[]));}return ids;
}
export function findStateOwner(nodes:DesignNode[],nodeId:string):DesignNode|undefined{
 const index=new Map(nodes.map(n=>[n.id,n])),seen=new Set<string>();let n=index.get(nodeId);
 while(n&&!seen.has(n.id)){if(n.applicationState||n.stateBinding)return n;seen.add(n.id);n=n.parentId?index.get(n.parentId):undefined;}return undefined;
}
export function stateContextFor(project:DesignProject,node:DesignNode):{owner:DesignNode;context:ApplicationStateContext}|undefined{
 const all=[...project.pages.flatMap(p=>p.nodes),...project.designSystem.components.flatMap(c=>c.nodes)];
 const owner=node.stateBinding&&node.stateBinding.contextNodeId!==node.id?all.find(n=>n.id===node.stateBinding!.contextNodeId):node;
 return owner?.applicationState?{owner,context:owner.applicationState}:undefined;
}
export function validateStateNodes(nodes:DesignNode[],allNodes:DesignNode[]=nodes):string[]{
 const errors:string[]=[],all=new Map([...allNodes,...nodes].map(n=>[n.id,n])),globalWriters=new Map<string,{rule:StateRule;owner:string}[]>();
 for(const node of nodes){
  const contextNode=node.stateBinding&&node.stateBinding.contextNodeId!==node.id?all.get(node.stateBinding.contextNodeId):node,context=contextNode?.applicationState;
  if(node.applicationState){
   const c=node.applicationState,ids=new Set<string>();for(const v of c.variables){if(ids.has(v.id))errors.push('Duplicate state input '+v.id);ids.add(v.id);if(v.type==='enum'&&(!v.options?.length||new Set(v.options).size!==v.options.length))errors.push(v.name+': enum options must be unique');if(v.min!==undefined&&v.max!==undefined&&v.min>v.max)errors.push(v.name+': minimum exceeds maximum');}
   errors.push(...validateValues(c,stateDefaults(c)));const scenarios=new Set<string>();for(const s of c.scenarios){if(scenarios.has(s.id))errors.push('Duplicate scenario '+s.id);scenarios.add(s.id);errors.push(...validateValues(c,s.values).map(e=>s.name+': '+e));}
   for(const constraint of c.constraints??[])errors.push(...validateCondition(c,constraint.forbidden));
  }
  if(node.stateBinding&&!context)errors.push(node.name+': state context no longer exists');
  if(node.stateBinding?.inputs&&context)errors.push(...validateValues(context,node.stateBinding.inputs,true));
  if(node.stateRules?.length){
   if(!context){errors.push(node.name+': rules require an application context');continue;}
   const scope=stateSubtree(nodes,node.id),ruleIds=new Set<string>(),writers=new Map<string,StateRule[]>();
   for(const rule of node.stateRules){
    if(ruleIds.has(rule.id))errors.push('Duplicate state rule '+rule.id);ruleIds.add(rule.id);errors.push(...validateCondition(context,rule.when));
    for(const effect of rule.effects){
     if(!scope.has(effect.targetNodeId))errors.push(rule.name+': target '+effect.targetNodeId+' is outside its owning component/frame');
     for(const [key]of entries(effect.set)){
      const property=effect.targetNodeId+'/'+key;
      if(rule.enabled){for(const prior of globalWriters.get(property)??[])if(prior.owner!==node.id&&prior.rule.priority===rule.priority){try{if(overlap(prior.rule.when,rule.when))errors.push('Ambiguous parent/component rules '+prior.rule.id+' and '+rule.id+' write '+property+' at priority '+rule.priority);}catch(e){errors.push((e as Error).message);}}globalWriters.set(property,[...(globalWriters.get(property)??[]),{rule,owner:node.id}]);}
      if(rule.enabled){for(const old of writers.get(property)??[])if(old.priority===rule.priority){try{if(overlap(old.when,rule.when))errors.push('Ambiguous rules '+old.id+' and '+rule.id+' write '+property+' at priority '+rule.priority);}catch(e){errors.push((e as Error).message);}}writers.set(property,[...(writers.get(property)??[]),rule]);}
     }
    }
   }
  }
  if(node.journey){
   const target=all.get(node.journey.targetNodeId);if(!target||target.type!=='frame')errors.push(node.name+': journey destination must be an existing frame');
   const owner=findStateOwner(nodes,node.id),source=owner?(owner.stateBinding?all.get(owner.stateBinding.contextNodeId):owner):undefined;
   if(!source?.applicationState)errors.push(node.name+': journey transitions require an application context');
   else{if(node.journey.when)errors.push(...validateCondition(source.applicationState,node.journey.when));if(node.journey.set)errors.push(...validateValues(source.applicationState,node.journey.set,true));if(target){const targetContext=target.stateBinding?.contextNodeId??(target.applicationState?target.id:undefined);if(targetContext!==source.id)errors.push(node.name+': destination must follow the same state context');}}
  }
 }
 return errors;
}
export function resolveState(project:DesignProject,pageId:string,preview:Pick<StatePreview,'frameId'|'scenarioId'|'values'>){
 const page=project.pages.find(p=>p.id===pageId);if(!page)throw Error('State preview page does not exist');
 const frame=page.nodes.find(n=>n.id===preview.frameId);if(!frame)throw Error('State preview frame does not exist');
 const found=stateContextFor(project,frame);if(!found)throw Error('Bind this frame to a state context first');
 const {context}=found,scenario=preview.scenarioId?context.scenarios.find(s=>s.id===preview.scenarioId):undefined;
 if(preview.scenarioId&&!scenario)throw Error('The selected scenario no longer exists');
 const values={...stateDefaults(context),...scenario?.values,...preview.values,...frame.stateBinding?.inputs};
 const errors=validateValues(context,values);if(errors.length)throw Error(errors.join('; '));
 const scope=stateSubtree(page.nodes,frame.id),result=new Map<string,DesignNode>(),provenance:Record<string,Record<string,string>>={},writers=new Map<string,{priority:number;rule:string;value:unknown}>();
 for(const owner of page.nodes.filter(n=>scope.has(n.id)&&n.stateRules?.length)){
  const ownContext=stateContextFor(project,owner)?.context??context;
  const inputs={...stateDefaults(ownContext),...Object.fromEntries(Object.entries(values).filter(([key])=>ownContext.variables.some(v=>v.id===key))),...owner.stateBinding?.inputs};
  const invalid=validateValues(ownContext,inputs);if(invalid.length)throw Error(owner.name+': '+invalid.join('; '));
  for(const rule of owner.stateRules??[])if(rule.enabled&&conditionMatches(rule.when,inputs))for(const effect of rule.effects)for(const [key,value]of entries(effect.set)){
   const path=effect.targetNodeId+'/'+key,old=writers.get(path);
   if(old?.priority===rule.priority)throw Error('Ambiguous rules '+old.rule+' and '+rule.id+' write '+path);
   if(!old||old.priority<rule.priority)writers.set(path,{priority:rule.priority,rule:rule.id,value});
  }
 }
 for(const [path,writer]of writers){const slash=path.indexOf('/'),id=path.slice(0,slash),property=path.slice(slash+1),original=page.nodes.find(n=>n.id===id);if(!original||!scope.has(id))throw Error('Rule target '+id+' is no longer in this frame');
  const n=result.get(id)??{...original,styles:{...original.styles},tokenBindings:original.tokenBindings?{...original.tokenBindings}:undefined};
  if(property.startsWith('styles.')){const key=property.slice(7) as keyof typeof n.styles;Object.assign(n.styles,{[key]:writer.value});if(n.tokenBindings)delete(n.tokenBindings as Record<string,string>)[key];}
  else Object.assign(n,{[property]:writer.value});
  (provenance[id]??={})[property]=writer.rule;result.set(id,n);
 }
 for(const original of page.nodes)if(scope.has(original.id)&&original.react){const localOwner=findStateOwner(page.nodes,original.id),localContext=localOwner?stateContextFor(project,localOwner)?.context:undefined,reactValues=localContext?{...stateDefaults(localContext),...Object.fromEntries(Object.entries(values).filter(([key])=>localContext.variables.some(v=>v.id===key))),...localOwner?.stateBinding?.inputs}:values;const invalid=validateValues(localContext??context,reactValues);if(invalid.length)throw Error(invalid.join('; '));const n=result.get(original.id)??{...original};n.react={...original.react,props:{...original.react.props,canvasState:reactValues}};result.set(n.id,n);(provenance[n.id]??={})['react.props.canvasState']='Selected application state';}
 return{nodes:page.nodes.map(n=>result.get(n.id)??n),values,context,contextNodeId:found.owner.id,frame,provenance};
}
function effectivelyHidden(node:DesignNode,index:Map<string,DesignNode>){const seen=new Set<string>();let n:DesignNode|undefined=node;while(n&&!seen.has(n.id)){if(n.hidden)return true;seen.add(n.id);n=n.parentId?index.get(n.parentId):undefined;}return false;}
export function diffStateNodes(before:DesignNode[],after:DesignNode[],scope:Set<string>,provenance:Record<string,Record<string,string>>={}):StateDifference[]{
 const a=new Map(before.map(n=>[n.id,n])),b=new Map(after.map(n=>[n.id,n])),diffs:StateDifference[]=[];
 for(const n of after){if(!scope.has(n.id))continue;const old=a.get(n.id);if(!old)continue;
  const wasHidden=effectivelyHidden(old,a),isHidden=effectivelyHidden(n,b);if(wasHidden&&isHidden)continue;
  // A hidden parent is a single removal/addition, not a separate report for every descendant.
  if(n.parentId){const pa=a.get(n.parentId),pb=b.get(n.parentId);if(pa&&pb&&effectivelyHidden(pa,a)!==effectivelyHidden(pb,b))continue;}
  const oldBox=visualBounds(old,before),newBox=visualBounds(n,after),properties:StateDifference['properties']=[];
  if(wasHidden!==isHidden)properties.push({property:'visibility',before:wasHidden?'Hidden':'Visible',after:isHidden?'Hidden':'Visible',rule:provenance[n.id]?.hidden});
  for(const key of ['content','name'] as const)if(old[key]!==n[key])properties.push({property:key,before:old[key]??'',after:n[key]??'',rule:provenance[n.id]?.[key]});
  for(const key of new Set([...Object.keys(old.styles),...Object.keys(n.styles)])){const prop=key as keyof typeof n.styles;if(JSON.stringify(old.styles[prop])!==JSON.stringify(n.styles[prop]))properties.push({property:'styles.'+key,before:old.styles[prop],after:n.styles[prop],rule:provenance[n.id]?.['styles.'+key]});}
  if(JSON.stringify(old.react?.props)!==JSON.stringify(n.react?.props))properties.push({property:'React state inputs',before:old.react?.props?.canvasState,after:n.react?.props?.canvasState,rule:'Selected application state'});
  const moved=JSON.stringify(oldBox)!==JSON.stringify(newBox);if(moved)properties.push({property:'bounds',before:oldBox,after:newBox});
  if(properties.length)diffs.push({nodeId:n.id,name:n.name,kind:wasHidden?'Added':isHidden?'Hidden':moved&&properties.length===1&&(oldBox.x!==newBox.x||oldBox.y!==newBox.y)?'Moved':'Changed',properties,before:oldBox,after:newBox});
 }
 return diffs;
}
export function membershipContext():ApplicationStateContext {
 return{name:'Member experience',variables:[{id:'membership',name:'Membership',type:'enum',default:'free',options:['free','pro','team']},{id:'billing',name:'Billing',type:'enum',default:'current',options:['current','needs-attention']},{id:'onboarding',name:'Onboarding complete',type:'boolean',default:true}],scenarios:[{id:'free',name:'Free member',values:{membership:'free',billing:'current',onboarding:true}},{id:'pro',name:'Pro member',values:{membership:'pro',billing:'current',onboarding:true}},{id:'payment',name:'Payment issue',values:{membership:'pro',billing:'needs-attention',onboarding:true}},{id:'new',name:'New member',values:{membership:'free',billing:'current',onboarding:false}}],constraints:[{id:'no-free-invoice',message:'Free members cannot have an overdue paid invoice. Set Billing to current.',forbidden:{all:[{key:'membership',eq:'free'},{key:'billing',eq:'needs-attention'}]}}]};
}

// A portable frame/component carries its context even when the source lived on another page.
export function portableStateNodes(nodes:DesignNode[],allNodes:DesignNode[]):DesignNode[]{
 const ids=new Set(nodes.map(n=>n.id)),all=new Map(allNodes.map(n=>[n.id,n]));
 return nodes.map(original=>{
  const node=structuredClone(original);
  if(node.stateBinding&&!ids.has(node.stateBinding.contextNodeId)){
   const source=all.get(node.stateBinding.contextNodeId);
   if(source?.applicationState){node.applicationState=structuredClone(source.applicationState);node.stateBinding={...node.stateBinding,contextNodeId:node.id};}
  }
  if(node.stateRules)node.stateRules=node.stateRules.map(rule=>({...rule,effects:rule.effects.filter(effect=>ids.has(effect.targetNodeId))})).filter(rule=>rule.effects.length);
  if(node.journey&&!ids.has(node.journey.targetNodeId))delete node.journey;
  return node;
 });
}
