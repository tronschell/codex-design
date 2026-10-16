import { spawn } from 'node:child_process';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';

async function browserExecutable() {
  const candidates = [process.env.CODEX_DESIGN_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...['google-chrome','chromium','chromium-browser','chrome.exe'].flatMap(name=>(process.env.PATH ?? '').split(path.delimiter).map(dir=>path.join(dir,name))),
    ...[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(dir=>path.join(dir!,'Google/Chrome/Application/chrome.exe'))];
  for (const candidate of candidates) if (candidate) try { await access(candidate,constants.X_OK); return candidate; } catch { /* Try next installed browser. */ }
  throw new Error('Image export needs Chrome or Chromium installed on the design server. Set CODEX_DESIGN_CHROME_PATH to its executable if it is not found automatically.');
}

let active = false;
/** Isolated, short-lived Chrome instance, communicating over inherited pipes (no debugging TCP port). */
export async function captureHtml(html: string, width: number, height: number, format: 'png'|'jpeg', quality: number): Promise<Uint8Array<ArrayBuffer>> {
  if (active) throw new Error('An image export is already rendering. Wait for it to finish and retry.');
  active=true;
  let directory: string | undefined;
  try {
    const executable=await browserExecutable();
    directory=await mkdtemp(path.join(tmpdir(),'codex-design-render-'));
    const process=spawn(executable,['--headless=new','--remote-debugging-pipe',`--user-data-dir=${directory}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--disable-breakpad','--disable-crash-reporter','--disable-features=MediaRouter','--host-resolver-rules=MAP * ~NOTFOUND','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
    const input=process.stdio[3] as Writable, output=process.stdio[4] as Readable;
    const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
    let sequence=0,buffer='',failure:Error|undefined, sessionId:string|undefined, blockedRequests=0;
    const fail=(error:Error)=>{failure=error;for(const request of pending.values())request.reject(error);pending.clear();};
    const send=(method:string,params:Record<string,unknown>={},session=sessionId):Promise<any>=>new Promise((resolve,reject)=>{
      if(failure){reject(failure);return;}const id=++sequence;pending.set(id,{resolve,reject});
      input.write(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})})+'\0',error=>{if(error)fail(error);});
    });
    output.setEncoding('utf8');
    output.on('data',(data:string)=>{
      buffer+=data;
      if(buffer.length>360*1024*1024){fail(new Error('Rendered image exceeds the export buffer limit.'));process.kill();return;}
      let end:number;
      while((end=buffer.indexOf('\0'))>=0){
        const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;
        try{
          const message=JSON.parse(raw);
          if(message.id){const request=pending.get(message.id);pending.delete(message.id);if(message.error)request?.reject(new Error(message.error.message));else request?.resolve(message.result);}
          else if(message.method==='Fetch.requestPaused'){blockedRequests++;void send('Fetch.failRequest',{requestId:message.params.requestId,errorReason:'BlockedByClient'},message.sessionId).catch(()=>{});}
        }catch{fail(new Error('The image renderer returned an unreadable response.'));}
      }
    });
    process.on('error',fail);process.on('exit',()=>fail(new Error('The image renderer exited before export completed.')));
    const timeout=setTimeout(()=>{fail(new Error('Image rendering exceeded 60 seconds. Export a smaller scope.'));process.kill('SIGKILL');},60000);
    const evaluate=async(expression:string,contextId?:number)=>{
      const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,...(contextId?{contextId}:{})});
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description ?? 'Image content could not be rendered.');
      return result.result?.value;
    };
    try {
      const {targetInfos}=await send('Target.getTargets');
      const target=targetInfos.find((item:any)=>item.type==='page');
      if(!target)throw new Error('The image renderer did not open a page.');
      sessionId=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
      await send('Page.enable');await send('Runtime.enable');
      await send('Browser.setDownloadBehavior',{behavior:'deny'},'');
      await send('Page.addScriptToEvaluateOnNewDocument',{source:"['RTCPeerConnection','webkitRTCPeerConnection','RTCDataChannel'].forEach(key=>{try{Object.defineProperty(window,key,{value:undefined,writable:false,configurable:false})}catch{}});"});
      await send('Fetch.enable',{patterns:[{urlPattern:'http://*'},{urlPattern:'https://*'},{urlPattern:'file://*'},{urlPattern:'ftp://*'},{urlPattern:'ws://*'},{urlPattern:'wss://*'}]});
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
      const {frameTree}=await send('Page.getFrameTree');
      await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
      await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const check=()=>{if(document.readyState==='complete')resolve(true);else if(Date.now()-start>20000)reject(new Error('Page loading timed out'));else setTimeout(check,25)};check()})`);
      await evaluate('window.__codexCaptureReady || Promise.resolve()');
      const tree=(await send('Page.getFrameTree')).frameTree;
      const frames=(item:any):string[]=>[item.frame.id,...(item.childFrames??[]).flatMap(frames)];
      for(const frameId of frames(tree)){
        const {executionContextId}=await send('Page.createIsolatedWorld',{frameId,worldName:'codex-export'});
        await evaluate(`(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await document.fonts.ready;const freeze=document.createElement('style');freeze.dataset.codexCaptureFreeze='true';freeze.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.append(freeze);await Promise.all(Array.from(document.images).map(async image=>{if(!image.complete)await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('An export image could not load'))});if(!image.naturalWidth)throw new Error('An export image is missing');await image.decode()}));if(document.querySelector('[data-codex-render-error]'))throw new Error(document.querySelector('[data-codex-render-error]').textContent);return true})()`,executionContextId);
      }
      if(blockedRequests)throw new Error('The export requires external resources. Embed images/fonts before exporting offline.');
      const {data}=await send('Page.captureScreenshot',{format,...(format==='jpeg'?{quality}:{}),captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});
      return new Uint8Array(Buffer.from(data,'base64'));
    } finally {
      clearTimeout(timeout);fail(new Error('Image renderer closed.'));
      if(process.exitCode===null&&process.signalCode===null){const exited=new Promise<void>(resolve=>process.once('exit',()=>resolve()));process.kill('SIGKILL');await exited;}
      input.destroy();output.destroy();
    }
  } finally {active=false;if(directory)await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
}
