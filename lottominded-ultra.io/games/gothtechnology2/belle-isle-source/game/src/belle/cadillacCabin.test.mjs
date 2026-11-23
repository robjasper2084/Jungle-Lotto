import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const game=fileURLToPath(new URL('../../',import.meta.url));
const outfile=path.join(game,'.test/cadillac-cabin-runtime.mjs');
await build({absWorkingDir:game,entryPoints:['src/belle/cadillacCabin.ts'],outfile,bundle:true,platform:'node',format:'esm',external:['three'],logLevel:'error'});
const {CadillacCabin,CADILLAC_CABIN_FIT}=await import(pathToFileURL(outfile).href);
const decoratedFile=path.join(game,'.test/cadillac-cabin-decorated.mjs');
await build({absWorkingDir:game,stdin:{contents:`export {ThreeRiderView} from './runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';export {createPose} from './runtime/ride-core/src/controller.ts';export {HUMAN_PROFILE} from './runtime/ride-core/src/profiles.ts';`,resolveDir:game,loader:'ts'},outfile:decoratedFile,bundle:true,platform:'node',format:'esm',external:['three'],alias:{'@digital-static/ridecore':path.join(game,'runtime/ride-core/src/index.ts')},logLevel:'error',plugins:[{name:'fixture-images',setup(builder){builder.onResolve({filter:/\.webp(?:\?.*)?$/},args=>({path:args.path,namespace:'fixture-images'}));builder.onLoad({filter:/.*/,namespace:'fixture-images'},()=>({contents:'export default "";',loader:'js'}));}}]});
const {ThreeRiderView,createPose,HUMAN_PROFILE}=await import(pathToFileURL(decoratedFile).href);

// Read the shipped skins, skeletons, hierarchy and clips. Only material texture
// references are removed in this Node fixture; the runtime assets are untouched.
async function asset(relative){
 const bytes=await fs.readFile(path.join(game,'public',relative)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 data.materials=(data.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
}
const [car,hero,dog,wheel]=await Promise.all([
 asset('belle/vehicles/silver-cadillac.glb'),asset('exports/rigged-heroes/DS_Armored_Rider_01.glb'),asset('exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb'),
 asset('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'),
]);
function fixture(source=hero.scene,transformed=false){
 const model=car.scene.clone(true);
 if(transformed){model.position.set(184,4.2,-210);model.rotation.set(.08,1.9,-.06,'YXZ');}
 const cabin=new CadillacCabin(model,source,dog,hero.animations);
 return{model,cabin};
}
function near(actual,expected,label,epsilon=1e-6){
 assert.equal(actual.length,expected.length,label);
 actual.forEach((value,index)=>assert(Number.isFinite(value)&&Math.abs(value-expected[index])<epsilon,`${label}[${index}]: ${value} versus ${expected[index]}`));
}
function pose(root){
 const result=[];root.traverse(object=>{if(object.isBone)result.push([object.name,...object.position,...object.quaternion,...object.scale]);});return result;
}
function comparePose(a,b){
 assert.equal(a.length,b.length);
 for(let i=0;i<a.length;i++){
  assert.equal(a[i][0],b[i][0]);near(a[i].slice(1,4),b[i].slice(1,4),a[i][0]+' position');near(a[i].slice(8),b[i].slice(8),a[i][0]+' scale');
  // q and -q encode the same rotation; world-space IK can return either sign.
  const qa=new T.Quaternion().fromArray(a[i],4).normalize(),qb=new T.Quaternion().fromArray(b[i],4).normalize();
  assert(1-Math.abs(qa.dot(qb))<1e-10,a[i][0]+' rotation '+qa.angleTo(qb));
 }
}
function skinBounds(root,space){
 space.updateWorldMatrix(true,false);space.updateMatrixWorld(true);
 const inverse=space.matrixWorld.clone().invert(),box=new T.Box3(),point=new T.Vector3();
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);for(let i=0;i<mesh.geometry.attributes.position.count;i++)box.expandByPoint(mesh.getVertexPosition(i,point).applyMatrix4(matrix));});
 return box;
}
function assertContacts(cabin){
 for(const [side,grip]of [['Left',cabin.anchors.leftGrip],['Right',cabin.anchors.rightGrip]]){
  const hand=cabin.driver.getObjectByName(side+'Hand'),finger=cabin.driver.getObjectByName(side+'HandMiddle1');
  const palm=hand.localToWorld(finger.position.clone().multiplyScalar(.72));
  assert(palm.distanceTo(grip.getWorldPosition(new T.Vector3()))<.003,side+' palm stays on steering rim');
 }
}

