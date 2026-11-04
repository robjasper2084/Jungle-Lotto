import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {ParkTerrain,type ParkMap} from './terrain.ts';import {macArthurLamps,bridgeOverlook} from './bridgeLighting.ts';import plan from './ambassadorLayout.json' with {type:'json'};
import {bridgePoolData,uniquePosts,BridgeLightSlots} from './bridgeLightPlan.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;const terrain=new ParkTerrain(map);
test('bridge uses mapped tower anchors and published dimensions',()=>{assert.ok(Math.abs(plan.span-1850*.3048)<2);assert.ok(Math.abs(plan.height-386*.3048)<.1);assert.ok(plan.center[0]<-5000&&plan.center[2]>3000);assert.ok(Math.hypot(plan.center[0]-bridgeOverlook.x,plan.center[2]-bridgeOverlook.z)>5500);});
test('bridge photo viewpoint is dry and clear of collision',()=>{assert.ok(terrain.land(bridgeOverlook.x,bridgeOverlook.z));assert.ok(!terrain.obstructed(bridgeOverlook.x,bridgeOverlook.z,.5));});
test('all modeled MacArthur globe centers receive working light fixtures',()=>{const lamps=macArthurLamps(map);assert.equal(lamps.length,Math.ceil(Math.floor(map.bridge.length)/35)*6);for(const l of lamps){const b=terrain.bridge(l.p[0],l.p[2]);assert.ok(Math.abs(Math.abs(b.side)-11.9)<.01);assert.ok(l.p[1]-l.ground[1]>5);}});
test('Ambassador pole heads remain along deck edges, above their road pools',()=>{assert.ok(plan.roadway.length>50);for(const l of plan.roadway){assert.ok(Math.abs(l.p[1]-l.ground[1]-9.48)<.001);assert.deepEqual([l.p[0],l.p[2]],[l.ground[0],l.ground[2]]);}});
test('permanent MacArthur light pools stay above the curved road and inside the bridge',()=>{
 const mac=macArthurLamps(map),p=bridgePoolData(map,mac),count=uniquePosts(mac).length*12*12*6*3;
 assert.equal(uniquePosts(mac).length,mac.length/3);
 for(let i=0;i<count;i+=3){const x=p.positions[i],y=p.positions[i+1],z=p.positions[i+2],b=terrain.bridge(x,z);assert.ok(b.t>=-1e-6&&b.t<=1+1e-6);assert.ok(Math.abs(b.side)<=13.0001);assert.ok(y-(6+4*Math.sin(Math.PI*b.t)+.06)>.02);}
 assert.ok(p.positions.every(Number.isFinite));assert.equal(p.uv.length,p.positions.length/3*2);
});
test('moving past a lamp keeps its identity until it has faded out',()=>{
 const lamps=Array.from({length:10},(_,i)=>({p:[i*20,8,0],ground:[i*20,0,0]})),pool=new BridgeLightSlots();
 for(let i=0;i<30;i++)pool.update(lamps,15,0,.05);
 const before=pool.slots.map(s=>({...s}));pool.update(lamps,150,0,.05);
 pool.slots.forEach((s,i)=>{if(before[i].level>.1){assert.equal(s.index,before[i].index);assert.ok(Math.abs(s.level-before[i].level)<=.10001);}});
 for(let i=0;i<30;i++)pool.update(lamps,150,0,.05);
 assert.ok(pool.slots.every(s=>s.index>=5));assert.equal(new Set(pool.slots.map(s=>s.index)).size,4);
});
