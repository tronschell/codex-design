import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, rename, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { canvasMapSettingsSchema, idSchema, revisionSchema } from '../shared/validation';
import { exportFilename, exportTargetProject, type ExportTarget } from '../shared/export-formats';
import { imageExportDetails } from '../shared/image-export';
import { libraryProject } from '../shared/library-export';
import { MAX_ASSET_CHUNK_BYTES, projectAssetRefs } from '../shared/media';
import { portableFile, portableFiles, readPortable, PROJECT_EXTENSION, PROJECT_MIME, type PortableAsset } from '../shared/portable';
import { MAX_ARCHIVE_BYTES } from '../shared/zip';
import { ProjectStore, StoreError } from './store';
import { rasterExport } from './raster-export';
import { resolveState } from '../shared/application-state';
import { stateValuesSchema } from '../shared/feature-schema';

export const imageSettingsSchema=canvasMapSettingsSchema.extend({width:z.number().int().min(1).max(16384).optional(),height:z.number().int().min(1).max(16384).optional(),dpi:z.number().int().min(1).max(2400).optional(),quality:z.number().int().min(1).max(100).optional()}).strict();
export const fileExportSchema=z.object({projectId:idSchema,expectedRevision:revisionSchema.optional(),boardId:idSchema.optional(),pageId:idSchema.optional(),nodeIds:z.array(idSchema).min(1).max(100).optional(),componentId:idSchema.optional(),library:z.boolean().optional(),format:z.enum(['cxdp','png','jpeg']).default('cxdp'),image:imageSettingsSchema.optional(),state:z.object({frameId:idSchema,scenarioId:idSchema.optional(),values:stateValuesSchema.default({})}).strict().optional()}).strict();
export type FileExportInput=z.infer<typeof fileExportSchema>;
type Prepared={exportId:string;name:string;mimeType:string;byteLength:number;sha256:string;projectId:string;revision:number;expiresAt:string;warnings:string[];width?:number;height?:number;dpi?:number};
// Bounded per-process cache; handles carry random capabilities and expire without modifying the saved design.
const exports=new Map<string,{metadata:Prepared;bytes:Uint8Array<ArrayBuffer>}>();
function prune(){for(const [id,item] of exports)if(Date.parse(item.metadata.expiresAt)<Date.now())exports.delete(id);}
function remember(name:string,mimeType:string,bytes:Uint8Array<ArrayBuffer>,projectId:string,revision:number,warnings:string[],dimensions?:{width:number;height:number;dpi:number}):Prepared{
  if(bytes.byteLength>MAX_ARCHIVE_BYTES)throw new Error('Exports are limited to 256 MiB. Choose a smaller scope.');
  prune();
  while(exports.size>=4 || [...exports.values()].reduce((sum,item)=>sum+item.bytes.byteLength,0)+bytes.byteLength>MAX_ARCHIVE_BYTES)exports.delete(exports.keys().next().value!);
  const metadata={exportId:randomUUID(),name,mimeType,byteLength:bytes.byteLength,sha256:createHash('sha256').update(bytes).digest('hex'),projectId,revision,expiresAt:new Date(Date.now()+15*60*1000).toISOString(),warnings,...dimensions};
  exports.set(metadata.exportId,{metadata,bytes});return metadata;
}
export function exportBytes(exportId:string){prune();const item=exports.get(exportId);if(!item)throw new StoreError(404,'export_not_found','The export expired or was evicted. Prepare it again.');return item;}
export function readExportChunk(exportId:string,offset:number,byteLength=MAX_ASSET_CHUNK_BYTES){
  const item=exportBytes(exportId);if(!Number.isInteger(offset)||offset<0||offset>=item.bytes.length||!Number.isInteger(byteLength)||byteLength<1||byteLength>MAX_ASSET_CHUNK_BYTES)throw new Error('Invalid export byte range.');
  const bytes=item.bytes.subarray(offset,offset+byteLength);return {exportId,offset,byteLength:bytes.length,totalBytes:item.bytes.length,data:Buffer.from(bytes).toString('base64')};
}
async function context(store:ProjectStore,input:FileExportInput){
  let project=await store.get(input.projectId);
  if(input.expectedRevision!==undefined&&input.expectedRevision!==project.revision)throw new StoreError(409,'revision_conflict','The project changed. Read the latest revision before exporting.');
  if(input.nodeIds&&!input.pageId)throw new Error('Selection exports require pageId.');
  if((input.componentId||input.library)&&(input.boardId||input.pageId||input.nodeIds||input.state))throw new Error('Library/component exports cannot combine page, board, selection or state scope.');
  if(input.library&&input.format!=='cxdp')throw new Error('Choose a component to export a library image.');
  if(input.state){if(input.format==='cxdp'||!input.pageId)throw new Error('State exports require an image format and pageId. Portable files keep all state definitions.');const preview=resolveState(project,input.pageId,input.state);project={...project,pages:project.pages.map(page=>page.id===input.pageId?{...page,nodes:preview.nodes}:page)};}
  let target:ExportTarget={scope:input.nodeIds?'selection':input.pageId?'page':input.boardId?'board':'project',boardId:input.boardId,pageId:input.pageId,nodeIds:input.nodeIds};
  let kind:ExportTarget['scope']|'library'|'component'=target.scope;
  if(input.componentId||input.library){project=libraryProject(project,input.componentId);kind=input.componentId?'component':'library';if(input.componentId&&input.format!=='cxdp'){const component=project.designSystem.components[0];project={...project,pages:[{...project.pages[0],nodes:component.nodes}]};}target={scope:'project'};}
  return {project,target,kind,scoped:exportTargetProject(project,target)};
}
async function assets(store:ProjectStore,project:Parameters<typeof projectAssetRefs>[0],maxBytes=MAX_ARCHIVE_BYTES){
  const result:PortableAsset[]=[];let total=0;
  for(const ref of projectAssetRefs(project)){
    const asset=await store.getAsset(ref);total+=asset.byteLength;if(total>maxBytes)throw new Error('Export media exceeds the size limit. Choose a smaller scope.');
    const bytes=new Uint8Array(asset.byteLength);let offset=0;
    while(offset<bytes.length){const chunk=await store.readAssetChunk({ref,offset});if(chunk.byteLength<1||chunk.offset!==offset||chunk.totalBytes!==bytes.length)throw new Error('An export asset changed or is incomplete.');bytes.set(Buffer.from(chunk.data,'base64'),offset);offset+=chunk.byteLength;}
    result.push({asset,bytes});
  }return result;
}
export async function estimateFileExport(store:ProjectStore,input:FileExportInput){
  const {project,target,scoped,kind}=await context(store,input);
  if(input.format!=='cxdp')return {projectId:input.projectId,revision:project.revision,...imageExportDetails(project,target,input.format,input.image)};
  const metadata=await Promise.all(projectAssetRefs(scoped).map(ref=>store.getAsset(ref)));
  const extra:Record<string,string>=target.scope==='selection'?{'original-scope.json':JSON.stringify(exportTargetProject(project,target,{originalSelectionLayout:true}),null,2)}:{};
  const files=portableFiles(scoped,metadata.map(asset=>({asset,bytes:new Uint8Array(0)})),kind,extra);
  const mediaBytes=metadata.reduce((sum,asset)=>sum+asset.byteLength,0);
  const estimatedBytes=22+mediaBytes+Object.entries(files).reduce((sum,[name,data])=>sum+76+Buffer.byteLength(name)*2+(typeof data==='string'?Buffer.byteLength(data):data.byteLength),0);
  if(estimatedBytes>MAX_ARCHIVE_BYTES)throw new Error('The portable export exceeds 256 MiB. Choose a smaller scope.');
  return {projectId:input.projectId,revision:project.revision,estimatedMinBytes:estimatedBytes,estimatedMaxBytes:estimatedBytes,estimateMethod:'Calculated from serialized document, manifest, ZIP headers and stored media lengths; media is validated when preparing the file.'};
}
export async function prepareFileExport(store:ProjectStore,input:FileExportInput){
  const {project,target,kind,scoped}=await context(store,input);
  const name=exportFilename(`${input.componentId ? project.designSystem.components[0].name : project.name}-${kind}`);
  if(input.format==='cxdp'){
    const loaded=await assets(store,scoped);
    const extra: Record<string,string>=target.scope==='selection'?{'original-scope.json':JSON.stringify(exportTargetProject(project,target,{originalSelectionLayout:true}),null,2)}:{};
    return remember(`${name}.${PROJECT_EXTENSION}`,PROJECT_MIME,portableFile(scoped,loaded,kind,extra),input.projectId,project.revision,['Includes current editable content and media. Import creates a separate project with a new history baseline.']);
  }
  const mediaScope={...scoped,threads:[],boards:scoped.boards.map(board=>({...board,inspiration:[]})),designSystem:{...scoped.designSystem,components:[]}};
  const loaded=await assets(store,mediaScope,48*1024*1024);
  const urls=Object.fromEntries(loaded.map(({asset,bytes})=>[asset.ref,`data:${asset.mimeType};base64,${Buffer.from(bytes).toString('base64')}`]));
  const result=await rasterExport(project,target,input.format,input.image??{},urls);
  return remember(`${name}.${input.format==='jpeg'?'jpg':'png'}`,`image/${input.format}`,result.bytes,input.projectId,project.revision,result.warnings,{width:result.details.width,height:result.details.height,dpi:result.details.dpi});
}

