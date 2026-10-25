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
  const source=await rigModel(new URL('../../../public/exports/rigged-heroes/'+id+'.glb',import.meta.url));data.set(id,source);
  const original=new Map<T.BufferGeometry,number>();source.scene.traverse(o=>{if(o instanceof T.Mesh)original.set(o.geometry,o.geometry.index!.count);});
  const hero=new Hero(data,undefined,id),root=new T.Group();root.add(hero.root);const arms=new FpsArms(hero,root);root.scale.setScalar(.8);root.updateMatrixWorld(true);
  let visible=0;hero.rider.traverse(o=>{if(o instanceof T.SkinnedMesh&&o.visible)visible+=o.geometry.index!.count;});
  assert(visible>600,id+' must retain animated hand geometry');assert.equal(hero.fingers.jointCount,30);
  const camera=new T.PerspectiveCamera();camera.position.set(2,1.6,-4);camera.rotation.y=1.1;camera.updateMatrixWorld(true);arms.update(camera,hero.motionScale,.8);root.updateMatrixWorld(true);
  for(const arm of hero.arms){assert(arm.knee.getWorldPosition(new T.Vector3()).distanceTo(arm.foot.getWorldPosition(new T.Vector3()))>.05,'authored forearms remain visible and have length');assert(arm.foot.getWorldPosition(new T.Vector3()).toArray().every(Number.isFinite));}
   for(const [g,count]of original)assert.equal(g.index!.count,count,'source mesh remains whole');
  arms.dispose();hero.dispose();
 }
});
