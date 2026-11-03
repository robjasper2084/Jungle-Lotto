import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {ParkTerrain,inside,segment,type ParkMap} from './terrain.ts';
const data=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;const terrain=new ParkTerrain(data);
test('spawn is on the Jefferson approach and close to a mapped road',()=>{assert(terrain.land(data.spawn.x,data.spawn.z));assert(data.roads.some(r=>!r.foot&&r.points.slice(1).some((p,i)=>segment(data.spawn.x,data.spawn.z,r.points[i],p).d<r.width/2)));});
test('the full bridge centerline supports the rider without a water collision',()=>{const b=data.bridge;for(let i=0;i<=100;i++){const x=b.a[0]+(b.b[0]-b.a[0])*i/100,z=b.a[1]+(b.b[1]-b.a[1])*i/100;assert(terrain.land(x,z),'bridge gap at '+i);const g={height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false};terrain.sampleGround(x,z,g);assert(g.height>=1.99&&g.height<=10.01);assert(g.normal.y>.98);}});
test('river and lagoon interiors block travel; shoreline stays dry',()=>{assert(!terrain.land(0,1000));assert(terrain.land(data.landmarks.find(l=>l.name==='Belle Isle Casino')!.x,data.landmarks.find(l=>l.name==='Belle Isle Casino')!.z));});
test('bridge barrier blocks lateral travel',()=>{const b=data.bridge,x=(b.a[0]+b.b[0])/2,z=(b.a[1]+b.b[1])/2,dx=(b.b[1]-b.a[1])/b.length,dz=-(b.b[0]-b.a[0])/b.length;const hit=terrain.raycastObstacle({x,y:10.5,z},{x:dx,y:0,z:dz},20);assert(hit!==null&&hit>10&&hit<14);});
test('vertical and angled ground rays meet the deck at the sampled height',()=>{const b=data.bridge,x=b.a[0]+(b.b[0]-b.a[0])*.3,z=b.a[1]+(b.b[1]-b.a[1])*.3;let ray={x:.1,y:-1,z:.1},o={x,y:terrain.height(x,z)+4,z},t=terrain.raycast(o,ray,10)!;assert(t>0);assert(Math.abs(o.y+ray.y*t-terrain.height(x+ray.x*t,z+ray.z*t))<.001);});
test('every featured destination has a reachable road or path within 150 metres',()=>{for(const l of data.landmarks){const points=data.roads.flatMap(r=>r.points).filter(p=>terrain.land(p[0],p[1])&&!terrain.boxes.some(b=>p[0]>b.minX-2&&p[0]<b.maxX+2&&p[1]>b.minZ-2&&p[1]<b.maxZ+2));assert(points.some(p=>Math.hypot(p[0]-l.x,p[1]-l.z)<150),l.name);}});

test('bridge approach ramps join the deck smoothly on both shores',()=>{const b=data.bridge,ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;let last=2;for(let s=-180;s<=b.length+110;s+=.5){const x=b.a[0]+ux*s,z=b.a[1]+uz*s,h=terrain.height(x,z);assert(Math.abs(h-last)<.04,'abrupt ramp at '+s);assert(terrain.land(x,z),'dry access gap at '+s);last=h;}assert(Math.abs(last-2)<.01);});
test('mapped mainland shoreline is aligned with water collision',()=>{assert(data.shoreline.length>200);let checks=0;for(let i=1;i<data.shoreline.length;i+=13){const a=data.shoreline[i-1],b=data.shoreline[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,nx=(b[1]-a[1])/len,nz=-(b[0]-a[0])/len;if(Math.abs(terrain.bridge(x,z).side)<20)continue;const p=inside(x+nx,z+nz,data.mainland),q=inside(x-nx,z-nz,data.mainland);if(p===q)continue;assert(terrain.land(x+(p?nx:-nx),z+(p?nz:-nz)));assert(!terrain.land(x+(p?-nx:nx),z+(p?-nz:nz)));checks++;}assert(checks>5);});

test('ground-level underpass and bridge deck remain separate',()=>{const b=data.bridge;let verified=0;for(let i=1;i<99;i++){const t=i/100,x=b.a[0]+(b.b[0]-b.a[0])*t,z=b.a[1]+(b.b[1]-b.a[1])*t;if(!inside(x,z,data.island)&&!inside(x,z,data.mainland))continue;const g={height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false};terrain.sampleGround(x,z,g,2);assert.equal(g.height,2);terrain.sampleGround(x,z,g,6);assert(g.height>=6);verified++;}assert(verified>0);const x=(b.a[0]+b.b[0])/2,z=(b.a[1]+b.b[1])/2;assert(!terrain.land(x,z,2));assert(terrain.land(x,z,10));});

test('both full-width bridge edges stay level with the centerline',()=>{const b=data.bridge,ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;for(let i=0;i<=150;i++){const x=b.a[0]+ux*b.length*i/150,z=b.a[1]+uz*b.length*i/150,h=terrain.height(x,z);for(const side of[-13,13])assert(Math.abs(terrain.height(x+uz*side,z-ux*side)-h)<.001,'deck edge dropped at '+i);}});

test('Yacht Club has its mapped dry islet in geometry and collision',()=>{
 const club=data.landmarks.find(l=>l.name==='Detroit Yacht Club')!;
 assert(data.outerIslets?.some(i=>inside(club.x,club.z,i.points)));
 assert(data.landPolygons?.some(p=>inside(club.x,club.z,p[0])&&!p.slice(1).some(h=>inside(club.x,club.z,h))));
 assert(terrain.land(club.x,club.z));
 assert.equal(data.buildings.filter(b=>b.id===club.id).length,1);
});
