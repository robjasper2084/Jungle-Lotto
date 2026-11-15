import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {ParkTerrain,segment,type ParkMap} from './terrain.ts';
import {referenceSpawn} from './sunsetReferencePolicy.ts';
import {REFERENCE_PLACES} from './referenceIsland.ts';
import {addSunsetGarden} from './sunsetGarden.ts';
import {referenceGate,referenceRoute} from './referenceRace.ts';
import {referenceTree} from './referenceTrees.ts';
import type {Solid} from './flightCollision.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('all preview locations use navigable roads and new park fittings leave travel lanes clear',()=>{
 const terrain=new ParkTerrain(map),solids:Solid[]=[],add=terrain.flightSolids.add.bind(terrain.flightSolids);terrain.flightSolids.add=s=>{solids.push(s);add(s);};
 const routes=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width})));
 for(const [i,place]of REFERENCE_PLACES.entries()){
  const p=referenceSpawn(map,place);assert(terrain.land(p.x,p.z),place.name+' spawn on land');assert(!terrain.obstructed(p.x,p.z,1.5),place.name+' spawn clear');
  if(!i)continue;const garden=addSunsetGarden(new T.Scene(),map,terrain,{...place,trees:0,seed:209585+i-1,shore:place.name!=='Belle Isle Beach'});assert(garden.stats.lamps>0,place.name+' has detailed shoulders');assert.equal(garden.stats.trees,0);if(place.name==='Belle Isle Beach')assert.equal(garden.stats.rocks,0,'sandy beach retains its shoreline');
 }
 for(const s of solids){const clearance=Math.min(...routes.map(r=>segment(s.x,s.z,r.a,r.b).d-r.w*.5));assert(clearance>s.radius+.15,`${s.kind} overlaps lane at ${s.x},${s.z}`);}
});
test('illuminated gate structures stay outside each playable aperture',()=>{
 for(const [r,h,ground]of [[2.6,2.8,true],[12,9,false],[20,14,false]] as const){
  const gate=referenceGate(r,h,ground);gate.updateMatrixWorld(true);gate.traverse(o=>{if(!(o instanceof T.Mesh))return;const p=o.geometry.getAttribute('position'),v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const ellipse=(v.x/r)**2+((v.y-(ground?.1:0))/h)**2;assert(ellipse>=1-1e-6,'frame intrudes on scored aperture');}});
 }
 const arrows=referenceRoute([{x:0,y:0,z:0},{x:0,y:0,z:100}],true);assert(arrows.count>1);assert(!arrows.castShadow);
});
test('tree LODs keep full silhouettes within mapped mature-tree scale',()=>{
 for(const id of ['maple','birch','willow','pine'])for(const low of [false,true]){const tree=referenceTree(id,low,16);for(const geometry of [tree.trunk,tree.leaves]){geometry.computeBoundingBox();const b=geometry.boundingBox!;assert(b.min.y>=-.1);assert(b.max.y<24);assert(b.max.x-b.min.x<22);const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}if(low)assert(tree.leaves.getAttribute('position').count<25000);}
});
