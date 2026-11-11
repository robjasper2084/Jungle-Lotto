import {createHash} from 'node:crypto';
import {lstat,readFile,mkdir,rm,writeFile} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function gitBlobSha(bytes){
  return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
}
export async function stagePublicAssets({manifest,canonicalRoot,outputRoot}){
  if(manifest?.version!==1||!Array.isArray(manifest.files)||!manifest.files.length){
    throw Error('Expected a nonempty, version-1 canonical media manifest');
  }
  const canonical=resolve(canonicalRoot),output=resolve(outputRoot);
  const canonicalAssets=resolve(canonical,'assets'),outputAssets=resolve(output,'assets');
  if(output===canonical||output===canonicalAssets||output===sourceRoot||canonical.startsWith(output+sep)){
    throw Error('Refusing unsafe generated-public output root');
  }
  const seen=new Set(),staged=[];let total=0;
  // Verify ALL original immutable bytes before cleaning/writing generated media.
  for(const file of manifest.files){
    const path=file?.path;
    if(typeof path!=='string'||!/^assets\/[a-zA-Z0-9._/-]+$/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(path)){
      throw Error('Unsafe or repeated public media path: '+String(path));
    }
    seen.add(path);
    const source=resolve(canonical,path),dest=resolve(output,path);
    if(!source.startsWith(canonicalAssets+sep)||!dest.startsWith(outputAssets+sep))throw Error('Escaping public asset root: '+path);
    const info=await lstat(source);
    if(!info.isFile()||info.size!==file.bytes)throw Error('Canonical media size/type mismatch: '+path);
    const bytes=await readFile(source);
    if(!/^[a-f0-9]{40}$/.test(file.sha)||gitBlobSha(bytes)!==file.sha)throw Error('Canonical media Git-object checksum mismatch: '+path);
    total+=bytes.length;staged.push({dest,bytes});
  }
  if(total!==manifest.bytes||staged.length!==manifest.count)throw Error('Canonical media manifest total mismatch');
  await rm(output,{recursive:true,force:true});
  for(const file of staged){
    await mkdir(dirname(file.dest),{recursive:true});
    await writeFile(file.dest,file.bytes);
  }
  return {count:staged.length,bytes:total};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manifest=JSON.parse(await readFile(new URL('./public-assets.manifest.json',import.meta.url),'utf8'));
  const result=await stagePublicAssets({manifest,canonicalRoot:resolve(sourceRoot,'..'),outputRoot:resolve(sourceRoot,'.generated-public')});
  console.log('Staged '+result.count+' verified Jackpot Maze media files ('+(result.bytes/1048576).toFixed(2)+' MiB) from canonical published assets.');
}
