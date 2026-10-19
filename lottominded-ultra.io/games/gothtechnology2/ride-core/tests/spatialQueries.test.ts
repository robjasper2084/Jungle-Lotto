import test from 'node:test';
import assert from 'node:assert/strict';
import {NavigationNearest} from '../src/tag/navigationNearest.ts';
import {TagNavigation} from '../src/tag/navigation.ts';
import type {TagFixture} from '../src/tag/fixture.ts';
import {StaticBoxIndex} from '../src/staticBoxIndex.ts';
import {staticBoxSweep,type StaticBox} from '../src/staticBoxSweep.ts';
import type {Vec3,TerrainSampler} from '../src/terrain.ts';
const random=()=>{let seed=12345;return ()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;};

test('indexed nearest matches exhaustive search including tie order and rejected nodes',()=>{
 const r=random(),points=Array.from({length:14000},()=>({x:r()*2000-1000,y:0,z:r()*2000-1000}));
 const ids=points.map((_,i)=>i).filter(i=>i%7!==0).reverse(),index=new NavigationNearest(points,ids);
 for(let i=0;i<600;i++){const p={x:r()*3000-1500,y:r()*100,z:r()*3000-1500};let expected=0,best=Infinity;
  for(const id of ids){const q=points[id],d=Math.hypot(p.x-q.x,p.z-q.z);if(d<best){best=d;expected=id;}}
  assert.equal(index.nearest(p),expected);
 }
 const ties=new NavigationNearest([{x:-1,y:0,z:0},{x:1,y:4,z:0},{x:0,y:0,z:0}],[1,0]);
 assert.equal(ties.nearest({x:0,y:0,z:0}),1);
 assert.equal(new NavigationNearest([],[]).nearest({x:0,y:0,z:0}),0);
});

test('cached routes preserve directed costs, fresh projection, isolation and independent ownership',()=>{
 const nodes=[{x:0,y:0,z:0},{x:10,y:0,z:0},{x:20,y:0,z:0},{x:10,y:0,z:10},{x:100,y:0,z:100},{x:110,y:0,z:100}];
 const edges:[number,number,number][]=[[0,1,10],[1,2,10],[2,3,15],[3,0,15],[0,2,40],[4,5,10],[5,4,10]];
 const fixture={navigation:{nodes,edges}} as TagFixture;
 const nav=new TagNavigation(fixture,{} as TerrainSampler);
 assert.deepEqual(nav.path(nodes[0],nodes[2]),nodes.slice(0,3));
 const changed=nav.path({x:2,y:0,z:0},nodes[2]);assert.equal(changed[0].x,2);changed[1].x=-999;changed.pop();
 assert.deepEqual(nav.path({x:3,y:0,z:0},nodes[2]),[{x:3,y:0,z:0},nodes[1],nodes[2]]);
 assert.deepEqual(nav.path(nodes[2],nodes[0]),[nodes[2],nodes[3],nodes[0]]);
 const isolated=nav.path(nodes[0],nodes[4]);assert.deepEqual(isolated,[nodes[0]]);isolated[0].z=999;
 assert.deepEqual(nav.path(nodes[0],nodes[4]),[nodes[0]]);
});

test('broad phase preserves exact sphere contacts for rotated props, long rays and edge grazes',()=>{
 const r=random(),boxes:StaticBox[]=Array.from({length:200},(_,i)=>({x:r()*500-250,y:r()*15-3,z:r()*500-250,hx:.1+r()*12,hy:.1+r()*5,hz:.1+r()*12,yaw:r()*Math.PI*2,kind:String(i)}));
 // Identical overlapping props must retain authored order for normal selection.
 boxes.push({...boxes[0],kind:'overlap'});
 const index=new StaticBoxIndex(boxes);
 const contacts=(list:readonly StaticBox[],o:Vec3,d:Vec3,radius:number)=>list.flatMap(b=>{const fraction=staticBoxSweep(o,d,radius,b);return fraction===null?[]:[{kind:b.kind,fraction}];});
 for(let i=0;i<1200;i++){
  const origin=i<200?{x:boxes[i].x,y:boxes[i].y,z:boxes[i].z}:{x:r()*600-300,y:r()*20-5,z:r()*600-300};
  const delta={x:(r()-.5)*800,y:(r()-.5)*12,z:(r()-.5)*800},radius=i%4===0?0:r()*2;
  assert.deepEqual(contacts(index.query(origin,delta,radius),origin,delta,radius),contacts(boxes,origin,delta,radius));
 }
 const box:StaticBox={x:-20,y:0,z:0,hx:1,hy:1,hz:1,yaw:0,kind:'edge'},simple=new StaticBoxIndex([box]);
 for(const radius of [0,.01,.4,2]){const o={x:-25,y:1+radius,z:0},d={x:10,y:0,z:0};assert.deepEqual(contacts(simple.query(o,d,radius),o,d,radius),contacts([box],o,d,radius));}
 assert.equal(index.query({x:10000,y:0,z:10000},{x:1,y:0,z:0}).length,0);
});
