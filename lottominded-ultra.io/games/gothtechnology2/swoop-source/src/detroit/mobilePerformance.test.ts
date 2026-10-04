import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetPixelRatio} from './renderBudget.ts';
import {GRAPHICS_PRESETS,resolveGraphics,antialiasForDevice,parseGraphicsTuning} from './graphicsQuality.ts';
import {FrameSchedule} from './frameSchedule.ts';
import {CONTROL_IDS,defaultTouchPosition,controlRect} from './touchLayout.ts';
test('Automatic uses High on capable desktops and lighter budgets on phones or weak hardware',()=>{
 assert.equal(resolveGraphics('auto'),'balanced');assert.equal(resolveGraphics('auto',8,4),'balanced');assert.equal(resolveGraphics('auto',8,8),'high');assert.equal(resolveGraphics('auto',12,undefined),'high');assert.equal(resolveGraphics('auto',4,4),'low');assert.equal(resolveGraphics('auto',12,8,false,'SwiftShader'),'low');assert.equal(resolveGraphics('auto',6,undefined,true),'balanced');assert.equal(resolveGraphics('auto',8,8,true),'high');assert.equal(resolveGraphics('auto',4,4,true),'low');assert.equal(resolveGraphics('high',2,2),'high');assert.equal(resolveGraphics('ultra',2,2),'ultra');
 assert.equal(GRAPHICS_PRESETS.low.shadows,0);assert.equal(GRAPHICS_PRESETS.low.fps,30);
});
test('automatic antialiasing enables capable desktops and high-end mobiles while manual choices win',()=>{
 assert.equal(antialiasForDevice('auto',12,undefined),true);assert.equal(antialiasForDevice('auto',2,2),false);assert.equal(antialiasForDevice('auto',8,8,true),true);assert.equal(antialiasForDevice('auto',4,4,true),false);assert.equal(antialiasForDevice('off',16,16),false);assert.equal(antialiasForDevice('on',2,2,true),true);
});
test('saved graphics controls reject corrupted or unsupported values',()=>{
 assert.deepEqual(parseGraphicsTuning('{"fps":120,"shadows":4096,"aa":"on","resolution":1.25}'),{resolution:1.25,fps:120,shadows:4096,aa:'on'});
 for(const raw of ['null','bad','{"fps":0,"shadows":-1,"textureSize":999999,"distance":0,"resolution":100,"aa":"bad"}'])assert.deepEqual(parseGraphicsTuning(raw),{});
});
test('render budget limits large screens and honors smaller device ratios',()=>{
 for(const [w,h] of [[390,844],[844,390],[2560,1600],[3840,2160]]){
  const r=budgetPixelRatio(3,.8,w,h,600000);assert.ok(w*h*r*r<=600001);assert.ok(r<=.8);
 }assert.equal(budgetPixelRatio(.5,.8,320,568,600000),.5);
});
test('Low caps active riding at 30 FPS without limiting XR',()=>{
 const f=new FrameSchedule();assert.equal(f.shouldRender(0,false,false,30),true);assert.equal(f.shouldRender(16,false,false,30),false);assert.equal(f.shouldRender(34,false,false,30),true);assert.equal(f.shouldRender(40,false,true,30),true);
});
test('default phone and tablet controls remain on screen without overlap',()=>{
 for(const [w,h] of [[320,568],[390,844],[844,390],[1024,768]]){
  const circles=CONTROL_IDS.map(id=>{const size=id==='stick'?136:id==='hop'?80:64;const r=controlRect(defaultTouchPosition(id,w,h),size,size,w,h);assert.ok(r.width>=48);return {id,x:r.left+r.width/2,y:r.top+r.height/2,r:r.width/2};});
  for(let a=0;a<circles.length;a++)for(let b=a+1;b<circles.length;b++){const x=circles[a],y=circles[b];assert.ok(Math.hypot(x.x-y.x,x.y-y.y)>=x.r+y.r,`${w}x${h}: ${x.id} and ${y.id} overlap`);}
 }
});
