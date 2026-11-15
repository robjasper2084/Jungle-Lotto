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
import {VehicleHeadlamp} from './headlamp.ts';
import {normalizeRideChoice} from '../rideChoice.ts';
import {assignPlayer,defaultSelection} from '../coop/coop.ts';
import {ExplorerBuffer,explorerFrame} from '../onlineProtocol.ts';
import {createPose} from '../../../runtime/ride-core/src/controller.ts';
import {createCorleoActions} from './corleoActions.ts';
import {inPlaceCorleoClip} from '../corleoAnimation.ts';
import {CORLEO_TRANSITION_SECONDS} from './corleoState.ts';
import {HORSE_LEGS,horseStride,horseGait,horseCadence} from './corleoHorseGait.ts';
import type {ParkTerrain} from '../terrain.ts';
const neutral={throttle:0,steer:0,lift:0,boost:false,brake:false};
const flat={map:{water:[]},height:()=>0,land:(_x:number,z:number)=>z<20,obstructed:()=>false,bridge:()=>({active:false}),raycastFlight:()=>null,raycastObstacle:()=>null,raycast:()=>null,sampleGround:(_x:number,_z:number,out:any)=>Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'asphalt'}),navigationObstacles:()=>[]} as unknown as ParkTerrain;
test('vehicle switching and headlights keep the pre-warmed scene light count fixed',()=>{
 const scene=new T.Scene(),lamp=new VehicleHeadlamp(scene),corleo=new T.Group(),jetson=new T.Group();corleo.position.set(3,2,8);jetson.position.set(-4,6,10);jetson.rotation.y=Math.PI/2;
 const topology=()=>{const lights:T.Object3D[]=[];scene.traverseVisible(o=>{if((o as T.Light).isLight)lights.push(o);});return lights;};
 const initial=topology();assert.equal(initial.length,1);assert.equal(lamp.light.intensity,0);
 lamp.update(corleo,true,true,false,1);assert(lamp.light.intensity>0);assert(lamp.light.target.position.z>corleo.position.z);
 lamp.off();assert.equal(lamp.light.intensity,0);assert.deepEqual(topology(),initial);
 lamp.update(jetson,false,true,true,1);assert(lamp.light.target.position.x>jetson.position.x);assert.deepEqual(topology(),initial);
 lamp.update(jetson,false,false,false,0);assert.equal(lamp.light.intensity,0);assert.deepEqual(topology(),initial);
});
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
 const c=new CorleoController(flat,{x:0,z:0,heading:0});c.launch();run(c,3,{...neutral,throttle:1,lift:1});assert(c.pose.z>1);assert.equal(c.flying,false);assert(Math.abs(c.pose.y-.18)<.03);assert(c.pose.speed<=25*.44704);
 run(c,2,{...neutral,brake:true});assert(Math.abs(c.pose.speed)<.1);const z=c.pose.z;run(c,3,{...neutral,throttle:-1});assert(c.pose.z<z);assert(c.exitPoint()===null);run(c,2,{...neutral,brake:true});assert(c.exitPoint());
});
test('one CORLEO controller owns mount, crawl, jump, 160 mph running and dismount',()=>{
 const ground={...flat,land:()=>true} as unknown as ParkTerrain,c=new CorleoController(ground,{x:0,z:0,heading:0});
 c.beginMount();run(c,CORLEO_TRANSITION_SECONDS-1,{...neutral,throttle:1,boost:true});assert.equal(c.pose.z,0);assert.equal(c.pose.corleoAction,'MOUNT');run(c,1.1);assert(!c.transitioning);
 run(c,7,{...neutral,throttle:1,boost:true});assert(Math.abs(c.pose.speed-160*.44704)<1e-4);assert.equal(c.pose.corleoAction,'RUN');
 run(c,5,{...neutral,brake:true});assert.equal(c.pose.speed,0);c.toggleCrawl();run(c,2,{...neutral,throttle:1});assert.equal(c.pose.corleoAction,'CRAWL');assert(c.pose.speed<=.36);c.launch();c.advance(.05,{...neutral,throttle:1});assert.equal(c.motion.pose.airMetres,0,'crawl suppresses jump');
 c.toggleCrawl();c.launch();c.advance(.05,neutral);assert(c.motion.pose.airMetres>0);assert.equal(c.pose.corleoAction,'JUMP');assert.equal(c.beginDismount(),false,'cannot dismount in midair');run(c,1);assert.equal(c.motion.pose.airMetres,0);assert(c.beginDismount());const z=c.pose.z;run(c,CORLEO_TRANSITION_SECONDS+.1,{...neutral,throttle:1});assert.equal(c.pose.z,z);assert(c.dismountReady);assert(c.exitPoint());
});
test('CORLEO action packets are bounded and retain their actual animation phase',()=>{
 const frame={seq:1,pose:createPose(),mode:'hover',seat:0,active:true,vehicle:'corleo',pilot:'professional',corleoAction:'CRAWL',corleoTime:.7};assert.deepEqual(explorerFrame(frame),frame);
 for(const invalid of [{vehicle:'jetson'},{corleoAction:'OTHER'},{corleoTime:NaN},{corleoTime:-1},{corleoTime:61},{corleoTime:undefined}])assert.equal(explorerFrame({...frame,...invalid}),undefined);
});
test('all action clips animate the fitted shared CORLEO without missing targets or changed rider scale',async()=>{
 for(const pilot of ['professional','maverick'] as const){
  const parse=async(file:string)=>{const b=fs.readFileSync(file);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
  const source=await parse(`public/belle/vehicles/corleo-${pilot}.glb`),model=clone(source.scene),bind=new T.AnimationMixer(model);bind.clipAction(corleoGaitClips(source.animations[0]).idle).play();bind.update(0);const fit=fitCorleoRider(model);bind.stopAllAction();bind.uncacheRoot(model);
  const clips:any={};for(const action of ['MOUNT','RUN','CRAWL','JUMP','DISMOUNT']){const asset=await parse(`public/belle/vehicles/corleo/CORLEO_${pilot==='professional'?'Professional':'Maverick'}_${action}.glb`);clips[action]=inPlaceCorleoClip(asset.animations[0],action==='JUMP');}
  const animator=createCorleoActions(model,source.animations[0],clips),mount=model.getObjectByName('CR_RiderMount')!,scale=mount.scale.clone();
  for(const action of ['IDLE','WALK','TROT','RUN','CRAWL','JUMP','MOUNT','DISMOUNT'] as const){for(let frame=0;frame<30;frame++){
   const pose={x:0,y:.18,z:0,heading:0,speed:action==='CRAWL'?.36:2,pitch:0,roll:0,lift:0,rpm:0,corleoAction:action,corleoPhase:frame/30,corleoTime:frame/30*(action==='MOUNT'||action==='DISMOUNT'?12:.6)};
   const contact=animator.update(pose);fit.update(contact);assert.deepEqual(mount.scale,scale);model.traverse(o=>assert(o.position.toArray().every(Number.isFinite)));
   if(contact)for(const c of fit.contacts)assert(c.chain.foot.getWorldPosition(new T.Vector3()).distanceTo(c.target)<.02,`${pilot} ${action} fitted contact`);
   else for(const c of fit.contacts.filter(c=>c.socket.name.includes('Stirrup')))assert(c.chain.foot.getWorldPosition(new T.Vector3()).y>=.077,`${pilot} ${action} frame ${frame}: boot stays above road`);
   if(['IDLE','WALK','TROT','RUN'].includes(action))for(const leg of HORSE_LEGS)assert(model.getObjectByName('CR_'+leg+'_Foot')!.getWorldPosition(new T.Vector3()).y>=.09,`${pilot} ${action}: hoof penetrated road`);
  }}animator.mixer.stopAllAction();animator.mixer.uncacheRoot(model);
 }
});
test('horse locomotion has distinct walk footfalls, diagonal trot and gallop suspension',()=>{
 assert.equal(horseGait(0),'IDLE');assert.equal(horseGait(1),'WALK');assert.equal(horseGait(4),'TROT');assert.equal(horseGait(9),'RUN');
 let trotAir=false,gallopAir=false,distinctGallop=false;
 for(let i=0;i<200;i++){
  const walk=horseStride('WALK',i/200).feet,trot=horseStride('TROT',i/200).feet,run=horseStride('RUN',i/200).feet;
  assert(walk.filter(f=>f.stance).length>=2,'walk always supported');
  assert.equal(trot[0].stance,trot[3].stance);assert.equal(trot[1].stance,trot[2].stance);
  trotAir||=trot.every(f=>!f.stance);gallopAir||=run.every(f=>!f.stance);distinctGallop||=run[0].stance!==run[3].stance;
  for(const f of [...walk,...trot,...run])assert(f.y>=.15&&Number.isFinite(f.z));
 }
 assert(trotAir&&gallopAir&&distinctGallop);assert.equal(horseCadence(0,'WALK'),0);assert(horseCadence(71.5,'RUN')<=3.1);
 const c=new CorleoController({...flat,land:()=>true} as unknown as ParkTerrain,{x:0,z:0,heading:0});run(c,1,{...neutral,throttle:1});const phase=c.pose.corleoPhase;assert(phase!>0&&phase!<1);c.advance(0,neutral);assert.equal(c.pose.corleoPhase,phase);
 const frame={seq:1,pose:createPose(),mode:'hover',seat:0,active:true,vehicle:'corleo',pilot:'professional',corleoAction:'TROT',corleoTime:.5,corleoPhase:.9};assert.deepEqual(explorerFrame(frame),frame);
 for(const bad of [-1,1,NaN,Infinity])assert.equal(explorerFrame({...frame,corleoPhase:bad}),undefined);
 const buffer=new ExplorerBuffer();buffer.push({...frame,corleoPhase:.95},100);buffer.push({...frame,seq:2,corleoPhase:.05},200);const wrapped=buffer.sample(280)!.corleoPhase!;assert(Math.min(wrapped,1-wrapped)<1e-8,'stride interpolates through cycle boundary instead of backwards');
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
