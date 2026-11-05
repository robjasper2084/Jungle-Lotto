import test from 'node:test';
import assert from 'node:assert/strict';
import {AmbientCyclistTraffic,cyclistCircuit} from '../../../ride-core/src/ambientCyclistTraffic.ts';
import {DetroitWorld,LENGTH} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toMap} from './geo-profile.ts';
import {routePosition} from './districtView.ts';

test('twenty cyclists clear a stopped rider on the mapped Wilkins trail',async()=>{
 const mapped=await new DetroitWorld().init(),terrain=new GeoTerrain(mapped);
 try{
  const p=routePosition(2191.89),player={id:'player',...p,radius:.65,height:1.8,kind:'rider',vx:0,vz:0};
  const traffic=new AmbientCyclistTraffic(terrain,cyclistCircuit(Array.from({length:100},(_,i)=>({...routePosition(60+i*(LENGTH-120)/99),width:5}))),523);
  mapped.randomizePeople(4152953807);
  mapped.crowdActors=()=>traffic.obstacles().map(o=>({...o,...toMap(o.x,o.y,o.z),vx:-o.vx}));
  terrain.extraActors=()=>[{id:'dog',...p,x:p.x+1.3,radius:.36,height:.85,kind:'dog',vx:0,vz:0}];
  traffic.restart(523,p);const riders=traffic.rides.flatMap(r=>r.riders),starts=riders.map(r=>r.s);let clearance=Infinity;let finalMinute:number[]=[];
  for(let tick=0;tick<6000;tick++){
   if(tick===4800)finalMinute=riders.map(r=>r.s);
   const m=toMap(p.x,p.y,p.z);mapped.updateTraffic(tick*.05,m.x,m.z);mapped.step();
   traffic.update(.05,p,false,[player]);
   for(const r of riders)clearance=Math.min(clearance,Math.hypot(r.x-p.x,r.z-p.z));
  }
  assert(riders.every((r,i)=>r.s-finalMinute[i]>100),'permanent traffic jam: '+JSON.stringify(riders.map((r,i)=>({travel:r.s-finalMinute[i],blocked:r.blocked,speed:r.speed}))));
  assert(clearance>1.18,`player clearance ${clearance}`);
  assert(riders.every((r,i)=>r.s-starts[i]>500),JSON.stringify(riders.map((r,i)=>({travel:r.s-starts[i],blocked:r.blocked}))));
 }finally{mapped.physics.free();}
});
