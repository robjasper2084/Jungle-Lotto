import {test} from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {RideController,createPose,NEUTRAL_ACTIONS} from './controller.ts';
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from './terrain.ts';
import {clearMountedPosition,safeRecovery} from './recovery.ts';
import {RIDE_RULES,NeutralRearm} from './rideRules.ts';
import {SpecialMoves} from './specialMoves.ts';
import {FlowCombo} from './replayRules.ts';
import {DogFollower,DOG_MAX_SPEED} from './companion.ts';
import {FallMotion} from './fallMotion.ts';
import {EncounterWarning,brakingLookahead} from './encounterWarning.ts';
import {RaceRules,RACE_ROUTE,CUT_THROUGH} from './raceRules.ts';
import {PracticeCoach} from './practiceCoach.ts';
import {encounterOptions} from './encounterSafety.ts';
import {RIDE_TUNING} from './rideDynamics.ts';
const flat:TerrainSampler={sampleGround(_x,_z,out){return Object.assign(out,createGroundSample());},raycast:()=>null,raycastObstacle:()=>null};
const at={position:{x:0,y:0,z:0},headingY:0};
const advance=(c:RideController,seconds:number,throttle=0)=>{for(let i=0;i<seconds*120;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle});};

test('crash is idempotent, cancels drive and trick, and reaches a settled fall under continued throttle',()=>{
 let blocked=false;const c=new RideController({...flat,raycastObstacle:()=>blocked?0:null},{spawn:at});
 advance(c,2,1);blocked=true;advance(c,.1,1);assert.equal(c.crashed,true);
 const start=c.snapshot();advance(c,3,1);const p=createPose();c.writePose(p);
 assert.equal(c.snapshot().crashes,1);assert.equal(c.snapshot().fallPhase,'settled');
 assert.ok(Math.abs(p.speed)<.001);assert.equal(p.driveIntent,0);assert.equal(c.tricks.active,false);
 assert.equal(p.x,start.position.x);assert.equal(p.z,start.position.z);
 blocked=false;assert.equal(c.recover(),true);c.writePose(p);
 assert.ok(p.crashBlend>0);assert.equal(p.speed,0);
 advance(c,.1,1);assert.equal(c.snapshot().speed,0,'get-up animation rejects carried input');
 advance(c,2.3);c.writePose(p);assert.equal(p.crashBlend,0);assert.equal(p.crashMotion,0);
});

test('actual volume rejects walls and overhead beams; bounded candidates stay on a supported slope',async()=>{
 await RAPIER.init();const physics=new RAPIER.World({x:0,y:0,z:0});
 physics.createCollider(RAPIER.ColliderDesc.cuboid(.2,2,2).setTranslation(0,2,0));physics.step();
 const terrain:TerrainSampler={...flat,mountedClear(p,h,r,height){return !physics.intersectionWithShape({x:p.x,y:p.y+.06+height/2,z:p.z},{x:0,y:Math.sin(h/2),z:0,w:Math.cos(h/2)},new RAPIER.Cuboid(r,height/2,r));}};
 assert.equal(clearMountedPosition(terrain,at.position,0,{radius:.6,height:2.1}),false);
 const spawn=safeRecovery(terrain,at,{radius:.6,height:2.1});assert.ok(spawn);assert.ok(Math.abs(spawn.position.x)>=1.2);
 physics.createCollider(RAPIER.ColliderDesc.cuboid(15,.2,15).setTranslation(0,1.8,0));physics.step();
 assert.equal(safeRecovery(terrain,at,{radius:.6,height:2.1}),undefined,'cannot recover through a low slab');
 physics.free();
 const slope:TerrainSampler={...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.height=x*.18;out.normal={x:-.177,y:.984,z:0};return out;}};
 assert.ok(safeRecovery(slope,at));
 const cliff:TerrainSampler={...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.normal.y=.6;return out;}};
 assert.equal(safeRecovery(cliff,at),undefined);
});

test('recovery reserves a swept actor window including a cyclist approaching an empty point',()=>{
 const cyclist:NavigationObstacle={id:'cycle',x:0,y:0,z:3,radius:.92,height:1.8,kind:'cyclist',vx:0,vz:-3.4};
 const terrain={...flat,navigationObstacles:()=>[cyclist]};
 assert.equal(clearMountedPosition(terrain,at.position,0,{radius:.6,height:2.2}),false);
 const safe=safeRecovery(terrain,at,{radius:.6,height:2.2});assert.ok(safe);
 for(let t=0;t<1.2;t+=1/120)assert.ok(Math.hypot(safe.position.x,safe.position.z-(3-3.4*t))>1.52);
});

