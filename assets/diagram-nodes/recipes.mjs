
const K={bg:"#171717",body:"#22262c",header:"#292f37",border:"#5b6572",line:"#444d59",text:"#edf1f7",muted:"#b2bdcb",faint:"#8b99aa",blue:"#8bc5f4",violet:"#c1b0ee",green:"#93d1bd",selected:"#4497ff",mono:"ui-monospace, SFMono-Regular, Menlo, monospace",font:"system-ui, -apple-system, BlinkMacSystemFont, sans-serif"};
function makeShape(kind, o={}, icons={}) {
 const id=o.id||"shape-"+kind,w=o.w||280,h=o.h||160, ns=[];
 const add=(type,key,x,y,width,height,styles={},extra={})=>{const n={id:key==="root"?id:id+"--"+key,type,name:key,parentId:key==="root"?null:id,x,y,width,height,styles,...extra};ns.push(n);return n.id;};
 const root=add("rectangle","root",0,0,w,h,{fill:K.body,borderColor:o.selected?K.selected:K.border,borderWidth:o.selected?1.5:1,radius:4},{name:o.name||o.title||kind,notes:"Authored native diagram node. Text and compartments are editable layers; notation geometry is isolated SVG. Routing anchors are not UML Port elements."});
 const rect=(key,x,y,ww,hh,fill=K.header,more={})=>add("rectangle",key,x,y,ww,hh,{fill,...more});
 const text=(key,s,x,y,ww,hh=20,size=12,color=K.text,weight=400,extra={})=>add("text",key,x,y,ww,hh,{fontFamily:K.font,fontSize:size,fontWeight:weight,color,lineHeight:1.35,letterSpacing:0,...extra},{content:s,name:s});
 const rule=(key,y,x=0,ww=w)=>rect(key,x,y,ww,1,K.line);
 const svg=(key,s,x,y,ww,hh)=>add("code",key,x,y,ww,hh,{}, {source:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+ww+' '+hh+'" width="'+ww+'" height="'+hh+'">'+s+'</svg>',notes:"Isolated notation geometry; labels remain native."});
 const icon=(key,name,x,y,size=22,color=K.blue)=>add("code",key,x,y,size,size,{}, {source:(icons[name]||icons.Box||"").replace(/#aeb8c5/g,color),notes:"Lucide "+name+" · lucide-react 0.468.0. ISC / Feather-derived MIT notices in THIRD_PARTY_NOTICES.md."});
 const line=(key,x1,y1,x2,y2,color=K.border,dash="")=>svg(key,'<path d="M'+x1+' '+y1+' L'+x2+' '+y2+'" fill="none" stroke="'+color+'" stroke-width="1.5"'+(dash?' stroke-dasharray="'+dash+'"':'')+' stroke-linecap="round"/>',0,0,w,h);
 const title=o.title||"Order";
 const compact=h<=112;
 const mainHeader=(stereo,titleText=title)=>{
  rect("header",1,1,w-2,58,K.header,{radius:3});
  if(stereo)text("stereotype",stereo,14,9,w-28,16,10.5,K.muted,400,{textAlign:"center"});
  text("title",titleText,14,stereo?28:18,w-28,24,15,K.text,600,{textAlign:"center",...(o.under?{textDecorationLine:"underline"}:{})});
  rule("header-divider",59);
 };
 const member=(key,value,y,slot=false)=>{
  const match=slot?value.match(/^([^=]+)=(.*)$/):value.match(/^([+#~\-])?\s*([^:]+):\s*(.+)$/);
  if(match&&slot){text(key+"-name",match[1].trim(),16,y,w*.42,20,12,K.muted,400,{fontFamily:K.mono});text(key+"-value",match[2].trim(),w*.48,y,w*.52-16,20,12,K.blue,500,{fontFamily:K.mono,textAlign:"right"});}
  else if(match){text(key+"-visibility",match[1]||"+",14,y,16,20,12,K.faint,400,{fontFamily:K.mono});text(key+"-name",match[2].trim(),34,y,w*.46-20,20,12,K.text,400,{fontFamily:K.mono});text(key+"-type",match[3].trim(),w*.48,y,w*.52-16,20,12,K.blue,400,{fontFamily:K.mono,textAlign:"right"});}
  else text(key,value,16,y,w-32,20,12,K.text,400,{fontFamily:K.mono});
 };
 if(["class","interface","stereotype","metaclass","object"].includes(kind)){
  mainHeader(o.stereo||(kind==="object"?"":kind==="interface"?"«interface»":kind==="stereotype"?"«stereotype»":kind==="metaclass"?"«metaclass»":"«entity»"));
  if(kind==="object"){const t=ns.find(n=>n.id===id+"--title");t.styles.textDecorationLine="underline";if(!(o.rows||[]).length){for(const key of ["header","header-divider"]){const index=ns.findIndex(n=>n.id===id+"--"+key);if(index>=0)ns.splice(index,1);}t.y=(h-22)/2;t.styles.fontSize=13;}}
  const rows=o.rows||[],ops=o.operations||[];
  const usable=h-76-(ops.length?ops.length*25+20:0),step=Math.min(kind==="object"?34:26,Math.max(22,usable/Math.max(rows.length,1)));
  rows.forEach((r,i)=>member("member-"+i,r,72+i*step,kind==="object"));
  if(ops.length){const y=rows.length?78+rows.length*step:66;if(rows.length)rule("operations-divider",y-4);ops.forEach((r,i)=>text("operation-"+i,r,16,y+10+i*25,w-32,21,12,K.muted,400,{fontFamily:K.mono}));}
  if(kind==="metaclass")text("meta-ref","UML metamodel reference",16,h-32,w-32,18,11,K.muted,400,{textAlign:"center"});
 }
 else if(kind==="component"){
  mainHeader("«component»");
  svg("component-mark",'<g fill="'+K.header+'" stroke="'+K.muted+'" stroke-width="1.4"><rect x="7" y="1" width="13" height="19" rx="1"/><rect x="2" y="5" width="9" height="4"/><rect x="2" y="12" width="9" height="4"/></g>',w-36,14,22,22);
  (o.rows||["provides OrdersAPI","requires PaymentAPI"]).slice(0,Math.floor((h-68)/25)).forEach((r,i)=>{
   const req=r.startsWith("requires");
   svg("interface-"+i,req?'<path d="M12 3a6 6 0 1 0 0 12" fill="none" stroke="'+K.blue+'" stroke-width="1.5"/><path d="M1 9h5" stroke="'+K.blue+'" stroke-width="1.5"/>':'<path d="M1 9h5" stroke="'+K.blue+'" stroke-width="1.5"/><circle cx="11" cy="9" r="5" fill="none" stroke="'+K.blue+'" stroke-width="1.5"/>',15,70+i*25,18,18);
   text("contract-"+i,r,42,69+i*25,w-56,20,11.5,K.muted);
  });
 }
 else if(["service","api","events","queue","transform","model","metrics","dashboard","storage","database"].includes(kind)){
  const color=o.color||(["metrics","dashboard"].includes(kind)?K.green:["queue","transform","model","storage"].includes(kind)?K.violet:K.blue);
  const key=o.kindLabel||({service:"Service",api:"External API",events:"Event source",queue:"Event stream",transform:"Transform",model:"Data model",metrics:"Semantic layer",dashboard:"Dashboard",storage:"Object store",database:"Database"}[kind]);
  const symbol={service:"Server",api:"Globe",events:"Webhook",queue:"Radio",transform:"Workflow",model:"Table2",metrics:"Layers",dashboard:"ChartColumn",storage:"HardDrive",database:"Database"}[kind];
  ns[0].styles.radius=8;
  if(kind==="database"||kind==="storage"){
   ns[0].styles={fill:"transparent",overflow:"visible"};
   svg("storage-shell",'<path d="M1 15 C1 -3 '+(w-1)+' -3 '+(w-1)+' 15 V'+(h-15)+' C'+(w-1)+' '+(h+3)+' 1 '+(h+3)+' 1 '+(h-15)+' Z" fill="'+K.body+'" stroke="'+K.border+'" stroke-width="1.2"/><ellipse cx="'+w/2+'" cy="15" rx="'+(w/2-1)+'" ry="14" fill="'+K.header+'" stroke="'+K.border+'" stroke-width="1.2"/><path d="M1 '+(h-28)+' C1 '+(h-10)+' '+(w-1)+' '+(h-10)+' '+(w-1)+' '+(h-28)+'" fill="none" stroke="'+K.line+'" stroke-width="1"/>',0,0,w,h);
   icon("icon",symbol,16,compact?36:42,20,color);
   text("type",key,44,compact?36:43,w-60,18,10,color,500);
   text("title",title,16,compact?59:69,w-32,22,compact?13:15,K.text,600);
   text("summary",o.subtitle||"PostgreSQL · CDC enabled",16,compact?80:97,w-32,18,compact?10:11,K.muted);
   if(!compact)text("detail",(o.rows||["orders · customers · line_items"])[0],16,125,w-32,20,11,K.muted,400,{fontFamily:K.mono});
  } else {
   rect("header",1,1,w-2,compact?35:47,K.header,{radius:7});
   icon("icon",symbol,14,compact?9:12,compact?18:23,color);
   text("type",key,compact?40:48,compact?10:16,w-(compact?54:62),19,compact?10:11,color,500);
   if(kind==="queue"){
    for(let i=0;i<3;i++)rect("event-"+i,w-49+i*10,compact?14:19,6,8,color,{radius:1});
    const typ=ns.find(n=>n.id===id+"--type");typ.width=w-(compact?106:114);
   }
   text("title",title,14,compact?44:59,w-28,23,compact?13:15,K.text,600);
   text("summary",o.subtitle||"Commerce platform",14,compact?71:87,w-28,18,compact?10:11,K.muted);
   if(!compact){rule("details-divider",114,14,w-28);(o.rows||["Structured configuration"]).slice(0,2).forEach((r,i)=>text("detail-"+i,r,14,124+i*22,w-28,20,11,K.muted,400,{fontFamily:K.mono}));}
  }
 }
 else if(kind==="state"){
  ns[0].styles.radius=14;
  text("title",title,16,15,w-32,24,14,K.text,600,{textAlign:"center"});
  rule("header-divider",52);
  (o.rows||["entry / requestPayment()","exit / stopTimer()"]).forEach((r,i)=>text("behavior-"+i,r,16,67+i*25,w-32,21,11.5,K.muted,400,{fontFamily:K.mono}));
 }
 else if(kind==="action"){
  ns[0].styles.radius=14;
  text("title",title,14,(h-22)/2,w-28,24,13,K.text,500,{textAlign:"center"});
 }
 else if(kind==="part"){
  text("title",title,14,18,w-28,24,14,K.text,600,{textAlign:"center"});rule("header-divider",58);
  (o.rows||["role / checkout","type / Checkout"]).slice(0,2).forEach((r,i)=>text("role-"+i,r,16,74+i*24,w-32,21,11.5,K.muted,400,{fontFamily:K.mono}));
 }
 else if(kind==="environment"||kind==="artifact"){
  mainHeader(kind==="artifact"?"«artifact»":"«executionEnvironment»");
  if(kind==="artifact")icon("icon","FileCode2",w-34,17,18,K.muted);
  if(h>94)text("detail",o.subtitle||"Runtime environment",16,h-31,w-32,20,11,K.muted,400,{textAlign:"center"});
 }
 else if(kind==="package"||kind==="profile"){
  ns[0].styles={fill:"transparent",overflow:"visible"};
  svg("outline",'<path d="M1 24V1H'+Math.min(w*.45,135)+'V24H'+(w-1)+'V'+(h-1)+'H1Z" fill="'+K.body+'" stroke="'+K.border+'" stroke-width="1.2"/><path d="M1 24H'+Math.min(w*.45,135)+'" stroke="'+K.border+'"/>',0,0,w,h);
  text("title",(kind==="profile"?"«profile» ":"")+title,16,36,w-32,22,14,K.text,600);
  rule("header-divider",68,1,w-2);
  (o.rows||["Order","LineItem","OrderStatus"]).forEach((r,i)=>{icon("member-icon-"+i,"Braces",16,81+i*25,15,K.blue);text("member-"+i,r,40,79+i*25,w-56,20,12,K.muted);});
 }
 else if(kind==="device"){
  ns[0].styles={fill:"transparent",overflow:"visible"};
  const d=15;
  svg("device-shell",'<path d="M1 '+d+' '+d+' 1H'+(w-1)+'V'+(h-d)+'L'+(w-d)+' '+(h-1)+'H1Z" fill="'+K.body+'" stroke="'+K.border+'" stroke-width="1.3"/><path d="M1 '+d+'H'+(w-d)+'V'+(h-1)+'M'+(w-d)+' '+d+' '+(w-1)+' 1" fill="none" stroke="'+K.border+'" stroke-width="1.3"/><path d="M2 '+(d-1)+' '+d+' 2H'+(w-4)+'L'+(w-d-1)+' '+(d-1)+'Z" fill="'+K.header+'"/>',0,0,w,h);
  text("stereotype","«device»",16,32,w-d-32,17,10.5,K.muted,400,{textAlign:"center"});
  text("title",title,16,54,w-d-32,22,14,K.text,600,{textAlign:"center"});
  icon("runtime-icon","Server",18,94,19,K.blue);
  text("runtime",o.subtitle||"Application runtime",46,95,w-d-62,20,11,K.muted);
 }
 else if(kind==="ref"){
  ns[0].styles.radius=1;
  svg("ref-tab",'<path d="M0 0H47V16L38 25H0Z" fill="'+K.header+'" stroke="'+K.border+'" stroke-width="1"/>',0,0,48,26);
  text("operator","ref",10,3,28,17,11,K.muted,500,{fontFamily:K.mono});
  text("title",title,16,Math.max(36,(h-20)/2),w-32,22,13,K.text,500,{textAlign:"center"});
 }
 else if(kind==="lifeline"){
  ns[0].styles={fill:"transparent",overflow:"visible"};
  rect("participant",0,0,w,48,K.body,{borderColor:K.border,borderWidth:1,radius:3});
  text("title",title,12,14,w-24,22,13,K.text,500,{textAlign:"center"});
  line("lifeline",w/2,48,w/2,h,K.faint,"5 5");
  rect("execution",w/2-5,78,10,Math.min(58,h-90),K.header,{borderColor:K.blue,borderWidth:1});
 }
 else if(kind==="usecase"){
  ns[0].type="ellipse";ns[0].styles.radius=0;
  text("title",title,20,(h-22)/2,w-40,24,13,K.text,500,{textAlign:"center"});
 }
 else if(kind==="actor"){
  ns[0].styles={fill:"transparent",overflow:"visible"};
  svg("actor-geometry",'<circle cx="30" cy="12" r="10" fill="'+K.body+'" stroke="'+K.muted+'" stroke-width="1.8"/><path d="M30 22V58M8 37H52M30 58 9 85M30 58 51 85" fill="none" stroke="'+K.muted+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',(w-60)/2,0,60,88);
  text("title",title,0,97,w,22,12,K.text,500,{textAlign:"center"});
 }
 else if(kind==="decision"){
  ns[0].styles={fill:"transparent",overflow:"visible"};
  svg("decision",'<path d="M'+w/2+' 1 '+(w-1)+' '+h/2+' '+w/2+' '+(h-1)+' 1 '+h/2+'Z" fill="'+K.body+'" stroke="'+K.violet+'" stroke-width="1.5" stroke-linejoin="round"/>',0,0,w,h);
 }
 else if(kind==="initial"||kind==="final"){
  ns[0].styles={fill:"transparent",overflow:"visible"};
  if(kind==="final")add("ellipse","outer",1,1,w-2,h-2,{fill:K.bg,borderColor:K.text,borderWidth:1.5});
  add("ellipse","dot",kind==="final"?6:2,kind==="final"?6:2,w-(kind==="final"?12:4),h-(kind==="final"?12:4),{fill:K.text});
 }
 else if(kind==="fork"){
  ns[0].styles={fill:K.text,radius:2};
 }
 else if(kind==="port"){
  ns[0].styles={fill:"#253b51",borderColor:K.blue,borderWidth:1.5,radius:0};
 }
 else if(kind==="timing"){
  text("title",title,14,12,w-28,20,13,K.text,600);
  ["Paid","Pending"].forEach((s,i)=>text("state-"+i,s,14,48+i*37,63,20,10,K.muted));
  [0,100,200].forEach((t,i)=>{text("tick-"+i,String(t),76+i*(w-104)/2,h-22,24,16,9,K.faint,400,{textAlign:"center"});line("grid-"+i,88+i*(w-104)/2,44,88+i*(w-104)/2,h-32,K.line,"2 4");});
  svg("state-path",'<path d="M88 94H'+w*.52+'V56H'+(w-14)+'" fill="none" stroke="'+K.blue+'" stroke-width="2" stroke-linejoin="round"/>',0,0,w,h);
 }
 return ns;
}


export { K, makeShape };
