import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetPath as resolve} from './testAssets.ts';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3,Scene,SkinnedMesh,Mesh} from 'three';
function rendered(o:any):boolean{return o.visible!==false&&(!o.parent||rendered(o.parent));}
import {Hero,TrafficView} from './actors.ts';
import {createPose,RideController,NEUTRAL_ACTIONS} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
import {CompanionView} from './companionView.ts';
import {DOG_GAITS,gaitCadence} from './dogGait.ts';
import {FallMotion} from './fallMotion.ts';
import {bindCyclist,advanceCyclist} from '../../test-support/cyclist-animation.mjs';
async function mesh(id:string,lod:number){
  const buf=await readFile(resolve('../../exports/glb',id,`${id}_LOD${lod}.glb`)),n=buf.readUInt32LE(12),j=JSON.parse(buf.subarray(20,20+n).toString());
  // Headless geometry/skeleton test; omit texture decoding only. No source asset is modified.
  delete j.images;delete j.textures;delete j.materials;for(const m of j.meshes)for(const p of m.primitives)delete p.material;
  const json=Buffer.from(JSON.stringify(j)),length=Math.ceil(json.length/4)*4,jsonPad=Buffer.alloc(length,32);json.copy(jsonPad);const bin=buf.subarray(20+n),out=Buffer.alloc(20+length+bin.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(length,12);out.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(out,20);bin.copy(out,20+length);
  return new GLTFLoader().parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.length),'');
}
const data=new Map([['DS_Man_01',await mesh('DS_Man_01',0)],['DS_EUC_01',await mesh('DS_EUC_01',1)]]);
const h=new Hero(data);
const hoodie=await mesh('DS_Hoodie_Woman_01',1);data.set('DS_Hoodie_Woman_01',hoodie);

test('inactive fall offsets cannot leave a mounted rider beside the wheel after recovery',()=>{
 for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const){
  const hero=new Hero(data,undefined,id),normal=createPose();Object.assign(normal,{x:12,y:3,z:-40,headingY:1.4});hero.apply(normal);
  const hip=hero.hips!.getWorldPosition(new Vector3()),wheel=hero.vehicle.getWorldPosition(new Vector3());
  const stale={...normal,crashBlend:0,crashMotion:1,crashRelease:.8,crashLateral:-1.5,crashDrop:.4,crashRoll:.6,wheelCrashLateral:.3,wheelCrashLean:.2};
  const original={...stale};
  for(let i=0;i<20;i++)hero.apply(stale);
  assert.deepEqual(stale,original,'rendering must not mutate simulation state');
  assert.ok(hero.hips!.getWorldPosition(new Vector3()).distanceTo(hip)<.00001,id+' hips left beside wheel');
  assert.ok(hero.vehicle.getWorldPosition(new Vector3()).distanceTo(wheel)<.00001,id+' vehicle shifted');
  for(const l of hero.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(hero.pedalTarget(l,0))<.005,id+' boot disconnected from pedal');
 }
});

test('one foot stop plants the outside boot while the support boot remains on the pedal',()=>{
 for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const){
  const hero=new Hero(data,undefined,id),p=createPose();p.stopFoot=1;hero.apply(p);
  for(let i=0;i<2;i++)assert.ok(hero.legs[i].foot.getWorldPosition(new Vector3()).distanceTo(hero.footTarget(i,p))<.008,`${id} stop boot ${i} unreachable`);
  assert.ok(hero.legs[0].foot.getWorldPosition(new Vector3()).x>.3);
  assert.ok(hero.legs[0].foot.getWorldPosition(new Vector3()).y<.15);
  hero.apply(createPose());for(const l of hero.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(hero.pedalTarget(l,0))<.005);
 }
});