test('controller neutral rearm requires release and never treats elapsed pause as permission to drive',()=>{
 const gate=new NeutralRearm();gate.interrupt();
 for(let i=0;i<300;i++)assert.equal(gate.sample(.05,true),false);
 assert.equal(gate.sample(0,false),false);assert.equal(gate.blocked,true);
 for(let i=0;i<20;i++)gate.sample(.01,false);assert.equal(gate.sample(.01,false),true);
 gate.interrupt();assert.equal(gate.sample(.01,true),false);
});

test('trick blockers report the first real failed condition and share the scoring settle clock',()=>{
 const attempt=(ground=true,crash=false,speed=0,bank=0,clear=true)=>{const m=new SpecialMoves();m.beginStep(3,ground,crash,speed,bank,0,1/120,clear);return m;};
 assert.match(attempt(false).event,/Land/);assert.match(attempt(true,true).event,/Recover/);
 assert.match(attempt(true,false,8).event,/slow/);assert.match(attempt(true,false,0,.3).event,/Straighten/);
 assert.match(attempt(true,false,0,0,false).event,/clear space/);
 const m=attempt();m.beginStep(0,true,false,0,0,0,.01);m.beginStep(1,true,false,0,0,0,.01);assert.match(m.event,/current move/);
 const cooldown=new SpecialMoves();cooldown.cooldown=.3;cooldown.beginStep(1,true,false,0,0,0,.01);assert.match(cooldown.event,/another move/);
 assert.equal(m.snapshot().settleSeconds,RIDE_RULES.settleSeconds);
});

test('jitter and recovery never award points; a real hop settles then banks once; crash preserves the bank',()=>{
 const f=new FlowCombo(),p=createPose();p.speed=4;
 for(let i=0;i<1200;i++){p.airHeight=i%2?.02:0;f.step(1/120,p,i%2===0,i%2===0?'clean':undefined);}
 assert.equal(f.pending,0);assert.equal(f.banked,0);
 p.airHeight=.4;f.step(.1,p,false);p.airHeight=0;f.step(1/120,p,true,'clean');
 for(let i=0;i<60;i++)f.step(1/120,p,true);assert.equal(f.pending,0);
 for(let i=0;i<15;i++)f.step(1/120,p,true);assert.ok(f.pending>0);
 const expected=f.pending;f.bank();f.bank();assert.equal(f.banked,expected);
 f.cancel();for(let i=0;i<800;i++)f.step(1/120,p,true);assert.equal(f.banked,expected);
 p.crashBlend=1;f.step(.01,p,true);assert.equal(f.banked,expected);assert.equal(f.pending,0);
});

test('dog waits clear of a representative forward fall and regroups with bounded ground travel',()=>{
 const p=createPose(),dog=new DogFollower(flat);dog.reset(p);p.speed=6;
 for(let i=0;i<240;i++){p.z+=6/120;dog.step(1/120,p);}
 const fall=new FallMotion(p,'collision');
 for(let i=1;i<360;i++){fall.sample(i/120,p);p.speed=0;dog.step(1/120,p);assert.equal(dog.mode,'wait');
  const body={x:p.x+p.crashLateral,z:p.z+p.crashForward};
  assert.ok(Math.hypot(dog.current.x-body.x,dog.current.z-body.z)>1.1,'dog body stays outside settled rider clearance');
 }
 const before={...dog.current};const restored=createPose();restored.z=p.z-5;
 dog.step(1/120,restored);assert.equal(dog.mode,'regroup');
 assert.ok(Math.hypot(dog.current.x-before.x,dog.current.z-before.z)<=DOG_MAX_SPEED/120);
 for(let i=0;i<2400;i++)dog.step(1/120,restored);assert.equal(dog.mode,'follow');assert.equal(dog.current.speed,0);
});

test('warning uses a relevant closing hazard and retains it briefly, never inventing an escape direction',()=>{
 const p=createPose();p.speed=24/3.6;const warning=new EncounterWarning();
 let objects:NavigationObstacle[]=[{id:'cycle',kind:'cyclist',x:0,y:0,z:10,radius:.8,height:1.7,vx:0,vz:-3.4}];
 const terrain={...flat,navigationObstacles:()=>objects};
 assert.match(warning.step(.1,p,terrain,true),/CYCLIST AHEAD/);
 objects=[];assert.match(warning.step(.2,p,terrain,true),/CYCLIST/);assert.equal(warning.step(.5,p,terrain,true),'');
 assert.equal(warning.step(.1,p,terrain,false),'');
});

test('staging rejects a blocked corridor and preserves manual escape options when shoulders are clear',()=>{
 const obstacle:NavigationObstacle={id:'barrier',kind:'barrier',x:0,y:0,z:5,radius:6,height:2,vx:0,vz:0};
 assert.equal(encounterOptions(flat,at.position,0,18,[obstacle]).feasible,false);
 assert.equal(encounterOptions(flat,at.position,0,6.67,[{...obstacle,z:40,radius:.8}]).brake,true);
 const passing=encounterOptions(flat,at.position,0,6.67,[{...obstacle,x:1.65,z:15,radius:.4}]);
 assert.ok(passing.feasible);
 const narrow:TerrainSampler={...flat,sampleGround(x,z,out){flat.sampleGround(x,z,out);out.offCourse=Math.abs(x)>.45;return out;}};
 assert.equal(encounterOptions(narrow,at.position,0,10,[{...obstacle,radius:1}]).feasible,false);
});

