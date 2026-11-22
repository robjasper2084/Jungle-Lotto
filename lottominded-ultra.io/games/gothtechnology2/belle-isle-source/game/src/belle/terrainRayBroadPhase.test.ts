import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ParkTerrain,inside,segment,type ParkMap,type Point} from './terrain.ts';

const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
type Vec={x:number;y:number;z:number};
type Box=ParkTerrain['boxes'][number];

/** Brute-force reference from the original building narrow phase. All fixtures
 * are outside the mapped island so independently authored colliders cannot
 * conceal a missing building hit. Rider water checks are stubbed to dry land.
 * This reference has no spatial rejection. */
function exhaustiveBoxes(boxes:Box[],o:Vec,d:Vec,max:number,half:number){
 let hit=max+1;
 for(const b of boxes){
  if(Math.min(o.y,o.y+d.y*max)>2+b.height+.2||Math.max(o.y,o.y+d.y*max)<2)continue;
  let low=0,high=max;
  const axes=[[o.x,d.x,b.minX-half,b.maxX+half],[o.z,d.z,b.minZ-half,b.maxZ+half],[o.y,d.y,2,2+b.height]];
  for(const [p,v,lo,hi]of axes){
   if(Math.abs(v)<1e-7){if(p<lo||p>hi){low=max+1;break;}}
   else{const a=(lo-p)/v,c=(hi-p)/v;low=Math.max(low,Math.min(a,c));high=Math.min(high,Math.max(a,c));}
  }
  if(!(low<=high&&low<hit))continue;
  if(!b.points){hit=low;continue;}
  const end=Math.min(high,max),steps=Math.max(1,Math.ceil((end-low)/.15));
  for(let i=0;i<=steps;i++){
   const t=low+(end-low)*i/steps,x=o.x+d.x*t,z=o.z+d.z*t;
   if(inside(x,z,b.points)||b.points.some((p,j)=>j>0&&segment(x,z,b.points![j-1],p).d<=half)){hit=t;break;}
  }
 }
 return hit<=max?hit:null;
}

function same(actual:number|null,expected:number|null,label:string){
 assert.equal(actual,expected,label);
}

test('swept building bounds preserve exhaustive ray hits across polygons, padding and axes',()=>{
 const terrain=new ParkTerrain(map),boxes:Box[]=[];
 let seed=0x184813;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let i=0;i<120;i++){
  const x=100000+random()*200,z=100000+random()*200,w=.2+random()*12,l=.2+random()*12;
  const points:Point[]=[[x,z],[x+w,z],[x+w,z+l*.4],[x+w*.4,z+l*.4],[x+w*.4,z+l],[x,z+l],[x,z]];
  boxes.push({minX:x,maxX:x+w,minZ:z,maxZ:z+l,height:.1+random()*30,...(i%2?{points}:{})});
 }
 terrain.boxes=boxes;terrain.land=()=>true;
 for(let i=0;i<2500;i++){
  const o={x:99980+random()*240,y:random()*38,z:99980+random()*240};
  const d={x:i%9===0?0:random()*4-2,y:i%3===0?0:random()*2-1,z:i%7===0?0:random()*4-2};
  const max=i%17===0?0:random()*64,half=[0,.16,.4,1.35,4][i%5];
  const expected=exhaustiveBoxes(boxes,o,d,max,half);
  same(terrain.raycastObstacle(o,d,max,half),expected,'rider fixture '+i);
  same(terrain.raycastCamera(o,d,max,half),expected,'camera fixture '+i);
  same(terrain.raycastFlight(o,d,max,half),expected,'flight fixture '+i);
 }
});

test('bounds retain appended boxes, tangencies, endpoints and near-parallel directions',()=>{
 const terrain=new ParkTerrain(map);terrain.boxes=[];terrain.land=()=>true;
 const o={x:100000,y:4,z:100000},d={x:1,y:0,z:0};
 assert.equal(terrain.raycastCamera(o,d,4,.16),null);
 terrain.boxes.push({minX:100004,maxX:100010,minZ:99999,maxZ:100001,height:5});
 same(terrain.raycastCamera(o,d,4,.16),exhaustiveBoxes(terrain.boxes,o,d,4,.16),'appended wall');
 assert.notEqual(terrain.raycastCamera(o,d,4,.16),null);
 same(terrain.raycastObstacle(o,d,8),exhaustiveBoxes(terrain.boxes,o,d,8,.4),'default rider padding');
 same(terrain.raycastCamera(o,d,8),exhaustiveBoxes(terrain.boxes,o,d,8,.16),'default camera padding');
 same(terrain.raycastFlight(o,d,8),exhaustiveBoxes(terrain.boxes,o,d,8,1.35),'default flight padding');
 for(const delta of[-1e-10,0,1e-10])for(const half of[0,.16,.4,1.35]){
  const ray={x:100000,y:4,z:100001+half+delta};
  for(const direction of[{x:1,y:0,z:0},{x:1,y:0,z:1e-8},{x:1,y:0,z:-1e-8}]){
   same(terrain.raycastCamera(ray,direction,4-half+delta,half),exhaustiveBoxes(terrain.boxes,ray,direction,4-half+delta,half),'edge '+delta+'/'+half);
  }
 }
 for(const max of[-1,0,1e-10,4,8])for(const half of[-.2,0,.16]){
  same(terrain.raycastCamera(o,d,max,half),exhaustiveBoxes(terrain.boxes,o,d,max,half),'finite/negative parameters');
 }
});
