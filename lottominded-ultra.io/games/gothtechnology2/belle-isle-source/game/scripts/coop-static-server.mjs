import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname,resolve,sep} from 'node:path';

const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.wav':'audio/wav'};

/** Serve only the checked-out public build. Revalidate every asset request.
 * Chromium can report ERR_ABORTED after successful Fetch stream EOF with
 * no-store (microsoft/playwright#42742). These are public static game assets,
 * not sensitive responses: no-cache retains mandatory freshness without that
 * no-store streaming path. No validators/304s or asset/error substitutions.
 */
export function createCoopStaticServer(directory){
 const root=resolve(directory);
 return createServer(async(req,res)=>{
  try{
   let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
   if(path!==root&&!path.startsWith(root+sep))throw Error('Invalid path');
   if((await stat(path)).isDirectory())path=resolve(path,'index.html');
   const info=await stat(path);
   res.writeHead(200,{
    'Content-Type':mime[extname(path)]||'application/octet-stream',
    'Content-Length':info.size,
    'Cache-Control':'no-cache, max-age=0, must-revalidate'
   });
   if(req.method==='HEAD')res.end();
   else createReadStream(path).on('error',()=>res.destroy()).pipe(res);
  }catch{res.writeHead(req.url==='/favicon.ico'?204:404).end();}
 });
}
