import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installPipelineCensus} from './pipeline-state-census.mjs';

const methods = `createBuffer createVertexArray createProgram createShader createTexture createFramebuffer createRenderbuffer
deleteBuffer deleteVertexArray deleteProgram deleteShader deleteTexture deleteFramebuffer deleteRenderbuffer
bindVertexArray bindBuffer bufferData enableVertexAttribArray disableVertexAttribArray vertexAttribPointer vertexAttribIPointer vertexAttribDivisor
vertexAttrib1f vertexAttrib2f vertexAttrib3f vertexAttrib4f vertexAttrib1fv vertexAttrib2fv vertexAttrib3fv vertexAttrib4fv vertexAttribI4i vertexAttribI4ui vertexAttribI4iv vertexAttribI4uiv
useProgram attachShader detachShader shaderSource linkProgram getProgramParameter getActiveAttrib getAttribLocation getActiveUniform getUniformLocation getContextAttributes getParameter
enable disable blendEquation blendEquationSeparate blendFunc blendFuncSeparate colorMask blendColor polygonOffset sampleCoverage depthFunc depthMask cullFace frontFace
stencilFunc stencilFuncSeparate stencilOp stencilOpSeparate stencilMask stencilMaskSeparate bindFramebuffer drawBuffers bindRenderbuffer renderbufferStorage renderbufferStorageMultisample
framebufferRenderbuffer framebufferTexture2D framebufferTextureLayer activeTexture bindTexture texStorage2D texStorage3D texImage2D texImage3D compressedTexImage2D compressedTexImage3D
drawArrays drawElements drawRangeElements drawArraysInstanced drawElementsInstanced getExtension`.split(/\s+/);

function harness(options) {
  const calls = [], queue = [], failures = new Map(), events = new Map(), responses = new Map(); let objectId = 0;
  const extension = Object.fromEntries(['multiDrawArraysWEBGL', 'multiDrawElementsWEBGL', 'multiDrawArraysInstancedWEBGL', 'multiDrawElementsInstancedWEBGL'].map(name => [name, function(...args) {
    calls.push({name, receiver:this, args}); if(failures.has(name))throw failures.get(name); return 'native-' + name;
  }]));
  const gl = Object.fromEntries(methods.map(name => [name, function(...args) {
    calls.push({name, receiver:this, args}); if(failures.has(name))throw failures.get(name);
    if(responses.has(name))return responses.get(name)(args);
    if(name.startsWith('create'))return {nativeObject:++objectId};
    if(name==='getExtension')return args[0]==='WEBGL_multi_draw'?extension:null;
    if(name==='getContextAttributes')return {antialias:true,depth:true,stencil:false,alpha:true};
    if(name==='getParameter')return args[0]===32937?4:16;
    return 'native-' + name;
  }]));
  class Canvas {
    constructor(id='game'){this.id=id;}
    getContext(...args){calls.push({name:'getContext',receiver:this,args});return args[0]==='webgl2'?gl:null;}
    addEventListener(name,callback){events.set(name,callback);}
  }
  const originalContext=Canvas.prototype.getContext, originalDraw=gl.drawArrays;
  const sandbox={HTMLCanvasElement:Canvas,requestAnimationFrame(callback){queue.push(callback);return queue.length;}};
  vm.runInNewContext(`(${installPipelineCensus.toString()})(${options===undefined?'undefined':JSON.stringify(options)})`,sandbox);
  const canvas=new Canvas();
  function frame(callback,time=12){sandbox.requestAnimationFrame(callback);return queue.shift().call(canvas,time);}
  function createProgram(inputs=[{name:'position',size:1,type:35665,location:0}]){
    const p=gl.createProgram(),v=gl.createShader(35633),f=gl.createShader(35632);
    gl.shaderSource(v,'attribute vec3 position; void main(){gl_Position=vec4(position,1.);}');
    gl.shaderSource(f,'precision highp float; void main(){gl_FragColor=vec4(1.);}');
    gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
    responses.set('getProgramParameter',args=>args[1]===35721?inputs.length:args[1]===35714?true:0);
    responses.set('getActiveAttrib',args=>inputs[args[1]]);
    responses.set('getAttribLocation',args=>inputs.find(v=>v.name===args[1])?.location??-1);
    gl.getProgramParameter(p,35714);gl.getProgramParameter(p,35721);
    for(let i=0;i<inputs.length;i++){const info=gl.getActiveAttrib(p,i);gl.getAttribLocation(p,info.name);}
    gl.useProgram(p);return p;
  }
  function array(location=0,{stride=12,offset=0,divisor=0,size=3}={}){
    const b=gl.createBuffer();gl.bindBuffer(34962,b);gl.bufferData(34962,4096,35044);
    gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,5126,false,stride,offset);gl.vertexAttribDivisor(location,divisor);return b;
  }
  const api=Object.fromEntries(['start','stop','snapshot','dispose'].map(name=>[name,()=>JSON.parse(JSON.stringify(sandbox.__bellePipelineCensus[name]()))]));
  return {sandbox,canvas,gl,extension,calls,queue,failures,events,responses,frame,createProgram,array,originalContext,originalDraw,api};
}

