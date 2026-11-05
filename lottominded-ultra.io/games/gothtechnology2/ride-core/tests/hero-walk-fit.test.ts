import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {applyOnFootRider,applyKimodoLean,applyKimodoRiding} from '../src/onFootRider.ts';
import {gaitScale} from '../src/footAnimation.ts';
import {footFields} from '../src/onFoot.ts';

// Decode the real shipped meshes/skeletons without textures or a browser GPU.
const base=process.env.HERO_ASSET_DIR??fileURLToPath(new URL('../../store/public/arcade/swoop-detroit/exports/rigged-heroes/',import.meta.url));
async function load(id:string){
 const b=await readFile(`${base}/${id}.glb`),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}

for(const walkStyle of ['tactical','kimodo'] as const)test(`${walkStyle}: all five shipped heroes keep feet above ground and elbows bent through walk/run cycles`,async t=>{
 if(!process.env.HERO_ASSET_DIR&&!existsSync(base)){t.skip('Packaged hero assets required; set HERO_ASSET_DIR to the review exports/rigged-heroes directory.');return;}
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const asset=await load(id),root=new T.Group(),ground=new T.Group(),lean=new T.Group(),vehicle=new T.Group(),rider=asset.scene;
  root.add(ground);ground.add(lean);lean.add(vehicle,rider);
  if(asset.animations[0]){const mixer=new T.AnimationMixer(rider);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);}
  const bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];
  rider.traverse(o=>{if((o as T.Bone).isBone)bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
  const rig={walkStyle,riderId:id,root,ground,lean,vehicle,rider,bones,mountHeight:.25,motionScale:id.includes('Mascot')?.48:1};
  root.updateMatrixWorld(true);
  const lengths=['Left','Right'].map(side=>{const a=rider.getObjectByName(side+'UpLeg')!.getWorldPosition(new T.Vector3()),b=rider.getObjectByName(side+'Leg')!.getWorldPosition(new T.Vector3()),c=rider.getObjectByName(side+'Foot')!.getWorldPosition(new T.Vector3());return a.distanceTo(b)+b.distanceTo(c);});
  const cycleScale=gaitScale((lengths[0]+lengths[1])/2);
  const pedalWidth=Math.abs(rider.getObjectByName('LeftFoot')!.getWorldPosition(new T.Vector3()).x-rider.getObjectByName('RightFoot')!.getWorldPosition(new T.Vector3()).x);
  const p={...footFields(),footMode:2,footBlend:1,x:0,y:0,z:0,headingY:0,speed:0,airHeight:0,airBlend:0,velocityX:0,velocityZ:0,rollAngle:0,groundPitch:0,groundRoll:0,stopFoot:0};
  for(const speed of [0,2.35,5.4,-2.05])for(let i=0;i<24;i++){
   Object.assign(p,{speed,footCycle:i/24,footPhase:i/24,footTime:i/24});applyOnFootRider(rig,p);
   for(const side of ['Left','Right']){
    const foot=rider.getObjectByName(side+'Foot')!.getWorldPosition(new T.Vector3());
    assert(foot.y>-.03,`${id}: ${side} foot below floor at ${speed}/${i}`);
    const a=rider.getObjectByName(side+'Arm')!.getWorldPosition(new T.Vector3()),b=rider.getObjectByName(side+'ForeArm')!.getWorldPosition(new T.Vector3()),c=rider.getObjectByName(side+'Hand')!.getWorldPosition(new T.Vector3());
    const elbow=b.clone().sub(a).angleTo(c.clone().sub(b));assert(elbow>.15&&elbow<(speed>3.2?2.45:1.4),`${id}: rigid or overbent elbow ${elbow}`);
   }
   for(const b of bones)assert([...b.o.quaternion.toArray(),...b.o.position.toArray()].every(Number.isFinite),id+' invalid bone transform');
  }
  // Exercise every direction and low stance on the actual differently sized rigs.
  for(const posture of ['stand','crouch','prone'] as const)for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5])for(let i=0;i<24;i++){
   Object.assign(p,{speed:posture==='stand'?1.5:.6,velocityX:Math.sin(angle),velocityZ:Math.cos(angle),footCrouch:posture==='crouch'?1:0,footProne:posture==='prone'?1:0,footCycle:i/24*cycleScale,footTime:i/24});
   applyOnFootRider(rig,p);
   for(const side of ['Left','Right']){
    assert(rider.getObjectByName(side+'Foot')!.getWorldPosition(new T.Vector3()).y>-.03,`${id}: ${posture} direction ${angle} foot penetrates ground`);
    const a=rider.getObjectByName(side+'UpLeg')!.getWorldPosition(new T.Vector3()),b=rider.getObjectByName(side+'Leg')!.getWorldPosition(new T.Vector3()),c=rider.getObjectByName(side+'Foot')!.getWorldPosition(new T.Vector3());
    assert(Math.abs(a.distanceTo(b)+b.distanceTo(c)-lengths[side==='Left'?0:1])<.0001,`${id}: stretched leg`);
    if(posture==='prone')assert(b.y<a.y+.04,`${id}: crawl knee folds upward above the pelvis ${a.y}/${b.y}/${c.y}`);
   }
   for(const b of bones)assert([...b.o.quaternion.toArray(),...b.o.position.toArray()].every(Number.isFinite),`${id}: invalid ${posture} direction pose`);
  }
  Object.assign(p,{velocityX:0,velocityZ:0,footCrouch:0,footProne:0});
  // Observe the actual retargeted joints, including the phase seam. A planted
  // knee must retain flex, and the torso must not snap when the capture loops.
  const poses:T.Quaternion[][]=[];
  const hipHeights:number[]=[],stepWidths:number[]=[];
  const handTravel:number[][]=[[],[]];
  for(let i=0;i<=96;i++){
   Object.assign(p,{speed:1.5275,footCycle:i/96*cycleScale,footPhase:i/96,footTime:i/96});applyOnFootRider(rig,p);
   poses.push(['Hips','Spine','LeftArm','RightArm','LeftLeg','RightLeg'].map(name=>rider.getObjectByName(name)!.getWorldQuaternion(new T.Quaternion())));
   hipHeights.push(rider.getObjectByName('Hips')!.getWorldPosition(new T.Vector3()).y);
   stepWidths.push(Math.abs(rider.getObjectByName('LeftFoot')!.getWorldPosition(new T.Vector3()).x-rider.getObjectByName('RightFoot')!.getWorldPosition(new T.Vector3()).x));
   for(const side of ['Left','Right']){
    const a=rider.getObjectByName(side+'UpLeg')!.getWorldPosition(new T.Vector3()),b=rider.getObjectByName(side+'Leg')!.getWorldPosition(new T.Vector3()),c=rider.getObjectByName(side+'Foot')!.getWorldPosition(new T.Vector3());
    assert(b.clone().sub(a).angleTo(c.clone().sub(b))>.2,`${id}: straight locked knee`);
    const shoulder=rider.getObjectByName(side+'Arm')!.getWorldPosition(new T.Vector3()),elbow=rider.getObjectByName(side+'ForeArm')!.getWorldPosition(new T.Vector3()),hand=rider.getObjectByName(side+'Hand')!.getWorldPosition(new T.Vector3());
    assert(elbow.clone().sub(shoulder).angleTo(hand.clone().sub(elbow))>.15,`${id}: captured walking arm locks straight`);
    const palm=rider.getObjectByName(side+'HandMiddle1');
    if(palm)assert(palm.getWorldPosition(new T.Vector3()).sub(hand).angleTo(hand.clone().sub(elbow))<.2,`${id}: hand hangs from the bent wrist instead of following the forearm`);
    handTravel[side==='Left'?0:1].push(hand.z-shoulder.z);
    if(id.includes('Mascot')){
     const outward=side==='Left'?1:-1;
     assert((hand.x-shoulder.x)*outward>.025,`${id}: walking hand clips inward into the jacket`);
     assert((elbow.x-shoulder.x)*outward>.018,`${id}: elbow is trapped against the torso`);
     assert(elbow.clone().sub(shoulder).angleTo(hand.clone().sub(elbow))<.75,`${id}: walking arm stays curled into a running pose`);
    }
    // Forward locomotion blends the installed Manny capture with TacticalOnFoot.
    // Validate its contact, counterbalance and continuity below rather than
    // requiring every arm sample to equal the older unblended source clip.
   }
   if(i===0||i===48){const footLead=rider.getObjectByName('LeftFoot')!.getWorldPosition(new T.Vector3()).z-rider.getObjectByName('RightFoot')!.getWorldPosition(new T.Vector3()).z;
    const handLead=handTravel[0][i]-handTravel[1][i];
    assert(footLead*handLead<0,`${id}: arm leads with the same leg instead of counterbalancing it`);
   }
  }
  const hipTravel=Math.max(...hipHeights)-Math.min(...hipHeights),legLength=(lengths[0]+lengths[1])/2;
  t.diagnostic(JSON.stringify({id,hipTravel,legLength}));
  assert(hipTravel<.10*legLength,`${id}: pelvis drops into a squat between steps (${hipTravel} m)`);
  assert(Math.max(...stepWidths)<pedalWidth*.92,`${id}: walking still uses the wide pedal stance`);
  t.diagnostic(JSON.stringify({id,walkStyle,handTravel:handTravel.map(hand=>Math.max(...hand)-Math.min(...hand)),legLength}));
   for(const hand of handTravel)assert(Math.max(...hand)-Math.min(...hand)>.20*(lengths[0]+lengths[1])/2,`${id}: arm swing is barely visible`);
  for(let j=0;j<poses[0].length;j++){
   assert(poses[0][j].angleTo(poses[96][j])<.005,`${id}: joint pops at the walking loop seam`);
   for(let i=1;i<poses.length;i++)assert(poses[i-1][j].angleTo(poses[i][j])<.18,`${id}: abrupt joint ${j} change at phase ${i}/96: ${poses[i-1][j].angleTo(poses[i][j])}`);
  }
  // A stationary hop must still counterbalance with the arms. This used to
  // multiply the capture by zero ground speed and leave both arms hanging.
  const armAngles:number[]=[];
  for(let i=0;i<30;i++){
   Object.assign(p,{speed:0,footCycle:0,footTime:4+i/60,footJump:i<9?1:2});applyOnFootRider(rig,p);
   const a=rider.getObjectByName('LeftArm')!.getWorldPosition(new T.Vector3()),b=rider.getObjectByName('LeftForeArm')!.getWorldPosition(new T.Vector3());
   armAngles.push(Math.atan2(b.z-a.z,a.y-b.y));
  }
  assert(Math.max(...armAngles)-Math.min(...armAngles)>.05,`${id}: stationary jump has frozen upper arms`);
 }
});

