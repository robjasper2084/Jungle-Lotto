import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {applyOnFootRider} from '../src/onFootRider.ts';
import {footFields,footState,stepOnFoot} from '../src/onFoot.ts';
import {sampleKimodoProne,KIMODO_PRONE} from '../src/kimodoProne.ts';
import {stepPronePhase,PRONE_DOWN_SECONDS,PRONE_UP_SECONDS} from '../src/kimodoProneTiming.ts';
import type {TerrainSampler} from '../src/terrain.ts';

const terrain:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
const pose=()=>({...footFields(),footMode:2,footBlend:1,x:0,y:0,z:0,headingY:0,speed:0,airHeight:0,airBlend:0,velocityX:0,velocityZ:0,rollAngle:0,groundPitch:0,groundRoll:0,stopFoot:0});

test('prone is a bounded reversible action with a stationary hold instead of a loop',()=>{
 let phase=0;for(let i=0;i<130;i++)phase=stepPronePhase(phase,true,1/120);
 assert.equal(phase,1);assert.deepEqual(sampleKimodoProne(1),sampleKimodoProne(4));
 assert.equal(stepPronePhase(1,true,3),1);assert.equal(stepPronePhase(0,false,3),0);
 assert(Math.abs(stepPronePhase(.7,false,.11)-.6)<1e-10);
 assert.equal(stepPronePhase(0,true,PRONE_DOWN_SECONDS),1);
 assert.equal(stepPronePhase(1,false,PRONE_UP_SECONDS),0);
 assert.equal(KIMODO_PRONE.loop,false);assert.match(KIMODO_PRONE.sourceSha256,/^[0-9a-f]{64}$/);
 for(let i=0;i<=1000;i++)assert(sampleKimodoProne(i/1000).every(Number.isFinite));
});

test('knee and palm support pauses crawl travel, then resumes crawling and respects a low ceiling',()=>{
 const s=footState(),p=pose();s.mode=2;
 const step=(n:number,prone:boolean,throttle=0,t=terrain)=>{for(let i=0;i<n;i++)stepOnFoot(s,p,t,1/120,{throttle,steer:0,prone,facingYaw:.4});};
 step(45,true,1);const supportZ=p.z;step(40,true,1);
 assert.equal(p.z,supportZ,'knees and palms slide during the supported middle');
 step(65,true);assert.equal(p.footProne,1);const start=p.z;
 step(120,true,1);assert(p.z>start+.4,'settled prone must retain directional crawl');
 assert.equal(p.headingY,.4,'aim-facing heading remains controlled');
 const saved={s:structuredClone(s),p:structuredClone(p)};
 step(30,false);assert(p.footProne>.5&&p.footProne<1,'rise must retrace the descent');
 const copy=structuredClone(saved);for(let i=0;i<30;i++)stepOnFoot(copy.s,copy.p,terrain,1/120,{throttle:0,steer:0,prone:false,facingYaw:.4});
 assert.deepEqual(p,copy.p,'serialized phase must reproduce the transition');
 p.footProne=1;step(180,false,0,{...terrain,raycastObstacle:()=>0});assert.equal(p.footProne,1,'low overhead cover must prevent rising');
 step(150,false);assert.equal(p.footProne,0);
});

async function rig(id:string){
 const b=await readFile(new URL('../../store/public/arcade/swoop-detroit/exports/rigged-heroes/'+id+'.glb',import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 const asset=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),''),root=new T.Group(),ground=new T.Group(),lean=new T.Group(),vehicle=new T.Group(),rider=asset.scene;
 root.add(ground);ground.add(lean);lean.add(vehicle,rider);
 if(asset.animations[0]){const mixer=new T.AnimationMixer(rider);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);}
 const bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];rider.traverse(o=>{if((o as T.Bone).isBone)bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
 root.updateMatrixWorld(true);
 return{walkStyle:'kimodo' as const,riderId:id,root,ground,lean,vehicle,rider,bones,mountHeight:.25,motionScale:id.includes('Mascot')?.48:1};
}

test('the captured tactical laydown remains finite, grounded, continuous and held across all five rigs',async t=>{
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const h=await rig(id),p=pose(),at=(name:string)=>h.rider.getObjectByName(name)!.getWorldPosition(new T.Vector3());
  applyOnFootRider(h,p);const standing=at('Hips').y;
  const limbNames=[['LeftUpLeg','LeftLeg','LeftFoot'],['RightUpLeg','RightLeg','RightFoot'],['LeftArm','LeftForeArm','LeftHand'],['RightArm','RightForeArm','RightHand']];
  const lengths=limbNames.map(([a,b,c])=>at(a).distanceTo(at(b))+at(b).distanceTo(at(c)));
  const observed=['Hips','Spine','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftHand','RightHand'];
  let previous=observed.map(at),maxStep=0,minPoint=Infinity;
  for(let i=1;i<=120;i++){
   p.footProne=i/120;p.footTime=i/120*PRONE_DOWN_SECONDS;applyOnFootRider(h,p);
   const next=observed.map(at);next.forEach((v,k)=>{maxStep=Math.max(maxStep,v.distanceTo(previous[k]));minPoint=Math.min(minPoint,v.y);});previous=next;
   for(const b of h.bones)assert([...b.o.position.toArray(),...b.o.quaternion.toArray()].every(Number.isFinite),id+' invalid pose');
   limbNames.forEach(([a,b,c],k)=>assert(Math.abs(at(a).distanceTo(at(b))+at(b).distanceTo(at(c))-lengths[k])<1e-5,id+' stretched a limb'));
  }
  assert(at('Hips').y<standing*.75,id+' final pose never reaches the ground');
  assert(maxStep<.13*Math.max(.5,h.motionScale),id+' frame jumps during the descent: '+maxStep);
  assert(minPoint>-.025,id+' knee, hand or ankle goes through the floor: '+minPoint);
  const hold=h.bones.map(b=>[...b.o.position.toArray(),...b.o.quaternion.toArray()]);p.footTime=40;p.footCycle=17.3;applyOnFootRider(h,p);
  h.bones.forEach((b,i)=>{const values=[...b.o.position.toArray(),...b.o.quaternion.toArray()];values.forEach((v,k)=>assert(Math.abs(v-hold[i][k])<1e-9,id+' stationary prone loops or drifts'));});
  for(let i=119;i>=0;i--){p.footProne=i/120;p.footTime+=PRONE_UP_SECONDS/120;applyOnFootRider(h,p);const next=observed.map(at);next.forEach((v,k)=>assert(v.distanceTo(previous[k])<.13*Math.max(.5,h.motionScale),id+' rise snaps'));previous=next;}
  t.diagnostic(JSON.stringify({id,maxFrameStep:maxStep,lowestJoint:minPoint}));
 }
});