test('serialized init observes context birth without any added GL calls and forwards results/receivers/arguments',()=>{
  const h=harness();assert.equal(h.calls.length,0);
  const options={antialias:true,depth:true};assert.equal(h.canvas.getContext('webgl2',options),h.gl);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].args[1],options);
  assert(h.api.snapshot().coverage.every(c=>c.status==='installed'));
  h.gl.getContextAttributes();h.gl.getParameter(32937);h.createProgram();h.array();
  const before=h.calls.length;h.api.start();assert.equal(h.calls.length,before);
  let result;h.frame(function(){assert.equal(this,h.canvas);result=h.gl.drawArrays(4,0,3);});
  assert.equal(result,'native-drawArrays');const report=h.api.stop();assert.equal(h.calls.length,before+1);
  assert.equal(report.frames[0].draws[0].returned,true);assert.equal(report.context.samples,4);
  assert.equal(report.programs[0].activeAttributes[0].location,0);assert.equal(report.shaderSources.length,2);
  assert.equal(report.stats.observerErrors,0);assert.equal(report.totals.requests,1);
  const native=h.calls.at(-1);assert.equal(native.receiver,h.gl);assert.deepEqual(native.args,[4,0,3]);
});

test('descriptor-like layout excludes buffer/VAO identities and pointer offsets but retains raw bindings',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.createProgram();h.api.start();
  h.frame(()=>{
    h.gl.bindVertexArray(h.gl.createVertexArray());h.array(0,{offset:0});h.gl.drawArrays(4,0,3);
    h.gl.bindVertexArray(h.gl.createVertexArray());h.array(0,{offset:24});h.gl.drawArrays(4,0,3);
    h.array(5,{stride:16,size:4});h.gl.drawArrays(4,0,3);
  });
  const r=h.api.stop(),rows=r.frames[0].draws;
  assert.equal(r.layouts.length,1);assert.equal(r.groups.length,1);assert.equal(r.bindings.length,2);
  assert.notEqual(rows[0].vaoId,rows[1].vaoId);assert.notEqual(rows[0].bindingId,rows[1].bindingId);
  assert.equal(r.bindings[rows[1].bindingId].attributes[0].pointer.offset,24);
  assert.equal(r.layouts[0].attributes[0].descriptorOffset,0);
  assert.equal(r.layouts[0].attributes[0].descriptorSlot,'kVboBindingIndexStart+0');
  assert.deepEqual(r.layouts[0].uncertainty,[]);
});

test('matrix columns, divisors, disabled defaults and fixed output state form distinct measured axes',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.createProgram([{name:'instanceMatrix',size:1,type:35676,location:2}]);
  for(let i=0;i<4;i++)h.array(2+i,{size:4,stride:64,offset:i*16,divisor:1});
  h.api.start();h.frame(()=>{
    h.gl.drawArraysInstanced(4,0,3,5);
    h.gl.disableVertexAttribArray(3);h.gl.vertexAttrib4f(3,1,2,3,4);h.gl.drawArraysInstanced(4,0,3,5);
    h.gl.enable(32926);h.gl.enable(3042);h.gl.blendFuncSeparate(770,771,1,771);h.gl.colorMask(true,false,true,true);h.gl.drawArraysInstanced(4,0,3,5);
  });
  const r=h.api.stop();assert.equal(r.layouts.length,2);assert.equal(r.groups.length,3);
  assert.equal(r.layouts[0].attributes.length,4);assert.deepEqual(r.layouts[0].attributes.map(a=>a.stepRate),[1,1,1,1]);
  assert(r.layouts[0].attributes.every(a=>a.descriptorOffset===0));
  const fallback=r.layouts[1].attributes.find(a=>a.location===3);assert.equal(fallback.enabled,false);assert.equal(fallback.descriptorOffset,'3*kDefaultAttributeSize');
  assert.deepEqual(r.bindings[1].attributes[1].generic.value,[1,2,3,4]);
  assert.equal(r.states.at(-1).axes.alphaToCoverageRequested,true);assert.deepEqual(r.states.at(-1).axes.output.color[0].blend.mask,[true,false,true,true]);
});

