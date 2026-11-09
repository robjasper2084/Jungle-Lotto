/** Build-time inspection only. No downloads, copies, new model generation or live mutations. */
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {RIDERS,SOURCE_ROOT,SOURCE_REVISION} from './coop.ts';
export function inspectGlb(bytes, expectedBlob) {
  if(!Buffer.isBuffer(bytes)||bytes.length<20||bytes.length>64*1024*1024)throw Error('Invalid or oversized GLB.');
  const blob=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  if(expectedBlob&&blob!==expectedBlob)throw Error('Source model changed; review and repin explicitly.');
  if(bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Expected a complete glTF 2 GLB, not a pointer or placeholder.');
  const length=bytes.readUInt32LE(12);
  if(bytes.readUInt32LE(16)!==0x4e4f534a||length%4!==0||length>bytes.length-20)throw Error('Invalid GLB JSON chunk.');
  const json=JSON.parse(bytes.toString('utf8',20,20+length));
  if(!Array.isArray(json.nodes)||!Array.isArray(json.skins)||!json.skins.length||!json.skins.every(s=>Array.isArray(s.joints)&&s.joints.length>0&&s.joints.every(j=>Number.isInteger(j)&&j>=0&&j<json.nodes.length)))throw Error('A valid skinned rider with existing joint nodes is required.');
  if(!json.nodes.some(n=>Number.isInteger(n.skin)&&n.skin>=0&&n.skin<json.skins.length&&Number.isInteger(n.mesh)))throw Error('No skinned mesh node.');
  const animations=(json.animations??[]).map(a=>a.name).filter(n=>typeof n==='string');
  return {blob,bytes:bytes.length,skins:json.skins.length,joints:json.skins.map(s=>s.joints.length),animations,rigFit:'not validated in Belle Isle'};
}
export async function inspectSwoopRoster(repoRoot) {
  const root=resolve(repoRoot),dir=resolve(root,SOURCE_ROOT,'swoop-source/public/exports/rigged-heroes');
  const manifest=JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));
  if(!Array.isArray(manifest.heroes))throw Error('Swoop hero manifest missing.');
  const riders=[];
  for(const rider of RIDERS){
    const entry=manifest.heroes.find(h=>h.hero===rider.id);if(!entry)throw Error('Missing source hero '+rider.id);
    const path=resolve(dir,rider.id+'.glb'),info=await stat(path);
    if(info.size>64*1024*1024||info.size<20)throw Error('Unsafe model size: '+rider.id);
    const report=inspectGlb(await readFile(path),rider.blob);
    if(entry.bytes!==report.bytes)throw Error('Manifest byte mismatch: '+rider.id);
    for(const name of entry.animations??[])if(!report.animations.includes(name))throw Error('Declared clip absent: '+rider.id+'/'+name);
    riders.push({id:rider.id,sourcePath:SOURCE_ROOT+'swoop-source/public/exports/rigged-heroes/'+rider.id+'.glb',...report});
  }
  return {sourceRevision:SOURCE_REVISION,inspectionOnly:true,copiedBytes:0,rigRetargetingPerformed:false,riders};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==3)throw Error('Usage: node --experimental-strip-types assetBridge.mjs /absolute/repository/root');
  console.log(JSON.stringify(await inspectSwoopRoster(process.argv[2]),null,2));
}
