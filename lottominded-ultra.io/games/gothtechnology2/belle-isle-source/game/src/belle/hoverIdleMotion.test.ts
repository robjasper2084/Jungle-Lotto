import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HoverIdleMotion,IDLE_HOVER,idleHoverWave,idleHoverInputActive,type IdleHoverPose,type IdleHoverState} from './hoverIdleMotion.ts';
import {HoverController,type HoverInput} from './hoverController.ts';
import type {ParkTerrain} from './terrain.ts';
const pose:Readonly<IdleHoverPose>=Object.freeze({x:0,y:10,z:0,heading:0,speed:0,lift:0});
const state:Readonly<IdleHoverState>=Object.freeze({flying:true,landed:false,landing:false,collision:false,hazard:false,racing:false,running:true,reducedMotion:false,inputActive:false,height:10,firstPerson:false});
function run(m:HoverIdleMotion,seconds:number,s:Readonly<IdleHoverState>=state,hz=60,p:Readonly<IdleHoverPose>=pose){for(let i=0;i<Math.round(seconds*hz);i++)m.update(1/hz,p,s);return m.offsetY;}
function settled(){const m=new HoverIdleMotion();run(m,3);return m;}

test('oscillator uses Hertz converted to radians and has the specified amplitude',()=>{
 assert.equal(IDLE_HOVER.frequencyHz,.65);assert.equal(IDLE_HOVER.amplitude,.05);
 const t=1/(4*IDLE_HOVER.frequencyHz),wind=IDLE_HOVER.windAmplitude*(.6*Math.sin(2*Math.PI*IDLE_HOVER.windHzA*t)+.4*Math.sin(2*Math.PI*IDLE_HOVER.windHzB*t));
 assert(Math.abs(idleHoverWave(t)-wind-.05)<1e-12);
});
test('all heave including wind stays within 5.8 cm without random jumps',()=>{
 let previous=idleHoverWave(0);
 for(let i=1;i<=20000;i++){const y=idleHoverWave(i*.005);assert(Math.abs(y)<=.058+1e-12);assert(Math.abs(y-previous)<.002);previous=y;}
});
test('phase wrapping is continuous and invalid wave times are harmless',()=>{
 for(const t of [0,.5,2,35.7])assert(Math.abs(idleHoverWave(t)-idleHoverWave(t+1000))<1e-11);
 assert(Math.abs(idleHoverWave(999.99999)-idleHoverWave(1000.00001))<.00001);
 for(const t of [NaN,Infinity,-Infinity])assert.equal(idleHoverWave(t),0);
});
test('idle dwell and fade-in prevent immediate movement on takeoff',()=>{
 const m=new HoverIdleMotion();run(m,.3);assert.equal(m.offsetY,0);assert.equal(m.strength,0);
 run(m,.2);assert(m.strength>0&&m.strength<.3);run(m,3);assert(m.strength>.99);
});
test('same pose and deltas produce deterministic identical motion',()=>{
 const a=new HoverIdleMotion(),b=new HoverIdleMotion();
 for(let i=0;i<1200;i++){const s={...state,inputActive:i%240<30};assert.equal(a.update(1/60,pose,s),b.update(1/60,pose,s));}
});
test('30, 60 and 120 Hz produce the same phase and envelope',()=>{
 const results=[30,60,120].map(hz=>{const m=new HoverIdleMotion();run(m,4,state,hz);run(m,.5,{...state,inputActive:true},hz);run(m,2,state,hz);return [m.offsetY,m.strength];});
 for(const r of results)for(let i=0;i<2;i++)assert(Math.abs(r[i]-results[0][i])<1e-9);
});
test('variable frame durations preserve elapsed-time phase and blending',()=>{
 const a=new HoverIdleMotion(),b=new HoverIdleMotion();run(a,3);
 for(let i=0;i<60;i++){b.update(.01,pose,state);b.update(.015,pose,state);b.update(.025,pose,state);}
 assert(Math.abs(a.offsetY-b.offsetY)<1e-9);assert(Math.abs(a.strength-b.strength)<1e-9);
});
test('thrust intent fades out smoothly rather than switching the transform abruptly',()=>{
 const m=settled(),before=m.offsetY,weight=m.strength;
 m.update(1/60,pose,{...state,inputActive:true});assert(m.strength>0&&m.strength<weight);assert(Math.abs(m.offsetY-before)<.012);
 run(m,.75,{...state,inputActive:true});assert(Math.abs(m.offsetY)<.0001);assert.equal(m.isIdle,false);
});
test('raw opposite keys, joystick, brake, clutch, lift and boost suppress idle',()=>{
 for(const key of ['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE','KeyQ','Space','KeyC','KeyG','ShiftLeft','ShiftRight'])assert(idleHoverInputActive(new Set([key]),{x:0,y:0},0,false,false),key);
 assert(idleHoverInputActive(new Set(['KeyW','KeyS']),{x:0,y:0},0,false,false));
 assert(idleHoverInputActive(new Set(),{x:.1,y:0},0,false,false));assert(idleHoverInputActive(new Set(),{x:0,y:.1},0,false,false));
 assert(idleHoverInputActive(new Set(),{x:0,y:0},.02,false,false));
 assert(idleHoverInputActive(new Set(),{x:0,y:0},0,true,false));assert(idleHoverInputActive(new Set(),{x:0,y:0},0,false,true));
});
test('look, radio, lighting and small stick noise do not suppress stationary hover',()=>{
 assert.equal(idleHoverInputActive(new Set(['KeyL','KeyH','KeyK','KeyV']),{x:.02,y:-.02},0,false,false),false);
 for(const n of [NaN,Infinity])assert(idleHoverInputActive(new Set(),{x:n,y:0},0,false,false));
 assert(idleHoverInputActive(new Set(),{x:0,y:0},NaN,false,false));
});
test('lateral drifting is not idle even when reported forward speed is zero',()=>{
 const m=new HoverIdleMotion();for(let i=0;i<300;i++)m.update(1/60,{...pose,x:i/60},state);
 assert.equal(m.strength,0);assert.equal(m.isIdle,false);
});
test('turning in place and vertical displacement each suppress idle',()=>{
 for(const axis of ['heading','y'] as const){const m=new HoverIdleMotion();for(let i=0;i<300;i++)m.update(1/60,{...pose,[axis]:pose[axis]+i/60},state);assert.equal(m.strength,0);}
});
test('forward momentum and vertical velocity suppress idle at startup',()=>{
 for(const p of [{...pose,speed:.3},{...pose,lift:.2}]){const m=new HoverIdleMotion();run(m,3,state,60,p);assert.equal(m.offsetY,0);}
});
test('wrapped heading does not become a false turn spike',()=>{
 const m=new HoverIdleMotion();for(let i=0;i<300;i++)m.update(1/60,{...pose,heading:i%2?Math.PI-.000001:-Math.PI+.000001},state);
 assert(m.strength>.99);
});
test('landed and powered-off bikes never bob',()=>{
 for(const s of [{...state,landed:true},{...state,flying:false}]){const m=settled();assert.equal(m.update(1/60,pose,s),0);assert.equal(m.strength,0);}
});
test('landing, collision and hazard gently remove the idle envelope',()=>{
 for(const flag of ['landing','collision','hazard'] as const){const m=settled();run(m,1,{...state,[flag]:true});assert.equal(m.isIdle,false);assert(Math.abs(m.offsetY)<.00001);}
});
test('low clearance fades heave and cannot push the model into the ground',()=>{
 for(const height of [-1,0,.15,.4,.5,.7,1]){const m=new HoverIdleMotion();for(let i=0;i<600;i++){const y=m.update(1/60,pose,{...state,height});if(height<=.4)assert.equal(Math.abs(y),0);else assert(height+y>.4);}}
});
test('pause and hidden-tab suspension freeze phase and avoid resumed-time jumps',()=>{
 const m=settled(),before=m.offsetY;for(let i=0;i<90;i++)assert.equal(m.update(10,pose,{...state,running:false}),before);
 assert.equal(m.update(.1,pose,state),before);m.update(1/60,pose,state);assert(Math.abs(m.offsetY-before)<.01);
});
test('a long or invalid frame is not interpreted as animation catch-up',()=>{
 for(const dt of [12,Infinity,NaN,-.01,0]){const m=settled(),before=m.offsetY;assert.equal(m.update(dt,pose,state),before);assert.equal(m.update(1/60,pose,state),before);}
});
test('reduced motion stops immediately, including while paused',()=>{
 const m=settled();assert.equal(m.update(1/60,pose,{...state,reducedMotion:true,running:false}),0);assert.equal(m.strength,0);run(m,.3);assert.equal(m.offsetY,0);
});
test('active time trials keep authoritative render height',()=>{
 const m=settled();assert.equal(m.update(1/60,pose,{...state,racing:true}),0);run(m,3,{...state,racing:true});assert.equal(m.offsetY,0);
});
test('first-person heave is attenuated without moving the camera',()=>{
 const a=new HoverIdleMotion(),b=new HoverIdleMotion();run(a,5);run(b,5,{...state,firstPerson:true});assert(Math.abs(b.offsetY-a.offsetY*.2)<1e-10);
 const before=a.offsetY;a.update(1/60,pose,{...state,firstPerson:true});assert(Math.abs(a.offsetY-before)<.012);
});
test('recover, dismount and teleport clear old phase and transforms',()=>{
 const m=settled();assert.equal(m.reset(),0);assert.equal(m.strength,0);run(m,.3);assert.equal(m.offsetY,0);
 run(m,3);assert.equal(m.update(1/60,{...pose,x:100},state),0);assert.equal(m.strength,0);
});
test('bad pose values never reach a render transform',()=>{
 for(const k of ['x','y','z','speed','lift','heading'] as const)for(const n of [NaN,Infinity]){const m=settled();assert.equal(m.update(1/60,{...pose,[k]:n},state),0);}
 assert.equal(settled().update(1/60,pose,{...state,height:NaN}),0);
});
test('pose, controls and input state remain immutable',()=>{
 const m=new HoverIdleMotion();run(m,4,state,60,pose);assert.deepEqual(pose,{x:0,y:10,z:0,heading:0,speed:0,lift:0});assert.equal(state.height,10);
});
test('real HoverController trajectory is identical with the visual feature enabled',()=>{
 const terrain={height:()=>2,land:()=>true,obstructed:()=>false,raycastFlight:()=>null} as unknown as ParkTerrain;
 const a=new HoverController(terrain,{x:0,z:0,heading:0}),b=new HoverController(terrain,{x:0,z:0,heading:0});a.setMode('drone');b.setMode('drone');a.launch();b.launch();
 const m=new HoverIdleMotion();let sawBob=false;
 for(let i=0;i<1500;i++){
  const input:HoverInput={throttle:i>=420&&i<540?.5:0,steer:i>=720&&i<780?.5:0,strafe:i>=840&&i<900?.4:0,lift:0,brake:i>=960&&i<990,boost:false};
  if(i===1140){a.land();b.land();}
  a.advance(1/60,input);b.advance(1/60,{...input});const before=JSON.stringify(b.pose);
  const y=m.update(1/60,b.pose,{...state,flying:b.flying,landed:b.landed,landing:b.clearance<=.3,collision:b.collision,hazard:b.hazard,inputActive:!!(input.throttle||input.steer||input.strafe||input.brake),height:b.pose.y-b.floor(b.pose.x,b.pose.z)});
  sawBob ||= Math.abs(y)>.01;
  assert.equal(JSON.stringify(b.pose),before);assert.deepEqual(a.pose,b.pose);assert.equal(a.clearance,b.clearance);assert.equal(a.boostEnergy,b.boostEnergy);assert.equal(a.collision,b.collision);
 }
 assert(sawBob);assert.equal(m.offsetY,0);
});
test('HoverRide applies absolute visual Y to the shared model, never to flight pose',()=>{
 const source=readFileSync(new URL('./hover.ts',import.meta.url),'utf8');
 assert.match(source,/this\.model\.position\.set\(p\.x,p\.y\+idleY,p\.z\)/);
 assert.doesNotMatch(source,/p\.y\s*\+=\s*idleY|pose\.y\s*\+=\s*idleY|position\.y\s*\+=\s*idleY/);
 assert.match(source,/this\.idleHover\.update\(dt,p/);assert.match(source,/!document\.hidden&&document\.hasFocus\(\)/);
 assert.match(source,/racing:!!this\.hooks\.vehicleLocked\?\.\(\)/);
 const camera=source.slice(source.indexOf(' camera(camera:'));
 assert.doesNotMatch(camera,/idleY|offsetY/);assert.match(camera,/p\.y\+1\.58/);
 assert.match(source,/this\.idleHover\.reset\(\)/);assert.match(source,/this\.idleHover\.suspend\(\)/);
});
test('presentation adds no timer, random-per-frame noise or extra model assets',()=>{
 const source=readFileSync(new URL('./hoverIdleMotion.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/performance\.now|Date\.now|Math\.random|requestAnimationFrame|setInterval|setTimeout|new T\.|fetch\(/);
 const runner=readFileSync(new URL('../../run-tests.mjs',import.meta.url),'utf8');assert(runner.includes("'src/belle/hoverIdleMotion.test.ts'"));
});
