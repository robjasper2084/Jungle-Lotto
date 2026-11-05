import test from 'node:test';
import assert from 'node:assert/strict';
import {GiantSlideMotion,SLIDE_ENTRY,GIANT_SLIDE,slideWorld,slideLocal} from './giantSlide.ts';
test('staircase is on the right when facing uphill from the runout',()=>{
 assert.ok(GIANT_SLIDE.stairsX<0);
 const front=slideWorld(0,24,0),top=slideWorld(0,-18,0),stairs=slideWorld(GIANT_SLIDE.stairsX,24,0);
 const fx=top.x-front.x,fz=top.z-front.z;
 assert.ok((-fz)*(stairs.x-front.x)+fx*(stairs.z-front.z)>0);
 for(const [u,v] of [[-4.85,18.75],[-1.8,-18],[3,24]]){const p=slideWorld(u,v,4),local=slideLocal(p.x,p.z);assert.ok(Math.abs(local.u-u)<1e-8&&Math.abs(local.v-v)<1e-8);}
});
test('climb, wait for deliberate start, slide and stand finish on land',()=>{
 const motion=new GiantSlideMotion();assert.equal(motion.start({...SLIDE_ENTRY,x:SLIDE_ENTRY.x+20}),false);assert.equal(motion.start(SLIDE_ENTRY),true);
 let last={...motion.position},climbTime=0;
 while(motion.stage==='climb'&&climbTime<100){motion.update(1/60);climbTime+=1/60;assert.ok(Math.hypot(motion.position.x-last.x,motion.position.y-last.y,motion.position.z-last.z)<.04);last={...motion.position};}
 assert.equal(motion.stage,'ready');assert.ok(climbTime>30&&climbTime<65);assert.ok(motion.position.y>13);
 motion.update(.05);assert.equal(motion.stage,'ready');assert.equal(motion.descend(),true);assert.equal(motion.descend(),false);
 let elapsed=0,peakSpeed=0;while(String(motion.stage)!=='done'&&elapsed<40){motion.update(1/60);elapsed+=1/60;peakSpeed=Math.max(peakSpeed,motion.speed);assert.ok(Object.values(motion.position).every(Number.isFinite));assert.ok(motion.seat>=0&&motion.seat<=1);}
 assert.equal(motion.stage,'done');assert.ok(elapsed>6&&elapsed<40);assert.ok(peakSpeed<=7.5);assert.equal(motion.seat,0);assert.equal(motion.position.y,GIANT_SLIDE.origin[1]);assert.ok(slideLocal(motion.position.x,motion.position.z).v>25);
});
test('cancel and suspension do not advance or strand the attraction',()=>{const m=new GiantSlideMotion();m.start(SLIDE_ENTRY);m.update(.05);const before={...m.position};m.update(0);m.update(NaN);assert.deepEqual(m.position,before);m.cancel();assert.equal(m.stage,'idle');assert.equal(m.start(SLIDE_ENTRY),true);});
