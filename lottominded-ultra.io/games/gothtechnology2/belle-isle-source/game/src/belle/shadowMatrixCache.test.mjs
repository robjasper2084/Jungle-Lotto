import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Vector4} from 'three';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {installShadowMatrixCache} from './shadowMatrixCache.ts';

const shadow={name:'directionalShadowMatrix[0]',type:0x8b5c,size:1};
const ordinary={name:'otherMatrix[0]',type:0x8b5c,size:1};
const water={name:'shipWake[0]',type:0x8b52,size:1};
const floats=()=>new Float32Array(new Matrix4().elements);

/** Real Three uniform reflection, classes, flattening, and upload dispatch.
 * The native boundary records receiver/arguments and driver-visible values. */
function fixture(infos=[shadow,ordinary,water]){
 const calls=[],reflection=[],draws=[],properties=new Map();let programId=0;
 const f={calls,reflection,draws,nativeError:null,drawError:null,disposeError:null,disposals:0,extraUniformReads:false};
 const gl={ACTIVE_UNIFORMS:0x8b86,
  getProgramParameter(program,pname){assert.equal(this,gl);assert.equal(pname,this.ACTIVE_UNIFORMS);reflection.push(['count',program.id]);return program.infos.length;},
  getActiveUniform(program,index){assert.equal(this,gl);reflection.push(['info',program.id,index]);return program.infos[index];},
  getUniformLocation(program,name){assert.equal(this,gl);reflection.push(['location',program.id,name]);return{program,name};},
  uniformMatrix4fv(...args){
   assert.equal(this,gl);const [location,transpose,data]=args;
   calls.push({method:'uniformMatrix4fv',args,values:Array.from(data),invalid:data.length%16!==0});
   if(f.nativeError)throw f.nativeError;
   location.program.values.set(location.name,Array.from(data));
  },
  uniformMatrix3fv(...args){assert.equal(this,gl);calls.push({method:'uniformMatrix3fv',args,values:Array.from(args[2])});},
  uniform4fv(...args){assert.equal(this,gl);calls.push({method:'uniform4fv',args,values:Array.from(args[1])});},
 };
 const native=gl.uniformMatrix4fv;
 function makeProgram(){
  const handle={id:++programId,infos,values:new Map()};let uniforms;let reads=0;
  return {handle,getUniforms(){reads++;if(f.extraUniformReads&&reads>1)throw Error('unexpected program inspection');return uniforms??=new WebGLUniforms(gl,handle);}};
 }
 const values={directionalShadowMatrix:{value:[new Matrix4()]},otherMatrix:{value:[new Matrix4().makeTranslation(5,6,7)]},shipWake:{value:[new Vector4(1,2,3,4)]}};
 const material={};properties.set(material,{currentProgram:makeProgram()});
 const renderer={domElement:new EventTarget(),properties:{get:material=>properties.get(material)},getContext:()=>gl,
  renderBufferDirect(...args){
   if(f.drawError)throw f.drawError;
   draws.push({receiver:this,args});
   const program=properties.get(args[3]).currentProgram,uniforms=program.getUniforms();
   WebGLUniforms.upload(gl,uniforms.seq,values);return f.result;
  },
  dispose(...args){f.disposals++;f.disposeThis=this;f.disposeArgs=args;if(f.disposeError)throw f.disposeError;return f.result;},
 };
 Object.assign(f,{renderer,gl,values,material,native,properties,makeProgram,result:{original:true},
  originalDirect:renderer.renderBufferDirect,originalDispose:renderer.dispose,
  draw:(selected=material)=>renderer.renderBufferDirect('camera','scene','geometry',selected,'object','group'),
  program:(selected=material)=>properties.get(selected).currentProgram,
  node:()=>properties.get(material).currentProgram.getUniforms().map.directionalShadowMatrix,
  shadowCalls:()=>calls.filter(c=>c.args[0].name==='directionalShadowMatrix[0]'),
 });
 return f;
}

