import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Hero} from './actors.ts';
import {heroAssets,rigModel} from './heroTestAssets.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {createPose} from './controller.ts';
import {CombatRig} from './royale/combatRig.ts';
import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './royale/equipment.ts';
import {initialCombat} from '../../../ride-core/src/royale/rules.ts';

test('standing idle breathes subtly with planted feet for all five heroes',async()=>{
 const assets=await heroAssets();
 for(const {id} of RIDER_CHOICES){
  const h=new Hero(assets,undefined,id),p={...createPose(),footMode:2,footBlend:1};h.apply(p);
  const feet=h.legs.map(l=>l.foot.getWorldPosition(new T.Vector3())),start=h.rider.getObjectByName('Hips')!.getWorldPosition(new T.Vector3());
  let motion=0;
  for(let f=0;f<=240;f++){
   p.footTime=f/30;h.apply(p);h.legs.forEach((l,i)=>assert(l.foot.getWorldPosition(new T.Vector3()).distanceTo(feet[i])<.004,id+' idle foot sliding'));
   const hip=h.rider.getObjectByName('Hips')!.getWorldPosition(new T.Vector3());motion=Math.max(motion,hip.distanceTo(start));
   for(const b of h.bones)assert([...b.o.position.toArray(),...b.o.quaternion.toArray()].every(Number.isFinite));
  }
  assert(motion>.001&&motion<.04,id+' idle must be subtle');h.dispose();
 }
});
test('holstering reaches the belt, releases both hands, and drawing reaches both weapon grips on every hero',async()=>{
 const assets=await heroAssets(),models=new Map();
 for(const kind of EQUIPMENT_KINDS)models.set(kind,await rigModel(new URL('../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url)));
 const library=new EquipmentLibrary(models);
 for(const {id} of RIDER_CHOICES){
  const hero=new Hero(assets,undefined,id),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);
  weapon.select('static');const state=initialCombat(),p={...createPose(),footMode:2,footBlend:1};
  state.holster={stowed:false,from:0,to:1,start:0,end:40};const positions:T.Vector3[]=[];
  for(let tick=0;tick<=40;tick++){hero.apply({...p,footTime:tick/60});rig.apply(p,0,0,state,tick);positions.push(weapon.root.position.clone());assert(weapon.root.visible);for(const b of hero.bones)assert([...b.o.position.toArray(),...b.o.quaternion.toArray()].every(Number.isFinite));}
  assert(positions[0].distanceTo(positions[40])>.20*hero.motionScale,id+' draw needs a visible travel path');
  assert(positions[0].y-p.y>.90*hero.motionScale&&positions[0].y-p.y<1.5*hero.motionScale,id+' stowed grip belongs at belt height');
  assert(rig.errorR<.08&&rig.errorL<.09,id+' ready grip unreachable');
  state.holster={stowed:true,from:1,to:0,start:41,end:81};hero.apply(p);
  const hands=hero.arms.map(l=>l.foot.getWorldPosition(new T.Vector3()));rig.apply(p,0,0,state,81);
  hero.arms.forEach((l,i)=>assert(l.foot.getWorldPosition(new T.Vector3()).distanceTo(hands[i])<.001,id+' holstered hand stays locked'));
  hero.dispose();weapon.dispose();
 }
 library.dispose();
});
