import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installRenderSubmissionProbe,renderSubmissionOperationNames,
  type RenderSubmissionFrame,type RenderSubmissionProbe,
} from './renderSubmissionDiagnostics.ts';

// These are scripted correctness fixtures, not the separate frozen 256-cycle
// work oracle. They do not count operation-name reads or measure runtime.

test('overlapping active operations retain original category update order and clock sequence',()=>{
  const clocks:number[]=[],visits:[number,string][]=[],native:string[]=[];
  const gl={bufferSubData(){native.push('bufferSubData');return 'buffer';}};
  const scene={updateMatrixWorld(){native.push('matrix');return gl.bufferSubData();}};
  const renderer={getContext:()=>gl,renderBufferDirect(){native.push('direct');return scene.updateMatrixWorld();}};
  const probe=installRenderSubmissionProbe(renderer,scene,()=>{const value=clocks.length+1;clocks.push(value);return value;});
  probe.beginFrame(true);
  // Observe actual accumulator access order, not the implementation's mask.
  const operations=(probe as unknown as {frame:RenderSubmissionFrame}).frame.operations;
  const descriptors=renderSubmissionOperationNames.map(name=>[name,Object.getOwnPropertyDescriptor(operations,name)!] as const);
  for(const [name,descriptor] of descriptors)Object.defineProperty(operations,name,{configurable:true,enumerable:true,get(){visits.push([clocks.length,name]);return descriptor.value;}});
  try{assert.equal(renderer.renderBufferDirect(),'buffer');}
  finally{for(const [name,descriptor] of descriptors)Object.defineProperty(operations,name,descriptor);}
  assert.deepEqual(native,['direct','matrix','bufferSubData']);
  assert.deepEqual(clocks,[1,2,3,4,5,6]);
  assert.deepEqual(visits,[
    [1,'directDraw'],
    [2,'directDraw'],[2,'matrix'],
    [3,'matrix'],[3,'directDraw'],[3,'bufferSubData'],
    [4,'matrix'],[4,'directDraw'],[4,'bufferSubData'],[4,'bufferSubData'],
    [5,'matrix'],[5,'directDraw'],[5,'matrix'],
    [6,'directDraw'],[6,'directDraw'],
  ]);
  const frame=probe.finishFrame()!;
  assert.deepEqual(frame.operations.directDraw,{calls:1,cpuMs:5,maxCpuMs:5,outsideDirectCalls:0,outsideDirectCpuMs:0});
  assert.deepEqual(frame.operations.matrix,{calls:1,cpuMs:3,maxCpuMs:3,outsideDirectCalls:0,outsideDirectCpuMs:0});
  assert.deepEqual(frame.operations.bufferSubData,{calls:1,cpuMs:1,maxCpuMs:1,outsideDirectCalls:0,outsideDirectCpuMs:0});
  assert.equal(frame.invalidObservations,0);probe.dispose();
});

test('same-operation nesting remains active until the outer call completes and resets across frames',()=>{
  let reads=0;const ledger:string[]=[];const result={returned:true};
  const gl={
    texImage2D(this:unknown){assert.equal(this,gl);ledger.push('texture-outer');assert.equal(gl.texSubImage2D(),result);assert.equal(gl.drawElements(),result);return result;},
    texSubImage2D(this:unknown){assert.equal(this,gl);ledger.push('texture-inner');return result;},
    drawElements(this:unknown){assert.equal(this,gl);ledger.push('draw');return result;},
  };
  const probe=installRenderSubmissionProbe({getContext:()=>gl},{},()=>++reads);probe.beginFrame(true);
  assert.equal(gl.texImage2D(),result);const first=probe.finishFrame()!;
  assert.deepEqual(ledger,['texture-outer','texture-inner','draw']);assert.equal(reads,6);
  assert.deepEqual(first.operations.textureUpload,{calls:2,cpuMs:5,maxCpuMs:5,outsideDirectCalls:2,outsideDirectCpuMs:5});
  assert.deepEqual(first.operations.draw,{calls:1,cpuMs:1,maxCpuMs:1,outsideDirectCalls:1,outsideDirectCpuMs:1});
  probe.beginFrame(true);assert.equal(gl.drawElements(),result);const second=probe.finishFrame()!;
  assert.equal(reads,8);assert.equal(second.operations.textureUpload.calls,0);assert.equal(second.operations.textureUpload.cpuMs,0);
  assert.deepEqual(second.operations.draw,{calls:1,cpuMs:1,maxCpuMs:1,outsideDirectCalls:1,outsideDirectCpuMs:1});
  assert.equal(first.operations.textureUpload.cpuMs,5);probe.dispose();
});

