import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Quaternion,type Object3D,type SkinnedMesh} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {FallMotion,getUpPose} from './fallMotion.ts';
import {crashKind,crashLimb,crashSample} from '../../../ride-core/src/kimodoCrash.ts';
import {initialCombat} from '../../../ride-core/src/royale/rules.ts';
import {ThreeRiderView} from '../../../ride-core/src/threeRiderView.ts';
import {ThreeRiderView as ElmwoodRiderView} from '../../../elmwood-source/src/detroit/riding/threeRiderView.ts';
import {HUMAN_PROFILE,MASCOT_PROFILE} from '../../../ride-core/src/profiles.ts';

const assets=new URL('../../../store/public/arcade/swoop-detroit/exports/',import.meta.url);
async function model(path:string){
 const b=await readFile(new URL(path,assets)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}


test('crash selection distinguishes momentum and landing, with bounded captured limbs',()=>{
 assert.equal(crashKind('collision',8,0,0),'front');assert.equal(crashKind('collision',-8,0,0),'back');assert.equal(crashKind('collision',2,7,0),'side');assert.equal(crashKind('hard landing',8,0,0),'landing');
 for(let kind=1;kind<=4;kind++)for(let frame=0;frame<=120;frame++){const row=crashSample(kind,frame/120);assert(row.every(Number.isFinite));for(const leg of [false,true])for(const i of [0,1]){const p=crashLimb(kind,frame/120,i,1,leg),mirror=crashLimb(kind,frame/120,1-i,-1,leg);assert(Math.hypot(p.x,p.y,p.z)<=1.001);assert.equal(p.x,-mirror.x);assert.equal(p.y,mirror.y);}}
});

function skinContact(root:Object3D){
 root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);const point=new Vector3();let minimum=Infinity,torso=Infinity,minimumPart='';
 root.traverse(object=>{
  const mesh=object as SkinnedMesh;if(!mesh.isMesh)return;
  for(let parent:Object3D|null=mesh;parent;parent=parent.parent)if(!parent.visible)return;
  if(mesh.isSkinnedMesh)mesh.skeleton.update();
  const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
  const vertices=index?new Set(Array.from(index.array)):Array.from({length:position.count},(_,i)=>i);
  for(const i of vertices){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);minimum=Math.min(minimum,point.y);
   if(!mesh.isSkinnedMesh)continue;
   const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;let weight=-1,bone='';
   for(let k=0;k<4;k++){const w=weights.getComponent(i,k);if(w>weight){weight=w;bone=mesh.skeleton.bones[indices.getComponent(i,k)].name;}}
   if(point.y===minimum)minimumPart=mesh.name+'/'+bone;
   if(/^(Hips|Spine\d*|Chest)$/.test(bone))torso=Math.min(torso,point.y);
  }
 });return{minimum,torso,minimumPart};
}

test('settled fall skin rests on body support, without toes suspending the torso in either view',async t=>{
 const wheel=await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb');
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const rider=await model('rigged-heroes/'+id+'.glb'),mascot=id.startsWith('DS_Mascot_');
  let lowest=Infinity,highestRestingTorso=0;
  for(const hero of [new Hero(new Map([['DS_EUC_01',wheel],[id,rider]]),undefined,id,'kimodo'),new ThreeRiderView(rider,wheel,undefined,mascot?MASCOT_PROFILE:HUMAN_PROFILE),new ElmwoodRiderView(rider,wheel,undefined,mascot?MASCOT_PROFILE:HUMAN_PROFILE)]){
   for(const [reason,speed,bank] of [['collision',8,0],['collision',-8,0],['sideways landing',8,.35],['sideways landing',8,-.35],['hard landing',8,0]] as const){
    const entry={...createPose(),speed,rollAngle:bank},fall=new FallMotion(entry,reason),p=createPose();
    for(const age of [.7,1.1,1.8]){fall.sample(age,p);hero.apply(p);const {minimum,torso}=skinContact(hero.rider);
     lowest=Math.min(lowest,minimum);if(age===1.8)highestRestingTorso=Math.max(highestRestingTorso,torso);
     assert(minimum>=0,`${id} ${hero.constructor.name} ${fall.kind} ${age}: visible skin below ground ${minimum}`);
     if(age===1.8){assert(torso<(mascot?.205:.09),`${id} ${hero.constructor.name} ${fall.kind}: torso suspended ${torso}`);}
    }
   }hero.dispose();
  }t.diagnostic(JSON.stringify({id,lowest,highestRestingTorso,adapters:3}));
 }
});
test('four Kimodo falls and mirrored spills fit all five real rigs and recover without stretched limbs',async t=>{
 const data=new Map([['DS_EUC_01',await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb')]]);
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  data.set(id,await model('rigged-heroes/'+id+'.glb'));const hero=new Hero(data,undefined,id,'kimodo');let worst=0,lowest=Infinity;
  for(const [reason,speed,bank] of [['collision',8,0],['collision',-6,0],['sideways landing',6,-.4],['sideways landing',6,.4],['hard landing',8,0]] as const){
   const entry={...createPose(),headingY:0,speed,rollAngle:bank};hero.apply(entry);const lengths=[...hero.legs,...hero.arms].map(l=>l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3()))),fall=new FallMotion(entry,reason),p=createPose();let previous:Vector3|undefined;
   for(let frame=0;frame<=420;frame++){const age=frame/120;fall.sample(Math.min(age,2),p);if(age>2)getUpPose({...p},(age-2)/1.5,p,true);hero.apply(p);const hip=hero.hips!.getWorldPosition(new Vector3());if(previous)worst=Math.max(worst,hip.distanceTo(previous));previous=hip;
    hero.rider.traverse(o=>assert([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite)));
    [...hero.legs,...hero.arms].forEach((l,i)=>{assert(Math.abs(l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3()))-lengths[i])<1e-5);if(age>.6&&age<2)lowest=Math.min(lowest,l.foot.getWorldPosition(new Vector3()).y);});
   }
  }
  t.diagnostic(JSON.stringify({id,worst,lowest}));assert(worst<.22,id+' hip continuity');assert(lowest>-.13,id+' contacts above floor');hero.dispose();
 }
});

