import test from 'node:test';
import assert from 'node:assert/strict';
import {HydraulicController,HYDRAULIC_SMART_POSES} from './hydraulicController.ts';

const keys=['FL','FR','RL','RR'] as const;
type Values=Record<typeof keys[number],number>;
const initial:Values={FL:0,FR:0,RL:0,RR:0};
const controller=()=>new HydraulicController(keys,initial,{maxSpeed:.35,maxFrameSeconds:.12});
const near=(a:number,b:number,message='')=>assert(Math.abs(a-b)<1e-10,`${message}: ${a} != ${b}`);
const receipt=(c:HydraulicController<typeof keys[number]>)=>({current:{...c.current},targets:{...c.targets},elapsed:c.elapsedSeconds,duration:c.durationSeconds,settled:c.settled});

test('all channels ease along one exact bounded segment and arrive simultaneously',()=>{
 const c=controller(),target={FL:.24,FR:.12,RL:.04,RR:.18};
 assert(c.setTargets(target));assert.deepEqual(c.current,initial);assert(!c.settled);
 let prior={...c.current},firstSpeed=0,middleSpeed=0,lastSpeed=0;
 for(let i=0;!c.settled&&i<1000;i++){
  const remaining=c.durationSeconds-c.elapsedSeconds,dt=Math.min(.005,remaining);
  c.update(dt);const speed=(c.current.FL-prior.FL)/dt;
  if(i===0)firstSpeed=speed;if(Math.abs(c.current.FL-.12)<.002)middleSpeed=speed;lastSpeed=speed;
  for(const key of keys){
   assert(c.current[key]>=prior[key]-1e-12&&c.current[key]<=target[key]);
   assert((c.current[key]-prior[key])/dt<=.35+1e-10,'configured actuator speed is a real bound');
   near(c.current[key]/target[key],c.current.FL/target.FL,'one scalar preserves the preflight segment');
  }
  prior={...c.current};
 }
 assert(c.settled);assert.deepEqual(c.current,target);
 assert(firstSpeed<.01&&lastSpeed<.01,'the lift starts and finishes gently');assert(middleSpeed>.34,'the middle of the lift reaches the intended speed');
});

test('rapid reversal and mixed-corner retargets start at the displayed position without overshoot',()=>{
 const c=controller(),commands:Values[]=[{FL:.24,FR:.12,RL:.04,RR:.08},{FL:0,FR:.22,RL:.14,RR:0},{FL:.18,FR:.02,RL:.20,RR:.06},initial];
 for(const target of commands){
  const from={...c.current};assert(c.setTargets(target));assert.deepEqual(c.current,from,'committing a new target never teleports an actuator');
  for(const dt of [.04,.025,.06]){
   const prior={...c.current};c.update(dt);
   const leading=keys.reduce((key,next)=>Math.abs(target[next]-from[next])>Math.abs(target[key]-from[key])?next:key,keys[0]);
   const distance=target[leading]-from[leading],weight=distance?(c.current[leading]-from[leading])/distance:0;
   assert(weight>=0&&weight<=1);
   for(const key of keys){
    assert(c.current[key]>=Math.min(from[key],target[key])-1e-12&&c.current[key]<=Math.max(from[key],target[key])+1e-12);
    near(c.current[key],from[key]+(target[key]-from[key])*weight);
    assert(Math.abs(c.current[key]-prior[key])<=.35*dt+1e-10);
   }
  }
 }
 for(let i=0;i<20;i++)c.update(.1);
 assert(c.settled);assert.deepEqual(c.current,initial);
});

test('equivalent eligible time partitions give the same actuator positions',()=>{
 const target={FL:.24,FR:.04,RL:.12,RR:.22},partitions=[Array(18).fill(1/30),Array(36).fill(1/60),Array(72).fill(1/120),[.12,.08,.10,.06,.11,.12,.01]];
 const results=partitions.map(dts=>{const c=controller();c.setTargets(target);for(const dt of dts)c.update(dt);return{...c.current};});
 for(const result of results.slice(1))for(const key of keys)near(result[key],results[0][key]);
});

test('identical requested targets do not restart an in-flight lift',()=>{
 const a=controller(),b=controller(),target=HYDRAULIC_SMART_POSES['front-up'];a.setTargets(target);b.setTargets(target);
 for(let i=0;i<40;i++){
  const before=receipt(a);assert(a.setTargets({...target}));assert.deepEqual(receipt(a),before);
  a.update(.02);b.update(.02);assert.deepEqual(receipt(a),receipt(b));
 }
 assert(a.current.FL>.20,'repeated held input cannot starve interpolation');
});

test('reduced motion, immediate commands and reset reach exact values and clear old interpolation',()=>{
 const c=controller(),current=c.current;
 c.setTargets(HYDRAULIC_SMART_POSES['front-up']);c.update(.1);
 assert(c.update(0,true));assert(c.settled);assert.deepEqual(c.current,HYDRAULIC_SMART_POSES['front-up']);
 c.setTargets(HYDRAULIC_SMART_POSES['back-up'],true);assert(c.settled);assert.deepEqual(c.current,HYDRAULIC_SMART_POSES['back-up']);
 c.setTargets(HYDRAULIC_SMART_POSES.pancake);c.update(.1);assert(c.reset());assert(c.settled);assert.deepEqual(c.current,initial);
 assert.equal(c.current,current,'idle and active updates retain one current-value view');assert.equal(c.update(.1),false);
});

test('invalid commands are atomic and a delayed frame cannot skip a full lift',()=>{
 const c=controller();c.setTargets(HYDRAULIC_SMART_POSES['front-up']);c.update(.05);const before=receipt(c);
 for(const values of [{FL:NaN,FR:.12},{RL:Infinity},{unknown:.2}] as Partial<Values>[])assert(!c.setTargets(values));
 assert.deepEqual(receipt(c),before);
 assert(!c.reset({...initial,FL:NaN}));assert.deepEqual(receipt(c),before);
 for(const dt of [NaN,Infinity,-1,0])assert(!c.update(dt));assert.deepEqual(receipt(c),before);
 c.update(100);near(c.elapsedSeconds,before.elapsed+.12);assert(!c.settled);
 assert.throws(()=>new HydraulicController(keys,initial,{maxSpeed:0}),/positive/);
 assert.throws(()=>new HydraulicController(['FL','FL'],{FL:0},{maxSpeed:.35}),/unique/);
});

test('Smart Pump settings have the requested bounded axle heights and immutable defaults',()=>{
 assert.deepEqual(HYDRAULIC_SMART_POSES,{'front-up':{FL:.22,FR:.22,RL:.14,RR:.14},'back-up':{FL:.14,FR:.14,RL:.22,RR:.22},pancake:initial});
 assert(Object.isFrozen(HYDRAULIC_SMART_POSES));for(const pose of Object.values(HYDRAULIC_SMART_POSES))assert(Object.isFrozen(pose));
});
