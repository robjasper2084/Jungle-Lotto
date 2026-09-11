import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const store=resolve(root,'lottominded-ultra.io/games/gothtechnology2/dist');
const storePath='/lottominded-ultra.io/games/gothtechnology2/';
const port=Number(process.argv[2]||4183);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp3':'audio/mpeg','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.woff2':'font/woff2','.wasm':'application/wasm','.webmanifest':'application/manifest+json'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){res.writeHead(302,{Location:'/Jungle-Lotto'+storePath});res.end();return;}
  const pathname=decodeURIComponent(url.pathname.replace(/^\/Jungle-Lotto(?=\/)/,''));
  const isStore=pathname.startsWith(storePath),base=isStore?store:root;
  const relative=isStore?pathname.slice(storePath.length):pathname.replace(/^\//,'');
  let file=resolve(base,relative||'.');
  if(file!==base&&!file.startsWith(base+sep)){res.writeHead(403);res.end('Forbidden');return;}
  let info=await stat(file);
  if(info.isDirectory()){
   if(!url.pathname.endsWith('/')){res.writeHead(302,{Location:url.pathname+'/'+url.search});res.end();return;}
   file=resolve(file,'index.html');info=await stat(file);
  }
  if(!info.isFile())throw Error('Not found');
  const headers={'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),info.size-1):info.size-1;if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${info.size}`});if(req.method==='HEAD')res.end();else createReadStream(file,{start,end}).pipe(res);}
  else{res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Connected preview: http://127.0.0.1:${port}/Jungle-Lotto${storePath}`));
