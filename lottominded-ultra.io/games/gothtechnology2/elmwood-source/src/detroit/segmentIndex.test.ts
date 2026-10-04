import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SegmentIndex} from './segmentIndex.ts';import {ElmwoodTerrain} from './elmwood-terrain.ts';
test('indexed lanes match exhaustive lookup at all junctions, curbs and off-lane samples',()=>{
 const read=(name:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
 const t=new ElmwoodTerrain(read('terrain.json'),read('site.json').features,read('placements.json'));
 for(const s of t.segments)for(const f of [0,.25,.5,.75,1])for(const offset of [-3,0,3]){
  const x=s.a[0]+(s.b[0]-s.a[0])*f+offset,y=s.a[1]+(s.b[1]-s.a[1])*f-offset;
  let best=Infinity,expected=t.segments[0];for(const seg of t.segments){const dx=seg.b[0]-seg.a[0],dy=seg.b[1]-seg.a[1],u=Math.max(0,Math.min(1,((x-seg.a[0])*dx+(y-seg.a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(x-seg.a[0]-dx*u,y-seg.a[1]-dy*u);if(d<best){best=d;expected=seg;}}
  const actual=t.nearest(x,y);assert.ok(Math.abs(actual.distance-best)<1e-9);if(best>1e-8)assert.equal(actual.segment.feature,expected.feature);
 }
});
test('ties retain source ordering, distant points and degenerate segments remain exact',()=>{
 const i=new SegmentIndex([{ax:0,ay:0,bx:0,by:0},{ax:0,ay:0,bx:10,by:0}]);assert.equal(i.nearest(0,0).index,0);assert.equal(i.nearest(20,0).distance,10);
});
