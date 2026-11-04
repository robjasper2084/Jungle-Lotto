import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {makeRiverTraffic,riverClear,vesselPose,vesselRay,type VesselPose} from './riverTrafficPlan.ts';
import {createRiverTraffic} from './riverTraffic.ts';
import type {ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const fleet=makeRiverTraffic(map),blank=():VesselPose=>({x:0,z:0,heading:0,speed:0,visible:false,fade:0});
test('all shipping and fishing hulls remain in open river throughout their routes',()=>{
 for(const v of fleet)for(let i=0;i<1024;i++){
  const p=v.route.sample(v.route.length*i/1024,blank()),s=Math.sin(p.heading),c=Math.cos(p.heading);
  for(const fore of[-.5,0,.5])for(const side of[-.5,0,.5])assert(riverClear(map,p.x+s*v.length*fore+c*v.width*side,p.z+c*v.length*fore-s*v.width*side,2),v.id+' intersects shore at '+p.x+','+p.z);
 }
});
test('fixed seeded fleet contains industrial ships, slower excursion and anchored/patrolling fishing boats',()=>{
 assert.equal(fleet.filter(v=>v.kind==='freighter').length,2);assert.equal(fleet.filter(v=>v.kind==='tanker').length,1);const excursion=fleet.find(v=>v.kind==='excursion')!;assert(excursion.speed<fleet[0].speed);assert(excursion.route.closed);
 const fishing=fleet.filter(v=>v.kind==='fishing');assert.equal(fishing.length,8);assert(fishing.some(v=>v.anchored));assert(fishing.some(v=>!v.anchored));assert.deepEqual(makeRiverTraffic(map).map(v=>[v.id,v.speed,v.phase]),fleet.map(v=>[v.id,v.speed,v.phase]));
});
test('shipping route recycling and render-distance boundaries fade out without a visible jump',()=>{
 const v=fleet[0],end=v.route.samples[0],time=(1-v.phase)*v.route.length/v.speed;const p=vesselPose(v,time,end.x,end.z,blank());assert(p.fade<.001);assert(!p.visible);
 const mid=vesselPose(v,0,0,0,blank());const far=vesselPose(v,0,mid.x+v.range+10,mid.z,blank());assert(!far.visible);assert.equal(far.fade,0);
});
test('boats move in metres per second, anchored boats hold their position',()=>{
 for(const v of fleet){const a=vesselPose(v,0,0,0,blank()),b=vesselPose(v,1,0,0,blank());const delta=Math.hypot(a.x-b.x,a.z-b.z);assert(Math.abs(delta-v.speed)<.12,v.id);}
});
test('vessel collider checks rotated hulls while allowing overflight',()=>{
 const v=fleet[0],p=blank();p.heading=Math.PI/2;
 assert(vesselRay(v,p,{x:0,y:5,z:50},{x:0,y:0,z:-1},100)!>0);
 assert.equal(vesselRay(v,p,{x:0,y:50,z:50},{x:0,y:0,z:-1},100),null);
 assert.equal(vesselRay(v,p,{x:300,y:5,z:50},{x:0,y:0,z:-1},100),null);
});
test('fleet geometry is finite, bounded and reused during updates; pause freezes boats',()=>{
 const scene=new T.Scene(),traffic=createRiverTraffic(scene,map);let vertices=0,meshes=0;scene.traverse(o=>{if(o instanceof T.Mesh){meshes++;vertices+=o.geometry.attributes.position.count;for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));}});
 assert(meshes<=90);assert(vertices<180000);const root=scene.children[0],count=root.children.length;
 traffic.update(0,1000,1800,0,1);traffic.update(1,1000,1800,0,1);const at=root.children[0].position.clone();traffic.update(5,1000,1800,0,1,false);assert(root.children[0].position.equals(at));for(let i=0;i<1000;i++)assert(traffic.update(5+i/60,1000,1800,1,.2).length<=4);assert.equal(root.children.length,count);
});
