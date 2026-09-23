import {test} from 'node:test';import assert from 'node:assert/strict';
import {GamepadRideInput,deadAxis,type PadLike} from './gamepadInput.ts';
import {XRControllerInput,VRLeanDrive,vrThrottle,vrHeading,vrOrigin,vrGazeSteer,type XRPadSource} from './xrInput.ts';
import {RideController,NEUTRAL_ACTIONS,createPose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
const button=()=>({pressed:false,value:0});
const pad=():PadLike=>({id:'test standard pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},button)});
function press(p:PadLike,i:number,on=true){p.buttons[i].pressed=on;p.buttons[i].value=on?1:0;}
const xr=(handedness:string,wand=false):XRPadSource=>({handedness,gamepad:{mapping:'xr-standard',axes:wand?[0,0]:[0,0,0,0],buttons:Array.from({length:wand?3:6},button)}});
const flat:TerrainSampler={sampleGround(_x,_z,o){o.height=0;o.normal={x:0,y:1,z:0};o.surface='pavement';o.offCourse=false;return o;},raycast:()=>null,raycastObstacle:()=>null};

test('standard pad dead zones, analogue braking and disconnect do not leave a moving input',()=>{
 const input=new GamepadRideInput(),p=pad();p.axes=[.1,NaN,Infinity,0];let f=input.sample([null,p],0);assert.equal(f.steer,0);assert.equal(f.throttle,0);assert.equal(f.lookX,0);
 p.axes=[1,-1,0,0];press(p,7);f=input.sample([p],2);assert.equal(f.throttle,1);assert.equal(f.steer,1);
 press(p,6);assert.equal(input.sample([p],3).throttle,-1);assert.equal(input.sample([p],-3).throttle,1);assert.equal(input.sample([p],0).throttle,0);
 assert.equal(input.sample([],5).connected,false);assert.equal(input.sample([],5).throttle,0);assert.equal(deadAxis(-1),-1);
});
test('pad actions are edges; a held/released hop launches once after a full charge',()=>{
 const input=new GamepadRideInput(),p=pad(),sim=new RideController(flat);press(p,1);
 assert.equal(input.sample([p],0).trick,true);assert.equal(input.sample([p],0).trick,false);press(p,1,false);press(p,0);
 for(let i=0;i<120;i++){const f=input.sample([p],0);sim.step(1/120,{...NEUTRAL_ACTIONS,crouch:f.crouch,hop:f.hop,hopHeld:f.hopHeld});}
 assert.equal(sim.snapshot().hops,0);press(p,0,false);let f=input.sample([p],0);assert.equal(f.hop,true);
 sim.step(1/120,{...NEUTRAL_ACTIONS,hop:f.hop});for(let i=0;i<300;i++){f=input.sample([p],0);sim.step(1/120,{...NEUTRAL_ACTIONS,hop:f.hop});}
 assert.equal(sim.snapshot().hops,1);assert.ok(sim.lastHopCharge>.95);assert.equal(sim.snapshot().landings,1);
});
test('Quest sticks/buttons map riding, hop release, tricks, pause and one snap per deflection',()=>{
 const input=new XRControllerInput(),left=xr('left'),right=xr('right');left.gamepad!.axes=[0,0,-1,-1];right.gamepad!.axes=[0,0,1,0];right.gamepad!.buttons[0].pressed=true;
 let f=input.sample([left,right],0);assert.equal(f.throttle,1);assert.equal(f.steer,-1);assert.equal(f.hopHeld,true);assert.equal(f.hop,false);assert.equal(f.snap,Math.PI/6);
 assert.equal(input.sample([left,right],0).snap,0);right.gamepad!.buttons[0].pressed=false;right.gamepad!.buttons[4].pressed=true;left.gamepad!.buttons[5].pressed=true;
 f=input.sample([left,right],0);assert.equal(f.hop,true);assert.equal(f.trick,true);assert.equal(f.pause,true);
 input.sample([],0);f=input.sample([left],0);assert.equal(f.hop,false);assert.equal(f.hopHeld,false);
});
test('Vive wand touchpads have controls for pause, recover, trick selection and performance',()=>{
 const input=new XRControllerInput(),left=xr('left',true),right=xr('right',true);left.gamepad!.axes=[-.6,-1];right.gamepad!.axes=[0,-1];
 left.gamepad!.buttons[2].pressed=right.gamepad!.buttons[2].pressed=true;
 let f=input.sample([left,right],1);assert.equal(f.wands,true);assert.equal(f.throttle,1);assert.ok(f.steer<0);assert.equal(f.recover,true);assert.equal(f.nextTrick,true);
 left.gamepad!.buttons[2].pressed=right.gamepad!.buttons[2].pressed=false;input.sample([left,right],1);
 left.gamepad!.axes=[0,1];right.gamepad!.axes=[0,1];left.gamepad!.buttons[2].pressed=right.gamepad!.buttons[2].pressed=true;
 f=input.sample([left,right],1);assert.equal(f.pause,true);assert.equal(f.trick,true);
});
test('VR comfort limiter brakes overspeed without imposing reverse at rest; full speed is unchanged',()=>{
 assert.equal(vrThrottle(1,0,true),1);assert.ok(vrThrottle(1,10,true)<0);assert.ok(vrThrottle(-1,-10,true)>0);assert.equal(vrThrottle(1,10,false),1);
 const sim=new RideController(flat);for(let i=0;i<1200;i++)sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:vrThrottle(1,sim.snapshot().speed,true)});
 assert.ok(sim.snapshot().speed<6.5);assert.ok(sim.snapshot().speed>5);
});

test('Quest HUD stick click toggles once without riding, hopping, pausing or recentering',()=>{
 const input=new XRControllerInput(),left=xr('left');left.gamepad!.buttons[3].pressed=true;
 const f=input.sample([left],0);assert.equal(f.toggleHud,true);
 for(const action of ['hop','trick','pause','recover','recenter'] as const)assert.equal(f[action],false);
 assert.ok(f.throttle===0);assert.equal(input.sample([left],0).toggleHud,false);
 left.gamepad!.buttons[3].pressed=false;input.sample([left],0);left.gamepad!.buttons[3].pressed=true;
 assert.equal(input.sample([left],0).toggleHud,true);
 assert.equal(input.sample([],0).toggleHud,false);
});

test('Vive right pad center click toggles HUD without performing a stunt',()=>{
 const input=new XRControllerInput(),right=xr('right',true);right.gamepad!.buttons[2].pressed=true;
 const f=input.sample([right],3);assert.equal(f.toggleHud,true);assert.equal(f.trick,false);assert.equal(f.nextTrick,false);assert.equal(f.hop,false);
 assert.equal(input.sample([right],3).toggleHud,false);
 right.gamepad!.buttons[2].pressed=false;input.sample([right],3);
 right.gamepad!.axes=[0,1];right.gamepad!.buttons[2].pressed=true;
 const bottom=input.sample([right],3);assert.equal(bottom.toggleHud,false);assert.equal(bottom.trick,true);
});
test('VR origin recenters room position, keeps physical head height, and does not spin with a stunt',()=>{
 const p={...createPose(),x:8,y:3,z:12,headingY:2,airHeight:.5},center={x:1.2,z:-.8};
 const origin=vrOrigin(p,.5,.2,-.3,center,true),c=Math.cos(origin.yaw),s=Math.sin(origin.yaw);
 assert.ok(Math.abs(origin.x+center.x*c+center.z*s-p.x)<1e-8);assert.ok(Math.abs(origin.z-center.x*s+center.z*c-p.z)<1e-8);
 assert.equal(origin.y,2.5);assert.equal(vrOrigin(p,.5,.2,-.3,center,false).y,3);
 assert.equal(vrHeading(.5,p,true,false,1/60),.5);assert.equal(vrHeading(.5,p,false,true,1/60),.5);
 assert.ok(vrHeading(.5,p,false,false,1/60)-.5<=.03000001);
});


test('gaze steering has a quiet center, correct turn direction, reverse handling and wraparound',()=>{
 assert.equal(vrGazeSteer(.05,0,5),0);
 assert.equal(vrGazeSteer(1,0,0),0);
 assert.equal(vrGazeSteer(NaN,0,5),0);
 assert.ok(vrGazeSteer(.5,0,5)<0,'positive heading turns left');
 assert.ok(vrGazeSteer(-.5,0,5)>0,'negative heading turns right');
 assert.equal(vrGazeSteer(.5,0,-5),-vrGazeSteer(.5,0,5));
 assert.equal(vrGazeSteer(-Math.PI+.02,Math.PI-.02,5),0);
 assert.ok(Math.abs(vrGazeSteer(2,0,5))<=.8);
});

test('a gaze target produces a smooth turn that settles rather than continuously circling',()=>{
 const sim=new RideController(flat),target=.6;
 for(let i=0;i<1200;i++){
  const p=createPose();sim.writePose(p);
  sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.2,steer:vrGazeSteer(target,p.headingY,p.speed)});
 }
 const p=createPose();sim.writePose(p);
 assert.ok(Math.abs(target-p.headingY)<.12,'wheel approaches the fixed gaze direction');
 assert.ok(Math.abs(p.yawRate)<.05,'turn settles when aligned');
});


