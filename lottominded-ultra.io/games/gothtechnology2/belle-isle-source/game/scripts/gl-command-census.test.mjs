import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installGlCommandCensus} from './gl-command-census.mjs';

function fixture(options = {}) {
  const context = vm.createContext({});
  vm.runInContext(`
    globalThis.window = globalThis;
    globalThis.now = 10;
    globalThis.performance = {now: () => now};
    globalThis.calls = [];
    globalThis.listeners = new Map();
    globalThis.addEventListener = (name, fn) => {let list=listeners.get(name);if(!list)listeners.set(name,list=[]);list.push(fn);};
    globalThis.removeEventListener = (name, fn) => {listeners.set(name,(listeners.get(name)||[]).filter(value=>value!==fn));};
    globalThis.emit = (name, event) => {for(const fn of [...(listeners.get(name)||[])])fn(event);};
    globalThis.sentinel = new Error('native failure');
    globalThis.nativeResult = {};
    function native(name, receiver, args, result) {calls.push({name,receiver,args});return result;}
    class Extension {multiDrawElementsWEBGL(...args){return native('multiDrawElementsWEBGL',this,args,nativeResult);}}
    globalThis.extension = new Extension();
    class GL {
      getUniformLocation(...args){return native('getUniformLocation',this,args,{});}
      getExtension(...args){return native('getExtension',this,args,extension);}
      getError(...args){return native('getError',this,args,0);}
      useProgram(...args){return native('useProgram',this,args);}
      shaderSource(...args){return native('shaderSource',this,args);}
      attachShader(...args){return native('attachShader',this,args);}
      linkProgram(...args){return native('linkProgram',this,args);}
      deleteProgram(...args){return native('deleteProgram',this,args);}
      uniform1f(...args){return native('uniform1f',this,args);}
      uniform2f(...args){return native('uniform2f',this,args);}
      uniform3fv(...args){return native('uniform3fv',this,args);}
      uniformMatrix4fv(...args){return native('uniformMatrix4fv',this,args);}
      bindBuffer(...args){return native('bindBuffer',this,args);}
      bindBufferBase(...args){return native('bindBufferBase',this,args);}
      bindBufferRange(...args){return native('bindBufferRange',this,args);}
      bindVertexArray(...args){return native('bindVertexArray',this,args);}
      deleteVertexArray(...args){return native('deleteVertexArray',this,args);}
      deleteBuffer(...args){return native('deleteBuffer',this,args);}
      bufferData(...args){return native('bufferData',this,args);}
      bufferSubData(...args){return native('bufferSubData',this,args);}
      copyBufferSubData(...args){return native('copyBufferSubData',this,args);}
      readPixels(...args){return native('readPixels',this,args);}
      beginTransformFeedback(...args){return native('beginTransformFeedback',this,args);}
      pauseTransformFeedback(...args){return native('pauseTransformFeedback',this,args);}
      resumeTransformFeedback(...args){return native('resumeTransformFeedback',this,args);}
      endTransformFeedback(...args){return native('endTransformFeedback',this,args);}
      drawElements(...args){if(this!==gl)throw sentinel;return native('drawElements',this,args,nativeResult);}
      drawArrays(...args){native('drawArrays',this,args);if(this.fail)throw sentinel;}
      flush(...args){return native('flush',this,args);}
      get doNotRead(){throw Error('accessor read');}
    }
    globalThis.gl = new GL();
    class Canvas {
      constructor(id){this.id=id;this.events=new Map();}
      getContext(...args){return native('getContext',this,args,gl);}
      addEventListener(name,fn){this.events.set(name,fn);}
      removeEventListener(name,fn){if(this.events.get(name)===fn)this.events.delete(name);}
    }
    globalThis.HTMLCanvasElement = Canvas;
    globalThis.canvas = new Canvas('game');
    globalThis.oldGetContext = Canvas.prototype.getContext;
    globalThis.oldDraw = gl.drawElements;
    globalThis.handle = (${installGlCommandCensus.toString()})(${JSON.stringify(options)});
    canvas.getContext('webgl2');
    globalThis.programA = {}, globalThis.programB = {};
    gl.useProgram(programA);
    globalThis.locationA = gl.getUniformLocation(programA,'lights[0].color');
    globalThis.locationB = gl.getUniformLocation(programB,'modelMatrix');
    globalThis.begin = () => emit('keydown',{isTrusted:true,code:'KeyW'});
    globalThis.end = () => emit('keyup',{isTrusted:true,code:'KeyW'});
  `, context);
  return {context, run: source => vm.runInContext(source, context),
    snapshot: () => JSON.parse(vm.runInContext('JSON.stringify(handle.snapshot())', context))};
}

