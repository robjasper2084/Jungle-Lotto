import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {playgrounds,playgroundLandmarks,playgroundBlocked,playgroundRay} from './playgrounds.ts';
import volumes from './playgroundSolids.json' with {type:'json'};
import {ParkTerrain,inside,segment,type ParkMap,type Point} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const terrain=new ParkTerrain(map);
test('both Detroit playgrounds use their mapped play-area boundaries and safe arrival paths',()=>{
 assert.equal(playgrounds.length,2);assert.equal(new Set(playgroundLandmarks.map(p=>p.id)).size,2);
 for(const p of playgrounds){const area=map.areas.find(a=>a.id===p.id);assert.equal(area?.kind,'playground');assert.deepEqual(p.polygon,area.points);assert(terrain.land(p.view[0],p.view[1]),p.name);assert(!terrain.obstructed(p.view[0],p.view[1],1.4),p.name);assert(map.roads.some(r=>r.foot&&r.points.slice(1).some((b,i)=>segment(p.view[0],p.view[1],r.points[i],b).d<r.width/2)),p.name+' arrival on path');}
});
test('equipment remains inside each mapped play area and out of through paths',()=>{
 for(const v of volumes){const site=playgrounds.find(p=>p.id===v.site)!;const x=(v.min[0]+v.max[0])/2,z=(v.min[2]+v.max[2])/2;
  assert(inside(x,z,site.polygon as Point[]),site.name+' equipment outside area at '+x+','+z);
 }
 const kidsPath=map.roads.find(r=>r.id==='107202911')!,oakPath=map.roads.find(r=>r.id==='946151852')!;
 for(const path of [kidsPath,oakPath])for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));
  for(let k=0;k<=steps;k++){const x=a[0]+(b[0]-a[0])*k/steps,z=a[1]+(b[1]-a[1])*k/steps;assert(!playgroundBlocked(x,z,.65),'path '+path.id+' blocked at '+x+','+z);}
 }
});
test('equipment blocks riders and flying vehicles while distant ground and overhead space stay clear',()=>{
 const v=volumes.find(v=>v.site==='107202881'&&v.min[1]<2.2&&v.max[1]>4)!;
 const x=(v.min[0]+v.max[0])/2,z=(v.min[2]+v.max[2])/2;assert(playgroundBlocked(x,z));
 assert.notEqual(terrain.raycastObstacle({x:x-3,y:2.7,z},{x:1,y:0,z:0},5,.3),null);
 assert.notEqual(terrain.raycastFlight({x:x-3,y:3,z},{x:1,y:0,z:0},5,.3),null);
 assert.equal(playgroundRay({x,y:20,z},{x:1,y:0,z:0},10,.3,true),null);
 assert.equal(playgroundBlocked(0,0),false);assert.equal(playgroundRay({x:0,y:3,z:0},{x:1,y:0,z:0},20),null);
});
test('Blender exports finite, bounded, material-batched playground geometry',()=>{
 const buf=fs.readFileSync(new URL('../../public/belle/playgrounds.glb',import.meta.url));assert.equal(buf.readUInt32LE(0),0x46546c67);const gltf=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString());
 for(const prefix of ['Kids_Row','Oakway_Sigma_Gamma'])assert(gltf.meshes.some((m:any)=>m.name.startsWith(prefix)));
 assert(gltf.meshes.length<=28);assert(buf.length<3*1024*1024);
 for(const m of gltf.meshes)for(const p of m.primitives){const a=gltf.accessors[p.attributes.POSITION];assert([...a.min,...a.max].every(Number.isFinite));assert(a.min[1]>=2);assert(a.max[1]<10);}
 for(const v of volumes){assert([...v.min,...v.max].every(Number.isFinite));assert(v.min.every((n,i)=>n<=v.max[i]));}
});
