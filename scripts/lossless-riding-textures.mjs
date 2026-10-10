import {readFile,readdir,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../lottominded-ultra.io/games/gothtechnology2/package.json',import.meta.url));
const sharp=require('sharp');
async function walk(root){let out=[];for(const e of await readdir(root,{withFileTypes:true}).catch(()=>[])){const p=resolve(root,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
async function atomic(path,bytes){const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,path);}
/** Deployment only: verify decoded pixels before replacing a generated texture.
 * Authoring PNGs remain untouched; model buffers, rigs and animation stay exact. */
export async function losslessRidingTextures(root){
 const arcade=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade');
 const files=(await Promise.all(['swoop-detroit','elmwood-explorer'].map(g=>walk(resolve(arcade,g))))).flat();
 const models=files.filter(p=>p.endsWith('.glb')),images=new Map(),parsed=[];
 for(const path of models){const b=await readFile(path);if(b.readUInt32LE(0)!==0x46546c67)continue;const size=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+size));parsed.push({path,b,size,j});for(const image of j.images??[]){if(!image.uri||/^(data:|https?:|\/)/.test(image.uri))continue;const p=resolve(dirname(path),decodeURIComponent(image.uri));if(p.startsWith(arcade+sep)&&/[a-f0-9]{64}\.png$/.test(p))images.set(p,p.slice(0,-4)+'.webp');}}
 const changed=new Map();let saved=0;
 for(const [p,to]of images){const original=await readFile(p),encoded=await sharp(original).webp({lossless:true,effort:6}).toBuffer();if(encoded.length>=original.length*.97)continue;const a=await sharp(original).ensureAlpha().raw().toBuffer(),b=await sharp(encoded).ensureAlpha().raw().toBuffer();if(!a.equals(b))continue;await atomic(to,encoded);changed.set(p,to);saved+=original.length-encoded.length;}
 for(const {path,b,size,j}of parsed){let edit=false;const converted=new Set();for(const [i,im]of (j.images??[]).entries()){if(!im.uri||/^(data:|https?:|\/)/.test(im.uri))continue;const to=changed.get(resolve(dirname(path),decodeURIComponent(im.uri)));if(to){im.uri=relative(dirname(path),to).split(sep).join('/');im.mimeType='image/webp';converted.add(i);edit=true;}}if(!edit)continue;for(const texture of j.textures??[])if(converted.has(texture.source)){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;j.extensionsUsed=[...new Set([...(j.extensionsUsed??[]),'EXT_texture_webp'])];j.extensionsRequired=[...new Set([...(j.extensionsRequired??[]),'EXT_texture_webp'])];}const raw=Buffer.from(JSON.stringify(j)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);const tail=b.subarray(20+size),out=Buffer.alloc(20+json.length+tail.length);b.copy(out,0,0,20);out.writeUInt32LE(out.length,8);out.writeUInt32LE(json.length,12);json.copy(out,20);tail.copy(out,20+json.length);saved+=b.length-out.length;await atomic(path,out);}
 // Hashed image names cannot be constructed from human labels. Update any
 // literal metadata/module references before retiring the artifact's PNG copy.
 for(const p of files.filter(p=>/\.(js|html|json|css)$/.test(p))){let s=await readFile(p,'utf8'),out=s;for(const [from,to]of changed){const name=from.split(sep).at(-1);out=out.replaceAll(name,to.split(sep).at(-1));}if(out!==s){saved+=Buffer.byteLength(s)-Buffer.byteLength(out);await atomic(p,out);}}
 for(const p of changed.keys())await unlink(p);
 console.log('Lossless riding texture conversion: '+changed.size+' textures, '+(saved/1048576).toFixed(1)+' MiB saved; decoded RGBA verified.');return{files:changed.size,saved};
}