test('records only genuine held-input calls and does not create GL work or animation callbacks', () => {
  const f = fixture();
  assert.equal(f.run('calls.length'), 4);
  f.run(`emit('keydown',{isTrusted:false,code:'KeyW'});gl.flush();emit('keydown',{isTrusted:true,code:'KeyA'});gl.flush();`);
  assert.equal(f.snapshot().totalCalls, 0);
  f.run(`begin();now=12;gl.drawArrays(4,0,3);gl.flush();begin();now=14;end();gl.drawArrays(4,0,3);begin();`);
  const r = f.snapshot();
  assert.equal(r.phase, 'stopped'); assert.equal(r.firstWDownMs, 10); assert.equal(r.lastWUpMs, 14);
  assert.equal(r.totalCalls, 2); assert.equal(r.totals.drawCalls, 1);
  assert.equal(r.windows.length, 1); assert.equal(r.windows[0].closedBy, 'observed-original-flush');
  assert.deepEqual(r.windows[0].methods, {drawArrays: 1, flush: 1});
  assert.equal(f.run(`calls.filter(c=>c.name==='getError').length`), 0);
  assert.equal(f.run('typeof requestAnimationFrame'), 'undefined');
});

test('preserves original receiver, arguments, return values and thrown exception identities', () => {
  const f = fixture();
  f.run('begin();globalThis.args=[4,6,5123,0];globalThis.result=gl.drawElements(...args);');
  assert.equal(f.run('result===nativeResult'), true);
  assert.equal(f.run('calls.at(-1).receiver===gl'), true);
  assert.equal(f.run('calls.at(-1).args.every((v,i)=>v===args[i])'), true);
  f.run(`globalThis.thrown=null;gl.fail=true;try{gl.drawArrays(4,0,3);}catch(error){thrown=error;}`);
  assert.equal(f.run('thrown===sentinel'), true);
  f.run(`globalThis.borrowed=null;try{gl.drawElements.call({},4,3,5123,0);}catch(error){borrowed=error;}`);
  assert.equal(f.run('borrowed===sentinel'), true);
  const r = f.snapshot();
  assert.equal(r.totalCalls, 2); assert.equal(r.thrownCalls, 1); assert.equal(r.methods.drawArrays.thrown, 1);
  assert.equal(f.run(`calls.filter(c=>c.name==='drawArrays').length`), 1);
});

test('uniform receipts compare copied typed values, offsets, names and program identity', () => {
  const f = fixture();
  f.run(`begin();globalThis.values=new Float32Array([9,1,2,3,8]);
    gl.uniform3fv(locationA,values,1,3);gl.uniform3fv(locationA,values,1,3);
    values[2]=7;gl.uniform3fv(locationA,values,1,3);gl.uniform3fv(locationA,values,1,3);
    gl.useProgram(programB);gl.uniform3fv(locationA,values,1,3);gl.flush();end();`);
  const r = f.snapshot();
  assert.equal(r.totals.uniformCalls, 5); assert.equal(r.totals.sameUniformValues, 2);
  assert.equal(r.uniformLocationsBySameValues[0].name, 'lights[0].color');
  assert.equal(r.examples[0].scalarCount, 3);
  assert.equal(r.programTransitions[0].transition, '1>2');
});

test('scalar and matrix comparison retains signed zero, transpose and relink differences', () => {
  const f = fixture();
  f.run(`begin();gl.uniform1f(locationA,-0);gl.uniform1f(locationA,0);gl.uniform1f(locationA,0);
    globalThis.matrix=new Float32Array(16);gl.uniformMatrix4fv(locationB,false,matrix);
    gl.uniformMatrix4fv(locationB,true,matrix);gl.uniformMatrix4fv(locationB,true,matrix);
    gl.linkProgram(programA);gl.uniform1f(locationA,0);end();`);
  const r = f.snapshot();
  assert.equal(r.totals.sameUniformValues, 2);
  assert.equal(r.methods.linkProgram.calls, 1);
});

test('unexamined writes invalidate the comparison cache and ordinary arrays are not read twice', () => {
  const f = fixture({limits: {uniformScalarsPerCall: 4}});
  f.run(`begin();globalThis.small=new Float32Array([1,2,3]);gl.uniform3fv(locationA,small);
    gl.uniform3fv(locationA,new Float32Array(9));gl.uniform3fv(locationA,small);
    globalThis.reads=0;globalThis.normal=[1,2,3];Object.defineProperty(normal,0,{get(){reads++;return 1;}});
    gl.uniform3fv(locationA,normal);gl.uniform3fv(locationA,small);end();`);
  const r = f.snapshot();
  assert.equal(r.totals.sameUniformValues, 0); assert.equal(r.totals.unexaminedUniformCalls, 2);
  assert.equal(f.run('reads'), 0);
});

