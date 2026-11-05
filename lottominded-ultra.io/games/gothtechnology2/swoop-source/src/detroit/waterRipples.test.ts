import test from 'node:test';
import assert from 'node:assert/strict';
import {fillRippleField,rippleGradient,WATER_GRID,WATER_LIFE} from './waterRipples.ts';
test('water is undisturbed without contact and expired contacts leave no permanent wave',()=>{
 const pixels=new Uint8Array(WATER_GRID*WATER_GRID*4);fillRippleField(pixels,0,0,10,[{x:0,z:0,time:0,strength:1}]);
 for(let i=0;i<pixels.length;i+=4)assert.deepEqual([...pixels.subarray(i,i+4)],[128,128,0,255]);
 assert.deepEqual(rippleGradient(0,0,0,[{x:0,z:0,time:1,strength:1}]),[0,0,0]);
});
test('a contact creates outward, symmetric normals with finite values at its centre',()=>{
 const e=[{x:10,z:12,time:0,strength:1}],a=rippleGradient(11,12,.3,e),b=rippleGradient(9,12,.3,e);
 assert(Math.abs(a[0])>.001);assert(Math.abs(a[0]+b[0])<1e-9);assert.equal(a[1],0);
 assert(rippleGradient(10,12,0,e).every(Number.isFinite));assert.deepEqual(rippleGradient(11,12,WATER_LIFE+.1,e),[0,0,0]);
});
test('eight simultaneous contacts stay within a fixed 16 KB field',()=>{
 const e=Array.from({length:8},(_,i)=>({x:i*.3,z:i*.2,time:0,strength:1})),p=new Uint8Array(WATER_GRID*WATER_GRID*4);fillRippleField(p,0,0,.5,e);
 assert.equal(p.byteLength,16384);assert(p.some((v,i)=>i%4===2&&v>0));assert(p.every((v,i)=>i%4!==3||v===255));
});
