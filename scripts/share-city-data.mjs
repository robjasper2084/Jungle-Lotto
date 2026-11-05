import {readFile,readdir,writeFile,rename,unlink} from 'node:fs/promises';import {resolve} from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {gunzipSync} from 'node:zlib';
const source='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/995108b365a915c6aa7fe0c957915475ace1009f/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/';
export const COLLIDER_SOURCE='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/e09dc4a75d8a7490d86f46344072b1202bb8b436/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/';
export const CITY_DATA=[
 // The reviewed v2 manifest and geometry are hosted together at an immutable
 // commit. Keep these exact bytes while fitting the Pages artifact size cap.
 {file:'love-tag/swoop-detroit.json.gz',from:'./love-tag/swoop-detroit.json',to:COLLIDER_SOURCE+'love-tag/swoop-detroit.json',sha:'739ef5f08175664a95ab35e5082627960c7d044c8ea06604f5b0a68674bd38d2'},
 {file:'love-tag/swoop-detroit.browser.json.gz',derivedFrom:'./love-tag/swoop-detroit.json',sha:'889af027726e918e6dae7a5b3b15e0f046317bb2205a565e528cb65de68b504b'},
 {file:'love-tag/swoop-detroit.physics-c573f8d7a1f757c5.bin.gz',derivedFrom:'./love-tag/swoop-detroit.json',sha:'58620337b1e2100bccfae0c0df28dbe1ee9c4ad9329591c75edd53175aaa5782'},
 {file:'love-tag/swoop-detroit.physics-178d8d52b4f2e37c.bin.gz',sha:'cb444718a28e193756afacf731aaddd17d8cb8ed004affd5791594e90ec486e8'},
 {file:'exports/street-life/street-surfaces.bin.gz',from:'./exports/street-life/street-surfaces.bin.gz',to:source+'exports/street-life/street-surfaces.bin.gz',sha:'756d55639f0dd568734d6a75f8dfd8b888d3d1498aa685398642fb90a4d3bc16'},
];
async function texts(root){const files=[];for(const e of await readdir(root,{withFileTypes:true})){const p=resolve(root,e.name);if(e.isDirectory())files.push(...await texts(p));else if(/\.(js|html|json|css)$/.test(e.name))files.push(p);}return files;}
/** Deployment only. Verify the exact pinned city/cache bytes before changing
 * literal loaders. A changed map fails closed rather than serving stale data. */
export async function shareCityData(root,specs=CITY_DATA){
 const game=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit'),edits=[],remove=[];let saved=0;
 if(specs===CITY_DATA)await verifyLocalColliders(resolve(game,'love-tag'));
 for(const spec of specs){const path=resolve(game,spec.file),bytes=await readFile(path);if(createHash('sha256').update(bytes).digest('hex')!==spec.sha)throw Error('Pinned city data changed: '+spec.file);remove.push({path,size:bytes.length});}
 for(const spec of specs)if(spec.derivedFrom&&!specs.some(parent=>parent.from===spec.derivedFrom&&parent.to))throw Error('Pinned map parent missing: '+spec.file);
 for(const path of await texts(game)){const before=await readFile(path,'utf8');let after=before;for(const spec of specs)if(spec.from)after=after.replaceAll(spec.from,spec.to);if(after!==before)edits.push({path,before,after});}
 for(const spec of specs)if(spec.from&&!edits.some(e=>e.before.includes(spec.from)))throw Error('City loader missing: '+spec.from);
 for(const e of edits){const temp=e.path+'.'+randomUUID()+'.tmp';await writeFile(temp,e.after,{flag:'wx'});await rename(temp,e.path);saved+=Buffer.byteLength(e.before)-Buffer.byteLength(e.after);}
 for(const f of remove){await unlink(f.path);saved+=f.size;}
 console.log('Shared exact pinned city data: '+(saved/1048576).toFixed(1)+' MiB.');return{saved,files:remove.length,source};
}

/** Keep deployment atomic: validate the replacement before removing legacy data. */
export async function verifyLocalColliders(directory){
 const manifest=JSON.parse(gunzipSync(await readFile(resolve(directory,'swoop-detroit.browser.json.gz'))));
 if(manifest.version!==2||manifest.encoding!=='colliders-v1'||!/^swoop-detroit\.physics-[a-f0-9]{16}\.bin\.gz$/.test(manifest.physics))throw Error('Lossless collider manifest required before removing snapshots');
 const bytes=gunzipSync(await readFile(resolve(directory,manifest.physics)));
 if(bytes.length!==manifest.physicsBytes||createHash('sha256').update(bytes).digest('hex')!==manifest.physicsHash)throw Error('Local collider replacement failed integrity check');
 return manifest;
}