test('staged falls release both heroes from the wheel and keep every mesh above sloped ground',t=>{
  let lowest=Infinity;
  for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const)for(const side of [-1,1]){
    const floor=(x:number,z:number)=>.08*x+.04*z;
    const terrain:TerrainSampler={sampleGround(x,z,out){out.height=floor(x,z);out.surface='pavement';out.offCourse=false;Object.assign(out.normal,new Vector3(-.08,1,-.04).normalize());return out;},raycast:()=>null,raycastObstacle:()=>null};
    const hero=new Hero(data,terrain,id),p=createPose();Object.assign(p,{speed:8,naturalMotion:1,rollAngle:side*.3});const f=new FallMotion(p,'collision');
    for(const age of [.05,.2,.4,.6,1,2]){
      f.sample(age,p);hero.apply(p);hero.root.traverse(o=>{
        const m=o as Mesh;if(!m.isMesh||!rendered(m))return;if((m as SkinnedMesh).isSkinnedMesh)(m as SkinnedMesh).skeleton.update();
        for(let i=0;i<m.geometry.attributes.position.count;i++){
          const v=m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld),clearance=v.y-floor(v.x,v.z);
          assert.ok(Number.isFinite(clearance));lowest=Math.min(lowest,clearance);assert.ok(clearance>-.025,`${id} at ${age}s: ${clearance}m below slope`);
        }
      });
    }
    assert.ok(hero.legs.every(l=>l.foot.getWorldPosition(new Vector3()).distanceTo(hero.pedalTarget(l,0))>.3));
    const hip=hero.hips!.getWorldPosition(new Vector3()),head=hero.head!.getWorldPosition(new Vector3());
    t.diagnostic(`${id} side ${side}: settled hip ${(hip.y-floor(hip.x,hip.z)).toFixed(3)}m, head ${(head.y-floor(head.x,head.z)).toFixed(3)}m`);
    assert.ok(hip.y-floor(hip.x,hip.z)<.5,'settled hips should rest near the ground');
    const settled=hero.rider.getWorldPosition(new Vector3());for(let i=0;i<30;i++)hero.apply(p);
    assert.ok(hero.rider.getWorldPosition(new Vector3()).distanceTo(settled)<1e-8);
    hero.apply(createPose());for(const l of hero.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(hero.pedalTarget(l,0))<.005);
    hero.dispose();
  }
  t.diagnostic(`Staged fall minimum deformed mesh clearance ${(lowest*1000).toFixed(2)} mm`);
});
test('both heroes tip toward the fall and release the wheel without stretching their limbs',()=>{
  for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const)for(const side of [-1,1]){
    const hero=new Hero(data,undefined,id),p=createPose();Object.assign(p,{speed:8,naturalMotion:1,rollAngle:side*.3});
    const lengths=[...hero.legs,...hero.arms].map(l=>[l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3())),l.knee.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3()))]);
    const f=new FallMotion(p,'sideways landing');
    for(const time of [.15,.3,.45,.6,1,2]){
      f.sample(time,p);hero.apply(p);
      [...hero.legs,...hero.arms].forEach((l,i)=>{
        const upper=l.upper.getWorldPosition(new Vector3()),joint=l.knee.getWorldPosition(new Vector3()),end=l.foot.getWorldPosition(new Vector3());
        assert.ok(Math.abs(upper.distanceTo(joint)-lengths[i][0])<.001,`${id} stretched upper limb`);
        assert.ok(Math.abs(joint.distanceTo(end)-lengths[i][1])<.001,`${id} stretched lower limb`);
      });
    }
    const head=hero.head!.getWorldPosition(new Vector3()),hip=hero.hips!.getWorldPosition(new Vector3());
    assert.ok((head.x-hip.x)*side>0,`${id} rolls away from the direction of the fall`);
    hero.dispose();
  }
});

test('female hoodie rider stays on both EUC pedals through carving, crouching, jumping and recovery',t=>{
  const female=new Hero(data,undefined,'DS_Hoodie_Woman_01');let error=0,lowest=Infinity;
  for(const [speed,roll,crouch,air] of [[0,0,0,0],[7,.42,0,0],[7,-.42,.5,0],[8,0,1,0],[8,.2,.5,.5],[8,0,.65,0]]){
    const p=createPose();Object.assign(p,{x:12,y:air,z:-7,headingY:.9,speed,rollAngle:roll,riderRoll:roll*.7,crouch,tuck:crouch,airBlend:air?1:0,airHeight:air,landingCompression:air?0:.3});female.apply(p);
    for(const l of female.legs){error=Math.max(error,l.foot.getWorldPosition(new Vector3()).distanceTo(female.pedalTarget(l,p.suspensionOffset)));assert.equal(Math.abs(l.target.x),.195);}
    female.rider.traverse(o=>{const m=o as SkinnedMesh;if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){const pt=m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld);assert.ok(Number.isFinite(pt.x+pt.y+pt.z));lowest=Math.min(lowest,pt.y-p.y);}});
  }
  assert.ok(error<.005,`female boot-to-pedal error ${error}`);assert.ok(lowest>.03,`female foot below wheel ground ${lowest}`);
  const p=createPose();p.crashBlend=1;p.crashDrop=.84;p.crashLateral=.8;p.crashRoll=1.25;p.wheelCrashLean=1.4;female.apply(p);female.apply(createPose());
  for(const l of female.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(female.pedalTarget(l,0))<.005);
  female.dispose();h.apply(createPose());assert.ok(h.rider.visible);t.diagnostic(`female maximum pedal error ${error.toFixed(6)}m`);
});

