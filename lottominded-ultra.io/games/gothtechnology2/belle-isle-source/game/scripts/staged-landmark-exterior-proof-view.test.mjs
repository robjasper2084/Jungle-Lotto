import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readStagedViewBounds} from '../src/belle/stagedLandmarkViewBounds.ts';
import {scoreExteriorViewpoint} from './staged-landmark-exterior-view-advice.mjs';
import {createExteriorPlanner} from './staged-landmark-exterior-proof.mjs';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {STUDY_SITES} from '../src/belle/stagedLandmarkStudies.ts';
import {readStagedExterior} from '../src/belle/stagedLandmarkGroundFit.ts';
import {riverFarRing,flatRiverPatchIndex,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS} from '../src/belle/riverPatch.ts';
import {addConservatoryGarden} from '../src/belle/conservatoryGarden.ts';

const target={min:[-5,2,-5],max:[5,20,5],center:[0,11,0]};
function sceneFixture(){
 const scene=new T.Scene(),root=new T.Group(),lod=new T.LOD();lod.name='107310050_STAGED_LODS';scene.add(root);root.add(lod);
 lod.addLevel(new T.Mesh(new T.BoxGeometry(10,18,10),new T.MeshStandardMaterial()),0);
 const camera=new T.PerspectiveCamera(60,1.6,.08,22000);camera.position.set(0,3.55,40);camera.lookAt(0,11,0);
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);return{scene,root,lod,camera};
}
test('view advice copies active instances and visible LODs without changing scene state or bounding caches',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=new T.BoxGeometry(2,12,2),material=new T.MeshStandardMaterial({alphaTest:.5});
 const trees=new T.InstancedMesh(geometry,material,2);trees.name='original tree crowns';trees.setMatrixAt(0,new T.Matrix4().makeTranslation(0,8,20));trees.setMatrixAt(1,new T.Matrix4().makeTranslation(2000,8,20));scene.add(trees);
 const lod=new T.LOD(),near=new T.Mesh(new T.BoxGeometry(2,3,2),new T.MeshStandardMaterial()),far=near.clone();near.name='selected scenery';far.name='unselected scenery';lod.addLevel(near,0);lod.addLevel(far,100);far.visible=false;lod.position.set(4,5,12);scene.add(lod);
 const hidden=new T.Group();hidden.visible=false;const hiddenMesh=near.clone();hiddenMesh.name='hidden subtree';hidden.add(hiddenMesh);scene.add(hidden);scene.updateMatrixWorld(true);
 const before=JSON.stringify(scene.toJSON()),matrices=Array.from(trees.instanceMatrix.array),boundsBefore=[geometry.boundingBox,geometry.boundingSphere];
 const observed=readStagedViewBounds(root,'107310050',camera,target);
 assert(observed.boxes.some(box=>box.mesh===trees.name&&box.instanceId===0&&box.conservativeAlpha));
 assert(!observed.boxes.some(box=>box.mesh===trees.name&&box.instanceId===1));
 assert(observed.boxes.some(box=>box.mesh===near.name));assert(!observed.boxes.some(box=>box.mesh===far.name||box.mesh===hiddenMesh.name));
 assert(!observed.boxes.some(box=>box.uuid===root.getObjectByName('107310050_STAGED_LODS').levels[0].object.uuid));
 observed.boxes[0].min[0]=999;observed.target.min[0]=999;
 assert.deepEqual(target.min,[-5,2,-5]);assert.equal(JSON.stringify(scene.toJSON()),before);assert.deepEqual(Array.from(trees.instanceMatrix.array),matrices);
 assert.deepEqual([geometry.boundingBox,geometry.boundingSphere],boundsBefore);
});
test('view advice respects draw ranges, material visibility and camera layers',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-1,0,10,1,0,10,0,10,10,30,0,10,32,0,10,31,10,10],3));
 geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);const materials=[new T.MeshStandardMaterial(),new T.MeshStandardMaterial()];materials[1].visible=false;
 const mesh=new T.Mesh(geometry,materials);mesh.name='group fixture';scene.add(mesh);scene.updateMatrixWorld(true);
 const read=()=>readStagedViewBounds(root,'107310050',camera,target).boxes.filter(b=>b.mesh===mesh.name);
 assert.deepEqual(read().map(b=>b.min),[[-1,0,10]]);geometry.setDrawRange(3,3);assert.deepEqual(read(),[]);
 materials[1].visible=true;assert.deepEqual(read().map(b=>b.min),[[30,0,10]]);mesh.layers.set(1);assert.deepEqual(read(),[]);
});
test('active batched instance ranges are copied without populating lazy batch bounds',()=>{
 const {scene,root,camera}=sceneFixture(),batch=new T.BatchedMesh(3,128,256,new T.MeshStandardMaterial());batch.name='unchanged architectural batch';
 const id=batch.addGeometry(new T.BoxGeometry(4,8,4)),a=batch.addInstance(id),b=batch.addInstance(id);
 batch.setMatrixAt(a,new T.Matrix4().makeTranslation(-8,6,12));batch.setMatrixAt(b,new T.Matrix4().makeTranslation(8,6,12));batch.setVisibleAt(b,false);scene.add(batch);scene.updateMatrixWorld(true);
 const before=batch._geometryInfo.map(row=>({boundingBox:row.boundingBox?.clone()??null,boundingSphere:row.boundingSphere?.clone()??null})),matrix=Array.from(batch.matrixWorld.elements);
 const read=readStagedViewBounds(root,'107310050',camera,target).boxes.filter(box=>box.mesh===batch.name);
 assert.equal(read.length,1);assert.equal(read[0].instanceId,a);assert.deepEqual(read[0].min,[-10,2,10]);
 assert.deepEqual(batch._geometryInfo.map(row=>({boundingBox:row.boundingBox?.clone()??null,boundingSphere:row.boundingSphere?.clone()??null})),before);assert.deepEqual(batch.matrixWorld.elements,matrix);
});
function obstruction(min=[-2,0,20],max=[2,28,22]){return{mesh:'retained foreground tree',uuid:'tree',instanceId:0,material:0,min,max,conservativeAlpha:true,deformationUnresolved:false};}
test('view ranking detects retained foreground crowns and ignores geometry beyond the architecture',()=>{
 const observation={target,boxes:[obstruction()],unsupported:[],scope:'test advice'},before=JSON.stringify(observation);
 const blocked=scoreExteriorViewpoint(observation,[0,3.55,40]),side=scoreExteriorViewpoint(observation,[20,3.55,40]);
 assert(blocked.blockedSamples>side.blockedSamples);assert(blocked.obstructionBounds[0].conservativeAlpha);assert.equal(blocked.visualAcceptance,null);
 const behind=scoreExteriorViewpoint({...observation,boxes:[obstruction([-10,0,-30],[10,30,-20])]},[0,3.55,40]);assert.equal(behind.blockedSamples,0);
 assert.equal(JSON.stringify(observation),before);
 assert.throws(()=>scoreExteriorViewpoint({...observation,boxes:[{min:[NaN,0,0],max:[1,1,1]}]},[0,3,30]),/Invalid blocker/);
});
test('same-site retained foliage remains an obstruction outside the actual staged target subtree',()=>{
 const {scene,root,lod,camera}=sceneFixture(),garden=new T.Group();garden.name='107310050_retained_garden';
 const leaves=new T.Mesh(new T.BoxGeometry(12,32,3),new T.MeshStandardMaterial({alphaTest:.5}));leaves.name='107310050_leaf0';leaves.position.set(0,14,20);garden.add(leaves);scene.add(garden);
 const ownDetail=new T.Mesh(new T.BoxGeometry(10,30,2),new T.MeshStandardMaterial());ownDetail.name='stage-owned dome detail';lod.add(ownDetail);scene.updateMatrixWorld(true);
 const before=JSON.stringify(scene.toJSON()),observed=readStagedViewBounds(root,'107310050',camera,target);
 assert(observed.boxes.some(box=>box.uuid===leaves.uuid&&box.conservativeAlpha),'A shared landmark prefix cannot hide visible retained scenery');
 assert(!observed.boxes.some(box=>box.uuid===ownDetail.uuid),'Only actual target ancestry excludes self geometry');
 assert(scoreExteriorViewpoint(observed,[0,3.55,40]).blockedSamples>0);
 assert.equal(scoreExteriorViewpoint({...observed,boxes:[]},[0,3.55,40]).blockedSamples,0,'The old prefix omission would create a false-clear result');
 assert.equal(JSON.stringify(scene.toJSON()),before);
});
test('occlusion ranking retains the original sector, opposite-angle geometry and every directed stopping sweep',async()=>{
 const requests=[],queryGround=points=>points.map(p=>({...p,height:2,walkable:true,planningClearance:2.25}));
 const querySweeps=segments=>{requests.push(...structuredClone(segments));return segments.map(s=>({...s,clear:true,samples:[]}));};
 const observation={target,boxes:[obstruction([-.8,0,12],[.8,28,14])],unsupported:[],scope:'test advice'};
 const options={bounds:target,camera:{fov:60,aspect:1.6},layout:'desktop',queryGround,querySweeps};
 const original=await createExteriorPlanner(options),advised=await createExteriorPlanner({...options,queryViewBounds:async()=>observation});
 const baseline=await original.route({x:-20,z:-20},0),candidate=await advised.route({x:-20,z:-20},0);
 const expected=scoreExteriorViewpoint(observation,[baseline.endpoint.x,3.55,baseline.endpoint.z]);
 assert(candidate.viewAdvice.selected.blockedSamples<expected.blockedSamples);
 const actualBearing=Math.atan2(candidate.endpoint.x,candidate.endpoint.z);assert(Math.abs(actualBearing)<=Math.PI/9);
 const opposite=await advised.route(candidate.endpoint,Math.PI,actualBearing),oppositeActual=Math.atan2(opposite.endpoint.x,opposite.endpoint.z);
 assert(Math.abs(Math.atan2(Math.sin(oppositeActual-actualBearing),Math.cos(oppositeActual-actualBearing)))>=Math.PI*.8+Math.atan2(.4,advised.viewDistance));
 assert.equal(opposite.prospective.maxForward,.75);assert.equal(advised.receipt.maximumSearchAttempts,64);
 assert(requests.every(s=>s.maxLateral===.41||s.maxLateral===1.96));assert(requests.filter(s=>s.maxForward!==undefined).every(s=>s.maxForward===.75));
});

