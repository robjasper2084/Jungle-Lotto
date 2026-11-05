import {readdir,readFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
export const belleProduct='lottominded-ultra.io/games/gothtechnology2';
export const belleRoute=belleProduct+'/arcade/belle-isle-explorer/';
// Always deliver this run's validated build, never the archived storefront copy.
export async function replaceBelleBuild(repoRoot,storeFiles){
 const dist=resolve(repoRoot,belleProduct,'belle-isle-source/game/dist');
 const required=['index.html','asset-manifest.json'];
 for(const item of required)if(!(await stat(resolve(dist,item)).catch(()=>null))?.isFile())throw Error('Belle Isle production build missing '+item);
 const manifest=JSON.parse(await readFile(resolve(dist,'asset-manifest.json'),'utf8'));
 for(const item of manifest){const target=resolve(dist,item);if(!target.startsWith(dist+sep)||!(await stat(target).catch(()=>null))?.isFile())throw Error('Belle Isle runtime asset missing or unsafe: '+item);}
 const files=[];
 async function walk(dir,prefix=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const local=prefix+entry.name,source=resolve(dir,entry.name);
   if(/(^|\/)(node_modules|src|\.env[^/]*)(\/|$)|\.(ts|tsx|map)$/.test(local))throw Error('Refusing private Belle Isle build file: '+local);
   if(entry.isDirectory())await walk(source,local+'/');
   else if(entry.isFile())files.push({source,path:belleRoute+local,bytes:(await stat(source)).size});
   else throw Error('Refusing non-file Belle Isle build entry: '+local);
  }
 }
 await walk(dist);
 const html=await readFile(resolve(dist,'index.html'),'utf8');
 const chunks=[...html.matchAll(/(?:src|href)=["']\.\/([^"']+\.(?:js|css))["']/g)].map(x=>x[1]);
 if(!chunks.some(x=>x.endsWith('.js'))||!chunks.some(x=>x.endsWith('.css'))||chunks.some(x=>!files.some(f=>f.path===belleRoute+x)))throw Error('Belle Isle entry is missing compiled scripts or styles');
 return [...storeFiles.filter(f=>!f.path.startsWith(belleRoute)),...files];
}
