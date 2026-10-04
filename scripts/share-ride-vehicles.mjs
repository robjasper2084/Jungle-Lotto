import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';

const names=['Ebike_talaria','Ebike_ultra','Ebike_sr','Ebike_varg','Euc_city','Euc_tour','Euc_trail','Euc_speed'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Published games reuse byte-identical vehicle models; standalone/source builds keep both copies. */
export async function shareRideVehicles(outputRoot){
  const arcade=resolve(outputRoot,'lottominded-ultra.io/games/gothtechnology2/arcade');
  const source=resolve(arcade,'swoop-detroit/exports/electric');
  const canonical=resolve(arcade,'elmwood-explorer/exports/electric');
  const candidates=[];
  for(const name of names){
    const [a,b]=await Promise.all([readFile(resolve(source,name+'.glb')),readFile(resolve(canonical,name+'.glb'))]);
    if(hash(a)!==hash(b))throw new Error('Shared electric vehicle differs between games: '+name);
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