test('cabin uses the actual solo hero and dog, with independent mutable skeletons',()=>{
 const source=clone(hero.scene);source.position.set(3,.2,-4);source.rotation.set(.2,.8,-.4);source.scale.setScalar(1.2);
 source.getObjectByName('Hips').position.y+=.3;source.getObjectByName('LeftArm').rotation.z+=1.1;
 const sourcePose=pose(source),dogPose=pose(dog.scene),sourceTransform=[...source.position,...source.quaternion,...source.scale];
 const {cabin}=fixture(source),{cabin:canonical}=fixture();
 try{
  comparePose(pose(cabin.driver),pose(canonical.driver));
  for(const [original,copy]of [[source,cabin.driver],[dog.scene,cabin.dog]])original.traverse(object=>{
   if(!object.isSkinnedMesh)return;
   const copied=copy.getObjectByName(object.name);assert(copied?.isSkinnedMesh,object.name);
   assert.equal(copied.castShadow,true);assert.equal(copied.receiveShadow,true);
   assert.equal(copied.geometry,object.geometry);assert.equal(copied.material,object.material);
   assert.notEqual(copied.skeleton,object.skeleton);
   copied.skeleton.bones.forEach((bone,i)=>assert.notEqual(bone,object.skeleton.bones[i]));
  });
  for(let i=0;i<20;i++)cabin.update(.1,Math.sin(i),false);
  comparePose(pose(source),sourcePose);comparePose(pose(dog.scene),dogPose);
  near([...source.position,...source.quaternion,...source.scale],sourceTransform,'source root');
  assert.equal(cabin.root.parent.name,'SprungBody');assert.equal(cabin.driver.parent,cabin.root);assert.equal(cabin.dog.parent,cabin.root);
 }finally{cabin.dispose();canonical.dispose();}
});

