import {test} from 'node:test';import assert from 'node:assert/strict';import {Vector3,SkinnedMesh} from 'three';
import {heroAssets,rigModel} from './heroTestAssets.ts';import {Hero} from './actors.ts';import {createPose} from './controller.ts';
import {CombatRig} from './royale/combatRig.ts';import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './royale/equipment.ts';import {initialCombat} from '../../../ride-core/src/royale/rules.ts';
test('every hero can lean while walking, crouch and crawl with continuous limbs and a held weapon',async t=>{
 const assets=await heroAssets(),library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await rigModel(new URL('../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url))] as const))));
 for(const id of ['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01']){
  const h=new Hero(assets,undefined,id),weapon=new WeaponView(library),rig=new CombatRig(h,weapon);weapon.select('static');weapon.update(1,true);
  const joints=h.legs.concat(h.arms),lengths=joints.map(l=>[l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3())),l.knee.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3()))]);
  let stretch=0,grip=0,floor=Infinity;const heads:number[]=[];
  for(const stance of [0,1,2])for(const phase of [0,.25,.5,.75])for(const lean of [-1,0,1])for(const heading of [0,Math.PI/2,Math.PI]){
   const p={...createPose(),headingY:heading,footMode:2,footBlend:1,footCrouch:stance===1?1:0,footProne:stance===2?1:0,speed:stance===2?.75:stance===1?1.4:2.35,footPhase:phase,footCycle:phase,footTime:phase};h.apply(p);
   const feet=h.legs.map(l=>l.foot.getWorldPosition(new Vector3()));
   rig.apply(p,0,0,{...initialCombat(),aimBlend:1,lean,reloadStart:phase===.25?240:-1,reloadEnd:300},260);
   feet.forEach((f,i)=>assert(f.distanceTo(h.legs[i].foot.getWorldPosition(new Vector3()))<1e-5,'lean must preserve the stride'));
   if(phase===0&&lean===0&&heading===0)heads.push(h.rider.getObjectByName('Head')!.getWorldPosition(new Vector3()).y);
   joints.forEach((l,i)=>{stretch=Math.max(stretch,Math.abs(l.upper.getWorldPosition(new Vector3()).distanceTo(l.knee.getWorldPosition(new Vector3()))-lengths[i][0]),Math.abs(l.knee.getWorldPosition(new Vector3()).distanceTo(l.foot.getWorldPosition(new Vector3()))-lengths[i][1]));});
   grip=Math.max(grip,rig.errorR,rig.errorL);
   h.rider.traverse(o=>{const m=o as SkinnedMesh;if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i+=19)floor=Math.min(floor,m.getVertexPosition(i,new Vector3()).applyMatrix4(m.matrixWorld).y);});
  }
  t.diagnostic(JSON.stringify({id,stretch,grip,floor,heads}));assert(stretch<.0001,id+' stretches limbs');assert(heads[2]<heads[1]&&heads[1]<heads[0],id+' stance does not lower the body');assert(floor>-.06,id+' sinks beneath the ground');assert(grip<.035,id+' loses weapon grip');h.dispose();weapon.dispose();
 }library.dispose();
});
