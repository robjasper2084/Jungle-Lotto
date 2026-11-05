import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldQuality} from './worldQuality.ts';
import type {EnvironmentQuality} from './environmentDetail.ts';

function fixture(){
 const details:EnvironmentQuality[]=[],pixels:number[]=[];let device=2;
 const quality=new WorldQuality(value=>details.push(value),value=>pixels.push(value),()=>device);
 return{quality,details,pixels,device(value:number){device=value;}};
}
test('automatic resolution steps leave unchanged world detail pools alone',()=>{
 const f=fixture();f.quality.setQuality('automatic');
 for(const scale of [1,.9,.8,.8])f.quality.setBudget(scale);
 assert.deepEqual(f.details,['automatic']);assert.deepEqual(f.pixels,[1.25,1.125,1]);
 f.quality.setBudget(.7);assert.deepEqual(f.details,['automatic','smooth']);assert.equal(f.pixels.at(-1),.875);
 f.quality.setBudget(.65);assert.deepEqual(f.details,['automatic','smooth']);
 assert.equal(f.quality.requested,'automatic');assert.equal(f.quality.effective,'smooth');
});
test('detail hysteresis prevents repeated rebuilds during gradual recovery',()=>{
 const f=fixture();f.quality.setQuality('automatic');f.quality.setBudget(.75);
 for(const scale of [.8,.75,.84,.76,.8])f.quality.setBudget(scale);
 assert.deepEqual(f.details,['automatic','smooth']);
 f.quality.setBudget(.85);assert.deepEqual(f.details,['automatic','smooth','automatic']);
 for(const scale of [.84,.8,.76])f.quality.setBudget(scale);
 assert.equal(f.details.length,3);assert.equal(f.quality.effective,'automatic');
 f.quality.setBudget(.75);assert.equal(f.quality.effective,'smooth');assert.equal(f.details.length,4);
});
test('explicit High and Smooth retain their authored detail and pixel policies',()=>{
 const f=fixture();f.quality.setQuality('high');f.quality.setBudget(.65);
 assert.equal(f.quality.effective,'high');assert.equal(f.quality.scale,1);assert.deepEqual(f.pixels,[1.5]);
 f.quality.setQuality('smooth');f.quality.setBudget(1);f.quality.setQuality('smooth');
 assert.deepEqual(f.details,['high','smooth']);assert.deepEqual(f.pixels,[1.5,1]);
 f.quality.setQuality('automatic');assert.equal(f.quality.effective,'automatic');assert.equal(f.quality.scale,1);assert.equal(f.pixels.at(-1),1.25);
});
test('DPR changes update resolution without invalidating a stable detail tier',()=>{
 const f=fixture();f.device(1);f.quality.setQuality('automatic');f.quality.setBudget(.9);
 f.device(2);f.quality.setBudget(.9);
 assert.deepEqual(f.details,['automatic']);assert.deepEqual(f.pixels,[1,.9,1.125]);
 for(const value of [NaN,Infinity,-Infinity])f.quality.setBudget(value);
 assert.equal(f.quality.scale,.9);assert.equal(f.pixels.length,3);
});
test('selecting Automatic again clears the previous degraded budget once',()=>{
 const f=fixture();f.quality.setQuality('automatic');f.quality.setBudget(.65);f.quality.setQuality('automatic');
 assert.equal(f.quality.scale,1);assert.equal(f.quality.effective,'automatic');
 assert.deepEqual(f.details,['automatic','smooth','automatic']);
 f.quality.setQuality('automatic');assert.equal(f.details.length,3);assert.equal(f.pixels.length,3);
});