test('fallen rider skin and EUC stay above flat and sloped pavement, then recover cleanly',t=>{
  let worst=Infinity;
  for(const slope of [0,.12]){
    const floor=(x:number,z:number)=>2+slope*(x+z*.5);
    const terrain:TerrainSampler={sampleGround(x,z,out){out.height=floor(x,z);out.surface='pavement';out.offCourse=false;const n=new Vector3(-slope,1,-slope*.5).normalize();Object.assign(out.normal,n);return out;},raycast:()=>null,raycastObstacle:()=>null};
    const hero=new Hero(data,terrain),meshes:Mesh[]=[];hero.root.traverse(o=>{if((o as Mesh).isMesh)meshes.push(o as Mesh);});
    for(const side of [-1,1])for(const amount of [.08,.25,.5,.8,1]){
      const p=createPose();Object.assign(p,{x:15,z:-24,y:floor(15,-24),headingY:.7,rollAngle:side*.4,riderRoll:side*.3,crashBlend:amount,crashLateral:side*.87*amount,crashDrop:.84*amount,crashForward:.4*amount,crashRoll:side*1.25*amount,crashTumble:.5*amount,wheelCrashLean:side*1.4*amount,crouch:.6});
      hero.apply(p);let lowest=Infinity;
      for(const mesh of meshes){
        if(!rendered(mesh))continue;
        if((mesh as SkinnedMesh).isSkinnedMesh)(mesh as SkinnedMesh).skeleton.update();
        for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          const point=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);
          lowest=Math.min(lowest,point.y-floor(point.x,point.z));
        }
      }
      worst=Math.min(worst,lowest);assert.ok(lowest>-.025,`fallen geometry below pavement: ${lowest}, side ${side}, blend ${amount}, slope ${slope}`);
      assert.ok(lowest<.15,'falling objects should rest near the surface, not levitate');
    }
    const recovered=createPose();recovered.y=2;hero.apply(recovered);
    assert.equal(hero.rider.position.y,hero.mountHeight);assert.equal(hero.vehicle.position.y,0);
    for(const leg of hero.legs)assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(hero.pedalTarget(leg,0))<.005);
  }
  t.diagnostic(`Lowest fallen skin/vehicle clearance ${(worst*1000).toFixed(2)} mm`);
});

test('anatomical spine order reaches the shoulders and the neck shares head stabilization',()=>{
  let parent=h.hips;
  for(const bone of h.spine){assert.equal(bone.parent,parent,'apply spine articulation from pelvis to chest');parent=bone;}
  assert.equal(h.neck!.parent,h.chest);
  for(const shoulder of h.shoulders)assert.equal(shoulder.parent,h.chest);
  const p=createPose();h.apply(p);const neck=h.neck!.quaternion.clone(),head=h.head!.quaternion.clone();
  p.riderPitch=.45;p.riderLookYaw=-.4;p.riderTurnTwist=-.15;h.apply(p);
  assert.ok(h.neck!.quaternion.angleTo(neck)>.06,'the neck must move rather than leaving all gaze correction to Head');
  assert.ok(h.head!.quaternion.angleTo(head)>.06,'the skull still contributes to looking ahead');
});

test('repeated banked crash frames cannot drift the wheel away from either rider',()=>{
  for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const){
    const hero=new Hero(data,undefined,id),p=createPose();
    Object.assign(p,{x:10,y:2,z:-9,headingY:.7,rollAngle:.5,crashBlend:1,crashDrop:.84,crashRoll:1.25,wheelCrashLean:1.4});
    hero.apply(p);const wheel=hero.vehicle.getWorldPosition(new Vector3());
    for(let i=0;i<180;i++)hero.apply(p);
    assert.ok(hero.vehicle.getWorldPosition(new Vector3()).distanceTo(wheel)<1e-6,'ground corrections accumulated sideways');
    hero.apply(createPose());assert.ok(hero.vehicle.position.length()<1e-6);
    for(const leg of hero.legs)assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(hero.pedalTarget(leg,0))<.005);
  }
});

test('shoulders counter a carving transition and load the legs without moving the boots',()=>{
  const p=createPose();h.apply(p);const rest=h.shoulders.map(s=>s.quaternion.clone());
  p.naturalMotion=1;p.rollAngle=-.4;p.riderRoll=-.25;p.bodyHipTilt=-.07;p.bodyHipYaw=-.08;
  p.shoulderL=.09;p.shoulderR=-.06;p.armBank=.25;p.bodyLook=-.3;p.bodyTwist=-.12;h.apply(p);
  h.shoulders.forEach((s,i)=>assert.ok(s.quaternion.angleTo(rest[i])>.05,'clavicle must articulate with arm balance'));
  const lengths=h.legs.map(l=>l.upper.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3())));
  assert.ok(Math.abs(lengths[0]-lengths[1])>.025,'inside and outside legs must carry different flexion');
  for(const leg of h.legs)assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(leg,0))<.005);
});
test('the real tyre remains on the contact plane while the machine banks, with level pedals on a grade',t=>{
  let worst=0;
  for(const roll of [-.6,-.3,0,.3,.6]){
    const p=createPose();p.rollAngle=roll;p.riderRoll=roll*.7;p.groundPitch=-.15;h.apply(p);
    let min=Infinity;
    h.wheel!.traverse(o=>{if((o as Mesh).isMesh){const mesh=o as Mesh,pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i++)min=Math.min(min,mesh.localToWorld(new Vector3().fromBufferAttribute(pos,i)).y);}});
    worst=Math.max(worst,Math.abs(min));assert.ok(Math.abs(min)<.035,`tyre contact error at bank ${roll}: ${min}`);
    assert.equal(h.ground.rotation.x,0,'the firmware keeps pedals level instead of pitching the machine down the road slope');
  }
  t.diagnostic(`maximum rounded-tyre contact error ${(worst*1000).toFixed(1)} mm`);
});

