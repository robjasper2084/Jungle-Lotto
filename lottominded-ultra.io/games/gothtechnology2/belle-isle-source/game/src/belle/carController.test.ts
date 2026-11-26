import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAR,CarController,type CarCollisionEnvelope,type CarCollisionEnvelopeBounds,type CarGround,type CarInput} from './carController.ts';
import {ParkTerrain,type ParkMap} from './terrain.ts';

type Box=CarCollisionEnvelope;
type Vec={x:number;y:number;z:number};
type Ray={o:Vec;d:Vec;max:number;half:number};
type CacheView={bounds:CarCollisionEnvelopeBounds;parts:CarCollisionEnvelopeBounds[];footprint:{x:number;z:number}[];cells:Record<string,number>[]};
const cacheOf=(car:CarController)=>(car as unknown as {collisionSamples:CacheView}).collisionSamples;
const neutral:CarCollisionEnvelope={minX:-1.05,maxX:1.05,minY:0,maxY:1.6,minZ:-2.95,maxZ:2.95};
const coast:CarInput={gas:0,brake:0,steer:0,handbrake:false};

/** Match terrain box semantics: half expands X/Z, never Y. This matters because
 * a few horizontal height slices cannot prove clearance of a thin roof beam. */
function boxRay(box:Box,o:Vec,d:Vec,max:number,half:number){
 let low=0,high=max;
 for(const [p,v,min,limit]of [[o.x,d.x,box.minX-half,box.maxX+half],[o.y,d.y,box.minY,box.maxY],[o.z,d.z,box.minZ-half,box.maxZ+half]]){
  if(Math.abs(v)<1e-8){if(p<min||p>limit)return null;}
  else{const a=(min-p)/v,b=(limit-p)/v;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return null;}
 }
 return low<=max?low:null;
}
function ground(boxes:Box[]=[],floor=0){
 const rays:Ray[]=[],points:{x:number;z:number;margin:number}[]=[];
 const terrain:CarGround={
  height:()=>floor,land:()=>true,obstructed:(x,z,margin=0)=>{points.push({x,z,margin});return false;},bridge:()=>({active:false,t:0,side:0}),
  raycastObstacle:(o,d,max,half=0)=>{
   rays.push({o:{...o},d:{...d},max,half});let result:number|null=null;
   for(const box of boxes){const hit=boxRay(box,o,d,max,half);if(hit!==null&&(result===null||hit<result))result=hit;}
   return result;
  },
 };
 return{terrain,rays,points};
}
function driving(terrain:CarGround,envelope?:CarCollisionEnvelope,speed=6){
 const car=new CarController(terrain,{x:0,z:0,heading:0});car.engine=true;car.gear=speed<0?'R':'D';car.pose.speed=speed;
 if(envelope)assert.equal(car.setCollisionEnvelope(envelope),true);return car;
}

test('collision envelopes reject invalid bounds without changing the accepted copied envelope',()=>{
 const fixture=ground([{minX:-3,maxX:3,minY:1.75,maxY:1.751,minZ:-4,maxZ:4}]);
 const car=driving(fixture.terrain),envelope={...neutral,maxY:2};
 assert.equal(car.setCollisionEnvelope(envelope),true);envelope.maxY=.5;
 assert.equal(car.valid(0,0,0),false,'the installed bounds are copied');
 for(const invalid of [{...neutral,minX:2,maxX:1},{...neutral,minY:2,maxY:1},{...neutral,minZ:2,maxZ:1},{...neutral,maxY:NaN},{...neutral,minZ:-Infinity},{...neutral,minX:-Number.MAX_VALUE,maxX:Number.MAX_VALUE}]){
  assert.equal(car.setCollisionEnvelope(invalid),false);assert.equal(car.valid(0,0,0),false);
 }
 assert.equal(car.setCollisionEnvelope(undefined),true);assert.equal(car.valid(0,0,0),true);
});

test('a custom envelope can expand but cannot shrink the original ground footprint',()=>{
 const fixture=ground();fixture.terrain.land=(x,z)=>Math.abs(x)<CAR.halfWidth||Math.abs(z)<CAR.halfLength;
 const car=driving(fixture.terrain);
 assert.equal(car.valid(0,0,0),false);
 car.setCollisionEnvelope({minX:-.1,maxX:.1,minY:0,maxY:1,minZ:-.2,maxZ:.2});
 assert.equal(car.valid(0,0,0),false,'the original four corners remain in the footprint');
 fixture.terrain.land=(x,z)=>!(x===0&&z===1.5);
 car.setCollisionEnvelope({...neutral,maxX:2.4,maxZ:3.5});
 assert.equal(car.valid(0,0,0),false,'asymmetric extensions retain original interior ground samples');
});

