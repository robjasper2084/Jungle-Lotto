import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CompanionView} from './companionView.ts';
import {HelmetSkinDecal} from './helmetSkin.ts';
import {rigModel} from './heroTestAssets.ts';
import {gaitCadence} from './dogGait.ts';
import {createBattleDog} from '../../../ride-core/src/royale/dogPower.ts';
import {createPose} from './controller.ts';
import {sampleBattleDog} from './royale/dogPresentation.ts';

const asset=await rigModel(new URL('../../public/exports/polish/DS_Boerboel_Polished.glb',import.meta.url));
test('fur keeps its artwork and per-dog materials without metallic flashing or shared disposal',()=>{
 const map=new T.Texture(),detail=new T.Texture(),material=new T.MeshStandardMaterial({map,metalness:1,metalnessMap:detail,roughness:.2,roughnessMap:detail,normalMap:detail});
 asset.scene.traverse(o=>{if((o as T.Mesh).isMesh)(o as T.Mesh).material=material;});
 const data=new Map([['DS_Boerboel_01',asset]]),a=new CompanionView(data),b=new CompanionView(data);
 const coats:T.MeshStandardMaterial[]=[];a.model.traverse(o=>{if((o as T.Mesh).isMesh)coats.push((o as T.Mesh).material as T.MeshStandardMaterial);});
 assert(coats.length);for(const coat of coats){assert.notEqual(coat,material);assert.equal(coat.map,map);assert.equal(coat.metalness,0);assert.equal(coat.metalnessMap,null);assert.equal(coat.roughnessMap,null);assert.equal(coat.roughness,.94);assert.equal(coat.normalMap,detail);}
 b.model.traverse(o=>{if((o as T.Mesh).isMesh)assert(!coats.includes((o as T.Mesh).material as T.MeshStandardMaterial));});
 assert.equal(material.metalness,1);let ownedDisposed=0,sharedDisposed=0;
 for(const coat of new Set(coats))coat.addEventListener('dispose',()=>ownedDisposed++);
 for(const resource of [material,map,detail])resource.addEventListener('dispose',()=>sharedDisposed++);
 a.dispose();a.dispose();assert.equal(ownedDisposed,new Set(coats).size);assert.equal(sharedDisposed,0);b.dispose();
});
test('walking dog does not snap a paw at the stance-release boundary',()=>{
 const view=new CompanionView(new Map([['DS_Boerboel_01',asset]])),bones:T.Object3D[]=[];
 view.model.traverse(o=>{if((o as T.Bone).isBone)bones.push(o);});let previous:T.Vector3[]|undefined,worst=0;
 for(let frame=0;frame<=1440;frame++){
  const time=frame/144;view.apply({x:0,y:0,z:2*time,heading:0,pitch:0,roll:0,speed:2,phase:time*gaitCadence(2),time,turnRate:0});
  const positions=bones.map(b=>view.root.worldToLocal(b.getWorldPosition(new T.Vector3())));
  if(previous)positions.forEach((p,i)=>worst=Math.max(worst,p.distanceTo(previous![i])));
  previous=positions;
 }
 assert(worst<.04,'single-frame bone displacement '+worst);view.dispose();
});
test('network dog banking and pounce use the same interpolated clock as translation',()=>{
 const a={...createBattleDog(createPose()),heading:Math.PI-.1,time:1,phase:1.9,jumpHeight:.1,jumpProgress:.4};
 const b={...a,x:1,time:1.05,phase:2.1,pitch:.2,roll:-.2,turnRate:2,heading:-Math.PI+.1,jumpHeight:.2,jumpProgress:.6};
 const before=JSON.stringify([a,b]),half=sampleBattleDog(a,b,.5);
 assert.equal(half.x,(a.x+b.x)/2);assert.equal(half.pitch,.1);assert.equal(half.roll,-.1);assert.equal(half.turnRate,1);
 assert(Math.abs(half.heading-Math.PI)<1e-10);assert(Math.abs(half.jumpHeight!-.15)<1e-10);assert.equal(half.jumpProgress,.5);assert.equal(half.phase,2);
 const landed={...b,jumpHeight:0,jumpProgress:0};assert(sampleBattleDog(b,landed,.8).jumpProgress!>b.jumpProgress);assert.equal(sampleBattleDog(b,landed,1).jumpProgress,0);
 assert.equal(JSON.stringify([a,b]),before);
});
test('helmet patches have positive shell clearance and outward-facing normals',()=>{
 const rider=new T.Group(),head=new T.Bone();head.name='Head';rider.add(head);const decal=new HelmetSkinDecal(rider);
 for(const o of decal.root.children){const m=o as T.Mesh,p=m.geometry.attributes.position,n=m.geometry.attributes.normal;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i)-1.705,z=p.getZ(i)+.018;
   assert((x/.143)**2+(y/.157)**2+(z/.150)**2>1.045);
   assert(x*n.getX(i)+y*n.getY(i)+z*n.getZ(i)>0);
  }assert.equal((m.material as T.Material).side,T.FrontSide);
 }
 const local=decal.root.matrix.clone();head.rotation.set(.4,.8,.2);rider.updateMatrixWorld(true);assert(decal.root.matrix.equals(local));decal.dispose();
});
