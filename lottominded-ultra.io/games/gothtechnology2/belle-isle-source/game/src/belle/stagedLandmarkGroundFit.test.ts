import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {STUDY_SITES} from './stagedLandmarkStudies.ts';
import {readGroundSurface,readStagedGroundFit,readStagedExterior,readStagedRouteGround,readStagedRouteSweeps} from './stagedLandmarkGroundFit.ts';

const bytes=await readFile(new URL('../../public/belle/map.json',import.meta.url));
const map=JSON.parse(bytes.toString()) as ParkMap,terrain=new ParkTerrain(map);
const root=new T.Group();
for(const spec of STUDY_SITES){
 const lod=new T.LOD();lod.name=spec.id+'_STAGED_LODS';lod.position.set(...[spec.center[0],2,spec.center[1]] as [number,number,number]);lod.rotation.y=spec.yaw;
 for(const [level,file]of spec.files.entries()){
  const raw=await readFile(new URL('../../public/belle/staged-architecture/'+file,import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),spec.hashes[level],'Actual shipped model bytes: '+file);
  const {scene}=await new GLTFLoader().parseAsync(Uint8Array.from(raw).buffer,'');scene.visible=level===0;lod.addLevel(scene,[0,180,480][level]);
 }
 root.add(lod);
}
const legacyBytes=await readFile(new URL('../../public/belle/landmarks.glb',import.meta.url));
// Pin the original reference, so changes to retained paving cannot silently
// redefine the baseline used by this comparison.
assert.equal(createHash('sha1').update('blob '+legacyBytes.length+'\0').update(legacyBytes).digest('hex'),'8319c6e16be404ac8316754e4459d1f864532220');
const loader=new GLTFLoader();loader.register(()=>({name:'structural-image-skip',loadTexture:()=>Promise.resolve(new T.Texture())}));
const legacy=await loader.parseAsync(Uint8Array.from(legacyBytes).buffer,'');
const paving=legacy.scene.getObjectByName('107310050_Conservatory_concrete_paving');assert(paving instanceof T.Mesh);
root.add(paving);root.updateMatrixWorld(true);
const fit=()=>readStagedGroundFit(root,terrain,{aquarium:map.aquarium,conservatory:map.conservatory});

