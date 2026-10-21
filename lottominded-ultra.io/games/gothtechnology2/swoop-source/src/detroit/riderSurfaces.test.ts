import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {RiderSurfaces} from './riderSurfaces.ts';
import {rigModel} from './heroTestAssets.ts';
import {Hero} from './actors.ts';
import {createPose} from './controller.ts';
import {assetPath} from './testAssets.ts';

test('legacy nylon loses metallic highlights without altering gear, artwork or another rider',()=>{
 const texture=new T.Texture(),cloth=new T.MeshPhysicalMaterial({metalness:1,roughness:.87,map:texture,specularColor:new T.Color(2,2,2)});
 cloth.name='Dark riding garments / original UV detail';const visor=new T.MeshStandardMaterial({metalness:.52,roughness:.19});
 const a=new T.Group(),b=new T.Group();a.add(new T.Mesh(new T.BoxGeometry(),[cloth,visor]));b.add(a.children[0].clone());
 const sa=new RiderSurfaces(a),sb=new RiderSurfaces(b),ma=(a.children[0] as T.Mesh).material as T.MeshPhysicalMaterial[],mb=(b.children[0] as T.Mesh).material as T.MeshPhysicalMaterial[];
 assert.equal(ma[0].metalness,0);assert.equal(ma[0].map,texture);assert.equal(ma[0].roughness,.87);assert.equal(ma[0].specularIntensity,.35);
 assert.equal(ma[1],visor);assert.equal(cloth.metalness,1);assert.notEqual(ma[0],mb[0]);
 let disposed=0,shared=0;ma[0].addEventListener('dispose',()=>disposed++);for(const resource of [cloth,visor,texture])resource.addEventListener('dispose',()=>shared++);
 sa.dispose();sa.dispose();assert.equal(disposed,1);assert.equal(shared,0);sb.dispose();
});

test('helmet artwork clears the shipped skinned helmet trim and collar during mounted turns',async()=>{
 const rider=await rigModel(new URL('../../public/exports/rigged-heroes/DS_Armored_Rider_01.glb',import.meta.url));
 const wheel=await rigModel(assetPath('exports/glb/DS_EUC_01/DS_EUC_01_LOD1.glb'));
 const hero=new Hero(new Map([['DS_Armored_Rider_01',rider],['DS_EUC_01',wheel]]),undefined,'DS_Armored_Rider_01');
 const decal=hero.rider.getObjectByName('GothTech Ghoulies / helmet skin')!,meshes:T.SkinnedMesh[]=[];
 hero.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh){const m=o as T.SkinnedMesh;(m.material as T.Material).side=T.DoubleSide;meshes.push(m);}});
 const ray=new T.Raycaster();ray.far=.3;
 try{for(const look of [-1,0,1]){
  hero.apply({...createPose(),speed:10,rollAngle:.15,riderRoll:.2,riderLookYaw:look,riderTurnTwist:look*.4});hero.root.updateMatrixWorld(true);
  for(const mesh of meshes){mesh.skeleton.update();mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  const center=decal.localToWorld(new T.Vector3(0,1.705,-.018));
  for(const o of decal.children){const patch=o as T.Mesh,points=patch.geometry.attributes.position,material=patch.material as T.Material;
   assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);
   // Include every edge and intermediate rows; the old patch intersects the
   // temple rails and lower collar despite clearing an ideal ellipsoid.
   for(let row=0;row<=16;row+=4)for(let col=0;col<=20;col+=4){
    const point=patch.localToWorld(new T.Vector3().fromBufferAttribute(points,row*21+col)),direction=point.clone().sub(center),distance=direction.length();
    ray.set(center,direction.normalize());const hit=ray.intersectObjects(meshes,false).at(-1);
    assert(hit,'helmet shell missing');assert(distance-hit.distance>.001,'helmet print intersects '+hit.object.name+' at '+row+','+col+' looking '+look);
   }
  }
 }}finally{hero.dispose();}
});
