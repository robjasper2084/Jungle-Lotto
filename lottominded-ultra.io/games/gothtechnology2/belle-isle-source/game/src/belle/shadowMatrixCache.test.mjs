import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4,Vector4} from 'three';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {installShadowMatrixCache,readShadowMatrixCacheDiagnostics} from './shadowMatrixCache.ts';

const shadow={name:'directionalShadowMatrix[0]',type:0x8b5c,size:1};
const ordinary={name:'otherMatrix[0]',type:0x8b5c,size:1};
const water={name:'shipWake[0]',type:0x8b52,size:1};
const namedWater=[
 {name:'riverRipples[0]',type:0x8b52,size:12},
 {name:'shipWake[0]',type:0x8b52,size:4},
 {name:'shipShape[0]',type:0x8b52,size:4},
];
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
  uniform4fv(...args){
   assert.equal(this,gl);const [location,data]=args;
   calls.push({method:'uniform4fv',args,values:Array.from(data),invalid:data.length%4!==0});
   if(f.nativeError)throw f.nativeError;
   location.program.values.set(location.name,Array.from(data));
  },
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
 Object.assign(f,{renderer,gl,values,material,native,nativeV4:gl.uniform4fv,properties,makeProgram,result:{original:true},
  originalDirect:renderer.renderBufferDirect,originalDispose:renderer.dispose,
  draw:(selected=material)=>renderer.renderBufferDirect('camera','scene','geometry',selected,'object','group'),
  program:(selected=material)=>properties.get(selected).currentProgram,
  node:(id='directionalShadowMatrix')=>properties.get(material).currentProgram.getUniforms().map[id],
  shadowCalls:()=>calls.filter(c=>c.args[0].name==='directionalShadowMatrix[0]'),
 });
 return f;
}
function waterFixture(infos=namedWater){
 const f=fixture(infos);
 for(const info of infos)if(info.type===0x8b52){
  f.values[info.name.slice(0,-3)]={value:Array.from({length:info.size},(_,i)=>new Vector4(i+1,i+2,i+3,i+4))};
 }
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
 const vectorSetter=/function setValueV4fArray\( gl, v \) \{\s*const data = flatten\( v, this\.size, 4 \);\s*gl\.uniform4fv\( this\.addr, data \);\s*\}/;
 for(const file of ['build/three.module.js','src/renderers/webgl/WebGLUniforms.js']){
  const source=readFileSync(new URL(file,base),'utf8');assert.match(source,setter);assert.match(source,vectorSetter);
 }
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

test('the three water arrays retain independent first/change uploads in each program without added native reflection',()=>{
 const baseline=waterFixture(),f=waterFixture(),other=new Map();
 for(const entry of [baseline,f]){const material={};other.set(entry,material);entry.properties.set(material,{currentProgram:entry.makeProgram()});}
 installShadowMatrixCache(f.renderer);
 const draw=()=>{for(const entry of [baseline,f]){entry.draw();entry.draw(other.get(entry));}};
 const calls=name=>f.calls.filter(call=>call.args[0].name===name);
 draw();draw();draw();
 for(const info of namedWater){assert.equal(calls(info.name).length,4);assert.equal(new Set(calls(info.name).map(call=>call.args[0])).size,2);}
 for(const entry of [baseline,f])for(const info of namedWater)entry.values[info.name.slice(0,-3)].value.at(-1).y+=.25;
 draw();draw();
 for(const info of namedWater)assert.equal(calls(info.name).length,6,info.name+' changes in both programs');
 for(const entry of [baseline,f])entry.values.shipWake.value[0].x+=2;
 draw();draw();assert.equal(calls('shipWake[0]').length,8);
 for(const name of ['riverRipples[0]','shipShape[0]'])assert.equal(calls(name).length,6,'another uniform changing does not invalidate '+name);
 assert.deepEqual(f.program().handle.values,baseline.program().handle.values);
 assert.deepEqual(f.program(other.get(f)).handle.values,baseline.program(other.get(baseline)).handle.values);
 assert.deepEqual(f.reflection,baseline.reflection);assert.equal(f.draws.length,baseline.draws.length);
 assert.equal(f.gl.uniform4fv,f.nativeV4);assert.equal(f.gl.uniformMatrix4fv,f.native);
});

test('water arrays with another name, type, or reflected size keep their original setters and uploads',()=>{
 const cases=[{name:'otherVectors[0]',type:0x8b52,size:4}];
 for(const info of namedWater)cases.push({...info,size:info.size-1},{...info,size:info.size+1},{...info,type:0x8b5c});
 for(const info of cases){
  const id=info.name.slice(0,-3),f=waterFixture([info]);
  if(info.type===0x8b5c)f.values[id]={value:Array.from({length:info.size},()=>new Matrix4())};
  const node=f.node(id),original=node.setValue;installShadowMatrixCache(f.renderer);
  f.draw();f.draw();f.draw();assert.equal(node.setValue,original);assert.equal(f.calls.length,3,JSON.stringify(info));
 }
});

test('original Vector4 conversions run every request and share the Three flatten pool safely with matrix arrays',()=>{
 const f=waterFixture([shadow,...namedWater,ordinary]),conversions=new Map(),buffers=new Map();
 const matrix=f.values.directionalShadowMatrix.value[0],matrixToArray=matrix.toArray;
 matrix.toArray=function(...args){buffers.set('matrix',args[0]);return Reflect.apply(matrixToArray,this,args);};
 for(const info of namedWater){
  const id=info.name.slice(0,-3);conversions.set(id,0);
  f.values[id].value.forEach((vector,index)=>{
   const original=vector.toArray;
   vector.toArray=function(...args){assert.equal(this,vector);assert.equal(args[1],index*4);conversions.set(id,conversions.get(id)+1);buffers.set(id,args[0]);return Reflect.apply(original,this,args);};
  });
 }
 installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 assert.equal(buffers.get('shipWake'),buffers.get('matrix'));assert.equal(buffers.get('shipShape'),buffers.get('matrix'));
 assert.notEqual(buffers.get('riverRipples'),buffers.get('matrix'));
 for(const info of namedWater){const id=info.name.slice(0,-3);assert.equal(conversions.get(id),info.size*3);assert.equal(f.calls.filter(call=>call.args[0].name===info.name).length,2);}
 // Changes below Float32 precision still execute toArray, but upload the same
 // converted values. A representable change must reach the native method.
 f.values.shipWake.value[0].x=1+2**-30;f.draw();
 assert.equal(f.calls.filter(call=>call.args[0].name==='shipWake[0]').length,2);
 f.values.shipWake.value[0].x=1.25;f.draw();f.draw();
 assert.equal(f.calls.filter(call=>call.args[0].name==='shipWake[0]').length,3);
 assert.equal(f.program().handle.values.get('shipWake[0]')[0],1.25);
 assert.equal(f.program().handle.values.get('shipShape[0]')[0],1);
 assert.equal(f.shadowCalls().length,2);assert.equal(f.program().handle.values.get('directionalShadowMatrix[0]')[12],0);
 for(const info of namedWater)assert.equal(conversions.get(info.name.slice(0,-3)),info.size*6);
});

test('water Float32 subviews preserve their native two-argument calls, offsets, identity, and signed zeros',()=>{
 for(const info of namedWater){
  const f=waterFixture([info]),id=info.name.slice(0,-3),data=new Float32Array(new ArrayBuffer((info.size*4+8)*4),16,info.size*4);
  data[0]=1;f.values[id].value=data;installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
  assert.equal(f.calls.length,2);data[1]=-0;f.draw();f.draw();assert.equal(f.calls.length,3);assert(Object.is(f.calls.at(-1).values[1],-0));
  data[1]=0;f.draw();assert.equal(f.calls.length,4);assert(Object.is(f.calls.at(-1).values[1],0));
  const location=f.node(id).addr;assert(f.calls.every(call=>call.method==='uniform4fv'&&call.args.length===2&&call.args[0]===location&&call.args[1]===data));
  assert.equal(data.byteOffset,16);
 }
});

test('unsupported water payloads keep native validation and are never converted again for caching',()=>{
 const cases=[Array.from(floats()),new Float32Array(new SharedArrayBuffer(64)),new Float32Array(15),new Float32Array(20),new Float64Array(16)];
 if(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype,'resizable'))cases.push(new Float32Array(new ArrayBuffer(64,{maxByteLength:128})));
 for(const value of [NaN,Infinity,-Infinity]){const data=floats();data[5]=value;cases.push(data);}
 for(const data of cases){
  const f=waterFixture([namedWater[1]]);f.values.shipWake.value=data;installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
  assert.equal(f.calls.length,3);assert(f.calls.every(call=>call.args.length===2&&call.args[1]===data));
  if(data.length===15)assert(f.calls.every(call=>call.invalid));
 }
});

