import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {mappedCrossings} from './mappedCrossings.ts';import {createStreetPlan} from './streetPlan.ts';import type {ParkMap,Point} from './terrain.ts';
const road=(id:string,points:Point[],width=6,foot=false)=>({id,name:id,points,width,foot,bridge:false,surface:'concrete'});
const map=(roads:ParkMap['roads'],points:{id:string;p:Point;markings?:string}[])=>({roads,traffic:points.map(p=>({kind:'crossing',direction:'',markings:'zebra',...p}))} as ParkMap);
const real=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
test('marked crossings at either sidewalk end resolve through their actual footway to the street',()=>{
 const m=map([road('street',[[0,-20],[0,20]]),road('crossing',[[-10,0],[10,0]],2,true)],[{id:'a',p:[-10,0]},{id:'b',p:[10,0]}]);
 const crossings=mappedCrossings(m);assert.equal(crossings.length,1);assert.deepEqual(crossings[0].point,[0,0]);assert.equal(crossings[0].evidence,'connected-footway');
});
test('a nearby off-road marker alone is not invented into a painted crossing',()=>{
 assert.equal(mappedCrossings(map([road('street',[[0,-20],[0,20]])],[{id:'a',p:[-10,0]}])).length,0);
});
test('explicitly unmarked crossings remain unpainted and bridge-tagged roads are eligible',()=>{
 const r={...road('bridge',[[0,-20],[0,20]]),bridge:true};
 assert.equal(mappedCrossings(map([r],[{id:'a',p:[0,0],markings:'unmarked'}])).length,0);
 const result=mappedCrossings(map([r],[{id:'a',p:[0,0]}]));assert.equal(result.length,1);assert.equal(result[0].bridge,true);
});
test('wide carriageways keep surveyed marked crossings beyond the obsolete three-metre limit',()=>{
 const result=mappedCrossings(map([road('wide',[[0,-20],[0,20]],14.2)],[{id:'a',p:[5.98,0]}]));assert.equal(result.length,1);assert.deepEqual(result[0].point,[0,0]);
});
test('footway connectivity cannot promote a tangential trail, distant crossing or arbitrary URL into a location',()=>{
 const street=road('street',[[0,-50],[0,50]]);
 assert.equal(mappedCrossings(map([street,road('tangent',[[8,0],[8,20]],2,true)],[{id:'a',p:[8,0]}])).length,0);
 assert.equal(mappedCrossings(map([street,road('far',[[-30,0],[0,0]],2,true)],[{id:'a',p:[-30,0]}])).length,0);
});
test('all actual sidewalk-end source nodes can be resolved when audited independently',()=>{
 for(const id of ['1232437655','6157999499','6159487480']){
  const node=real.traffic!.find(n=>n.id===id)!;assert(node);
  const result=mappedCrossings({...real,traffic:[node]});assert.equal(result.length,1,id);assert.equal(result[0].evidence,'connected-footway');assert(/Sunset/.test(result[0].roadName));
 }
});
test('crosswalk repair preserves all sixty-two prior locations and adds the marked Central bridge crossing',()=>{
 const plan=createStreetPlan(real);assert.equal(plan.stats.crossings,63);assert.equal(plan.crossings!.length,63);
 const restored=plan.crossings!.find(n=>n.id==='14040681649');assert(restored);assert(restored.bridge);assert.deepEqual(restored.point,[2089.14,426.66]);
 // Prior resolver: only road-center markers within 3 m, excluding bridge ways.
 const old:Point[]=[];
 for(const node of real.traffic??[]){if(node.kind!=='crossing'||['','no','unmarked'].includes(node.markings))continue;
  let closest:{point:Point;d:number}|undefined;
  for(const r of real.roads.filter(r=>!r.foot&&!r.bridge&&r.highway!=='corridor'))for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;if(!l)continue;const t=Math.max(0,Math.min(1,((node.p[0]-a[0])*dx+(node.p[1]-a[1])*dz)/l)),p:Point=[a[0]+t*dx,a[1]+t*dz],d=Math.hypot(p[0]-node.p[0],p[1]-node.p[1]);if(!closest||d<closest.d)closest={point:p,d};
  }
  if(closest&&closest.d<3&&!old.some(p=>Math.hypot(p[0]-closest!.point[0],p[1]-closest!.point[1])<6))old.push(closest.point);
 }
 assert.equal(old.length,62);for(const p of old)assert(plan.crossings!.some(c=>Math.hypot(c.point[0]-p[0],c.point[1]-p[1])<.2),'old crossing disappeared '+p);
});
