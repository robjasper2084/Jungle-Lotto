import test from 'node:test';
import assert from 'node:assert/strict';
import {XRCombatInput} from './xrCombatInput.ts';
const pad=(handedness:string)=>({handedness,gamepad:{axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false,value:0}))}});
test('VR movement never starts fire, trigger release never stops movement',()=>{
 const input=new XRCombatInput(),left=pad('left'),right=pad('right'),sources=[left,right];input.sample(sources);
 left.gamepad.axes[3]=-1;assert.equal(input.sample(sources).fire,false);
 right.gamepad.buttons[0].pressed=true;let p=input.sample(sources);assert(p.fire&&p.throttle===1);
 left.gamepad.axes[2]=.6;p=input.sample(sources);assert(p.fire&&p.steer>0);
 right.gamepad.buttons[0].pressed=false;p=input.sample(sources);assert(!p.fire&&p.throttle===1&&p.steer>0);
});
test('VR ADS and fire remain independent in both press and release orders',()=>{
 for(const fireFirst of [true,false])for(const releaseFireFirst of [true,false]){
  const input=new XRCombatInput(),left=pad('left'),right=pad('right'),sources=[right,left];input.sample(sources);
  (fireFirst?right:left).gamepad.buttons[0].pressed=true;input.sample(sources);(fireFirst?left:right).gamepad.buttons[0].pressed=true;
  assert(input.sample(sources).fire&&input.sample(sources).ads);
  (releaseFireFirst?right:left).gamepad.buttons[0].pressed=false;const p=input.sample(sources);
  assert.equal(p.fire,!releaseFireFirst);assert.equal(p.ads,releaseFireFirst);
 }
});
test('VR tracking/session loss requires both controls neutral before resuming',()=>{
 const input=new XRCombatInput(),left=pad('left'),right=pad('right'),sources=[left,right];input.sample(sources);right.gamepad.buttons[0].pressed=true;assert(input.sample(sources).fire);
 assert(!input.sample([left]).fire);assert(!input.sample(sources).fire);input.reset();assert(!input.sample(sources).fire);
 right.gamepad.buttons[0].pressed=false;input.sample(sources);right.gamepad.buttons[0].pressed=true;assert(input.sample(sources).fire);
});
test('mount/recovery/reload and snap turn are edges rather than repeated actions',()=>{
 const input=new XRCombatInput(),left=pad('left'),right=pad('right'),sources=[left,right];input.sample(sources);
 right.gamepad.buttons[4].pressed=right.gamepad.buttons[5].pressed=left.gamepad.buttons[4].pressed=true;right.gamepad.axes[2]=1;
 const a=input.sample(sources),b=input.sample(sources);assert(a.reload&&a.mount&&a.recover&&a.snap);assert(!b.reload&&!b.mount&&!b.recover&&!b.snap);
});
