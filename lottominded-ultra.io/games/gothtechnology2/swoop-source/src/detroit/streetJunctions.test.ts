import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drapeStreet,streetVertexNormal,subtractStreetFootprint,insideStreetFootprint,streetFootprint} from './street-geometry.ts';
import {streetJoinExclusions} from './streetJunctions.ts';
import {CITY,nearestCut} from './geography.ts';
import {heightAt,terrainChunks} from './world.ts';
import type {TerrainChunk} from './world.ts';
const tile:TerrainChunk={x:50,z:50,vertices:new Float32Array([0,0,0,100,0,0,0,0,100,100,0,100]),indices:new Uint32Array([0,2,1,1,2,3]),surfaces:['grass','grass']};
const area=(p:{x:number;z:number}[])=>Math.abs(p.reduce((a,v,i)=>{const w=p[(i+1)%p.length];return a+v.x*w.z-v.z*w.x;},0))/2;
test('crossing exclusion keeps both approaches and removes only the street footprint',()=>{
 const path=[{x:5,z:48},{x:95,z:48},{x:95,z:52},{x:5,z:52}],road=[{x:45,z:0},{x:55,z:0},{x:55,z:100},{x:45,z:100}];
 for(const cut of [road,[...road].reverse()]){
  const result=subtractStreetFootprint(path,cut);
  assert.equal(result.length,2);assert.equal(result.reduce((a,p)=>a+area(p),0),320);
  for(const p of result)assert.ok(p.every(v=>v.x<=45)||p.every(v=>v.x>=55));
 }
});
test('empty and fully covered approaches leave no sliver triangles',()=>{
 const path=[{x:10,z:10},{x:20,z:10},{x:20,z:20},{x:10,z:20}];
 assert.deepEqual(subtractStreetFootprint(path,[{x:0,z:0},{x:30,z:0},{x:30,z:30},{x:0,z:30}]),[]);
 assert.equal(subtractStreetFootprint(path,[{x:25,z:25},{x:30,z:25},{x:30,z:30},{x:25,z:30}]).reduce((a,p)=>a+area(p),0),100);
});

test('touching a clipping edge never deletes the adjacent sidewalk or trail triangle',()=>{
 const path=[{x:0,z:0},{x:4,z:0},{x:4,z:4},{x:0,z:4}];
 const touching=[{x:4,z:4},{x:6,z:4},{x:6,z:6},{x:4,z:6}];
 for(const shift of [0,1e-10,-1e-10])for(const cut of [touching,[...touching].reverse()]){
  const result=subtractStreetFootprint(path,cut.map(p=>({x:p.x+shift,z:p.z+shift})));
  assert.ok(Math.abs(result.reduce((sum,p)=>sum+area(p),0)-16)<1e-6,'boundary vertices must survive on the outside');
 }
});

