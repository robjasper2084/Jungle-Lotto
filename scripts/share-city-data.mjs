import {readFile,readdir,writeFile,rename,unlink} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
const source='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/995108b365a915c6aa7fe0c957915475ace1009f/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/';
export const CITY_DATA=[
 {file:'love-tag/swoop-detroit.json.gz',from:'./love-tag/swoop-detroit.json',to:source+'love-tag/swoop-detroit.json',sha:'64fc5daa1c15676a6605f8c0c95eca0ceb7fc1f5e414f792fdef9ab3f61aba3d'},
 {file:'exports/street-life/street-surfaces.bin.gz',from:'./exports/street-life/street-surfaces.bin.gz',to:source+'exports/street-life/street-surfaces.bin.gz',sha:'756d55639f0dd568734d6a75f8dfd8b888d3d1498aa685398642fb90a4d3bc16'},
];
async function texts(root){const files=[];for(const e of await readdir(root,{withFileTypes:true})){const p=resolve(root,e.name);if(e.isDirectory())files.push(...await texts(p));else if(/\.(js|html|json|css)$/.test(e.name))files.push(p);}return files;}
/** Deployment only. Verify the exact pinned city/cache bytes before changing
 * literal loaders. A changed map fails closed rather than serving stale data. */
export async function shareCityData(root,specs=CITY_DATA){
 const game=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit'),edits=[],remove=[];let saved=0;
 for(const spec of specs){const path=resolve(game,spec.file),bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')!==spec.sha)throw Error('Pinned city data changed: '+spec.file);remove.push({path,size:bytes.length});}
 for(const path of await texts(game)){const before=await readFile(path,'utf8');let after=before;for(const spec of specs)after=after.replaceAll(spec.from,spec.to);if(after!==before)edits.push({path,before,after});}
 for(const spec of specs)if(!edits.some(e=>e.before.includes(spec.from)))throw Error('City loader missing: '+spec.from);
 for(const e of edits){const temp=e.path+'.'+randomUUID()+'.tmp';await writeFile(temp,e.after,{flag:'wx'});await rename(temp,e.path);saved+=Buffer.byteLength(e.before)-Buffer.byteLength(e.after);}
 for(const f of remove){await unlink(f.path);saved+=f.size;}
 console.log('Shared exact pinned city data: '+(saved/1048576).toFixed(1)+' MiB.');return{saved,files:remove.length,source};
}
