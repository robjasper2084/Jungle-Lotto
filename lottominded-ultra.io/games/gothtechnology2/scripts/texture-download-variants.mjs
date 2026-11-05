import {readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../package.json',import.meta.url))('sharp');
/** Derived downloads only. Original authoring pixels and HD textures stay intact. */
export async function textureDownloadVariants(directory){
 const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true}).catch(()=>[])){if(e.isSymbolicLink())throw Error('Unexpected texture symlink');const p=resolve(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(webp|png|jpe?g)$/i.test(p))files.push(p);}}
 for(const name of ['textures','shared-textures'])await walk(resolve(directory,name));
 let originalBytes=0;const bytes={512:0,1024:0};
 for(const file of files){const rel=relative(directory,file).split(sep).join('/');originalBytes+=(await stat(file)).size;
  for(const size of [512,1024]){const target=resolve(directory,'texture-variants',String(size),rel+'.webp');await mkdir(dirname(target),{recursive:true});const data=await sharp(file).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({quality:90,alphaQuality:100,effort:4}).toBuffer();await writeFile(target,data);bytes[size]+=data.length;}
 }
 const report={textures:files.length,originalBytes,variantBytes:bytes,preserves:'Source textures and full-resolution package originals; derived variants selected by graphics budget'};await writeFile(resolve(directory,'texture-download-budget.json'),JSON.stringify(report,null,2));return report;
}
