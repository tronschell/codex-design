import { diamondGeometry } from './diagram-geometry';
import type { DesignNode } from './types';
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const clip=(s:string,n:number)=>s.length>n?s.slice(0,Math.max(1,n-1))+'…':s;
export const svgDocument=(body:string,w:number,h:number)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+body+'</svg>';
export function stencilIcon(kind:string):string{
 const line='fill="none" stroke="#c9ced6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
 const boxes='<rect x="8" y="5" width="48" height="30" rx="2"/>';
 const icons:Record<string,string>={
 component:'<rect x="15" y="4" width="38" height="31" rx="2"/><path d="M9 11h12v7H9zM9 23h12v7H9z" fill="#272727"/><path d="M29 14h15M29 20h10" stroke="#838b96"/>',
 port:'<rect x="8" y="5" width="38" height="30" rx="2"/><path d="M16 13h15M16 19h10" stroke="#838b96"/><rect x="42" y="16" width="8" height="8" fill="#272727"/><path d="M50 20h10"/>',
 provided:'<rect x="4" y="8" width="24" height="24" rx="2"/><path d="M28 20h19"/><circle cx="53" cy="20" r="6"/>',
 required:'<rect x="4" y="8" width="24" height="24" rx="2"/><path d="M28 20h17M53 13a7 7 0 1 0 0 14"/>',
 class:boxes+'<path d="M8 15h48M8 25h48M14 10h20M14 20h28M14 30h22"/>',
 object:boxes+'<path d="M19 10h26m-26 3h26M8 18h48M14 24h28M14 30h20"/>',
 interface:boxes+'<path d="M8 18h48M21 11h22M16 25h32M16 30h24"/>',
 actor:'<circle cx="32" cy="8" r="5"/><path d="M32 13v14M20 18h24M32 27 22 37m10-10 10 10"/>',
 database:'<ellipse cx="32" cy="8" rx="22" ry="6"/><path d="M10 8v24c0 8 44 8 44 0V8M10 25c0 8 44 8 44 0"/>',
 storage:'<ellipse cx="32" cy="8" rx="22" ry="6"/><path d="M10 8v24c0 8 44 8 44 0V8"/>',
 table:boxes+'<path d="M8 14h48M8 22h48M8 30h48M22 14v21"/>',
 model:boxes+'<path d="M8 15h48M8 25h48M27 15v20"/>',
 package:'<path d="M7 7h19v7h31v22H7z"/>',profile:'<path d="M7 7h19v7h31v22H7zM19 23h26M23 29h18"/>',
 device:'<path d="m10 12 9-8h36v24l-9 8H10zM10 12h36v24m0-24 9-8"/><path d="M19 19h18v10H19z"/>',
 environment:boxes+'<path d="M15 13h34M15 21h16M15 27h24"/>',
 artifact:'<path d="M17 3h23l8 8v26H17zM40 3v9h8M23 20h19M23 26h19"/>',
 decision:'<path d="m32 3 27 17-27 17L5 20z"/>',
 initial:'<circle cx="32" cy="20" r="10" fill="#c9ced6"/>',final:'<circle cx="32" cy="20" r="13"/><circle cx="32" cy="20" r="8" fill="#c9ced6"/>',
 history:'<circle cx="32" cy="20" r="13"/><path d="M27 13v14m10-14v14M27 20h10"/>',
 fork:'<path d="M9 20h46" stroke-width="6"/><path d="M32 4v13M17 23v13m30-13v13"/>',
 usecase:'<ellipse cx="32" cy="20" rx="27" ry="15"/>',
 action:'<rect x="7" y="7" width="50" height="26" rx="10"/>',
 state:'<rect x="7" y="4" width="50" height="32" rx="7"/><path d="M7 16h50M15 23h29M15 29h23"/>',
 lifeline:'<rect x="17" y="3" width="30" height="12"/><path d="M32 15v23" stroke-dasharray="3 3"/><rect x="29" y="22" width="6" height="9" fill="#272727"/>',
 activation:'<path d="M32 2v36" stroke-dasharray="3 3"/><rect x="28" y="10" width="8" height="21" fill="#272727"/>',
 fragment:boxes+'<path d="M8 14h15l6-5V5M8 25h48" stroke-dasharray="3 2"/>',
 timing:'<path d="M7 5v30h52M9 27h12V14h17v9h20"/>',
 ref:boxes+'<path d="M8 15h15l6-5V5"/>',
 composite:boxes+'<rect x="17" y="16" width="12" height="12"/><rect x="39" y="16" width="12" height="12"/><path d="M29 22h10"/><rect x="5" y="19" width="6" height="6" fill="#272727"/>',
 part:boxes+'<path d="M18 20h28m-28 3h28"/>',
 boundary:'<rect x="5" y="3" width="54" height="34" rx="2" stroke-dasharray="4 3"/><path d="M12 10h22"/>',
 lane:boxes+'<path d="M20 5v30M8 18h48"/>',
 'journey-stage':boxes+'<path d="M8 14h48M15 21h30M15 27h23"/>',
 initiative:'<rect x="6" y="12" width="48" height="17" rx="4"/><path d="M6 5v30M58 5v30" stroke-dasharray="2 3"/>',
 milestone:'<path d="M32 4v32m0-23 8 7-8 7-8-7z" fill="#272727"/>',
 set:'<circle cx="25" cy="20" r="15"/><circle cx="41" cy="20" r="15"/>',
 intersection:'<circle cx="25" cy="20" r="15"/><circle cx="41" cy="20" r="15"/><path d="M33 8v24" stroke="#dfba79" stroke-width="3"/>',
 comment:'<path d="M9 5h37l9 9v21H9zM46 5v9h9M16 20h31M16 27h24"/>',
 queue:'<path d="M4 20h56"/><rect x="9" y="9" width="11" height="22" fill="#272727"/><rect x="27" y="9" width="11" height="22" fill="#272727"/><rect x="45" y="9" width="11" height="22" fill="#272727"/>',
 transform:'<path d="M4 20h13m30 0h13"/><path d="m32 5 15 15-15 15-15-15z"/><path d="m28 16 8 4-8 4"/>',
 events:'<path d="M7 9v22M16 5v30M25 12v16M34 7v26M43 3v34M52 10v20"/>',
 api:'<circle cx="32" cy="20" r="16"/><ellipse cx="32" cy="20" rx="7" ry="16"/><path d="M16 20h32M19 12h26M19 28h26"/>',
 dashboard:boxes+'<path d="M15 29V19m9 10V13m9 16V22m9 7V16m9 13V10"/>',
 metrics:'<path d="m32 4 26 12-26 12L6 16zm-26 19 26 12 26-12M6 28l26 12 26-12"/>',
 service:boxes+'<path d="M8 20h48"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="27" r="1"/><path d="M24 12h24M24 27h24"/>',
 stereotype:boxes+'<path d="m20 10-3 3 3 3m24-6 3 3-3 3M8 21h48M15 28h32"/>',
 metaclass:boxes+'<path d="M17 15h30m-26 8h22"/>'
 };
 return svgDocument('<g '+line+'>'+(icons[kind]??boxes)+'</g>',64,40);
}
const shapeCache=new WeakMap<DesignNode,string>();
export function diagramShapeSvg(node:DesignNode):string {
 const cached=shapeCache.get(node);if(cached)return cached;
 const d=node.diagramElement;if(!d)return'';const k=d.kind,w=Math.max(8,node.width),h=Math.max(8,node.height),color=esc(d.color??'#8bc5f4'),fg=esc(node.styles.color??'#edf1f7'),fill=esc(node.styles.fill&&node.styles.fill!=='transparent'?node.styles.fill:'#22262c'),border=esc(node.styles.borderColor??'#5b6572');
 const line=(x1:number,y1:number,x2:number,y2:number,c='#444d59',dash='')=>'<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" stroke="'+c+'" fill="none"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
 const text=(s:string,x:number,y:number,size=12,c=fg,anchor='start',weight=400)=>'<text x="'+x+'" y="'+y+'" fill="'+c+'" font-size="'+size+'" font-weight="'+weight+'" text-anchor="'+anchor+'" font-family="system-ui,-apple-system,sans-serif">'+esc(clip(s,Math.max(4,Math.floor((anchor==='middle'?w-24:w-x-12)/(size*.56)))))+'</text>';
 const box=(radius=6)=>'<rect x="1" y="1" width="'+(w-2)+'" height="'+(h-2)+'" rx="'+radius+'" fill="'+fill+'" stroke="'+border+'" stroke-width="1.2"/>';
 const title=node.content??node.name,rows=d.rows??[],ops=d.operations??[];
 let body='';
 if(k==='port')body='<rect x="2" y="2" width="'+(w-4)+'" height="'+(h-4)+'" fill="'+fill+'" stroke="'+color+'" stroke-width="2"/>';
 else if(['initial','final','history'].includes(k)){const r=Math.min(w,h)/2-2;body='<circle cx="'+w/2+'" cy="'+h/2+'" r="'+r+'" fill="'+(k==='initial'?fg:fill)+'" stroke="'+fg+'" stroke-width="1.5"/>';if(k==='final')body+='<circle cx="'+w/2+'" cy="'+h/2+'" r="'+(r-5)+'" fill="'+fg+'"/>';if(k==='history')body+=text('H',w/2,h/2+5,15,fg,'middle',600);}
 else if(k==='fork')body='<rect x="0" y="0" width="'+w+'" height="'+h+'" rx="2" fill="'+fg+'"/>';
 else if(k==='actor'){body='<g fill="none" stroke="'+border+'" stroke-width="2"><circle cx="'+w/2+'" cy="21" r="13"/><path d="M'+w/2+' 34V82M'+(w/2-27)+' 51h54M'+w/2+' 82l-24 30m24-30 24 30"/></g>'+text(title,w/2,h-8,12,fg,'middle',500);}
 else if(k==='provided'||k==='required'){body='<g fill="none" stroke="'+color+'" stroke-width="1.6"><path d="M15 32H'+(w/2-10)+'"/>'+(k==='provided'?'<circle cx="'+w/2+'" cy="32" r="10"/>':'<path d="M'+(w/2+6)+' 22a10 10 0 1 0 0 20"/>')+'</g>'+text(title,w/2,66,12,fg,'middle');}
 else if(k==='activation')body=box(1);
 else if(k==='lifeline'){body='<rect x="1" y="1" width="'+(w-2)+'" height="51" rx="3" fill="'+fill+'" stroke="'+border+'"/>'+text(title,w/2,30,13,fg,'middle',600)+line(w/2,52,w/2,h-2,border,'6 5');}
 else if(k==='set'){body='<circle cx="'+w/2+'" cy="'+h/2+'" r="'+(Math.min(w,h)/2-2)+'" fill="'+color+'" fill-opacity=".10" stroke="'+color+'" stroke-width="1.5"/>'+text(title,w/2,h*.30,16,fg,'middle',600);rows.slice(0,4).forEach((r,i)=>body+=text(r,w/2,h*.46+i*24,12,'#b2bdcb','middle'));}
 else if(k==='intersection'){body=text(title,w/2,h/2+5,13,'#dfba79','middle',500);}
 else if(k==='decision'||k==='milestone'){body='<polygon points="'+diamondGeometry(w,h).points.map(p=>p.x+','+p.y).join(' ')+'" fill="'+fill+'" stroke="'+border+'" stroke-width="1.5"/>'+text(title,w/2,h/2+4,11,fg,'middle');}
 else if(k==='usecase'){body='<ellipse cx="'+w/2+'" cy="'+h/2+'" rx="'+(w/2-2)+'" ry="'+(h/2-2)+'" fill="'+fill+'" stroke="'+border+'" stroke-width="1.5"/>'+text(title,w/2,h/2+5,13,fg,'middle',500);}
 else if(k==='action'||k==='ref'){body=box(k==='action'?16:3);if(k==='ref')body+='<path d="M1 25h40l12-12V1" fill="none" stroke="'+border+'"/>'+text('ref',13,18,10,'#b2bdcb');body+=text(title,w/2,h/2+6,14,fg,'middle',500);}
 else if(k==='timing'){body=box(4)+text(title,14,25,14,fg,'start',600);const track=rows.length?rows:['Idle','Active','Done'];track.slice(0,4).forEach((r,i)=>body+=text(r,14,55+i*24,11,'#b2bdcb'));const left=Math.min(110,w*.3),step=(w-left-24)/4;body+='<path d="M'+left+' '+(h-30)+'h'+step+'V58h'+step+'v24h'+step+'V58h'+step+'" fill="none" stroke="'+color+'" stroke-width="2"/>'+line(left,h-16,w-12,h-16,border)+text('time →',w-72,h-3,10,'#b2bdcb');}
 else if(k==='database'||k==='storage'){body='<path d="M1 18C1-4 '+(w-1)+'-4 '+(w-1)+' 18V'+(h-18)+'C'+(w-1)+' '+(h+4)+' 1 '+(h+4)+' 1 '+(h-18)+'Z" fill="'+fill+'" stroke="'+border+'"/><ellipse cx="'+w/2+'" cy="18" rx="'+(w/2-1)+'" ry="16" fill="#292f37" stroke="'+border+'"/>'+text(title,16,65,15,fg,'start',600)+text(d.subtitle||'Data store',16,88,11,'#b2bdcb');rows.slice(0,3).forEach((r,i)=>body+=text(r,16,112+i*20,11,'#b2bdcb'));}
 else if(['package','profile','device','environment','composite','boundary','lane','fragment'].includes(k)){
  body=box(3);if(k==='package'||k==='profile')body='<path d="M1 1h'+Math.min(130,w*.55)+'v24H'+(w-1)+'V'+(h-1)+'H1Z" fill="'+fill+'" stroke="'+border+'"/>';
  if(k==='device')body+='<path d="M1 16 17 1M'+(w-17)+' 1v'+(h-17)+'H1M'+(w-17)+' '+(h-17)+'l16-16" fill="none" stroke="'+border+'"/>';
  body+=text(title,14,['package','profile'].includes(k)?18:27,13,fg,'start',600);if(!['package','profile','device'].includes(k))body+=line(1,40,w-1,40);
  if(k==='fragment')body+=text(d.stereotype||'alt',14,61,11,color);
  if(k==='composite')body+=text(d.subtitle||'Parts and ports',14,58,11,'#b2bdcb');
 }
 else if(k==='comment'||k==='artifact'){body='<path d="M1 1H'+(w-25)+'L'+(w-1)+' 25V'+(h-1)+'H1Z" fill="'+fill+'" stroke="'+border+'"/><path d="M'+(w-25)+' 1v24h24" fill="none" stroke="'+border+'"/>'+text(title,14,49,13,fg,'start',600);rows.slice(0,4).forEach((r,i)=>body+=text(r,14,76+i*20,11,'#b2bdcb'));}
 else{
  const rounded=['state','initiative','journey-stage'].includes(k)?10:5;body=box(rounded);
  const uml=['class','interface','object','component','stereotype','metaclass','part','state'].includes(k);
  const stereo=d.stereotype||({interface:'«interface»',component:'«component»',stereotype:'«stereotype»',metaclass:'«metaclass»',part:'part',class:'class'} as Record<string,string>)[k]||'';
  const head=uml?58:48;body+='<rect x="2" y="2" width="'+(w-4)+'" height="'+(head-2)+'" rx="'+Math.max(1,rounded-1)+'" fill="#292f37"/>';
  if(uml){if(stereo)body+=text(stereo,w/2,19,10,'#b2bdcb','middle');body+=text(title,w/2,stereo?41:34,14,fg,'middle',600);if(k==='object')body+=line(w*.2,39,w*.8,39,fg);}
  else body+=text(title,14,30,14,fg,'start',600);
  body+=line(1,head,w-1,head);
  if(k==='component')body+='<g fill="#292f37" stroke="#b2bdcb" stroke-width="1.3"><rect x="'+(w-27)+'" y="13" width="13" height="19" rx="1"/><rect x="'+(w-32)+'" y="17" width="9" height="4"/><rect x="'+(w-32)+'" y="24" width="9" height="4"/></g>';
  let y=head+24;
  if(d.subtitle){body+=text(d.subtitle,14,y,11,'#b2bdcb');y+=23;}
  const lines=k==='initiative'?[d.lane||'Planned',(d.start||'Start date')+' → '+(d.end||'End date')]:rows;
  for(const row of lines){if(y>h-10)break;body+=text(row,14,y,12,'#c1cbd8');y+=24;}
  if(ops.length&&y<h-32){body+=line(1,y-6,w-1,y-6);y+=14;for(const op of ops){if(y>h-8)break;body+=text(op,14,y,11,'#b2bdcb');y+=23;}}
 }
 const result=svgDocument(body,w,h);shapeCache.set(node,result);return result;
}
