import {copyFile as copy,cp as copyTree,link,mkdir,readdir,stat} from 'node:fs/promises';
import {dirname,resolve,extname,join} from 'node:path';
const immutable=new Set(['.glb','.png','.jpg','.jpeg','.webp','.hdr','.mp3','.wav','.ogg','.mp4','.webm','.ktx2','.gz','.wasm','.data']);
/** Local review only: reuse immutable media bytes on the same NTFS volume.
 * Source/config JSON/HTML stay separate; compressed exported fixtures are immutable. */
export async function copyFile(source,target){
 const root=process.env.GAME_REVIEW_ASSET_ROOT;
 if(!root||!immutable.has(extname(source).toLowerCase()))return copy(source,target);
 const base=resolve(root).replaceAll('\\','/'),dest=resolve(target).replaceAll('\\','/');
 if(!dest.startsWith(base+'/'))throw Error('Review media destination escaped its isolated directory');
 await mkdir(dirname(target),{recursive:true});
 try{await link(source,target);}catch(error){if(error.code==='EEXIST')throw error;await copy(source,target);}
}
export async function cp(source,target,options){
 if(!process.env.GAME_REVIEW_ASSET_ROOT)return copyTree(source,target,options);
 if(options?.filter&&!await options.filter(source,target))return;
 const info=await stat(source);if(!info.isDirectory())return copyFile(source,target);
 await mkdir(target,{recursive:true});for(const name of await readdir(source))await cp(join(source,name),join(target,name),options);
}
