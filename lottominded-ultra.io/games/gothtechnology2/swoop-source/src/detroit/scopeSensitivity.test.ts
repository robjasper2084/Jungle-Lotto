import test from 'node:test';import assert from 'node:assert/strict';
import {readScopeSensitivity} from './royale/scopeSensitivity.ts';
test('partial saved scope settings preserve independent channels and recover invalid values',()=>{
 const s=readScopeSensitivity({scope4:{ads:.4,look:1.2,gyro:.8},scope8:{ads:NaN,gyro:9},iron:{look:-1}});
 assert.deepEqual(s.scope4,{ads:.4,look:1.2,gyro:.8});assert.equal(s.scope8.ads,1);assert.equal(s.scope8.gyro,2);assert.equal(s.iron.look,.1);assert.equal(s.scope2.ads,1);
 s.scope4.gyro=.2;assert.equal(s.scope8.gyro,2);assert.deepEqual(readScopeSensitivity(null).iron,{look:1,ads:1,gyro:1});
});
