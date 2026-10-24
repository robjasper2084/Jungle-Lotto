import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {rigModel} from '../heroTestAssets.ts';
import {assetPath} from '../testAssets.ts';
import {RIDER_CHOICES} from '../riderChoices.ts';
import {Hero} from '../actors.ts';
import {FpsArms} from './fpsArms.ts';
import {FirstPersonView} from './firstPersonView.ts';
import {EquipmentLibrary,EQUIPMENT_KINDS} from './equipment.ts';
import {createPose} from '../controller.ts';
import {initialCombat} from '../../../../ride-core/src/royale/rules.ts';
import {scopedFov,type Scope} from '../../../../ride-core/src/royale/scopes.ts';
test('all production hero rigs retain first-person hands and wrist geometry',async t=>{
 const wheel=await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'));
 for(const {id}of RIDER_CHOICES){
  const model=await rigModel(new URL('../../../public/exports/rigged-heroes/'+id+'.glb',import.meta.url));
  const h=new Hero(new Map([['DS_EUC_01',wheel],[id,model]]),undefined,id),root=new T.Group();root.add(h.root);
  const arms=new FpsArms(h,root);let triangles=0,visible=0;
  h.rider.traverseVisible(o=>{if(o instanceof T.Mesh){visible++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
  t.diagnostic(JSON.stringify({id,visible,triangles,fingers:h.fingers.jointCount,handChildren:h.arms.map(a=>a.foot.children.map(c=>c.name))}));
  assert(triangles>20,id+' has missing first-person hand geometry');
  arms.dispose();h.dispose();
 }
});
test('production palms project forward from the cuffs instead of folding inside the sleeves',async()=>{
 const data=new Map([['DS_EUC_01',await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]),models=new Map();
 for(const kind of EQUIPMENT_KINDS)models.set(kind,await rigModel(new URL('../../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url)));
 const library=new EquipmentLibrary(models);
 for(const {id}of RIDER_CHOICES){
  data.set(id,await rigModel(new URL('../../../public/exports/rigged-heroes/'+id+'.glb',import.meta.url)));
  const fp=new FirstPersonView(data,library,id),scale=id.includes('Mascot')?.48:1,camera=new T.PerspectiveCamera(76,16/9,.03,100);
  camera.position.set(0,1.64*scale,0);camera.lookAt(0,camera.position.y,100);camera.updateMatrixWorld();
  for(const weapon of ['static','heart','bass'] as const)for(const mode of ['hip','iron','scope2','scope4','scope8'] as const)for(const reduced of mode==='scope8'?[false,true]:[false])for(const baseFov of mode.startsWith('scope')?[52,76]:[76]){
   const ads=mode!=='hip',scope:Scope|null=mode==='hip'||mode==='iron'?null:mode;
   camera.fov=scopedFov(baseFov,scope);camera.updateProjectionMatrix();
   const state=initialCombat();state.aimBlend=ads?1:0;
   for(let tick=100;tick<135;tick++)fp.update({...createPose(),footMode:2,footBlend:1},state,weapon,tick,0,0,camera,1/60,false,ads,reduced,{raycastObstacle:()=>null} as never,0,true,!!scope);
   assert(fp.root.visible,`${id} ${weapon} ${mode}: viewmodel hidden`);
   for(const side of ['Left','Right']){
    const wrist=fp.root.getObjectByName(side+'Hand')!.getWorldPosition(new T.Vector3()),palm=fp.root.getObjectByName(side+'HandMiddle1')!.getWorldPosition(new T.Vector3());
    assert(palm.clone().sub(wrist).normalize().z>.75,`${id} ${weapon} ${side}: palm folds back into sleeve`);
    const screen=palm.clone().project(camera);assert(Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&screen.z<1,`${id} ${weapon} ${side} ${mode}: hand outside view ${screen.toArray()}`);
   }
   const visible:T.Mesh[]=[];fp.root.traverseVisible(o=>{if(o instanceof T.Mesh){visible.push(o);if(o instanceof T.SkinnedMesh){o.skeleton.update();o.computeBoundingSphere();}}});
   if(scope)assert.equal(new T.Raycaster(camera.position,camera.getWorldDirection(new T.Vector3()),0,3).intersectObjects(visible,false).length,0,`${id} ${weapon} ${scope}: hands or weapon obscure scope center`);
   for(const glove of visible.filter(o=>/ArticulatedGlove/.test(o.name))){
    const index=glove.geometry.index!;let exposed=0;const blockers:Record<string,number>={};
    for(let i=0;i<index.count;i+=90){const point=glove.getVertexPosition(index.getX(i),new T.Vector3()).applyMatrix4(glove.matrixWorld);
     const hit=new T.Raycaster(camera.position,point.sub(camera.position).normalize(),0,3).intersectObjects(visible,false)[0];if(hit?.object===glove)exposed++;else if(hit)blockers[hit.object.name]=(blockers[hit.object.name]??0)+1;
    }
    // Both hip and iron-sight views must expose real glove surfaces,
    // not merely contain hand bones behind the receiver.
    assert(exposed>=3,`${id} ${weapon} ${glove.name}: glove hidden by sleeve or weapon mode=${mode} ${JSON.stringify(blockers)} exposed=${exposed}`);
   }
  }
  fp.dispose();
 }
 library.dispose();
});
