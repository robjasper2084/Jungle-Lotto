import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceCrowd,type CrowdAgent,type CrowdPath} from './crowdFlow.ts';
import {DetroitWorld,trafficAt,trafficNavigationRadius,heightAt} from './world.ts';
import {GeoTerrain} from './geo-terrain.ts';
import {isCharacter} from './actorAvoidance.ts';
import {toLocal} from './geo-profile.ts';
const path:CrowdPath={length:1000,runout:180,width:()=>7,point:(d,u)=>({x:u,y:0,z:d,heading:0})};
const person=(lane=0):CrowdAgent=>({id:'walker',kind:'pedestrian',distance:0,lane,direction:1,pace:1.1,speed:1.1,radius:.32,height:1.8,x:lane,y:0,z:0,heading:0});
test('a person steps aside for a rider approaching from behind and resumes their route',()=>{
 const a=person();let aside=0;for(let i=0;i<240;i++){const rider={id:'player',kind:'rider',x:0,y:0,z:-3+i/30*2.5,radius:.48,height:2.15,vx:0,vz:2.5};advanceCrowd([a],1/30,path,[rider]);aside=Math.max(aside,Math.abs(a.x));}
 assert.ok(aside>1,'leaves riding space');assert.ok(a.distance>5,'resumes walking');assert.equal(a.direction,1);assert.ok(Number.isFinite(a.heading));
});
test('people use visible raised pavement as their footing and keep moving across it',async()=>{
 const map=await new DetroitWorld().init();try{
  const entry=trafficAt(2,0),y=heightAt(entry.x,entry.z)+.3,w=10;
  map.addRideSurface(new Float32Array([entry.x-w,y,entry.z-w,entry.x-w,y,entry.z+w,entry.x+w,y,entry.z-w,entry.x+w,y,entry.z-w,entry.x-w,y,entry.z+w,entry.x+w,y,entry.z+w]));map.step();
  map.updateTraffic(0,entry.x+10,entry.z);let raised=false,movement=0;let previous=entry;
  for(let i=1;i<=120;i++){map.updateTraffic(i/30,entry.x+10,entry.z);map.step();const a=map.traffic.find(t=>t.id===entry.id)!;raised ||=a.y>=y-.01;movement+=Math.hypot(a.x-previous.x,a.z-previous.z);previous=a;}
  assert.ok(raised,'walks on the rendered surface');assert.ok(movement>2,'does not queue at an invisible terrain edge');
 }finally{map.physics.free();}
});
test('walking and skating envelopes leave a visible gap without granting pass-through',()=>{
 assert.equal(trafficNavigationRadius('pedestrian'),.32);assert.ok(trafficNavigationRadius('skater')<.5);assert.ok(trafficNavigationRadius('cyclist')>.8);
});
test('the riding view uses one character sweep while retaining contact and recovery checks',async()=>{
 const map=await new DetroitWorld().init();try{
  const t=trafficAt(2,0);map.updateTraffic(0,t.x,t.z);map.step();const terrain=new GeoTerrain(map).withActorRayPassThrough(isCharacter),p=toLocal(t.x,t.y,t.z);
  assert.equal(terrain.raycastObstacle({...p,y:p.y+.6},{x:0,y:0,z:1},.1),null);
  assert.ok(terrain.navigationObstacles(p.x,p.z,2).some(o=>o.id==='traffic-2'),'person still has contact');
  assert.equal(terrain.mountedClear(p,0,.48,2.15),false,'recovery cannot place the hero inside a person');
  map.addBox({x:t.x,y:t.y+.6,z:t.z,hx:.2,hy:.2,hz:.2,kind:'wall'});map.step();
  assert.notEqual(terrain.raycastObstacle({...p,y:p.y+.6},{x:0,y:0,z:1},.1),null,'actual fixtures stay solid');
 }finally{map.physics.free();}
});
