import test from 'node:test';
import assert from 'node:assert/strict';
import {FpsControlFlow,FpsWeaponSway,type FpsControlIntent} from './fpsControlFlow.ts';
import {AimGesture} from './combatControls.ts';
import {MouseCombatInput} from './mouseCombatInput.ts';
import {readCombatPreferences} from './combatPolish.ts';
import {FpsMotion,reloadPose} from './fpsMotion.ts';
import {initialCombat} from '../../../../ride-core/src/royale/rules.ts';
const intent=(changes:Partial<FpsControlIntent>={}):FpsControlIntent=>({enabled:true,onFoot:true,moving:true,sprint:false,aimMode:0,fire:false,reloading:false,low:false,...changes});

test('sprint lowers existing ADS; a fresh aim cancels sprint and releasing it resumes running',()=>{
 const flow=new FpsControlFlow();
 assert.equal(flow.update(intent({aimMode:2})).aimMode,2);
 assert.deepEqual(flow.update(intent({aimMode:2,sprint:true})),{aimMode:0,fire:false,sprint:true});
 flow.update(intent({sprint:true}));
 assert.deepEqual(flow.update(intent({sprint:true,aimMode:2})),{aimMode:2,fire:false,sprint:false});
 assert.equal(flow.update(intent({sprint:true})).sprint,true);
});

test('fire interrupts sprint without losing held ADS and never depends on pointer movement',()=>{
 const flow=new FpsControlFlow(),aim=new AimGesture('hold'),mouse=new MouseCombatInput(aim);
 flow.update(intent({sprint:true}));
 for(let i=0;i<300;i++){mouse.handle({type:'mousemove',button:0},i);assert.equal(flow.update(intent({sprint:true,fire:mouse.canFire})).fire,false);}
 mouse.handle({type:'mousedown',button:0},301);
 assert.deepEqual(flow.update(intent({sprint:true,fire:mouse.canFire})),{aimMode:0,fire:true,sprint:false});
 mouse.handle({type:'mousedown',button:2},302);
 assert.deepEqual(flow.update(intent({sprint:true,fire:mouse.canFire,aimMode:aim.get(303)})),{aimMode:2,fire:true,sprint:false});
 for(let i=0;i<30;i++){mouse.handle({type:'mousemove',button:0},304+i);assert.equal(flow.update(intent({fire:mouse.canFire})).fire,true);}
 mouse.handle({type:'mouseup',button:0},400);assert.equal(flow.update(intent({fire:mouse.canFire,aimMode:aim.get(400)})).fire,false);
});

test('ADS/fire chords preserve either press and release order',()=>{
 for(const firstDown of [0,2])for(const firstUp of [0,2]){
  const flow=new FpsControlFlow(),aim=new AimGesture('hold'),mouse=new MouseCombatInput(aim);
  mouse.handle({type:'mousedown',button:firstDown},0);flow.update(intent({fire:mouse.canFire,aimMode:aim.get(0)}));
  mouse.handle({type:'mousedown',button:2-firstDown},1);
  assert.deepEqual(flow.update(intent({fire:mouse.canFire,aimMode:aim.get(1)})),{aimMode:2,fire:true,sprint:false});
  mouse.handle({type:'mouseup',button:firstUp},10);
  const half=flow.update(intent({fire:mouse.canFire,aimMode:aim.get(10)}));assert.equal(half.fire,firstUp===2);assert.equal(half.aimMode,firstUp===0?2:0);
  mouse.handle({type:'mouseup',button:2-firstUp},11);assert.deepEqual(flow.update(intent({fire:mouse.canFire,aimMode:aim.get(11)})),{aimMode:0,fire:false,sprint:false});
 }
});

