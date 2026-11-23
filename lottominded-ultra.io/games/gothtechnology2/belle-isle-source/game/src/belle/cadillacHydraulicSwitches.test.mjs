import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const game=fileURLToPath(new URL('../../',import.meta.url)),outfile=path.join(game,'.test/cadillac-hydraulic-switches.mjs');
await build({absWorkingDir:game,stdin:{contents:`export {CadillacHydraulicSwitches,CADILLAC_HYDRAULIC_SWITCH_FIT} from './src/belle/cadillacHydraulicSwitches.ts';export {CadillacRide} from './src/belle/cadillacRide.ts';export {fitCadillacWireWheels} from './src/belle/cadillacWireWheels.ts';export {HYDRAULIC_SMART_POSES} from './src/belle/hydraulicController.ts';export {consumeAnimatedShadowUpdate} from './runtime/ride-core/src/shadowBudget.ts';`,resolveDir:game,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacHydraulicSwitches,CadillacRide,fitCadillacWireWheels,HYDRAULIC_SMART_POSES,consumeAnimatedShadowUpdate}=await import(pathToFileURL(outfile).href);
// Actual shipped hierarchy, source meshes, skeletons and clips. Remove only
// image references for Node; retain material visibility and sidedness.
async function asset(file){
 const bytes=await fs.readFile(file),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 data.materials=(data.materials??[]).map(({name,doubleSided,alphaMode,alphaCutoff,pbrMetallicRoughness:pbr})=>({name,doubleSided,alphaMode,alphaCutoff,pbrMetallicRoughness:pbr?{baseColorFactor:pbr.baseColorFactor,metallicFactor:pbr.metallicFactor,roughnessFactor:pbr.roughnessFactor}:undefined}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
}
const [silver,hydraulic,hero,dog,hoodie]=await Promise.all([
 asset(path.join(game,'public/belle/vehicles/silver-cadillac.glb')),
 asset(path.join(game,'public/belle/vehicles/hydraulics-cadillac.glb')),
 asset(path.resolve(game,'../../swoop-source/public/exports/rigged-heroes/DS_Man_01.glb')),
 asset(path.join(game,'public/exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb')),
 asset(path.resolve(game,'../../swoop-source/public/exports/rigged-heroes/DS_Hoodie_Woman_01.glb')),
]);
fitCadillacWireWheels(hydraulic.scene);
const allowed={riding:true,parked:true,hydraulicMode:true,inside:true,blocked:false};
const terrain={map:{spawn:{x:0,z:0,heading:0},roads:[{points:[[0,-20],[0,20]]}]},height:()=>0,land:()=>true,obstructed:()=>false,bridge:()=>({active:false,t:0,side:0}),raycastObstacle:()=>null};
function fixture(variant='cadillac'){
 const model=(variant==='cadillac'?silver:hydraulic).scene.clone(true),scene=new T.Scene();scene.add(model);
 const ride=new CadillacRide(model,terrain,variant==='cadillac'?{hero:hero.scene,dog,heroClips:hero.animations}:undefined,variant,variant==='hydraulic-cadillac'?hoodie:undefined);ride.start();
 const body=model.getObjectByName(variant==='cadillac'?'SprungBody':'ChassisGeometry'),bank=ride.hydraulicSwitches;
 const camera=new T.PerspectiveCamera(60,1440/900,.04,2000);ride.camera(camera,true,0,.1,1/60,true);camera.updateMatrixWorld(true);
 return{ride,model,body,bank,camera,scene};
}
function screen(bank,camera,pose){return new T.Vector3().fromArray(bank.diagnostics().switches.find(item=>item.pose===pose).world).project(camera);}
const poses=Object.keys(HYDRAULIC_SMART_POSES);

for(const variant of ['cadillac','hydraulic-cadillac']){
 test(variant+': all three physical switches are visible and reachable with actual occupants and the shipped inside camera',()=>{
  const f=fixture(variant);
  try{
   for(const transformed of [false,true]){
    if(transformed){f.model.position.set(184,3,-201);f.model.rotation.set(.04,1.2,-.02);f.body.position.y=.12;f.body.rotation.set(.08,0,-.06);}
    for(const [width,height]of [[1440,900],[1280,800],[1194,834],[834,1194],[320,568],[390,340]]){
     f.camera.aspect=width/height;f.camera.updateProjectionMatrix();f.ride.camera(f.camera,true,0,.1,1/60,true);f.camera.updateMatrixWorld(true);
     for(const pose of poses){
      const projected=screen(f.bank,f.camera,pose);
      assert(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9&&projected.z> -1&&projected.z<1,`${variant}/${width}x${height}/${pose}: outside intended cabin view: ${projected.toArray()}`);
      assert.equal(f.bank.pick(f.camera,projected,allowed),pose,`${variant}/${width}x${height}/${pose}: blocked by actual cabin or occupant`);
      assert(new T.Vector3().fromArray(f.bank.diagnostics().switches.find(item=>item.pose===pose).world).distanceTo(f.camera.position)<1.1,'bank remains within reach');
     }
    }
   }
  }finally{f.ride.dispose();}
 });

 test(variant+': picking rejects every unavailable mode, invalid pointer, outside perspective and hidden hierarchy',()=>{
  const f=fixture(variant),point=screen(f.bank,f.camera,'front-up');
  try{
   for(const patch of [{riding:false},{parked:false},{hydraulicMode:false},{inside:false},{blocked:true}])assert.equal(f.bank.pick(f.camera,point,{...allowed,...patch}),null);
   for(const pointer of [{x:NaN,y:0},{x:0,y:Infinity},{x:2,y:0},{x:0,y:-2}])assert.equal(f.bank.pick(f.camera,pointer,allowed),null);
   assert.equal(f.bank.pick(new T.OrthographicCamera(-1,1,1,-1),point,allowed),null);
   f.ride.camera(f.camera,false,0,.1,1/60,true);f.camera.updateMatrixWorld(true);
   assert.equal(f.bank.pick(f.camera,screen(f.bank,f.camera,'front-up'),allowed),null,'even falsely labelled exterior cameras cannot reach inside');
   f.ride.camera(f.camera,true,0,.1,1/60,true);f.camera.updateMatrixWorld(true);
   f.model.visible=false;assert.equal(f.bank.pick(f.camera,point,allowed),null);f.model.visible=true;
   f.bank.root.visible=false;assert.equal(f.bank.pick(f.camera,point,allowed),null);f.bank.root.visible=true;
   f.camera.projectionMatrix.elements[0]=NaN;assert.equal(f.bank.pick(f.camera,point,allowed),null);
  }finally{f.ride.dispose();}
 });

 test(variant+': visible source geometry occludes switches while hidden objects never take the tap',()=>{
  const f=fixture(variant),point=screen(f.bank,f.camera,'front-up');
  const target=new T.Vector3().fromArray(f.bank.diagnostics().switches[0].world),blocker=new T.Mesh(new T.SphereGeometry(.07,8,6),new T.MeshBasicMaterial());
  f.body.add(blocker);blocker.position.copy(f.body.worldToLocal(target.clone().lerp(f.camera.position,.5)));
  try{
   assert.equal(f.bank.pick(f.camera,point,allowed),null);
   blocker.visible=false;assert.equal(f.bank.pick(f.camera,point,allowed),'front-up');
   blocker.visible=true;blocker.material.visible=false;assert.equal(f.bank.pick(f.camera,point,allowed),'front-up');
   blocker.material.visible=true;blocker.material.opacity=0;assert.equal(f.bank.pick(f.camera,point,allowed),'front-up');
  }finally{blocker.geometry.dispose();blocker.material.dispose();blocker.removeFromParent();f.ride.dispose();}
 });
}

test('actual-distance ceiling also applies inside a scaled cabin and does not depend only on state labels',()=>{
 const f=fixture();
 try{
  f.model.scale.setScalar(3);f.ride.camera(f.camera,true,0,.1,1/60,true);f.camera.updateMatrixWorld(true);
  assert.equal(f.bank.pick(f.camera,screen(f.bank,f.camera,'front-up'),allowed),null);
 }finally{f.ride.dispose();}
});

test('target indicators and manual flicks are bounded, reduced-motion safe, and shadow-idle after settling',()=>{
 const scene=new T.Scene(),body=new T.Group();scene.add(body);const bank=new CadillacHydraulicSwitches(body,'cadillac');
 try{
  assert.equal(bank.diagnostics().activePose,'pancake');consumeAnimatedShadowUpdate(scene);
  bank.syncTargets(HYDRAULIC_SMART_POSES['front-up']);assert.equal(bank.diagnostics().activePose,'front-up');
  for(let i=0;i<40;i++)bank.update(1/60);assert(consumeAnimatedShadowUpdate(scene));
  assert(bank.diagnostics().switches.every(item=>!item.moving));
  for(let i=0;i<100;i++)bank.update(1/60);assert.equal(consumeAnimatedShadowUpdate(scene),false,'settled transforms do not invalidate the shadow map');
  const resting=bank.diagnostics().switches.map(item=>item.angle);
  assert(bank.trigger('front-up'));bank.update(1/60);assert(consumeAnimatedShadowUpdate(scene));
  assert.notDeepEqual(bank.diagnostics().switches.map(item=>item.angle),resting);
  for(let i=0;i<90;i++)bank.update(1/60);assert.deepEqual(bank.diagnostics().switches.map(item=>item.angle),resting);
  consumeAnimatedShadowUpdate(scene);bank.trigger('back-up',true);bank.update(1/60,true);
  assert(bank.diagnostics().switches.every(item=>!item.moving));assert.equal(consumeAnimatedShadowUpdate(scene),false);
  bank.syncTargets({FL:.1,FR:.11,RL:.07,RR:.03});bank.update(0,true);assert.equal(bank.diagnostics().activePose,null);
  bank.syncTargets({FL:NaN,FR:0,RL:0,RR:0});assert.equal(bank.diagnostics().activePose,null);
  bank.reset();assert.equal(bank.diagnostics().activePose,'pancake');assert(bank.diagnostics().switches.every(item=>!item.moving));
 }finally{bank.dispose();}
});

test('bank reuses a fixed geometry budget, releases owned resources once, and never disposes authored cabin meshes',()=>{
 const f=fixture(),resources=new Set(),sourceResources=new Set();
 f.bank.root.traverse(mesh=>{if(mesh.isMesh){resources.add(mesh.geometry);[].concat(mesh.material).forEach(material=>resources.add(material));}});
 f.body.traverse(mesh=>{if(mesh.isMesh&&!f.bank.root.getObjectById(mesh.id)){sourceResources.add(mesh.geometry);[].concat(mesh.material).forEach(material=>sourceResources.add(material));}});
 let ownedDisposals=0,sourceDisposals=0;for(const r of resources)r.addEventListener('dispose',()=>ownedDisposals++);for(const r of sourceResources)r.addEventListener('dispose',()=>sourceDisposals++);
 const before=f.bank.diagnostics();assert.equal(before.texturesAdded,0);assert(before.triangles<=1800);assert(before.geometries<=6);assert(before.materials<=5);
 for(let i=0;i<1000;i++){f.bank.syncTargets(HYDRAULIC_SMART_POSES[poses[i%3]]);f.bank.trigger(poses[i%3]);f.bank.update(.1);}
 assert.equal(f.bank.diagnostics().geometries,before.geometries);assert.equal(f.bank.diagnostics().materials,before.materials);
 f.bank.dispose();f.bank.dispose();assert.equal(ownedDisposals,resources.size);assert.equal(sourceDisposals,0);assert.equal(f.body.getObjectByName('Cadillac_Hydraulic_SwitchBank'),undefined);
 assert.equal(f.bank.pick(f.camera,{x:0,y:0},allowed),null);assert.equal(f.bank.trigger('front-up'),false);f.ride.dispose();
});
