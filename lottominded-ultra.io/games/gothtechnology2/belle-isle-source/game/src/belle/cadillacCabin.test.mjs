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
async function asset(relative,directory=path.join(game,'public')){
 const bytes=await fs.readFile(path.join(directory,relative)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length).toString());
 data.materials=(data.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(data)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const binary=bytes.subarray(20+length),output=Buffer.alloc(20+padded.length+binary.length);
 output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(padded.length,12);output.writeUInt32LE(0x4e4f534a,16);padded.copy(output,20);binary.copy(output,20+padded.length);
 return new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.byteLength),'');
}
const [car,hero,dog,wheel,armored]=await Promise.all([
 asset('belle/vehicles/silver-cadillac.glb'),
 asset('exports/rigged-heroes/DS_Man_01.glb',path.resolve(game,'../../swoop-source/public')),
 asset('exports/glb/DS_Boerboel_01/DS_Boerboel_Elmwood.glb'),
 asset('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'),asset('exports/rigged-heroes/DS_Armored_Rider_01.glb'),
]);
function fixture(source=hero.scene,transformed=false,clips=hero.animations){
 const model=car.scene.clone(true);
 if(transformed){model.position.set(184,4.2,-210);model.rotation.set(.08,1.9,-.06,'YXZ');}
 const cabin=new CadillacCabin(model,source,dog,clips);
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

test('cabin uses the actual long-haired suited hero and dog, with independent mutable skeletons',()=>{
 const source=clone(hero.scene);source.position.set(3,.2,-4);source.rotation.set(.2,.8,-.4);source.scale.setScalar(1.2);
 source.getObjectByName('Hips').position.y+=.3;source.getObjectByName('LeftArm').rotation.z+=1.1;
 const sourcePose=pose(source),dogPose=pose(dog.scene),sourceTransform=[...source.position,...source.quaternion,...source.scale];
 const {cabin}=fixture(source),{cabin:canonical}=fixture();
 try{
  assert.equal(cabin.diagnostics().driverAsset,'DS_Man_01');assert.equal(cabin.driver.userData.sourceAsset,'DS_Man_01');
  assert(cabin.driver.getObjectByName('DS_Man_01_Dressed_Surface'),'original suited surface includes the long hair');
  assert.equal(cabin.driver.getObjectByName('DS_Hero_Fitted_Sunglasses').children.length,8,'all fitted aviator meshes are retained');
  assert.equal(cabin.driver.getObjectByName('Armored_Rider_Surface'),undefined,'Cadillac uses the requested suited model');
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

test('secondary decorated rigs keep their authored rest pose and independent accessory skins',()=>{
 const globals=new Map(['window','document','matchMedia'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const load=T.TextureLoader.prototype.loadAsync;
 Object.assign(globalThis,{window:new EventTarget(),document:{documentElement:{dataset:{}}},matchMedia:()=>Object.assign(new EventTarget(),{matches:false})});
 T.TextureLoader.prototype.loadAsync=async()=>new T.Texture();
 let view,cabin,canonical;
 try{
  const terrain={sampleGround(x,z,out){Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});return out;},raycastObstacle(){return null;}};
  view=new ThreeRiderView(armored,wheel,terrain,{...HUMAN_PROFILE,id:'DS_Armored_Rider_01'});
  const ancestor=new T.Group();ancestor.position.set(100,3,-200);ancestor.rotation.set(.08,1.1,-.05);ancestor.add(view.root);
  view.apply({...createPose(),x:3,y:.1,z:2,headingY:.8,speed:9,rollAngle:.22,riderPitch:.1,bodyBob:.03});
  const before=pose(view.rider),source=view.rider.getObjectByName('Fitted hero cuffs, knuckles and tailoring');assert(source?.isSkinnedMesh);
  cabin=fixture(view.rider,true,armored.animations).cabin;canonical=fixture(armored.scene,false,armored.animations).cabin;
  comparePose(pose(cabin.driver),pose(canonical.driver));comparePose(pose(view.rider),before);
  const copy=cabin.driver.getObjectByName(source.name);assert.equal(copy.geometry,source.geometry);copy.material.forEach((material,i)=>assert.equal(material,source.material[i]));assert.notEqual(copy.skeleton,source.skeleton);
  const originalBody=skinBounds(canonical.driver,canonical.root),detailedBody=skinBounds(cabin.driver,cabin.root);
  assert(detailedBody.getSize(new T.Vector3()).distanceTo(originalBody.getSize(new T.Vector3()))<.12,'accessories retain their fitted scale');
  // This secondary rig exercises clone isolation, not the suited driver's fit.
  cabin.update(.1,.6,false);canonical.update(.1,.6,false);
  comparePose(pose(cabin.driver),pose(canonical.driver));comparePose(pose(view.rider),before);
 }finally{
  cabin?.dispose();canonical?.dispose();view?.dispose();T.TextureLoader.prototype.loadAsync=load;
  for(const [key,descriptor]of globals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
 }
});

test('suited hair, aviators, shoes and rear passenger fit without per-frame vertex scans',()=>{
 const {cabin,model}=fixture();
 try{
  const driver=skinBounds(cabin.driver,cabin.root),passenger=skinBounds(cabin.dog,cabin.root);
  assert(driver.max.y<1.36,'hair and aviators clear measured headliner');assert(driver.min.y>.369,'suited soles clear measured floor');
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

test('suited shoe, trousers and passenger contacts clear the actual sculpted upholstery',()=>{
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
  // These actual suited-surface vertices are the closest shoe/floor and
  // trousers/cushion contacts; their indices belong to DS_Man_01, not armor.
  const suited=cabin.driver.getObjectByName('DS_Man_01_Dressed_Surface');
  const boot=gap(suited,81163),trousers=gap(suited,56474);
  const haunch=gap(cabin.dog.getObjectByName('Boerboel_Body'),17311);
  assert(boot>.002&&boot<.012,`boot to floor clearance ${boot}`);
  assert(trousers>.002&&trousers<.012,`trousers to cushion clearance ${trousers}`);
  assert(haunch>=0&&haunch<.025,`haunch to cushion clearance ${haunch}`);
 }finally{cabin.dispose();}
});

test('suited thighs clear the actual steering rim and the fitted column keeps its dashboard attachment',()=>{
 const {cabin,model}=fixture(),temporary=[];
 try{
  model.updateMatrixWorld(true);
  const original=car.scene.getObjectByName('Coachwork_3').geometry,fitted=model.getObjectByName('Coachwork_3').geometry;
  assert.notEqual(fitted,original,'the column adjustment owns its geometry');
  const before=original.attributes.position,after=fitted.attributes.position,normalBefore=original.attributes.normal,normalAfter=fitted.attributes.normal;
  let moved=0;
  for(let i=0;i<before.count;i++){
   const a=new T.Vector3().fromBufferAttribute(before,i),b=new T.Vector3().fromBufferAttribute(after,i);
   const hub=i>=9387&&i<=9450&&a.z<.7;
   if(hub){assert(Math.abs(b.y-a.y-.08)<1e-7,'column hub follows adjusted wheel');moved++;}
   else near(b.toArray(),a.toArray(),'fixed dashboard and remaining upholstery',1e-7);
   if(i<9387||i>9450)near(new T.Vector3().fromBufferAttribute(normalAfter,i).toArray(),new T.Vector3().fromBufferAttribute(normalBefore,i).toArray(),'unchanged upholstery normal',1e-7);
  }
  assert.equal(moved,32,'one complete 32-sided column ring moves');
  const suited=cabin.driver.getObjectByName('DS_Man_01_Dressed_Surface'),source=suited.geometry,index=source.index.array;
  const weights=source.attributes.skinWeight,bones=source.attributes.skinIndex;
  const thigh=i=>{for(let k=0;k<4;k++)if(weights.getComponent(i,k)>.5&&/UpLeg$/.test(suited.skeleton.bones[bones.getComponent(i,k)].name))return true;return false;};
  const wheelMeshes=[];model.getObjectByName('SteeringWheel').traverse(mesh=>{if(mesh.isMesh){const copy=new T.Mesh(mesh.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));copy.name=mesh.name;copy.matrixAutoUpdate=false;wheelMeshes.push({original:mesh,copy});temporary.push(copy);}});
  const ray=new T.Raycaster(),a=new T.Vector3(),b=new T.Vector3(),direction=new T.Vector3(),triangleBox=new T.Box3();
  for(const steering of [-1,0,1]){
   model.getObjectByName('SteeringWheel').quaternion.setFromAxisAngle(new T.Vector3(0,.42,-.91).normalize(),steering*5.5);
   cabin.update(0,steering,true);model.updateMatrixWorld(true);assertContacts(cabin);
   const wheelBox=new T.Box3();for(const {original,copy}of wheelMeshes){copy.matrix.copy(original.matrixWorld);copy.updateMatrixWorld(true);wheelBox.union(new T.Box3().setFromObject(copy));}
   const points=new Float32Array(source.attributes.position.count*3),indices=[],cached=new Set();
   for(let i=0;i<index.length;i+=3){
    const tri=[index[i],index[i+1],index[i+2]];if(!tri.some(thigh))continue;
    triangleBox.makeEmpty();for(const vertex of tri){if(!cached.has(vertex)){suited.getVertexPosition(vertex,a).applyMatrix4(suited.matrixWorld);a.toArray(points,vertex*3);cached.add(vertex);}triangleBox.expandByPoint(a.fromArray(points,vertex*3));}
    if(triangleBox.intersectsBox(wheelBox))indices.push(...tri);
   }
   assert(indices.length>0,'actual trousers triangles cover the former lower-rim overlap');
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const trousers=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));trousers.updateMatrixWorld(true);
   const meshes=wheelMeshes.map(({copy})=>copy),check=(from,targets)=>{
    const targetBox=new T.Box3();for(const target of targets)targetBox.union(new T.Box3().setFromObject(target));
    for(const mesh of from){const p=mesh.geometry.attributes.position,ix=mesh.geometry.index.array,seen=new Set();
     for(let i=0;i<ix.length;i+=3)for(const [v,w]of [[ix[i],ix[i+1]],[ix[i+1],ix[i+2]],[ix[i+2],ix[i]]]){
      const key=v<w?v+','+w:w+','+v;if(seen.has(key))continue;seen.add(key);
      a.fromBufferAttribute(p,v).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,w).applyMatrix4(mesh.matrixWorld);
      if(!triangleBox.makeEmpty().expandByPoint(a).expandByPoint(b).intersectsBox(targetBox))continue;
      const length=direction.copy(b).sub(a).length();if(length<2e-6)continue;
      ray.set(a,direction.divideScalar(length));ray.near=1e-6;ray.far=length-1e-6;
      assert.equal(ray.intersectObjects(targets,false).length,0,`trousers/rim surface crossing at steering ${steering}`);
     }
    }
   };
   check([trousers],meshes);check(meshes,[trousers]);geometry.dispose();trousers.material.dispose();
  }
 }finally{for(const mesh of temporary)mesh.material.dispose();cabin.dispose();}
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
 const originalUpholstery=car.scene.getObjectByName('Coachwork_3').geometry,privateUpholstery=model.getObjectByName('Coachwork_3').geometry;
 let columnDisposals=0;privateUpholstery.addEventListener('dispose',()=>columnDisposals++);
 const suited=hero.scene.getObjectByName('DS_Man_01_Dressed_Surface'),geometry=suited.geometry,material=suited.material;
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
  assert.equal(model.getObjectByName('Coachwork_3').geometry,originalUpholstery);assert.equal(columnDisposals,1);
  near(model.getObjectByName('SteeringWheel').position.toArray(),car.scene.getObjectByName('SteeringWheel').position.toArray(),'original steering-wheel position restored');
  assert.equal(geometryDisposals,0);assert.equal(materialDisposals,0);
 }finally{cabin.dispose();geometry.removeEventListener('dispose',onGeometry);material.removeEventListener('dispose',onMaterial);}
});
