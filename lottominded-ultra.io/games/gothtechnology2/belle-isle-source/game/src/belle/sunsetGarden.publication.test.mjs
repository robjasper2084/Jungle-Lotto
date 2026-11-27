import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import * as T from 'three';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {CinematicTerrain} from './cinematicTerrain.ts';

// The optional module path runs this same regression against the retained old
// source. CI normally exercises the sibling application builder.
const {addSunsetGarden}=await import(process.env.BELLE_GARDEN_BUILDER??'./sunsetGarden.ts');
const hash=value=>createHash('sha256').update(value).digest('hex');
const jsonHash=value=>hash(JSON.stringify(value));
const attributes=geometry=>Object.fromEntries(Object.entries(geometry.attributes).sort().map(([name,a])=>[name,
 {itemSize:a.itemSize,count:a.count,normalized:a.normalized,type:a.array.constructor.name,
  sha256:hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))}]));
const arrayHash=a=>a?hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)):null;
function geometryReceipt(root){
 root.updateMatrixWorld(true);const rows=[];
 function walk(object,path){
  const row={path,name:object.name,type:object.type,visible:object.visible,castShadow:object.castShadow,
   receiveShadow:object.receiveShadow,renderOrder:object.renderOrder,frustumCulled:object.frustumCulled,
   matrix:object.matrix.toArray(),matrixWorld:object.matrixWorld.toArray()};
  if(object.isMesh){const g=object.geometry;row.geometry={type:g.type,attributes:attributes(g),index:arrayHash(g.index),
   groups:g.groups,drawRange:{start:g.drawRange.start,count:String(g.drawRange.count)}};
   row.instanceMatrix=arrayHash(object.instanceMatrix);row.instanceColor=arrayHash(object.instanceColor);row.count=object.count??null;}
  rows.push(row);object.children.forEach((child,i)=>walk(child,path+'/'+i));
 }
 walk(root,'root');return {objects:rows.length,sha256:jsonHash(rows)};
}
function materialReceipt(root,owner){
 const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 return [...materials].map(material=>{
  const fields=material.toJSON();delete fields.uuid;
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,
   fragmentShader:T.ShaderLib.standard.fragmentShader,numPointLights:4,numPointLightShadows:0};
  material.onBeforeCompile(shader,{});
  return {name:material.name,type:material.type,fields:jsonHash(fields),programKey:material.customProgramCacheKey(),
   vertexShader:hash(shader.vertexShader),fragmentShader:hash(shader.fragmentShader),
   atmosphereBindings:shader.uniforms.belleCloudNoise===owner.uniforms.belleCloudNoise&&
    shader.uniforms.belleCloudTime===owner.uniforms.belleCloudTime&&
    shader.uniforms.belleSunDirection===owner.uniforms.belleSunDirection};
 });
}
async function build(schedule,trees=0){
 const scene=new T.Scene(),noise=new T.Texture(),terrainObserver=new CinematicTerrain(scene),atmosphere=new WorldAtmosphere(scene,noise);
 // The production observer exists before the garden starts. Drain its initial
 // scene pass so this specifically exercises the garden's publication event.
 await Promise.resolve();const solids=[],events=[];
 scene.addEventListener('childadded',({child})=>events.push({name:child.name,geometry:geometryReceipt(child)}));
 const map={island:trees?[[275,1640],[335,1640],[335,1690],[275,1690],[275,1640]]:[],roads:[
  {id:'outside',points:[[0,0],[30,0]],width:5,foot:false},
  {id:'garden',points:trees?[[270,1650],[370,1650]]:[[3740,-180],[3840,-180]],width:5,foot:false}]};
 const terrain={land:()=>true,obstructed:()=>false,height:()=>2,flightSolids:{add:s=>solids.push({...s})}};
 const options={name:trees?'Reference tree construction test':'Blue Heron Lagoon',
  x:trees?320:3740,z:trees?1620:-180,radius:trees?130:260,trees,seed:209590,shore:!!trees};
 const original=Object.getOwnPropertyDescriptor(globalThis,'performance');let calls=0;
 Object.defineProperty(globalThis,'performance',{configurable:true,value:{now(){calls++;
  if(schedule==='early-yield')return calls===1?0:20;
  if(schedule==='every-road-yield')return calls*20;
  return 0;
 }}});
 let garden;
 try{
  // Keep the real builder, real road-index checks, real setTimeout task yields,
  // and original observer. Only the clock controlling a construction yield is
  // controlled by this test; no shader/material repair is called here.
  garden=await addSunsetGarden(scene,map,terrain,options);
  const materials=materialReceipt(garden.root,atmosphere),geometry=geometryReceipt(garden.root);
  const result={schedule,trees,clockCalls:calls,stats:garden.stats,events,geometry,materials,
   solids:{count:solids.length,sha256:jsonHash(solids)}};
  assert.equal(garden.root.parent,scene);assert.equal(scene.children.length,1);
  return result;
 }finally{
  if(original)Object.defineProperty(globalThis,'performance',original);else delete globalThis.performance;
  atmosphere.dispose();terrainObserver.dispose();noise.dispose();
  const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);
   for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
}

const cases=[];
for(const trees of [0,2])for(const schedule of ['no-road-yield','early-yield','every-road-yield'])cases.push(await build(schedule,trees));
if(process.env.BELLE_GARDEN_RECEIPT)writeFileSync(process.env.BELLE_GARDEN_RECEIPT,JSON.stringify({three:T.REVISION,cases},null,2)+'\n');

test('completed garden publication binds every material before the awaiting caller resumes',()=>{
 for(const result of cases){
  assert(result.materials.length>=6);assert.equal(result.stats.trees,result.trees);assert(result.stats.lamps>0);assert(result.solids.count>0);
  for(const material of result.materials){assert(material.atmosphereBindings,`${result.trees}/${result.schedule}: ${material.name}`);
   assert.match(material.programKey,/\|belle-pbr-v1\|belle-height-fog-clouds-v2$/);}
 }
});
test('scene observers see the complete subtree once, including geometry built after task yields',()=>{
 for(const result of cases){assert.equal(result.events.length,1);
  assert.deepEqual(result.events[0].geometry,result.geometry,`${result.trees}/${result.schedule}`);}
});
test('construction timing leaves all final material programs, geometry and collision registrations identical',()=>{
 for(const trees of [0,2]){
  const [baseline,...rest]=cases.filter(c=>c.trees===trees);
  for(const result of rest){assert.deepEqual(result.stats,baseline.stats);assert.deepEqual(result.geometry,baseline.geometry);
   assert.deepEqual(result.solids,baseline.solids);assert.deepEqual(result.materials,baseline.materials);}
 }
});
