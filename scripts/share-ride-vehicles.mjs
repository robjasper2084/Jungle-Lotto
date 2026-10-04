import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';

const names=['Ebike_talaria','Ebike_ultra','Ebike_sr','Ebike_varg','Euc_city','Euc_tour','Euc_trail','Euc_speed'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// Texture sharing gives identical models different relative image URIs. Verify
// the actual image bytes and embedded geometry before reusing the canonical GLB.
async function modelIdentity(bytes,path,outputRoot){
  if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67)return null;
  const length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+length));
  if(gltf.buffers?.some(b=>b.uri))throw Error('External geometry is not supported for vehicle sharing');
  for(const image of gltf.images??[]){
    if(!image.uri)continue;
    if(/^(?:[a-z]+:|\/)/i.test(image.uri))throw Error('Nonlocal vehicle texture');
    const file=resolve(dirname(path),decodeURIComponent(image.uri));
    if(!file.startsWith(resolve(outputRoot)+sep))throw Error('Vehicle texture outside artifact');
    image.uri='sha256:'+hash(await readFile(file));
  }
  return hash(Buffer.concat([Buffer.from(JSON.stringify(gltf)),bytes.subarray(28+length)]));
}

/** Published games reuse byte-identical vehicle models; standalone/source builds keep both copies. */
export async function shareRideVehicles(outputRoot){
  const arcade=resolve(outputRoot,'lottominded-ultra.io/games/gothtechnology2/arcade');
  const source=resolve(arcade,'swoop-detroit/exports/electric');
  const canonical=resolve(arcade,'elmwood-explorer/exports/electric');
  const candidates=[];
  for(const name of names){
    const [a,b]=await Promise.all([readFile(resolve(source,name+'.glb')),readFile(resolve(canonical,name+'.glb'))]);
    if(hash(a)!==hash(b)){
      const [left,right]=await Promise.all([modelIdentity(a,resolve(source,name+'.glb'),outputRoot),modelIdentity(b,resolve(canonical,name+'.glb'),outputRoot)]);
      if(!left||left!==right)throw new Error('Shared electric vehicle differs between games: '+name);
    }
    candidates.push({path:resolve(source,name+'.glb'),bytes:a.length});
  }
  const assets=resolve(arcade,'swoop-detroit/assets'),edits=[];
  for(const file of await readdir(assets)){
    if(!file.endsWith('.js'))continue;
    const path=resolve(assets,file),input=await readFile(path,'utf8');
    const output=input.replaceAll('"./exports/electric/"','"../elmwood-explorer/exports/electric/"').replaceAll("'./exports/electric/'","'../elmwood-explorer/exports/electric/'");
    if(output!==input)edits.push({path,input,output});
  }
  if(!edits.length)throw new Error('No Swoop electric asset loader found; retaining all models.');
  for(const edit of edits)await writeFile(edit.path,edit.output);
  for(const candidate of candidates)await unlink(candidate.path);
  const saved=candidates.reduce((n,c)=>n+c.bytes,0)-edits.reduce((n,e)=>n+Buffer.byteLength(e.output)-Buffer.byteLength(e.input),0);
  console.log(`Shared ${candidates.length} identical electric vehicles; saved ${(saved/1048576).toFixed(1)} MiB.`);
  return {models:candidates.length,saved};
}