test('the actual source sky sphere and shipped architectural meshes retain useful foreground discrimination',async t=>{
 const source=await readFile(new URL('../src/belle/islandSky.ts',import.meta.url),'utf8');
 assert(source.includes('new T.SphereGeometry(1,32,16)')&&source.includes('sky.scale.setScalar(9000)')&&source.includes('sky.position.copy(eye)'),'Source-real sky fixture must follow the shipped geometry');
 const scene=new T.Scene(),root=new T.Group();scene.add(root);
 for(const spec of STUDY_SITES){
  const bytes=await readFile(new URL('../public/belle/staged-architecture/'+spec.files[0],import.meta.url));
  const parsed=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
  const lod=new T.LOD();lod.name=spec.id+'_STAGED_LODS';lod.position.set(spec.center[0],2,spec.center[1]);lod.rotation.y=spec.yaw;lod.addLevel(parsed.scene,0);root.add(lod);
 }
 const camera=new T.PerspectiveCamera(60,1.6,.08,22000);camera.position.set(1385.9347954723082,3.55,1068.582542462962);camera.lookAt(1332.47853848762,14.9375,1175.0567802911942);
 const sky=new T.Mesh(new T.SphereGeometry(1,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false}));sky.name='Belle Isle changing sky';sky.scale.setScalar(9000);sky.position.copy(camera.position);scene.add(sky);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const target=readStagedExterior(root,'107310050',camera).bounds,now=performance.now(),before=JSON.stringify(scene.toJSON());
 const observation=readStagedViewBounds(root,'107310050',camera,target);
 assert(!observation.boxes.some(box=>box.mesh===sky.name),'Sky surface triangles are outside every bounded target sightline, even when its whole AABB surrounds the actor');
 assert(observation.refinedMeshGroups>0&&observation.refinementSteps>0);
 const blocked=scoreExteriorViewpoint(observation,camera.position.toArray()),side=scoreExteriorViewpoint(observation,[1347,3.55,1057]);
 assert(blocked.blockedSamples>side.blockedSamples,'The shipped Aquarium obstruction must remain distinguishable from a clearer Conservatory sector-edge view');
 const wholeSky=new T.Box3().setFromBufferAttribute(sky.geometry.getAttribute('position')).applyMatrix4(sky.matrixWorld);
 const defective=scoreExteriorViewpoint({...observation,boxes:[...observation.boxes,{mesh:sky.name,uuid:sky.uuid,instanceId:null,material:0,min:wholeSky.min.toArray(),max:wholeSky.max.toArray()}]},camera.position.toArray());
 assert.equal(defective.blockedSamples,27,'Original whole-sphere advice reproduces the blind ranking defect');
 assert.equal(JSON.stringify(scene.toJSON()),before);assert.equal(sky.geometry.boundingBox,null);assert.equal(sky.geometry.boundingSphere,null);
 t.diagnostic(JSON.stringify({scope:'Actual shipped GLBs and source sky geometry; not a full-game or native visual acceptance',boxes:observation.boxes.length,verticesRead:observation.verticesRead,refinementVerticesRead:observation.refinementVerticesRead,refinementSteps:observation.refinementSteps,oldBlocked:blocked.blockedSamples,alternativeBlocked:side.blockedSamples,elapsedMs:performance.now()-now}));
});

