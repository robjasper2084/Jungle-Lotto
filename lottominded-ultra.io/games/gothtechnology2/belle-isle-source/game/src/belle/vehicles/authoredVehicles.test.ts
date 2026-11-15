import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {corleoGaitClips} from './corleoMotion.ts';
import {fitCorleoRider} from './corleoFit.ts';
import {CorleoController} from './corleoController.ts';
import {normalizeRideChoice} from '../rideChoice.ts';
import {assignPlayer,defaultSelection} from '../coop/coop.ts';
import {ExplorerBuffer,explorerFrame} from '../onlineProtocol.ts';
import {createPose} from '../../../runtime/ride-core/src/controller.ts';
import type {ParkTerrain} from '../terrain.ts';
const neutral={throttle:0,steer:0,lift:0,boost:false,brake:false};
const flat={map:{water:[]},height:()=>0,land:(_x:number,z:number)=>z<20,obstructed:()=>false,bridge:()=>({active:false}),raycastFlight:()=>null,raycastObstacle:()=>null,raycast:()=>null,sampleGround:(_x:number,_z:number,out:any)=>Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'asphalt'}),navigationObstacles:()=>[]} as unknown as ParkTerrain;
function run(c:CorleoController,n:number,input=neutral,hz=60){for(let i=0;i<n*hz;i++)c.advance(1/hz,input);}
test('authored vehicle files match the original package receipts',()=>{
 const receipt=JSON.parse(fs.readFileSync('public/belle/vehicles/authored-packages.json','utf8'));
 for(const pkg of receipt.packages)for(const entry of pkg.entries){const bytes=fs.readFileSync(entry.path);assert.equal(bytes.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);}
});
test('both vehicles and pilots survive solo and co-op selection',()=>{
 for(const vehicle of ['jetson','corleo'] as const)for(const pilot of ['professional','maverick'] as const){assert.deepEqual(normalizeRideChoice({vehicle,pilot,livery:'sport_blue',camera:'fpp'}),{vehicle,pilot,livery:'sport_blue',camera:'fpp'});const id=vehicle+(pilot==='maverick'?':maverick':'');const m=assignPlayer(0,{...defaultSelection(0),vehicleId:id});assert.equal(m.vehicleId,id);assert.equal(m.controller,vehicle==='corleo'?'CorleoController':'HoverController');}
});
test('network preserves model and pilot, rejects URLs, and snaps on vehicle changes',()=>{
 const frame={seq:1,pose:createPose(),mode:'hover',seat:0,active:true,vehicle:'jetson',pilot:'maverick',livery:'sport_red',lights:false,brake:true,energy:.3};
 assert.deepEqual(explorerFrame(frame),frame);
 for(const invalid of [{vehicle:'https://attacker/model.glb'},{pilot:'other'},{livery:'unknown'},{lights:1},{brake:'yes'},{energy:2},{energy:NaN}])assert.equal(explorerFrame({...frame,...invalid}),undefined);
 const buffer=new ExplorerBuffer();buffer.push(frame,100);buffer.push({...frame,seq:2,vehicle:'corleo',pose:{...frame.pose,x:5}},200);assert.equal(buffer.sample(201)?.vehicle,'corleo');assert.equal(buffer.sample(201)?.pose.x,5);
});
test('CORLEO follows ground input, brakes, reverses, and never takes flight',()=>{
 const c=new CorleoController(flat,{x:0,z:0,heading:0});c.launch();run(c,3,{...neutral,throttle:1,lift:1});assert(c.pose.z>1);assert.equal(c.flying,false);assert(Math.abs(c.pose.y-.18)<.03);assert(c.pose.speed<=4.2);
 run(c,2,{...neutral,brake:true});assert(Math.abs(c.pose.speed)<.1);const z=c.pose.z;run(c,3,{...neutral,throttle:-1});assert(c.pose.z<z);assert(c.exitPoint()===null);run(c,2,{...neutral,brake:true});assert(c.exitPoint());
});
test('CORLEO rejects water and other-player collisions with its full footprint',()=>{
 const c=new CorleoController(flat,{x:0,z:17,heading:0});run(c,8,{...neutral,throttle:1});assert(c.pose.z<20);assert(c.pose.y>=.15);
 const blocked=new CorleoController(flat,{x:0,z:0,heading:0},()=>0);run(blocked,2,{...neutral,throttle:1});assert.equal(blocked.pose.z,0);assert(blocked.collision);
});
test('actual CORLEO gait moves limbs with independent skeletons and no showcase travel',async()=>{
 const bytes=fs.readFileSync('public/belle/vehicles/corleo-professional.glb');const source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const a=clone(source.scene),b=clone(source.scene),clips=corleoGaitClips(source.animations[0]);assert(clips.walk.tracks.length>50);assert(!clips.walk.tracks.some(t=>/^CR_Root\.(position|quaternion)$/.test(t.name)));
 const rootA=a.getObjectByName('CR_Root')!,rootB=b.getObjectByName('CR_Root')!;const before=rootA.position.clone(),rotation=rootA.quaternion.toArray();const mix=new T.AnimationMixer(a);mix.clipAction(clips.walk).play();mix.update(.7);assert.deepEqual(rootA.position,before);assert.deepEqual(rootA.quaternion.toArray(),rotation);assert.deepEqual(rootB.position,before);
 const sa:T.Skeleton[]=[],sb:T.Skeleton[]=[];a.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)sa.push((o as T.SkinnedMesh).skeleton);});b.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)sb.push((o as T.SkinnedMesh).skeleton);});assert(sa.length>0);assert.notEqual(sa[0],sb[0]);assert(sa[0].bones.every((bone,i)=>bone!==sb[0].bones[i]));assert(sa[0].bones.some((bone,i)=>bone.quaternion.angleTo(sb[0].bones[i].quaternion)>.01));mix.stopAllAction();mix.uncacheRoot(a);
});
test('photo-sized CORLEO preserves adult limbs and control contacts through all gaits',async()=>{
 for(const pilot of ['professional','maverick']){
  const bytes=fs.readFileSync(`public/belle/vehicles/corleo-${pilot}.glb`),source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const model=clone(source.scene),mixer=new T.AnimationMixer(model),clips=corleoGaitClips(source.animations[0]);
  const actions=Object.values(clips).map(clip=>mixer.clipAction(clip).play());actions.forEach((action,i)=>action.setEffectiveWeight(i===0?1:0));mixer.update(0);model.updateMatrixWorld(true);
  const bones:T.Object3D[]=[];model.traverse(o=>{if((o as T.Bone).isBone)bones.push(o);});
  const head=bones.find(o=>o.name.endsWith('Head'))!,hips=bones.find(o=>o.name.endsWith('Hips'))!;
  const originalBodyLength=head.getWorldPosition(new T.Vector3()).distanceTo(hips.getWorldPosition(new T.Vector3()));
  const fit=fitCorleoRider(model);
  for(const contact of fit.contacts)assert(contact.offset.length()<.16,'wrist/ankle is on the same physical side as its control');
  const originalLengths=fit.contacts.map(({chain})=>[chain.upper.getWorldPosition(new T.Vector3()).distanceTo(chain.knee.getWorldPosition(new T.Vector3())),chain.knee.getWorldPosition(new T.Vector3()).distanceTo(chain.foot.getWorldPosition(new T.Vector3()))]);
  assert(Math.abs(head.getWorldPosition(new T.Vector3()).distanceTo(hips.getWorldPosition(new T.Vector3()))-originalBodyLength)<1e-5,'adult torso size');
  assert(head.getWorldPosition(new T.Vector3()).y<2.15,'seated rider at human scale');
  for(let gait=0;gait<3;gait++){
   actions.forEach((action,i)=>action.setEffectiveWeight(i===gait?1:0));
   for(let frame=0;frame<60;frame++){
    mixer.update(1/30);fit.update();
    fit.contacts.forEach(({chain,target},i)=>{
     const a=chain.upper.getWorldPosition(new T.Vector3()),b=chain.knee.getWorldPosition(new T.Vector3()),c=chain.foot.getWorldPosition(new T.Vector3());
     assert(c.distanceTo(target)<.015,`${pilot} gait ${gait} ${chain.foot.name} control contact: ${c.distanceTo(target)}`);
     assert(Math.abs(a.distanceTo(b)-originalLengths[i][0])<1e-5);assert(Math.abs(b.distanceTo(c)-originalLengths[i][1])<1e-5);
    });
   }
  }
  mixer.stopAllAction();mixer.uncacheRoot(model);
 }
});
