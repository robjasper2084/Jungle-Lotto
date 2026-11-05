import {readFile,readdir,unlink} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {atomicGameAsset} from './atomic-game-asset.mjs';
import manifest from './published-ride-textures.json' with {type:'json'};
/** Deployment only: reuse exact texture bytes already published at an immutable
 * release commit. Standalone builds and authoring assets stay self-contained. */
export async function sharePublishedRideTextures(root,spec=manifest){
 const arcade=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade'),targets=new Map();let saved=0;
 for(const entry of spec.files){
  if(!/^(swoop-detroit|elmwood-explorer)\/shared-textures\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(entry.path))throw Error('Invalid published texture path');
  const path=resolve(arcade,entry.path),bytes=await readFile(path);
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Published texture changed: '+entry.path);
  targets.set(path,spec.base+entry.path);saved+=bytes.length;
 }
 async function walk(dir){let files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
 const edits=[],referenced=new Set();
 for(const game of ['swoop-detroit','elmwood-explorer'])for(const path of await walk(resolve(arcade,game))){
  if(path.endsWith('.glb')){const b=await readFile(path),length=b.readUInt32LE(12),json=JSON.parse(b.toString('utf8',20,20+length));let changed=false;
   for(const image of json.images??[]){if(!image.uri||/^(https?:|data:|\/)/.test(image.uri))continue;const from=resolve(dirname(path),decodeURIComponent(image.uri)),url=targets.get(from);if(url){image.uri=url;referenced.add(from);changed=true;}}
   if(changed){const text=Buffer.from(JSON.stringify(json)),head=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(head);const tail=b.subarray(20+length),out=Buffer.alloc(20+head.length+tail.length);b.copy(out,0,0,20);out.writeUInt32LE(out.length,8);out.writeUInt32LE(head.length,12);head.copy(out,20);tail.copy(out,20+head.length);edits.push({path,b,out});}
  }else if(/\.(js|html|css|json)$/.test(path)){
   // Fail closed if a caller gains a literal reference we cannot safely rewrite.
   const text=await readFile(path,'utf8');for(const p of targets.keys())if(text.includes(p.split(sep).at(-1)))throw Error('Texture has a direct text reference: '+relative(root,path));
  }
 }
 // Vehicle deduplication may already have retired a model using a pool entry.
 // Exact verified generated copies with no remaining references can retire too.
 for(const {path,b,out} of edits){await atomicGameAsset(path,out);saved+=b.length-out.length;}
 for(const p of targets.keys())await unlink(p);
 console.log(`Shared ${targets.size} exact published riding textures: ${(saved/1048576).toFixed(1)} MiB.`);return{saved,files:targets.size,models:edits.length,source:spec.base};
}
