import test from 'node:test';import assert from 'node:assert/strict';
import {clearRailSpans,gateDirection,MAPPED_ACCESS} from './waterfrontRails.ts';
import {WATERFRONT} from './waterfrontSite.ts';
import {HARBOR_GANGWAY,harborGangwayPoints,harborGangwayEdges} from './harborLayout.ts';
test('a crossing path is clear and a safety rail outside a parallel path remains',()=>{
 const crossing=clearRailSpans([-10,0],[10,0],[{a:[0,-5],b:[0,5],width:3}],[]);
 assert.equal(crossing.length,2);assert.ok(crossing[0].b[0]<=-1.85+1e-9);assert.ok(crossing[1].a[0]>=1.85-1e-9);
 assert.deepEqual(clearRailSpans([-10,0],[10,0],[{a:[-10,2.5],b:[10,2.5],width:3}],[]),[{a:[-10,0],b:[10,0]}]);
});
test('rails inside a parallel path and across a short path endpoint are removed',()=>{
 assert.deepEqual(clearRailSpans([-10,0],[10,0],[{a:[-10,1],b:[10,1],width:3}],[]),[]);
 const spans=clearRailSpans([-10,0],[10,0],[{a:[0,-5],b:[0,-.75],width:3}],[]);
 assert.equal(spans.length,2);assert.ok(spans[0].b[0]<-1.69);assert.ok(spans[1].a[0]>1.69);
});
test('the full Atwater sidewalk stays clear, beyond just the vehicle lane',()=>{
 const crossing=MAPPED_ACCESS.find(p=>p.a[0]===-75.96&&p.a[1]===-1223.39&&p.b[0]===-84.64&&p.b[1]===-1331.82)!;
 const dx=crossing.b[0]-crossing.a[0],dz=crossing.b[1]-crossing.a[1],l=Math.hypot(dx,dz),point=(t:number)=>[crossing.a[0]+dx*t-dz/l*6,crossing.a[1]+dz*t+dx/l*6];
 assert.deepEqual(clearRailSpans(point(.4),point(.6),[crossing],[]),[]);
});
test('mapped gate openings are retained at fence vertices and posts follow their fence',()=>{
 const gate=WATERFRONT.gates.find(g=>g.id==='6998856559')!.point;
 for(const pair of [[[-42.441,-1291.819],gate],[gate,[-46.509,-1291.495]]])for(const span of clearRailSpans(pair[0],pair[1],[],[gate]))for(const p of [span.a,span.b])assert.ok(Math.hypot(p[0]-gate[0],p[1]-gate[1])>=1.899);
 const dir=gateDirection(gate);assert.equal(dir.length,2);assert.ok(Math.abs(Math.hypot(...dir)-1)<1e-8);assert.ok(Math.abs(dir[0])>.98,'the mostly east-west fence needs posts along the fence, not across its opening');
});
test('the dock gangway uses the actual gate approach and bend, with a gentle connected grade',()=>{
 const route=harborGangwayPoints();assert.equal(route.length,3);assert.equal(route[0].x,-93.45);assert.equal(route[1].x,-98.1);assert.equal(route[1].z,-1284.48);
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];assert.ok((b.y-a.y)/Math.hypot(b.x-a.x,b.z-a.z)<.04);assert.ok(b.y>a.y);}
 assert.equal(route[2].y,.23);assert.equal(HARBOR_GANGWAY.width,2.4);
 const edges=harborGangwayEdges();
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);
  for(const index of [i-1,i])for(const side of ['left','right']as const){const p=edges[index][side],c=route[index];assert.ok(Math.abs(Math.abs((p.x-c.x)*dz-(p.z-c.z)*dx)/l-1.2)<1e-8);}
 }
});
