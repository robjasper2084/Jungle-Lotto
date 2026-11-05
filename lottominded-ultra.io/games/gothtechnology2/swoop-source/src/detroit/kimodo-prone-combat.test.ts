import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Quaternion,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {FallMotion} from './fallMotion.ts';
import {CombatRig} from './royale/combatRig.ts';
import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './royale/equipment.ts';
import {initialCombat} from '../../../ride-core/src/royale/rules.ts';

const assets=new URL('../../../store/public/arcade/swoop-detroit/exports/',import.meta.url);
async function model(path:string){
 const b=await readFile(new URL(path,assets)),n=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+n));
 delete j.images;delete j.textures;delete j.samplers;j.materials=(j.materials??[]).map((m:{name:string})=>({name:m.name}));
 let json=JSON.stringify(j);while(Buffer.byteLength(json)%4)json+=' ';
 const bytes=Buffer.from(json),chunk=b.subarray(20+n),out=Buffer.alloc(20+bytes.length+chunk.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(bytes.length,12);out.writeUInt32LE(0x4e4f534a,16);bytes.copy(out,20);chunk.copy(out,20+bytes.length);
 return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
}
const riderIds=['DS_Armored_Rider_01','DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01'];
async function fixtures(){
 const models=new Map(await Promise.all(['DS_EUC_01',...riderIds].map(async id=>[id,await model(id==='DS_EUC_01'?'glb/DS_EUC_01/DS_EUC_01_LOD1.glb':'rigged-heroes/'+id+'.glb')] as const)));
 const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await model('polish/royale-equipment/'+kind+'.glb')] as const))),await model('polish/royale-equipment/repair-use.glb'));
 return{models,library};
}
function palms(hero:Hero){
 return hero.arms.map((arm,i)=>({wrist:arm.foot.getWorldPosition(new Vector3()),rotation:arm.foot.getWorldQuaternion(new Quaternion()).normalize(),elbow:arm.knee.getWorldPosition(new Vector3()),palm:hero.rider.getObjectByName((i===0?'Left':'Right')+'HandMiddle1')!.getWorldPosition(new Vector3())}));
}
function samePalms(before:ReturnType<typeof palms>,hero:Hero,label:string){
 palms(hero).forEach((hand,i)=>{
  for(const key of ['wrist','palm','elbow']as const)assert(hand[key].distanceTo(before[i][key])<1e-8,label+' moves '+key+' out of the support pose');
  assert(hand.rotation.angleTo(before[i].rotation)<1e-6,label+' twists the planted hand');
 });
}

test('all five riders retain captured support palms during laydown, rise and crashes with equipment drawn',async t=>{
 const {models,library}=await fixtures();let scenarios=0;
 try{
  for(const id of riderIds)for(const firstPerson of [false,true]){
   const hero=new Hero(models,undefined,id,'kimodo'),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon,firstPerson);
   try{
    for(const kind of ['static','heart','bass']as const)for(const reverse of [false,true]){
     weapon.select(kind);weapon.update(1/60,false);
     for(const phase of (reverse?[.91,.7,.5,.3,.09]:[.09,.3,.5,.7,.91])){
      const p={...createPose(),headingY:.6,footMode:2,footBlend:1,footProne:phase,footTime:2+phase};hero.apply(p);
      const before=palms(hero),state={...initialCombat(),aimBlend:1,lean:.7},saved=structuredClone(state);
      rig.pickup(100);rig.apply(p,.7,-.25,state,110,180);
      assert.equal(weapon.root.visible,false,id+' equipment masks support hands');assert.equal(rig.supportLocked,false);assert.equal(rig.errorL+rig.errorR,0);
      samePalms(before,hero,id+'/'+kind);assert.deepEqual(state,saved,'visual guard changed held ADS or combat state');scenarios++;
     }
    }
    for(const reason of ['collision','sideways landing','dog power-up']){
     const initial={...createPose(),headingY:.6,speed:7,velocityZ:7,rollAngle:.3},fall=new FallMotion(initial,reason);
     for(const age of [.06,.4,.8,1.4]){
      const p={...initial};fall.sample(age,p);assert(p.crashBlend>0);hero.apply(p);const before=palms(hero);
      rig.apply(p,-.6,.3,{...initialCombat(),aimBlend:1},200);
      assert.equal(weapon.root.visible,false,id+' equipment reappears during crash');samePalms(before,hero,id+'/'+reason);scenarios++;
     }
    }
   }finally{hero.dispose();weapon.dispose();}
  }
 }finally{library.dispose();}
 t.diagnostic(scenarios+' real-rig support scenarios, across all equipment and both camera modes');
});

test('settled prone and completed rise restore visible equipment and finite ADS without moving the planted feet',async t=>{
 const {models,library}=await fixtures();let scenarios=0,maxGripError=0,worstGrip:unknown=null;
 try{
  for(const id of riderIds)for(const firstPerson of [false,true]){
   const hero=new Hero(models,undefined,id,'kimodo'),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon,firstPerson);
   try{
    for(const kind of ['static','heart','bass']as const)for(const prone of [0,.08,.92,1])for(const aimBlend of [0,1])for(const yaw of [-.8,0,.8]){
     weapon.select(kind);weapon.update(1/60,false);
     const p={...createPose(),headingY:.6,footMode:2,footBlend:1,footProne:prone,footTime:8},state={...initialCombat(),aimBlend};
     // First enter the guarded state so this also catches visibility that never resets.
     hero.apply({...p,footProne:.5});rig.apply({...p,footProne:.5},yaw,.2,state,300);assert.equal(weapon.root.visible,false);
     hero.apply(p);const feet=hero.legs.map(l=>l.foot.getWorldPosition(new Vector3())),saved=structuredClone(state);
     rig.apply(p,yaw,.2,state,400);
     assert(weapon.root.visible,id+' ADS stayed hidden beyond the transition');assert(rig.supportLocked);assert.deepEqual(state,saved);
     hero.legs.forEach((l,i)=>assert(l.foot.getWorldPosition(new Vector3()).distanceTo(feet[i])<1e-8,id+' aim moves planted feet'));
     hero.rider.traverse(o=>assert([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite),id+' invalid ADS pose'));
     assert([...weapon.root.position.toArray(),...weapon.root.quaternion.toArray(),rig.errorL,rig.errorR].every(Number.isFinite),id+' invalid weapon frame');
     if(Math.max(rig.errorL,rig.errorR)>maxGripError){maxGripError=Math.max(rig.errorL,rig.errorR);worstGrip={id,firstPerson,kind,prone,aimBlend,yaw,left:rig.errorL,right:rig.errorR};}scenarios++;
    }
   }finally{hero.dispose();weapon.dispose();}
  }
 }finally{library.dispose();}
 t.diagnostic(JSON.stringify({restoredADSScenarios:scenarios,maxGripError,worstGrip}));
});
