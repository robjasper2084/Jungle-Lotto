import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';import {ParkTerrain,type ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(process.cwd()+'/public/belle/map.json','utf8')) as ParkMap,terrain=new ParkTerrain(map);
for(const id of ['42986446','42986453','42986457','42986459','60929039','107196454','1543125463','42986439','860335422','509207545']){
 const road=map.roads.find(r=>r.id===id)!,a=road.points[0],b=road.points.at(-1)!,length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 for(const reverse of [false,true])for(const foot of [false,true])test(road.name+' crossing '+(reverse?'reverse':'forward')+' '+(foot?'walking':'riding'),()=>{
  const start=reverse?b:a,end=reverse?a:b,ux=(end[0]-start[0])/length,uz=(end[1]-start[1])/length;
  const c=new RideCore(terrain,{spawn:{position:{x:start[0]+ux*.6,y:2,z:start[1]+uz*.6},headingY:Math.atan2(ux,uz)}});
  if(foot){c.advance(1/60,{dismount:true});for(let n=0;n<120;n++)c.advance(1/60,{});assert.equal(c.current.footMode,2);}
  let progress=.6;
  for(let i=0;i<60*75&&progress<length-.6;i++){
   c.advance(1/60,{throttle:foot?.7:.35});progress=(c.current.x-start[0])*ux+(c.current.z-start[1])*uz;
   assert(!c.controller.crashed,'new structural collision caused a fall: '+c.controller.crashCause);
   assert(terrain.land(c.current.x,c.current.z),'crossing lost ground support');assert(Number.isFinite(c.current.y));
  }
  assert(progress>=length-.6,'rider stopped before bridge exit: '+progress);
 });
}
