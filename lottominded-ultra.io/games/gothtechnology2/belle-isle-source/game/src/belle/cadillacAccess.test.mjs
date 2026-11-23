import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const game=fileURLToPath(new URL('../../',import.meta.url)),outfile=path.join(game,'.test/cadillac-access-runtime.mjs');
await build({absWorkingDir:game,stdin:{contents:"export * from './src/belle/cadillacAccess.ts'; export {CadillacCabin} from './src/belle/cadillacCabin.ts';",resolveDir:game,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacAccess,CADILLAC_ACCESS_FIT,CadillacCabin}=await import(pathToFileURL(outfile).href);
async function asset(relative){
 const raw=readFileSync(path.join(game,relative)),length=raw.readUInt32LE(12),data=JSON.parse(raw.subarray(20,20+length));
 data.materials=(data.materials??[]).map(m=>({name:m.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=raw.subarray(20+length),buffer=Buffer.alloc(20+padded.length+binary.length);buffer.write('glTF');buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(padded.length,12);buffer.writeUInt32LE(0x4e4f534a,16);padded.copy(buffer,20);binary.copy(buffer,20+padded.length);
 return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
}
const raw=readFileSync(path.join(game,'public/belle/vehicles/silver-cadillac.glb')),source=await asset('public/belle/vehicles/silver-cadillac.glb');
const flat={height:()=>0,land:()=>true,obstructed:()=>false,bridge:()=>({active:false,t:0,side:0}),raycastObstacle:()=>null};
const names=['trunk','rearLeft','rearRight'];
const hash=array=>createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
function fixture(){const model=source.scene.clone(true),body=model.getObjectByName('SprungBody');return{model,body,access:new CadillacAccess(body)};}
function meshSummary(root){
 root.updateWorldMatrix(true,true);const triangles=[],point=new T.Vector3();let draws=0;
 root.traverseVisible(mesh=>{if(!mesh.isMesh)return;draws++;const geometry=mesh.geometry,ix=geometry.index,p=geometry.attributes.position;
  for(let i=0;i<ix.count;i+=3){const vertices=[];for(let j=0;j<3;j++)vertices.push(point.fromBufferAttribute(p,ix.getX(i+j)).applyMatrix4(mesh.matrixWorld).toArray().map(v=>Math.round(v*1e6)).join(','));triangles.push(mesh.material.name+':'+vertices.join(';'));}
 });return{draws,triangles:triangles.sort()};
}
test('original triangle selections preserve the exact closed car and shared source buffers',()=>{
 assert.equal(createHash('sha256').update(raw).digest('hex'),CADILLAC_ACCESS_FIT.sourceSha256);
 const baseline=meshSummary(source.scene),originals=new Map();source.scene.traverse(m=>{if(m.isMesh)originals.set(m.name,{geometry:m.geometry,positions:hash(m.geometry.attributes.position.array),indices:hash(m.geometry.index.array)});});
 const {model,access}=fixture();
 try{
  assert.deepEqual(meshSummary(model),baseline,'closed cars retain their original triangle positions and draw count');
  for(const name of names)assert(access.toggle(name,flat,0).accepted);
  assert.deepEqual(meshSummary(model).triangles,baseline.triangles,'at rest, extracted panels replace precisely their original triangles');
  for(const name of names){const part=model.getObjectByName(CADILLAC_ACCESS_FIT[name].name);assert.equal(part.children.length,4);}
  access.update(0,true);assert(access.held);
  const fitted=model.getObjectByName('Coachwork_3');assert.equal(fitted.geometry.attributes.position.count,originals.get('Coachwork_3').geometry.attributes.position.count);
  assert.equal(fitted.geometry.attributes.position,originals.get('Coachwork_3').geometry.attributes.position,'column vertex IDs 9387–9450 are not reindexed or moved');
  source.scene.traverse(m=>{if(!m.isMesh)return;const original=originals.get(m.name);assert.equal(hash(m.geometry.attributes.position.array),original.positions);assert.equal(hash(m.geometry.index.array),original.indices);});
  for(const name of names)assert(access.toggle(name,flat,0).accepted);access.update(0,true);
  model.traverse(m=>{if(originals.has(m.name))assert.equal(m.geometry,originals.get(m.name).geometry,'closed source geometry reference restored');});
  assert.deepEqual(meshSummary(model),baseline);
 }finally{access.dispose();}
});

test('swept door clearance rejects a nearby wall independently for each side',()=>{
 const {access}=fixture();try{
  const wall={...flat,obstructed:(x,_z,margin)=>x+margin>=1.55};
  assert.deepEqual(access.toggle('rearLeft',wall,0),{accepted:false,opening:true,reason:'blocked'});
  assert(!access.snapshot().rearLeft.open);assert(access.toggle('rearRight',wall,0).accepted);assert(access.toggle('trunk',wall,0).accepted);
  access.update(0,true);assert(access.snapshot().rearRight.angle>0);assert.equal(access.snapshot().rearLeft.angle,0);
  access.reset();const mirrored={...flat,obstructed:(x,_z,margin)=>x-margin<=-1.55};
  assert.equal(access.toggle('rearRight',mirrored,0).reason,'blocked');assert(access.toggle('rearLeft',mirrored,0).accepted);
 }finally{access.dispose();}
});

test('trunk sweep checks overhead obstacles and rear doors check raised terrain',()=>{
 const {access}=fixture();try{
  const ceiling=new T.Box3(new T.Vector3(-.8,1.65,-2.9),new T.Vector3(.8,1.80,-1.4));
  const obstacle={...flat,raycastObstacle:(origin,direction,max,half)=>{
   const ray=new T.Ray(new T.Vector3().copy(origin),new T.Vector3().copy(direction)),hit=ray.intersectBox(ceiling.clone().expandByScalar(half),new T.Vector3());
   if(!hit)return null;const distance=hit.distanceTo(origin);return distance<=max?distance:null;
  }};
  assert.equal(access.toggle('trunk',obstacle,0).reason,'blocked','lid is blocked by an overhead slab absent from ground footprints');
  assert(!access.snapshot().trunk.open);
  const curb={...flat,height:x=>x>1.25?.55:0};assert.equal(access.toggle('rearLeft',curb,0).reason,'blocked');assert(access.toggle('rearRight',curb,0).accepted);
 }finally{access.dispose();}
});

test('clearance follows heading and slope, and failed closing is atomic',()=>{
 const {model,body,access}=fixture();try{
  model.position.set(120,2,-30);model.rotation.y=Math.PI/2;body.rotation.set(.06,0,-.04);
  const transformed={...flat,height:()=>2,obstructed:(_x,z,margin)=>z-margin<=-31.55};
  assert.equal(access.toggle('rearLeft',transformed,2).reason,'blocked');assert(access.toggle('rearRight',transformed,2).accepted);
  assert(access.toggle('trunk',transformed,2).accepted);access.update(0,true);
  const state=access.snapshot();assert(!access.closeAll({...transformed,obstructed:()=>true},2));
  assert.equal(access.snapshot().rearRight.open,state.rearRight.open);assert.equal(access.snapshot().trunk.open,state.trunk.open);assert(access.held);
  assert(access.closeAll({...flat,height:()=>2},2));access.update(0,true);assert(!access.held);
 }finally{access.dispose();}
});

test('opening reversals reuse index buffers and never rescan source vertices in steady frames',()=>{
 const {access}=fixture();try{
  access.toggle('rearLeft',flat,0);access.update(.05,false);const halfway=access.snapshot().rearLeft.progress;assert(halfway>0&&halfway<1);
  access.toggle('rearLeft',flat,0);access.update(.02,false);assert(access.snapshot().rearLeft.progress<halfway);
  access.toggle('rearLeft',flat,0);access.update(0,true);const cached=access.diagnostics().cachedIndexGeometries;
  for(let i=0;i<60;i++)access.update(1/60,false);assert.equal(access.diagnostics().cachedIndexGeometries,cached);
  access.toggle('rearLeft',flat,0);access.update(0,true);access.toggle('rearLeft',flat,0);access.update(0,true);
  assert.equal(access.diagnostics().cachedIndexGeometries,cached,'repeat opening reuses the same private index variants');
  access.reset();assert.deepEqual(access.snapshot(),{trunk:{open:false,progress:0,angle:0},rearLeft:{open:false,progress:0,angle:0},rearRight:{open:false,progress:0,angle:0},held:false});
 }finally{access.dispose();}
});


test('access variants preserve the actual suited cabin fit and rear doors clear the Boerboel throughout opening',async()=>{
 const [hero,dog]=await Promise.all([asset('../../swoop-source/public/exports/rigged-heroes/DS_Man_01.glb'),asset('public/exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb')]);
 const model=source.scene.clone(true),body=model.getObjectByName('SprungBody'),rawColumn=model.getObjectByName('Coachwork_3').geometry;
 const cabin=new CadillacCabin(model,hero.scene,dog,hero.animations),fitted=model.getObjectByName('Coachwork_3').geometry;
 assert.notEqual(fitted,rawColumn,'fixture exercises the real private steering-column fit');
 const fittedPositions=hash(fitted.attributes.position.array),access=new CadillacAccess(body);
 try{
  const dogBounds=new T.Box3(),point=new T.Vector3();body.updateWorldMatrix(true,true);const inverse=body.matrixWorld.clone().invert();
  cabin.dog.traverse(mesh=>{if(!mesh.isMesh)return;const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<mesh.geometry.attributes.position.count;i++)dogBounds.expandByPoint(mesh.getVertexPosition(i,point).applyMatrix4(matrix));});
  for(const name of names)assert(access.toggle(name,flat,0).accepted);
  // Measure all referenced door vertices at 21 angles, including both endpoints.
  let minimumDogGap=Infinity;
  for(let step=0;step<=20;step++){
   for(const name of ['rearLeft','rearRight']){
    const fit=CADILLAC_ACCESS_FIT[name],door=model.getObjectByName(fit.name);door.rotation.y=fit.angle*step/20;door.updateWorldMatrix(true,true);
    const bounds=new T.Box3();door.traverse(mesh=>{if(!mesh.isMesh)return;const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),position=mesh.geometry.attributes.position;
     for(const i of new Set(mesh.geometry.index.array))bounds.expandByPoint(point.fromBufferAttribute(position,i).applyMatrix4(matrix));
    });
    const gap=name==='rearRight'?dogBounds.min.x-bounds.max.x:bounds.min.x-dogBounds.max.x;minimumDogGap=Math.min(minimumDogGap,gap);assert(gap>.030,`${name} clears the actual dog's skinned bounds at ${step}/20: ${gap}`);
   }
   access.update(1/60,false);assert.equal(hash(model.getObjectByName('Coachwork_3').geometry.attributes.position.array),fittedPositions,'door variants retain the real fitted column');
  }
  assert(minimumDogGap>.030);access.reset();assert.equal(model.getObjectByName('Coachwork_3').geometry,fitted);
 }finally{
  access.dispose();assert.equal(model.getObjectByName('Coachwork_3').geometry,fitted);cabin.dispose();assert.equal(model.getObjectByName('Coachwork_3').geometry,rawColumn);
 }
});
