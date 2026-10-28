import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {rigModel} from './heroTestAssets.ts';
import {RiderWardrobe,WARDROBE_CHOICES} from '../../../ride-core/src/riderWardrobe.ts';
import {wardrobeSurface} from '../../../ride-core/src/wardrobeSurface.ts';

const asset=await rigModel(new URL('../../../store/public/arcade/swoop-detroit/exports/rigged-heroes/DS_Armored_Rider_01.glb',import.meta.url),true);
function rider(){const root=clone(asset.scene);if(asset.animations[0]){const mixer=new T.AnimationMixer(root);mixer.clipAction(asset.animations[0]).play();mixer.setTime(0);}root.updateMatrixWorld(true);return root;}
for(const {id} of WARDROBE_CHOICES)test(id+' applies visible fitted suit and helmet details without changing the shared asset',()=>{
 const root=rider(),source=root.getObjectByName('char1_1') as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 const originalGeometry=source.geometry,originalMaterial=source.material,color=originalMaterial.color.clone();
 const chestSurface=wardrobeSurface(root,m=>/garments|padding|nylon|protective shell/.test(m.name),1.23,1.53);
 const head=root.getObjectByName('Head')!,headY=root.worldToLocal(head.getWorldPosition(new T.Vector3())).y;
 const helmetSurface=wardrobeSurface(root,m=>/Black rubber padding|Dark riding garments/.test(m.name),headY-.015);
 const wardrobe=new RiderWardrobe(root,id);root.updateMatrixWorld(true);
 assert.notEqual(source.geometry,originalGeometry);assert.notEqual(source.material,originalMaterial);
 assert.deepEqual(originalMaterial.color,color);assert.equal(originalGeometry.hasAttribute('color'),false);
 assert.equal(source.geometry.attributes.color.count,originalGeometry.attributes.position.count);
 for(const [name,surface]of [['fitted chest artwork',chestSurface],['fitted helmet forehead artwork',helmetSurface]] as const){
  const patch=root.getObjectByName(id+' '+name) as T.Mesh;assert.ok(patch);
  const p=patch.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const point=root.worldToLocal(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(patch.matrixWorld));
   const hit=surface.project(new T.Vector3(point.x,point.y,.6),new T.Vector3(point.x,point.y,-.4),0);
   assert.ok(hit,'print must be supported by the actual garment');
   assert.ok(point.z>hit.z+.002&&point.z<hit.z+.006,'print must sit just outside the garment');
  }
 }
 const brow=root.getObjectByName(id+' fitted helmet forehead artwork')!;
 assert.equal(brow.parent,head);const local=brow.matrix.clone();head.rotateY(.4);root.updateMatrixWorld(true);assert.ok(brow.matrix.equals(local));
 const chest=root.getObjectByName(id+' fitted chest artwork') as T.SkinnedMesh;
 assert.ok(chest.isSkinnedMesh,'chest artwork must deform with the garment instead of floating on a rigid bone');
 root.getObjectByName('Spine02')!.rotateX(.12);root.getObjectByName('Spine01')!.rotateY(.08);root.updateMatrixWorld(true);
 const bentTorso=wardrobeSurface(root,m=>/garments|padding|nylon|protective shell/.test(m.name),1.1,1.6);
 for(let i=0;i<chest.geometry.attributes.position.count;i+=13){
  const point=root.worldToLocal(chest.getVertexPosition(i,new T.Vector3()).applyMatrix4(chest.matrixWorld));
  const hit=bentTorso.project(new T.Vector3(point.x,point.y,.6),new T.Vector3(point.x,point.y,-.4),0);
  assert.ok(hit&&Math.abs(point.z-hit.z)<.018,'animated print stays against the bending torso');
 }
 bentTorso.dispose();
 wardrobe.dispose();assert.equal(root.getObjectByName(id+' fitted chest artwork'),undefined);assert.equal(root.getObjectByName(id+' fitted helmet forehead artwork'),undefined);
 chestSurface.dispose();helmetSurface.dispose();
});
