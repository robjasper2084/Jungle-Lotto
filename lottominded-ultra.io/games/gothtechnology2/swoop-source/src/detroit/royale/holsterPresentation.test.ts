import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {heroAssets,rigModel} from '../heroTestAssets.ts';
import {Hero} from '../actors.ts';
import {RIDER_CHOICES} from '../riderChoices.ts';
import {CombatRig} from './combatRig.ts';
import {FirstPersonView} from './firstPersonView.ts';
import {EquipmentLibrary,WeaponView,EQUIPMENT_KINDS,CAMERA_SIGHTS} from './equipment.ts';
import {createPose} from '../controller.ts';
import {initialCombat,type Weapon} from '../../../../ride-core/src/royale/rules.ts';
import {cameraDrawPose} from '../../../../ride-core/src/royale/cameraDraw.ts';
test('all five heroes keep stowed barrels above ground through crouch/prone and can heal in first person',async()=>{
 const assets=await heroAssets(),models=new Map();
 for(const kind of EQUIPMENT_KINDS)models.set(kind,await rigModel(new URL('../../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url)));
 const repairUse=await rigModel(new URL('../../../public/exports/polish/royale-equipment/repair-use.glb',import.meta.url));
 const library=new EquipmentLibrary(models,repairUse);
 for(const kind of ['static','heart','bass'] as Weapon[]){const model=library.create(kind);model.root.updateMatrixWorld(true);const sight=new T.Vector3(...CAMERA_SIGHTS[kind]),ray=new T.Raycaster(sight.clone().add(new T.Vector3(0,0,-.6)),new T.Vector3(0,0,1),0,1.5);assert.equal(ray.intersectObject(model.root,true).length,0,kind+' ADS clears the camera housing');model.dispose();}
 for(const {id}of RIDER_CHOICES){
  const hero=new Hero(assets,undefined,id,'kimodo'),weapon=new WeaponView(library),rig=new CombatRig(hero,weapon);
  const state=initialCombat();state.holster={stowed:true,from:0,to:0,start:0,end:0};
  // Verify actual hand transforms through both directions of the authored take.
  for(const reverse of [false,true])for(const footMode of [0,2]){
   let previous:T.Vector3|undefined;
   for(let frame=0;frame<=64;frame++){
    const ready=(reverse?64-frame:frame)/64,draw=cameraDrawPose(ready);
    state.holster={stowed:reverse,from:ready,to:ready,start:0,end:0};
    const pose={...createPose(),x:4,z:7,headingY:.7,footMode,footBlend:footMode===2?1:0};
    hero.apply(pose);rig.apply(pose,.35,.12,state,100);
    if(draw.grip>.999)assert(rig.errorR<.0001,id+' dominant grip remains attached '+ready);
    if(draw.support>.999)assert(rig.errorL<.055*hero.motionScale,id+' support joins under camera '+rig.errorL);
    const point=weapon.root.position.clone();
    if(previous)assert(point.distanceTo(previous)<.11*hero.motionScale,id+' no draw/holster teleport '+ready+' '+point.distanceTo(previous));
    previous=point;
   }
  }
  state.holster={stowed:true,from:0,to:0,start:0,end:0};
  // A stowed weapon remains attached to the upper torso and does not pin hands.
  let backLocal:T.Vector3|undefined;
  for(const headingY of [0,.9,-2.2])for(const footCycle of [0,.2,.6,.9]){
   const pose={...createPose(),x:4,z:7,headingY,footMode:2,footBlend:1,footCycle,speed:2};
   hero.apply(pose);hero.root.updateWorldMatrix(true,true);
   const hands=hero.arms.map(limb=>limb.foot.getWorldPosition(new T.Vector3()));
   rig.apply(pose,0,0,state,100);
   const chest=hero.chest??hero.rider,local=chest.worldToLocal(weapon.root.getWorldPosition(new T.Vector3()));
   if(!backLocal)backLocal=local.clone();else assert(local.distanceTo(backLocal)<1e-5,id+' back attachment follows stride and turning');
   hero.arms.forEach((limb,i)=>assert(limb.foot.getWorldPosition(new T.Vector3()).distanceTo(hands[i])<1e-5,id+' released hand swings freely'));
   if(headingY===0&&footCycle===0){
    const back=weapon.root.getWorldPosition(new T.Vector3()).sub(chest.getWorldPosition(new T.Vector3()));
    assert(back.z<-.15*hero.motionScale,id+' weapon is behind torso');
    const barrel=new T.Vector3(0,0,1).applyQuaternion(weapon.root.getWorldQuaternion(new T.Quaternion()));
    assert(barrel.y>.7,id+' barrel points above the shoulder');
   }
  }
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
  const pack=fp.root.getObjectByName('Held health pack')!,center=new T.Box3().setFromObject(pack).getCenter(new T.Vector3());
  const projected=center.clone().project(camera);
  assert(Math.abs(projected.x)<.65&&projected.y>-.7&&projected.y<.3&&projected.z<1,id+' pack stays inside the first-person view');
  rig.hideHandheld();assert(!hero.root.getObjectByName('Held health pack')!.visible,id+' world prop can be masked independently');
  assert(pack.visible,id+' view prop survives the world mask');
  state.holster={stowed:false,from:1,to:1,start:0,end:0};
  for(const footMode of [0,2])for(const ads of [false,true]){
   const view=fp.update({...pose,footMode,footBlend:footMode?1:0},state,'static',220,0,0,camera,1/60,false,ads,false,terrain);
   assert(fp.root.visible,id+' hands view is active '+footMode);
   assert(view.rigRight<.0001,id+' dominant hand stays on grip');
   assert(view.rigLeft<.065*hero.motionScale,id+' support hand stays on weapon');
   // Sleeves now use the selected rider's skinned forearms. Verify visible
   // geometry influenced by both real bones rather than removed helper tubes.
   for(const side of ['Left','Right']){let vertices=0;fp.root.traverseVisible(o=>{
    if(!(o instanceof T.SkinnedMesh))return;const bone=o.skeleton.bones.findIndex(b=>b.name===side+'ForeArm');if(bone<0)return;
    const skin=o.geometry.getAttribute('skinIndex'),weights=o.geometry.getAttribute('skinWeight'),indices=o.geometry.index;if(!skin||!weights||!indices)return;
    for(let i=0;i<indices.count;i++){const vertex=indices.getX(i);for(let k=0;k<4;k++)if(skin.getComponent(vertex,k)===bone&&weights.getComponent(vertex,k)>.2){vertices++;break;}}
   });assert(vertices>3,id+' '+side+' authored sleeve geometry visible');}
   if(!ads)for(const side of ['Left','Right']){
    const hand=fp.root.getObjectByName(side+'Hand')!.getWorldPosition(new T.Vector3()).project(camera);
    assert(Math.abs(hand.x)<.95&&hand.y>-.92&&hand.y<.4&&hand.z<1,id+' '+side+' grip stays on screen: '+hand.toArray());
   }
  }
  fp.dispose();hero.dispose();weapon.dispose();
 }
 library.dispose();
});
