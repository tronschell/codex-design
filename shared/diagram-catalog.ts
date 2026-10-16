import type { DesignNode } from './types';
import { DIAGRAM_KINDS, type DiagramKind, type RelationKind } from './diagram-types';
export interface Stencil { id: string; name: string; group: 'Elements'|'Interfaces'|'Structure'|'Content'; width: number; height: number; subtitle?: string; rows?: string[]; operations?: string[] }
const shape=(id:string,name:string,width=220,height=130,group:Stencil['group']='Elements',extra:Partial<Stencil>={}):Stencil=>({id,name,width,height,group,...extra});
export const STENCILS:Stencil[]=[
 shape('service','Service'),shape('api','External API'),shape('database','Database',220,150),shape('events','Event source'),shape('queue','Event stream'),shape('transform','Transformation'),shape('model','Data model',240,180,'Elements',{rows:['id: uuid · PK','name: text','created_at: timestamp']}),shape('table','Table',240,200,'Elements',{rows:['id: uuid · PK','account_id: uuid · FK','name: text']}),shape('storage','Object store'),shape('metrics','Semantic model'),shape('dashboard','Dashboard'),
 shape('class','Class',240,214,'Elements',{rows:['+ id: UUID','− status: String'],operations:['+ create(): Order','+ total(): Money']}),shape('interface','Interface',240,180,'Interfaces',{operations:['+ execute(): Result']}),shape('object','Object',240,180,'Elements',{rows:['id = "ORD-1042"','status = "pending"']}),shape('component','Component',240,144,'Elements',{rows:['provides OrdersAPI','requires PaymentsAPI']}),shape('provided','Provided interface',150,80,'Interfaces'),shape('required','Required interface',150,80,'Interfaces'),shape('port','Port',28,28),
 shape('device','Device',260,180,'Structure'),shape('environment','Execution environment',260,180,'Structure'),shape('artifact','Artifact',210,130),shape('package','Package',280,200,'Structure'),shape('profile','Profile',280,200,'Structure'),shape('stereotype','Stereotype',240,180,'Elements',{rows:['version: String','owner: String']}),shape('metaclass','Metaclass',220,120),shape('composite','Composite structure',340,240,'Structure'),shape('part','Part',200,100),shape('boundary','Boundary',440,280,'Structure'),
 shape('actor','Actor',100,140),shape('usecase','Use case',200,100),shape('action','Action',200,90),shape('decision','Decision / merge',120,100),shape('initial','Initial node',28,28),shape('final','Final node',36,36),shape('fork','Fork / join',200,12),shape('lane','Swimlane',440,300,'Structure'),shape('state','State',230,154,'Elements',{rows:['entry / initialize()','exit / cleanup()']}),shape('history','History',36,36),shape('lifeline','Lifeline',160,420),shape('activation','Execution',18,100),shape('fragment','Combined fragment',440,260,'Structure'),shape('ref','Interaction use',240,110),shape('timing','Timing track',440,150,'Elements',{rows:['Idle','Active','Complete']}),shape('comment','Comment',210,130,'Content'),
 shape('journey-stage','Journey stage',240,300,'Content',{rows:['Action: Discover the product','Touchpoint: Website','Thought: Is this right for me?','Opportunity: Explain the value']}),shape('initiative','Initiative',260,100,'Content'),shape('milestone','Milestone',120,80,'Content'),shape('set','Set',260,260,'Content',{rows:['Member A','Member B']}),shape('intersection','Intersection label',160,60,'Content')
];
export const stencilById=new Map(STENCILS.map(s=>[s.id,s]));
export interface DiagramFamily {id:DiagramKind;name:string;family:'Architecture & data'|'UML · Structural'|'UML · Behavioral'|'Planning';description:string;stencils:string[];relations:RelationKind[];layout:'graph'|'sequence'|'timing'|'roadmap'|'journey'|'sets'}
const family=(id:DiagramKind,name:string,group:DiagramFamily['family'],description:string,stencils:string[],relations:RelationKind[]=['flow'],layout:DiagramFamily['layout']='graph'):DiagramFamily=>({id,name,family:group,description,stencils,relations,layout});
export const DIAGRAMS:DiagramFamily[]=[
 family('architecture','Architecture','Architecture & data','Systems, services and infrastructure',['service','api','database','queue','events','storage','boundary','comment'],['flow','dependency']),
 family('data','Data architecture','Architecture & data','Schemas, lineage and pipelines',['database','table','events','queue','transform','model','metrics','dashboard','storage','comment'],['flow','one-many','dependency']),
 family('flowchart','Flowchart','Planning','Decisions, branches and swimlanes',['action','decision','initial','final','lane','comment'],['flow']),
 family('journey','User journey','Planning','Stages, touchpoints and opportunities',['journey-stage','action','decision','comment'],['flow','transition'],'journey'),
 family('roadmap','Roadmap','Planning','Initiatives, dates and dependencies',['initiative','milestone','lane','comment'],['dependency'],'roadmap'),
 family('venn','Venn & sets','Planning','Sets, membership and intersections',['set','intersection','comment'],['association'],'sets'),
 family('class','Class','UML · Structural','Types, members and relationships',['class','interface','package','comment'],['association','generalization','realization','aggregation','composition','dependency']),
 family('component','Component','UML · Structural','Components, interfaces and dependencies',['component','port','provided','required','comment'],['dependency','realization','assembly']),
 family('deployment','Deployment','UML · Structural','Runtime nodes and deployed artifacts',['device','environment','artifact','component','comment'],['association','dependency']),
 family('object','Object','UML · Structural','Instances, slots and links',['object','comment'],['association']),
 family('package','Package','UML · Structural','Namespaces and package dependencies',['package','class','comment'],['dependency','association']),
 family('profile','Profile','UML · Structural','Stereotypes, extensions and tagged values',['profile','stereotype','metaclass','comment'],['extension','generalization','dependency']),
 family('composite','Composite structure','UML · Structural','Parts, ports and internal connectors',['composite','part','port','provided','required','comment'],['assembly','association','dependency']),
 family('use-case','Use case','UML · Behavioral','Actors, goals and system boundaries',['actor','usecase','boundary','comment'],['association','include','extend','generalization']),
 family('activity','Activity','UML · Behavioral','Actions, control flow and partitions',['action','decision','fork','initial','final','lane','comment'],['flow']),
 family('state-machine','State machine','UML · Behavioral','States, events, guards and transitions',['state','initial','final','history','decision','fork','comment'],['transition']),
 family('sequence','Sequence','UML · Behavioral','Lifelines, ordered messages and fragments',['lifeline','activation','fragment','ref','comment'],['message','reply'],'sequence'),
 family('communication','Communication','UML · Behavioral','Participants and numbered messages',['object','actor','comment'],['message','reply','association']),
 family('interaction-overview','Interaction overview','UML · Behavioral','Control flow between interactions',['ref','decision','fork','initial','final','comment'],['flow']),
 family('timing','Timing','UML · Behavioral','State tracks and time constraints',['timing','comment'],['message'],'timing')
];
export const diagramById=new Map(DIAGRAMS.map(s=>[s.id,s]));
export const CONTAINERS=new Set(['boundary','package','profile','device','environment','composite','lane','fragment']);
export function makeDiagramElement(id:string,parentId:string,kind:string,x:number,y:number,name?:string):DesignNode {
 const s=stencilById.get(kind);if(!s)throw Error('Unknown diagram stencil: '+kind);
 return {id,type:'code',name:name||s.name,parentId,x,y,width:s.width,height:s.height,styles:{fill:'transparent',overflow:'visible'},diagramElement:{kind,subtitle:s.subtitle,rows:s.rows?[...s.rows]:undefined,operations:s.operations?[...s.operations]:undefined,...(kind==='initiative'?{start:new Date().toISOString().slice(0,10),end:new Date(Date.now()+28*86400000).toISOString().slice(0,10),lane:'Planned'}:{})}};
}
export function makeDiagram(id:string,kind:DiagramKind,x:number,y:number,name?:string,template=true):DesignNode[] {
 const pack=diagramById.get(kind);if(!pack)throw Error('Unknown diagram type');
 const frame:DesignNode={id,type:'frame',name:name||pack.name,parentId:null,x,y,width:1200,height:760,styles:{fill:'#171717',borderColor:'#3a3a3a',borderWidth:1,radius:8,overflow:'visible'},diagram:{kind,autoPlace:pack.layout==='graph',direction:'RIGHT',spacing:'comfortable'}};
 if(!template)return[frame];
 const examples:Partial<Record<DiagramKind,[string,string][]>>={
  architecture:[['service','Web application'],['service','Order service'],['database','Orders database']],
  data:[['database','Orders'],['transform','Normalize orders'],['model','Orders model'],['dashboard','Revenue dashboard']],
  flowchart:[['initial','Start'],['action','Review request'],['decision','Approved?'],['action','Fulfill request']],
  class:[['class','Customer'],['class','Order'],['class','Line item']],
  component:[['component','Web storefront'],['component','Order service'],['component','Payment gateway']],
  deployment:[['device','Application host'],['environment','Node.js runtime'],['artifact','orders-service.jar']],
  object:[['object','customer42 : Customer'],['object','order1042 : Order']],
  package:[['package','Commerce'],['package','Payments']],profile:[['stereotype','Service'],['metaclass','Component']],
  composite:[['composite','Checkout'],['part','orders : OrderService'],['part','payment : PaymentService']],
  'use-case':[['actor','Member'],['usecase','Browse collection'],['usecase','Export collection']],
  activity:[['initial','Start'],['action','Validate order'],['decision','In stock?'],['action','Ship order'],['final','Complete']],
  'state-machine':[['initial','Start'],['state','Draft'],['state','Submitted'],['state','Fulfilled']],
  sequence:[['lifeline','Member'],['lifeline','Web application'],['lifeline','Order service']],
  communication:[['object','member : User'],['object','web : Application'],['object','orders : Service']],
  'interaction-overview':[['initial','Start'],['ref','Authenticate'],['decision','Authorized?'],['ref','Checkout'],['final','Complete']],
  timing:[['timing','Order lifecycle'],['timing','Payment lifecycle']],
  journey:[['journey-stage','Discover'],['journey-stage','Evaluate'],['journey-stage','Join'],['journey-stage','Use']],
  roadmap:[['initiative','Research'],['initiative','Build'],['milestone','Launch']],
  venn:[['set','Product'],['set','Engineering'],['set','Design']]
 };
 const specs=examples[kind]??[],nodes=specs.map(([k,n],i)=>makeDiagramElement(id+'-node-'+(i+1),id,k,60+i*310,100,n));
 if(kind==='venn')nodes.forEach((n,i)=>{n.x=260+(i%2)*190;n.y=160+(i===2?150:0);n.diagramElement!.color=['#76b8ec','#bda7ed','#87c9b5'][i];});
 if(kind==='timing')nodes.forEach((n,i)=>{n.x=100;n.y=100+i*220;});
 if(kind==='roadmap')nodes.forEach((n,i)=>{n.diagramElement!.start=new Date(Date.now()+i*21*86400000).toISOString().slice(0,10);n.diagramElement!.end=new Date(Date.now()+(i*21+20)*86400000).toISOString().slice(0,10);n.diagramElement!.lane=i<2?'Product':'Release';});
 const edges:DesignNode[]=pack.layout==='sets'||pack.layout==='timing'?[]:nodes.slice(1).map((n,i)=>({id:id+'-edge-'+(i+1),type:'code',name:'Connection '+(i+1),parentId:id,x:0,y:0,width:1,height:1,styles:{fill:'transparent',overflow:'visible'},diagramEdge:{from:{nodeId:nodes[i].id,port:pack.layout==='sequence'?'auto':'e50'},to:{nodeId:n.id,port:pack.layout==='sequence'?'auto':'w50'},kind:pack.relations[0],label:pack.layout==='sequence'?(i===0?'Submit order':'Create order'):'',route:pack.layout==='sequence'?'straight':'orthogonal',sequence:i+1}}));
 return[frame,...edges,...nodes];
}
export { DIAGRAM_KINDS };