async function localPath(filePath:string){
  if(!path.isAbsolute(filePath)||filePath.includes('\0')||filePath.split(/[\\/]/).some(part=>part==='..'||part==='.git'))throw new Error('Choose an absolute project file path without traversal or .git internals.');
  const directory=await realpath(path.dirname(filePath));
  if(!(await lstat(directory)).isDirectory())throw new Error('The destination directory must already exist.');
  return path.join(directory,path.basename(filePath));
}
export async function saveExport(exportId:string,filePath:string,overwrite=false){
  const {metadata,bytes}=exportBytes(exportId),filename=await localPath(filePath);
  const extension=path.extname(metadata.name).toLowerCase();
  if(path.extname(filename).toLowerCase()!==extension&&!(extension==='.jpg'&&/\.jpeg$/i.test(filename)))throw new Error(`Use a ${extension} destination file.`);
  try{const info=await lstat(filename);if(!info.isFile()||info.isSymbolicLink())throw new Error('The destination must be a regular file.');if(!overwrite)throw new Error('This export file exists. Set overwrite:true only when replacing it is intended.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const temporary=path.join(path.dirname(filename),`.codex-export-${randomUUID()}.tmp`),handle=await open(temporary,'wx',0o600);
  try{
    try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    if(overwrite)await rename(temporary,filename);else await link(temporary,filename);
  }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  return {...metadata,filePath:filename};
}
export async function importPortableFile(store:ProjectStore,filePath:string){
  if(path.extname(filePath).toLowerCase()!==`.${PROJECT_EXTENSION}`)throw new Error(`Choose a .${PROJECT_EXTENSION} project file.`);
  const filename=await localPath(filePath),handle=await open(filename,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  let bytes:Buffer;
  try{const before=await handle.stat();if(!before.isFile()||before.size<1||before.size>MAX_ARCHIVE_BYTES)throw new Error('Portable imports must be regular files no larger than 256 MiB.');bytes=Buffer.alloc(before.size+1);let at=0;while(at<bytes.length){const read=await handle.read(bytes,at,bytes.length-at,at);if(!read.bytesRead)break;at+=read.bytesRead;}const after=await handle.stat();if(at!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error('The import file changed while reading.');bytes=bytes.subarray(0,at);}finally{await handle.close();}
  const portable=await readPortable(bytes);
  for(const {asset,bytes} of portable.assets){const upload=await store.beginAssetUpload({name:asset.name,mimeType:asset.mimeType,byteLength:asset.byteLength});try{let ref:string|undefined;for(let offset=0;offset<bytes.length;offset+=MAX_ASSET_CHUNK_BYTES)ref=(await store.uploadAssetChunk({uploadId:upload.uploadId,offset,data:Buffer.from(bytes.subarray(offset,offset+MAX_ASSET_CHUNK_BYTES)).toString('base64')})).asset?.ref;if(ref!==asset.ref)throw new Error(`Imported media changed: ${asset.name}`);}catch(error){await store.cancelAssetUpload(upload.uploadId);throw error;}}
  return store.importProject(portable.project);
}
