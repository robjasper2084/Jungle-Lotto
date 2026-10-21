import test from 'node:test';
import assert from 'node:assert/strict';
import {AimGesture} from './royale/combatControls.ts';
import {MouseCombatInput} from './royale/mouseCombatInput.ts';

const noEdge={firePressed:false,fireReleased:false};
const event=(type:string,button:number,buttons=0)=>({type,button,buttons});

for(const firstPressed of [0,2])for(const firstReleased of [0,2])test(`mouse chord press ${firstPressed} first / release ${firstReleased} first`,()=>{
 const aim=new AimGesture('hold'),mouse=new MouseCombatInput(aim);
 mouse.handle(event('mousedown',firstPressed),0);
 mouse.handle(event('mousedown',2-firstPressed),10);
 assert.equal(mouse.canFire,true);assert.equal(aim.get(11),2);
 mouse.handle(event('mouseup',firstReleased),20);
 assert.equal(mouse.canFire,firstReleased!==0);assert.equal(aim.get(21),firstReleased===0?2:0);
 mouse.handle(event('mouseup',2-firstReleased),30);
 assert.equal(mouse.canFire,false);assert.equal(aim.get(31),0);
});

test('movement alone never starts firing or aiming, even with a stale pressed-button mask',()=>{
 const aim=new AimGesture('hold'),mouse=new MouseCombatInput(aim);
 assert.equal(mouse.canFire,false);
 for(const type of ['mousemove','pointermove','pointerrawupdate','mouseenter','mouseover']){
  for(const buttons of [0,1,2,3,0,3]){
   assert.deepEqual(mouse.handle(event(type,0,buttons),10),noEdge);
   assert.equal(mouse.canFire,false);assert.equal(aim.get(11),0);
  }
 }
});

test('jitter and changing movement masks cannot release or re-trigger an active shot',()=>{
 const aim=new AimGesture('hold'),mouse=new MouseCombatInput(aim);
 assert.deepEqual(mouse.handle(event('mousedown',0,1),0),{firePressed:true,fireReleased:false});
 mouse.handle(event('mousedown',2,3),1);
 for(let tick=2;tick<200;tick++){
  for(const type of ['pointermove','mousemove']){
   assert.deepEqual(mouse.handle(event(type,tick%2?0:-1,tick%4),tick),noEdge);
   assert.equal(mouse.canFire,true);assert.equal(aim.get(tick),2);
  }
 }
 assert.deepEqual(mouse.handle(event('mousedown',0,3),201),noEdge);
 assert.deepEqual(mouse.handle(event('mouseup',0,2),202),{firePressed:false,fireReleased:true});
 assert.equal(mouse.canFire,false);assert.equal(aim.get(203),2);
 mouse.handle(event('mousemove',0,3),204);assert.equal(mouse.canFire,false);
});

test('classic quick aim release still toggles ADS while fire remains held',()=>{
 const aim=new AimGesture(),mouse=new MouseCombatInput(aim);
 mouse.handle(event('mousedown',2),0);mouse.handle(event('mousedown',0),20);mouse.handle(event('mouseup',2),100);
 assert.equal(aim.get(101),2);assert.equal(mouse.canFire,true);
 mouse.handle(event('mouseup',0),110);mouse.handle(event('mousemove',0),120);
 assert.equal(aim.get(121),2);
 mouse.handle(event('mousedown',2),200);mouse.handle(event('mouseup',2),250);
 assert.equal(aim.get(251),0);
});

test('classic long hold and toggle ADS still respect explicit right-button edges',()=>{
 const aim=new AimGesture(),mouse=new MouseCombatInput(aim);
 mouse.handle(event('mousedown',2),0);mouse.handle(event('mousedown',0),200);
 assert.equal(aim.get(201),1);
 mouse.handle(event('mouseup',2),250);assert.equal(aim.get(251),0);
 mouse.reset();aim.preset='toggle';mouse.handle(event('mousedown',2),300);mouse.handle(event('mouseup',2),900);
 assert.equal(aim.get(901),2);assert.equal(mouse.canFire,false);
});

test('cancellation clears held actions; movement after focus or capture recovery cannot re-arm',()=>{
 for(const preset of ['classic','hold','toggle'] as const){
  const aim=new AimGesture(preset),mouse=new MouseCombatInput(aim);
  mouse.handle(event('mousedown',0),0);mouse.handle(event('mousedown',2),1);mouse.reset();
  assert.equal(mouse.canFire,false);assert.equal(aim.get(20),0);
  for(const type of ['pointermove','mousemove','mouseup']){
   assert.deepEqual(mouse.handle(event(type,0,3),30),noEdge);
   assert.equal(mouse.canFire,false);assert.equal(aim.get(40),0);
  }
  mouse.handle(event('mouseup',2),45);assert.equal(aim.get(46),0);
  assert.equal(mouse.handle(event('mousedown',0),50).firePressed,true);
 }
});

test('unrelated buttons and touch compatibility events cannot initialize mouse combat',()=>{
 const aim=new AimGesture('hold'),mouse=new MouseCombatInput(aim);
 for(const type of ['pointerdown','pointerup','touchstart','click','keydown'])assert.deepEqual(mouse.handle(event(type,0,1),0),noEdge);
 for(const button of [1,3,4,-1]){
  assert.deepEqual(mouse.handle(event('mousedown',button,1),0),noEdge);
  assert.deepEqual(mouse.handle(event('mouseup',button,0),1),noEdge);
 }
 assert.equal(mouse.canFire,false);assert.equal(aim.get(2),0);
});