test('Motion 4 articulates all three spine joints while the arms hang independently of the torso hinge',()=>{
  const p=createPose();h.apply(p);
  const spines=h.spine.map(b=>b.quaternion.clone());
  const armDirections=h.arms.map(l=>l.foot.getWorldPosition(new Vector3()).sub(l.upper.getWorldPosition(new Vector3())).normalize());
  p.riderPitch=.45;p.attack=.7;h.apply(p);
  assert.equal(h.spine.length,3,'use the actual three-joint suit skeleton');
  h.spine.forEach((b,i)=>assert.ok(b.quaternion.angleTo(spines[i])>.02,`${b.name} should share the hinge`));
  h.arms.forEach((l,i)=>{
    const direction=l.foot.getWorldPosition(new Vector3()).sub(l.upper.getWorldPosition(new Vector3())).normalize();
    assert.ok(direction.y<-.9,'a relaxed arm should remain predominantly gravity-aligned');
    assert.ok(direction.angleTo(armDirections[i])<.15,'leaning must not swing both hanging arms rigidly with the chest');
  });
});
test('relaxed carving keeps soft elbows, forward knees and planted boots through direction changes',()=>{
  const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
  const c=new RideController(flat),p=createPose();let sway=0,reach=0;
  for(let i=0;i<960;i++){
    c.step(1/120,{...NEUTRAL_ACTIONS,throttle:Math.max(-.2,Math.min(.6,(6-c.snapshot().speed)*.5)),steer:i>180?Math.sin(i/120*1.1)*.65:0});
    c.writePose(p);h.apply(p);sway=Math.max(sway,Math.abs(p.hipSway));reach=Math.max(reach,p.balanceReach);
    for(const arm of h.arms){
      const elbow=arm.knee.getWorldPosition(new Vector3());
      const angle=arm.upper.getWorldPosition(new Vector3()).sub(elbow).angleTo(arm.foot.getWorldPosition(new Vector3()).sub(elbow));
      assert.ok(angle>.5&&angle<2.85,`locked or folded elbow: ${angle}`);
    }
    for(const l of h.legs){
      assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(l,p.suspensionOffset))<.005);
      const hip=l.upper.getWorldPosition(new Vector3()),axis=l.foot.getWorldPosition(new Vector3()).sub(hip).normalize();
      const bend=l.knee.getWorldPosition(new Vector3()).sub(hip);bend.addScaledVector(axis,-bend.dot(axis));
      const forward=new Vector3(0,0,1).transformDirection(h.lean.matrixWorld);
      assert.ok(bend.dot(forward)>.025,'knee should continue to flex forward');
    }
  }
  assert.ok(sway>.015&&reach>.05,'body should actively balance, not hold one frozen pose');
});
test('the actual Motion 4 acceleration, carve, crouch and jump sequence keeps boots on their intended pedal or stop targets',()=>{
  const flat:TerrainSampler={sampleGround(_x,_z,out){out.height=0;out.surface='pavement';out.offCourse=false;Object.assign(out.normal,{x:0,y:1,z:0});return out;},raycast:()=>null,raycastObstacle:()=>null};
  const c=new RideController(flat),p=createPose();let compression=0,height=0,maxError=0;
  for(let i=0;i<840;i++){
    c.step(1/120,{...NEUTRAL_ACTIONS,throttle:i<240?.6:i>650?-.8:0,steer:i>240&&i<360?.65:0,crouch:i>=400&&i<510,hop:i===510});c.writePose(p);h.apply(p);
    compression=Math.max(compression,p.landingCompression);height=Math.max(height,p.airHeight);
    for(let j=0;j<h.legs.length;j++)maxError=Math.max(maxError,h.legs[j].foot.getWorldPosition(new Vector3()).distanceTo(h.footTarget(j,p)));
    for(const b of h.bones)assert.ok([...b.o.position.toArray(),...b.o.quaternion.toArray()].every(Number.isFinite));
  }
  assert.ok(height>1);assert.ok(compression>.7);assert.ok(maxError<.008,`Worst boot drift: ${maxError}`);
});
const cyclistData=new Map([['DS_Cyclist_01',await mesh('DS_Cyclist_01',1)],['DS_Bicycle_01',await mesh('DS_Bicycle_01',1)]]);
const dogData=new Map([['DS_Boerboel_01',await mesh('DS_Boerboel_01',Number(process.env.DOG_TEST_LOD??1))]]);
test('Boerboel has four loopable gaits, moving paws and a stationary root',()=>{
  const dog=new CompanionView(dogData),pose={x:1.3,y:0,z:0,heading:0,pitch:0,roll:0,speed:0,phase:0,time:0,turnRate:0};
  for(const speed of [0,1,3,7]){
    const samples:Vector3[]=[];
    for(let i=0;i<=60;i++){
      dog.apply({...pose,speed,phase:i/60});
      const paw=dog.model.getObjectByName('front_paw_L')!.getWorldPosition(new Vector3());
      assert.ok(paw.toArray().every(Number.isFinite));samples.push(paw);
      assert.ok(paw.y>-.06&&paw.y<.35,`paw height ${paw.y}`);
      assert.deepEqual(dog.root.position.toArray(),[1.3,0,0]);
    }
    assert.ok(samples[0].distanceTo(samples[60])<.002);
    if(speed)assert.ok(Math.max(...samples.map(p=>p.distanceTo(samples[0])))>.1);
  }
});
test('Boerboel paws plant through walk, trot and run instead of skating with the root',t=>{
  for(const speed of [1,3,6.67]){
    const dog=new CompanionView(dogData),p={x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed,phase:0,time:0,turnRate:0};
    let previous:({position:Vector3;contact:number;anchor:Vector3|null}|undefined)[]=[],contacts=0,worst=0;
    for(let f=0;f<360;f++){
      p.z+=speed/120;p.phase+=gaitCadence(speed)/120;p.time+=1/120;dog.apply(p);
      const current=dog.paws.map(paw=>({position:paw.foot.getWorldPosition(new Vector3()),contact:paw.contact,anchor:paw.anchor?.clone()??null}));
      current.forEach((paw,i)=>{
        const prev=previous[i];
        if(prev?.anchor&&paw.anchor&&prev.contact>.999&&paw.contact>.999&&prev.anchor.distanceTo(paw.anchor)<.001){
          contacts++;worst=Math.max(worst,paw.position.distanceTo(prev.position));
        }
      });previous=current;
    }
    assert.ok(contacts>30,`missing stance contacts at ${speed}`);
    assert.ok(worst<.025,`paw sliding at ${speed} m/s: ${worst} m per frame`);
    t.diagnostic(`${speed} m/s: worst planted-pad movement ${(worst*1000).toFixed(2)} mm/frame`);
    const paused=dog.paws.map(paw=>paw.foot.getWorldPosition(new Vector3()));
    for(let i=0;i<60;i++)dog.apply(p);
    dog.paws.forEach((paw,i)=>assert.ok(paw.foot.getWorldPosition(new Vector3()).distanceTo(paused[i])<1e-5,'paused pose should remain stable'));
  }
});

