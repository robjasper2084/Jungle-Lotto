import test from 'node:test';import assert from 'node:assert/strict';
import {RiderPresence,articulationStrength} from './riderPresence.ts';
import {cloudLightFactor,skyBirdPose,livingSkyFragment} from './skyAtmosphere.ts';
const base=()=>({lean:0,pitch:0,compression:0,headPitch:0,headRoll:0,look:0});
const vehicle=()=>({x:0,y:1,z:0,speed:0,pitch:0,roll:0});
function run(hz=60,seconds=3,reaction=base(),v=vehicle()){const m=new RiderPresence();for(let i=0;i<hz*seconds;i++)m.update(1/hz,reaction,v,true,false);return m;}
test('idle breath is bounded and does not rock the vehicle',()=>{const v=vehicle(),before={...v},m=run(60,2,base(),v);assert(Math.abs(m.pose.breath)>.0001);assert(Math.abs(m.pose.breath)<=.004);assert.equal(m.pose.lean,0);assert.deepEqual(v,before);});
test('cruise tuck becomes stronger without exceeding existing acceptance limits',()=>{const m=run(60,3,{...base(),pitch:.065},{...vehicle(),speed:24});assert(m.pose.pitch>.10);assert(m.pose.pitch<.20);});
test('chest leads pelvis into a new turn',()=>{const m=run(60,1),r={...base(),lean:.2,look:-.1};m.update(1/60,r,vehicle(),true,false);assert(m.pose.chestLean>m.pose.hipLean);assert(Math.abs(m.pose.look)>Math.abs(m.pose.chestYaw));});
test('left and right turns have mirrored joint reactions',()=>{const l=run(60,3,{...base(),lean:-.2,look:.1}),r=run(60,3,{...base(),lean:.2,look:-.1});for(const k of ['lean','hipLean','chestLean','look','hipYaw','chestYaw'])assert(Math.abs(l.pose[k]+r.pose[k])<1e-10);});
test('neutral pose settles without oscillating hips or shoulders',()=>{const m=run(60,3,{...base(),lean:.2,look:-.1});for(let i=0;i<360;i++)m.update(1/60,base(),vehicle(),true,false);for(const k of ['lean','hipLean','chestLean','look','hipYaw','chestYaw'])assert(Math.abs(m.pose[k])<1e-9);});
test('landing increases compression within existing support bounds',()=>{const m=run(60,1,{...base(),compression:.07});assert(m.pose.compression>.07);assert(m.pose.compression<=.085);});
test('pause freezes every articulated channel including breathing',()=>{const m=run(),snapshot={...m.pose};for(let i=0;i<100;i++)m.update(.1,base(),vehicle(),false,false);assert.deepEqual(m.pose,snapshot);});
test('reduced motion resets all optional body animation',()=>{const m=run(60,2,{...base(),lean:.2});m.update(.1,base(),vehicle(),false,true);assert(Object.values(m.pose).every(x=>x===0));});
test('reset removes prior posture and breath phase',()=>{const m=run();m.reset();assert(Object.values(m.pose).every(x=>x===0));});
test('zero/negative time cannot advance breathing',()=>{const m=run(),s={...m.pose};m.update(0,base(),vehicle(),true,false);m.update(-1,base(),vehicle(),true,false);assert.deepEqual(m.pose,s);});
test('invalid telemetry cannot poison rig transforms',()=>{for(const k of Object.keys(vehicle())){const m=run();m.update(.1,base(),{...vehicle(),[k]:NaN},true,false);assert(Object.values(m.pose).every(Number.isFinite));}});
test('large world relocation discards old articulation',()=>{const m=run(60,2,{...base(),lean:.2,look:.1});m.update(1/60,base(),{...vehicle(),x:200},true,false);assert.equal(m.pose.hipLean,0);assert.equal(m.pose.chestYaw,0);});
test('input telemetry and base reaction are never mutated',()=>{const b=Object.freeze(base()),v=Object.freeze(vehicle());assert.doesNotThrow(()=>run(60,3,b,v));});
test('stable output object reused across frames',()=>{const m=new RiderPresence(),p=m.pose;for(let i=0;i<100;i++)assert.equal(m.update(1/60,base(),vehicle(),true,false),p);});
test('30/60/120Hz presentation settles to equivalent posture',()=>{const values=[30,60,120].map(h=>run(h,2,{...base(),lean:.18,pitch:.07,look:-.08},{...vehicle(),speed:20}).pose);for(const p of values)for(const k of Object.keys(p))assert(Math.abs(p[k]-values[2][k])<.002,k);});
test('extreme valid reactions stay within legacy pitch/compression budgets',()=>{const m=run(60,1,{...base(),pitch:1,compression:1},{...vehicle(),speed:100});assert(m.pose.pitch<=.19);assert(m.pose.compression<=.082);});
test('contact fallback is deterministic and refuses nonfinite error',()=>{assert.equal(articulationStrength(.002,.003,0),1);assert.equal(articulationStrength(.03,.002,0),.5);assert.equal(articulationStrength(.03,.002,1),0);assert.equal(articulationStrength(NaN,0,1),0);});
test('lighting variation stays subtle for all cloud types',()=>{for(let t=0;t<1000;t+=.7)for(const c of [0,.3,1]){const x=cloudLightFactor(t,c,.2,1);assert(x>=.935&&x<=1);}});
test('night, clear and overcast do not get passing-cloud pulses',()=>{assert.equal(cloudLightFactor(10,1,0,0),1);assert.equal(cloudLightFactor(10,0,0,1),1);assert.equal(cloudLightFactor(10,1,1,1),1);});
test('reduced motion disables atmospheric brightness motion',()=>assert.equal(cloudLightFactor(10,1,0,1,true),1));
test('invalid atmospheric data remains stable',()=>assert.equal(cloudLightFactor(NaN,1,0,1),1));
test('river birds use reusable deterministic world-space positions',()=>{const a={x:0,y:0,z:0,heading:0},b={...a};assert.equal(skyBirdPose(2,34,a),a);assert.deepEqual(skyBirdPose(2,34,b),a);assert(a.x<0);assert(a.y>=117.5&&a.y<=129);});
test('river flock has finite separated paths',()=>{const points=Array.from({length:6},(_,i)=>skyBirdPose(i,10,{x:0,y:0,z:0,heading:0}));assert.equal(new Set(points.map(p=>JSON.stringify(p))).size,6);assert(points.every(p=>Object.values(p).every(Number.isFinite)));});
test('sky shader refuses unrecognized source instead of silently dropping effects',()=>assert.throws(()=>livingSkyFragment('void main(){}'),/contract/));

