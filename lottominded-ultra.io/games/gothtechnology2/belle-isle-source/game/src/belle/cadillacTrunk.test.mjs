import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=fileURLToPath(new URL('../../',import.meta.url));
const module=path.join(game,'.test/cadillac-trunk-visual.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacTrunk.ts'],outfile:module,
 bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacTrunk,CADILLAC_TRUNK_INSTALL}=await import(pathToFileURL(module).href);

// Keep the shipped geometry; remove texture references only in this Node fixture.
const bytes=await fs.readFile(path.join(game,'public/belle/vehicles/silver-cadillac.glb'));
const length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
data.materials=(data.materials??[]).map(material=>({name:material.name}));
const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
const car=await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
function fixture(transformed=false){
 const model=car.scene.clone(true),body=model.getObjectByName('SprungBody'),lid=new T.Group();
 lid.name='Cadillac_TrunkLid';lid.position.set(0,1.0225,-1.5695);body.add(lid);
 if(transformed){model.position.set(124,3,-212);model.rotation.set(.08,1.4,-.06);}
 const system=new CadillacTrunk(body,lid);return{model,body,lid,system};
}
function vertices(root,space){
 root.updateWorldMatrix(true,true);space.updateWorldMatrix(true,false);
 const inverse=space.matrixWorld.clone().invert(),points=[];
 root.traverse(object=>{if(!object.isMesh)return;const matrix=new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld),position=object.geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)points.push(new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(matrix));
 });return points;
}

test('trunk hardware is a bounded offline three-subwoofer asset with exact illuminated branding',()=>{
 const {system}=fixture();
 try{
  const stats=system.diagnostics();
  assert.equal(stats.branding,'I LOVE DETROIT');assert.equal(system.lidPanel.userData.text,'I LOVE DETROIT');
  assert.equal(stats.speakerCount,3);assert.equal(stats.textures,0);
  assert(stats.meshes<=7&&stats.triangles<11000,'merged installation stays within its parked-display budget');
  assert.deepEqual(system.audioAnchor.position.toArray(),[0,.79,-2.15]);
  for(const root of [system.root,system.lidPanel])root.traverse(object=>{
   if(!object.isMesh)return;
   for(const key of ['position','normal'])assert(Array.from(object.geometry.getAttribute(key).array).every(Number.isFinite));
   assert(!object.material.map&&!object.material.emissiveMap,'the lettering and cones require no fetched texture');
  });
  assert(system.lidPanel.getObjectByName('Cadillac_I_LOVE_DETROIT_light').geometry.getAttribute('position').count>1000,'the phrase is actual raised vector geometry');
  assert.equal(system.root.visible,false);assert.equal(system.lidPanel.visible,false);
  system.setOpen(.1);assert(system.root.visible&&system.lidPanel.visible);
  system.setOpen(0);assert(!system.root.visible&&!system.lidPanel.visible);
 }finally{system.dispose();}
});

test('closed hardware and sign clear the actual Cadillac lid and separate further when opened',()=>{
 const {model,body,lid,system}=fixture();
 try{
  const bounds=system.diagnostics().enclosureBounds;
  for(let axis=0;axis<3;axis++){
   assert(bounds.min[axis]>=CADILLAC_TRUNK_INSTALL.enclosure.min[axis]);
   assert(bounds.max[axis]<=CADILLAC_TRUNK_INSTALL.enclosure.max[axis]);
  }
  model.updateMatrixWorld(true);
  const silver=model.getObjectByName('Coachwork_4');assert(silver?.isMesh);
  silver.material= new T.MeshBasicMaterial({side:T.DoubleSide});
  const ray=new T.Raycaster(),up=new T.Vector3(0,1,0);let minLidGap=Infinity;
  for(const point of vertices(system.lidPanel,body)){
   ray.set(point,up);ray.near=0;ray.far=.20;const hit=ray.intersectObject(silver,false)[0];
   assert(hit,`sign must remain beneath the actual closed lid at ${point.toArray()}`);
   minLidGap=Math.min(minLidGap,hit.distance);
  }
  assert(minLidGap>.020,`sign to actual lid clearance ${minLidGap}`);
  for(const amount of [0,.25,.5,.75,1]){
   lid.rotation.x=amount*1.25;
   const lowest=Math.min(...vertices(system.lidPanel,body).map(p=>p.y));
   assert(lowest>bounds.max[1]+.030,`lid sign clears hardware at ${amount}`);
  }
  silver.material.dispose();
 }finally{system.dispose();}
});

test('all three woofer apertures remain open and the red insets sit above the gold face',()=>{
 const {system}=fixture();
 try{
  system.setOpen(1);system.root.updateMatrixWorld(true);
  const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  const first=(x,z)=>{ray.set(new T.Vector3(x,1,z),down);ray.far=.6;return ray.intersectObject(system.root,true)[0]?.object.name;};
  for(const [x,,z] of CADILLAC_TRUNK_INSTALL.speakerCenters)
   assert.equal(first(x,z),'Cadillac_Trunk_Sound_System_black','red face must not cover a speaker cone');
  for(const [x,z] of [[0,-1.90],[0,-2.565],[-.405,-2.565],[.405,-2.565]])
   assert.equal(first(x,z),'Cadillac_Trunk_Sound_System_red','inset must be visible above the gold deck');
 }finally{system.dispose();}
});

test('opened lettering reads upright toward rear viewers and keeps its audio anchor in the vehicle',()=>{
 const {model,body,lid,system}=fixture(true);
 try{
  const rest=system.diagnostics();lid.rotation.x=1.25;model.updateMatrixWorld(true);
  const local=new T.Matrix4().multiplyMatrices(body.matrixWorld.clone().invert(),system.lidPanel.matrixWorld);
  const right=new T.Vector3(1,0,0).transformDirection(local),up=new T.Vector3(0,1,0).transformDirection(local),front=new T.Vector3(0,0,1).transformDirection(local);
  assert(right.x<-.99&&up.y>.90&&front.z<-.90,'rear-facing phrase has the correct right/up/front basis');
  const expected=new T.Vector3(0,.79,-2.15).applyMatrix4(body.matrixWorld);
  assert(system.audioAnchor.getWorldPosition(new T.Vector3()).distanceTo(expected)<1e-8);
  const neutral=fixture();try{
   for(const key of ['enclosureBounds','closedSignBounds'])for(const side of ['min','max'])for(let i=0;i<3;i++)
    assert(Math.abs(rest[key][side][i]-neutral.system.diagnostics()[key][side][i])<1e-8);
  }finally{neutral.system.dispose();}
 }finally{system.dispose();}
});

test('trunk disposal releases only its own geometry and materials once',()=>{
 const {model,system}=fixture();const source=model.getObjectByName('Coachwork_3').geometry;
 let sourceDisposals=0,geometryDisposals=0,materialDisposals=0;const materials=new Set();
 const onSource=()=>sourceDisposals++;source.addEventListener('dispose',onSource);
 for(const root of [system.root,system.lidPanel])root.traverse(object=>{if(!object.isMesh)return;
  object.geometry.addEventListener('dispose',()=>geometryDisposals++);materials.add(object.material);
 });
 for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);
 system.dispose();system.dispose();source.removeEventListener('dispose',onSource);
 assert.equal(sourceDisposals,0);assert.equal(geometryDisposals,7);assert.equal(materialDisposals,5);
 assert.equal(system.root.parent,null);assert.equal(system.lidPanel.parent,null);
});
