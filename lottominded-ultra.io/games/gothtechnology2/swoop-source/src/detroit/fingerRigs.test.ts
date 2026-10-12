import {test} from 'node:test';import assert from 'node:assert/strict';
import {Vector3,SkinnedMesh} from 'three';import {rigModel} from './heroTestAssets.ts';
import {assetPath} from './testAssets.ts';import {Hero} from './actors.ts';import {createPose} from './controller.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
test('all five exported heroes have weighted finger joints, changing grip geometry and intact first-person arms',async t=>{
 const data=new Map([['DS_EUC_01',await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]);
 for(const {id} of RIDER_CHOICES){
  data.set(id,await rigModel(new URL('../../public/exports/rigged-heroes/'+id+'.glb',import.meta.url)));
  const hero=new Hero(data,undefined,id),p={...createPose(),footMode:2,footBlend:1};hero.apply(p);
  assert.equal(hero.fingers.jointCount,30,id);const finger=hero.rider.getObjectByName('RightHandIndex3')!,hand=hero.rider.getObjectByName('RightHand')!;
  hero.root.updateMatrixWorld(true);const relaxed=finger.getWorldPosition(new Vector3()),wrist=hand.getWorldPosition(new Vector3());
  hero.fingers.apply('MeleeFist');hero.root.updateMatrixWorld(true);assert(relaxed.distanceTo(finger.getWorldPosition(new Vector3()))>.012,id+' fingers do not curl');assert(wrist.distanceTo(hand.getWorldPosition(new Vector3()))<1e-8,'curl changes wrist');
  const full=new Map<SkinnedMesh,number>();let weighted=0;
  hero.rider.traverse(o=>{const m=o as SkinnedMesh;if(!m.isSkinnedMesh)return;full.set(m,m.geometry.index!.count);const i=m.geometry.getAttribute('skinIndex'),w=m.geometry.getAttribute('skinWeight');for(let v=0;v<i.count;v++)for(let c=0;c<4;c++)if(w.getComponent(v,c)>0&&/Hand(Index|Middle|Ring|Pinky|Thumb)/.test(m.skeleton.bones[i.getComponent(v,c)]?.name??''))weighted++;});
  assert(weighted>600,id+' missing weighted glove skin');hero.visibility.setFirstPerson(true);let visible=0;
  for(const [m,count]of full){const n=m.geometry.index!.count;if(m.visible)visible+=n;assert(n<=count);}
  assert(visible>1500,id+' missing first person geometry');hero.visibility.setFirstPerson(false);for(const [m,count]of full)assert.equal(m.geometry.index!.count,count);
  t.diagnostic(JSON.stringify({id,fingerJoints:30,weighted,firstPersonIndices:visible}));hero.dispose();
 }
});