test('combat get-up blends into ground-height standing without a last-frame drop',async t=>{
 const wheel=await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb');
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const rider=await model('rigged-heroes/'+id+'.glb'),mascot=id.startsWith('DS_Mascot_');let worst=0;
  for(const hero of [new Hero(new Map([['DS_EUC_01',wheel],[id,rider]]),undefined,id,'kimodo'),new ThreeRiderView(rider,wheel,undefined,mascot?MASCOT_PROFILE:HUMAN_PROFILE),new ElmwoodRiderView(rider,wheel,undefined,mascot?MASCOT_PROFILE:HUMAN_PROFILE)]){
   for(const reason of ['collision','dog power-up','hard landing']){
    const fall=new FallMotion({...createPose(),speed:8},reason),rest=createPose(),p=createPose();fall.sample(2,rest);
    rest.footMode=2;rest.footBlend=1;rest.crashLateral=rest.crashForward=0;let previous:Vector3|undefined;
    for(let frame=50;frame<=120;frame++){
     getUpPose(rest,Math.min(1,frame/108),p,false);p.footStagger=frame<108?1:0;
     if(frame>=108)for(const key of Object.keys(p) as (keyof typeof p)[])if(key.startsWith('crash')||key.startsWith('wheelCrash'))p[key]=0;
     hero.apply(p);const hip=hero.hips!.getWorldPosition(new Vector3());
     if(previous)worst=Math.max(worst,hip.distanceTo(previous));previous=hip;
    }
   }hero.dispose();
  }
  t.diagnostic(JSON.stringify({id,combatGetUpWorstStep:worst}));assert(worst<.065,`${id} combat rise must remain continuous`);
 }
});

test('recovery supports actual skins and rotates with the ground heading for all riders',async t=>{
 const wheel=await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb');
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const rider=await model('rigged-heroes/'+id+'.glb'),mascot=id.includes('Mascot');let lowest=Infinity;
  for(const hero of [new Hero(new Map([['DS_EUC_01',wheel],[id,rider]]),undefined,id,'kimodo'),new ThreeRiderView(rider,wheel,undefined,mascot?MASCOT_PROFILE:HUMAN_PROFILE),new ElmwoodRiderView(rider,wheel,undefined,mascot?MASCOT_PROFILE:HUMAN_PROFILE)]){
   for(const side of [-1,1]){
    const samples=new Map<number,Vector3[]>();
    for(const heading of [0,Math.PI/2]){
     const rest={...createPose(),naturalMotion:1,headingY:heading,speed:8,rollAngle:side*.35};new FallMotion(rest,'sideways landing').sample(2,rest);
     Object.assign(rest,{crashLateral:side*.6,crashForward:.3,wheelCrashForward:0,wheelCrashLateral:0});
     for(const time of [.2,.3,.4,.5,.65,.8,.9,.98]){
      const p=createPose();getUpPose(rest,time,p,true);hero.apply(p);const contact=skinContact(hero.rider);lowest=Math.min(lowest,contact.minimum);
      assert(contact.minimum>=-.015,`${id} ${hero.constructor.name} ${side} ${time}: recovery penetrates floor ${contact.minimum} ${contact.minimumPart}`);
      if(time>=.4&&time<=.8){
       const pelvis=hero.hips!.getWorldPosition(new Vector3());
       assert(pelvis.y>=.48*hero.motionScale,`${id}: support reach collapsed the pelvis below a crouch`);
       for(const leg of hero.legs){const hip=leg.upper.getWorldPosition(new Vector3()),knee=leg.knee.getWorldPosition(new Vector3());
        assert(knee.y-hip.y<.18*hero.motionScale,`${id} ${side} ${time}: knee folds above the hip`);
       }
      }
      const joints=[hero.hips!,...hero.arms.map(l=>l.foot),...hero.legs.map(l=>l.foot)].map(o=>o.getWorldPosition(new Vector3()));
      if(heading===0)samples.set(time,joints);else joints.forEach((point,i)=>assert(point.distanceTo(samples.get(time)![i].clone().applyAxisAngle(new Vector3(0,1,0),heading))<.002,`${id} recovery changes with heading`));
     }
    }
   }hero.dispose();
  }t.diagnostic(JSON.stringify({id,recoverySkinMinimum:lowest}));
 }
});

