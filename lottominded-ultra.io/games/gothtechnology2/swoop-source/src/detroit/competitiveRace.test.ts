import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DetroitWorld,cutCoords,clamp} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toMap} from './geo-profile.ts';
import {routePosition} from './districtView.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import {RaceRules,RACE_ROUTE} from './raceRules.ts';
import {RacePilot} from './racePilot.ts';
test('expert rivals catch and pass a moving 54 km/h rider without overlap or teleporting',async t=>{
 const mapped=await new DetroitWorld().init(),terrain=new GeoTerrain(mapped);mapped.updateTraffic(0,1e8,1e8);mapped.step();t.after(()=>mapped.physics.free());
 const rules=new RaceRules('DS_Man_01'),spawn=routePosition(1560),human=new RideController(terrain,{spawn:{position:spawn,headingY:spawn.heading}}),pose=createPose();human.writePose(pose);
 const pilots=rules.racers.slice(1).map((r,i)=>new RacePilot(terrain,r.id,i,'expert',()=>[{id:'human',x:pose.x,y:pose.y,z:pose.z,radius:.52,height:2.2,kind:'rider',vx:pose.velocityX,vz:pose.velocityZ}]));
 for(const [i,r] of rules.racers.entries()){const d=i?1500-i*3:1560;r.station=r.previous=d;r.gate=RACE_ROUTE.gates.filter(g=>g<=d).length;if(i)pilots[i-1].reset(d);}
 terrain.extraActors=()=>pilots.map((p,i)=>({id:'rival-'+i,x:p.pose.x,y:p.pose.y,z:p.pose.z,radius:.52,height:2.2,kind:'rider',vx:p.pose.velocityX,vz:p.pose.velocityZ}));
 rules.advance(3);let minimum=Infinity,maximumSpeed=0,passes=0;const passed=new Set<string>();
 for(let tick=0;tick<70*120;tick++){
  const dt=1/120,s=human.snapshot(),m=toMap(pose.x,pose.y,pose.z),c=cutCoords(m.x,m.z),target=routePosition(c.d+10),desired=Math.atan2(target.x-pose.x,target.z-pose.z),error=Math.atan2(Math.sin(desired-pose.headingY),Math.cos(desired-pose.headingY));
  human.step(dt,{...NEUTRAL_ACTIONS,throttle:clamp((15-s.speed)*.8+.35,-.8,1),steer:clamp(-error*2.5,-.8,.8)});human.writePose(pose);
  const after=toMap(pose.x,pose.y,pose.z),coord=cutCoords(after.x,after.z);rules.advance(dt);rules.observe(rules.player.id,coord.d,coord.u,dt);mapped.step();
  for(const pilot of pilots){const before={x:pilot.pose.x,z:pilot.pose.z};pilot.step(dt,rules);maximumSpeed=Math.max(maximumSpeed,pilot.pose.speed);minimum=Math.min(minimum,Math.hypot(pilot.pose.x-pose.x,pilot.pose.z-pose.z));assert.ok(Math.hypot(pilot.pose.x-before.x,pilot.pose.z-before.z)<.19,JSON.stringify({tick,id:pilot.id,before,pose:pilot.pose,snapshot:pilot.sim.snapshot(),racer:rules.racers.find(r=>r.id===pilot.id)}));assert.equal(pilot.sim.crashed,false);const r=rules.racers.find(r=>r.id===pilot.id)!;if(r.station>coord.d+3)passed.add(r.id);}
 }
 passes=passed.size;assert.ok(minimum>1.02,`clearance ${minimum}`);assert.ok(maximumSpeed>18.2,`peak ${maximumSpeed}`);assert.ok(passes>=2,JSON.stringify({passes,racers:rules.racers,snapshots:pilots.map(p=>p.sim.snapshot())}));assert.equal(human.crashed,false);t.diagnostic(JSON.stringify({passes,minimum,peakKmh:maximumSpeed*3.6,humanKmh:pose.speed*3.6}));
});

test('a rival touching the stopped hero backs off and rides around instead of remaining pinned',async t=>{
 const mapped=await new DetroitWorld().init(),terrain=new GeoTerrain(mapped);mapped.updateTraffic(0,1e8,1e8);mapped.step();t.after(()=>mapped.physics.free());
 const rules=new RaceRules('DS_Man_01'),p=routePosition(951.08,-1.35),hero={id:'hero',x:p.x,y:p.y,z:p.z,radius:.52,height:2.2,kind:'rider',vx:0,vz:0};
 const pilot=new RacePilot(terrain,rules.racers[1].id,0,'expert',()=>[hero]);pilot.reset(950);
 rules.racers.forEach((r,i)=>{const d=i===1?950:951.08;r.station=r.previous=d;r.offset=-1.35;r.gate=RACE_ROUTE.gates.filter(g=>g<=d).length;if(i>1)r.finish=1;});rules.advance(3);
 let minimum=Infinity,reversed=false;
 for(let tick=0;tick<20*120;tick++){const before={...pilot.pose};rules.advance(1/120);mapped.step();pilot.step(1/120,rules);minimum=Math.min(minimum,Math.hypot(pilot.pose.x-hero.x,pilot.pose.z-hero.z));reversed ||= pilot.pose.speed<-.15;assert.equal(pilot.sim.crashed,false);assert.ok(Math.hypot(pilot.pose.x-before.x,pilot.pose.z-before.z)<.19,'no teleport');}
 const m=toMap(pilot.pose.x,pilot.pose.y,pilot.pose.z),c=cutCoords(m.x,m.z);assert.ok(minimum>=1.0,`clearance ${minimum}`);assert.ok(c.d>980,JSON.stringify({station:c.d,minimum,reversed,snapshot:pilot.sim.snapshot()}));t.diagnostic(JSON.stringify({station:c.d,minimum,reversed}));
});
