import test from 'node:test';
import assert from 'node:assert/strict';
import {msjLocomotionState,stepMsjLocomotion} from '../src/msjLocomotion.ts';
import {RideController,NEUTRAL_ACTIONS} from '../src/controller.ts';
import {knockOffOnFoot,footState,stepOnFoot} from '../src/onFoot.ts';
import {createPose} from '../src/controller.ts';
import type {TerrainSampler} from '../src/terrain.ts';
const terrain:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false});},raycast:()=>null,raycastObstacle:()=>null};
const input=(a={})=>({...NEUTRAL_ACTIONS,...a});
const walker=()=>{const c=new RideController(terrain);c.step(1/120,input({dismount:true}));for(let i=0;i<100;i++)c.step(1/120,input());return c;};

test('MSJ start ramps smoothly, normalizes diagonals and preserves analog precision',()=>{
 const forward=msjLocomotionState(),diagonal=msjLocomotionState(),analog=msjLocomotionState();
 stepMsjLocomotion(forward,1/120,0,2.35,2.35);assert(forward.msjVelocityZ>0&&forward.msjVelocityZ<.01);
 for(let i=0;i<360;i++){stepMsjLocomotion(forward,1/120,0,2.35,2.35);stepMsjLocomotion(diagonal,1/120,2.35,2.35,2.35);stepMsjLocomotion(analog,1/120,0,.235,2.35);}
 assert(Math.abs(Math.hypot(diagonal.msjVelocityX,diagonal.msjVelocityZ)-2.35)<.001);
 assert(Math.abs(forward.msjVelocityZ-2.35)<.001);assert(Math.abs(analog.msjVelocityZ-.235)<.001);
});

test('MSJ smoothing converges consistently at 30, 60, 120 and 144 Hz',()=>{
 const results=[30,60,120,144].map(hz=>{const s=msjLocomotionState();for(let i=0;i<hz;i++)stepMsjLocomotion(s,1/hz,-3,4,5);return s;});
 for(const s of results){assert(Math.abs(s.msjVelocityX-results[0].msjVelocityX)<1e-10);assert(Math.abs(s.msjVelocityZ-results[0].msjVelocityZ)<1e-10);}
});

test('reverse crosses through zero and released controls settle without sliding',()=>{
 const s=msjLocomotionState();for(let i=0;i<240;i++)stepMsjLocomotion(s,1/120,0,2.35,2.35);
 const before=s.msjVelocityZ;stepMsjLocomotion(s,1/120,0,-2.05,2.35);
 assert(s.msjVelocityZ>0&&s.msjVelocityZ<before,'a reverse press must not flip velocity instantly');
 for(let i=0;i<240;i++)stepMsjLocomotion(s,1/120,0,-2.05,2.35);assert(s.msjVelocityZ< -2);
 let coast=0;for(let i=0;i<120;i++){stepMsjLocomotion(s,1/120,0,0,2.35);coast+=Math.abs(s.msjVelocityZ)/120;}
 assert.equal(s.msjVelocityZ,0);assert(coast<.3);
});

test('stance speed limit applies immediately and malformed input never poisons state',()=>{
 const s=msjLocomotionState();for(let i=0;i<240;i++)stepMsjLocomotion(s,1/120,5.4,0,5.4);
 stepMsjLocomotion(s,1/120,.75,0,.75);assert(Math.hypot(s.msjVelocityX,s.msjVelocityZ)<=.75);
 stepMsjLocomotion(s,1/120,NaN,Infinity,2.35);assert(Object.values(s).every(Number.isFinite));
 const before={...s};stepMsjLocomotion(s,NaN,1,1,2);assert.deepEqual(s,before);
});

test('controller replay saves the smoothing state and reset clears it for respawn',()=>{
 const a=walker(),b=new RideController(terrain);
 for(let i=0;i<30;i++)a.step(1/120,input({throttle:1,facingYaw:0,steer:.3}));
 b.restoreState(JSON.parse(JSON.stringify(a.captureState())));
 for(let i=0;i<180;i++){const action=input({throttle:i<60?-1:i<120?.3:0,steer:i<80?1:0,facingYaw:.4});a.step(1/120,action);b.step(1/120,action);}
 assert.deepEqual(a.captureState(),b.captureState());
 a.reset();assert.equal(a.poseValue.footMode,0);
 a.step(1/120,input({dismount:true}));for(let i=0;i<100;i++)a.step(1/120,input());
 const before={...a.poseValue};for(let i=0;i<120;i++)a.step(1/120,input());
 assert.equal(a.poseValue.x,before.x);assert.equal(a.poseValue.z,before.z);assert.equal(a.poseValue.speed,0);
});

test('knock-off preserves momentum and parking, while jump and low stance remain controlled',()=>{
 const p=createPose(),s=footState();p.speed=8;p.velocityZ=8;
 knockOffOnFoot(s,p);const park=[p.parkX,p.parkY,p.parkZ];
 stepOnFoot(s,p,terrain,1/120,input());assert(p.z>0);assert.equal(p.footMode,2);assert(p.footStagger>0);
 for(let i=0;i<130;i++)stepOnFoot(s,p,terrain,1/120,input());
 stepOnFoot(s,p,terrain,1/120,input({hop:true}));for(let i=0;i<20;i++)stepOnFoot(s,p,terrain,1/120,input({hopHeld:true}));assert(p.airHeight>.1);
 for(let i=0;i<180;i++)stepOnFoot(s,p,terrain,1/120,input({prone:true,throttle:1}));
 assert(p.footProne>.9);assert(Math.abs(p.speed)<=.75);assert.deepEqual([p.parkX,p.parkY,p.parkZ],park);
});

test('old authority snapshots retain their published acceleration without prediction jumps',()=>{
 const server=walker(),client=new RideController(terrain),snapshot=server.captureState();
 const walking=snapshot.fields.walking as any;for(const key of Object.keys(walking))if(key.startsWith('msj')||key==='legacyLocomotion')delete walking[key];
 client.restoreState(snapshot);assert.equal((client.captureState().fields.walking as any).legacyLocomotion,true);
 let speed=0,z=client.poseValue.z;
 for(let i=0;i<120;i++){
  const target=i<60?2.35:0,braking=Math.abs(target)<Math.abs(speed);speed+=(target-speed)*(1-Math.exp(-(braking?15:9)/120));if(Math.abs(speed)<.002||i>=60)speed=0;z+=speed/120;
  client.step(1/120,input({throttle:i<60?1:0,facingYaw:0}));assert(Math.abs(client.poseValue.speed-speed)<1e-9, i+": "+client.poseValue.speed+" / "+speed);assert(Math.abs(client.poseValue.z-z)<1e-9);
 }
 client.restoreState(server.captureState());assert.equal((client.captureState().fields.walking as any).legacyLocomotion,false);
});