test('live solo-hero tailoring keeps its authored body rest pose and shared accessory skins',()=>{
 const globals=new Map(['window','document','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const load=T.TextureLoader.prototype.loadAsync;
 Object.assign(globalThis,{window:new EventTarget(),document:{documentElement:{dataset:{}}},matchMedia:()=>Object.assign(new EventTarget(),{matches:false})});
 T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
 let view,cabin,canonical;
 try{
  const terrain={sampleGround(x,z,out){Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});return out;},raycastObstacle(){return null;}};
  view=new ThreeRiderView(hero,wheel,terrain,{...HUMAN_PROFILE,id:'DS_Armored_Rider_01'});
  const ancestor=new T.Group();ancestor.position.set(100,3,-200);ancestor.rotation.set(.08,1.1,-.05);ancestor.add(view.root);
  view.apply({...createPose(),x:3,y:.1,z:2,headingY:.8,speed:9,rollAngle:.22,riderPitch:.1,bodyBob:.03});
  const before=pose(view.rider),source=view.rider.getObjectByName('Fitted hero cuffs, knuckles and tailoring');assert(source?.isSkinnedMesh);
  cabin=fixture(view.rider,true).cabin;canonical=fixture().cabin;
  comparePose(pose(cabin.driver),pose(canonical.driver));comparePose(pose(view.rider),before);
  const copy=cabin.driver.getObjectByName(source.name);assert.equal(copy.geometry,source.geometry);copy.material.forEach((material,i)=>assert.equal(material,source.material[i]));assert.notEqual(copy.skeleton,source.skeleton);
  const originalBody=skinBounds(canonical.driver,canonical.root),detailedBody=skinBounds(cabin.driver,cabin.root);
  assert(detailedBody.max.y<1.36,'runtime helmet and detailing clear headliner');
  assert(detailedBody.min.y>.369,'runtime fitted shoes clear floor');
  assert(detailedBody.getSize(new T.Vector3()).distanceTo(originalBody.getSize(new T.Vector3()))<.12,'accessories retain their fitted scale');
  cabin.update(.1,.6,false);assertContacts(cabin);comparePose(pose(view.rider),before);
 }finally{
  cabin?.dispose();canonical?.dispose();view?.dispose();T.TextureLoader.prototype.loadAsync=load;
  for(const [key,descriptor]of globals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});

test('real seated skins fit roof, floor and rear bench without per-frame vertex scans',()=>{
 const {cabin,model}=fixture();
 try{
  const driver=skinBounds(cabin.driver,cabin.root),passenger=skinBounds(cabin.dog,cabin.root);
  assert(driver.max.y<1.36,'helmet clears measured headliner');assert(driver.min.y>.369,'soles clear measured floor');
  assert(passenger.min.y>.566&&passenger.min.y<.577,'paws fit the sculpted cushion support height');
  assert(passenger.min.x>-.61&&passenger.max.x<0,'complete dog and tail fit across bench');
  assert(passenger.min.z>-.80&&passenger.max.z<-.40,'dog clears rear backrest and front seat');
  assert(passenger.max.y<1.24,'dog head clears rear headliner');
  near(cabin.diagnostics().dogPoseBounds.min,passenger.min.toArray(),'cold fit uses attached-skin matrices');
  const original=T.SkinnedMesh.prototype.getVertexPosition;
  T.SkinnedMesh.prototype.getVertexPosition=function(){throw Error('animation must not rescan skin vertices');};
  try{
   for(let i=0;i<80;i++){
    const steering=Math.sin(i*.18)*.6;
    model.rotation.y=i*.11;model.position.set(184+i,4.2,-210-i*.7);
    model.getObjectByName('SprungBody').rotation.set(Math.sin(i)*.035,0,Math.cos(i)*.035);
    model.getObjectByName('SteeringWheel').quaternion.setFromAxisAngle(new T.Vector3(0,.42,-.91).normalize(),steering*5.5);
    cabin.update(.1,steering,false);cabin.diagnostics();assertContacts(cabin);
   }
  }finally{T.SkinnedMesh.prototype.getVertexPosition=original;}
  const fitted=skinBounds(cabin.dog,cabin.root),envelope=CADILLAC_CABIN_FIT.rearEnvelope;
  for(let i=0;i<3;i++){assert(fitted.min.getComponent(i)>=envelope.min[i],`dog minimum axis ${i}`);assert(fitted.max.getComponent(i)<=envelope.max[i],`dog maximum axis ${i}`);}
 }finally{cabin.dispose();}
});

test('known boot and haunch contacts clear the actual sculpted upholstery surfaces',()=>{
 const {cabin,model}=fixture();
 try{
  model.updateMatrixWorld(true);
  const upholstery=model.getObjectByName('Coachwork_3');assert(upholstery?.isMesh);
  const gap=(mesh,index)=>{
   const point=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
   const ray=new T.Raycaster(point.clone().add(new T.Vector3(0,.05,0)),new T.Vector3(0,-1,0),0,.15);
   const hit=ray.intersectObject(upholstery,false)[0];assert(hit,'measured cabin support surface');
   return point.y-hit.point.y;
  };
  // These shipped vertices exposed penetrations hidden by overall boxes:
  // the right toe above the raised footwell and the haunch above its bolster.
  const boot=gap(cabin.driver.getObjectByName('char1'),28499);
  const haunch=gap(cabin.dog.getObjectByName('Boerboel_Body'),17311);
  assert(boot>.002&&boot<.012,`boot to floor clearance ${boot}`);
  assert(haunch>=0&&haunch<.025,`haunch to cushion clearance ${haunch}`);
 }finally{cabin.dispose();}
});

test('instantiation and driving pose are invariant to translated, rotated vehicle parents',()=>{
 const a=fixture(),b=fixture(hero.scene,true);
 try{
  comparePose(pose(a.cabin.driver),pose(b.cabin.driver));comparePose(pose(a.cabin.dog),pose(b.cabin.dog));
  for(const reduced of [false,true])for(const steering of [-1,-.55,0,.55,1]){
   for(const {model,cabin}of [a,b]){model.getObjectByName('SteeringWheel').quaternion.setFromAxisAngle(new T.Vector3(0,.42,-.91).normalize(),steering*5.5);cabin.update(.05,steering,reduced);assertContacts(cabin);}
   comparePose(pose(a.cabin.driver),pose(b.cabin.driver));comparePose(pose(a.cabin.dog),pose(b.cabin.dog));
   near(a.cabin.anchors.driverHead.position.toArray(),b.cabin.anchors.driverHead.position.toArray(),'driver target');
   near(a.cabin.anchors.dogHead.position.toArray(),b.cabin.anchors.dogHead.position.toArray(),'dog target');
  }
 }finally{a.cabin.dispose();b.cabin.dispose();}
});

test('reduced motion, repeated reset and disposal preserve functional contacts and source assets',()=>{
 const {cabin,model}=fixture();let geometryDisposals=0,materialDisposals=0;
 const geometry=hero.scene.getObjectByName('char1').geometry,material=hero.scene.getObjectByName('char1').material;
 const onGeometry=()=>geometryDisposals++,onMaterial=()=>materialDisposals++;
 geometry.addEventListener('dispose',onGeometry);material.addEventListener('dispose',onMaterial);
 try{
  cabin.update(0,0,true);const driver=pose(cabin.driver),passenger=pose(cabin.dog);
  for(let i=0;i<10;i++)cabin.update(.1,0,true);
  comparePose(pose(cabin.driver),driver);comparePose(pose(cabin.dog),passenger);
  assert.equal(cabin.diagnostics().dogState,'Sit_Idle');
  model.getObjectByName('SteeringWheel').quaternion.setFromAxisAngle(new T.Vector3(0,.42,-.91).normalize(),2);
  cabin.update(.1,.5,true);assertContacts(cabin);
  cabin.update(NaN,Infinity,false);cabin.reset();cabin.reset();
  comparePose(pose(cabin.driver),driver);comparePose(pose(cabin.dog),passenger);
  cabin.dispose();cabin.dispose();assert.equal(cabin.root.parent,null);assert.equal(model.getObjectByName('Cadillac_Wheel_Grip_Frame'),undefined);
  assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);
 }finally{cabin.dispose();geometry.removeEventListener('dispose',onGeometry);material.removeEventListener('dispose',onMaterial);}
});
