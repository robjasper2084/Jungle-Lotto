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
  const sourceGlove=new T.MeshStandardMaterial({name:'Articulated charcoal riding gloves',color:'#303030',map:new T.Texture()});
  h.rider.traverse(o=>{if(o instanceof T.Mesh&&/ArticulatedGlove/.test(o.name))o.material=sourceGlove;});
  const arms=new FpsArms(h,root);let triangles=0,visible=0;
  h.rider.traverseVisible(o=>{if(o instanceof T.Mesh&&/ArticulatedGlove/.test(o.name)){
   const material=o.material as T.MeshStandardMaterial;
   assert.equal(material,sourceGlove,'selected hero glove material must be retained');
   assert(material.map,'selected hero texture must be retained');
   assert.equal(material.color.getHexString(),'303030','do not replace every hero with gray gloves');
  }});
  assert(sourceGlove.map,'world glove material must be preserved');
  h.rider.traverseVisible(o=>{if(o instanceof T.Mesh){visible++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
  t.diagnostic(JSON.stringify({id,visible,triangles,fingers:h.fingers.jointCount,handChildren:h.arms.map(a=>a.foot.children.map(c=>c.name))}));
  assert(triangles>20,id+' has missing first-person hand geometry');
  arms.dispose();h.dispose();sourceGlove.map?.dispose();sourceGlove.dispose();
 }
});
test('production palms wrap the grips with exposed surfaces at normal and scoped field of view',async()=>{
 const data=new Map([['DS_EUC_01',await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'))]]),models=new Map();
 for(const kind of EQUIPMENT_KINDS)models.set(kind,await rigModel(new URL('../../../public/exports/polish/royale-equipment/'+kind+'.glb',import.meta.url)));
 const library=new EquipmentLibrary(models);
 for(const {id}of RIDER_CHOICES){
  data.set(id,await rigModel(new URL('../../../public/exports/rigged-heroes/'+id+'.glb',import.meta.url)));
  const fp=new FirstPersonView(data,library,id),scale=id.includes('Mascot')?.48:1,camera=new T.PerspectiveCamera(76,16/9,.12,100);
  camera.position.set(0,1.64*scale,0);camera.lookAt(0,camera.position.y,100);camera.updateMatrixWorld();
  for(const weapon of ['static','heart','bass'] as const)for(const mode of ['hip','iron','scope2','scope4','scope8'] as const)for(const reduced of mode==='scope8'?[false,true]:[false])for(const baseFov of [52,76]){
   const ads=mode!=='hip',scope:Scope|null=mode==='hip'||mode==='iron'?null:mode;
   camera.fov=scopedFov(baseFov,scope);camera.updateProjectionMatrix();
   const state=initialCombat();state.aimBlend=ads?1:0;
   for(let tick=100;tick<135;tick++)fp.update({...createPose(),footMode:2,footBlend:1},state,weapon,tick,0,0,camera,1/60,false,ads,reduced,{raycastObstacle:()=>null} as never,0,true,!!scope);
   assert(fp.root.visible,`${id} ${weapon} ${mode}: viewmodel hidden`);
   for(const side of ['Left','Right']){
    const wrist=fp.root.getObjectByName(side+'Hand')!.getWorldPosition(new T.Vector3()),palm=fp.root.getObjectByName(side+'HandMiddle1')!.getWorldPosition(new T.Vector3());
    const direction=fp.root.worldToLocal(palm.clone()).sub(fp.root.worldToLocal(wrist.clone())).normalize();
    assert(direction.z>.25&&direction.y>.25,`${id} ${weapon} ${side}: palm must rise around grip outside sleeve`);
    const screen=palm.clone().project(camera);assert(Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&screen.z<1,`${id} ${weapon} ${side} ${mode}: hand outside view ${screen.toArray()}`);
   }
   // Bake this sampled pose once. Raycasting the skinned jacket for every
   // glove vertex otherwise repeats the same skinning millions of times.
   const visible:T.Mesh[]=[];fp.root.traverseVisible(o=>{if(o instanceof T.Mesh){
    if(o instanceof T.SkinnedMesh)o.skeleton.update();
    const geometry=o.geometry.clone(),positions=geometry.getAttribute('position'),vertex=new T.Vector3();
    for(let i=0;i<positions.count;i++){o.getVertexPosition(i,vertex);positions.setXYZ(i,vertex.x,vertex.y,vertex.z);}
    geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const posed=new T.Mesh(geometry,o.material);posed.name=o.name;posed.matrixWorld.copy(o.matrixWorld);visible.push(posed);
   }});
   if(scope)assert.equal(new T.Raycaster(camera.position,camera.getWorldDirection(new T.Vector3()),0,3).intersectObjects(visible,false).length,0,`${id} ${weapon} ${scope}: hands or weapon obscure scope center`);
   for(const glove of visible.filter(o=>/ArticulatedGlove/.test(o.name))){
    const index=glove.geometry.index!;let exposed=0;const blockers:Record<string,number>={},bounds=new T.Box2();
    for(let i=0;i<index.count;i+=30){const point=glove.getVertexPosition(index.getX(i),new T.Vector3()).applyMatrix4(glove.matrixWorld);
     const hit=new T.Raycaster(camera.position,point.clone().sub(camera.position).normalize(),0,3).intersectObjects(visible,false)[0];if(hit?.object===glove){const screen=point.project(camera);if(Math.abs(screen.x)<1&&Math.abs(screen.y)<1){exposed++;bounds.expandByPoint(new T.Vector2(screen.x,screen.y));}}else if(hit)blockers[hit.object.name]=(blockers[hit.object.name]??0)+1;
    }
    // Both hip and iron-sight views must expose real glove surfaces,
    // not merely contain hand bones behind the receiver.
    assert(exposed>=3,`${id} ${weapon} ${glove.name}: glove hidden by sleeve or weapon mode=${mode} ${JSON.stringify(blockers)} exposed=${exposed}`);
    const size=bounds.getSize(new T.Vector2());
    // Proportionate hands replace the old 1.5x enlargement. Keep enough exposed
    // surface to read the grip without requiring oversized fingers again.
    assert(size.x>.02&&size.y>.02,`${id} ${weapon} ${glove.name} ${mode} ${baseFov}: exposed hand too small ${size.toArray()}`);
   }
   for(const mesh of visible)mesh.geometry.dispose();
  }
  fp.dispose();
 }
 library.dispose();
});