test('typed-array metadata is read through intrinsic getters without invoking application accessors', () => {
  const f = fixture();
  f.run(`globalThis.reads=0;globalThis.values=new Float32Array([1,2,3]);
    for(const key of ['length','BYTES_PER_ELEMENT','buffer','byteOffset','byteLength'])Object.defineProperty(values,key,{get(){reads++;throw Error('application getter');}});
    globalThis.bytes=new Uint8Array([4,5,6]);
    for(const key of ['length','BYTES_PER_ELEMENT','buffer','byteOffset','byteLength'])Object.defineProperty(bytes,key,{get(){reads++;throw Error('application getter');}});
    gl.bindBuffer(0x8892,{});begin();gl.uniform3fv(locationA,values);gl.uniform3fv(locationA,values);
    gl.bufferSubData(0x8892,0,bytes);gl.bufferSubData(0x8892,0,bytes);end();`);
  const r = f.snapshot();
  assert.equal(f.run('reads'), 0); assert.deepEqual(r.errors, []);
  assert.equal(r.totals.sameUniformValues, 1); assert.equal(r.totals.sameUploadBytes, 1);
});

test('raw ArrayBuffer byteLength overrides are not replayed and shared views remain unexamined', () => {
  const f = fixture();
  f.run(`globalThis.reads=0;globalThis.raw=new ArrayBuffer(4);Object.defineProperty(raw,'byteLength',{get(){reads++;throw Error('application getter');}});
    gl.bindBuffer(0x8892,{});begin();gl.bufferData(0x8892,raw,0x88e8);gl.bufferData(0x8892,raw,0x88e8);
    gl.uniform3fv(locationA,new Float32Array(new SharedArrayBuffer(12)));end();`);
  const r = f.snapshot();
  assert.equal(f.run('reads'), 0); assert.deepEqual(r.errors, []);
  assert.equal(r.totals.sameUploadBytes, 1); assert.equal(r.totals.unexaminedUniformCalls, 1);
});

test('buffer receipts resolve VAO element bindings and compare bounded source slices', () => {
  const f = fixture();
  f.run(`globalThis.a={},globalThis.b={},globalThis.vaoA={},globalThis.vaoB={};
    gl.bindVertexArray(vaoA);gl.bindBuffer(0x8893,a);gl.bindVertexArray(vaoB);gl.bindBuffer(0x8893,b);
    begin();globalThis.bytes=new Uint16Array([9,1,2,8]);
    gl.bufferSubData(0x8893,4,bytes,1,2);gl.bufferSubData(0x8893,4,bytes,1,2);
    gl.bindVertexArray(vaoA);gl.bufferSubData(0x8893,4,bytes,1,2);
    bytes[2]=5;gl.bufferSubData(0x8893,4,bytes,1,2);end();`);
  const r = f.snapshot();
  assert.equal(r.totals.sameUploadBytes, 1); assert.equal(r.totals.uploadedSourceBytes, 16);
  assert.equal(r.examples[0].bufferId, 2); assert.equal(r.examples[0].byteLength, 4);
  assert.equal(r.buffersByBytes.length, 2);
  assert.equal(r.buffersByBytes[0].ranges[0].sourceByteOffset, 2);
});

test('allocation, oversized writes, copies and transform feedback invalidate byte comparisons', () => {
  const f = fixture({limits: {uploadBytesPerCall: 8}});
  f.run(`globalThis.bufferA={};gl.bindBuffer(0x8892,bufferA);begin();globalThis.bytes=new Uint8Array([1,2,3]);
    gl.bufferSubData(0x8892,0,bytes);gl.bufferSubData(0x8892,0,new Uint8Array(9));gl.bufferSubData(0x8892,0,bytes);
    gl.copyBufferSubData(0x8892,0x8892,0,0,3);gl.bufferSubData(0x8892,0,bytes);
    gl.beginTransformFeedback(4);gl.drawArrays(4,0,3);gl.endTransformFeedback();gl.bufferSubData(0x8892,0,bytes);
    gl.bufferData(0x8892,64,0x88e8);gl.bufferSubData(0x8892,0,bytes);end();`);
  const r = f.snapshot();
  assert.equal(r.totals.sameUploadBytes, 0); assert.equal(r.totals.allocationBytes, 64);
  assert.equal(r.totals.unexaminedUploadCalls, 1);
});