test('the pinned source and browser entry retain the actual r185 uniform and post-draw reflection contract',()=>{
 const base=new URL('../../node_modules/three/',import.meta.url);
 assert.equal(JSON.parse(readFileSync(new URL('package.json',base),'utf8')).version,'0.185.1');
 const hashes={
  'build/three.module.js':'bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7',
  'src/renderers/WebGLRenderer.js':'867948b57a6abb84d4cfd7619b38ea14fbb2c100c1b6f78d59de2383662ab7a0',
  'src/renderers/webgl/WebGLProgram.js':'a341febd40f5f16253c1fd624f6ae7d0ca34b7a5411fcee1699b87962081ec72',
  'src/renderers/webgl/WebGLUniforms.js':'a1910ebdedfb7903b8d6155515ffb414add03108c222de95868eee790bef2317',
 };
 for(const [file,expected]of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(new URL(file,base))).digest('hex'),expected,file+' requires an explicit adapter contract review');
 const renderer=readFileSync(new URL('src/renderers/WebGLRenderer.js',base),'utf8');
 const direct=renderer.slice(renderer.indexOf('this.renderBufferDirect = function'),renderer.indexOf('this.compile = function'));
 assert(direct.indexOf('const program = setProgram(')<direct.indexOf('return;'),'setProgram precedes the first early return');
 assert.match(renderer,/const p_uniforms = program\.getUniforms\(\),\s*m_uniforms = materialProperties\.uniforms;/);
 const setter=/function setValueM4Array\( gl, v \) \{\s*const data = flatten\( v, this\.size, 16 \);\s*gl\.uniformMatrix4fv\( this\.addr, false, data \);\s*\}/;
 for(const file of ['build/three.module.js','src/renderers/webgl/WebGLUniforms.js'])assert.match(readFileSync(new URL(file,base),'utf8'),setter);
});

test('only the named array loses repeat uploads, with no extra native reflection, draws, or global GL wrappers',()=>{
 const baseline=fixture(),f=fixture();const stop=installShadowMatrixCache(f.renderer);
 for(let i=0;i<4;i++){assert.equal(baseline.draw(),baseline.result);assert.equal(f.draw(),f.result);}
 assert.equal(baseline.shadowCalls().length,4);assert.equal(f.shadowCalls().length,2,'first draw and first cached request both upload');
 for(const name of ['otherMatrix[0]','shipWake[0]'])assert.equal(f.calls.filter(c=>c.args[0].name===name).length,4,name+' is untouched');
 assert.deepEqual(f.reflection,baseline.reflection,'the extra JS getUniforms access uses its reflected cache');
 assert.equal(f.draws.length,4);assert(f.draws.every(d=>d.receiver===f.renderer));
 assert.deepEqual(f.draws[0].args,['camera','scene','geometry',f.material,'object','group']);
 assert.equal(f.gl.uniformMatrix4fv,f.native);stop();assert.equal(f.renderer.renderBufferDirect,f.originalDirect);
});

test('the original Matrix4 flatten path runs on every request and notices in-place mutations',()=>{
 const f=fixture([shadow]),matrix=new Matrix4();let flattened=0;const original=matrix.toArray;
 matrix.toArray=function(...args){flattened++;return Reflect.apply(original,this,args);};f.values.directionalShadowMatrix.value=[matrix];
 installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 assert.equal(flattened,3);assert.equal(f.shadowCalls().length,2);
 matrix.elements[12]=3.25;f.draw();f.draw();
 assert.equal(flattened,5);assert.equal(f.shadowCalls().length,3);assert.equal(f.shadowCalls().at(-1).values[12],3.25);
});

test('flat Float32 views preserve their exact native payload and both signs of zero',()=>{
 const f=fixture([shadow]),data=floats();f.values.directionalShadowMatrix.value=data;
 installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 data[1]=-0;f.draw();f.draw();assert.equal(f.shadowCalls().length,3);assert(Object.is(f.shadowCalls().at(-1).values[1],-0));
 data[1]=0;f.draw();assert.equal(f.shadowCalls().length,4);assert(Object.is(f.shadowCalls().at(-1).values[1],0));
 assert(f.shadowCalls().every(c=>c.args.length===3&&c.args[1]===false&&c.args[2]===data));
});

