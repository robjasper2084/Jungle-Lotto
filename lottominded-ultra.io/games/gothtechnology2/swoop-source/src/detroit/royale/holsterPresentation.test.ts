import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {heroAssets,rigModel} from '../heroTestAssets.ts';
import {Hero} from '../actors.ts';
import {RIDER_CHOICES} from '../riderChoices.ts';
import {CombatRig} from './combatRig.ts';
import {FirstPersonView} from './firstPersonView.ts';
import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS} from './equipment.ts';
import {createPose} from '../controller.ts';
import {initialCombat,type Weapon} from '../../../../ride-core/src/royale/rules.ts';
test('all five heroes keep stowed barrels above ground through crouch/prone and can heal in first person',async()=>{
 const assets=await heroAssets(),models=new Map();
 for(const kind of EQUIPMENT_KINDS)models.set(kind,await rigModel(new URL('../../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url)));
 const library=new EquipmentLibrary(models);
 for(const {id}of RIDER_CHOICES){
  const hero=new Hero(assets,undefined,id),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);
  const state=initialCombat();state.holster={stowed:true,from:0,to:0,start:0,end:0};
  for(const kind of ['static','heart','bass'] as Weapon[]){weapon.select(kind);
   for(const prone of [0,.25,.5,.75,1])for(const crouch of [0,1]){
    const pose={...createPose(),footMode:2,footBlend:1,footProne:prone,footCrouch:crouch};
    hero.apply(pose);rig.apply(pose,0,0,state,100);
    assert(new T.Box3().setFromObject(weapon.root).min.y>=-.015,id+' '+kind+' prone '+prone+' crouch '+crouch);
   }
  }
  const fp=new FirstPersonView(assets,library,id),camera=new T.PerspectiveCamera(76,16/9,.03,100);
  camera.position.set(0,1.64*hero.motionScale,0);camera.lookAt(0,camera.position.y,100);camera.updateMatrixWorld();
  const pose={...createPose(),footMode:2,footBlend:1},terrain={raycastObstacle:()=>null} as never;
  fp.update(pose,state,'static',100,0,0,camera,1/60,false,false,false,terrain);assert(!fp.root.visible);
  for(let tick=101;tick<125;tick++)fp.update(pose,state,'static',tick,0,0,camera,1/60,false,false,false,terrain,200);
  assert(fp.root.visible,id+' healing hands');assert(fp.root.getObjectByName('Held health pack')?.visible,id+' health pack');
  fp.dispose();hero.dispose();weapon.dispose();
 }
 library.dispose();
});
