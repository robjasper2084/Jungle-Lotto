/** Stage the verified CORLEO animation exports into the Vite public directory.
 * Usage: node scripts/stage-corleo-assets.mjs /absolute/path/Animation_Library.zip
 * Must be run after npm install in game/ (fflate dependency).
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {unzipSync} from 'fflate';
const actions=['MOUNT','RUN','CRAWL','JUMP','DISMOUNT'];
const variants=['Professional','Maverick'];
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const input=process.argv[2];
if(!input){console.error('Provide the Animation_Library.zip export from CORLEO_Blender_Kit.zip');process.exitCode=2;}
else{
 const entries=unzipSync(new Uint8Array(await readFile(input)));
 const files=[];
 const destination=join(root,'public','belle','vehicles','corleo');
 for(const variant of variants)for(const action of actions){
  const name='CORLEO_'+variant+'_'+action+'.glb';
  const bytes=entries['exports/'+name];
  if(!bytes||bytes.byteLength<1000)throw Error('Missing export: '+name);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid GLB: '+name);
  const jsonBytes=bytes.subarray(20,20+view.getUint32(12,true));
  const json=JSON.parse(new TextDecoder().decode(jsonBytes));
  const names=(json.animations??[]).map(a=>a.name);
  if(!names.includes(name))throw Error('Missing expected animation '+name);
  if(!json.nodes?.length||!json.scenes?.length)throw Error('GLB lacks scene: '+name);
  files.push({name,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.byteLength,animation:name});
 }
 await mkdir(destination,{recursive:true});
 // All archives must validate before any destination files are replaced.
 for(const file of files)await writeFile(join(destination,file.name),file.bytes);
 await writeFile(join(destination,'manifest.json'),JSON.stringify({
  schema:'corleo-anim-v1',source:'Animation_Library.zip',
  disclaimer:'Kinematic prototype animations, not verified Kawasaki hardware performance',
  files:files.map(({name,sha256,size,animation})=>({name,sha256,size,animation}))
 },null,2)+'\n');
 console.log('Staged '+files.length+' verified CORLEO GLBs into '+destination);
}
