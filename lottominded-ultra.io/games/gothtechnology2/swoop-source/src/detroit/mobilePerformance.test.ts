import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetPixelRatio} from './renderBudget.ts';
import {GRAPHICS_PRESETS,resolveGraphics} from './graphicsQuality.ts';
import {FrameSchedule} from './frameSchedule.ts';
import {CONTROL_IDS,defaultTouchPosition,controlRect} from './touchLayout.ts';
test('Automatic is conservative on low memory and unknown devices; manual High remains available',()=>{
 assert.equal(resolveGraphics('auto'),'low');assert.equal(resolveGraphics('auto',8,4),'low');assert.equal(resolveGraphics('auto',8,8),'balanced');assert.equal(resolveGraphics('high',2,2),'high');
 assert.equal(GRAPHICS_PRESETS.low.shadows,0);assert.equal(GRAPHICS_PRESETS.low.fps,30);
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

