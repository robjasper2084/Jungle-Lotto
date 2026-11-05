import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ridingCompanion,computerBikeContact,bikeChallenger} from './cyclistContacts.ts';
import {advanceCrowd,type CrowdAgent,type CrowdPath} from './crowdFlow.ts';
import {CommunityRide,LaneRoute} from '@digital-static/ridecore/cycling';
import {createGroundSample,type NavigationObstacle,type TerrainSampler} from './terrain.ts';
import {DetroitWorld,trafficAt} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {toLocal} from './geo-profile.ts';
import {RideController,createPose,NEUTRAL_ACTIONS} from './controller.ts';
import {routePosition} from './districtView.ts';
import {RacePilot} from './racePilot.ts';
import {RaceRules} from './raceRules.ts';
const bike=(id:string,x=0,z=0):NavigationObstacle=>({id,x,y:0,z,radius:.55,height:1.8,kind:'cyclist',vx:0,vz:3});
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
const path:CrowdPath={length:1000,runout:180,point:(d,u)=>({x:u,y:0,z:d,heading:0}),width:()=>1.6};
const cyclist=(id:string,d:number,direction=1):CrowdAgent=>({id,kind:'cyclist',distance:d,lane:0,direction,pace:3,speed:3,radius:.55,height:1.8,x:0,y:0,z:d,heading:direction<0?Math.PI:0});
test('only joined cycling companions ghost the player; other actors remain solid',()=>{
 for(const o of [bike('traffic-3'),{...bike('community-0'),kind:'pedestrian'},bike('human-player')])assert.equal(ridingCompanion(o,true,true),false);
 assert.equal(ridingCompanion(bike('community-0'),false,false),false);
 assert.equal(ridingCompanion(bike('community-0'),true,false),true);
 assert.equal(ridingCompanion(bike('rival-1'),false,true),true);
 assert.equal(ridingCompanion(bike('rival-1'),true,false),false);
 assert.equal(computerBikeContact({...bike('traffic-3'),fallen:true}),false);
});
test('a bicycle race opponent passes both parts of the participating human envelope',()=>{
 const rules=new RaceRules('DS_Man_01'),at=routePosition(12,-1.35),obstacles=[
  {id:'human-player',...at,y:0,radius:2,height:2.1,kind:'rider',vx:0,vz:0},
  {id:'human-player-wheel',...at,y:0,radius:2,height:.7,kind:'wheel',vx:0,vz:0}
 ];
 const pilot=new RacePilot(flat,rules.racers[1].id,0,'club',()=>obstacles,true);rules.advance(3);
 for(let tick=0;tick<120*10;tick++)pilot.step(1/120,rules);
 assert.ok(rules.racers[1].station>30,JSON.stringify(rules.racers[1]));assert.equal(pilot.sim.crashed,false);
});
test('opposing computer bikes cross a narrow lane without braking or crashing and try to steer aside',()=>{
 const riders=[cyclist('a',0),cyclist('b',8,-1)];let overlap=false,aside=0;
 for(let tick=0;tick<150;tick++){advanceCrowd(riders,1/30,path,[]);const [a,b]=riders;overlap ||=Math.hypot(a.x-b.x,a.z-b.z)<1.1;aside=Math.max(aside,Math.abs(a.lane),Math.abs(b.lane));assert.equal(a.speed,3);assert.equal(b.speed,3);}
 assert.ok(overlap);assert.ok(aside>.1);assert.ok(riders[0].distance>riders[1].distance);
});
test('computer bicycles still stop for a blocked path occupied by a pedestrian',()=>{
 const riders=[cyclist('bike',0)],person={...bike('walker',0,6),kind:'pedestrian',radius:1,vz:0};
 for(let tick=0;tick<300;tick++)advanceCrowd(riders,1/30,path,[person]);
 assert.ok(riders[0].distance<5);assert.ok(riders[0].speed<.1);
});
test('a joined player can overlap the pack without stopping its riders; unjoined player still blocks',()=>{
 const route=new LaneRoute([{x:0,z:0,width:1.6},{x:0,z:100,width:1.6}]),ride=new CommunityRide(route,flat,3.3,4);
 ride.join(route.at(0));ride.continue();ride.passThroughContact=o=>o.kind==='cyclist'||o.id==='player'&&ride.joined;
 const rider=ride.riders[0],start=rider.s;
 for(let tick=0;tick<180;tick++)ride.step(1/60,{x:rider.x,y:0,z:rider.z+.2,speed:3});
 assert.ok(rider.s>start+4);assert.equal(rider.blocked,false);assert.ok(rider.speed>3);
 ride.leave();const unjoined={x:rider.x,y:0,z:rider.z+1.5,speed:0};
 for(let tick=0;tick<120;tick++){ride.step(1/60,unjoined);assert.ok(Math.hypot(rider.x-unjoined.x,rider.z-unjoined.z)>1.0,'unjoined player remains solid during the passing manoeuvre');}
 assert.ok(rider.s<unjoined.z-1||Math.abs(rider.x-unjoined.x)>1,'stop or take a clear side lane');
});
test('mapped player passes through a joined companion using the actual rider controller',async()=>{
 const map=await new DetroitWorld().init(),world=new GeoTerrain(map),at=routePosition(850),ahead=routePosition(855);let joined=false;
 world.extraActors=()=>[{...bike('community-0',ahead.x,ahead.z),y:ahead.y,vz:0}];
 const terrain=world.withActorPassThrough(o=>ridingCompanion(o,joined,false)),pose=createPose();
 let sim=new RideController(terrain,{spawn:{position:at,headingY:at.heading}});
 for(let tick=0;tick<480;tick++){sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});map.step();}
 assert.equal(sim.crashed,true);
 joined=true;sim=new RideController(terrain,{spawn:{position:at,headingY:at.heading}});
 for(let tick=0;tick<480;tick++){sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});map.step();}
 sim.writePose(pose);assert.equal(sim.crashed,false);assert.ok(Math.hypot(pose.x-at.x,pose.z-at.z)>8);map.physics.free();
});
test('scoped computer bicycle rays ignore bicycle colliders while retaining solid world geometry',async()=>{
 const map=await new DetroitWorld().init(),t=trafficAt(3,0);map.updateTraffic(0,t.x,t.z);map.step();assert.ok(map.traffic.some(t=>t.id===3&&t.kind==='cyclist'));
 const world=new GeoTerrain(map),at=toLocal(t.x,t.y,t.z),origin={...at,y:at.y+.55},ghost=world.withActorPassThrough(computerBikeContact);
 assert.equal(world.raycastObstacle(origin,{x:0,y:0,z:1},.1),0);
 assert.equal(ghost.raycastObstacle(origin,{x:0,y:0,z:1},.1),null);
 const wall=map.addBox({x:t.x,y:t.y+.55,z:t.z+.07,hx:.03,hy:.1,hz:.01,kind:'wall'});map.step();
 assert.notEqual(ghost.raycastObstacle(origin,{x:0,y:0,z:1},.1),null);map.physics.removeCollider(wall,true);map.physics.free();
});
test('only some nearby moving cyclists can issue invitations, with elevation and range respected',()=>{
 const p={x:0,y:0,z:0};assert.equal(bikeChallenger(p,[bike('community-1'),bike('traffic-13')]),undefined);
 assert.equal(bikeChallenger(p,[bike('traffic-3',0,30),{...bike('community-0'),y:4}]),undefined);
 assert.equal(bikeChallenger(p,[bike('traffic-3',0,20),bike('community-2',0,4)])?.id,'community-2');
});