test('broad merged surfaces preserve nearby triangles without filling empty space or dropping crossing triangles',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=new T.BufferGeometry();
 // Two tall, distant sides have an aggregate AABB around camera and target.
 // A third triangle crosses the observation region despite its distant centroid.
 geometry.setAttribute('position',new T.Float32BufferAttribute([-150,0,-150,-150,40,150,-150,0,150,150,0,-150,150,0,150,150,40,150,-200,0,16,200,0,16,200,4,16],3));
 const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({side:T.DoubleSide}));mesh.name='merged surface with empty foreground';scene.add(mesh);scene.updateMatrixWorld(true);
 const source=Array.from(geometry.getAttribute('position').array),observation=readStagedViewBounds(root,'107310050',camera,target);
 assert(observation.boxes.length>0,'Crossing triangle cannot be rejected by its centroid');
 const middle=scoreExteriorViewpoint(observation,[0,3.55,40]);assert(middle.blockedSamples<27,'Empty air inside broad merged bounds is not a full foreground wall');
 assert(observation.boxes.every(box=>box.max.every((n,i)=>n-box.min[i]<=32+1e-8)));
 for(let i=0;i<=20;i++){
  const x=-50+i*5,y=(x+200)/400*4*.4,z=16;
  assert(observation.boxes.some(box=>[x,y,z].every((n,axis)=>n>=box.min[axis]-1e-8&&n<=box.max[axis]+1e-8)),'Every sampled point on the retained crossing triangle remains covered');
 }
 assert.deepEqual(Array.from(geometry.getAttribute('position').array),source);assert.equal(geometry.boundingBox,null);assert.equal(geometry.boundingSphere,null);
});