test('all shipped Aquarium stair and landing triangles match unchanged original terrain at every LOD',()=>{
 const before=JSON.stringify(map),read=fit();assert.equal(read.structuralReceiptPassed,true);assert.equal(read.stairs.samples.length,120);
 assert(read.stairs.samples.every(row=>row.surface&&row.difference!==null&&Math.abs(row.difference)<3e-8));
 assert.deepEqual([...new Set(read.stairs.samples.map(row=>row.support))].sort(),[2.15,2.3,2.45,2.6]);
 assert.equal(JSON.stringify(map),before,'Observation cannot change original map or stair configuration');
});
test('Conservatory preserves the actual original paving offset instead of falsely claiming surveyed or terrain-flush height',()=>{
 const read=fit();assert.equal(read.paving.samples.length,18);assert(read.paving.measuredSurfaceHeightsUnchanged);
 assert(Math.abs(read.paving.maximumOriginalVisualOffset!-.08)<1e-6);
 for(const row of read.paving.samples){
  assert.equal(row.support,2,'The original Conservatory terrain stays at 2 game metres');
  assert(Math.abs(row.originalVisualOffset!-(row.u<=-17?.07:.08))<1e-6,'Retained original paving is 7–8cm above terrain');
  assert.equal(row.levels.length,3);
 }
 const nearThreshold=read.paving.samples.find(row=>row.u===-19&&row.v===0)!;
 assert(Math.abs(nearThreshold.levels[0].threshold!.height-2.08)<1e-6);
 assert(Math.abs(nearThreshold.levels[0].stagedMinusRetained!-.01)<1e-6,'The existing 1cm threshold rise must remain explicit');
 assert.equal(nearThreshold.levels[1].threshold,null);assert.equal(nearThreshold.levels[2].threshold,null);
});
test('a raised or missing real stair triangle fails without changing terrain or acceptance tolerance',()=>{
 const lod=root.getObjectByName('107227742_STAGED_LODS') as T.LOD;
 const steps=lod.levels[1].object.getObjectByName('EntranceOutsideSteps__marble')!;assert(steps);
 const oldY=steps.position.y;try{steps.position.y+=.08;root.updateMatrixWorld(true);assert.equal(fit().stairs.agrees,false);}finally{steps.position.y=oldY;root.updateMatrixWorld(true);}
 const parent=steps.parent!;try{parent.remove(steps);assert.equal(fit().stairs.agrees,false);}finally{parent.add(steps);root.updateMatrixWorld(true);}
 assert.equal(fit().structuralReceiptPassed,true);
});
test('a new raised threshold fails against the independently retained paving',()=>{
 const lod=root.getObjectByName('107310050_STAGED_LODS') as T.LOD,threshold=lod.levels[0].object.getObjectByName('VestibuleFlushThreshold__sidewalk')!;
 const oldY=threshold.position.y;try{threshold.position.y+=.08;root.updateMatrixWorld(true);assert.equal(fit().paving.measuredSurfaceHeightsUnchanged,false);}finally{threshold.position.y=oldY;root.updateMatrixWorld(true);}
 assert.equal(fit().structuralReceiptPassed,true);
});
test('a changed local paving height cannot hide below the unrelated maximum original offset',()=>{
 const positions=paving.geometry.getAttribute('position'),saved=Float32Array.from(positions.array);let changed=0;
 const point=new T.Vector3(),inverse=paving.matrixWorld.clone().invert();
 try{
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(paving.matrixWorld);
   if(Math.abs(point.y-2.07)<1e-6){point.y=2.075;point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);changed++;}
  }
  assert(changed>0);const read=fit();assert(Math.abs(read.paving.maximumOriginalVisualOffset!-.08)<1e-6);
  assert.equal(read.paving.measuredSurfaceHeightsUnchanged,false,'A different local approach height must fail even below the interior maximum');
 }finally{positions.array.set(saved);}
 assert.equal(fit().structuralReceiptPassed,true);
});
test('actual old entrance-camera captures fail complete-exterior framing on both models',()=>{
 // Exact report from native run 45882624790, artifact 15149129223, head 61a9db36.
 const poses=[
  {id:'107227742',position:[1348.7537841068875,5.1,1120.9909914392567],direction:[.2902483645901151,-.33384714224459117,.896828842348351]},
  {id:'107310050',position:[1303.3992736362825,5.1,1183.5679306910174],direction:[.896828842348351,-.3338471422445911,-.29024836459011505]},
 ];
 for(const pose of poses){
  const camera=new T.PerspectiveCamera(60,1.6,.08,22000);camera.position.fromArray(pose.position);camera.lookAt(camera.position.clone().add(new T.Vector3().fromArray(pose.direction)));camera.updateMatrixWorld(true);
  const read=readStagedExterior(root,pose.id,camera);assert(read.ready);assert.equal(read.completeBoundsInFrame,false,'A cropped entrance must not count as a complete exterior');
 }
});
test('full-model framing uses every real vertex, real camera and active LOD without mutating scene state',()=>{
 for(const spec of STUDY_SITES)for(const aspect of[1.6,390/844]){
  const camera=new T.PerspectiveCamera(60,aspect,.08,22000),read=readStagedExterior(root,spec.id,camera),center=new T.Vector3().fromArray(read.bounds!.center);
  camera.position.copy(center).add(new T.Vector3(300,15,300));camera.lookAt(center);camera.updateMatrixWorld(true);
  const before=root.toJSON(),result=readStagedExterior(root,spec.id,camera);assert(result.completeBoundsInFrame);assert.equal(result.corners.length,8);assert(result.vertices>100);assert.deepEqual(result.selectedLevels,[0]);
  assert.deepEqual(root.toJSON(),before,'Framing must not update geometry bounds, matrices, LOD or material state');
  camera.lookAt(camera.position.clone().sub(center.clone().sub(camera.position)));camera.updateMatrixWorld(true);assert.equal(readStagedExterior(root,spec.id,camera).completeBoundsInFrame,false);
 }
});
test('surface observation honors actual upward triangles and draw ranges without populating geometry bounds',()=>{
 const mesh=new T.Mesh(new T.BoxGeometry(2,.2,2),new T.MeshStandardMaterial());mesh.position.y=2;mesh.updateMatrixWorld(true);
 const before=mesh.toJSON(),hit=readGroundSurface([mesh],0,0,3);assert(hit);assert(Math.abs(hit.height-2.1)<1e-7);assert.equal(hit.vertices.length,3);assert.equal(mesh.geometry.boundingBox,null);assert.equal(mesh.geometry.boundingSphere,null);assert.deepEqual(mesh.toJSON(),before);
 mesh.geometry.setDrawRange(0,0);assert.equal(readGroundSurface([mesh],0,0,3),null);
});
test('bounded route queries preserve the original terrain and reject incomplete or unbounded requests',()=>{
 const p={x:map.conservatory!.center[0]-100,z:map.conservatory!.center[1]-100},walkable=terrain.land(p.x,p.z,2)&&!terrain.obstructed(p.x,p.z,.7);
 const expected={...p,height:terrain.height(p.x,p.z,2),walkable,planningClearance:walkable?(terrain.obstructed(p.x,p.z,2.25)?.7:2.25):0};
 const {obstacleOccupancy,...actual}=readStagedRouteGround(terrain,[p])[0];assert.deepEqual(actual,expected);assert.equal(obstacleOccupancy.narrowHits.length,3);assert.throws(()=>readStagedRouteGround(terrain,[{x:NaN,z:0}]),/Invalid/);
 assert.throws(()=>readStagedRouteGround(terrain,Array(20001).fill(p)),/Invalid/);assert.throws(()=>readStagedRouteGround({height:()=>2,obstructed:()=>false},[p]),/Invalid/);
});
test('original loaded flight solids absent from static obstructed are caught by unchanged native standing-body sweeps',()=>{
 const local=new ParkTerrain(map),p={x:1327.2,z:1121.9};assert(!local.obstructed(p.x,p.z,.7));
 // Controlled unit fixture uses the existing collider registry and original
 // ray routine. Production collision data is never written by the observer.
 local.flightSolids.add({...p,bottom:2,top:8,radius:.15,kind:'lamp'});
 assert(!local.obstructed(p.x,p.z,.7),'The old 2D-only planner would call this clear');
 const point=readStagedRouteGround(local,[p])[0];assert.equal(point.walkable,false);assert.deepEqual(point.obstacleOccupancy.narrowHits,[0,0,0]);
 const from={x:p.x-1,z:p.z},to={x:p.x+1,z:p.z},before=local.raycastObstacle({x:from.x,y:2.62,z:from.z},{x:1,y:0,z:0},2.3,.27);
 const receipt=readStagedRouteSweeps(local,[{from,to,maxLateral:.41}])[0];assert.equal(receipt.clear,false);assert.equal(receipt.bodyRadius,.27);assert.deepEqual(receipt.bodyHeights,[.62,1.1,1.58]);
 assert(receipt.samples.some(s=>s.bodyHits.some(hit=>hit!==null&&hit<=s.acceptedBeyond)));
 assert.equal(local.raycastObstacle({x:from.x,y:2.62,z:from.z},{x:1,y:0,z:0},2.3,.27),before,'Observation preserves the real collider');
 // The unordered endpoint queries cannot stand in for the intervening path.
 assert(readStagedRouteGround(local,[from,to]).every(row=>row.walkable));
});
test('the swept lateral and stopping envelope catches obstacles missed by a clear centerline',()=>{
 const local=new ParkTerrain(map),from={x:1325,z:1120},to={x:1326,z:1120};assert(!local.obstructed(from.x,from.z,2.25));
 local.flightSolids.add({x:1325.5,z:1120.55,bottom:2,top:8,radius:.1,kind:'tree'});
 const centered=readStagedRouteSweeps(local,[{from,to,maxLateral:0}])[0];assert(centered.clear);
 const corridor=readStagedRouteSweeps(local,[{from,to,maxLateral:.41}])[0];assert.equal(corridor.clear,false);
 assert(corridor.samples.some(s=>s.bodyHits.every(hit=>hit===null)&&s.corridorHits.some(hit=>hit!==null)));
 const stopping=new ParkTerrain(map);stopping.flightSolids.add({x:1326.8,z:1120,bottom:2,top:8,radius:.1,kind:'lamp'});
 assert(readStagedRouteSweeps(stopping,[{from,to,maxLateral:0}])[0].clear);
 assert.equal(readStagedRouteSweeps(stopping,[{from,to,maxLateral:0,maxForward:.75}])[0].clear,false);
 assert.throws(()=>readStagedRouteSweeps(local,[{from,to,maxLateral:2}]),/Invalid/);
 assert.throws(()=>readStagedRouteSweeps(local,[{from,to:from,maxLateral:0}]),/Invalid/);
});