test('raised roof probes stop before a thin overhead beam that a stock-height car clears',()=>{
 const beam={minX:-4,maxX:4,minY:1.735,maxY:1.737,minZ:4,maxZ:4.03};
 const low=driving(ground([beam]).terrain,neutral),raised=driving(ground([beam]).terrain,{...neutral,maxY:2.05});
 assert.equal(low.valid(0,0,0),true);assert.equal(raised.valid(0,0,0),true);
 let stopped=false;
 for(let i=0;i<120;i++){low.advance(1/60,coast);raised.advance(1/60,coast);stopped||=raised.collided;}
 assert(low.pose.z>5,'stock roof passes underneath');assert(stopped);assert.equal(raised.pose.speed,0);
 assert(raised.pose.z+CAR.halfLength<beam.minZ,'the raised roof remains before the beam');
});

test('an expanded side envelope catches an open-panel obstruction without forbidding open-panel driving',()=>{
 const panel={...neutral,maxX:2.2},post={minX:1.8,maxX:1.9,minY:.5,maxY:1.2,minZ:-.1,maxZ:.1};
 const fixture=ground([post]),car=driving(fixture.terrain);
 assert.equal(car.valid(0,0,0),true);car.setCollisionEnvelope(panel);assert.equal(car.valid(0,0,0),false);
 const free=driving(ground().terrain,panel);
 for(let i=0;i<60;i++)free.advance(1/60,{...coast,gas:1});
 assert(free.pose.z>6&&free.pose.speed>6&&!free.collided,'clear open panels do not add a brake hold');
});

test('reverse motion checks the expanded rear and its full height',()=>{
 const wall={minX:-4,maxX:4,minY:1.05,maxY:1.15,minZ:-6.03,maxZ:-6};
 const car=driving(ground([wall]).terrain,{...neutral,minZ:-4.2,maxY:2},-6);
 assert.equal(car.valid(0,0,0),true);let stopped=false;
 for(let i=0;i<90;i++){car.advance(1/60,coast);stopped||=car.collided;}
 assert(stopped);assert.equal(car.pose.speed,0);assert(car.pose.z-4.2>wall.maxZ);
});

test('a turn sweeps the expanded side through nearby obstacles before committing its pose',()=>{
 const wall={minX:2.515,maxX:2.54,minY:.4,maxY:2,minZ:0,maxZ:6};
 const car=driving(ground([wall]).terrain,{...neutral,maxX:2.2});car.pose.steering=.4;
 assert.equal(car.valid(0,0,0),true);let stopped=false;
 for(let i=0;i<30;i++){car.advance(1/60,{...coast,steer:-1});stopped||=car.collided;}
 assert(stopped);assert.equal(car.pose.speed,0);assert(car.pose.heading<.08,'the pending colliding rotation is not committed');
});

test('neutral and expanded envelopes leave acceleration, steering, braking and grip unchanged in clear space',()=>{
 const original=driving(ground().terrain),neutralCar=driving(ground().terrain,neutral),open=driving(ground().terrain,{...neutral,minX:-2.3,maxX:2.4,minZ:-3.8,maxY:2.8});
 for(let frame=0;frame<300;frame++){
  const input={gas:frame<120?1:0,brake:frame>220?.7:0,steer:Math.sin(frame*.03)*.4,handbrake:false};
  original.advance(1/60,input);neutralCar.advance(1/60,input);open.advance(1/60,input);
  assert.deepEqual(neutralCar.pose,original.pose);assert.deepEqual(open.pose,original.pose);
  assert.equal(neutralCar.gear,original.gear);assert.equal(open.gear,original.gear);
 }
});

test('undefined restores the exact original footprint and movement ray queries',()=>{
 const a=ground(),b=ground(),original=driving(a.terrain),custom=driving(b.terrain,{...neutral,maxX:3,maxY:4});
 custom.setCollisionEnvelope(undefined);original.advance(1/60,{...coast,gas:1,steer:.25});custom.advance(1/60,{...coast,gas:1,steer:.25});
 assert.deepEqual(custom.pose,original.pose);assert.deepEqual(b.points,a.points);assert.deepEqual(b.rays,a.rays);
 assert(a.rays.every(ray=>ray.d.y===0&&ray.half===CAR.halfWidth));
});