test('non-finite, ordinary, shared, resizable, and malformed inputs retain original native uploads',()=>{
 const ordinary=floats().slice();let reads=0;const array=Array.from(ordinary);Object.defineProperty(array,5,{get(){reads++;return 1;}});
 const cases=[array,new Float32Array(new SharedArrayBuffer(64)),new Float32Array(15),new Float32Array(32),new Float64Array(16),new(class extends Float32Array{})(16)];
 if(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable'))cases.push(new Float32Array(new ArrayBuffer(64,{maxByteLength:128})));
 for(const value of [NaN,Infinity,-Infinity]){const data=floats();data[5]=value;cases.push(data);}
 for(const data of cases){
  const f=fixture([shadow]);f.values.directionalShadowMatrix.value=data;installShadowMatrixCache(f.renderer);
  f.draw();f.draw();f.draw();assert.equal(f.shadowCalls().length,3);
  assert(f.shadowCalls().every(c=>c.args[2]===data));
  if(data.length===15)assert(f.shadowCalls().every(c=>c.invalid),'native malformed-length validation remains observable');
 }
 assert.equal(reads,6,'ordinary array elements are read only by the fake native boundary, twice per upload');
});

test('typed metadata accessors and a later location accessor are not replayed by cache inspection',()=>{
 const f=fixture([shadow]),data=floats();let metadata=0,addresses=0;
 for(const key of ['length','buffer','byteLength','byteOffset'])Object.defineProperty(data,key,{get(){metadata++;throw Error('metadata getter must not run');}});
 f.values.directionalShadowMatrix.value=data;
 // The native test boundary uses a real typed-array iterator, not its public metadata.
 f.gl.uniformMatrix4fv=function(...args){assert.equal(this,f.gl);f.calls.push({method:'uniformMatrix4fv',args,values:Array.from(args[2])});};
 installShadowMatrixCache(f.renderer);f.draw();f.draw();const node=f.node(),location=node.addr;
 Object.defineProperty(node,'addr',{configurable:true,get(){addresses++;return location;}});
 f.draw();f.draw();assert.equal(metadata,0);assert.equal(addresses,2);assert.equal(f.shadowCalls().length,2);
});

test('native and conversion exceptions keep their identity and invalidate a previous cached value',()=>{
 const f=fixture([shadow]),matrix=f.values.directionalShadowMatrix.value[0];installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 const error=Error('native upload sentinel');matrix.elements[12]=2;f.nativeError=error;assert.throws(()=>f.draw(),value=>value===error);
 f.nativeError=null;matrix.elements[12]=0;f.draw();assert.equal(f.shadowCalls().length,4,'a failed upload cannot leave a reusable cache');
 const convert=Error('flatten sentinel'),original=matrix.toArray;matrix.toArray=()=>{throw convert;};assert.throws(()=>f.draw(),value=>value===convert);
 matrix.toArray=original;f.draw();assert.equal(f.shadowCalls().length,5);
});

test('the shared Three flatten buffer cannot alias a saved shadow payload',()=>{
 const f=fixture([shadow,ordinary]);installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 assert.equal(f.shadowCalls().length,2);assert(f.shadowCalls().every(c=>c.values[12]===0));
 f.values.otherMatrix.value[0].elements[12]=9;f.draw();assert.equal(f.shadowCalls().length,2);
 f.values.directionalShadowMatrix.value[0].elements[12]=9;f.draw();assert.equal(f.shadowCalls().length,3);
});

test('uniform locations and programs retain independent first/change uploads',()=>{
 const f=fixture([shadow]),other={};f.properties.set(other,{currentProgram:f.makeProgram()});installShadowMatrixCache(f.renderer);
 for(let i=0;i<3;i++){f.draw();f.draw(other);}
 assert.equal(f.shadowCalls().length,4);assert.equal(new Set(f.shadowCalls().map(c=>c.args[0])).size,2);
 f.values.directionalShadowMatrix.value[0].elements[13]=4;f.draw();f.draw(other);assert.equal(f.shadowCalls().length,6);
 const data=f.values.directionalShadowMatrix.value,foreign=[];
 f.node().setValue({uniformMatrix4fv(...args){foreign.push(args);}},data);assert.equal(foreign.length,1);
 f.draw();assert.equal(f.shadowCalls().length,7,'a foreign-context call invalidates only this node cache');
});

test('context transitions restore old nodes and new linked programs require fresh native uploads',()=>{
 const f=fixture([shadow]);const stop=installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 const node=f.node(),stale=node.setValue,oldProgram=f.program();
 f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
 assert.notEqual(node.setValue,stale);stale.call(node,f.gl,f.values.directionalShadowMatrix.value);assert.equal(f.shadowCalls().length,3);
 f.properties.set(f.material,{currentProgram:f.makeProgram()});f.draw();f.draw();f.draw();
 const current=f.shadowCalls().filter(c=>c.args[0].program!==oldProgram.handle);assert.equal(current.length,2);
 stop();
});

test('method changes, getters, nested native calls and changed payloads cannot commit stale cache entries',()=>{
 const f=fixture([shadow]),data=floats();f.values.directionalShadowMatrix.value=data;installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 let getters=0,nested=true;const native=f.native,alternate=floats();alternate[12]=7;
 const later=function(...args){Reflect.apply(native,this,args);if(nested){nested=false;f.node().setValue(f.gl,alternate);}};
 Object.defineProperty(f.gl,'uniformMatrix4fv',{configurable:true,get(){getters++;return later;}});
 f.draw();assert.equal(f.shadowCalls().at(-1).values[12],7);f.draw();assert.equal(f.shadowCalls().at(-1).values[12],0);
 const count=f.shadowCalls().length;f.draw();assert.equal(f.shadowCalls().length,count);assert.equal(getters,4,'one method lookup remains per original upload request, including the nested request');
});

test('the original method-before-address evaluation order survives either accessor changing the other input',()=>{
 for(const mode of ['address-selects-method','method-selects-address']){
  const traces=[];
  for(const optimized of [false,true]){
   const f=fixture([shadow]);if(optimized)installShadowMatrixCache(f.renderer);f.draw();
   const node=f.node(),initial=node.addr,alternate={...initial,name:'alternate'},trace=[];let changed=false;
   const first=function(...args){trace.push('first:'+args[0].name);return Reflect.apply(f.native,this,args);};
   const second=function(...args){trace.push('second:'+args[0].name);return Reflect.apply(f.native,this,args);};
   Object.defineProperty(f.gl,'uniformMatrix4fv',{get(){trace.push('method');if(mode==='method-selects-address')changed=true;return changed?second:first;}});
   Object.defineProperty(node,'addr',{get(){trace.push('address');if(mode==='address-selects-method')changed=true;return mode==='method-selects-address'&&changed?alternate:initial;}});
   f.draw();traces.push(trace);
  }
  assert.deepEqual(traces[1],traces[0],mode);
  assert.deepEqual(traces[0],mode==='address-selects-method'?['method','address','first:directionalShadowMatrix[0]']:['method','address','second:alternate']);
 }
});

test('an address getter can reenter and change the memoized method without changing the outer selected call',()=>{
 const results=[];
 for(const optimized of [false,true]){
  const f=fixture([shadow]);if(optimized)installShadowMatrixCache(f.renderer);f.draw();
  const node=f.node(),location=node.addr,trace=[],nested=[new Matrix4().makeTranslation(9,0,0)];let inside=false;
  const first=function(...args){trace.push('first');return Reflect.apply(f.native,this,args);};
  const second=function(...args){trace.push('second');return Reflect.apply(f.native,this,args);};
  Object.defineProperty(f.gl,'uniformMatrix4fv',{get(){trace.push(inside?'method:second':'method:first');return inside?second:first;}});
  Object.defineProperty(node,'addr',{get(){trace.push('address');if(!inside){inside=true;node.setValue(f.gl,nested);}return location;}});
  f.draw();results.push({trace,values:f.shadowCalls().map(call=>call.values)});
 }
 assert.deepEqual(results[1],results[0]);
 assert.deepEqual(results[0].trace,['method:first','address','method:second','address','second','first']);
});

test('noncallable or throwing method lookups retain the original argument-evaluation and error timing',()=>{
 for(const throwing of [false,true]){
  const results=[],sentinel=Error('method lookup sentinel');
  for(const optimized of [false,true]){
   const f=fixture([shadow]);if(optimized)installShadowMatrixCache(f.renderer);f.draw();
   const node=f.node(),location=node.addr,trace=[];
   Object.defineProperty(f.gl,'uniformMatrix4fv',{get(){trace.push('method');if(throwing)throw sentinel;return null;}});
   Object.defineProperty(node,'addr',{get(){trace.push('address');return location;}});
   let observed;try{f.draw();}catch(error){observed=error;}
   assert(observed);if(throwing)assert.equal(observed,sentinel);else assert(observed instanceof TypeError);
   results.push({trace,message:observed.message});
  }
  assert.deepEqual(results[1],results[0]);assert.deepEqual(results[0].trace,throwing?['method']:['method','address']);
 }
});

test('later method owners and accessors survive cleanup without executing their getters',()=>{
 const f=fixture([shadow]),stop=installShadowMatrixCache(f.renderer);f.draw();const node=f.node();let reads=0;
 const later=()=>{};Object.defineProperty(node,'setValue',{configurable:true,get(){reads++;return later;}});
 Object.defineProperty(f.renderer,'renderBufferDirect',{configurable:true,get(){reads++;return later;}});
 const laterDispose=function(){};f.renderer.dispose=laterDispose;stop();stop();
 assert.equal(reads,0);assert.equal(Object.getOwnPropertyDescriptor(node,'setValue').get instanceof Function,true);
 assert.equal(Object.getOwnPropertyDescriptor(f.renderer,'renderBufferDirect').get instanceof Function,true);assert.equal(f.renderer.dispose,laterDispose);
});

test('sealed owned slots cannot replace original draw results or disposal exceptions with cleanup errors',()=>{
 const f=fixture([shadow]),stop=installShadowMatrixCache(f.renderer);f.draw();f.draw();const node=f.node();
 Object.defineProperty(node,'setValue',{value:node.setValue,writable:false,configurable:false});
 Object.defineProperty(f.renderer,'renderBufferDirect',{value:f.renderer.renderBufferDirect,writable:false,configurable:false});
 const error=Error('original dispose sentinel');f.disposeError=error;assert.throws(()=>f.renderer.dispose('argument'),value=>value===error);
 assert.equal(f.disposals,1);assert.equal(f.disposeThis,f.renderer);assert.deepEqual(f.disposeArgs,['argument']);assert.doesNotThrow(stop);
 const before=f.shadowCalls().length;assert.equal(f.draw(),f.result);assert.equal(f.draw(),f.result);assert.equal(f.shadowCalls().length,before+2,'unrestorable wrappers delegate after stop');
});

test('successful draws stay successful when optional inspection cannot follow its pinned contract',()=>{
 const f=fixture([shadow]);f.extraUniformReads=true;installShadowMatrixCache(f.renderer);assert.equal(f.draw(),f.result);
 assert.equal(f.renderer.renderBufferDirect,f.originalDirect);assert.equal(f.renderer.dispose,f.originalDispose);
});

test('original draw failures propagate without inspection, and installation/disposal is idempotent',()=>{
 const f=fixture([shadow]),stop=installShadowMatrixCache(f.renderer);assert.equal(installShadowMatrixCache(f.renderer),stop);
 const error=Error('original draw sentinel');f.drawError=error;assert.throws(()=>f.draw(),value=>value===error);assert.deepEqual(f.reflection,[]);
 f.drawError=null;f.draw();assert.equal(f.renderer.dispose(),f.result);stop();assert.equal(f.disposals,1);assert.equal(f.renderer.renderBufferDirect,f.originalDirect);
 const compiler={compileAsync(){}};const before=Object.getOwnPropertyDescriptors(compiler);installShadowMatrixCache(compiler)();assert.deepEqual(Object.getOwnPropertyDescriptors(compiler),before);
});
