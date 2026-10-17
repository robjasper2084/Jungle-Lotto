import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {acquireRiderTint} from '../src/riderTintGeometry.ts';
import {SpatialUpdateGate} from '../src/spatialUpdateGate.ts';
import {FootAnimation} from '../src/footAnimation.ts';

test('a crowd shares immutable tint buffers and releases them only after its final rider',()=>{
 const source=new T.BufferGeometry();
 source.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,1,2,0,1,0,0,0],4));
 source.setAttribute('skinWeight',new T.Float32BufferAttribute([.2,.3,.5,0,1,0,0,0],4));
 const bones=[{name:'Head'},{name:'Spine'},{name:'Leg'}],crowd=Array.from({length:20},()=>acquireRiderTint(source,bones));
 assert(crowd.every(c=>c.geometry===crowd[0].geometry));assert.equal(source.getAttribute('riderTint'),undefined);
 const mask=crowd[0].geometry.getAttribute('riderTint');assert(Math.abs(mask.getX(0)-.2)<1e-6);assert.equal(mask.getY(1),1);
 let disposed=0;crowd[0].geometry.addEventListener('dispose',()=>disposed++);
 crowd.slice(0,-1).forEach(c=>c.release());assert.equal(disposed,0);crowd.at(-1)!.release();assert.equal(disposed,1);crowd[0].release();assert.equal(disposed,1);
 const next=acquireRiderTint(source,bones);assert.notEqual(next.geometry,crowd[0].geometry);next.release();source.dispose();
});

test('distance decisions are bounded while movement, settings and time jumps refresh immediately',()=>{
 const gate=new SpatialUpdateGate();let updates=0;
 for(let i=0;i<120;i++)if(gate.due(0,0,i/120))updates++;
 assert(updates>=6&&updates<=7);
 assert(gate.due(5,0,1));assert(!gate.due(5,0,1.01));assert(gate.due(5,0,1.02,'ultra'));assert(gate.due(5,0,0,'ultra'));
});

test('walk transitions ease consistently at 30 and 120 fps without modifying movement',()=>{
 const results=[30,120].map(fps=>{const a=new FootAnimation();a.update({footTime:0,speed:0});
 for(let i=1;i<=fps/4;i++){const p={footTime:i/fps,speed:4,velocityX:4,velocityZ:0,headingY:0},before=structuredClone(p);a.update(p);assert.deepEqual(p,before);}
 assert(a.pace>3.9&&a.pace<4);assert(a.direction>1.5&&a.direction<Math.PI/2);
 return a;});
 assert(Math.abs(results[0].pace-results[1].pace)<.02);
 const a=results[0];a.update({footTime:0,speed:-2,velocityZ:-2});assert.equal(a.pace,2);assert.equal(Math.abs(a.direction),Math.PI);
});