test('all five skins keep the thigh and shin on one anatomical hinge throughout falls and recovery',async t=>{
 const wheel=await model('glb/DS_EUC_01/DS_EUC_01_LOD1.glb');
 for(const id of ['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01']){
  const rider=await model('rigged-heroes/'+id+'.glb');let worstHinge=0,worstKneeHeight=-Infinity;
  for(const hero of [new Hero(new Map([['DS_EUC_01',wheel],[id,rider]]),undefined,id,'kimodo'),new ThreeRiderView(rider,wheel,undefined,id.includes('Mascot')?MASCOT_PROFILE:HUMAN_PROFILE),new ElmwoodRiderView(rider,wheel,undefined,id.includes('Mascot')?MASCOT_PROFILE:HUMAN_PROFILE)]){
   // Hero frames its volume using an initial mounted pose in the constructor.
   // Measure the anatomical hinge from saved authored bones, not that IK pose.
   hero.bones.forEach(({o,p,q})=>{o.position.copy(p);o.quaternion.copy(q);});hero.root.updateMatrixWorld(true);
   const hinges=hero.legs.map(l=>{
    const a=l.upper.getWorldPosition(new Vector3()),b=l.knee.getWorldPosition(new Vector3()),c=l.foot.getWorldPosition(new Vector3());
    const normal=b.sub(a).cross(c.sub(l.knee.getWorldPosition(new Vector3()))).normalize();
    if(normal.x<0)normal.negate();
    return {upper:normal.clone().applyQuaternion(l.upper.getWorldQuaternion(new Quaternion()).invert()),shin:normal.clone().applyQuaternion(l.knee.getWorldQuaternion(new Quaternion()).invert())};
   });
   const check=(p:ReturnType<typeof createPose>,label:string)=>{
    hero.apply(p);
    for(let i=0;i<hero.legs.length;i++){
     const l=hero.legs[i],h=hinges[i];
     const a=h.upper.clone().applyQuaternion(l.upper.getWorldQuaternion(new Quaternion())),b=h.shin.clone().applyQuaternion(l.knee.getWorldQuaternion(new Quaternion()));
     const angle=a.angleTo(b)*180/Math.PI;worstHinge=Math.max(worstHinge,angle);
     // The final on-foot handoff deliberately restores the existing walk's
     // authored joint frames; continuity of that release is checked separately.
     if(p.footMode!==2||p.crashRecovery<=.8)assert(angle<.1,`${id} ${hero.constructor.name} ${label}: knee axial mismatch ${angle.toFixed(2)} degrees`);
     if(p.crashRecovery>=.4&&p.crashRecovery<=.8){
      const high=l.knee.getWorldPosition(new Vector3()).y-l.upper.getWorldPosition(new Vector3()).y;
      worstKneeHeight=Math.max(worstKneeHeight,high/hero.motionScale);
      assert(high<.025*hero.motionScale,`${id} ${label}: knee folds above supported hip by ${high}`);
     }
    }
   };
   for(const side of [-1,1])for(const heading of [0,Math.PI/2])for(const reason of ['collision','sideways landing','hard landing']){
    const rest={...createPose(),naturalMotion:1,headingY:heading,speed:8,rollAngle:side*.35},fall=new FallMotion(rest,reason),p=createPose();
    for(const age of [.1,.3,.5,.75,1.1,1.8]){fall.sample(age,p);check(p,reason+' fall '+age);}
    fall.sample(2,rest);Object.assign(rest,{crashLateral:side*.6,crashForward:.3,wheelCrashForward:0,wheelCrashLateral:0});
    for(const mounted of [true,false]){
     const start={...rest,footMode:mounted?0:2,footBlend:mounted?0:1};
     for(const phase of [.05,.15,.25,.4,.5,.65,.8,.9,.98]){getUpPose(start,phase,p,mounted);check(p,reason+' recovery '+phase+' mounted='+mounted);}
    }
   }
   hero.dispose();
  }
  t.diagnostic(JSON.stringify({id,worstHingeDegrees:worstHinge,worstKneeAboveHipScaled:worstKneeHeight}));
 }
});
