import assert from 'node:assert/strict';
import {test} from 'node:test';
import {RaceRules,RACE_ROUTE,CUT_THROUGH,type RaceDifficulty} from './raceRules.ts';
import {RacePilot} from './racePilot.ts';
import {DetroitWorld} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {RIDER_CHOICES} from './riderChoices.ts';
import {cutPoint} from './world.ts';
import {createGroundSample} from './terrain.ts';
import {routePosition} from './districtView.ts';
import {ROUTE_BILLBOARDS,billboardPlacement} from './routeArt.ts';
const player='DS_Man_01';
test('each selected rider races against the other three, without duplicates',()=>{for(const r of RIDER_CHOICES){const rules=new RaceRules(r.id);assert.equal(rules.player.id,r.id);assert.equal(new Set(rules.racers.map(r=>r.id)).size,4);}});
test('countdown locks progress; zero dt pauses the clock',()=>{const r=new RaceRules(player);assert.equal(r.advance(2),0);r.observe(player,1760,0,.1);assert.equal(r.player.gate,0);assert.equal(r.advance(0),0);assert.equal(r.elapsed,0);assert.equal(r.advance(1.1),.10000000000000009);assert.ok(r.elapsed<.11);});
test('shortcuts and missed gates do not finish; recovery preserves time and earned gates',()=>{const r=new RaceRules(player);r.advance(3);r.advance(5);r.observe(player,1800,0,.01);assert.equal(r.player.gate,0);assert.equal(r.player.missed,true);assert.equal(r.recover(player),RACE_ROUTE.start);assert.equal(r.elapsed,5);for(let d=(RACE_ROUTE.start+.1);d<(RACE_ROUTE.gates[0]+1);d+=.1)r.observe(player,d,0,.02);assert.equal(r.player.gate,1);assert.equal(r.recover(player),(RACE_ROUTE.gates[0]+.5));assert.equal(r.player.gate,1);assert.equal(r.done,false);});
test('off-course crossing cannot earn a gate and reverse crossing cannot repair it',()=>{const r=new RaceRules(player);r.advance(3);for(let d=(RACE_ROUTE.start+.1);d<(RACE_ROUTE.gates[0]+2);d+=.1)r.observe(player,d,3,.02);assert.equal(r.player.gate,0);r.observe(player,(RACE_ROUTE.gates[0]-1),0,.02);assert.equal(r.player.gate,0);});
test('ordered gates finish the player and freeze elapsed time',()=>{const r=new RaceRules(player);r.advance(3);for(let d=(RACE_ROUTE.start+.1);d<RACE_ROUTE.end+.2;d+=.1){r.advance(.02);r.observe(player,d,0,.02);}assert.ok(r.done);assert.equal(r.player.gate,RACE_ROUTE.gates.length);assert.ok(r.player.finish!>77);const time=r.elapsed;r.advance(10);assert.equal(r.elapsed,time);assert.equal(r.place,1);});
const mapped=await new DetroitWorld().init(),terrain=new GeoTerrain(mapped),dt=1/120;
test('the existing Freight Yard side line has continuous support and rejoins before the next main-route checkpoint',()=>{
 for(let i=1;i<CUT_THROUGH.length;i++){
  const a=cutPoint(...CUT_THROUGH[i-1]),b=cutPoint(...CUT_THROUGH[i]);let last:number|undefined;
  const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.25);
  for(let k=0;k<=steps;k++){const t=k/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,g=mapped.sampleGround(x,z,createGroundSample());
   assert.equal(g.offCourse,false);assert.ok(g.normal.y>.94);
   if(last!==undefined)assert.ok(Math.abs(g.height-last)<.12);last=g.height;
   assert.equal(mapped.raycastObstacle({x,y:g.height+.65,z},{x:0,y:1,z:0},1.5),null);
  }
 }
 assert.ok(CUT_THROUGH.at(-1)![0]<RACE_ROUTE.gates.find(d=>d>CUT_THROUGH.at(-1)![0])!);
});
for(const difficulty of ['cruise','club','expert'] as RaceDifficulty[])test(`all three ${difficulty} rivals complete the real mapped course`,t=>{
 const r=new RaceRules(player),pilots=r.racers.slice(1).map((p,i)=>new RacePilot(terrain,p.id,i,difficulty));r.advance(3);
 for(let i=0;i<120*900&&!r.racers.slice(1).every(p=>p.finish!==null);i++){r.advance(dt);mapped.step();for(const p of pilots)p.step(dt,r);}
 for(const [i,p]of r.racers.slice(1).entries()){assert.notEqual(p.finish,null,JSON.stringify({difficulty,racer:p,snapshot:pilots[i].sim.snapshot()}));assert.equal(p.gate,RACE_ROUTE.gates.length);assert.ok(p.finish!<({cruise:300,club:200,expert:180}[difficulty]),'competitive full-route pace');t.diagnostic(`${p.id}: ${p.finish?.toFixed(2)} s`);}
});