import {readFileSync} from 'node:fs';
const skySource=readFileSync(new URL('./islandSky.ts',import.meta.url),'utf8');
const oldFragment=skySource.match(/const fragment=`([\s\S]*?)`;/)[1],newFragment=livingSkyFragment(oldFragment);
test('sky change retains stars/moon/meteors and tone mapping',()=>assert.equal(newFragment.slice(newFragment.indexOf(' // Stars,')),oldFragment.slice(oldFragment.indexOf(' // Stars,'))));
test('sky detail adds no texture samples or uniforms',()=>{assert.equal((newFragment.match(/texture2D\(/g)||[]).length,(oldFragment.match(/texture2D\(/g)||[]).length);assert.equal((newFragment.match(/uniform /g)||[]).length,(oldFragment.match(/uniform /g)||[]).length);});
test('sky integration keeps reduced motion and simulation clock',()=>{assert(skySource.includes('!titlePreview&&!reduceMotion'));assert(skySource.includes('cloudLightFactor(cloudClock'));assert(skySource.includes('fragmentShader:livingSkyFragment(fragment)'));});
test('rider layer preserves final IK and bounded reach fallback',()=>{const s=readFileSync(new URL('./hoverRiderMotion.ts',import.meta.url),'utf8');assert(s.indexOf('this.rotate(chest,pitch')<s.indexOf('this.solve(arms[i])'));assert(s.includes('attempt<2'));assert(s.includes('this.apply(base,strength)'));});

test('visible high-speed tuck is stronger than the idle pose while preserving the 0.19 radian rig bound',()=>{
 const idle=run(60,3,{...base(),pitch:.065},{...vehicle(),speed:0});
 const fast=run(60,3,{...base(),pitch:.065},{...vehicle(),speed:24});
 assert(fast.pose.pitch>idle.pose.pitch+.035,'high-speed posture must be distinguishable from stationary pose');
 assert(fast.pose.pitch<.19&&fast.pose.pitch>.12);
});
test('turning chest twists measurably before hips without touching vehicle telemetry',()=>{
 const v=vehicle(),snapshot={...v},motion=run(60,1);
 motion.update(1/60,{...base(),lean:.20,look:-.12},v,true,false);
 assert(Math.abs(motion.pose.chestYaw)>Math.abs(motion.pose.hipYaw));
 assert(Math.abs(motion.pose.chestYaw)<.07);
 assert.deepEqual(v,snapshot);
});
