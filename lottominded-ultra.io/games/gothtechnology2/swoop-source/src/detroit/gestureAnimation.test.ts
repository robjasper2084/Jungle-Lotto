import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Hero} from './actors.ts';
import {heroAssets,rigModel} from './heroTestAssets.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {createPose} from './controller.ts';
import {CombatRig} from './royale/combatRig.ts';
import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './royale/equipment.ts';
import {initialCombat} from '../../../ride-core/src/royale/rules.ts';

test('all five heroes blend healing and pickup hands, return to grip, and allow an immediate combat interrupt',async()=>{
 const assets=await heroAssets();
 const library=new EquipmentLibrary(new Map(await Promise.all(EQUIPMENT_KINDS.map(async kind=>[kind,await rigModel(new URL('../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url))] as const))));
 for(const {id} of RIDER_CHOICES){
  const hero=new Hero(assets,undefined,id),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);
  weapon.select('static');weapon.update(1,false);
  const pose={...createPose(),footMode:2,footBlend:1},state=initialCombat();
  let last:Vector3[]|undefined,maxStep=0,actionTravel=0;const ready:Vector3[]=[];
  for(let tick=0;tick<130;tick++){
   pose.footTime=tick/60;hero.apply(pose);
   if(tick===70)rig.pickup(tick);
   rig.apply(pose,0,0,state,tick,tick>=10&&tick<45?45:0);
   const hands=hero.arms.map(a=>a.foot.getWorldPosition(new Vector3()));
   if(tick===0)ready.push(...hands.map(p=>p.clone()));
   if(last)hands.forEach((p,i)=>maxStep=Math.max(maxStep,p.distanceTo(last![i])));
   hands.forEach((p,i)=>actionTravel=Math.max(actionTravel,p.distanceTo(ready[i])));last=hands;
  }
  assert(maxStep<.12,`${id}: gesture snaps ${maxStep} metres per frame`);
  assert(actionTravel>.06,`${id}: action is not visible`);
  assert(weapon.root.visible,`${id}: weapon fails to return after action`);
  rig.pickup(130);for(let tick=130;tick<140;tick++){hero.apply(pose);rig.apply(pose,0,0,state,tick);}
  rig.interruptPickup();hero.apply(pose);rig.apply(pose,0,0,state,140);
  assert(weapon.root.visible,`${id}: pickup blocks a combat interrupt`);
  hero.dispose();weapon.dispose();
 }
 library.dispose();
});
