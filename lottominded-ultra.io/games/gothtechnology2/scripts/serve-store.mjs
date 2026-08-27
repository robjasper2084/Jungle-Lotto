import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat,readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
const root=resolve(import.meta.dirname,'../dist');
const base=process.env.STORE_BASE_PATH||'/Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/';
const port=Number(process.env.STORE_PORT||4181);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json','.xml':'application/xml','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'};
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(!url.pathname.startsWith(base)){res.writeHead(302,{Location:base});res.end();return;}
    let relative=decodeURIComponent(url.pathname.slice(base.length));if(relative.endsWith('/')||!relative)relative+='index.html';
    let file=resolve(root,relative);
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    let info;
    try{info=await stat(file);if(info.isDirectory()){res.writeHead(302,{Location:url.pathname+'/'});res.end();return;}}
    catch{res.writeHead(404,{'Content-Type':'text/html'});res.end(await readFile(resolve(root,'404.html')));return;}
    const headers={'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
    const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),info.size-1):info.size-1;if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${info.size}`});createReadStream(file,{start,end}).pipe(res);}
    else{res.writeHead(200,{...headers,'Content-Length':info.size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}
  }catch{res.writeHead(400);res.end('Invalid request');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Store preview: http://127.0.0.1:${port}${base}`));
