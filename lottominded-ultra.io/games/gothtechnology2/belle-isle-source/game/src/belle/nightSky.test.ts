import test from 'node:test';import assert from 'node:assert/strict';
import {moonDirection,meteorFrame} from './nightSky.ts';
test('moon stays above the night horizon on a visible, lower lunar arc',()=>{
 for(let hour=18;hour<=30;hour+=.25){const d=moonDirection(hour);assert.ok(Math.abs(Math.hypot(...d)-1)<1e-10);assert.ok(d[1]>.07&&d[1]<.8);}
 assert.deepEqual(moonDirection(0),moonDirection(24));
});
test('shooting stars are brief, occasional and disabled in daylight or reduced motion',()=>{
 let visible=0;
 for(let t=0;t<150;t+=.025){const frame=meteorFrame(t,1,false);if(frame.opacity>0){visible++;assert.ok(frame.head[1]>0&&frame.tail[1]>0);assert.ok(frame.opacity<=1);}
 assert.equal(meteorFrame(t,0,false).opacity,0);assert.equal(meteorFrame(t,1,true).opacity,0);}
 assert.ok(visible>90&&visible<180);
 assert.deepEqual(meteorFrame(20,1,false),meteorFrame(20,1,false));
});
