import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {ParkTerrain,segment,type ParkMap} from './terrain.ts';
import {addSunsetGarden} from './sunsetGarden.ts';
import {referenceSpawn,SUNSET_GARDEN} from './sunsetReferencePolicy.ts';
import type {Solid} from './flightCollision.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('reference spawn stays on a clear motor road facing the point',()=>{const p=referenceSpawn(map),terrain=new ParkTerrain(map);assert(terrain.land(p.x,p.z));assert(!terrain.obstructed(p.x,p.z,2));assert(Math.sin(p.heading)<-.8);assert(map.roads.some(r=>!r.foot&&r.points.some((b,i)=>i>0&&segment(p.x,p.z,r.points[i-1],b).d<.1)));});
test('scenery geometry and collision remain bounded and keep route shoulders clear',async()=>{
 const scene=new T.Scene(),terrain=new ParkTerrain(map),solids:Solid[]=[];const add=terrain.flightSolids.add.bind(terrain.flightSolids);terrain.flightSolids.add=s=>{solids.push(s);add(s);};const garden=await addSunsetGarden(scene,map,terrain);
 assert(garden.stats.trees>30&&garden.stats.trees<=95);assert.equal(garden.stats.leaves,garden.stats.trees*2400);
 const canopies=garden.root.getObjectByName('Reference full autumn maple canopies')!;
 const stands=canopies.children;
 assert(stands.length>1&&stands.length<garden.stats.trees);
 const m=new T.Matrix4(),leaf=new T.Sphere();
 let leaves=0;
 for(const stand of stands){
  assert(stand instanceof T.InstancedMesh);
  assert(stand.castShadow&&stand.receiveShadow&&stand.frustumCulled);
  assert(stand.instanceColor&&stand.instanceColor.count===stand.count);
  const bound=stand.boundingSphere;assert(bound&&stand.geometry.boundingSphere);
  for(let i=0;i<stand.count;i++){
   stand.getMatrixAt(i,m);leaf.copy(stand.geometry.boundingSphere).applyMatrix4(m);
   assert(leaf.center.distanceTo(bound.center)+leaf.radius<=bound.radius);
  }
  leaves+=stand.count;
 }
 assert.equal(leaves,garden.stats.leaves);
 const bridge=new T.PerspectiveCamera(60,1.6,.1,20000);
 bridge.position.set(372,11,671);bridge.lookAt(372.48,11,671.87);bridge.updateMatrixWorld();
 const view=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(bridge.projectionMatrix,bridge.matrixWorldInverse));
 const inView=stands.filter(stand=>view.intersectsObject(stand));
 assert(inView.length>0&&inView.length<stands.length);
 const routes=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width})));
 for(const s of solids){assert(terrain.land(s.x,s.z));assert(Math.hypot(s.x-SUNSET_GARDEN.x,s.z-SUNSET_GARDEN.z)<345);const clearance=Math.min(...routes.map(r=>segment(s.x,s.z,r.a,r.b).d-r.w*.5));assert(clearance>s.radius+.15,`${s.kind} overlaps route at ${s.x},${s.z}`);}
 garden.root.traverse(o=>{if(o instanceof T.Mesh){const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)));}});
 garden.setQuality('smooth');assert.equal(garden.root.getObjectByName('Reference full autumn maple canopies')!.visible,false);garden.setQuality('high');assert.equal(garden.root.getObjectByName('Reference full autumn maple canopies')!.visible,true);
 garden.update(3000,3000);assert.equal(garden.root.visible,false);garden.update(0,1450);assert.equal(garden.root.visible,true);
});