test('Kimodo athletic: every hero ducks and leans through hips, knees, chest and head with planted feet',async()=>{
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const asset=await load(id),root=new T.Group(),ground=new T.Group(),lean=new T.Group(),vehicle=new T.Group(),rider=asset.scene;
  root.add(ground);ground.add(lean);lean.add(vehicle,rider);
  if(asset.animations[0]){const mixer=new T.AnimationMixer(rider);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);}
  const bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];rider.traverse(o=>{if((o as T.Bone).isBone)bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
  const rig={walkStyle:'kimodo' as const,root,ground,lean,vehicle,rider,bones,mountHeight:.25,motionScale:id.includes('Mascot')?.48:1};root.updateMatrixWorld(true);
  const p={...footFields(),footMode:2,footBlend:1,x:0,y:0,z:0,headingY:0,speed:0,airHeight:0,airBlend:0,velocityX:0,velocityZ:0,rollAngle:0,groundPitch:0,groundRoll:0,stopFoot:0};
  const at=(name:string)=>rider.getObjectByName(name)!.getWorldPosition(new T.Vector3());
  applyOnFootRider(rig,p);const standing=at('Hips').y;
  const heights:number[]=[];
  for(let i=0;i<=30;i++){p.footCrouch=i/30;applyOnFootRider(rig,p);heights.push(at('Hips').y);}
  assert(standing-heights.at(-1)!>.12*rig.motionScale,id+' duck is too shallow');
  for(let i=1;i<heights.length;i++)assert(Math.abs(heights[i]-heights[i-1])<.08*rig.motionScale,id+' duck snaps');
  for(const crouch of [0,1])for(const side of [-1,1]){
   p.footCrouch=crouch;applyOnFootRider(rig,p);
   const before=['LeftFoot','RightFoot','LeftLeg','RightLeg','Hips','Spine'].map(at);
   applyKimodoLean(rig,side,p);const after=['LeftFoot','RightFoot','LeftLeg','RightLeg','Hips','Spine'].map(at);
   for(let i=0;i<2;i++)assert(before[i].distanceTo(after[i])<.0001,id+' lean moved a planted foot');
   assert((after[4].x-before[4].x)*-side>.015*rig.motionScale,id+' pelvis does not shift with lean');
   assert(Math.max(before[2].distanceTo(after[2]),before[3].distanceTo(after[3]))>.008*rig.motionScale,id+' knees remain rigid during whole-body lean');
   assert((after[5].x-before[5].x)*-side>.025*rig.motionScale,id+' chest does not follow lean');
   for(const b of bones)assert([...b.o.quaternion.toArray(),...b.o.position.toArray()].every(Number.isFinite),id+' invalid lean');
  }
  p.footCrouch=0;
  for(const rollAngle of [-.4,0,.4])for(const brakeAmount of [0,1]){
   applyOnFootRider(rig,p);const feet=['LeftFoot','RightFoot'].map(at);
   applyKimodoRiding(rig,{...p,footMode:0,footBlend:0,speed:12,rollAngle,riderPitch:brakeAmount?-.2:.25,brakeAmount});
   for(let i=0;i<2;i++)assert(feet[i].distanceTo(at(i?'RightFoot':'LeftFoot'))<.0001,id+' riding capture lost pedal contact');
   for(const b of bones)assert([...b.o.quaternion.toArray(),...b.o.position.toArray()].every(Number.isFinite),id+' invalid riding pose');
  }
 }
});

