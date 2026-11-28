import {createReadStream} from 'node:fs';
import {stat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,sep,extname} from 'node:path';
import {orderedAssetRoots,assetRootForPath} from './asset-roots.mjs';

const contentTypes={'.glb':'model/gltf-binary','.gltf':'model/gltf+json','.json':'application/json','.bin':'application/octet-stream','.gz':'application/gzip','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.svg':'image/svg+xml','.hdr':'application/octet-stream','.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.ktx2':'image/ktx2','.basis':'application/octet-stream','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json'};

export function parseRange(header,size){
  if(header===undefined)return null;
  if(typeof header!=='string'||!/^bytes=(\d*)-(\d*)$/.test(header))throw Error('Unsupported range');
  const [,first,last]=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!first&&!last)throw Error('Empty range');
  let start,end=size-1;
  if(!first){const suffix=Number(last);if(!Number.isSafeInteger(suffix)||suffix<=0)throw Error('Invalid suffix');start=Math.max(0,size-suffix);}
  else{start=Number(first);if(last)end=Number(last);}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||start>=size||size===0)throw Error('Unsatisfiable range');
  return {start,end:Math.min(end,size-1)};
}

/** Native file responses with range support. Asset roots are read-only;
 * encoded traversal and symlinks cannot escape their canonical directory. */
export function previewAssets(roots,{manifest,report,sourceBase}={}){
  const verified=new Map();
  const ordered=orderedAssetRoots(roots);
  return (request,response,next)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400).end();return;}
    const root=assetRootForPath(ordered,pathname);
    if(!root){if(pathname.startsWith('/__swoop-assets__/')){response.writeHead(404,{'Content-Type':'text/plain'}).end('Unknown original preview asset namespace');return;}return next();}
    const subpath=pathname.slice(root.prefix.length);
    const explicitAsset=root.prefix!=='/'||/^(?:belle|exports|textures|audio)\//.test(subpath)||subpath==='favicon.svg';
    if(!subpath||subpath.includes('\0')||subpath.includes('\\'))return next();
    const candidates=root.directories.map(directory=>({directory,file:resolve(directory,subpath)}));
    if(candidates.some(({directory,file})=>{const rel=relative(directory,file);return rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel);})){response.writeHead(403).end();return;}
    if(!Object.hasOwn(contentTypes,extname(subpath).toLowerCase())){
      if(explicitAsset){response.writeHead(415,{'Content-Type':'text/plain'}).end('Unsupported preview asset type');return;}
      return next();
    }
    void (async()=>{
      let selected,info;
      for(const candidate of candidates){
        try{info=await stat(candidate.file);selected=candidate;break;}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}
      }
      if(!selected){
        if(explicitAsset){response.writeHead(404,{'Content-Type':'text/plain'}).end('Original preview asset is missing');return;}
        return next();
      }
      if(!info.isFile()){if(explicitAsset){response.writeHead(404).end();return;}return next();}
      const {file,directory}=selected;
      if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
      const [canonicalRoot,canonicalFile]=await Promise.all([realpath(directory),realpath(file)]);
      const canonicalRelative=relative(canonicalRoot,canonicalFile);
      if(canonicalRelative==='..'||canonicalRelative.startsWith('..'+sep)||isAbsolute(canonicalRelative)){response.writeHead(403).end();return;}
      const record=manifest?.[pathname];
      if(manifest&&!record){response.writeHead(409,{'Content-Type':'text/plain'}).end('Asset is absent from the preview source snapshot');return;}
      if(record?.source&&sourceBase&&resolve(sourceBase,record.source)!==file){response.writeHead(409,{'Content-Type':'text/plain'}).end('Asset overlay source changed since preview build');return;}
      if(record){
        const stamp=info.size+':'+info.mtimeMs;
        if(verified.get(canonicalFile)!==stamp){
          const accumulator=createHash('sha1').update('blob '+info.size+'\0');
          // Hash in bounded chunks; a second full GLB copy must not compete
          // with the browser's model/texture decode memory during startup.
          for await(const chunk of createReadStream(canonicalFile))accumulator.update(chunk);
          const hash=accumulator.digest('hex');
          if(hash!==record.gitBlob){response.writeHead(409,{'Content-Type':'text/plain'}).end('Asset changed since preview build. Rebuild the isolated preview.');return;}
          verified.set(canonicalFile,stamp);
        }
      }
      let range;
      try{range=request.method==='GET'?parseRange(request.headers.range,info.size):null;}catch{response.writeHead(416,{'Content-Range':'bytes */'+info.size}).end();return;}
      const status=range?206:200;
      const headers={'Content-Type':contentTypes[extname(file).toLowerCase()],'Accept-Ranges':'bytes','Cache-Control':'private, max-age=0, must-revalidate','X-Dequindre-Asset-Source':root.prefix.startsWith('/__swoop-assets__/')?'swoop':'belle','Content-Length':String(range?range.end-range.start+1:info.size)};
      if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
      response.writeHead(status,headers);
      report?.({url:pathname,bytes:info.size,gitBlob:record?.gitBlob});
      if(request.method==='HEAD'||info.size===0){response.end();return;}
      const stream=createReadStream(canonicalFile,range??undefined);
      stream.once('error',error=>response.destroy(error));response.once('close',()=>stream.destroy());stream.pipe(response);
    })().catch(error=>{if(response.headersSent)response.destroy(error);else response.writeHead(500,{'Content-Type':'text/plain'}).end('Preview asset read failed');});
  };
}
