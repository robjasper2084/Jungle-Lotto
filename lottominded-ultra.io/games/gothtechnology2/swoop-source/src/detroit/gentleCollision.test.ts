import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RideController,NEUTRAL_ACTIONS} from './controller.ts';
const ground={sampleGround(_x:number,_z:number,out:any){out.height=0;out.normal={x:0,y:1,z:0};out.surface='pavement';out.offCourse=false;return out;},raycast:()=>null};
function advance(c:RideController,t:number,throttle=0){for(let i=0;i<t*120;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle});}
test('walking-speed solid bumps stop the wheel without falling',()=>{let blocked=false;const c=new RideController({...ground,raycastObstacle:()=>blocked?0:null});advance(c,.6,.55);assert.ok(c.snapshot().speed>1.6&&c.snapshot().speed<4.2);blocked=true;advance(c,.1);assert.equal(c.crashed,false);assert.equal(c.snapshot().speed,0);});
test('hard head-on impacts still trigger a fall',()=>{let blocked=false;const c=new RideController({...ground,raycastObstacle:()=>blocked?0:null});advance(c,2,1);assert.ok(c.snapshot().speed>4.2);blocked=true;advance(c,.1);assert.equal(c.crashed,true);});
test('a fast glancing contact with little inward velocity slides instead of falling',()=>{let blocked=false;const c=new RideController({...ground,raycastObstacle:(_o:any,d:any)=>blocked&&Math.abs(d.x)>1e-7?0:null},{spawn:{position:{x:0,y:0,z:0},headingY:.15}});advance(c,2,1);blocked=true;advance(c,.1);assert.equal(c.crashed,false);assert.ok(c.snapshot().position.z>0);});
