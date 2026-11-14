import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

/** Preview-only workaround for conditional range revalidation in the pinned
 * static server. Serve the actual soundtrack bytes, without publishing a
 * validator that can produce an incomplete 304 for a resumed media request.
 * No browser interception, fake assets, runtime changes or error exemptions. */
export function previewMediaMiddleware(directory,{cacheSeconds=0}={}){
 if(!Number.isSafeInteger(cacheSeconds)||cacheSeconds<0||cacheSeconds>600)throw new TypeError('cacheSeconds must be an integer from 0 to 600');
 // Each response is a complete immutable snapshot: strong ETag and body bytes
 // come from the same buffer; cacheable 206 bodies can be reused by Chrome.
 const cacheControl=cacheSeconds?`private, max-age=${cacheSeconds}`:'no-cache, max-age=0, must-revalidate';
 const root=resolve(directory);
 return function media(request,response,next){
  let path;
  try{path=new URL(request.url,'http://localhost').pathname;}catch{return next();}
  if(!/^\/audio\/swoop\/track-\d{2}\.mp3$/.test(path))return next();
  if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405,{Allow:'GET, HEAD','Content-Length':'0'}).end();return;}
  void (async()=>{
   const file=resolve(root,'.'+path),resolved=await realpath(file);
   if(!resolved.startsWith(root+sep)){response.writeHead(403,{'Content-Length':'0'}).end();return;}
   const contents=await readFile(resolved),size=contents.length;
   const etag='"'+createHash('sha256').update(contents).digest('hex')+'"';
   const headers={'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Cache-Control':cacheControl,'ETag':etag};
   // No ETag or Last-Modified is published: old conditional validators cannot
   // authenticate this response. A full body or explicit range is always sent.
   let status=200,start=0,end=size-1;
   const range=request.method==='GET'&&(!request.headers['if-range']||request.headers['if-range']===etag)?request.headers.range:undefined;
   if(typeof range==='string'&&range.startsWith('bytes=')&&!range.includes(',')){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(match&&(match[1]||match[2])){
     let valid=true;
     if(!match[1]){const length=Number(match[2]);valid=Number.isSafeInteger(length)&&length>0;start=Math.max(0,size-length);}
     else{start=Number(match[1]);end=match[2]?Number(match[2]):end;valid=Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&end>=start;}
     if(!valid||start>=size||size===0){response.writeHead(416,{...headers,'Content-Range':'bytes */'+size,'Content-Length':'0'}).end();return;}
     end=Math.min(end,size-1);status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
    }
   }
   headers['Content-Length']=String(status===206?end-start+1:size);
   response.writeHead(status,headers);
   if(request.method==='HEAD'||size===0){response.end();return;}
   response.end(status===206?contents.subarray(start,end+1):contents);
  })().catch(()=>{if(response.headersSent)response.destroy();else response.writeHead(404,{'Content-Length':'0'}).end();});
 };
}

export function previewMediaPlugin(){
 return {name:'belle-preview-media-revalidation',configurePreviewServer(server){
  // A preview serves a built snapshot. Reuse its completed media response across
  // native pause/suspend/resume, rather than starting another uncached Range load.
  // This is private, bounded HTTP caching, never a fake body or error exemption.
  server.middlewares.use(previewMediaMiddleware(resolve(server.config.root,server.config.build.outDir),{cacheSeconds:600}));
 }};
}