test('Boerboel preserves body height and independent hocks through each full gait',()=>{
  const dog=new CompanionView(dogData);
  const rest=dog.paws.map(p=>[p.upper,p.lower,p.ankle,p.foot].map(b=>b.getWorldPosition(new Vector3())));
  for(const speed of [1,3,6.5]){
    let airborne=0;
    for(let i=0;i<120;i++){
      dog.apply({x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed,phase:(i+.5)/120,time:0,turnRate:0});
      const hip=dog.model.getObjectByName('pelvis')!.getWorldPosition(new Vector3());
      assert.ok(hip.y>.48&&hip.y<.60,`crouched or floating torso at ${speed}: ${hip.y}`);
      const gait=DOG_GAITS[speed===1?1:speed===3?2:3];
      // Inspect the middle of flight, excluding the soft touchdown/lift-off
      // ramp where contact weight is zero although the pad is millimetres up.
      if(gait.offsets.every(offset=>{const t=((i+.5)/120+offset)%1;return t>gait.duty+.025&&t<.975;})){
        airborne++;
        assert.ok(dog.paws.every(p=>p.foot.getWorldPosition(new Vector3()).y>p.restHeight+.005),'flight must visibly lift all four pads');
      }
      dog.paws.forEach((p,j)=>{
        const points=[p.upper,p.lower,p.ankle,p.foot].map(b=>b.getWorldPosition(new Vector3()));
        for(let k=1;k<4;k++)assert.ok(Math.abs(points[k].distanceTo(points[k-1])-rest[j][k].distanceTo(rest[j][k-1]))<.002,'bone length changed');
        assert.ok(points[2].distanceTo(points[3])>.065,'hock/wrist must remain separate from pad');
      });
    }
    assert.equal(airborne>0,speed>1);
  }
});

test('jumping Boerboel releases planted paws and gathers its legs above the running pose',()=>{
  const dog=new CompanionView(dogData);
  const pose={x:0,y:1.2,z:0,heading:0,pitch:0,roll:0,speed:5,phase:.7,time:1,turnRate:0};
  dog.apply(pose);const running=dog.paws.map(p=>p.foot.getWorldPosition(new Vector3()));
  dog.apply({...pose,jumpHeight:1.2,jumpProgress:.5});
  assert.equal(dog.gait,'jump');
  dog.paws.forEach((paw,i)=>{
    assert.equal(paw.contact,0);assert.equal(paw.anchor,null);
    assert.ok(paw.foot.getWorldPosition(new Vector3()).y>running[i].y+.04,`paw ${i} did not gather in flight`);
  });
});

