import test from 'node:test';import assert from 'node:assert/strict';
import {DogFollower} from './companion.ts';
import {ElmwoodCompanion} from '../../../elmwood-source/src/detroit/elmwood-companion.ts';
import {createPose} from './controller.ts';
const flat:any={sampleGround(_x:number,_z:number,out:any){out.height=0;out.normal={x:0,y:1,z:0};out.offCourse=false;return out;},raycast:()=>null,raycastObstacle:()=>null};
for(const hz of [20,60,120])for(const command of ['sit','down','stay'] as const){
 test(`Swoop ${command} yields an overlapping wheel at ${hz} Hz`,()=>{
  const hero=createPose(),dog=new DogFollower(flat);dog.reset(hero);Object.assign(dog.current,{x:0,z:.35});dog.order(command);
  let longest=0,blocked=0;for(let i=0;i<hz*2;i++){const before={...dog.current};dog.step(1/hz,hero);assert.ok(Math.hypot(dog.current.x-before.x,dog.current.z-before.z)<=3.1/hz);blocked=Math.hypot(dog.current.x,dog.current.z)<.95?blocked+1:0;longest=Math.max(longest,blocked);}
  assert.ok(Math.hypot(dog.current.x,dog.current.z)>=.95,`capsules remained overlapped for ${longest/hz}s`);assert.equal(dog.command,command);
 });
 test(`Elmwood ${command} yields an overlapping wheel at ${hz} Hz`,()=>{
  const hero=createPose(),dog=new ElmwoodCompanion(flat);dog.reset(hero);dog.x=0;dog.z=.35;dog.order(command);
  for(let i=0;i<hz*2;i++){const x=dog.x,z=dog.z;dog.update(hero,1/hz);assert.ok(Math.hypot(dog.x-x,dog.z-z)<=3.1/hz);}
  assert.ok(Math.hypot(dog.x,dog.z)>=.95,'a held dog must clear the rider capsule');assert.equal(dog.command,command);
 });
}
