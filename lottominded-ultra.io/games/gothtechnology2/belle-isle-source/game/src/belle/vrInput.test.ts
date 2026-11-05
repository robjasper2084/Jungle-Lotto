import test from 'node:test';import assert from 'node:assert/strict';
import {BelleVRInput,comfortThrottle,type VRSource} from './vrInput.ts';
const pads=():VRSource[]=>['left','right'].map(handedness=>({handedness,gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false,value:0}))}}));
function button(p:VRSource[],hand:number,index:number,on=true){p[hand].gamepad!.buttons[index].pressed=on;p[hand].gamepad!.buttons[index].value=+on;}
function axis(p:VRSource[],hand:number,index:number,value:number){(p[hand].gamepad!.axes as number[])[index]=value;}
test('VR entry and reconnection require both controllers neutral before movement',()=>{
 const i=new BelleVRInput(),p=pads();axis(p,0,3,-1);assert.equal(i.sample(p).ready,false);axis(p,0,3,0);assert(i.sample(p).ready);axis(p,0,3,-1);assert.equal(i.sample(p).throttle,1);
 assert.equal(i.sample([p[0]]).ready,false);assert.equal(i.sample(p).ready,false);axis(p,0,3,0);assert(i.sample(p).ready);
 i.reset();button(p,1,4);assert.equal(i.sample(p).mount,false);button(p,1,4,false);i.sample(p);button(p,1,4);assert(i.sample(p).mount);assert(!i.sample(p).mount);
});
test('Quest buttons have separate walk, hop, recovery, menu and brake actions',()=>{
 const i=new BelleVRInput(),p=pads();i.sample(p);button(p,1,4);assert(i.sample(p).mount);button(p,1,5);let a=i.sample(p);assert(a.hop&&a.hopHeld);assert(!a.recover);a=i.sample(p);assert(!a.hop&&a.hopHeld);
 button(p,0,4);assert(i.sample(p).recover);button(p,0,5);assert(i.sample(p).menu);button(p,0,0);assert(i.sample(p).brake);
});
test('snap turns fire once per stick deflection and rearm at center',()=>{
 const i=new BelleVRInput(),p=pads();i.sample(p);axis(p,1,2,1);assert.equal(i.sample(p).snap,Math.PI/6);assert.equal(i.sample(p).snap,0);axis(p,1,2,0);i.sample(p);axis(p,1,2,-1);assert.equal(i.sample(p).snap,-Math.PI/6);
});
test('menu input cannot move, jump or mount; selection uses an explicit press',()=>{
 const i=new BelleVRInput(),p=pads();i.sample(p,true);axis(p,0,3,-1);axis(p,1,2,1);button(p,1,4);button(p,1,5);const a=i.sample(p,true);
 assert.equal(a.step,-1);assert.equal(a.page,1);assert(a.select);assert.equal(a.throttle,0);assert.equal(a.snap,0);assert.equal(a.mount,false);assert.equal(a.hop,false);assert.equal(i.sample(p,true).select,false);
 i.reset();assert(!i.sample(p).ready); // Closing a menu cannot inherit its held input.
});
test('brake and comfort governor oppose forward and reverse motion without accelerating from rest',()=>{
 assert.equal(comfortThrottle(1,0,true,true),0);assert.equal(comfortThrottle(1,4,true,true),-1);assert.equal(comfortThrottle(-1,-4,true,true),1);
 assert(comfortThrottle(1,8,false,true)<0);assert(comfortThrottle(-1,-8,false,true)>0);assert.equal(comfortThrottle(.6,8,false,false),.6);
});