test('the deformed Boerboel skin clears the floor through walk, trot and gallop',t=>{
  const dog=new CompanionView(dogData),meshes:SkinnedMesh[]=[];
  dog.model.traverse(o=>{if((o as SkinnedMesh).isSkinnedMesh)meshes.push(o as SkinnedMesh);});
  const vertex=new Vector3();let lowest=Infinity,lowestPose='';
  for(const speed of [1,3,6.5])for(let phase=0;phase<1;phase+=1/24){
    dog.apply({x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed,phase,time:0,turnRate:0});
    for(const mesh of meshes){
        if(!rendered(mesh))continue;
      mesh.skeleton.update();
      for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld);
        if(vertex.y<lowest){lowest=vertex.y;lowestPose=JSON.stringify({speed,phase,vertex:i,bind:new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).toArray(),joints:Array.from({length:4},(_,k)=>({name:mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(i,k)].name,weight:mesh.geometry.attributes.skinWeight.getComponent(i,k)}))});}
      }
    }
  }
  assert.ok(lowest>-.025,`pad/skin penetrates the floor by ${-lowest} metres: ${lowestPose}`);
  t.diagnostic(`Lowest deformed vertex: ${(lowest*1000).toFixed(2)} mm relative to the rig ground plane`);
});
test('Boerboel skin stays continuous across the shoulder and thigh during a gathered stride',t=>{
  const dog=new CompanionView(dogData),surfaces:{mesh:SkinnedMesh;edges:[number,number][];posed:Vector3[]}[]=[];
  dog.model.traverse(o=>{
    const m=o as SkinnedMesh;if(!m.isSkinnedMesh||!m.geometry.index)return;
    const p=m.geometry.attributes.position,index=m.geometry.index,edges:[number,number][]=[],a=new Vector3(),b=new Vector3();
    for(let i=0;i<index.count;i+=3)for(let k=0;k<3;k++){
      const u=index.getX(i+k),v=index.getX(i+(k+1)%3);
      a.fromBufferAttribute(p,u);b.fromBufferAttribute(p,v);
      // A tiny rest edge must not open into a centimetres-wide seam when bent.
      if(a.distanceTo(b)<.004)edges.push([u,v]);
    }
    surfaces.push({mesh:m,edges,posed:Array.from({length:p.count},()=>new Vector3())});
  });
  let worst=0,detail='';
  for(const speed of [1,3,6.5])for(let f=0;f<24;f++){
    dog.apply({x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed,phase:f/24,time:0,turnRate:0});
    for(const {mesh:m,edges,posed} of surfaces){
      m.skeleton.update();posed.forEach((v,i)=>m.getVertexPosition(i,v));
      for(const [u,v] of edges){const distance=posed[u].distanceTo(posed[v]);if(distance>worst){worst=distance;detail=JSON.stringify({speed,phase:f/24,vertices:[u,v].map(i=>({bind:new Vector3().fromBufferAttribute(m.geometry.attributes.position,i).toArray(),joints:Array.from({length:4},(_,k)=>({bone:m.skeleton.bones[m.geometry.attributes.skinIndex.getComponent(i,k)].name,w:m.geometry.attributes.skinWeight.getComponent(i,k)}))}))});}}
    }
  }
  assert.ok(surfaces.some(s=>s.edges.length>100),'missing dense skin edges');
  assert.ok(worst<.05,`short skin edge opens to ${worst} m: ${detail}`);
  t.diagnostic(`Maximum deformed short edge: ${(worst*1000).toFixed(2)} mm`);
});
test('the screenshot viewer keeps the repaired knees and pedals aligned for a full cycle',()=>{
  const scene=new Scene(),view=new TrafficView(scene,cyclistData);view.update([{id:9,kind:'cyclist',x:0,y:0,z:0,heading:0,speed:0}],0);
  const item=view.items.get(9)!,binding=bindCyclist(item.root,item.mixers[0],cyclistData.get('DS_Cyclist_01')!.animations[0]);
  for(let i=0;i<=120;i++){
    advanceCyclist(binding,i?2*Math.PI*.34*2.5/120:0);scene.updateMatrixWorld(true);
    for(const [side,pedal,sign]of [['Left','R',1],['Right','L',-1]] as const){
      const world=(name:string)=>item.root.getObjectByName(name)!.getWorldPosition(new Vector3());
      const hip=world(side+'UpLeg'),knee=world(side+'Leg'),foot=world(side+'Foot'),axis=foot.clone().sub(hip).normalize(),bend=knee.sub(hip);
      bend.addScaledVector(axis,-bend.dot(axis));assert.ok(bend.z>.025);
      const target=item.root.getObjectByName('Bicycle_Pedal_'+pedal+'_Pivot')!.localToWorld(new Vector3(sign*.045,.1,0));assert.ok(foot.distanceTo(target)<.005);
    }
  }
});
test('exported cyclist knees stay forward and feet follow opposite level pedals through a full revolution',()=>{
  const scene=new Scene(),view=new TrafficView(scene,cyclistData);
  const traffic={id:7,kind:'cyclist' as const,x:3,y:0,z:-25,heading:Math.PI*.6,speed:4.2};
  const step=(Math.PI*2*.34*2.5/traffic.speed)/120;
  for(let f=0;f<=120;f++){
    view.update([traffic],f?step:0);scene.updateMatrixWorld(true);const root=view.items.get(7)!.root;
    const local=(name:string)=>root.worldToLocal(root.getObjectByName(name)!.getWorldPosition(new Vector3()));
    for(const [side,pedal,sign] of [['Left','R',1],['Right','L',-1]] as const){
      const hip=local(side+'UpLeg'),knee=local(side+'Leg'),foot=local(side+'Foot'),axis=foot.clone().sub(hip).normalize();
      const bend=knee.clone().sub(hip).addScaledVector(axis,-knee.clone().sub(hip).dot(axis));
      assert.ok(bend.z>.025,`${side} knee points backwards at ${f}: ${bend.z}`);
      const pivot=root.getObjectByName('Bicycle_Pedal_'+pedal+'_Pivot')!;
      const ankleTarget=pivot.localToWorld(new Vector3(sign*.045,.10,0));
      const error=root.getObjectByName(side+'Foot')!.getWorldPosition(new Vector3()).distanceTo(ankleTarget);
      assert.ok(error<.005,`${side} foot detached from crank at ${f}: ${error}; foot ${foot.toArray()}, target ${root.worldToLocal(ankleTarget).toArray()}, clip ${view.items.get(7)!.clipDuration}`);
      const up=new Vector3(0,1,0).transformDirection(pivot.matrixWorld);assert.ok(up.y>.9999);
    }
  }
});
test('stopped and paused cyclists do not keep pedaling',()=>{
  const view=new TrafficView(new Scene(),cyclistData),traffic={id:1,kind:'cyclist' as const,x:0,y:0,z:0,heading:0,speed:4.2};
  view.update([traffic],.2);const phase=view.items.get(1)!.pedalPhase;
  view.update([traffic],0);assert.equal(view.items.get(1)!.pedalPhase,phase);
  view.update([{...traffic,speed:0}],.5);assert.equal(view.items.get(1)!.pedalPhase,phase);
});
const hip=()=>h.lean.worldToLocal(h.hips!.getWorldPosition(new Vector3()));
const kneeAngle=(i:number)=>{const l=h.legs[i],k=l.knee.getWorldPosition(new Vector3());return l.upper.getWorldPosition(new Vector3()).sub(k).angleTo(l.foot.getWorldPosition(new Vector3()).sub(k));};
test('cruising has relaxed knees and acceleration moves the hips ahead of braking',()=>{
  const p=createPose();h.apply(p);const neutral=hip();assert.ok(kneeAngle(0)<Math.PI-.2);
  p.riderPitch=.5;p.attack=.6;h.apply(p);const drive=hip();
  p.riderPitch=-.5;p.attack=0;h.apply(p);const brake=hip();
  assert.ok(drive.z>neutral.z+.015);assert.ok(brake.z<neutral.z-.09);assert.ok(brake.y<drive.y);
});
test('held tuck visibly folds the torso and lowers hips while feet stay planted',()=>{
  const p=createPose();h.apply(p);const neutral=hip(),head=h.head!.getWorldPosition(new Vector3());
  p.tuck=1;p.crouch=.65;p.riderPitch=.15;h.apply(p);
  assert.ok(hip().y<neutral.y-.24);assert.ok(h.head!.getWorldPosition(new Vector3()).y<head.y-.3);
  for(const l of h.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(l,0))<.005);
});
test('carves open the inside knee and move the two hands differently',()=>{
  const p=createPose();p.rollAngle=.5;p.riderRoll=.32;p.carveStance=.8;h.apply(p);
  const knees=h.legs.map(l=>h.lean.worldToLocal(l.knee.getWorldPosition(new Vector3())));
  const hands=h.arms.map(l=>h.lean.worldToLocal(l.foot.getWorldPosition(new Vector3())));
  assert.ok(Math.abs(knees[0].x)>Math.abs(knees[1].x)+.04);
  assert.ok(hands[1].z>hands[0].z+.10);
});
test('boots follow chassis wobble instead of sliding across its pedals',()=>{
  const p=createPose();p.wobble=.4;p.wobbleFight=.5;p.wobbleSway=.7;p.wobbleYaw=.1;p.wobbleRoll=.06;p.suspensionOffset=-.025;h.apply(p);
  for(const l of h.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(l,p.suspensionOffset))<.005);
});
test('reapplying a blended pose never accumulates skeleton rotation or displacement',()=>{
  const p=createPose();p.crouch=.4;p.tuck=.3;p.rollAngle=-.35;p.riderPitch=.2;p.carveStance=.6;h.apply(p);
  const initial=h.bones.map(b=>({p:b.o.position.clone(),q:b.o.quaternion.clone()}));
  for(let i=0;i<120;i++)h.apply(p);
  h.bones.forEach((b,i)=>{assert.ok(b.o.position.distanceTo(initial[i].p)<1e-6);assert.ok(b.o.quaternion.clone().normalize().angleTo(initial[i].q.clone().normalize())<1e-5,b.o.name);});
});
test('custom hero has both complete IK chains',()=>{assert.equal(h.legs.length,2);assert.equal(h.arms.length,2);});

