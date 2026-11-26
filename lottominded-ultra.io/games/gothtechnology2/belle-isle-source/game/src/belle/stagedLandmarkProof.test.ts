import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createStagedLandmarkProof} from './stagedLandmarkProof.ts';
import {sweepSphereTriangle,sweepVisibleMeshTriangles} from './visibleTriangleSweep.ts';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {greenhouseRay,type ConservatoryLayout} from './conservatory.ts';
import {STUDY_SITES} from './stagedLandmarkStudies.ts';

test('staging proof reads the actual actor and camera without exposing mutable gameplay state',()=>{
 const root=new T.Group(),scene=new T.Scene();scene.add(root);
 for(const id of ['107310050','107227742']){
  const lod=new T.LOD();lod.name=id+'_STAGED_LODS';root.add(lod);
  for(let i=0;i<3;i++){const level=new T.Group();level.visible=i===0;lod.addLevel(level,[0,180,480][i]);}
 }
 const retained=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());retained.name='107227742_Aquarium illuminated habitat';root.add(retained);
 const cfg={id:'107227742',center:[10,20],yaw:0,walls:[{a:[0,0],b:[1,0]}]},calls:{height:number;radius:number}[]=[];
 const terrain={height:()=>2,obstructed:(x:number)=>x>12,raycastObstacle:(o:{y:number},_d:unknown,_m:number,r:number)=>{calls.push({height:o.y,radius:r});return o.y>3?.4:null;}};
 const proof=createStagedLandmarkProof(root,terrain,{aquarium:cfg,conservatory:{id:'107310050',center:[0,0],yaw:0}});
 const camera=new T.PerspectiveCamera(55,1.6,.1,1000);camera.position.set(12,3.6,22);camera.updateMatrixWorld();
 const pose={x:12,y:2,z:22,headingY:0,speed:2.35,footBlend:1,footMode:2};
 assert.equal(proof.publicApi.snapshot().ready,false);assert.equal(calls.length,0);
 proof.observeActor(pose,true);proof.observeView(1,12,22,camera);
 // Cheap polling must not traverse the scene or query any collision surface.
 const motion=proof.publicApi.motion();assert.equal(motion.actor?.onFoot,true);assert.equal(proof.publicApi.frame(),1);assert.equal(calls.length,0);
 const before=root.toJSON(),snapshot=proof.publicApi.snapshot();
 assert.equal(snapshot.ready,true);assert.deepEqual(snapshot.camera?.position,[12,3.6,22]);
 assert.deepEqual(snapshot.sites[1].local,{u:2,v:-2});assert.equal(snapshot.sites[1].installedLods,3);assert.deepEqual(snapshot.sites[1].selectedLevels,[0]);
 assert.deepEqual(snapshot.actor?.forwardProbe?.sweptHits,[null,.4,.4]);assert.deepEqual(calls.map(c=>c.radius),Array(12).fill(.27));
 assert.equal(snapshot.actor?.visibleForwardSurfaces.length,3);assert.equal(snapshot.actor?.visibleForwardSweeps.length,3);
 assert.deepEqual(snapshot.actor?.visibleForwardSweeps.map(s=>({height:s.height,radius:s.radius,max:s.maxDistance,origin:s.origin,direction:s.direction})),[.62,1.1,1.58].map(height=>({height,radius:.27,max:.7,origin:[12,2+height,22],direction:[0,0,1]})));
 assert.deepEqual(root.toJSON(),before,'Snapshot must not rewrite scene transforms, visibility, geometry, or materials');
 snapshot.actor!.x=999;snapshot.sites[1].layout!.center[0]=999;motion.actor!.z=999;pose.x=777;cfg.center[0]=777;
 const again=proof.publicApi.snapshot();assert.equal(again.actor?.x,12);assert.equal(again.actor?.z,22);assert.deepEqual(again.sites[1].layout?.center,[10,20]);
 assert.equal(Object.isFrozen(proof.publicApi),true);assert.deepEqual(Object.keys(proof.publicApi).sort(),['frame','motion','snapshot']);
 proof.observeView(1,12,22,camera);assert.equal(proof.publicApi.frame(),1,'Repeated views at one simulation time do not fake movement frames');
 proof.observeView(2,12,22,camera);assert.equal(proof.publicApi.frame(),2);
});

