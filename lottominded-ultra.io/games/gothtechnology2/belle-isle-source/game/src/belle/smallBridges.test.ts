import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {makeSmallBridgePlan,SmallBridgeCollision,DEDICATED_BRIDGE_IDS,type SmallBridgePlan} from './smallBridges.ts';
import {addSmallBridges} from './smallBridgeScene.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const terrain=new ParkTerrain(map),plan=terrain.smallBridges.plan;
const minimal=(roads:ParkMap['roads'])=>({roads} as ParkMap);
const way=(id:string,points:[number,number][],width=4,foot=false)=>({id,name:id,points,width,foot,bridge:true,surface:'concrete'});
test('all 59 existing small bridge and raised-path ways gain structures, without duplicating dedicated bridges',()=>{
 const expected=map.roads.filter(r=>r.bridge&&!DEDICATED_BRIDGE_IDS.has(r.id));
 assert.equal(expected.length,59);assert.equal(plan.links.length,expected.length);
 assert.deepEqual(plan.links.map(x=>x.id),expected.map(x=>x.id));
 for(const link of plan.links){const r=expected.find(r=>r.id===link.id)!;assert.deepEqual(link.points,r.points);assert.equal(link.width,r.width);assert(plan.parts.some(p=>p.id===r.id&&p.kind==='slab'));}
 for(const id of DEDICATED_BRIDGE_IDS)assert(!plan.links.some(l=>l.id===id));
});
test('named canal approaches preserve the original mapped routes, road widths and floor levels',()=>{
 for(const id of ['42986446','42986453','42986457','42986459','60929039','107196454','1543125463','42986439','860335422']){
  const link=plan.links.find(l=>l.id===id);assert(link,id+' missing');
  for(const p of plan.parts.filter(p=>p.id===id&&p.kind==='slab')){
   const x=(p.a[0]+p.b[0])/2,z=(p.a[1]+p.b[1])/2;
   assert(Math.abs(p.top-(terrain.height(x,z)+.055))<1e-7);assert(terrain.land(x,z));
  }
 }
 assert.equal(plan.links.find(l=>l.id==='107196454')?.style,'iron');
 assert(plan.links.some(l=>l.style==='timber'));
});
test('structure planning is deterministic and does not mutate map or saved road data',()=>{
 const data=minimal([way('test',[[0,0],[0,12]])]),before=JSON.stringify(data);
 assert.deepEqual(makeSmallBridgePlan(data),makeSmallBridgePlan(data));assert.equal(JSON.stringify(data),before);
});
test('road and footpath entrances are not sealed by new bridge railings',()=>{
 const data=minimal([way('deck',[[0,-12],[0,12]]),{...way('side',[[-12,0],[12,0]],3,true),bridge:false}]);
 const p=makeSmallBridgePlan(data),collision=new SmallBridgeCollision(p);
 for(let x=-8;x<=8;x+=.25)assert.equal(collision.blocked(x,0,.35),false);
 assert(collision.blocked(2.16,8,.1),'rail should still exist away from the junction');
 assert.equal(collision.ray({x:0,y:2.6,z:-16},{x:0,y:0,z:1},32,.35),null);
});
test('rails, decks, camera and flight collision use the same finite visible geometry and bounded heights',()=>{
 const collision=new SmallBridgeCollision(makeSmallBridgePlan(minimal([way('deck',[[0,-10],[0,10]])])));
 const side=collision.ray({x:0,y:2.65,z:0},{x:1,y:0,z:0},5,.2);assert(side!==null&&side>1.5&&side<2.2);
 assert.equal(collision.ray({x:0,y:4,z:0},{x:1,y:0,z:0},5,.2),null);
 assert.equal(collision.ray({x:-5,y:1.5,z:0},{x:1,y:0,z:0},10,.2),null,'underdeck canal remains open');
 assert(collision.ray({x:0,y:3.8,z:0},{x:0,y:-1,z:0},3,0)!>1.6);
 assert.equal(collision.ray({x:NaN,y:2,z:0},{x:1,y:0,z:0},5),null);
});
test('switchback geometry does not put its own railing across the walking centerline',()=>{
 const road=map.roads.find(r=>r.id==='1115092595')!;assert(road);
 for(let i=1;i<road.points.length;i++)for(let t=0;t<=1;t+=.025){const a=road.points[i-1],b=road.points[i];assert.equal(terrain.smallBridges.blocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.35),false);}
});
test('all mapped road/path centerlines remain free of new rail collision, including crossing sidewalks',()=>{
 let samples=0;
 for(const r of map.roads)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.min(100,Math.ceil(len/.5)));
  for(let j=0;j<=steps;j++){const x=a[0]+(b[0]-a[0])*j/steps,z=a[1]+(b[1]-a[1])*j/steps;assert.equal(terrain.smallBridges.blocked(x,z,.35),false,r.id+' at '+[x,z]);samples++;}
 }
 assert(samples>50000);
});
test('small-bridge geometry is finite, has a fixed budget and needs no new textures or light passes',()=>{
 const scene=new T.Scene(),view=addSmallBridges(scene,plan);
 assert.equal(view.stats.mappedLinks,59);assert(view.stats.triangles<20000);assert(view.stats.batches<60);
 assert.equal(scene.children.length,1);assert.equal(view.root.children.length,view.stats.batches);
 for(const object of view.root.children){assert(object instanceof T.Mesh);assert(object.frustumCulled);assert.equal(object.castShadow,false);assert(!object.material.map);assert(object.geometry.boundingSphere);for(const value of object.geometry.attributes.position.array)assert(Number.isFinite(value));}
 let disposed=0;for(const object of view.root.children)(object as T.Mesh).geometry.addEventListener('dispose',()=>disposed++);
 view.dispose();assert.equal(disposed,view.stats.batches);assert.equal(scene.children.length,0);
});
test('missing bridges add no invented geometry and invalid geometry fails explicitly',()=>{
 assert.equal(makeSmallBridgePlan(minimal([])).links.length,0);
 assert.throws(()=>makeSmallBridgePlan(minimal([way('bad',[[0,0],[NaN,12]])])),/Invalid/);
 assert.throws(()=>makeSmallBridgePlan(minimal([way('bad',[[0,0],[0,12]],NaN)])),/Invalid/);
 assert.equal(makeSmallBridgePlan(minimal([way('river',[[0,0],[0,700]])])).parts.length,0);
});

test('nonfinite corridor dimensions and oversized ray extents cannot hang spatial-grid queries',()=>{
 for(const width of [Infinity,-Infinity])assert.throws(()=>makeSmallBridgePlan(minimal([way('bad',[[0,0],[0,12]],width)])),/Invalid/);
 assert.equal(terrain.smallBridges.blocked(0,0,Infinity),false);assert.equal(terrain.smallBridges.blocked(NaN,0),false);
 assert.equal(terrain.smallBridges.ray({x:0,y:100,z:0},{x:1,y:0,z:0},1e10,.1),null);
});
