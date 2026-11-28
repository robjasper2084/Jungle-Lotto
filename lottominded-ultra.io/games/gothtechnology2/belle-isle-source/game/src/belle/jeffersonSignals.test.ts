import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createJeffersonSignals} from './jeffersonSignals.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import originalDistricts from './detroitDistricts.json' with {type:'json'};
import type {SignalRoad} from './jeffersonSignalPlan.ts';
const map=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const originalRoads=[...map.roads,...originalDistricts.roads] as unknown as SignalRoad[];

test('signal construction is bounded, uses no new lights, and preserves collisions',()=>{
 const scene=new T.Scene(),terrain=new ParkTerrain(map,true),before=JSON.stringify(terrain.boxes);
 const signals=createJeffersonSignals(scene,terrain,{roads:originalRoads});
 assert.equal(signals.stats.renderedIntersections,7);assert.equal(signals.stats.headCount,36);assert.equal(signals.stats.fixtureCount,22);
 assert.equal(signals.stats.batches,28);assert.ok(signals.stats.triangles<25000);
 const root=scene.getObjectByName('Jefferson mapped traffic signals')!;
 let lights=0,materials=new Set<T.Material>();
 root.traverse(o=>{if(o instanceof T.Light)lights++;if(o instanceof T.Mesh){assert.equal(o.matrixAutoUpdate,false);const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(v=>materials.add(v));}});
 assert.equal(lights,0);assert.equal(materials.size,4);
 assert.ok(root.children.every(g=>g.userData.warmIslandShaders===true&&!g.visible));
 assert.equal(JSON.stringify(terrain.boxes),before);signals.dispose();
});
test('unchanged phases do no matrix or color uploads; phase changes only update lens colors',()=>{
 const scene=new T.Scene(),signals=createJeffersonSignals(scene,new ParkTerrain(map,true),{roads:originalRoads});
 const lenses:T.InstancedMesh[]=[];scene.traverse(o=>{if(o instanceof T.InstancedMesh)lenses.push(o);});
 const matrices=lenses.map(m=>Array.from(m.instanceMatrix.array)),versions=lenses.map(m=>m.instanceMatrix.version);
 signals.update(0,14,-25);const colors=lenses.map(m=>m.instanceColor!.version),updates=signals.stats.lensColorUpdates;
 signals.update(.01,15,-25);assert.deepEqual(lenses.map(m=>m.instanceColor!.version),colors);assert.equal(signals.stats.lensColorUpdates,updates);
 signals.update(46,15,-25);assert.ok(signals.stats.lensColorUpdates>updates);
 assert.deepEqual(lenses.map(m=>Array.from(m.instanceMatrix.array)),matrices);assert.deepEqual(lenses.map(m=>m.instanceMatrix.version),versions);
 const color=new T.Color();signals.update(NaN,15,-25);
 for(const m of lenses)for(let i=0;i<m.count;i++){m.getColorAt(i,color);if(i%3===0)assert.ok(color.r>.9);else assert.ok(Math.max(color.r,color.g,color.b)<.1);}
 signals.dispose();
});
test('junction distance selection and disposal leave unrelated scene content intact',()=>{
 const scene=new T.Scene(),unrelated=new T.Group();unrelated.name='existing world';scene.add(unrelated);
 const signals=createJeffersonSignals(scene,new ParkTerrain(map,true),{roads:originalRoads}),root=scene.getObjectByName('Jefferson mapped traffic signals')!;
 signals.update(0,14,-25);assert.equal(signals.stats.visibleJunctions,1);assert.ok(root.children[0].visible);
 signals.update(0,9000,9000);assert.equal(signals.stats.visibleJunctions,0);assert.ok(root.children.every(g=>!g.visible));
 signals.dispose();signals.dispose();signals.update(0,14,-25);
 assert.equal(scene.children.length,1);assert.equal(scene.children[0],unrelated);
});
