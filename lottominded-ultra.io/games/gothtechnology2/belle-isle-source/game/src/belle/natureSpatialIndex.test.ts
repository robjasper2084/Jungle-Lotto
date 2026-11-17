import test from 'node:test';
import assert from 'node:assert/strict';
import {NatureSpatialIndex} from './natureSpatialIndex.ts';
const square=(p:{x:number;z:number},x:number,z:number)=>(p.x-x)**2+(p.z-z)**2;
function fixtures(){
 let state=208416;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const all=Array.from({length:6500},(_,i)=>({i,id:i%9===0?'rock_1':'maple',x:Math.round((-450+random()*4450)*1000)/1000,z:Math.round((-750+random()*2450)*1000)/1000}));
 all.push({i:6500,id:'maple',x:-.1,z:-.1},{i:6501,id:'rock_1',x:-.1,z:-.1});
 return all;
}
test('spatial lookup returns identical exact-radius plants in original source order',()=>{
 const all=fixtures(),index=new NatureSpatialIndex(all);
 for(const [x,z,r] of [[0,0,.2],[-.1,-.1,.0001],[-450,150,75],[2136,300,140],[3700,-500,240],[-1000,-400,500],[0,0,1300],[6000,6000,30]]){
  const old=all.filter(p=>square(p,x,z)<r*r);
  const now=index.within(x,z,r);
  assert.deepEqual(now.map(p=>p.i),old.map(p=>p.i),[x,z,r].join(':'));
  for(const p of now)assert.strictEqual(p,all[p.i]);
 }
});
test('original distance-sort and rock radius yield exactly the same LOD selections',()=>{
 const all=fixtures(),trees=all.filter(p=>p.id==='maple');
 const treeIndex=new NatureSpatialIndex(trees),groundIndex=new NatureSpatialIndex(all);
 for(const [x,z,treeRadius,groundRadius,cap] of [[0,0,140,75,560],[-320,300,105,55,360],[3800,300,75,35,160],[0,0,96,96,48]]){
  const sorter=(a:{x:number;z:number},b:{x:number;z:number})=>square(a,x,z)-square(b,x,z);
  const oldTrees=trees.filter(p=>square(p,x,z)<treeRadius**2).sort(sorter).slice(0,48);
  const newTrees=treeIndex.within(x,z,treeRadius).sort(sorter).slice(0,48);
  assert.deepEqual(newTrees.map(p=>p.i),oldTrees.map(p=>p.i));
  const limit=(p:{id:string})=>(p.id.startsWith('rock')?groundRadius*1.65:groundRadius)**2;
  const oldGround=all.filter(p=>square(p,x,z)<limit(p)).sort(sorter).slice(0,cap);
  const newGround=groundIndex.within(x,z,groundRadius*1.65).filter(p=>square(p,x,z)<limit(p)).sort(sorter).slice(0,cap);
  assert.deepEqual(newGround.map(p=>p.i),oldGround.map(p=>p.i));
 }
});
test('zero radius, invalid coordinates, boundary exclusion and duplicate positions are stable',()=>{
 const points=[{x:0,z:0},{x:3,z:4},{x:6,z:8}],i=new NatureSpatialIndex(points,4);
 assert.deepEqual(i.within(0,0,5),[points[0]]);
 assert.deepEqual(i.within(0,0,5.000001),[points[0],points[1]]);
 for(const x of [NaN,Infinity])assert.deepEqual(i.within(x,0,20),[]);
 assert.deepEqual(i.within(0,0,0),[]);
 assert.throws(()=>new NatureSpatialIndex(points,0),/Invalid nature cell/);
 assert.throws(()=>new NatureSpatialIndex([{x:NaN,z:0}]),/Invalid nature placement/);
});