test('raised arms and deep tucks preserve a relaxed wrist angle relative to each forearm',()=>{
  for(const speed of [1.4,7,16])for(const bank of [-.5,0,.5])for(const crouch of [0,1]){
    const p=createPose();Object.assign(p,{speed,rollAngle:bank,riderRoll:bank*.7,turnIntent:Math.sign(bank)*.8,crouch,tuck:crouch});
    h.apply(p);
    for(const arm of h.arms){
      const rest=h.bones.find(b=>b.o===arm.foot)!;
      assert.ok(arm.foot.quaternion.clone().normalize().angleTo(rest.q.clone().normalize())<.7,'wrist should follow the raised forearm instead of hanging vertically');
    }
    for(const leg of h.legs)assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(leg,0))<.005);
  }
});
test('an idle wobble phase cannot move a straight-riding hero off the pedals',()=>{const p=createPose();p.wobbleSway=1;p.wobble=0;p.x=-90;p.z=-1520;p.headingY=Math.PI;p.riderPitch=.3;h.apply(p);const pos=h.lean.worldToLocal(h.hips!.getWorldPosition(new Vector3()));assert.ok(Math.abs(pos.x)<.01);for(const l of h.legs)assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(h.pedalTarget(l,0))<.035);});
test('suspension moves chassis and planted feet together while the axle stays separate',()=>{
  const p=createPose();p.suspensionOffset=-.04;p.crouch=.4;h.apply(p);
  assert.ok(Math.abs(h.body!.position.y-h.bodyRestY+.04)<1e-6);
  for(const l of h.legs){const target=h.pedalTarget(l,-.04);assert.ok(l.foot.getWorldPosition(new Vector3()).distanceTo(target)<.035);}
});
for(const [name,pitch,roll,crouch]of [['idle',0,0,0],['accelerate',.4,0,.1],['crouch',.35,0,1],['carve',.05,.4,.2]] as const){
  test(`feet remain on the EUC pedals in ${name}`,()=>{
    const p=createPose();p.headingY=Math.PI;p.z=-200;p.riderPitch=pitch;p.wheelPitch=pitch*.15;p.rollAngle=roll;p.riderRoll=roll*.7;p.crouch=crouch;
    h.apply(p);for(const l of h.legs){const actual=l.foot.getWorldPosition(new Vector3()),target=h.pedalTarget(l,0);assert.ok(actual.distanceTo(target)<.035,`${name} foot error ${actual.distanceTo(target)} actual ${actual.toArray()} target ${target.toArray()}`);}
    const pos=h.lean.worldToLocal(h.hips!.getWorldPosition(new Vector3()));assert.ok(Math.abs(pos.x)<.12,`hip lateral ${pos.x}`);assert.ok(pos.y>.65&&pos.y<1.4);
  });
}