test('an installed envelope uses at most eight volume probes and the legacy movement ray per substep',()=>{
 const fixture=ground(),car=driving(fixture.terrain,{...neutral,minX:-2.4,maxX:2.7,minY:.25,maxY:2.3,minZ:-4.2,maxZ:3.4});
 car.advance(1/120,{...coast,steer:-.4});
 assert(fixture.points.length>=15&&fixture.points.length<=30);assert.equal(fixture.rays.length,9);
 const probes=fixture.rays.filter(ray=>ray.d.y===1);assert.equal(probes.length,8);
 for(const probe of probes){assert.equal(probe.o.y,.25);assert(Math.abs(probe.max-2.05)<1e-9);assert(probe.half>0);}
 assert.equal(fixture.rays.filter(ray=>ray.d.y===0).length,1);
});

test('separate side-door bounds allow opening beside a front wall and reversing away without a phantom bumper',()=>{
 const fixture=ground();fixture.terrain.obstructed=(_x,z)=>z>=8.398;
 const door={minX:.66,maxX:1.989,minY:.25,maxY:1.4,minZ:-.133,maxZ:1.217};
 const car=driving(fixture.terrain,neutral,-1);car.pose.z=5.32;car.pose.heading=-.153;
 assert.equal(car.valid(car.pose.x,car.pose.z,car.pose.heading),true);
 car.setCollisionEnvelope({...neutral,maxX:door.maxX});
 assert.equal(car.valid(car.pose.x,car.pose.z,car.pose.heading),false,'a union box invents an extended front-right bumper');
 car.setCollisionEnvelope({...neutral,parts:[door]});
 assert.equal(car.valid(car.pose.x,car.pose.z,car.pose.heading),true,'the side door occupies only its own length');
 car.advance(.1,coast);assert.equal(car.collided,false);assert(car.pose.z<5.23&&car.pose.speed<0);
});

test('separate parts retain their own height ranges and still cover a thin obstacle across a rear panel',()=>{
 const plate={minX:-.2,maxX:.2,minY:1.75,maxY:1.751,minZ:-3.8,maxZ:-3.7};
 const car=driving(ground([plate]).terrain,neutral),part={minX:-.5,maxX:.5,minY:1.8,maxY:2.4,minZ:-4.1,maxZ:-3.3};
 assert.equal(car.setCollisionEnvelope({...neutral,parts:[part]}),true);assert.equal(car.valid(0,0,0),true,'obstacle below the raised panel is clear of the shorter chassis');
 part.minY=1.7;car.setCollisionEnvelope({...neutral,parts:[part]});assert.equal(car.valid(0,0,0),false);
 part.minY=2.1;assert.equal(car.valid(0,0,0),false,'parts are copied rather than retained by reference');
});

test('invalid, sparse, or excessive parts preserve the previous complete envelope',()=>{
 const plate={minX:1.9,maxX:2,minY:.6,maxY:1.2,minZ:-.2,maxZ:.2};
 const car=driving(ground([plate]).terrain),part={minX:1.5,maxX:2.2,minY:.4,maxY:1.4,minZ:-.5,maxZ:.5};
 car.setCollisionEnvelope({...neutral,parts:[part]});assert.equal(car.valid(0,0,0),false);
 const invalid=[[{...part,maxY:Infinity}],[{...part,minZ:2,maxZ:1}],Array(1),Array.from({length:5},()=>part),null];
 for(const parts of invalid){assert.equal(car.setCollisionEnvelope({...neutral,parts} as CarCollisionEnvelope),false);assert.equal(car.valid(0,0,0),false);}
 assert.equal(car.setCollisionEnvelope(neutral),true);assert.equal(car.valid(0,0,0),true,'omitting parts removes their cached geometry');
});

test('four panel parts are bounded to sixteen extra vertical probes with their individual Y ranges',()=>{
 const fixture=ground(),parts=Array.from({length:4},(_,i)=>({minX:1.2+i*.2,maxX:1.4+i*.2,minY:.3+i*.2,maxY:1.3+i*.2,minZ:-.4,maxZ:.4}));
 const car=driving(fixture.terrain,{...neutral,parts});car.advance(1/120,coast);
 assert.equal(fixture.rays.filter(ray=>ray.d.y===1).length,24);assert.equal(fixture.rays.length,25);assert(fixture.points.length<=66);
 for(let i=0;i<parts.length;i++)for(const ray of fixture.rays.slice(8+i*4,12+i*4)){
  assert.equal(ray.o.y,parts[i].minY);assert(Math.abs(ray.max-(parts[i].maxY-parts[i].minY))<1e-9);
 }
});

