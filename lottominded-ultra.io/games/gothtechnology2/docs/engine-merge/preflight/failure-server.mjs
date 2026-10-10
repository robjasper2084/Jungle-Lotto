// Loopback fault injection for browser acceptance only; never included in a game package.
import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('.game-builds/engine-merge-20261009');
http.createServer(async(req,res)=>{try{
 let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.endsWith('/'))pathname+='index.html';
 const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep))throw Error('path');
 if(file.endsWith('.wasm')){res.setHeader('Content-Type','application/wasm');res.end(Buffer.from([0,1,2,3]));return;}
 const info=await stat(file);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.mp4':'video/mp4','.mp3':'audio/mpeg'}[extname(file)]??'application/octet-stream'));res.setHeader('Content-Length',info.size);createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end('Missing file');}}).listen(4192,'127.0.0.1',()=>console.log('Local engine hash-failure test: http://127.0.0.1:4192'));
