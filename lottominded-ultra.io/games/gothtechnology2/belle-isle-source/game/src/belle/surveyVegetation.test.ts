import {oakwayRoof} from './oakwayRoof.ts';
import {addWoodsideBank} from './woodsideBank.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {ParkTerrain,segment,type ParkMap} from './terrain.ts';
import {surveySites} from './surveySites.ts';
import {addSurveyVegetation,keepOriginalTree} from './surveyVegetation.ts';

test('the three mapped sectors keep crowns off paths and all geometry inside its cached bounds',async t=>{
 t.mock.method(T.TextureLoader.prototype,'loadAsync',async()=>new T.Texture());
 const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
 const terrain=new ParkTerrain(map,true),scene=new T.Scene();
 await addSurveyVegetation(scene,terrain);
 assert.equal(scene.children.length,surveySites.length);
 assert.equal(keepOriginalTree({x:2923,z:644}),false);
 for(const [i,object] of scene.children.entries()){
  const mesh=object as T.Mesh<T.BufferGeometry>,g=mesh.geometry,vertices=g.getAttribute('position');
  assert.equal(vertices.count,8*surveySites[i].plants.length);
  assert.equal(g.index!.count/3,4*surveySites[i].plants.length);
  assert.ok(mesh.frustumCulled);
  for(let j=0;j<vertices.count;j++){
   const p=new T.Vector3().fromBufferAttribute(vertices,j);
   assert.ok(g.boundingBox!.containsPoint(p));
   assert.ok(p.distanceTo(g.boundingSphere!.center)<=g.boundingSphere!.radius+1e-6);
  }
  for(const [dx,dz,h,kind] of surveySites[i].plants){
   const x=surveySites[i].anchor[0]+dx,z=surveySites[i].anchor[1]+dz;
   assert.ok(terrain.land(x,z));
   const radius=h*(kind==='tree'?.29:.5);
   for(const r of map.roads)for(let j=1;j<r.points.length;j++){
    assert.ok(segment(x,z,r.points[j-1],r.points[j]).d>r.width/2+radius,'crown overlaps '+r.name);
   }
  }
 }
});

test('Oakway roof material uploads once and Woodside stones remain on the mapped channel edge',()=>{
 const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
 const site=map.facilities!.sites.find(s=>s.name==='Oakway Refectory')!;
 const roof=oakwayRoof(site.center,5.88);
 assert.equal(roof.material.map!.version,1);
 roof.geometry.computeBoundingBox();const box=roof.geometry.boundingBox!;
 assert.ok(box.max.x-box.min.x>17&&box.max.z-box.min.z>15);
 const scene=new T.Scene();addWoodsideBank(scene,map);
 const bank=scene.children[0] as T.InstancedMesh;
 assert.ok(bank.count>=30&&bank.count<160);
 for(let i=0;i<bank.count;i++){
  const m=new T.Matrix4();bank.getMatrixAt(i,m);
  const [x,,z]=new T.Vector3().setFromMatrixPosition(m).toArray();
  assert.ok(x>=2686&&x<=2714&&z>=730&&z<=780);
  assert.ok(map.water.some(w=>w.points.some((p,j)=>j>0&&segment(x,z,w.points[j-1],p).d<.01)));
 }
});