test('both heroes lift one boot for a glide while the supporting boot remains on the pedal',()=>{
  for(const id of ['DS_Man_01','DS_Hoodie_Woman_01']){
    const rider=new Hero(data,undefined,id);const p=createPose();p.trickFoot=1;p.speed=2;rider.apply(p);
    const lifted=rider.legs[0].foot.getWorldPosition(new Vector3()),pedal=rider.pedalTarget(rider.legs[0],0);
    assert.ok(lifted.y-pedal.y>.20,`${id} lifted foot clearance`);
    assert.ok(rider.legs[1].foot.getWorldPosition(new Vector3()).distanceTo(rider.pedalTarget(rider.legs[1],0))<.005,`${id} planted support foot`);
    rider.apply(createPose());for(const leg of rider.legs)assert.ok(leg.foot.getWorldPosition(new Vector3()).distanceTo(rider.pedalTarget(leg,0))<.005);
    rider.dispose();
  }
});




test('human recovery envelopes use the loaded mounted mesh dimensions',()=>{
 for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const){const hero=new Hero(data,undefined,id);assert.ok(hero.mountedVolume.radius>.4&&hero.mountedVolume.radius<1);assert.ok(hero.mountedVolume.height>1.6&&hero.mountedVolume.height<2.5);hero.dispose();}
});

test('dog pivot steps lift paws and planted contacts remain stable through a curved path',()=>{
 const dog=new CompanionView(dogData),p={x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed:0,gaitSpeed:.85,phase:0,time:0,turnRate:1.2,lookYaw:.15};
 let lift=0,planted=0;
 for(let i=0;i<240;i++){
  p.heading+=p.turnRate/120;p.time+=1/120;p.phase+=gaitCadence(p.gaitSpeed)/120;dog.apply(p);
  for(const paw of dog.paws){const v=paw.foot.getWorldPosition(new Vector3());lift=Math.max(lift,v.y-paw.restHeight);if(paw.contact>.9&&paw.anchor){assert.ok(Math.hypot(v.x-paw.anchor.x,v.z-paw.anchor.z)<.05);planted++;}}
 }
 assert.ok(lift>.025,'pivot needs visible paw lift');assert.ok(planted>40,'feet need planted stepping contacts');
 const bones=dog.paws.map(paw=>paw.foot.getWorldPosition(new Vector3()));for(let i=0;i<20;i++)dog.apply(p);
 dog.paws.forEach((paw,i)=>assert.ok(paw.foot.getWorldPosition(new Vector3()).distanceTo(bones[i])<1e-8,'paused turn accumulates corrections'));
});

test('contact-phase rider skin reaches the pavement instead of compressing in mid-air',()=>{
 for(const id of ['DS_Man_01','DS_Hoodie_Woman_01'] as const){
  const hero=new Hero(data,undefined,id),p=createPose();p.speed=9;const f=new FallMotion(p,'collision');
  for(const age of [.57,.7,1,2]){f.sample(age,p);hero.apply(p);let lowest=Infinity;
   hero.rider.traverse(o=>{const m=o as Mesh;if(!m.isMesh||!rendered(m))return;if((m as SkinnedMesh).isSkinnedMesh)(m as SkinnedMesh).skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++)lowest=Math.min(lowest,m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld).y);});
   assert.ok(lowest<.06&&lowest>-.025,id+' contact clearance '+lowest);
  }hero.dispose();
 }
});