const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const close=(actual:number,expected:number,tolerance=1e-9)=>assert(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);
const face=[v(-2,-2,0),v(2,-2,0),v(0,2,0)] as const;
test('continuous sphere reaches a face at its radius offset and preserves finite forward range',()=>{
 const hit=sweepSphereTriangle(v(0,0,1),v(0,0,-1),.25,1,...face);assert(hit);assert.equal(hit.feature,'face');close(hit.distance,.75);assert.deepEqual(hit.point,[0,0,0]);
 close(sweepSphereTriangle(v(0,0,-1),v(0,0,1),.25,1,...face)!.distance,.75);
 assert.equal(sweepSphereTriangle(v(0,0,1),v(0,0,-1),.25,.749,...face),null);
 assert.equal(sweepSphereTriangle(v(0,0,1),v(0,0,1),.25,3,...face),null);
});
test('a genuine finite edge hit survives a null centerline ray',()=>{
 const tri=[v(0,-2,0),v(0,2,0),v(2,0,0)] as const,origin=v(-.2,0,1),direction=v(0,0,-1);
 assert.equal(new T.Ray(origin,direction).intersectTriangle(...tri,false,new T.Vector3()),null);
 const hit=sweepSphereTriangle(origin,direction,.25,1,...tri);assert(hit);assert.equal(hit.feature,'edge');close(hit.distance,.85);assert.deepEqual(hit.point,[0,0,0]);
 assert.equal(sweepSphereTriangle(v(-.251,0,1),direction,.25,2,...tri),null,'Nearby geometry outside the swept capsule is not a hit');
});
test('vertex contacts use the finite corner rather than an extended plane or edge',()=>{
 const tri=[v(0,0,0),v(2,0,0),v(0,2,0)] as const;
 const hit=sweepSphereTriangle(v(-.1,-.1,1),v(0,0,-1),.25,1,...tri);assert(hit);assert.equal(hit.feature,'vertex');
 close(hit.distance,1-Math.sqrt(.25**2-.1**2-.1**2));assert.deepEqual(hit.point,[0,0,0]);
 assert.equal(sweepSphereTriangle(v(-.2,-.2,1),v(0,0,-1),.25,2,...tri),null);
});
test('parallel edge approach, initial overlap, degeneracy and invalid inputs are distinguished',()=>{
 const tri=[v(0,-2,0),v(0,2,0),v(2,0,0)] as const;
 const parallel=sweepSphereTriangle(v(-1,0,.1),v(1,0,0),.25,2,...tri);assert(parallel);assert.equal(parallel.feature,'edge');close(parallel.distance,1-Math.sqrt(.25**2-.1**2));
 const inside=sweepSphereTriangle(v(0,0,.1),v(0,0,-1),.25,1,...face);assert(inside);assert.equal(inside.feature,'initial-overlap');assert.equal(inside.distance,0);
 assert.equal(sweepSphereTriangle(v(0,0,1),v(0,0,-1),.25,2,v(0,0,0),v(1,0,0),v(2,0,0)),null);
 assert.throws(()=>sweepSphereTriangle(v(0,0,1),v(0,0,-2),.25,2,...face),/Invalid/);
});
function triangleGeometry(indexed=true){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(face.flatMap(p=>p.toArray()),3));
 if(indexed)geometry.setIndex([0,1,2]);return geometry;
}
test('indexed and nonindexed triangles respect actual world transforms including mirrored and sheared parents',()=>{
 for(const indexed of[false,true]){
  const mesh=new T.Mesh(triangleGeometry(indexed),new T.MeshStandardMaterial()),parent=new T.Group();parent.add(mesh);mesh.name='transformed actual pane';
  parent.position.set(1300,2,1170);parent.rotation.set(.2,.3,.1);parent.scale.set(2,1,.5);mesh.rotation.set(.1,.4,.2);mesh.scale.set(-2,3,4);
  parent.updateMatrixWorld(true);mesh.geometry.computeBoundingSphere();
  const center=v(0,0,0).applyMatrix4(mesh.matrixWorld),normal=v(0,0,1).applyMatrix3(new T.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  const origin=center.clone().add(normal),direction=normal.clone().negate(),before=parent.toJSON(),read=sweepVisibleMeshTriangles([mesh],origin,direction,.25,1);
  assert(read.hit);close(read.hit.distance,.75,1e-8);assert.deepEqual(read.hit.vertexIndices,[0,1,2]);assert.equal(read.hit.mesh,mesh.name);assert.equal(read.checkedTriangles,1);
  assert.deepEqual(parent.toJSON(),before,'Observation must not update transforms, bounds, vertices or materials');
 }
});
test('draw ranges, groups, visibility and layers cannot contribute unrendered triangles',()=>{
 const geometry=triangleGeometry(),near=Array.from(geometry.getAttribute('position').array),far=near.map((n,i)=>i%3===2?n-2:n);
 geometry.setAttribute('position',new T.Float32BufferAttribute([...far,...near],3));geometry.setIndex([0,1,2,3,4,5]);geometry.clearGroups();geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);
 const materials=[new T.MeshStandardMaterial(),new T.MeshStandardMaterial()],mesh=new T.Mesh(geometry,materials),parent=new T.Group();parent.add(mesh);parent.updateMatrixWorld(true);
 const read=()=>sweepVisibleMeshTriangles([mesh],v(0,0,1),v(0,0,-1),.25,1);
 assert.equal(read().hit?.faceIndex,1);geometry.setDrawRange(0,3);assert.equal(read().hit,null);geometry.setDrawRange(3,3);assert.equal(read().hit?.faceIndex,1);
 materials[1].visible=false;assert.equal(read().hit,null);materials[1].visible=true;materials[1].opacity=0;assert.equal(read().hit,null);materials[1].opacity=1;
 parent.visible=false;assert.equal(read().hit,null);parent.visible=true;mesh.layers.set(1);
 assert.equal(sweepVisibleMeshTriangles([mesh],v(0,0,1),v(0,0,-1),.25,1,new T.Layers()).hit,null);
});
test('native instance transforms and count are observed without mutating the shared source',()=>{
 const mesh=new T.InstancedMesh(triangleGeometry(),new T.MeshStandardMaterial(),2);mesh.name='actual repeated pane';
 mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(5,0,0));mesh.setMatrixAt(1,new T.Matrix4());mesh.updateMatrixWorld(true);
 const before=Array.from(mesh.instanceMatrix.array),read=sweepVisibleMeshTriangles([mesh],v(0,0,1),v(0,0,-1),.25,1);
 assert.equal(read.hit?.instanceId,1);close(read.hit!.distance,.75);assert.deepEqual(Array.from(mesh.instanceMatrix.array),before);
 mesh.count=1;assert.equal(sweepVisibleMeshTriangles([mesh],v(0,0,1),v(0,0,-1),.25,1).hit,null);
});
test('unsupported rendered alpha masks fail coverage instead of providing an invisible filled face',()=>{
 const material=new T.MeshStandardMaterial({alphaTest:.5}),mesh=new T.Mesh(triangleGeometry(),material);mesh.name='masked pane';mesh.updateMatrixWorld(true);
 const read=sweepVisibleMeshTriangles([mesh],v(0,0,1),v(0,0,-1),.25,1);assert.equal(read.hit,null);assert.deepEqual(read.unsupportedMeshes,['masked pane']);
});