test('Atwater entry keeps its approach up to the outer concrete sidewalk edge',()=>{
 const r=CITY.roads.find(r=>r.id==='68304612')!,[a,b]=r.points,chunks=terrainChunks();
 const p=drapeStreet({a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:3.048,offset:0,lift:.075,joinA:streetVertexNormal(r.points,0),joinB:streetVertexNormal(r.points,1),exclude:streetJoinExclusions(r,a,b,7.048,heightAt)},chunks,(_x,_z,y)=>y);
 let areaSum=0;for(const {positions:v} of p)for(let i=0;i<v.length;i+=9)areaSum+=Math.abs((v[i+3]-v[i])*(v[i+8]-v[i+2])-(v[i+6]-v[i])*(v[i+5]-v[i+2]))/2;
 assert.ok(areaSum>130&&areaSum<151,`approach area ${areaSum}: only the sidewalk overlap may be removed`);
});
test('curved offset sidewalks share exactly the same cross section at the bend',()=>{
 const points=[[10,20],[50,20],[80,50]],normal=streetVertexNormal(points,1),join={x:50+normal.x*6,z:20+normal.z*6};
 assert.ok(Math.hypot(normal.x,normal.z)<2);
 const left=drapeStreet({a:{x:10,z:20},b:{x:50,z:20},joinB:normal,half:1,offset:5,lift:.035},[tile],()=>0);
 const right=drapeStreet({a:{x:50,z:20},b:{x:80,z:50},joinA:normal,half:1,offset:5,lift:.035},[tile],()=>0);
 for(const pieces of [left,right])assert.ok(pieces.some(({positions:p})=>p.some((_,i)=>i%3===0&&Math.hypot(p[i]-join.x,p[i+2]-join.z)<1e-6)));
});
test('Mack driveway leaves the concrete crossing clear and retains its approach',()=>{
 const driveway=CITY.roads.find(r=>r.id==='1527245862')!,[a,b]=driveway.points;
 const cuts=streetJoinExclusions(driveway,a,b,driveway.width/2+4,heightAt);
 assert.ok(cuts.some(p=>insideStreetFootprint({x:2549.64938,z:-1404.60932},p)),'observed flickering asphalt must be clipped from the sidewalk');
 assert.ok(!cuts.some(p=>insideStreetFootprint({x:2558,z:-1404.9},p)),'keep the driveway outside the sidewalk');
});
test('subdivided curb ramps cannot grow past the inside corner of their sidewalk',()=>{
 const ribbon={a:{x:10,z:20},b:{x:50,z:20},half:1,offset:5,lift:.035,joinB:{x:-1,z:1}};
 const envelope=streetFootprint(ribbon),pieces=drapeStreet({...ribbon,maxSpan:1},[tile],x=>x*.1);
 let total=0;
 for(const {positions:v} of pieces)for(let i=0;i<v.length;i+=9){
  const triangle=[0,3,6].map(j=>({x:v[i+j],z:v[i+j+2]}));
  assert.ok(triangle.every(p=>insideStreetFootprint(p,envelope)),'curb tessellation must retain the parent corner boundary');
  total+=area(triangle);
 }
 assert.ok(Math.abs(total-area(envelope))<1e-6,'all of the joined sidewalk remains covered');
});
test('Atwater inside-corner sidewalk cannot overlap asphalt on its own adjoining segment',()=>{
 const road=CITY.roads.find(r=>r.id==='8740420')!,a=road.points[8],b=road.points[9];
 const cuts=streetJoinExclusions(road,a,b,road.width/2+4,heightAt);
 assert.ok(cuts.some(p=>insideStreetFootprint({x:-4.33738,z:107.55082},p)),'remove observed concrete protrusion into Atwater');
});
test('short lane-marking pieces stop at the full joined bend boundary',()=>{
 const full={a:{x:10,z:20},b:{x:50,z:20},half:.055,offset:5,lift:.048,joinB:{x:-1,z:1}},boundary=streetFootprint(full);
 const pieces=drapeStreet({...full,a:{x:44,z:20},b:{x:48,z:20},joinB:undefined,boundary},[tile],()=>0);
 assert.ok(pieces.length>0);
 for(const {positions:p}of pieces)for(let i=0;i<p.length;i+=3)assert.ok(insideStreetFootprint({x:p[i],z:p[i+2]},boundary),'paint cannot continue through the adjoining lane');
});
test('draped walking triangles do not cover motor roads or lose terrain support outside them',()=>{
 const exclusion=[{x:45,z:0},{x:55,z:0},{x:55,z:100},{x:45,z:100}];
 const pieces=drapeStreet({a:{x:5,z:50},b:{x:95,z:50},half:2,offset:0,lift:.055,exclude:[exclusion]},[tile],()=>0);
 let sum=0;for(const {positions:p}of pieces)for(let i=0;i<p.length;i+=9){const xs=[p[i],p[i+3],p[i+6]];assert.ok(Math.max(...xs)<=45+1e-6||Math.min(...xs)>=55-1e-6);sum+=Math.abs((p[i+3]-p[i])*(p[i+8]-p[i+2])-(p[i+6]-p[i])*(p[i+5]-p[i+2]))/2;for(const j of [1,4,7])assert.equal(p[i+j],.055);}assert.ok(Math.abs(sum-320)<1e-6);
});
test('Atwater crossing finds mapped street footprints while raised bridges keep their layer',()=>{
 const owner=CITY.roads.find(r=>r.id==='69706033')!;
 const cuts=streetJoinExclusions(owner,[-80,-1194],[-65,-1194],8,heightAt);assert.ok(cuts.length>0,'mapped Atwater intersection');
 assert.equal(streetJoinExclusions({...owner,bridge:true},[-80,-1194],[-65,-1194],8,heightAt).length,0);
});

test('coarse asphalt fringe is cleared beside mapped roads across the city',async()=>{
 const {terrainVisualSurface}=await import('./parkPaths.ts');
 for(const name of ['Atwater Street','East Lafayette Street','East Larned Street','Antietam Avenue']){
  const r=CITY.roads.find(r=>r.name===name)!;const a=r.points[0],b=r.points[1],length=Math.hypot(b[0]-a[0],b[1]-a[1]),offset=r.width/2+8;
  const x=(a[0]+b[0])/2-(b[1]-a[1])/length*offset,z=(a[1]+b[1])/2+(b[0]-a[0])/length*offset;
  assert.equal(terrainVisualSurface(x,z,'pavement'),'grass',name);
  if(name!=='Atwater Street')assert.equal(terrainVisualSurface(x,z,'brick'),'brick','retain brick plazas');
 }
});

test('long trail sections below Larned and Lafayette retain their full paved area',()=>{
 const r=CITY.roads.find(r=>r.name==='Dequindre Cut Greenway'&&r.points.length>70)!,chunks=terrainChunks();
 const triangleArea=(p:number[])=>{let result=0;for(let i=0;i<p.length;i+=9)result+=Math.abs((p[i+3]-p[i])*(p[i+8]-p[i+2])-(p[i+6]-p[i])*(p[i+5]-p[i+2]))/2;return result;};
 let checked=0;
 for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],d=nearestCut((a[0]+b[0])/2,(a[1]+b[1])/2).d;
  if(d<300||d>1500||Math.hypot(b[0]-a[0],b[1]-a[1])<200)continue;
  const ribbon={a:{x:a[0],z:a[1]},b:{x:b[0],z:b[1]},half:r.width/2,offset:0,lift:.075,joinA:streetVertexNormal(r.points,i-1),joinB:streetVertexNormal(r.points,i)};
  const sum=(exclude?:{x:number;z:number}[][])=>drapeStreet({...ribbon,exclude},chunks,(_x,_z,y)=>y).reduce((n,p)=>n+triangleArea(p.positions),0);
  assert.ok(sum(streetJoinExclusions(r,a,b,7,heightAt))>sum()*.99,`trail at ${Math.round(d)}m loses pavement to a different-height street`);checked++;
 }
 assert.ok(checked>=2);
});
