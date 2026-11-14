import test from 'node:test';
import assert from 'node:assert/strict';
import {openSync,readSync,closeSync,statSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';

// Inspect actual GLB JSON chunks without decoding images or loading Three.js.
// This must run in a complete checkout: missing canonical assets fail the test.
function metadata(file){
 const fd=openSync(file,'r');try{
  const header=Buffer.alloc(20);assert.equal(readSync(fd,header,0,20,0),20);
  assert.equal(header.toString('ascii',0,4),'glTF');assert.equal(header.readUInt32LE(4),2);
  assert.equal(header.readUInt32LE(8),statSync(file).size,'complete GLB');
  const length=header.readUInt32LE(12);assert.equal(header.readUInt32LE(16),0x4e4f534a);
  assert(length>0&&length<16*1024*1024&&length+20<=statSync(file).size);
  const json=Buffer.alloc(length);let offset=0;
  while(offset<length){const n=readSync(fd,json,offset,length-offset,20+offset);assert(n>0);offset+=n;}
  return JSON.parse(json.toString('utf8').trim());
 }finally{closeSync(fd);}
}
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):e.isFile()&&e.name.endsWith('.glb')?[join(root,e.name)]:[]);}

test('canonical Belle GLBs retain the greenhouse and have no named maze nodes or materials',t=>{
 const root=resolve('public/belle'),landmarks=join(root,'landmarks.glb');
 assert(statSync(landmarks).size>0,'canonical landmark asset is required');
 const entries=files(root);assert(entries.length>0);
 let names=0,greenhouse=false;
 for(const file of entries){
  const json=metadata(file);
  for(const kind of ['nodes','meshes','materials','scenes'])for(const entry of json[kind]||[]){
   const name=String(entry.name||'');names++;
   assert(!/(?:\bmaze\b|\blabyrinth\b|gardenMaze)/i.test(name),relative(root,file)+': '+name);
   if(file===landmarks&&/conservatory/i.test(name))greenhouse=true;
  }
 }
 assert(greenhouse,'shared Conservatory architecture must not be unlinked');
 t.diagnostic(JSON.stringify({glbFiles:entries.length,namedEntriesChecked:names,mazeNamedEntries:0,sharedConservatoryPresent:greenhouse,scope:'Named GLB metadata; not proof against unnamed geometry or a GPU-performance measurement'}));
});
