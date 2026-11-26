import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createStagedLandmarkProof} from './stagedLandmarkProof.ts';

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
 assert.deepEqual(root.toJSON(),before,'Snapshot must not rewrite scene transforms, visibility, geometry, or materials');
 snapshot.actor!.x=999;snapshot.sites[1].layout!.center[0]=999;motion.actor!.z=999;pose.x=777;cfg.center[0]=777;
 const again=proof.publicApi.snapshot();assert.equal(again.actor?.x,12);assert.equal(again.actor?.z,22);assert.deepEqual(again.sites[1].layout?.center,[10,20]);
 assert.equal(Object.isFrozen(proof.publicApi),true);assert.deepEqual(Object.keys(proof.publicApi).sort(),['frame','motion','snapshot']);
 proof.observeView(1,12,22,camera);assert.equal(proof.publicApi.frame(),1,'Repeated views at one simulation time do not fake movement frames');
 proof.observeView(2,12,22,camera);assert.equal(proof.publicApi.frame(),2);
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