test('clock-triggered cancellation and restart never charge stale operations to the new epoch',()=>{
  for(const restartAt of [1,2,3,4]){
    let reads=0;let probe:RenderSubmissionProbe;const ledger:string[]=[];
    const gl={bufferData(){ledger.push('buffer');return 17;},drawElements(){ledger.push('draw');return 19;}};
    const renderer={getContext:()=>gl,renderBufferDirect(){ledger.push('direct');return gl.bufferData();}};
    probe=installRenderSubmissionProbe(renderer,{},()=>{reads++;if(reads===restartAt){probe.cancelFrame();probe.beginFrame(true);}return reads;});
    probe.beginFrame(true);assert.equal(renderer.renderBufferDirect(),17);assert.equal(gl.drawElements(),19);
    const frame=probe.finishFrame()!;
    assert.deepEqual(ledger,['direct','buffer','draw']);
    assert.equal(reads,[5,4,5,6][restartAt-1]);assert.equal(frame.invalidObservations,0);
    assert.equal(frame.operations.directDraw.calls,0);assert.equal(frame.operations.directDraw.cpuMs,0);
    assert.equal(frame.operations.bufferData.calls,restartAt===1?1:0);
    assert.equal(frame.operations.bufferData.cpuMs,restartAt===1?1:0);
    assert.equal(frame.operations.bufferData.outsideDirectCalls,restartAt===1?1:0);
    assert.deepEqual(frame.operations.draw,{calls:1,cpuMs:1,maxCpuMs:1,outsideDirectCalls:1,outsideDirectCpuMs:1});
    probe.dispose();
  }
});

test('native cancellation while categories overlap clears them before new work and preserves inactive forwarding',()=>{
  let reads=0,restart=true;let probe:RenderSubmissionProbe;const receiver={borrowed:true},result={value:23};
  const ledger:unknown[][]=[];
  const gl={bufferSubData(this:unknown,...args:unknown[]){ledger.push(['buffer',this,...args]);if(restart){probe.cancelFrame();probe.beginFrame(true);restart=false;}return gl.drawElements.call(receiver,result);},
    drawElements(this:unknown,value:unknown){ledger.push(['draw',this,value]);return value;}};
  const scene={updateMatrixWorld(){return gl.bufferSubData(result);}};
  const renderer={getContext:()=>gl,renderBufferDirect(){return scene.updateMatrixWorld();}};
  probe=installRenderSubmissionProbe(renderer,scene,()=>++reads);probe.beginFrame(true);
  assert.equal(renderer.renderBufferDirect(),result);let frame=probe.finishFrame()!;
  assert.equal(reads,5);assert.equal(frame.invalidObservations,0);
  for(const name of ['directDraw','matrix','bufferSubData'] as const)assert.equal(frame.operations[name].calls,0);
  assert.deepEqual(frame.operations.draw,{calls:1,cpuMs:1,maxCpuMs:1,outsideDirectCalls:1,outsideDirectCpuMs:1});
  assert.deepEqual(ledger,[['buffer',gl,result],['draw',receiver,result]]);
  probe.beginFrame(false);assert.equal(renderer.renderBufferDirect(),result);assert.equal(reads,5);assert.equal(probe.finishFrame(),undefined);
  probe.beginFrame(true);assert.equal(gl.drawElements(result),result);frame=probe.finishFrame()!;
  assert.equal(reads,7);assert.equal(frame.operations.draw.cpuMs,1);assert.equal(frame.operations.directDraw.cpuMs,0);probe.dispose();
});

test('invalid and zero clock deltas preserve nested union/fault semantics and original exceptions',()=>{
  for(const zero of [false,true]){
    const failure={original:true},returned={original:true};let originalCalls=0,reads=0;
    const script:unknown[]=zero?Array(12).fill(0):[0,NaN,2,1,()=>{throw Error('scripted clock');},4,Infinity,6,7,7,8,9];
    const gl={bufferData(){originalCalls++;if(originalCalls===3)throw failure;return returned;}};
    const renderer={getContext:()=>gl,renderBufferDirect(){return gl.bufferData();}};
    const probe=installRenderSubmissionProbe(renderer,{},()=>{reads++;const value=script.shift();return typeof value==='function'?value():value as number;});
    probe.beginFrame(true);
    assert.equal(renderer.renderBufferDirect(),returned);assert.equal(renderer.renderBufferDirect(),returned);
    assert.throws(()=>renderer.renderBufferDirect(),error=>error===failure);
    const frame=probe.finishFrame()!;
    assert.equal(originalCalls,3);assert.equal(reads,12);assert.equal(script.length,0);
    assert.equal(frame.invalidObservations,zero?0:4);
    assert.deepEqual(frame.operations.directDraw,{calls:3,cpuMs:zero?0:2,maxCpuMs:zero?0:2,outsideDirectCalls:0,outsideDirectCpuMs:0});
    assert.deepEqual(frame.operations.bufferData,{calls:3,cpuMs:zero?0:1,maxCpuMs:zero?0:1,outsideDirectCalls:0,outsideDirectCpuMs:0});
    assert.equal(frame.topDirectDraws.length,zero?3:1);probe.dispose();
  }
});
