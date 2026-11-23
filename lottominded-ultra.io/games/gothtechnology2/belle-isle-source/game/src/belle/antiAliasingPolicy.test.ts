import test from 'node:test';
import assert from 'node:assert/strict';
import {readAntiAliasingMode,enableHardwareAntialiasing} from './antiAliasingPolicy.ts';

const desktop={coarsePointer:false,deviceMemoryGB:8,logicalCores:8};
test('legacy or corrupt graphics settings resolve to Automatic',()=>{
 for(const v of [undefined,null,'','msaa','AUTO',{},false])assert.equal(readAntiAliasingMode(v),'automatic');
 assert.equal(readAntiAliasingMode('on'),'on');
 assert.equal(readAntiAliasingMode('off'),'off');
});
test('Automatic preserves desktop MSAA and protects touch and low-end devices',()=>{
 assert.equal(enableHardwareAntialiasing('automatic',desktop),true);
 assert.equal(enableHardwareAntialiasing('automatic',{...desktop,coarsePointer:true}),false);
 assert.equal(enableHardwareAntialiasing('automatic',{...desktop,deviceMemoryGB:2}),false);
 assert.equal(enableHardwareAntialiasing('automatic',{...desktop,logicalCores:2}),false);
 assert.equal(enableHardwareAntialiasing('automatic',{coarsePointer:false}),true);
});
test('explicit On or Off overrides automatic device selection',()=>{
 for(const d of [desktop,{coarsePointer:true,deviceMemoryGB:1,logicalCores:1}]){
  assert.equal(enableHardwareAntialiasing('on',d),true);
  assert.equal(enableHardwareAntialiasing('off',d),false);
 }
});
test('invalid device hints do not disable desktop smoothing',()=>{
 for(const v of [NaN,Infinity,-1,0]){
  assert.equal(enableHardwareAntialiasing('automatic',{coarsePointer:false,deviceMemoryGB:v,logicalCores:v}),true);
 }
});
