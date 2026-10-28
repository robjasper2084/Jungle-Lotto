import {baseRiderId} from '../../../../ride-core/src/riderWardrobe.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {rigModel} from '../heroTestAssets.ts';
import {assetPath} from '../testAssets.ts';
import {Hero} from '../actors.ts';
import {RIDER_CHOICES} from '../riderChoices.ts';
import {FpsArms} from './fpsArms.ts';
test('fitted FPS sleeves keep every rider finger rig and leave shared assets untouched',async()=>{
 const data=new Map([['DS_EUC_01',await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]);
 for(const {id}of RIDER_CHOICES){
  const source=await rigModel(new URL('../../../public/exports/rigged-heroes/'+baseRiderId(id)+'.glb',import.meta.url));data.set(baseRiderId(id),source);
  const original=new Map<T.BufferGeometry,number>();source.scene.traverse(o=>{if(o instanceof T.Mesh)original.set(o.geometry,o.geometry.index!.count);});
  const hero=new Hero(data,undefined,id),root=new T.Group();root.add(hero.root);const arms=new FpsArms(hero,root);root.scale.setScalar(.8);root.updateMatrixWorld(true);
  let visible=0;hero.rider.traverse(o=>{if(o instanceof T.SkinnedMesh&&o.visible)visible+=o.geometry.index!.count;});
  assert(visible>600,id+' must retain animated hand geometry');assert.equal(hero.fingers.jointCount,30);
  const proportions=hero.arms.map(arm=>({upperLength:arm.knee.parent!.getWorldPosition(new T.Vector3()).distanceTo(arm.knee.getWorldPosition(new T.Vector3())),length:arm.knee.getWorldPosition(new T.Vector3()).distanceTo(arm.foot.getWorldPosition(new T.Vector3())),handScale:arm.foot.getWorldScale(new T.Vector3()),wrist:arm.foot.getWorldPosition(new T.Vector3())}));
  const camera=new T.PerspectiveCamera();camera.position.set(2,1.6,-4);camera.rotation.y=1.1;camera.updateMatrixWorld(true);arms.update(camera,hero.motionScale,.8);root.updateMatrixWorld(true);
  for(const [i,arm]of hero.arms.entries()){
   const before=proportions[i],wrist=arm.foot.getWorldPosition(new T.Vector3());
   assert(Math.abs(arm.knee.getWorldPosition(new T.Vector3()).distanceTo(wrist)-before.length)<1e-5,id+' FPS forearm must retain the hero length, not stretch toward the screen edge');
   assert(Math.abs(arm.knee.parent!.getWorldPosition(new T.Vector3()).distanceTo(arm.knee.getWorldPosition(new T.Vector3()))-before.upperLength)<1e-5,id+' FPS upper arm must retain the hero length');
   assert(arm.foot.getWorldScale(new T.Vector3()).distanceTo(before.handScale.clone().multiplyScalar(1.25))<1e-5,id+' FPS hands must keep the reviewed 25% lift without distorting the hero hand shape');
   assert(wrist.distanceTo(before.wrist)<1e-5,id+' proportions must preserve the solved camera grip');
  }
  for(const arm of hero.arms){assert(arm.knee.getWorldPosition(new T.Vector3()).distanceTo(arm.foot.getWorldPosition(new T.Vector3()))>.05,'authored forearms remain visible and have length');assert(arm.foot.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite));}
   for(const [g,count]of original)assert.equal(g.index!.count,count,'source mesh remains whole');
  arms.dispose();hero.dispose();
 }
});