test('body lean drives forward, brakes before reversing, and upright stops reverse travel',()=>{
 const lean=new VRLeanDrive(),sim=new RideController(flat);let speed=0,sawStop=false;
 const step=(offset:number)=>{const p=createPose();sim.writePose(p);sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:lean.sample(offset,p.speed,1/120)});speed=sim.snapshot().speed;};
 for(let i=0;i<360;i++)step(.15);assert.ok(speed>3,'forward lean accelerates');
 for(let i=0;i<720;i++){step(-.15);if(Math.abs(speed)<.09)sawStop=true;if(speed<-.1)assert.ok(sawStop,'brake before reverse');}
 assert.ok(speed<-.5,'held backward lean drives backward after stopping');
 for(let i=0;i<720;i++)step(0);assert.ok(Math.abs(speed)<.06,'upright settles to a stop');
 assert.equal(lean.sample(.02,0,1/120),0);assert.equal(lean.sample(-.02,0,1/120),0);assert.equal(lean.sample(NaN,2,1/120),0);
});


test('Vive grip and center-click recenters body lean without hiding HUD or performing a trick',()=>{
 const input=new XRControllerInput(),left=xr('left',true),right=xr('right',true);
 left.gamepad!.buttons[1].pressed=true;right.gamepad!.buttons[2].pressed=true;
 const f=input.sample([left,right],0);assert.equal(f.recenter,true);assert.equal(f.toggleHud,false);assert.equal(f.trick,false);assert.equal(f.crouch,false);
 assert.equal(input.sample([left,right],0).recenter,false);
});
