import test from 'node:test';import assert from 'node:assert/strict';
import {advanceCrowd,type CrowdAgent,type CrowdPath} from './crowdFlow.ts';
const path:CrowdPath={length:1000,runout:100,width:()=>7,point:(d,u)=>({x:u,y:0,z:d,heading:0})};
const rider=(direction=1):CrowdAgent=>({id:'rider',kind:'cyclist',distance:0,lane:direction*1.65,direction,pace:3,speed:3,radius:.55,height:1.8,x:direction*1.65,y:0,z:0,heading:direction<0?Math.PI:0});
test('crowd riders escape a static building wall without dynamic obstacle hints or teleporting',()=>{
 for(const direction of [1,-1]){
  const a=rider(direction),clear=(x:number,_y:number,z:number)=>!(x*direction>.5&&z*direction>=4&&z*direction<=10),route={...path,walkable:clear};
  let detour=false;
  for(let i=0;i<600;i++){const before={x:a.x,z:a.z};advanceCrowd([a],1/30,route,[]);detour ||=a.x*direction<.5;assert.ok(clear(a.x,a.y,a.z),'never enters the building');assert.ok(Math.hypot(a.x-before.x,a.z-before.z)<.11,'moves continuously');assert.equal(a.direction,direction);assert.ok(!a.incapacitated);}
  assert.ok(detour,'takes a clear lateral escape');assert.ok(a.distance*direction>25,JSON.stringify(a));assert.ok(a.lane*direction>1.5,'returns to the home lane beyond the wall');
 }
});
test('static forward and lateral sweeps reject walls between otherwise clear endpoints',()=>{
 const a=rider(),route={...path,walkable:(_x:number,_y:number,z:number)=>!(z>=.16&&z<=.32)};
 a.pace=a.speed=6;advanceCrowd([a],.1,route,[]);assert.ok(a.distance<.16,'cannot cross a thin wall in one long frame');
 const trapped=rider(),barrier={...path,walkable:(x:number,_y:number,z:number)=>!(z>=4&&z<=12)&&!(x>=.6&&x<=1.2)};
 let retreated=false;
 for(let i=0;i<600;i++){const before=trapped.distance;advanceCrowd([trapped],1/30,barrier,[]);retreated ||=trapped.distance<before;assert.ok(Math.abs(trapped.distance-before)<.11,'recovery remains continuous');assert.ok(trapped.z<4,'blocked route stays solid');assert.ok(trapped.x>1.2,'does not step through a side wall to a clear endpoint');}
 assert.ok(retreated,'backs out when every forward exit is blocked');
 assert.ok(trapped.distance>0,'uses bounded recovery instead of jumping to another route');
});
