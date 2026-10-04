import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ElmwoodTerrain} from './elmwood-terrain.ts';import {rideCoreTerrain} from './ridecore-terrain.ts';import {laneGates,ElmwoodRun} from './elmwood-gameplay.ts';import {ElmwoodRacePilot,ElmwoodRacePack} from './elmwood-race.ts';
const read=(n:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+n,import.meta.url),'utf8')),site=read('site.json'),terrain=new ElmwoodTerrain(read('terrain.json'),site.features,read('placements.json'));await terrain.init();
const points=site.features.find((f:any)=>f.id==='59197492').points.map((p:number[])=>({x:p[0],z:-p[1]})),gates=laneGates(site.features.find((f:any)=>f.id==='59197492').points);
for(const cycling of [true,false])test('all three '+(cycling?'bicycle':'EUC')+' racers finish the actual Creek Lane course',t=>{
 const rivals=Array.from({length:3},(_,i)=>new ElmwoodRacePilot(rideCoreTerrain(terrain),points,gates,i,cycling));let stops=0;
 for(let i=0;i<240*120&&!rivals.every(r=>r.run.finished);i++)for(const r of rivals){r.step(1/120,rivals);if(i>600&&r.station<r.route.length-5&&Math.abs(r.pose.speed)<.1)stops++;}
 for(const r of rivals)assert.ok(r.run.finished,JSON.stringify({station:r.station,gate:r.run.gate,pose:r.pose,recoveries:r.recoveries}));
 t.diagnostic(JSON.stringify({vehicle:cycling?'bicycle':'EUC',finishes:rivals.map(r=>r.run.finishTime),recoveries:rivals.map(r=>r.recoveries),stoppedTicks:stops}));
});
test('the race has no time cutoff and recovery relocation cannot grant a gate',()=>{const run=new ElmwoodRun(gates);run.reset('sprint',points[0]);run.update(121,points[0],[]);assert.equal(run.failed,false);assert.equal(run.finished,false);run.relocate(points.at(-1)!);run.update(1,points.at(-1)!,[]);assert.equal(run.gate,1);});

for(const hz of [15,30])test('pack finishes together with '+hz+' Hz render frames',()=>{const rivals=Array.from({length:3},(_,i)=>new ElmwoodRacePilot(rideCoreTerrain(terrain),points,gates,i,true)),pack=new ElmwoodRacePack();for(let i=0;i<hz*100&&!rivals.every(r=>r.run.finished);i++)pack.update(1/hz,rivals);for(const r of rivals){assert.ok(r.run.finished,JSON.stringify({index:r.index,station:r.station,gate:r.run.gate,recoveries:r.recoveries}));assert.equal(r.recoveries,0);}});

test('bicycle pack passes a stopped roaming cyclist near the first bend without recovery',()=>{
 const map=rideCoreTerrain(terrain),probe=new ElmwoodRacePilot(map,points,gates,0,true),spot=probe.route.at(27,.95);
 map.navigationObstacles=()=>[{id:'stopped-cyclist',x:spot.x,y:terrain.height(spot.x,-spot.z),z:spot.z,radius:.45,height:1.8,kind:'cyclist',vx:0,vz:0}];
 const rivals=Array.from({length:3},(_,i)=>new ElmwoodRacePilot(map,points,gates,i,true)),pack=new ElmwoodRacePack();
 for(let i=0;i<30*100&&!rivals.every(r=>r.run.finished);i++)pack.update(1/30,rivals);
 for(const r of rivals){assert.ok(r.run.finished,JSON.stringify({index:r.index,station:r.station,gate:r.run.gate,recoveries:r.recoveries}));assert.equal(r.recoveries,0);}
});
