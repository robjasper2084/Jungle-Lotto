import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {animeRider} from './referenceActors.ts';
import {batchArmoredInk} from './riderInkBatch.ts';

test('armored ink keeps source layers, picking meshes and unshared bone poses',()=>{
 const scene=new T.Scene(),root=new T.Group(),armor=new T.Group(),bone=new T.Bone();
 scene.add(root);root.add(bone,armor);armor.name='Armored_Rider_Surface';
 const base=new T.Skeleton([bone]),otherBone=new T.Bone();
 const shape=new T.BoxGeometry();
 const count=shape.getAttribute('position').count;
 shape.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));
 shape.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4===0?1:0),4));
 const pieces=[0,1].map(()=>{
  const mesh=new T.SkinnedMesh(shape,new T.MeshStandardMaterial());armor.add(mesh);
  mesh.bind(base.clone(),new T.Matrix4());return mesh;
 });
 const independent=new T.SkinnedMesh(shape,new T.MeshStandardMaterial());
 root.add(independent);independent.bind(new T.Skeleton([otherBone]),new T.Matrix4());
 animeRider(root);assert.equal(pieces[0].skeleton,pieces[1].skeleton);assert.notEqual(pieces[0].skeleton,independent.skeleton);
 const outline=pieces[0].children[0] as T.SkinnedMesh,old=outline.material;
 batchArmoredInk(root,root);
 const batch=armor.getObjectByName('Anime ink · armored rider') as T.SkinnedMesh;
 const camera=new T.PerspectiveCamera(),update=()=>batch.onBeforeRender({} as T.WebGLRenderer,scene,camera,batch.geometry,batch.material as T.Material,null as unknown as T.Group);
 assert.equal(outline.parent,pieces[0]);assert.equal((outline.material as T.Material).side,T.BackSide);
 outline.layers.set(2);update();assert.equal(batch.geometry.drawRange.count,shape.index!.count);
 pieces[1].visible=false;update();assert.equal(batch.geometry.drawRange.count,0);
 outline.layers.set(0);pieces[1].visible=true;update();assert.equal(batch.geometry.drawRange.count,shape.index!.count*2);
 scene.remove(root);assert.equal(batch.parent,null);assert.equal(outline.material,old);
});
