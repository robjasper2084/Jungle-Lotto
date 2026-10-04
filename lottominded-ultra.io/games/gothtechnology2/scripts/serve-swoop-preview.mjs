import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve,sep,extname,join} from 'node:path';

// One serving root and handler for both local ports; no second checkout can drift.
const root=resolve(import.meta.dirname,'../store/public');
const storefront=resolve(import.meta.dirname,'../dist');
const wave=resolve(import.meta.dirname,'../../opengw-levels');
const base='/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const waveBase='/Jungle-Lotto/lottominded-ultra.io/games/opengw-levels/';
const entry=base+'arcade/swoop-detroit/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
async function serve(req,res){
 if(req.url?.startsWith('/__penny/')){
  const proxy=http.request({host:'127.0.0.1',port:4182,path:req.url.slice('/__penny'.length),method:req.method,headers:{...req.headers,host:'127.0.0.1:4182'}},reply=>{res.writeHead(reply.statusCode??502,reply.headers);reply.pipe(res);});
  proxy.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:'AUCTION_BACKEND_OFFLINE'}));else res.destroy();});req.pipe(proxy);return;
 }
 if(req.method==='POST'&&req.url==='/__swoop_capture'){
  const origin=req.headers.origin,type=req.headers['content-type']??'';
  if(!/^http:\/\/(127\.0\.0\.1|localhost):418[01]$/.test(origin??'')||!/^video\/(mp4|webm)(;|$)/.test(type)){res.writeHead(403).end();return;}
  const chunks=[];let size=0;try{for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}if(size<100){res.writeHead(400).end();return;}
   const directory=resolve(import.meta.dirname,'../swoop-source/art/cinematics'),file='gameplay-'+randomUUID()+'.'+(type.startsWith('video/mp4')?'mp4':'webm');await mkdir(directory,{recursive:true});await writeFile(join(directory,file),Buffer.concat(chunks),{flag:'wx'});res.writeHead(201,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({file}));
  }catch{res.writeHead(500).end();}return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname==='/'){res.writeHead(302,{Location:entry}).end();return;}
 const isWave=pathname.startsWith(waveBase),mount=isWave?wave:root;
 const rel=isWave?pathname.slice(waveBase.length):pathname.startsWith(base)?pathname.slice(base.length):pathname.slice(1);
 let file=resolve(mount,rel);
 if(file!==mount&&!file.startsWith(mount+sep)){res.writeHead(403).end();return;}
 try{
  let info;
  try{info=await stat(file);if(info.isDirectory()){file=join(file,'index.html');info=await stat(file);}}
  catch(error){if(isWave)throw error;file=resolve(storefront,rel);if(file!==storefront&&!file.startsWith(storefront+sep))throw error;info=await stat(file);if(info.isDirectory()){file=join(file,'index.html');info=await stat(file);}}
  if(!info.isFile())throw Error('not a file');
  const headers={'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes','X-Swoop-Preview':'shared-4180-4181'};
  let start=0,end=info.size-1,status=200;
  if(req.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
   if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   if(!match[1])start=Math.max(0,info.size-Number(match[2]));else start=Number(match[1]);
   if(match[1]&&match[2])end=Math.min(end,Number(match[2]));
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
   status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
  }
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);
  if(req.method==='HEAD')res.end();else{const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);}
 }catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Local preview file not found');}
}
for(const port of [4180,4181]){
 const server=http.createServer((req,res)=>{void serve(req,res);});
 // An occupied port must stop the whole pair, rather than create another split.
 server.on('error',error=>{console.error(`Port ${port}: ${error.message}`);process.exit(1);});
 server.listen(port,'127.0.0.1',()=>console.log(`Shared Swoop preview: http://127.0.0.1:${port}${entry}`));
}