test('counts extension draws returned by original getExtension without extra extension requests', () => {
  const f = fixture();
  f.run(`globalThis.ext=gl.getExtension('WEBGL_multi_draw');begin();globalThis.result=ext.multiDrawElementsWEBGL(4,[3],0,5123,[0],0,1);end();`);
  const r = f.snapshot();
  assert.equal(r.methods['ext:WEBGL_multi_draw.multiDrawElementsWEBGL'].calls, 1);
  assert.equal(r.totals.drawCalls, 1); assert.equal(f.run('result===nativeResult'), true);
  assert.equal(f.run('calls.at(-1).receiver===extension'), true);
  assert.equal(f.run(`calls.filter(c=>c.name==='getExtension').length`), 1);
});

test('bound exhaustion is explicit while all original calls continue', () => {
  const f = fixture({limits: {calls: 3, windows: 1}});
  f.run('begin();gl.flush();gl.flush();gl.flush();gl.flush();gl.flush();end();');
  const r = f.snapshot();
  assert.equal(r.totalCalls, 3); assert.equal(r.windows.length, 1);
  assert.equal(r.limitHits.windows, 2); assert.equal(r.limitHits.calls, 1);
  assert.equal(f.run(`calls.filter(c=>c.name==='flush').length`), 5);
  assert.equal(r.phase, 'stopped');
});

test('trusted W-up freezes identity and shader receipts while subsequent native calls still execute', () => {
  const f = fixture();
  f.run(`globalThis.shader={};gl.shaderSource(shader,'held source');gl.attachShader(programA,shader);begin();gl.drawArrays(4,0,3);end();`);
  const before = f.snapshot(), nativeBefore = f.run('calls.length');
  f.run(`gl.shaderSource(shader,'post-keyup-menu-source');gl.useProgram({});gl.bindBuffer(0x8892,{});gl.flush();`);
  assert.deepEqual(f.snapshot(), before); assert.equal(f.run('calls.length'), nativeBefore + 4);
});

test('context loss and failed hooks remain explicit evidence failures', () => {
  const f = fixture();
  f.run(`begin();canvas.events.get('webglcontextlost')();end();`);
  assert.match(f.snapshot().errors[0], /context lost/);
  assert.equal(f.snapshot().hooks.every(row => row.status === 'installed'), true);
});

test('cleanup restores descriptors and preserves a later wrapper', () => {
  const f = fixture();
  f.run(`globalThis.censusDraw=gl.drawElements;globalThis.later=function(...args){return censusDraw.apply(this,args);};gl.drawElements=later;handle.dispose();`);
  assert.equal(f.run('HTMLCanvasElement.prototype.getContext===oldGetContext'), true);
  assert.equal(f.run('gl.drawElements===later'), true);
  assert.equal(f.run('Object.hasOwn(gl,"flush")'), false);
  assert.equal(f.run('typeof __belleCommandCensus'), 'undefined');
  assert.equal(f.run('gl.drawElements(4,3,5123,0)===nativeResult'), true);
});

test('cleanup never invokes accessors installed after the observer', () => {
  const f = fixture();
  f.run(`globalThis.reads=0;globalThis.laterGetter=()=>{reads++;throw Error('later getter');};
    Object.defineProperty(gl,'flush',{configurable:true,get:laterGetter});
    Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{configurable:true,get:laterGetter});
    Object.defineProperty(window,'__belleCommandCensus',{configurable:true,get:laterGetter});handle.dispose();`);
  assert.equal(f.run('reads'), 0);
  assert.equal(f.run(`Object.getOwnPropertyDescriptor(gl,'flush').get===laterGetter`), true);
  assert.equal(f.run(`Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'getContext').get===laterGetter`), true);
  assert.deepEqual(f.snapshot().errors, []);
});

test('arbitrary binding enums cannot grow retained maps before capture or after the call bound', () => {
  const f = fixture({limits: {calls: 3, buffers: 1}});
  f.run(`globalThis.bufferA={};for(let i=0;i<1000;i++)gl.bindBuffer(90000+i,bufferA);
    begin();for(let i=0;i<20;i++)gl.bindBuffer(100000+i,bufferA);end();`);
  const r = f.snapshot();
  assert.equal(r.retainedBindings.generic, 0); assert.equal(r.retainedBindings.elementArray, 0);
  assert.equal(r.limitHits.untrackedBufferTarget, 1020); assert.equal(r.totalCalls, 3);
  assert.equal(f.run(`calls.filter(c=>c.name==='bindBuffer').length`), 1020);
});