test('changing only collision heights reuses the cache and every sample while preserving exact queries',()=>{
 const fixture=ground(),car=driving(fixture.terrain,neutral),cache=cacheOf(car),cells=[...cache.cells],points=[...cache.footprint];
 const arrays={cells:cache.cells,footprint:cache.footprint,parts:cache.parts},bounds=cache.bounds;
 for(let i=1;i<=80;i++){
  const envelope={...neutral,minY:i*.001,maxY:1.6+i*.002};assert.equal(car.setCollisionEnvelope(envelope),true);
  assert.equal(cacheOf(car),cache);assert.equal(cache.bounds,bounds);assert.equal(cache.cells,arrays.cells);assert.equal(cache.footprint,arrays.footprint);assert.equal(cache.parts,arrays.parts);
  cells.forEach((cell,j)=>assert.equal(cache.cells[j],cell));points.forEach((point,j)=>assert.equal(cache.footprint[j],point));
  const fresh=ground(),reference=driving(fresh.terrain,envelope);fixture.rays.length=fixture.points.length=0;
  assert.equal(car.valid(0,0,.21),reference.valid(0,0,.21));assert.deepEqual(fixture.rays,fresh.rays);assert.deepEqual(fixture.points,fresh.points);
 }
});

test('full bounds updates with the same panel count reuse objects and match a fresh collision cache',()=>{
 const make=(i:number):CarCollisionEnvelope=>({...neutral,minX:-1.2-i*.002,maxX:2.2+i*.003,minZ:-3.4-i*.004,maxZ:3.3+i*.002,maxY:1.8+i*.005,parts:[
  {minX:1.2+i*.001,maxX:2.4+i*.002,minY:.3+i*.003,maxY:1.3+i*.004,minZ:-.2-i*.002,maxZ:1.1+i*.001},
  {minX:-.7-i*.002,maxX:.7+i*.001,minY:1.6+i*.002,maxY:2.2+i*.003,minZ:-4.1-i*.003,maxZ:-3.3-i*.001},
 ]});
 const fixture=ground(),car=driving(fixture.terrain,make(0)),cache=cacheOf(car),cells=[...cache.cells],points=[...cache.footprint],parts=[...cache.parts];
 for(let i=1;i<=40;i++){
  const envelope=make(i);assert.equal(car.setCollisionEnvelope(envelope),true);assert.equal(cacheOf(car),cache);
  cells.forEach((cell,j)=>assert.equal(cache.cells[j],cell));points.forEach((point,j)=>assert.equal(cache.footprint[j],point));parts.forEach((part,j)=>assert.equal(cache.parts[j],part));
  const fresh=ground(),reference=driving(fresh.terrain,envelope);reference.pose={...car.pose};fixture.rays.length=fixture.points.length=0;
  const input={...coast,steer:Math.sin(i*.1)*.2};car.advance(1/120,input);reference.advance(1/120,input);
  assert.deepEqual(car.pose,reference.pose);assert.deepEqual(fixture.rays,fresh.rays);assert.deepEqual(fixture.points,fresh.points);
 }
 const before=structuredClone(cache),invalid=make(41);invalid.parts![1].maxY=NaN;
 assert.equal(car.setCollisionEnvelope(invalid),false);assert.equal(cacheOf(car),cache);assert.deepEqual(cache,before,'invalid later parts cannot partially update cached bounds');
});

test('road contact is allowed below the volume probes without ignoring a higher obstacle',()=>{
 const deck={minX:-30,maxX:30,minY:5.65,maxY:6.08,minZ:-30,maxZ:30};
 const fixture=ground([deck],6),car=driving(fixture.terrain,{...neutral,minY:-.05,maxY:1.8});
 assert.equal(car.valid(0,0,0),true);car.advance(.1,coast);assert(!car.collided&&car.pose.z>.5);
 fixture.terrain.raycastObstacle=(o,d,max,half=0)=>boxRay({minX:-30,maxX:30,minY:6.3,maxY:6.31,minZ:-30,maxZ:30},o,d,max,half);
 assert.equal(car.valid(car.pose.x,car.pose.z,car.pose.heading),false);
});

test('the actual bridge deck stays drivable with the numerical envelope on ascent, crown and descent',()=>{
 const map=JSON.parse(readFileSync('public/belle/map.json','utf8')) as ParkMap,terrain=new ParkTerrain(map);
 const dx=map.bridge.b[0]-map.bridge.a[0],dz=map.bridge.b[1]-map.bridge.a[1],heading=Math.atan2(dx,dz);
 for(const fraction of [.15,.5,.85]){
  const x=map.bridge.a[0]+dx*fraction,z=map.bridge.a[1]+dz*fraction;
  const car=new CarController(terrain,{x,z,heading});car.setCollisionEnvelope(neutral);car.engine=true;car.gear='D';car.pose.speed=6;
  assert.equal(car.valid(x,z,heading),true,`bridge fraction ${fraction} initial clearance`);
  car.advance(.1,coast);assert.equal(car.collided,false,`bridge fraction ${fraction} motion`);assert(car.pose.distance>.5);
 }
});