test('measured braking at cruise, recorded 66 km/h, and maximum configured speed fits warning lookahead',t=>{
 for(const speed of [24/3.6,66/3.6,RIDE_TUNING.maxSpeed]){
  const c=new RideController(flat,{spawn:at});for(let i=0;i<24000&&c.snapshot().speed<speed-.02;i++)c.step(1/120,{...NEUTRAL_ACTIONS,throttle:1});
  const start=c.snapshot(),actual=start.speed;let duration=0;
  while(c.snapshot().speed>.03&&duration<10){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:-1});duration+=1/120;}
  const distance=c.snapshot().distanceTravelled-start.distanceTravelled;
  t.diagnostic(JSON.stringify({requestedKph:speed*3.6,actualKph:actual*3.6,stopSeconds:duration,brakingMetres:distance,warningMetres:brakingLookahead(actual)}));
  assert.ok(distance+actual*.8<brakingLookahead(actual));assert.equal(c.crashed,false);
 }
});

test('race ordered finish, recovery, pause and shortcut keep valid-only local record eligibility',()=>{
 const race=new RaceRules('DS_Man_01');race.advance(3);
 race.advance(1);race.observe('DS_Man_01',RACE_ROUTE.end+1,0,1/120);assert.equal(race.player.finish,null);assert.equal(race.player.gate,0);
 const elapsed=race.elapsed;race.recover('DS_Man_01');assert.equal(race.elapsed,elapsed);assert.equal(race.player.gate,0);
 race.advance(0);assert.equal(race.elapsed,elapsed);
 for(let d=RACE_ROUTE.start+.05;d<RACE_ROUTE.end+1&&!race.done;d+=.05){race.advance(1/120);race.observe('DS_Man_01',d,0,1/120);}
 assert.equal(race.player.gate,RACE_ROUTE.gates.length);assert.ok(race.player.finish!==null);
 assert.ok(CUT_THROUGH.at(-1)![0]<RACE_ROUTE.gates.find(d=>d>CUT_THROUGH.at(-1)![0])!);
 const wrong=new RaceRules('DS_Man_01');wrong.advance(3);wrong.observe('DS_Man_01',1761,8,.01);wrong.observe('DS_Man_01',1759,0,.01);assert.equal(wrong.player.gate,0);
});

test('same 120 Hz movement remains identical at 30, 60 and 120 render rates',()=>{
 const results=[30,60,120].map(hz=>{const c=new RideController(flat,{spawn:at});let accumulator=0;for(let f=0;f<hz*4;f++){accumulator+=1/hz;while(accumulator+1e-10>=1/120){c.step(1/120,{...NEUTRAL_ACTIONS,throttle:.5,steer:.08});accumulator-=1/120;}}return c.snapshot();});
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[0],results[2]);
});

test('practice advances only through actual movement, braking, turn, and an airborne landing',()=>{
 const coach=new PracticeCoach(),p=createPose();coach.observe(p,true,false);
 for(let i=0;i<20;i++){p.z+=.5;p.speed=3;coach.observe(p,true,false);}
 assert.equal(coach.stepIndex,1);p.speed=0;coach.observe(p,true,false);assert.equal(coach.stepIndex,2);
 p.speed=2;for(let i=0;i<8;i++){p.headingY+=.08;coach.observe(p,true,false);}
 assert.equal(coach.stepIndex,3);coach.observe(p,true,true);assert.equal(coach.complete,false);
 p.airHeight=.3;coach.observe(p,false,false);p.airHeight=0;coach.observe(p,true,true);assert.equal(coach.complete,true);
});


test('wheel rotation follows resolved forward and reverse travel at each mounted tire scale',()=>{
 for(const scale of [.75,.86])for(const throttle of [-.4,.4]){
  const c=new RideController(flat,{spawn:at});c.wheelScale=scale;advance(c,.1);advance(c,2,throttle);const p=createPose();c.writePose(p);
  assert.equal(c.crashed,false);assert.ok(Math.abs(p.z)>1);assert.ok(Math.abs(p.wheelSpin-p.z/(.255*scale))<.00001);
 }
 const blocked=new RideController({...flat,raycastObstacle:()=>0},{spawn:at});advance(blocked,1,.2);const p=createPose();blocked.writePose(p);
 assert.ok(Math.abs(p.z)<.1,'collision never accrues full intended travel');
});