test('water native/conversion failures, context reset and disposal preserve fresh-upload ownership',()=>{
 const f=waterFixture([namedWater[1]]),vector=f.values.shipWake.value[0],stop=installShadowMatrixCache(f.renderer);
 f.draw();f.draw();f.draw();assert.equal(f.calls.length,2);
 const nativeError=Error('water native sentinel');f.nativeError=nativeError;vector.x=9;assert.throws(()=>f.draw(),error=>error===nativeError);
 f.nativeError=null;vector.x=1;f.draw();assert.equal(f.calls.length,4);
 const conversionError=Error('water conversion sentinel'),toArray=vector.toArray;
 vector.toArray=()=>{throw conversionError;};assert.throws(()=>f.draw(),error=>error===conversionError);
 vector.toArray=toArray;f.draw();assert.equal(f.calls.length,5);
 const node=f.node('shipWake'),wrapper=node.setValue;
 f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
 assert.notEqual(node.setValue,wrapper);f.draw();f.draw();f.draw();assert.equal(f.calls.length,7);
 stop();f.draw();f.draw();assert.equal(f.calls.length,9);assert.equal(f.gl.uniform4fv,f.nativeV4);
});

test('water method-before-address lookup and noncallable/throwing lookup timing match original Three',()=>{
 for(const mode of ['selected','noncallable','throwing']){
  const results=[],sentinel=Error('water method sentinel');
  for(const optimized of [false,true]){
   const f=waterFixture([namedWater[1]]);if(optimized)installShadowMatrixCache(f.renderer);f.draw();
   const node=f.node('shipWake'),location=node.addr,trace=[];let changed=false,observed;
   const first=function(...args){trace.push('first');return Reflect.apply(f.nativeV4,this,args);};
   const second=function(...args){trace.push('second');return Reflect.apply(f.nativeV4,this,args);};
   Object.defineProperty(f.gl,'uniform4fv',{get(){trace.push('method');if(mode==='throwing')throw sentinel;return mode==='noncallable'?null:changed?second:first;}});
   Object.defineProperty(node,'addr',{get(){trace.push('address');changed=true;return location;}});
   try{f.draw();}catch(error){observed=error;}
   if(mode==='throwing')assert.equal(observed,sentinel);else if(mode==='noncallable')assert(observed instanceof TypeError);else assert.equal(observed,undefined);
   results.push({trace,message:observed?.message,values:f.calls.map(call=>call.values)});
  }
  assert.deepEqual(results[1],results[0]);
  assert.deepEqual(results[0].trace,mode==='selected'?['method','address','first']:mode==='noncallable'?['method','address']:['method']);
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

test('diagnostics count intercepted native calls and actual skips without claiming the first unobserved upload',()=>{
 const unsupported={};assert.equal(readShadowMatrixCacheDiagnostics(unsupported),null);installShadowMatrixCache(unsupported)();assert.equal(readShadowMatrixCacheDiagnostics(unsupported),null);
 const f=fixture(),stop=installShadowMatrixCache(f.renderer);
 assert.equal(installShadowMatrixCache(f.renderer),stop);
 const before=readShadowMatrixCacheDiagnostics(f.renderer);assert.equal(before.active,true);assert.equal(before.observedPrograms,0);assert.equal(before.observedUniforms,0);
 f.draw();let stats=readShadowMatrixCacheDiagnostics(f.renderer);
 assert.equal(stats.observedPrograms,1);assert.equal(stats.observedUniforms,1);
 assert.equal(stats.uniforms.directionalShadowMatrix.nativeCalls,0);assert.equal(f.shadowCalls().length,1,'first program observation follows the original upload');
 f.draw();f.draw();stats=readShadowMatrixCacheDiagnostics(f.renderer);
 assert.deepEqual(stats.uniforms.directionalShadowMatrix,{observedUniforms:1,setterCalls:2,delegatedSetterCalls:0,nativeCalls:1,nativeSuccesses:1,nativeErrors:0,skippedCalls:1});
 assert.equal(f.shadowCalls().length,1+stats.uniforms.directionalShadowMatrix.nativeCalls);
 for(const id of ['riverRipples','shipWake','shipShape'])assert.deepEqual(stats.uniforms[id],{observedUniforms:0,setterCalls:0,delegatedSetterCalls:0,nativeCalls:0,nativeSuccesses:0,nativeErrors:0,skippedCalls:0});
 stop();assert.equal(readShadowMatrixCacheDiagnostics(f.renderer).active,false);
});

test('diagnostics distinguish thrown context calls and foreign/stopped setter delegations',()=>{
 const f=fixture([shadow]),stop=installShadowMatrixCache(f.renderer),matrix=f.values.directionalShadowMatrix.value[0];f.draw();f.draw();
 const error=Error('counted native upload sentinel');matrix.elements[12]=1;f.nativeError=error;assert.throws(()=>f.draw(),value=>value===error);
 f.nativeError=null;matrix.elements[12]=0;f.draw();f.draw();
 let stats=readShadowMatrixCacheDiagnostics(f.renderer).uniforms.directionalShadowMatrix;
 assert.equal(stats.nativeCalls,3);assert.equal(stats.nativeSuccesses,2);assert.equal(stats.nativeErrors,1);assert.equal(stats.skippedCalls,1);
 assert.equal(f.shadowCalls().length,1+stats.nativeCalls);
 const node=f.node(),stale=node.setValue,foreign=[];
 stale.call(node,{uniformMatrix4fv(...args){foreign.push(args);}},[matrix]);assert.equal(foreign.length,1);
 stats=readShadowMatrixCacheDiagnostics(f.renderer).uniforms.directionalShadowMatrix;assert.equal(stats.delegatedSetterCalls,1);assert.equal(stats.nativeCalls,3);
 stop();stale.call(node,f.gl,[matrix]);stats=readShadowMatrixCacheDiagnostics(f.renderer).uniforms.directionalShadowMatrix;
 assert.equal(stats.setterCalls,6);assert.equal(stats.delegatedSetterCalls,2);assert.equal(stats.nativeCalls,3);
 assert.equal(f.shadowCalls().length,5,'stopped delegation is not reported as an intercepted upload');
});

test('diagnostic snapshots are detached and context event resets remain distinct from disposal',()=>{
 const f=fixture([shadow]),stop=installShadowMatrixCache(f.renderer);f.draw();f.draw();f.draw();
 const snapshot=readShadowMatrixCacheDiagnostics(f.renderer);snapshot.observedPrograms=99;snapshot.uniforms.directionalShadowMatrix.skippedCalls=99;
 let stats=readShadowMatrixCacheDiagnostics(f.renderer);assert.equal(stats.observedPrograms,1);assert.equal(stats.uniforms.directionalShadowMatrix.skippedCalls,1);
 f.renderer.domElement.dispatchEvent(new Event('webglcontextlost'));f.renderer.domElement.dispatchEvent(new Event('webglcontextrestored'));
 stats=readShadowMatrixCacheDiagnostics(f.renderer);assert.equal(stats.contextResets,2);assert.equal(stats.active,true);
 f.draw();f.draw();f.draw();stats=readShadowMatrixCacheDiagnostics(f.renderer);
 assert.equal(stats.observedPrograms,2);assert.equal(stats.observedUniforms,2);assert.equal(stats.uniforms.directionalShadowMatrix.observedUniforms,2);
 assert.equal(stats.uniforms.directionalShadowMatrix.nativeCalls,2);assert.equal(stats.uniforms.directionalShadowMatrix.skippedCalls,2);
 stop();stop();stats=readShadowMatrixCacheDiagnostics(f.renderer);assert.equal(stats.contextResets,2);assert.equal(stats.active,false);
 assert.equal(snapshot.contextResets,0,'a previous snapshot is not live mutable instrumentation');
});

test('per-uniform diagnostics reconcile with unchanged and live-mutated shadow/water payloads',()=>{
 const f=waterFixture([shadow,...namedWater]),stop=installShadowMatrixCache(f.renderer);for(let i=0;i<4;i++)f.draw();
 const before=readShadowMatrixCacheDiagnostics(f.renderer);assert.equal(before.observedUniforms,4);
 for(const [id,counts]of Object.entries(before.uniforms)){
  assert.equal(counts.observedUniforms,1);assert.equal(counts.setterCalls,3);assert.equal(counts.skippedCalls,2);assert.equal(counts.nativeCalls,1);
  assert.equal(f.calls.filter(c=>c.args[0].name===id+'[0]').length,counts.nativeCalls+1);
 }
 f.values.shipShape.value[0].x+=.25;f.draw();const after=readShadowMatrixCacheDiagnostics(f.renderer);
 for(const [id,counts]of Object.entries(after.uniforms)){
  assert.equal(counts.setterCalls,4);assert.equal(counts.nativeCalls,id==='shipShape'?2:1);assert.equal(counts.skippedCalls,id==='shipShape'?2:3);
  assert.equal(f.calls.filter(c=>c.args[0].name===id+'[0]').length,counts.nativeCalls+1);
 }
 stop();
});
