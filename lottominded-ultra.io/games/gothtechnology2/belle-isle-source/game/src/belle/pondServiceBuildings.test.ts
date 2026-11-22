import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {addPondServiceBuildings,POND_SERVICE_IDS} from './pondServiceBuildings.ts';
import {addServiceBuildings} from './serviceBuildings.ts';
import {addParkFacilities} from './parkFacilities.ts';
import type {ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
test('facility multi-draw preserves the 520 metre boundary, tile bounds, and shadow participation',()=>{
 const fences=([20,600] as const).map(x=>({id:String(x),a:[x,20] as [number,number],b:[x+4,20] as [number,number],height:1.3,style:'stone' as const}));
 const twoTiles={...map,facilities:{version:1,notes:'',sites:[],gates:[],fences}};
 const before=new T.Scene(),after=new T.Scene(),original=addParkFacilities(before,twoTiles,false),joined=addParkFacilities(after,twoTiles,true);
 assert.deepEqual(joined.stats,original.stats);assert.equal(after.children.length,1);
 const batch=after.children[0] as T.BatchedMesh;assert(batch.isBatchedMesh);assert(batch.castShadow&&batch.receiveShadow&&batch.perObjectFrustumCulled);
 const box=new T.Box3();
 for(const [i,mesh] of before.children.entries()){
  const g=(mesh as T.Mesh).geometry;g.computeBoundingBox();
  const bounds=batch.getBoundingBoxAt(batch.getGeometryIdAt(i),box);
  assert(bounds&&bounds.equals(g.boundingBox!));
 }
 for(const x of [48,567.999,568,624,1144,48]){
  joined.update(x,48);original.update(x,48);
  assert.deepEqual(before.children.map(o=>o.visible),[batch.getVisibleAt(0),batch.getVisibleAt(1)]);
 }
 batch.dispose();
});
test('mapped pond buildings retain their source data and replace the generic wall/roof rendering',()=>{
 const subset={...map,buildings:map.buildings.filter(b=>POND_SERVICE_IDS.has(b.id))},before=JSON.stringify(subset.buildings),scene=new T.Scene();
 addServiceBuildings(scene,subset);assert.equal(JSON.stringify(subset.buildings),before);
 assert.equal(scene.children.length,1);assert.equal(scene.children[0].name,'Inselruhe growing houses and service courtyard');
 const glass=scene.children[0].children.find(o=>o.name.includes('glass')) as T.Mesh;assert(glass);assert(glass.geometry.boundingBox!.max.y>5.6);
 assert(glass.geometry.boundingBox!.min.y>=2.4);
});
test('reference buildings stay finite and inexpensive without new texture downloads or lights',()=>{
 const scene=new T.Scene(),v=addPondServiceBuildings(scene,map);assert.equal(v.stats.buildings,3);assert.equal(v.stats.growingHouses,7);assert(v.stats.triangles<30000);assert(v.stats.batches<=11);
 for(const o of v.root.children){assert(o instanceof T.Mesh);assert(o.frustumCulled);assert(!Array.isArray(o.material)&&!(o.material as T.MeshStandardMaterial).map);for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));}
 v.dispose();assert.equal(scene.children.length,0);
});
