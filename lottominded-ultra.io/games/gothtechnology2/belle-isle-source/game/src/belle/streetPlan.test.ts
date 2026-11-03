import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathSamples,strokePieces,createStreetPlan,roadIndex} from './streetPlan.ts';
import {ParkTerrain,inside,type ParkMap} from './terrain.ts';
test('road sample spacing continues across source segments without bunching',()=>{
 const a=pathSamples([[0,0],[0,1],[0,2],[0,18]],6);
 assert.deepEqual(a.map(p=>p.z),[3,9,15]);
 assert(a.every(p=>p.dx===0&&p.dz===1));
});
test('curb and solid paint meet at the same corner without a sideways step',()=>{
 const path:[[number,number],[number,number],[number,number]]=[[0,0],[0,10],[10,10]];
 const all=strokePieces(path,0,20,2),left=strokePieces(path,0,10,2),right=strokePieces(path,10,20,2);
 assert.equal(all.length,2);assert.deepEqual(all[0].b,all[1].a);
 assert.deepEqual(left[0].b,right[0].a);assert.deepEqual(left[0].b,[2,8]);
 const sharp=strokePieces([[0,0],[0,10],[.1,0]],0,21,2);
 assert(Math.hypot(sharp[0].b[0],sharp[0].b[1]-10)<=3.60001);
});
test('crossing corridor prevents a curb or sign even beside another road',()=>{
 const roads=[{id:'a',name:'a',points:[[0,-20],[0,20]],width:6,foot:false,bridge:false,surface:'asphalt'},{id:'b',name:'b',points:[[-20,0],[20,0]],width:3,foot:true,bridge:false,surface:'concrete'}] as ParkMap['roads'];
 const occupied=roadIndex(roads);
 assert.equal(occupied(3.2,0,'a',.4),true);
 assert.equal(occupied(3.2,10,'a',.4),false);
});
const data=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const plan=createStreetPlan(data),terrain=new ParkTerrain(data),occupied=roadIndex(data.roads);
test('real map detail stays finite and signs clear all driving/walking corridors',()=>{
 assert(plan.signs.length>20&&plan.signs.length<80);
 assert(plan.boxes.length<50000); // Includes previously omitted service-road curbs.
 for(const s of plan.signs){assert(terrain.land(s.x,s.z));assert.equal(occupied(s.x,s.z,'',.85),false,s.title);}
 for(const b of plan.boxes)assert([b.x,b.y,b.z,b.w,b.h,b.l,b.yaw].every(Number.isFinite));
});
test('curbs preserve openings through the complete road/path network',()=>{
 for(const b of plan.boxes.filter(b=>b.road&&b.material==='curb')){
  const dx=Math.sin(b.yaw),dz=Math.cos(b.yaw);
  for(const d of[-b.l/2,0,b.l/2])assert.equal(occupied(b.x+dx*d,b.z+dz*d,b.road,.35),false,b.road);
 }
});
test('bridge detail rests on the elevated deck, not the lower shoreline',()=>{
 const elevated=plan.boxes.filter(b=>terrain.bridge(b.x,b.z).active);
 assert(elevated.length>600);
 for(const b of elevated)assert(Math.abs(b.y-terrain.height(b.x,b.z))<.2);
});

test('graded curb ends follow the bridge approaches without visible stair steps',()=>{
 const rampCurbs=plan.boxes.filter(b=>b.material==='curb'&&Math.abs(b.grade||0)>.001);
 assert(rampCurbs.length>20);
 for(const b of rampCurbs)for(const end of[-1,1]){
  const d=end*b.l/2,x=b.x+Math.sin(b.yaw)*d,z=b.z+Math.cos(b.yaw)*d;
  assert(Math.abs((b.y+(b.grade||0)*d)-(terrain.height(x,z)+.14))<.04,JSON.stringify(b));
 }
});

test('conservatory facility sign remains at the west approach, clear of the pond view',()=>{
 const c=data.conservatory!,sign=plan.signs.find(s=>s.title==='Anna Scripps Whitcomb Conservatory');assert(sign);
 const u=(sign.x-c.center[0])*Math.cos(c.yaw)-(sign.z-c.center[1])*Math.sin(c.yaw);assert(u< -18);
});

test('unnamed museum service road receives curbs without closing the plaza',()=>{
 const curbs=plan.boxes.filter(b=>b.road&&b.material==='curb');
 assert(curbs.some(b=>b.road==='1123366394'));
 const plazas=data.areas.filter(a=>a.kind==='pedestrian');
 for(const b of curbs)assert(!plazas.some(a=>inside(b.x,b.z,a.points)&&!(a.holes||[]).some(h=>inside(b.x,b.z,h))),b.road);
});