test('native setter/draw exceptions and foreign receivers preserve exact semantics and do not invent successful state',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.createProgram();h.array();h.api.start();
  const sentinel={native:'exception'};h.failures.set('vertexAttribDivisor',sentinel);
  assert.throws(()=>h.gl.vertexAttribDivisor(0,7),e=>e===sentinel);h.failures.delete('vertexAttribDivisor');
  const foreign={};assert.equal(h.gl.useProgram.call(foreign,null),'native-useProgram');
  h.failures.set('drawArrays',sentinel);assert.throws(()=>h.frame(()=>h.gl.drawArrays(4,0,3)),e=>e===sentinel);
  const r=h.api.stop();assert.equal(r.layouts[0].attributes[0].step,'vertex');assert.equal(r.frames[0].draws[0].returned,false);
  assert.equal(r.frames[0].complete,false);assert.equal(r.stats.nativeThrows,2);assert.equal(r.stats.foreignReceiverCalls,1);
  assert.equal(r.totals.thrownRequests,1);assert(r.frames[0].draws[0].programId>0);
});

test('all four WEBGL_multi_draw methods retain offset slices and native extension receiver without core-draw substitution',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.createProgram();h.array();
  const e=h.gl.getExtension('WEBGL_multi_draw');assert.equal(e,h.extension);
  const firsts=new Int32Array([99,2,5,99]),counts=new Int32Array([99,3,6,99]),offsets=new Int32Array([99,8,20,99]),instances=new Int32Array([99,2,4,99]);
  h.api.start();const before=h.calls.length;h.frame(()=>{
    assert.equal(e.multiDrawArraysWEBGL(4,firsts,1,counts,1,2),'native-multiDrawArraysWEBGL');
    e.multiDrawElementsWEBGL(4,counts,1,5123,offsets,1,2);
    e.multiDrawArraysInstancedWEBGL(4,firsts,1,counts,1,instances,1,2);
    e.multiDrawElementsInstancedWEBGL(4,counts,1,5123,offsets,1,instances,1,2);
  });
  firsts[1]=888;const r=h.api.stop();assert.equal(h.calls.length,before+4);
  assert.equal(r.totals.extensionRequests,4);assert.equal(r.totals.requestedSubdraws,8);
  const rows=r.frames[0].draws;assert.deepEqual(rows[0].draw.firsts,[2,5]);assert.deepEqual(rows[1].draw.offsets,[8,20]);
  assert.deepEqual(rows[2].draw.instances,[2,4]);assert.deepEqual(rows[3].draw.counts,[3,6]);
  assert(rows.every(row=>row.extension&&row.returned));assert(h.calls.slice(-4).every(call=>call.receiver===e));
  assert.equal(h.calls.at(-1).args[1],counts);assert.equal(h.calls.at(-1).args[4],offsets);
});

test('state is tracked outside capture and callbacks are sampled completely with explicit bounded overflow',()=>{
  const h=harness({sampleEvery:2,maxFrames:2,maxDrawsPerFrame:2,maxSubdraws:2});h.canvas.getContext('webgl2');h.createProgram();h.array();
  const e=h.gl.getExtension('WEBGL_multi_draw');h.gl.vertexAttribDivisor(0,2);h.api.start();
  h.frame(()=>{h.gl.drawArrays(4,0,3);h.gl.drawArrays(4,3,3);h.gl.drawArrays(4,6,3);},10);
  h.frame(()=>h.gl.drawArrays(4,0,3),20);
  h.frame(()=>e.multiDrawArraysWEBGL(4,new Int32Array([0,3,6]),0,new Int32Array([3,3,3]),0,3),30);
  h.frame(()=>h.gl.drawArrays(4,0,3),40);h.frame(()=>h.gl.drawArrays(4,0,3),50);
  const r=h.api.stop();assert.deepEqual(r.frames.map(f=>f.number),[1,3]);assert.equal(r.frames[0].draws.length,2);
  assert.equal(r.frames[0].complete,false);assert.equal(r.frames[1].complete,false);assert.equal(r.totals.droppedDraws,1);
  assert.equal(r.totals.droppedFrames,1);assert.equal(r.totals.droppedSubdraws,2);assert.equal(r.layouts[0].attributes[0].stepRate,2);
  assert.equal(r.totals.requests,7);assert.equal(r.totals.returnedRequests,7);
});

test('framebuffer formats and sample requests use existing allocation calls, while deleted active framebuffer returns to default',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.gl.getContextAttributes();h.gl.getParameter(32937);h.createProgram();h.array();
  const framebuffer=h.gl.createFramebuffer(),renderbuffer=h.gl.createRenderbuffer();h.gl.bindFramebuffer(36160,framebuffer);
  h.gl.bindRenderbuffer(36161,renderbuffer);h.gl.renderbufferStorageMultisample(36161,4,32856,32,32);h.gl.framebufferRenderbuffer(36160,36064,36161,renderbuffer);
  h.api.start();h.frame(()=>{h.gl.drawArrays(4,0,3);h.gl.deleteFramebuffer(framebuffer);h.gl.drawArrays(4,0,3);});
  const r=h.api.stop();assert.equal(r.states[0].axes.output.color[0].attachment.format,32856);assert.equal(r.states[0].axes.output.color[0].attachment.samples,4);
  assert.equal(r.states[0].axes.output.defaultFramebuffer,false);assert.equal(r.states[1].axes.output.defaultFramebuffer,true);assert.equal(r.states[1].axes.output.observedGlSamples,4);
});

