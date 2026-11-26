import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {build} from 'esbuild';
import {Matrix4,Vector4} from 'three';
import {transformThreeShadowUniform,threeShadowUniformVitePlugin,threeShadowUniformEsbuildPlugin,THREE_SHADOW_UNIFORM_PINS,THREE_SHADOW_UNIFORM_MARKER} from './three-shadow-uniform-transform.mjs';

const game=resolve(import.meta.dirname,'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
// The production guard captures the real platform prototype at module evaluation.
// Model that ordinary native ownership here without a proof-only trust bypass.
const nativeFixtures=new WeakMap();
class MockWebGL2RenderingContext {
 uniformMatrix4fv(address,transpose,data){
  const f=nativeFixtures.get(this);assert(f,'Expected registered native context');
  assert.equal(arguments.length,3);assert.equal(transpose,false);
  f.calls.push({address,transpose,data,values:Array.from(data)});
  if(f.nativeError)throw f.nativeError;
  address.program.values.set(address.name,Array.from(data));return 42;
 }
 uniform4fv(address,data){
  const f=nativeFixtures.get(this);assert(f,'Expected registered native context');
  f.calls.push({address,data,values:Array.from(data)});address.program.values.set(address.name,Array.from(data));
 }
}
const originalWebGL2=Object.getOwnPropertyDescriptor(globalThis,'WebGL2RenderingContext');
Object.defineProperty(globalThis,'WebGL2RenderingContext',{value:MockWebGL2RenderingContext,writable:true,configurable:true});
test.after(()=>{if(originalWebGL2)Object.defineProperty(globalThis,'WebGL2RenderingContext',originalWebGL2);else delete globalThis.WebGL2RenderingContext;});
const sources=await Promise.all(['build/three.module.js','src/renderers/webgl/WebGLUniforms.js'].map(async name=>{
 const path=resolve(game,'node_modules/three',name),source=await readFile(path,'utf8');
 const transformed=transformThreeShadowUniform(source,path,{enabled:true,proof:true});
 const compiled=await build({stdin:{contents:transformed.code+'\nexport { WebGLUniforms as __testWebGLUniforms };',sourcefile:path,resolveDir:dirname(path)},bundle:true,write:false,format:'esm',platform:'node',target:'es2022',logLevel:'error'});
 const module=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
 return {name,path,source,transformed,module};
}));

test('only explicitly enabled exact reviewed Three inputs can be transformed',()=>{
 for(const {name,path,source,transformed}of sources){
  assert.equal(hash(source),THREE_SHADOW_UNIFORM_PINS[name]);
  assert.equal(transformThreeShadowUniform(source,path),null);
  assert.equal(transformThreeShadowUniform(source,path,{proof:true}),null);
  assert.equal(transformThreeShadowUniform(source,'/unrelated/WebGLUniforms.js',{enabled:true}),null);
  assert.throws(()=>transformThreeShadowUniform(source+'\n',path,{enabled:true}),/Unreviewed Three/);
  assert.throws(()=>transformThreeShadowUniform(transformed.code,path,{enabled:true,proof:true}),/Unreviewed Three/);
  assert.equal(transformed.receipt.module,name);assert.equal(transformed.receipt.marker,THREE_SHADOW_UNIFORM_MARKER);
  assert.equal(transformed.receipt.outputSha256,hash(transformed.code));
  assert.deepEqual(transformed.receipt.replacements,{runtime:1,pureArrayConstructor:1,parserContext:1,exactShadowArray:1,reflectedContext:1,proofExport:1});
  const production=transformThreeShadowUniform(source,path,{enabled:true});
  assert.equal(production.receipt.candidateSetterSha256,transformed.receipt.candidateSetterSha256,'Measured candidate body must equal production candidate body');
  assert(!production.code.includes('export { belleUniformArrayControl as __belleUniformArrayProofControl }'));
  const originalSetter=source.match(/function setValueM4Array\( gl, v \) \{[\s\S]*?\n\}/)[0];
  assert(production.code.includes(originalSetter),'Stock native setter stays byte-identical');
  assert(!production.code.includes('Reflect.'),'Candidate does not use Reflect-based argument forwarding');
 }
});

test('Vite and esbuild wrappers select the same pinned transformation without modifying dependencies',async()=>{
 const records=[],vite=threeShadowUniformVitePlugin({enabled:true,proof:true,onReceipt:receipt=>records.push(receipt)});
 assert.deepEqual(vite.config(),{optimizeDeps:{exclude:['three']}});
 for(const entry of sources){const result=vite.transform(entry.source,entry.path);assert.equal(result.code,entry.transformed.code);}
 assert.equal(records.length,2);
 const disabled=threeShadowUniformEsbuildPlugin();let registered=false;disabled.setup({onLoad(){registered=true;}});assert.equal(registered,false);
 let handler,filter;
 threeShadowUniformEsbuildPlugin({enabled:true,proof:true}).setup({onLoad(options,callback){handler=callback;filter=options.filter;}});
 for(const entry of sources){assert(filter.test(entry.path));const result=await handler({path:entry.path});assert.equal(result.contents,entry.transformed.code);assert.equal(await readFile(entry.path,'utf8'),entry.source);}
});

const shadow={name:'directionalShadowMatrix[0]',type:0x8b5c,size:1};
function fixture(module,infos=[shadow],mode='inline'){
 const control=module.__belleUniformArrayProofControl;control.setMode(mode);
 const f={calls:[],nativeError:null,program:{infos,values:new Map()}};
 const gl=Object.assign(new MockWebGL2RenderingContext(),{canvas:new EventTarget(),ACTIVE_UNIFORMS:0x8b86,
  getProgramParameter(program,pname){assert.equal(this,gl);assert.equal(pname,gl.ACTIVE_UNIFORMS);return program.infos.length;},
  getActiveUniform(program,index){assert.equal(this,gl);return program.infos[index];},
  getUniformLocation(program,name){assert.equal(this,gl);return {program,name};},
 });
 nativeFixtures.set(gl,f);
 const uniforms=new module.__testWebGLUniforms(gl,f.program);
 Object.assign(f,{gl,uniforms,control,native:gl.uniformMatrix4fv,node:uniforms.map.directionalShadowMatrix,
  set:(value,node=uniforms.map.directionalShadowMatrix)=>node.setValue(gl,value)});
 return f;
}

for(const {name,module}of sources){
 test(name+': original mode is the actual stock setter; inline only caches the named reflected matrix array',()=>{
  const infos=[shadow,{name:'otherMatrix[0]',type:0x8b5c,size:1},{name:'nested.directionalShadowMatrix[0]',type:0x8b5c,size:1},{name:'shipWake[0]',type:0x8b52,size:4}];
  const f=fixture(module,infos,'original'),matrix=[new Matrix4()],stock=f.node.setValue;
  f.set(matrix);f.set(matrix);assert.equal(f.calls.length,2);assert.equal(f.control.read().setterCalls,0);
  f.control.setMode('inline');assert.notEqual(f.node.setValue,stock);assert.equal(f.uniforms.map.otherMatrix.setValue,stock);assert.equal(f.uniforms.map.nested.map.directionalShadowMatrix.setValue,stock);
  for(let i=0;i<4;i++)assert.equal(f.set(matrix),undefined,'Stock setter ignores the native return value');
  assert.equal(f.calls.length,3);const stats=f.control.read();assert.equal(stats.setterCalls,4);assert.equal(stats.nativeCalls,1);assert.equal(stats.skippedCalls,3);assert.equal(stats.fallbackCalls,0);
  f.control.setMode('original');assert.equal(f.node.setValue,stock);f.set(matrix);f.set(matrix);assert.equal(f.calls.length,5);assert.equal(f.control.read().activeUniforms,0);
  f.control.setMode('inline');f.set(matrix);assert.equal(f.calls.length,6,'Re-enabling requires a fresh upload');
 });

 test(name+': every original Matrix4 conversion runs; exact float payload, changes and signed zero decide reuse',()=>{
  const f=fixture(module),matrix=new Matrix4(),convert=matrix.toArray;let conversions=0;
  matrix.toArray=function(...args){conversions++;return convert.apply(this,args);};
  f.set([matrix]);f.set([matrix]);assert.equal(f.calls.length,1);assert.equal(conversions,2);
  matrix.elements[12]=1e-50;f.set([matrix]);assert.equal(f.calls.length,1,'Underflowed Float32 payload unchanged');
  matrix.elements[1]=-0;f.set([matrix]);assert.equal(f.calls.length,2);assert(Object.is(f.calls.at(-1).values[1],-0));
  matrix.elements[1]=0;f.set([matrix]);assert.equal(f.calls.length,3);
  matrix.elements[12]=3.25;f.set([matrix]);assert.equal(f.calls.at(-1).values[12],3.25);assert.equal(conversions,6);
 });

 test(name+': external flat, shared, resizable and malformed storage stays on original native validation',()=>{
  const f=fixture(module),values=Float32Array.from(new Matrix4().elements),payloads=[values,Array.from(values),new Float32Array(new SharedArrayBuffer(64)),new Float32Array(new ArrayBuffer(64,{maxByteLength:128})),new Float32Array(17)];
  for(const value of payloads){value[0]=1;const count=f.calls.length;f.set(value);f.set(value);assert.equal(f.calls.length,count+2);assert.equal(f.calls.at(-1).data,value);}
  const matrix=new Matrix4();matrix.elements[4]=NaN;f.set([matrix]);f.set([matrix]);const count=f.calls.length;
  matrix.elements[4]=Infinity;f.set([matrix]);f.set([matrix]);assert.equal(f.calls.length,count+2);
  matrix.elements[4]=0;f.set([matrix]);f.set([matrix]);assert.equal(f.calls.length,count+3,'Unsupported payload invalidates prior cache');
 });

 test(name+': zero-size and >16 reflected arrays and another reflected type use unmodified setters',()=>{
  for(const size of [0,17]){const f=fixture(module,[{...shadow,size}]);assert.notEqual(f.node.setValue.name,'belleDirectionalShadowMatrixArray');}
  const f=fixture(module,[{...shadow,type:0x8b52,size:1}]);assert.notEqual(f.node.setValue.name,'belleDirectionalShadowMatrixArray');
  const value=[new Vector4(1,2,3,4)];f.set(value);f.set(value);assert.equal(f.calls.length,2);
 });

 test(name+': cache storage never aliases the global flatten scratch and programs stay independent',()=>{
  const f=fixture(module,[shadow,{name:'otherVectors[0]',type:0x8b52,size:4}]),matrix=[new Matrix4()];
  f.set(matrix);const scratch=f.calls[0].data;
  f.set(Array.from({length:4},()=>new Vector4(3,4,5,6)),f.uniforms.map.otherVectors);
  assert.equal(f.calls[1].data,scratch,'Actual Three matrix/vector flatten pool is shared');
  f.set(matrix);assert.equal(f.calls.length,2,'Saved shadow payload was independently copied');
  const program={infos:[shadow],values:new Map()},other=new module.__testWebGLUniforms(f.gl,program).map.directionalShadowMatrix;
  f.set(matrix,other);f.set(matrix,other);assert.equal(f.calls.length,3,'New native location must upload once');
 });

 test(name+': owned typed metadata getters are never replayed and changed prototypes fail closed',()=>{
  const f=fixture(module),matrix=[new Matrix4()];f.set(matrix);const scratch=f.calls[0].data;let reads=0;
  for(const key of ['length','buffer'])Object.defineProperty(scratch,key,{get(){reads++;throw Error('metadata accessor');},configurable:true});
  f.set(matrix);assert.equal(reads,0);assert.equal(f.calls.length,1);
  Object.setPrototypeOf(scratch,Object.create(Float32Array.prototype));f.set(matrix);f.set(matrix);assert.equal(f.calls.length,3);
  Object.setPrototypeOf(scratch,Float32Array.prototype);for(const key of ['length','buffer'])delete scratch[key];
  f.set(matrix);f.set(matrix);assert.equal(f.calls.length,4);
 });

 test(name+': conversion/native/method lookup exceptions preserve identity and invalidate saved state',()=>{
  const f=fixture(module),matrix=new Matrix4(),value=[matrix];f.set(value);f.set(value);const sentinel=Error('native');f.nativeError=sentinel;matrix.elements[12]=1;
  assert.throws(()=>f.set(value),error=>error===sentinel);f.nativeError=null;f.set(value);assert.equal(f.calls.length,3);
  const convert=matrix.toArray;matrix.toArray=()=>{throw sentinel;};assert.throws(()=>f.set(value),error=>error===sentinel);matrix.toArray=convert;f.set(value);assert.equal(f.calls.length,4);
  Object.defineProperty(f.gl,'uniformMatrix4fv',{get(){throw sentinel;},configurable:true});assert.throws(()=>f.set(value),error=>error===sentinel);
  Object.defineProperty(f.gl,'uniformMatrix4fv',{value:f.native,writable:true,configurable:true});f.set(value);assert.equal(f.calls.length,5);
 });

 test(name+': selected method lookup precedes address and is not repeated after address mutation',()=>{
  const f=fixture(module),events=[],address=f.node.addr,matrix=[new Matrix4()];
  const first=function(...args){events.push('first-call');return f.native.apply(this,args);},second=function(...args){events.push('second-call');return f.native.apply(this,args);};
  Object.defineProperty(first,'call',{get(){throw Error('Must not inspect a supplied function.call');}});
  Object.defineProperty(f.gl,'uniformMatrix4fv',{get(){events.push('method');return first;},configurable:true});
  Object.defineProperty(f.node,'addr',{get(){events.push('address');Object.defineProperty(f.gl,'uniformMatrix4fv',{value:second,writable:true,configurable:true});return address;},configurable:true});
  f.set(matrix);assert.deepEqual(events,['method','address','first-call']);
  f.set(matrix);assert.equal(events.at(-1),'second-call');assert.equal(f.calls.length,2);
 });

 test(name+': noncallable methods still evaluate address; address changes cannot retain stale uploads',()=>{
  const f=fixture(module),address=f.node.addr,matrix=[new Matrix4()];let addresses=0;
  Object.defineProperty(f.node,'addr',{get(){addresses++;return address;},configurable:true});f.gl.uniformMatrix4fv=null;
  assert.throws(()=>f.set(matrix),TypeError);assert.equal(addresses,1);f.gl.uniformMatrix4fv=f.native;f.set(matrix);assert.equal(f.calls.length,1);
  const other={...address};Object.defineProperty(f.node,'addr',{value:other,writable:true,configurable:true});f.set(matrix);f.set(matrix);assert.equal(f.calls.length,3);
  f.node.addr=address;f.set(matrix);f.set(matrix);assert.equal(f.calls.length,4);
 });

 test(name+': same-node and cross-node reentry cannot commit a stale scratch payload',()=>{
  const f=fixture(module),outer=new Matrix4(),inner=new Matrix4().makeTranslation(7,8,9);
  const otherProgram={infos:[shadow],values:new Map()},other=new module.__testWebGLUniforms(f.gl,otherProgram).map.directionalShadowMatrix;
  let nested=false,reenter=true;const native=f.native;
  f.gl.uniformMatrix4fv=function(address,transpose,data){
   if(reenter&&!nested){nested=true;const saved=Float32Array.from(data);other.setValue(f.gl,[inner]);native.call(f.gl,address,transpose,data);data.set(saved);nested=false;}
   else native.call(f.gl,address,transpose,data);
  };
  f.set([outer]);assert.equal(f.program.values.get(shadow.name)[12],7,'Outer native operation consumed overwritten scratch before restoration');
  reenter=false;f.set([outer]);assert.equal(f.program.values.get(shadow.name)[12],0,'Same method must freshly upload after cross-node reentry; method identity cannot mask a stale cache');
  let once=true;f.gl.uniformMatrix4fv=function(...args){if(once){once=false;f.set([inner]);}return native.apply(this,args);};f.set([outer]);
  const count=f.calls.length;f.set([outer]);assert.equal(f.calls.length,count+1,'Same method must freshly upload after same-node reentry');assert.equal(f.program.values.get(shadow.name)[12],0);
 });

 test(name+': a stable wrapper reentering a stock vector setter always delegates and cannot retain stale shadow state',()=>{
  const f=fixture(module,[shadow,{name:'otherVectors[0]',type:0x8b52,size:4}]),matrix=[new Matrix4()],vectors=Array.from({length:4},()=>new Vector4(3,4,5,6));
  const native=f.native;let reenter=true;
  const wrapper=function(address,transpose,data){
   if(reenter){const saved=Float32Array.from(data);f.set(vectors,f.uniforms.map.otherVectors);native.call(this,address,transpose,data);data.set(saved);}
   else native.call(this,address,transpose,data);
  };
  f.gl.uniformMatrix4fv=wrapper;
  f.set(matrix);assert.deepEqual(f.program.values.get(shadow.name),vectors.flatMap(vector=>vector.toArray()),'Original stock setter overwrites the actual shared scratch consumed by the native shadow upload');
  reenter=false;f.set(matrix);assert.equal(f.gl.uniformMatrix4fv,wrapper,'Keep the exact same method across the repair request');
  assert.deepEqual(f.program.values.get(shadow.name),matrix[0].elements,'Unchanged wrapper must freshly upload the original matrix');
  const count=f.calls.length;f.set(matrix);assert.equal(f.calls.length,count+1,'Callable wrappers never cache even after reentry stops');
  const stats=f.control.read();assert.equal(stats.setterCalls,3);assert.equal(stats.nativeCalls,3);assert.equal(stats.skippedCalls,0);assert.equal(stats.fallbackCalls,3);
 });

 test(name+': cache eligibility requires the captured native prototype and ordinary unchanged method descriptors',()=>{
  const f=fixture(module),matrix=[new Matrix4()],prototype=MockWebGL2RenderingContext.prototype,nativeDescriptor=Object.getOwnPropertyDescriptor(prototype,'uniformMatrix4fv');
  f.set(matrix);f.set(matrix);assert.equal(f.calls.length,1);let reads=0;
  Object.defineProperty(f.gl,'uniformMatrix4fv',{get(){reads++;return f.native;},configurable:true});
  f.set(matrix);f.set(matrix);assert.equal(reads,2,'Original method accessor executes exactly once per request');assert.equal(f.calls.length,3,'Accessor returning native still delegates');
  Object.defineProperty(f.gl,'uniformMatrix4fv',{value:f.native,writable:true,configurable:true});f.set(matrix);f.set(matrix);assert.equal(f.calls.length,4,'Ordinary native ownership can resume only with a fresh upload');
  try{
   Object.defineProperty(prototype,'uniformMatrix4fv',{get(){return f.native;},configurable:true});
   f.set(matrix);f.set(matrix);assert.equal(f.calls.length,6,'Changed inherited descriptor rejects a selected own native method');
  }finally{Object.defineProperty(prototype,'uniformMatrix4fv',nativeDescriptor);}
  f.set(matrix);f.set(matrix);assert.equal(f.calls.length,7);
  Object.setPrototypeOf(f.gl,Object.create(prototype));f.set(matrix);f.set(matrix);assert.equal(f.calls.length,9,'Changed context prototype fails closed');
  Object.setPrototypeOf(f.gl,prototype);f.set(matrix);f.set(matrix);assert.equal(f.calls.length,10);
 });

 test(name+': foreign receiver/context delegates the exact stock setter and invalidates the owned cache',()=>{
  const f=fixture(module),matrix=[new Matrix4()];f.set(matrix);const candidate=f.node.setValue,otherContext={uniformMatrix4fv(...args){assert.equal(this,otherContext);f.native.apply(f.gl,args);}};
  candidate.call(f.node,otherContext,matrix);f.set(matrix);assert.equal(f.calls.length,3);
  const foreign={size:1,addr:f.node.addr};candidate.call(foreign,f.gl,matrix);f.set(matrix);assert.equal(f.calls.length,5);
 });

 test(name+': context loss/restore and proof toggles/reset require fresh native uploads',()=>{
  const f=fixture(module),matrix=[new Matrix4()];f.set(matrix);f.set(matrix);assert.equal(f.calls.length,1);
  f.gl.canvas.dispatchEvent(new Event('webglcontextlost'));f.set(matrix);f.set(matrix);assert.equal(f.calls.length,3,'Lost context retains original call behavior');
  f.gl.canvas.dispatchEvent(new Event('webglcontextrestored'));f.set(matrix);f.set(matrix);assert.equal(f.calls.length,4);
  const resets=f.control.read().contextResets;assert(resets>=2);f.control.reset();f.set(matrix);f.set(matrix);assert.equal(f.calls.length,5);assert.equal(f.control.read().contextResets,resets);
  const old=f.node.setValue;f.control.setMode('original');old.call(f.node,f.gl,matrix);assert.equal(f.calls.length,6,'Saved stopped candidate delegates');
  f.control.setMode('inline');f.set(matrix);assert.equal(f.calls.length,7);
 });

 test(name+': control preserves later setter owners/accessors and diagnostic snapshots are detached',()=>{
  const f=fixture(module),later=()=>17;f.node.setValue=later;f.control.setMode('original');f.control.setMode('inline');assert.equal(f.node.setValue,later);
  let reads=0;Object.defineProperty(f.node,'setValue',{get(){reads++;return later;},configurable:true});f.control.setMode('original');f.control.read();assert.equal(reads,0);
  const snapshot=f.control.read(),actual=snapshot.nativeCalls;snapshot.nativeCalls=999;assert.equal(f.control.read().nativeCalls,actual);
 });

 test(name+': inability to acquire lifecycle support leaves reflection and original setter intact',()=>{
  const f=fixture(module,[]),gl=f.gl;Object.defineProperty(gl,'canvas',{get(){throw Error('No optional lifecycle');}});
  const program={infos:[shadow],values:new Map()},uniforms=new module.__testWebGLUniforms(gl,program);assert.notEqual(uniforms.map.directionalShadowMatrix.setValue.name,'belleDirectionalShadowMatrixArray');
  uniforms.map.directionalShadowMatrix.setValue(gl,[new Matrix4()]);assert.equal(f.calls.length,1);
 });
}
