import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ParkTerrain,inside,segment,type ParkMap} from './terrain.ts';
import {MEADOW_CELL,meadowBudget,meadowRandom,type MeadowPlan} from './meadowPlan.ts';
import type {NaturePlan} from './naturePlan.ts';
const map:ParkMap=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const plan:MeadowPlan=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/meadow.json',import.meta.url),'utf8'));
const terrain=new ParkTerrain(map);
test('streamed grass has bounded geometry budgets and deterministic placement',()=>{
 assert(plan.cells.length>20000);assert.equal(plan.cellSize,MEADOW_CELL);
 assert(meadowBudget.smooth.tufts*56<=80000);assert(meadowBudget.automatic.tufts*56<=260000);assert(meadowBudget.high.tufts*56<=460000);
 assert(meadowBudget.smooth.radius<meadowBudget.high.radius);
 for(let i=0;i<50;i++){const value=meadowRandom(-i,i*2,i);assert(value>=0&&value<1);assert.equal(value,meadowRandom(-i,i*2,i));}
});
test('grass cells keep their full blade footprint off widened roads and water',()=>{
 const buckets=new Map<string,{a:[number,number];b:[number,number];w:number}[]>();
 for(const r of map.roads)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],pad=r.width/2+6;
  for(let x=Math.floor((Math.min(a[0],b[0])-pad)/64);x<=Math.floor((Math.max(a[0],b[0])+pad)/64);x++)for(let z=Math.floor((Math.min(a[1],b[1])-pad)/64);z<=Math.floor((Math.max(a[1],b[1])+pad)/64);z++){
   const key=x+','+z,list=buckets.get(key)||[];list.push({a,b,w:r.width});buckets.set(key,list);
  }
 }
 for(const [ix,iz,y] of plan.cells){const x=ix*MEADOW_CELL,z=iz*MEADOW_CELL;
  assert(Number.isFinite(y));assert(terrain.land(x,z,2));assert(!terrain.bridge(x,z).active);
  for(const road of buckets.get(Math.floor(x/64)+','+Math.floor(z/64))||[])assert(segment(x,z,road.a,road.b).d>road.w/2+Math.SQRT2*MEADOW_CELL/2+1,'grass inside route shoulder');
 }
 const sign=map.entranceSign;if(sign)assert(plan.cells.some(c=>Math.hypot(c[0]*MEADOW_CELL-sign.point[0],c[1]*MEADOW_CELL-sign.point[1])<65),'entrance lawns need real grass too');
});
test('mature tree dimensions are consistent between close meshes and distant cards',()=>{
 const plants:NaturePlan=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/placements.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(new URL('../../public/belle/nature/manifest.json',import.meta.url),'utf8'));
 const heights=new Map<string,number>(manifest.trees.map((t:{id:string;height:number})=>[t.id,t.height]));
 const metres=plants.trees.map(p=>(heights.get(p.id)??0)*p.scale*(p.heightScale??1));
 assert(metres.every(h=>h>14&&h<33));assert(metres.filter(h=>h>20).length>plants.trees.length*.45);
 assert(plants.trees.every(p=>!map.areas.some(a=>['pitch','playground'].includes(a.kind)&&inside(p.x,p.z,a.points))));
});