test('reload temporarily lowers sights without changing tap, hold or toggle ADS preferences',()=>{
 for(const preset of ['classic','hold','toggle'] as const){
  const flow=new FpsControlFlow(),aim=new AimGesture(preset);aim.down(0);if(preset!=='hold')aim.up(80);
  const requested=aim.get(300);assert.equal(requested,2);
  assert.deepEqual(flow.update(intent({aimMode:requested,fire:true,sprint:true,reloading:true})),{aimMode:0,fire:false,sprint:false});
  assert.equal(flow.update(intent({aimMode:aim.get(400)})).aimMode,2);
  aim.reset();flow.reset();assert.deepEqual(flow.update(intent()),{aimMode:0,fire:false,sprint:false});
 }
 const classic=new AimGesture('classic');classic.down(0);assert.equal(classic.get(200),1);assert.equal(new FpsControlFlow().update(intent({aimMode:classic.get(200)})).aimMode,1);
});

test('mounted, classic, low stances and lifecycle reset retain their control contracts',()=>{
 const flow=new FpsControlFlow();
 for(const changes of [{onFoot:false},{enabled:false}])assert.deepEqual(flow.update(intent({...changes,aimMode:2,sprint:true,fire:true,reloading:true})),{aimMode:2,sprint:true,fire:true});
 assert.equal(flow.update(intent({sprint:true,low:true})).sprint,false);
 assert.equal(flow.update(intent({sprint:true,moving:false})).sprint,false);
 flow.reset();assert.equal(flow.aimSuppressed,false);
 // No stale sprint ordering survives death, pause, pointer loss or remount.
 assert.equal(flow.update(intent({aimMode:2,sprint:true})).aimMode,2);
 assert.equal(flow.update(intent({aimMode:0,sprint:false})).fire,false);
});

test('combat preferences preserve customized sensitivity and support the classic fallback',()=>{
 assert.equal(readCombatPreferences({firstLook:.7,thirdFov:81}).controlStyle,'burntwax');
 assert.equal(readCombatPreferences({firstLook:.7}).firstLook,.7);
 assert.equal(readCombatPreferences({controlStyle:'classic'}).controlStyle,'classic');
 assert.equal(readCombatPreferences({controlStyle:'invalid'}).controlStyle,'burntwax');
});

test('weapon sway is bounded, ADS-stabilized, rate-independent and reduced-motion safe',()=>{
 const results=[30,60,120,144].map(hz=>{const sway=new FpsWeaponSway();for(let i=0;i<hz;i++)sway.update(1/hz,1,.5,0,0,true,false,false,false);return sway;});
 for(const result of results){assert(Math.abs(result.x-results[0].x)<1e-10);assert(Math.abs(result.y-results[0].y)<1e-10);assert(result.x>0&&result.x<.022);}
 const hip=results[0],ads=new FpsWeaponSway();for(let i=0;i<120;i++)ads.update(1/120,1,.5,0,0,true,true,false,false);assert(ads.x<hip.x*.04);
 hip.update(1/60,1000,1000,.2,20,true,false,false,false);assert(Math.abs(hip.x)<.028&&Math.abs(hip.y)<.025);
 const paused={...hip};hip.update(0,0,0,0,0,true,false,false,false);assert.deepEqual({...hip},paused);
 hip.update(1/60,1,1,.2,5,true,false,true,false);assert.deepEqual({...hip},{x:0,y:0,roll:0});
 hip.update(1/60,1,1,.2,5,true,false,false,false);hip.update(.5,1,1,.2,5,true,false,false,false);assert.deepEqual({...hip},{x:0,y:0,roll:0});
});

test('riding speed does not lower the gun into a running pose; on-foot sprint does',()=>{
 const riding=new FpsMotion(),walking=new FpsMotion(),reload=reloadPose(initialCombat(),0);
 let ride,foot;for(let i=0;i<60;i++){ride=riding.update(1/60,'static',false,15,false,false,false,reload,false);foot=walking.update(1/60,'static',false,5,false,false,false,reload,true);}
 assert.equal(ride!.run,0);assert(foot!.run>.99);
 walking.reset();assert.equal(walking.update(0,'static',false,0,false,false,false,reload,true).run,0);
});