test('exact9b43 desktop and phone poses contact the shipped Conservatory face/edge with the unchanged radius and terrain',async()=>{
 // Original native run45871788528, desktop140094952780 / phone140094952744.
 // Phone raw report SHA2569f511536e649700f2b50487eb1daea9797cdc5db6d717136a49f0173003d0ff0.
 const file=new URL('../../public/belle/staged-architecture/Conservatory_Architectural_Study.glb',import.meta.url),bytes=await readFile(file);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),STUDY_SITES.find(site=>site.id==='107310050')!.hashes[0]);
 const {scene}=await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'');
 // Other independently reviewed model components may change. The exact pane
 // touched by these recorded poses must retain its9b43 geometry and index bits.
 const pane=scene.getObjectByName('VestibuleSideGlass__glass') as T.Mesh;assert(pane instanceof T.Mesh);
 for(const [attribute,expected]of[[pane.geometry.getAttribute('position'),'de6165aa786177415145177288e2a57b5a754f66843d580bb2d2a10e1024e640'],[pane.geometry.index!,'2fe6aa05e6234da9e1ec566f23ba5274cebf50c0cfbeac199757009783d7e196']]as const){
  const array=(attribute as T.BufferAttribute).array;assert.equal(createHash('sha256').update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)).digest('hex'),expected);
 }
 const cfg=(JSON.parse(await readFile(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as {conservatory:ConservatoryLayout}).conservatory;
 scene.position.set(cfg.center[0],2,cfg.center[1]);scene.rotation.y=cfg.yaw;scene.updateMatrixWorld(true);
 const meshes:T.Mesh[]=[];scene.traverse(object=>{if(object instanceof T.Mesh)meshes.push(object);});
 const poses=[
  {device:'desktop',x:1317.7324785900248,y:2,z:1173.82047899843,headingY:3.5712963267949034,feature:'face',expected:.17295204565720054,ray:.44558680320491895},
  {device:'phone',x:1318.812325109301,y:2,z:1173.4975924000141,headingY:3.278796326794902,feature:'edge',expected:.17334038405942712,ray:null},
 ];
 for(const pose of poses)for(const height of[.62,1.1,1.58]){
  const origin=v(pose.x,pose.y+height,pose.z),direction=v(Math.sin(pose.headingY),0,Math.cos(pose.headingY));
  const collision=greenhouseRay(cfg,{x:origin.x,y:origin.y,z:origin.z},direction,.7,.27);close(collision!,.14);
  const ray=new T.Raycaster(origin,direction,0,2).intersectObjects(meshes,false)[0];
  if(pose.ray===null)assert.equal(ray,undefined);else close(ray.distance,pose.ray,1e-8);
  const observed=sweepVisibleMeshTriangles(meshes,origin,direction,.27,.7);assert.deepEqual(observed.unsupportedMeshes,[]);assert(observed.hit);
  const hit=observed.hit;assert.equal(hit.mesh,'VestibuleSideGlass__glass');assert.equal(hit.faceIndex,18);assert.equal(hit.feature,pose.feature);close(hit.distance,pose.expected,1e-8);
  assert(Math.abs(hit.distance-collision!)<.035,'This measured face/edge contact must agree without changing the .35m gate');
  const triangle=new T.Triangle(...hit.triangle.map(p=>new T.Vector3(...p)) as [T.Vector3,T.Vector3,T.Vector3]);
  const center=origin.clone().addScaledVector(direction,hit.distance),prior=origin.clone().addScaledVector(direction,hit.distance-1e-6);
  close(triangle.closestPointToPoint(center,new T.Vector3()).distanceTo(center),.27,1e-8);
  assert(triangle.closestPointToPoint(prior,new T.Vector3()).distanceTo(prior)>.27,'The retained receipt must be an actual first forward sphere contact');
 }
});

test('proof records stale facade attachment and actual LOD state instead of assuming staging succeeded',()=>{
 const root=new T.Group(),camera=new T.PerspectiveCamera();camera.updateMatrixWorld();
 const facade=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());facade.name='107227742_Aquarium aged limestone';root.add(facade);
 const terrain={height:()=>2,obstructed:()=>false,raycastObstacle:()=>null};
 const proof=createStagedLandmarkProof(root,terrain,{aquarium:{id:'107227742',center:[0,0],yaw:0}});
 proof.observeActor({x:0,y:2,z:0,headingY:0,speed:0,footBlend:1,footMode:0},false);proof.observeView(1,0,0,camera);
 const snapshot=proof.publicApi.snapshot();assert.equal(snapshot.ready,false);assert.equal(snapshot.actor?.onFoot,false);
 assert.deepEqual(snapshot.sites[1].attachedLegacyFacades,[facade.name]);assert.equal(snapshot.sites[1].installedLods,0);
});