test('context loss stops capture, restoration cannot silently resume, and disposal restores owned methods only',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.createProgram();h.array();h.api.start();h.frame(()=>h.gl.drawArrays(4,0,3));
  h.events.get('webglcontextlost')();h.frame(()=>h.gl.drawArrays(4,0,3));assert.equal(h.api.snapshot().active,false);
  h.events.get('webglcontextrestored')();assert.throws(()=>h.api.start(),/live context/);
  const replacement=()=>42;h.gl.depthMask=replacement;const r=h.api.dispose();
  assert.equal(r.stats.contextLosses,1);assert.equal(r.stats.contextRestores,1);assert.equal(r.totals.requests,1);
  assert.equal(h.gl.drawArrays,h.originalDraw);assert.equal(h.gl.depthMask,replacement);assert.equal(h.sandbox.HTMLCanvasElement.prototype.getContext,h.originalContext);
});

test('multisampled-render-to-texture extension setters preserve attachment-specific samples and original return values',()=>{
  const h=harness();h.canvas.getContext('webgl2');h.createProgram();h.array();
  const ext={framebufferTexture2DMultisampleEXT(...args){h.calls.push({name:'rtt-attach',receiver:this,args});return 71;},renderbufferStorageMultisampleEXT(...args){h.calls.push({name:'rtt-storage',receiver:this,args});return 72;}};
  h.responses.set('getExtension',()=>ext);assert.equal(h.gl.getExtension('WEBGL_multisampled_render_to_texture'),ext);
  const texture=h.gl.createTexture(),framebuffer=h.gl.createFramebuffer(),renderbuffer=h.gl.createRenderbuffer();
  h.gl.bindTexture(3553,texture);h.gl.texStorage2D(3553,1,32856,32,32);h.gl.bindFramebuffer(36160,framebuffer);
  assert.equal(ext.framebufferTexture2DMultisampleEXT(36160,36064,3553,texture,0,4),71);
  h.gl.bindRenderbuffer(36161,renderbuffer);assert.equal(ext.renderbufferStorageMultisampleEXT(36161,4,33190,32,32),72);
  h.gl.framebufferRenderbuffer(36160,36096,36161,renderbuffer);h.api.start();h.frame(()=>h.gl.drawArrays(4,0,3));
  const r=h.api.stop(),output=r.states[0].axes.output;
  assert.equal(output.color[0].attachment.samples,4);assert.equal(output.depth.samples,4);assert.equal(output.depth.format,33190);
  assert.equal(r.stats.observerErrors,0);assert(r.coverage.every(c=>c.status==='installed'));
  assert(h.calls.filter(c=>c.name.startsWith('rtt-')).every(c=>c.receiver===ext));
});

test('shader source limits are explicit and non-game contexts remain untouched',()=>{
  const h=harness({maxSourceChars:16,maxTotalSourceChars:24});const other=new h.sandbox.HTMLCanvasElement('preview');other.getContext('webgl2');
  assert.equal(h.gl.drawArrays,h.originalDraw);assert.equal(h.api.snapshot().context,null);
  h.canvas.getContext('webgl2');h.createProgram();const r=h.api.snapshot();
  assert.equal(r.sourceChars,24);assert.equal(r.stats.sourceTruncations,2);assert(r.shaderSources.every(s=>s.truncated));
});

test('outside-RAF work is retained separately without advancing the draw-bearing callback sampling cadence',()=>{
  const h=harness({sampleEvery:2});h.canvas.getContext('webgl2');h.createProgram();h.array();h.api.start();
  h.gl.drawArrays(4,0,3);h.frame(()=>h.gl.drawArrays(4,0,3));h.frame(()=>h.gl.drawArrays(4,0,3));h.frame(()=>h.gl.drawArrays(4,0,3));
  const r=h.api.stop();assert.equal(r.totals.outsideRafRequests,1);assert.equal(r.totals.drawBearingCallbacks,3);
  assert.deepEqual(r.frames.map(f=>f.callbackNumber),[null,1,3]);assert.deepEqual(r.frames.map(f=>f.boundary),['outside-requestAnimationFrame','requestAnimationFrame','requestAnimationFrame']);
});