test('a fallen rival simulates settling and waits when its recovery area is occupied',()=>{
 let blocked=false;const base={sampleGround(_x:number,_z:number,out:ReturnType<typeof createGroundSample>){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>blocked?0:null,mountedClear:()=>!blocked};
 const r=new RaceRules(player),pilot=new RacePilot(base,r.racers[1].id,0,'club');r.advance(3);
 for(let i=0;i<360;i++)pilot.step(dt,r);blocked=true;
 for(let i=0;i<360;i++)pilot.step(dt,r);
 assert.equal(pilot.sim.crashed,true);assert.equal(pilot.sim.snapshot().fallPhase,'settled');assert.ok(pilot.pose.crashRelease>.9);
 const gate=r.racers[1].gate,time=r.elapsed;blocked=false;
 for(let i=0;i<240&&pilot.sim.crashed;i++)pilot.step(dt,r);
 assert.equal(pilot.sim.crashed,false);assert.equal(pilot.sim.snapshot().state,'recovering');assert.ok(pilot.pose.crashBlend>0);assert.equal(r.racers[1].gate,gate);assert.equal(r.elapsed,time);
 for(let i=0;i<360;i++)pilot.step(dt,r);assert.equal(pilot.pose.crashBlend,0);
});

test('a long or slow race never ends on the old time cutoff or Freight Yard gate',()=>{
 const r=new RaceRules(player);r.advance(3);r.advance(900);assert.equal(r.done,false);assert.equal(r.player.finish,null);
 for(let d=RACE_ROUTE.start+.1;d<2121;d+=.1){r.advance(.02);r.observe(player,d,0,.02);}
 assert.equal(r.done,false);assert.equal(r.player.finish,null);assert.ok(r.player.gate>0);
 assert.equal(RACE_ROUTE.end,RACE_ROUTE.gates.at(-1));
});


test('expert racers pass a stopped human and each other with solid rider envelopes',t=>{
 const rules=new RaceRules(player),stopped=routePosition(1900,0),human={id:'human',x:stopped.x,y:stopped.y,z:stopped.z,radius:.52,height:2.2,kind:'rider',vx:0,vz:0};
 const pilots=rules.racers.slice(1).map((r,i)=>new RacePilot(terrain,r.id,i,'expert',()=>[human]));
 terrain.extraActors=()=>pilots.map((p,i)=>({id:'rival-'+i,x:p.pose.x,y:p.pose.y,z:p.pose.z,radius:p.sim.mountedVolume.radius,height:p.sim.mountedVolume.height,kind:'rider',vx:p.pose.velocityX,vz:p.pose.velocityZ}));
 t.after(()=>{terrain.extraActors=()=>[];});rules.advance(3);let minimum=Infinity;
 for(let tick=0;tick<900*120&&!rules.racers.slice(1).every(r=>r.finish!==null);tick++){
  rules.advance(dt);mapped.step();for(const p of pilots)p.step(dt,rules);
  for(let i=0;i<pilots.length;i++){const a=pilots[i].pose;minimum=Math.min(minimum,Math.hypot(a.x-human.x,a.z-human.z));for(let j=0;j<i;j++){const b=pilots[j].pose;minimum=Math.min(minimum,Math.hypot(a.x-b.x,a.z-b.z));}}
 }
 assert.ok(minimum>.99,`minimum separation ${minimum}`);assert.ok(rules.racers.slice(1).every(r=>r.finish!==null),JSON.stringify(rules.racers));
 t.diagnostic(JSON.stringify({minimum,finishes:rules.racers.slice(1).map(r=>r.finish)}));
});


test('expert rivals navigate seeded hazards to Mack without striking a prop',t=>{
 const boards=ROUTE_BILLBOARDS.flatMap(site=>billboardPlacement(site.at,site.offset).solids.map(s=>mapped.addBox(s)));
 t.after(()=>{for(const collider of boards)mapped.physics.removeCollider(collider,true);});
 mapped.setHazards(23,RACE_ROUTE.start,true);mapped.updateTraffic(0,1e8,1e8);mapped.step();
 t.after(()=>{mapped.setHazards(0,RACE_ROUTE.end);mapped.updateTraffic(0,1e8,1e8);mapped.step();});
 assert.ok(mapped.hazards.length>=3);
 const rules=new RaceRules(player),pilots=rules.racers.slice(1).map((r,i)=>new RacePilot(terrain,r.id,i,'expert'));rules.advance(3);let impacts=0;
 for(let tick=0;tick<900*120&&!rules.racers.slice(1).every(r=>r.finish!==null);tick++){
  rules.advance(dt);mapped.step();for(const p of pilots){const before=p.sim.crashed;p.step(dt,rules);if(!before&&p.sim.crashed){impacts++;assert.fail(JSON.stringify({tick,racer:p.id,state:p.sim.snapshot(),route:rules.racers.find(r=>r.id===p.id)}));}}
 }
 assert.ok(rules.racers.slice(1).every(r=>r.finish!==null),JSON.stringify({racers:rules.racers,states:pilots.map(p=>p.sim.snapshot()),impacts}));assert.equal(impacts,0);
 t.diagnostic(JSON.stringify({hazards:mapped.hazards.length,finishes:rules.racers.slice(1).map(r=>r.finish),impacts}));
});
