import test from 'node:test';
import assert from 'node:assert/strict';
import {StartupTelemetry} from './startupTelemetry.ts';

test('post-render submissions are counted even when window is unfocused',()=>{
 let tick=0;const s=new StartupTelemetry(()=>tick);
 s.sample(1,2,0,0,0,false);assert.equal(s.snapshot().submittedFrames,0);
 s.begin('solo');s.sample(1,2,0,0,0,false);assert.equal(s.snapshot().submittedFrames,1);
 tick+=100;s.sample(1,2,0,0,0,true);tick+=100;s.sample(1,2,0,0,0,true);
 assert.equal(s.snapshot().submittedFrames,3);
 assert.equal(s.snapshot().windows.reduce((n,w)=>n+w.frames,0),1);
 tick=31_000;s.sample(1,2,0,0,0,false);assert.equal(s.snapshot().submittedFrames,4);
 s.begin('coop');assert.equal(s.snapshot().submittedFrames,0);s.dispose();
});