function denseBlockGeometry(){
 const geometry=new T.BufferGeometry(),positions=[],indices=[];
 for(const x of [-40,40,2000]){
  const first=positions.length/3;positions.push(x,3,18,x+1,3,18,x,5,18);
  for(let n=0;n<32;n++)indices.push(first,first+1,first+2);
 }
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);return geometry;
}
const covers=(boxes,point)=>boxes.some(box=>point.every((n,axis)=>n>=box.min[axis]-1e-7&&n<=box.max[axis]+1e-7));
test('small index blocks preserve every near vertex and draw alignment without revisiting dense triangles',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=denseBlockGeometry(),original=Array.from(geometry.index.array);
 // A draw start need not be aligned to index zero. Keep complete triangles
 // relative to that actual start, including both sides of a block boundary.
 geometry.setIndex([6,7,8,...original]);geometry.setDrawRange(3,original.length);
 const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({alphaTest:.5}));mesh.name='dense retained foliage';scene.add(mesh);scene.updateMatrixWorld(true);
 const before=JSON.stringify(scene.toJSON()),observed=readStagedViewBounds(root,'107310050',camera,target);
 assert.equal(observed.verticesRead,288);assert.equal(observed.refinementVerticesRead,0);
 assert.equal(observed.indexBlocksRead,3);assert.equal(observed.indexBlocksRetained,2);assert.equal(observed.refinementSteps,3);
 for(let vertex=0;vertex<6;vertex++)assert(covers(observed.boxes,new T.Vector3().fromBufferAttribute(geometry.attributes.position,vertex).toArray()));
 assert(!observed.boxes.some(box=>box.min[0]>1000));assert(observed.boxes.every(box=>box.conservativeAlpha));
 assert.equal(scoreExteriorViewpoint(observed,[0,3.55,40]).blockedSamples,0,'Separated retained leaves must not become a wall between patches');
 assert.equal(JSON.stringify(scene.toJSON()),before);assert.equal(geometry.boundingBox,null);assert.equal(geometry.boundingSphere,null);
});
test('small block bounds account for each instance transform and current morph positions',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=denseBlockGeometry(),mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),2);
 const matrix=new T.Matrix4().compose(new T.Vector3(0,0,12),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),.55),new T.Vector3(1.4,.8,1.2));
 mesh.name='transformed retained blocks';mesh.setMatrixAt(0,matrix);mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(2000,0,0));scene.add(mesh);scene.updateMatrixWorld(true);
 const matrices=Array.from(mesh.instanceMatrix.array),observed=readStagedViewBounds(root,'107310050',camera,target);
 const copiedMatrix=new T.Matrix4();mesh.getMatrixAt(0,copiedMatrix);
 for(let vertex=0;vertex<6;vertex++)assert(covers(observed.boxes.filter(box=>box.instanceId===0),new T.Vector3().fromBufferAttribute(geometry.attributes.position,vertex).applyMatrix4(copiedMatrix).toArray()));
 assert(!observed.boxes.some(box=>box.instanceId===1));assert.deepEqual(Array.from(mesh.instanceMatrix.array),matrices);
 const morphGeometry=denseBlockGeometry();morphGeometry.morphAttributes.position=[new T.Float32BufferAttribute(Array.from(morphGeometry.attributes.position.array,n=>n),3)];
 for(let n=0;n<morphGeometry.morphAttributes.position[0].count;n++)morphGeometry.morphAttributes.position[0].setY(n,13);
 const low=new T.Mesh(morphGeometry,new T.MeshStandardMaterial()),high=new T.Mesh(morphGeometry,new T.MeshStandardMaterial());low.name='undeformed retained blocks';high.name='deformed retained blocks';low.morphTargetInfluences[0]=0;high.morphTargetInfluences[0]=1;
 scene.remove(mesh);scene.add(low,high);scene.updateMatrixWorld(true);const before=JSON.stringify(scene.toJSON()),morph=readStagedViewBounds(root,'107310050',camera,target);
 assert(covers(morph.boxes.filter(box=>box.mesh===low.name),[-40,3,18]));assert(covers(morph.boxes.filter(box=>box.mesh===high.name),[-40,13,18]));
 assert.equal(morph.verticesRead,576,'Animated meshes sharing geometry must each be observed');assert.equal(JSON.stringify(scene.toJSON()),before);assert.equal(morphGeometry.boundingBox,null);
});
test('clipping a source-scale crossing triangle preserves every nearby surface and remains fail-closed for obstruction',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-9000,-9000,20,9000,-9000,20,0,9000,20],3));
 const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({side:T.DoubleSide}));mesh.name='retained giant crossing surface';scene.add(mesh);scene.updateMatrixWorld(true);
 const before=JSON.stringify(scene.toJSON()),observed=readStagedViewBounds(root,'107310050',camera,target);
 assert.equal(observed.verticesRead,3);assert.equal(observed.refinementVerticesRead,3);assert.equal(observed.clippingPlanesRead,6);
 assert(observed.refinementSteps<10000,'Long edges outside the query region must not consume its refinement budget');
 assert(observed.boxes.every(box=>box.max.every((n,i)=>n-box.min[i]<=32+1e-8)));
 for(let x=-80;x<=80;x+=8)for(let y=-60;y<=80;y+=7)if(Math.hypot(x,y-target.center[1],20)<=observed.range)assert(covers(observed.boxes,[x,y,20]));
 assert.equal(scoreExteriorViewpoint(observed,[0,3.55,40]).blockedSamples,27,'Clipping must never manufacture a clear architectural view through the retained surface');
 assert.equal(scoreExteriorViewpoint({...observed,boxes:[]},[0,3.55,40]).blockedSamples,0,'The fixture distinguishes a real blocker from empty space');
 assert.equal(JSON.stringify(scene.toJSON()),before);assert.equal(geometry.boundingBox,null);assert.equal(geometry.boundingSphere,null);
});
test('the unchanged spatial work guard fails closed with attributable mesh and work counters',()=>{
 const {scene,root,camera}=sceneFixture(),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-9000,4,20,9000,4,20,0,4,20],3));
 const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),2400);mesh.name='retained repeated degenerate surfaces';scene.add(mesh);scene.updateMatrixWorld(true);
 const before=Array.from(mesh.instanceMatrix.array);
 assert.throws(()=>readStagedViewBounds(root,'107310050',camera,target),error=>{
  assert.match(error.message,/^View observation exceeds bounded spatial refinement /);
  const receipt=JSON.parse(error.message.slice(error.message.indexOf('{')));
  assert.equal(receipt.context.mesh,mesh.name);assert.equal(receipt.context.start,0);assert.equal(receipt.context.end,3);assert(Number.isInteger(receipt.context.instanceId));
  assert.equal(receipt.refinementSteps,1000001);assert(receipt.verticesRead+receipt.refinementVerticesRead<20000000);assert(receipt.boxes<40000);assert(receipt.indexBlocksRead>0&&receipt.clippingPlanesRead>0);return true;
 });
 assert.deepEqual(Array.from(mesh.instanceMatrix.array),before);assert.equal(geometry.boundingBox,null);assert.equal(geometry.boundingSphere,null);
});
test('source river and Conservatory garden geometry fit the unchanged bound without removing their surfaces',async t=>{
 const {scene,root,lod,camera}=sceneFixture(),map=JSON.parse(await readFile(new URL('../public/belle/map.json',import.meta.url),'utf8'));lod.name='107227742_STAGED_LODS';
 const actor={x:1350.8787341500893,y:2,z:1125.3483974696717};camera.aspect=390/844;camera.position.set(actor.x,3.55,actor.z);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const bounds={min:[1345.4098449882,2,1127.7273441438022],max:[1382.1501550118,11.822516441345215,1205.8886281462787],center:[1363.78,6.911258220672607,1166.8079861450406]};
 const ring=riverFarRing(),farGeometry=new T.BufferGeometry();farGeometry.setAttribute('position',new T.Float32BufferAttribute(ring.positions,3));farGeometry.setIndex(ring.indices);
 const far=new T.Mesh(farGeometry,new T.MeshBasicMaterial());far.name='source distant river';far.position.set(Math.round(actor.x/2)*2,0,Math.round(actor.z/2)*2);scene.add(far);
 const nearGeometry=new T.PlaneGeometry(RIVER_PATCH_SIZE,RIVER_PATCH_SIZE,RIVER_PATCH_SEGMENTS,RIVER_PATCH_SEGMENTS).rotateX(-Math.PI/2);nearGeometry.setIndex(new T.BufferAttribute(flatRiverPatchIndex(),1));
 const near=new T.Mesh(nearGeometry,new T.MeshBasicMaterial());near.name='source near river';near.position.copy(far.position);scene.add(near);
 const garden=addConservatoryGarden(scene,map);garden.update(actor.x,actor.z);scene.updateMatrixWorld(true);
 const vertices=Array.from(farGeometry.attributes.position.array),gardenVisibility=garden.root.visible,now=performance.now(),observed=readStagedViewBounds(root,'107227742',camera,bounds);
 assert(observed.refinementSteps<250000&&observed.verticesRead+observed.refinementVerticesRead<20000000&&observed.boxes.length<40000);
 assert(observed.indexBlocksRetained>0&&observed.clippingPlanesRead>0);assert(observed.boxes.some(box=>box.mesh===far.name));assert(observed.boxes.some(box=>box.mesh===near.name));
 assert(observed.boxes.some(box=>garden.root.children.some(child=>child.uuid===box.uuid)),'The original nearby garden remains observed');
 assert.deepEqual(Array.from(farGeometry.attributes.position.array),vertices);assert.equal(garden.root.visible,gardenVisibility);assert.equal(farGeometry.boundingBox,null);assert.equal(nearGeometry.boundingBox,null);
 t.diagnostic(JSON.stringify({scope:'Source-generated water and garden at the failed native actor; not whole-world or native acceptance',boxes:observed.boxes.length,verticesRead:observed.verticesRead,refinementVerticesRead:observed.refinementVerticesRead,refinementSteps:observed.refinementSteps,indexBlocksRead:observed.indexBlocksRead,indexBlocksRetained:observed.indexBlocksRetained,clippingPlanesRead:observed.clippingPlanesRead,elapsedMs:performance.now()-now}));
});
