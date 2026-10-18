import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CruiseControl} from '../src/cruiseControl.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {createGroundSample,type TerrainSampler} from '../src/terrain.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
const tick=(c:CruiseControl,throttle:number,speed:number,time:number)=>c.update(throttle,speed,1/60,true,false,time);
function doublePush(c:CruiseControl,speed=8){tick(c,1,speed,0);tick(c,0,speed,150);tick(c,1,speed,300);}

test('double forward captures the actual speed; release and steering do not accelerate it',()=>{
 const c=new CruiseControl();tick(c,1,5,0);tick(c,0,6,150);tick(c,1,8,300);
 assert.equal(c.active,true);assert.equal(c.targetSpeed,8);
 assert.equal(tick(c,1,8,400),0,'holding the second push must not keep accelerating');
 assert.equal(tick(c,0,8,500),0);assert.equal(c.active,true);
 assert.ok(tick(c,0,7,600)>0);assert.ok(tick(c,0,9,700)<0);assert.equal(c.targetSpeed,8);
});
test('a held push, lateral jitter, slow second push and stationary pushes do not engage',()=>{
 const c=new CruiseControl();for(let n=0;n<60;n++)tick(c,1,8,n*16);assert.equal(c.active,false);
 tick(c,.5,8,1000);tick(c,.9,8,1100);assert.equal(c.active,false);
 c.reset();tick(c,1,8,0);tick(c,0,8,100);tick(c,1,8,600);assert.equal(c.active,false);
 c.reset();doublePush(c,0);assert.equal(c.active,false);
});
test('braking, interruption and dismounted/dead/inactive states clear speed and gesture',()=>{
 const c=new CruiseControl();doublePush(c);assert.equal(tick(c,-1,8,350),-1);assert.equal(c.active,false);
 doublePush(c);c.update(0,8,1/60,true,true,350);assert.equal(c.active,false);
 doublePush(c);c.update(0,8,1/60,false,false,350);assert.equal(c.active,false);assert.equal(c.targetSpeed,0);
 tick(c,1,8,360);assert.equal(c.active,false,'no stale first push after resuming');
 c.reset();tick(c,1,8,370);assert.equal(c.active,false);
});
test('different players retain separate speed locks and manual toggle holds current speed',()=>{
 const a=new CruiseControl(),b=new CruiseControl();doublePush(a,4);doublePush(b,12);
 a.reset();assert.equal(b.targetSpeed,12);assert.equal(b.active,true);
 a.toggle(6.75);assert.equal(a.targetSpeed,6.75);a.toggle(6.75);assert.equal(a.active,false);
});
test('real riding physics settles at captured speed and still steers',()=>{
 const sim=new RideController(flat),c=new CruiseControl();
 for(let n=0;n<360;n++)sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.45});
 const target=sim.poseValue.speed;assert.ok(target>2);c.lock(target);
 for(let n=0;n<1200;n++)sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:c.update(0,sim.poseValue.speed,1/120),steer:n<120?.12:0});
 assert.ok(Math.abs(sim.poseValue.speed-target)<.15,`${sim.poseValue.speed} vs ${target}`);
 assert.ok(Math.abs(sim.poseValue.headingY)>.01);assert.equal(c.targetSpeed,target);
});
