import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {addPondServiceBuildings,POND_SERVICE_IDS} from './pondServiceBuildings.ts';
import {addServiceBuildings} from './serviceBuildings.ts';
import type {ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
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
