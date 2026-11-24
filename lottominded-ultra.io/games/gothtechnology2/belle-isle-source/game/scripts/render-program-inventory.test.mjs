import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {installRenderProgramInventory,inspectNativeMetalLaunch} from './render-program-inventory-browser.mjs';

// Exact SystemInfo command line retained by run45399812087/head36a3460d.
// Its executable path contains spaces and the fallback permission appears twice.
const observedNativeCommand='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --no-sandbox --enable-gpu --use-gl=angle --use-angle=metal --user-data-dir=/var/folders/9d/l02zfgrs7c16twd3wbpdmhkc0000gn/T/playwright_chromiumdev_profile-WQrOY6 --remote-debugging-pipe --no-startup-window --flag-switches-begin --flag-switches-end --enable-unsafe-swiftshader';
const observedNativeGpu=Object.freeze({auxAttributes:Object.freeze({displayType:'ANGLE_METAL',
  glImplementationParts:'(gl=egl-angle,angle=metal)',
  glRenderer:'ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device, Version 15.8.2 (Build 24H232))',
  glVendor:'Google Inc. (Apple)',glVersion:'OpenGL ES 3.0 (ANGLE 2.1.29257 git hash: 1f6526a566c2)'})});

test('exact retained native Metal launch accepts and records both fallback permissions without changing input evidence',()=>{
  const original=JSON.stringify(observedNativeGpu),proof=inspectNativeMetalLaunch(observedNativeCommand,observedNativeGpu);
  assert.equal(proof.valid,true);assert.deepEqual(proof.errors,[]);
  assert.equal(proof.swiftShaderFallbackCapability.present,true);assert.equal(proof.swiftShaderFallbackCapability.count,2);
  assert.deepEqual(proof.swiftShaderFallbackCapability.switches,['--enable-unsafe-swiftshader','--enable-unsafe-swiftshader']);
  assert.deepEqual(proof.nativeSwitches['--use-angle'].observed,['--use-angle=metal']);
  assert.equal(proof.systemBackend.displayType,'ANGLE_METAL');assert.equal(proof.systemBackend.glImplementationParts,'(gl=egl-angle,angle=metal)');
  assert.equal(proof.systemBackend.renderer,observedNativeGpu.auxAttributes.glRenderer);
  assert.equal(JSON.stringify(observedNativeGpu),original);
});

test('fallback permission presence is recorded independently and never substitutes for native backend proof',()=>{
  const without=observedNativeCommand.replaceAll(' --enable-unsafe-swiftshader','');
  for(const count of [0,1,2]){
    const command=without+' --enable-unsafe-swiftshader'.repeat(count),proof=inspectNativeMetalLaunch(command,observedNativeGpu);
    assert.equal(proof.valid,true);assert.equal(proof.swiftShaderFallbackCapability.count,count);
    assert.equal(proof.swiftShaderFallbackCapability.present,count>0);
    const missingBackend=inspectNativeMetalLaunch(command,undefined);
    assert.equal(missingBackend.valid,false);assert.equal(missingBackend.swiftShaderFallbackCapability.count,count);
  }
  const lookalike=inspectNativeMetalLaunch(without+' --enable-unsafe-swiftshader-extra',observedNativeGpu);
  assert.equal(lookalike.swiftShaderFallbackCapability.count,0);
  assert.equal(inspectNativeMetalLaunch(without+' --enable-unsafe-swiftshader=false',observedNativeGpu).valid,false);
});

test('forced software, disabled GPU and conflicting native switches remain rejected even when SystemInfo says Metal',()=>{
  for(const flag of ['--use-angle=swiftshader','--use-angle=swiftshader-webgl','--use-angle=default','--use-gl=swiftshader',
    '--use-gl=disabled','--override-use-software-gl-for-tests','--use-vulkan=swiftshader','--use-vulkan=native',
    '--disable-gpu','--disable-gpu=false','--disable-gpu-compositing','--disable-gpu-rasterization','--disable-webgl','--disable-webgl2']){
    const proof=inspectNativeMetalLaunch(observedNativeCommand+' '+flag,observedNativeGpu);
    assert.equal(proof.valid,false,flag);assert(proof.errors.length>0,flag);
  }
});

test('each required native switch must occur exactly once with its exact value',()=>{
  for(const flag of ['--enable-gpu','--use-gl=angle','--use-angle=metal']){
    assert.equal(inspectNativeMetalLaunch(observedNativeCommand.replace(' '+flag,''),observedNativeGpu).valid,false,'missing '+flag);
    assert.equal(inspectNativeMetalLaunch(observedNativeCommand+' '+flag,observedNativeGpu).valid,false,'duplicate '+flag);
  }
  for(const [from,to] of [['--enable-gpu','--enable-gpu=false'],['--use-gl=angle','--use-gl=desktop'],['--use-angle=metal','--use-angle=swiftshader-webgl']])
    assert.equal(inspectNativeMetalLaunch(observedNativeCommand.replace(' '+from,' '+to),observedNativeGpu).valid,false,to);
  const hidden=observedNativeCommand.replace(' --use-angle=metal','')+' --other-value=--use-angle=metal';
  assert.equal(inspectNativeMetalLaunch(hidden,observedNativeGpu).valid,false,'A switch name inside another value cannot satisfy the required switch');
});

test('observed backend must agree across SystemInfo fields and exclude software renderers',()=>{
  for(const change of [{displayType:'ANGLE_SWIFTSHADER'},{glImplementationParts:'(gl=egl-angle,angle=swiftshader)'},
    {glImplementationParts:null},{glRenderer:'ANGLE (Google, Vulkan SwiftShader)'},{glRenderer:'ANGLE Metal Renderer: SwiftShader'},
    {glRenderer:'ANGLE Metal Renderer: llvmpipe'},{glRenderer:'ANGLE Metal Renderer: softpipe'},{glRenderer:'ANGLE Metal Renderer: software rasterizer'},
    {glRenderer:null},{glRenderer:'Metal'}]){
    const proof=inspectNativeMetalLaunch(observedNativeCommand,{auxAttributes:{...observedNativeGpu.auxAttributes,...change}});
    assert.equal(proof.valid,false,JSON.stringify(change));assert(proof.errors.some(message=>message.includes('SystemInfo')));
  }
});

test('missing or ambiguous flattened command lines fail closed without coercion',()=>{
  let converted=0;
  for(const command of [null,undefined,[],{toString(){converted++;return observedNativeCommand;}},'',
    'x'.repeat(1048577),observedNativeCommand+'\n--disable-gpu',observedNativeCommand+' "--disable-gpu"',observedNativeCommand+' \\--disable-gpu'])
    assert.equal(inspectNativeMetalLaunch(command,observedNativeGpu).valid,false);
  assert.equal(converted,0);
});

const GL={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,FLOAT:5126,UNSIGNED_SHORT:5123,
  VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,LINK_STATUS:35714,ACTIVE_ATTRIBUTES:35721,SHADER_TYPE:35663};
const plain=value=>JSON.parse(JSON.stringify(value));
class Events {
  listeners=new Map();hidden=false;
  addEventListener(name,fn){let values=this.listeners.get(name);if(!values)this.listeners.set(name,values=new Set());values.add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  emit(name,value={}){for(const fn of [...(this.listeners.get(name)??[])])fn(value);}
}
function harness(options={}){
  const events=new Events(),document=new Events(),clock={value:0,throws:false};
  class FakeGl {
    calls=[];queries=[];currentProgram=null;drawFramebuffer=null;fail=new Map();nativeErrors=[];pendingErrors=[];extensions=new Map();
    record(name,args){this.calls.push({name,args,receiver:this});if(this.fail.has(name))throw this.fail.get(name);return 'native:'+name;}
    createProgram(){this.record('createProgram',[]);return {kind:'program',owner:this,attached:new Set(),linked:false,deleted:false,attributes:[{name:'position',size:1,type:35665,location:0}]};}
    createShader(type){this.record('createShader',[type]);return {kind:'shader',owner:this,type,source:'',compiled:'',deleted:false};}
    shaderSource(shader,source){const value=this.record('shaderSource',[shader,source]);shader.source=String(source);return value;}
    compileShader(shader){const value=this.record('compileShader',[shader]);shader.compiled=shader.source;return value;}
    attachShader(program,shader){const value=this.record('attachShader',[program,shader]);program.attached.add(shader);return value;}
    detachShader(program,shader){const value=this.record('detachShader',[program,shader]);program.attached.delete(shader);return value;}
    linkProgram(program){const value=this.record('linkProgram',[program]);program.linked=program.attached.size===2;return value;}
    deleteShader(shader){const value=this.record('deleteShader',[shader]);if(shader)shader.deleted=true;return value;}
    deleteProgram(program){const value=this.record('deleteProgram',[program]);if(program)program.deleted=true;return value;}
    useProgram(program){
      const value=this.record('useProgram',[program]);
      // Model WebGL's returned-but-rejected request without throwing.
      if(program!==null&&(program.owner!==this||!program.linked||program.deleted)){this.nativeErrors.push('INVALID_OPERATION');this.pendingErrors.push(1282);return value;}
      this.currentProgram=program;return value;
    }
    createBuffer(){this.record('createBuffer',[]);return {kind:'buffer',owner:this};}
    createVertexArray(){this.record('createVertexArray',[]);return {kind:'vao',owner:this};}
    createFramebuffer(){this.record('createFramebuffer',[]);return {kind:'framebuffer',owner:this};}
    bindFramebuffer(target,framebuffer){const value=this.record('bindFramebuffer',[target,framebuffer]);if(target===36160||target===36009)this.drawFramebuffer=framebuffer;return value;}
    deleteFramebuffer(framebuffer){const value=this.record('deleteFramebuffer',[framebuffer]);if(this.drawFramebuffer===framebuffer)this.drawFramebuffer=null;return value;}
    getExtension(name){this.record('getExtension',[name]);return this.extensions.get(String(name))??null;}
    query(name,args){this.queries.push({name,args});if(this.fail.has(name))throw this.fail.get(name);}
    getError(){this.query('getError',[]);return this.pendingErrors.shift()??0;}
    isContextLost(){this.query('isContextLost',[]);return false;}
    isProgram(program){this.query('isProgram',[program]);return program?.owner===this&&!program.deleted;}
    getProgramParameter(program,key){this.query('getProgramParameter',[program,key]);if(key===GL.LINK_STATUS)return program.linked;if(key===GL.ACTIVE_ATTRIBUTES)return program.attributes.length;throw Error('Unexpected query');}
    getAttachedShaders(program){this.query('getAttachedShaders',[program]);return [...program.attached];}
    getShaderParameter(shader,key){this.query('getShaderParameter',[shader,key]);assert.equal(key,GL.SHADER_TYPE);return shader.type;}
    getShaderSource(shader){this.query('getShaderSource',[shader]);return shader.source;}
    getActiveAttrib(program,index){this.query('getActiveAttrib',[program,index]);const {location,...attribute}=program.attributes[index];return attribute;}
    getAttribLocation(program,name){this.query('getAttribLocation',[program,name]);return program.attributes.find(value=>value.name===name)?.location??-1;}
  }
  for(const name of ['bindBuffer','deleteBuffer','bindVertexArray','deleteVertexArray','enableVertexAttribArray','disableVertexAttribArray','vertexAttribDivisor',
    'vertexAttribPointer','vertexAttribIPointer','vertexAttrib1f','vertexAttrib2f','vertexAttrib3f','vertexAttrib4f','vertexAttrib1fv','vertexAttrib2fv','vertexAttrib3fv','vertexAttrib4fv',
    'vertexAttribI4i','vertexAttribI4iv','vertexAttribI4ui','vertexAttribI4uiv','enable','disable','blendEquation','blendEquationSeparate','blendFunc','blendFuncSeparate',
    'cullFace','frontFace','depthMask','depthFunc','colorMask','drawArrays','drawElements','drawRangeElements','drawArraysInstanced','drawElementsInstanced']){
    Object.defineProperty(FakeGl.prototype,name,{value:function(...args){return this.record(name,args);},writable:true,configurable:true});
  }
  class Canvas extends Events {
    constructor(gl,id='game'){super();this.context=gl;this.id=id;}
    getContext(type){if(type==='webgl2')return this.context;return null;}
  }
  const context=vm.createContext({HTMLCanvasElement:Canvas,WebGL2RenderingContext:FakeGl,document,performance:{now(){if(clock.throws)throw clock.throws===true?Error('Clock unavailable'):clock.throws;return clock.value;}},
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),
    Int32Array,Uint32Array,Uint16Array,Uint8Array,Float32Array,ArrayBuffer,DataView});
  vm.runInContext('('+installRenderProgramInventory.toString()+')('+JSON.stringify({limits:options.limits??{}})+')',context);
  const gl=new FakeGl();if(options.beforeContext)options.beforeContext(gl);
  const canvas=new Canvas(gl,options.canvasId??'game');canvas.getContext('webgl2');
  const api=context.__belleProgramInventory;
  return {gl,canvas,api,clock,events,document,FakeGl,Canvas,context,
    start(){api.arm();clock.value=100;events.emit('keydown',{code:'KeyW',isTrusted:true,repeat:false});},
    stop(){clock.value=90100;events.emit('keyup',{code:'KeyW',isTrusted:true});},
    export(){return plain(api.exportEvidence());}};
}
function program(gl,name='Observed material'){
  const p=gl.createProgram(),vertex=gl.createShader(GL.VERTEX_SHADER),fragment=gl.createShader(GL.FRAGMENT_SHADER);
  gl.shaderSource(vertex,'#version 300 es\n#define SHADER_NAME '+name+'\nin vec3 position; void main(){gl_Position=vec4(position,1.0);}');
  gl.shaderSource(fragment,'#version 300 es\nprecision highp float;\n#define SHADER_NAME '+name+'\nout vec4 color; void main(){color=vec4(1.0);}');
  gl.compileShader(vertex);gl.compileShader(fragment);gl.attachShader(p,vertex);gl.attachShader(p,fragment);gl.linkProgram(p);
  gl.deleteShader(vertex);gl.deleteShader(fragment);return {p,vertex,fragment};
}
function geometry(gl,{location=0,size=3,type=GL.FLOAT,normalized=false,stride=12,offset=0,integer=false,divisor=0}={}){
  const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(GL.ARRAY_BUFFER,buffer);
  if(integer)gl.vertexAttribIPointer(location,size,type,stride,offset);else gl.vertexAttribPointer(location,size,type,normalized,stride,offset);
  gl.enableVertexAttribArray(location);gl.vertexAttribDivisor(location,divisor);return {vao,buffer};
}
function ready(options){const h=harness(options),p=program(h.gl),g=geometry(h.gl);h.gl.useProgram(p.p);return {...h,...p,...g};}
function multidraw(gl){
  const extension={calls:[]};
  for(const name of ['multiDrawArraysWEBGL','multiDrawElementsWEBGL','multiDrawArraysInstancedWEBGL','multiDrawElementsInstancedWEBGL'])
    extension[name]=function(...args){this.calls.push({name,args,receiver:this});return 'extension:'+name;};
  gl.extensions.set('WEBGL_multi_draw',extension);return gl.getExtension('WEBGL_multi_draw');
}

test('serialized init observes startup VAO/program, whole trusted interval and linked source after release without in-window queries',()=>{
  const h=ready();assert.equal(h.gl.queries.length,0);
  h.gl.drawArrays(4,0,3);assert.equal(h.api.summary().contexts[0].counts.drawCalls,0,'Startup draw must not count');
  h.start();assert.throws(()=>h.api.exportEvidence(),/introspection is forbidden/);
  assert.equal(h.gl.drawArrays(4,0,3),'native:drawArrays');h.clock.value=200;h.gl.drawElements(4,6,GL.UNSIGNED_SHORT,0);
  assert.equal(h.gl.queries.length,0,'Observer must not query native GL during capture');
  h.events.emit('keyup',{code:'KeyW',isTrusted:false});assert.equal(h.api.summary().status,'capturing');
  h.stop();const evidence=h.export();assert.equal(evidence.complete,true);assert.equal(evidence.releaseAccepted,false);assert.equal(evidence.performanceVerified,false);
  assert.equal(evidence.capture.durationMs,90000);assert.equal(evidence.capture.ignoredUntrusted,1);
  const c=evidence.contexts[0],p=c.programs[0];assert.equal(c.canvasId,'game');assert.equal(p.drawCalls,2);assert.equal(p.nativeLinked,true);
  assert.equal(p.nativeShaders.length,2);assert(p.nativeShaders.every(shader=>shader.source.includes('Observed material')));
  assert.deepEqual(p.activeAttributes,[{name:'position',size:1,type:35665,location:0,columns:1,arraySize:1,locationSpan:1,occupiedLocations:[0]}]);
  assert.equal(p.epochs[0].firstDrawMs,0);assert.equal(p.epochs[0].lastDrawMs,100);
  const count=h.gl.queries.length;assert.equal(h.api.exportEvidence(),h.api.exportEvidence());assert.equal(h.gl.queries.length,count,'Export is idempotent');
  h.gl.drawArrays(4,0,3);assert.equal(h.api.summary().contexts[0].counts.drawCalls,2,'Post-release draw must not count');
  h.api.dispose();
});

test('only nonempty draw-used programs are exported, not merely created, linked or useProgram-requested programs',()=>{
  const h=ready(),idle=program(h.gl,'Never drawn');h.start();h.gl.useProgram(idle.p);h.gl.drawArrays(4,0,0);h.gl.drawArraysInstanced(4,0,3,0);
  h.gl.useProgram(h.p);h.gl.drawArrays(4,0,3);h.stop();const e=h.export();assert.equal(e.complete,true);
  assert.equal(e.contexts[0].programsCreated,2);assert.equal(e.contexts[0].programs.length,1);assert.equal(e.contexts[0].programs[0].id,1);
  assert.equal(e.contexts[0].counts.noOpDrawCalls,2);h.api.dispose();
});

test('returned useProgram of an unlinked handle cannot count as verified accepted binding',()=>{
  const h=ready(),unlinked=h.gl.createProgram();h.start();assert.equal(h.gl.useProgram(unlinked),'native:useProgram');
  assert.equal(h.gl.currentProgram,h.p,'Fake native GL rejected the request without throwing');h.gl.drawArrays(4,0,3);h.stop();
  const e=h.export();assert.equal(e.complete,false);assert.equal(e.contexts[0].counts.unknownProgramDraws,1);assert.deepEqual(h.gl.nativeErrors,['INVALID_OPERATION']);h.api.dispose();
});

test('a foreign context program handle and null binding remain unknown/unbound, never the previous program',()=>{
  const h=ready(),other=new h.FakeGl(),foreign=other.createProgram();foreign.linked=true;
  h.start();h.gl.useProgram(foreign);h.gl.drawArrays(4,0,3);h.gl.useProgram(null);h.gl.drawArrays(4,0,3);h.stop();
  const e=h.export();assert.equal(e.complete,false);assert.equal(e.contexts[0].counts.unknownProgramDraws,2);assert(e.drops['unknown-program']>0);h.api.dispose();
});

test('borrowed wrappers preserve original receiver, arguments, native return and original thrown object',()=>{
  const h=ready(),other=new h.FakeGl();h.start();const draw=h.gl.drawArrays,args=[4,2,7];
  assert.equal(Reflect.apply(draw,other,args),'native:drawArrays');assert.equal(other.calls.at(-1).receiver,other);assert.deepEqual(other.calls.at(-1).args,args);
  const original={reason:'native failure'};h.gl.fail.set('drawArrays',original);
  assert.throws(()=>h.gl.drawArrays(...args),value=>value===original);h.stop();const e=h.export();
  assert.equal(e.complete,false);assert.equal(e.contexts[0].counts.foreignReceiverCalls,1);assert.equal(e.contexts[0].counts.drawThrows,1);h.api.dispose();
});

test('borrowed context mutation before capture invalidates seeded state instead of silently reporting a stale program',()=>{
  const h=ready(),other=new h.FakeGl(),canvas=new h.Canvas(other,'preview');canvas.getContext('webgl2');const second=program(other);geometry(other);
  Reflect.apply(h.gl.useProgram,other,[second.p]);assert.equal(other.currentProgram,second.p);
  h.start();h.gl.drawArrays(4,0,3);other.drawArrays(4,0,3);h.stop();const e=h.export();
  assert.equal(e.complete,false);assert.equal(e.contexts[0].foreignReceiverLifetime,1);assert(e.errors.some(value=>value.where==='useProgram'));h.api.dispose();
});

test('direct borrowed WebGL prototype entry points preserve native behavior but cannot silently evade coverage',()=>{
  const h=ready(),next=program(h.gl,'Second program');
  assert.equal(Reflect.apply(h.FakeGl.prototype.useProgram,h.gl,[next.p]),'native:useProgram');assert.equal(h.gl.currentProgram,next.p);
  h.start();h.gl.useProgram(h.p);h.gl.drawArrays(4,0,3);assert.equal(Reflect.apply(h.FakeGl.prototype.drawArrays,h.gl,[4,0,3]),'native:drawArrays');h.stop();
  const e=h.export();assert.equal(e.complete,false);assert(e.errors.some(value=>value.where==='prototype.useProgram'));assert(e.errors.some(value=>value.where==='prototype.drawArrays'));h.api.dispose();
});

test('deleting the bound framebuffer restores the default target proxy and deleting a referenced buffer cannot retain a valid layout',async t=>{
  await t.test('framebuffer',()=>{const h=ready(),fbo=h.gl.createFramebuffer();h.gl.bindFramebuffer(36160,fbo);h.start();assert.equal(h.gl.drawFramebuffer,fbo);h.gl.drawArrays(4,0,3);h.gl.deleteFramebuffer(fbo);
    assert.equal(h.gl.drawFramebuffer,null,'Independent native binding resets on deletion');h.gl.drawArrays(4,0,3);h.stop();const e=h.export();
    assert.equal(e.complete,true);assert.deepEqual(e.contexts[0].combinations.map(value=>value.target),['offscreen','default']);h.api.dispose();});
  await t.test('buffer',()=>{const h=ready();h.start();h.gl.drawArrays(4,0,3);h.gl.deleteBuffer(h.buffer);h.gl.drawArrays(4,0,3);h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.contexts[0].counts.unknownLayoutDraws,1);h.api.dispose();});
});

test('observer failure cannot prevent or replace an original native return',()=>{
  const h=ready();h.start();h.clock.throws=true;assert.equal(h.gl.drawArrays(4,0,3),'native:drawArrays');h.clock.throws=false;
  h.stop();const e=h.export();assert.equal(e.complete,false);assert(e.observerErrors>0);assert.equal(h.gl.calls.filter(call=>call.name==='drawArrays').length,1);h.api.dispose();
});

test('an observer exception with a throwing message accessor is itself safely recorded',()=>{
  const h=ready();h.start();h.clock.throws=Object.create(null,{message:{get(){throw Error('No message access');}}});
  assert.equal(h.gl.drawArrays(4,0,3),'native:drawArrays');h.clock.throws=false;h.stop();const e=h.export();
  assert.equal(e.complete,false);assert(e.errors.some(value=>value.message==='Unprintable observer error'));h.api.dispose();
});

test('unusual native arguments are not coerced a second time by the observer',()=>{
  const h=harness();let coerced=0;const value={toString(){coerced++;return 'void main(){}';}},shader=h.gl.createShader(GL.VERTEX_SHADER);
  assert.equal(h.gl.shaderSource(shader,value),'native:shaderSource');assert.equal(coerced,1);
  const name={toString(){coerced++;return 'WEBGL_multi_draw';}},extension={};h.gl.extensions.set('WEBGL_multi_draw',extension);
  assert.equal(h.gl.getExtension(name),extension);assert.equal(coerced,2);assert.equal(h.api.summary().drops['nonStringShaderSource'],1);
  assert.equal(h.api.summary().drops['non-string-extension-name'],1);h.api.dispose();
});

test('enum conversion runs only in the native function, never again in enable or vertex-format observation',()=>{
  let coercions=0;const h=harness({beforeContext(gl){
    gl.enable=function(value){Number(value);return this.record('enable',[value]);};
    gl.vertexAttribPointer=function(index,size,type,normalized,stride,offset){Number(type);return this.record('vertexAttribPointer',[index,size,type,normalized,stride,offset]);};
  }});
  const value={valueOf(){coercions++;return 3042;}};assert.equal(h.gl.enable(value),'native:enable');assert.equal(coercions,1);
  const buffer=h.gl.createBuffer();h.gl.bindBuffer(GL.ARRAY_BUFFER,buffer);const type={valueOf(){coercions++;return GL.FLOAT;}};
  assert.equal(h.gl.vertexAttribPointer(0,3,type,false,12,0),'native:vertexAttribPointer');assert.equal(coercions,2);
  assert.equal(h.api.summary().drops['non-primitive-enable-capability'],1);assert.equal(h.api.summary().drops['invalid-attribute-pointer'],1);h.api.dispose();
});

test('deleted but attached shaders remain valid for native source verification',()=>{
  const h=ready();assert.equal(h.vertex.deleted,true);assert.equal(h.fragment.deleted,true);h.start();h.gl.drawArrays(4,0,3);h.stop();
  const e=h.export();assert.equal(e.complete,true);assert.equal(e.contexts[0].programs[0].nativeShaders.length,2);h.api.dispose();
});

test('source-at-compile is distinct from later shaderSource and source mutation after release invalidates provenance',()=>{
  const h=ready();h.start();h.gl.drawArrays(4,0,3);h.stop();const initial=h.vertex.source;
  h.gl.shaderSource(h.vertex,'#version 300 es\nvoid main(){gl_Position=vec4(0.0);}');
  const e=h.export(),p=e.contexts[0].programs[0];assert.equal(e.complete,false);assert.equal(p.epochs[0].shaders[0].source,initial);
  assert.equal(p.nativeShaders[0].source,h.vertex.source);assert.match(p.errors[0],/source\/compile epoch changed/);h.api.dispose();
});

test('recompile without source changes still changes the compiled epoch and cannot relabel prior linked draws',()=>{
  const h=ready();h.start();h.gl.drawArrays(4,0,3);h.gl.compileShader(h.vertex);h.stop();const e=h.export();
  assert.equal(e.complete,false);assert.match(e.contexts[0].programs[0].errors[0],/source\/compile epoch changed/);h.api.dispose();
});

test('multiple drawn link epochs and attach/detach mutation preserve partial sources and fail closed',async t=>{
  await t.test('relink',()=>{const h=ready();h.start();h.gl.drawArrays(4,0,3);h.gl.linkProgram(h.p);h.gl.drawArrays(4,0,3);h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.deepEqual(e.contexts[0].programs[0].epochs.map(epoch=>epoch.epoch),[1,2]);assert.match(e.contexts[0].programs[0].errors[0],/relinked/);h.api.dispose();});
  await t.test('attachment changes',()=>{const h=ready();h.start();h.gl.drawArrays(4,0,3);h.stop();h.gl.detachShader(h.p,h.vertex);h.gl.attachShader(h.p,h.vertex);const e=h.export();
    assert.equal(e.complete,false);assert.match(e.contexts[0].programs[0].errors[0],/attachments changed/);h.api.dispose();});
});

test('draw-used deleted program, unavailable source and context loss retain explicit failure records',async t=>{
  for(const kind of ['program','query','context'])await t.test(kind,()=>{
    const h=ready();h.start();h.gl.drawArrays(4,0,3);h.stop();
    if(kind==='program')h.gl.deleteProgram(h.p);else if(kind==='query')h.gl.fail.set('getShaderSource',Error('Driver source query failed'));else h.canvas.emit('webglcontextlost');
    const e=h.export();assert.equal(e.complete,false);assert.equal(e.contexts[0].programs[0].epochs[0].drawCalls,1);
    if(kind!=='context')assert(e.sourceValidationErrors.length>0);else assert.equal(e.contexts[0].lost,1);h.api.dispose();
  });
});

test('VAO bindings select their own normalized/integer/divisor layouts while buffer identity and offsets do not invent formats',()=>{
  const h=ready(),a=h.vao,b=geometry(h.gl,{size:4,type:GL.UNSIGNED_SHORT,normalized:true,stride:8,offset:24,divisor:2}).vao;
  h.start();h.gl.bindVertexArray(a);h.gl.drawArrays(4,0,3);h.gl.bindVertexArray(b);h.gl.drawArraysInstanced(4,0,3,2);
  const next=h.gl.createBuffer();h.gl.bindBuffer(GL.ARRAY_BUFFER,next);h.gl.vertexAttribPointer(0,4,GL.UNSIGNED_SHORT,true,8,88);h.gl.drawArrays(4,0,3);
  h.gl.vertexAttribIPointer(0,4,GL.UNSIGNED_SHORT,8,88);h.gl.drawArrays(4,0,3);h.stop();const e=h.export(),c=e.contexts[0];
  assert.equal(e.complete,true);assert.equal(c.layouts.length,3);const attrs=c.layouts.map(layout=>layout.attributes.find(a=>a.location===0));
  assert.deepEqual(attrs.map(a=>[a.size,a.type,a.normalized,a.integer,a.divisor]),[[3,5126,false,false,0],[4,5123,true,false,2],[4,5123,false,true,2]]);
  assert(!Object.hasOwn(attrs[1],'buffer'));assert(!Object.hasOwn(attrs[1],'offset'));h.api.dispose();
});

test('disabled generic integer attributes are retained separately from array pointers',()=>{
  const h=ready();h.start();h.gl.drawArrays(4,0,3);h.gl.disableVertexAttribArray(0);h.gl.vertexAttribI4ui(0,2,3,4,5);h.gl.drawArrays(4,0,3);h.stop();
  const e=h.export();assert.equal(e.complete,true);assert.deepEqual(e.contexts[0].layouts[1].attributes[0],{location:0,enabled:false,genericType:'uint'});h.api.dispose();
});

test('normal WEBGL_multi_draw variants record actual nonempty subdraws without calling another native renderer method',()=>{
  const h=ready(),ext=multidraw(h.gl),counts=new Int32Array([3,0,6]),firsts=new Int32Array([0,0,0]),instances=new Int32Array([2,4,0]);
  h.start();
  assert.equal(ext.multiDrawArraysWEBGL(4,firsts,0,counts,0,3),'extension:multiDrawArraysWEBGL');
  ext.multiDrawElementsWEBGL(4,counts,0,GL.UNSIGNED_SHORT,firsts,0,3);
  ext.multiDrawArraysInstancedWEBGL(4,firsts,0,counts,0,instances,0,3);
  ext.multiDrawElementsInstancedWEBGL(4,counts,0,GL.UNSIGNED_SHORT,firsts,0,instances,0,3);
  h.stop();const e=h.export(),c=e.contexts[0];assert.equal(e.complete,true);assert.equal(c.counts.drawCalls,4);assert.equal(c.counts.subdraws,6);
  assert.equal(c.programs[0].drawCalls,4);assert.equal(ext.calls.length,4);assert.equal(h.gl.calls.filter(call=>call.name==='drawArrays').length,0);h.api.dispose();
});

test('missing extension methods, unknown VAO and invalid multidraw bounds fail closed without suppressing originals',async t=>{
  await t.test('extension coverage',()=>{const h=ready();h.gl.extensions.set('WEBGL_multi_draw',{multiDrawArraysWEBGL(){return 42;}});const ext=h.gl.getExtension('WEBGL_multi_draw');
    h.start();assert.equal(ext.multiDrawArraysWEBGL(4,new Int32Array([0]),0,new Int32Array([3]),0,1),42);h.stop();const e=h.export();assert.equal(e.complete,false);assert(e.hooks.some(h=>!h.installed));h.api.dispose();});
  await t.test('unknown VAO',()=>{const h=ready();h.start();h.gl.bindVertexArray({});assert.equal(h.gl.drawArrays(4,0,3),'native:drawArrays');h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.contexts[0].counts.unknownLayoutDraws,1);h.api.dispose();});
  await t.test('multidraw bounds',()=>{const h=ready(),ext=multidraw(h.gl);h.start();ext.multiDrawArraysWEBGL(4,new Int32Array([0]),0,new Int32Array([3]),0,2);h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.drops['multi-draw-counts'],1);assert.equal(ext.calls.length,1);h.api.dispose();});
});

test('limits explicitly reject incomplete program, layout, combination, event and source inventories',async t=>{
  await t.test('program',()=>{const h=ready({limits:{programs:1}});program(h.gl,'Overflow');h.start();h.gl.drawArrays(4,0,3);h.stop();const e=h.export();assert.equal(e.complete,false);assert.equal(e.drops.programs,1);h.api.dispose();});
  await t.test('layout',()=>{const h=ready({limits:{layouts:1}});h.start();h.gl.drawArrays(4,0,3);h.gl.vertexAttribPointer(0,3,GL.FLOAT,false,24,0);h.gl.drawArrays(4,0,3);h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.drops.layouts,1);assert.equal(e.contexts[0].programs[0].drawCalls,2);h.api.dispose();});
  await t.test('combination',()=>{const h=ready({limits:{combinations:1}});h.start();h.gl.drawArrays(4,0,3);h.gl.enable(3042);h.gl.drawArrays(4,0,3);h.stop();const e=h.export();assert.equal(e.complete,false);assert.equal(e.drops.combinations,1);h.api.dispose();});
  await t.test('event',()=>{const h=ready({limits:{events:1}});h.start();for(let i=0;i<257;i++)h.gl.drawArrays(4,0,3);h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.drops.events,1);assert.equal(e.contexts[0].counts.drawCalls,257);assert.equal(e.contexts[0].counts.unsampledDrawEvents,255);h.api.dispose();});
  await t.test('source',()=>{const h=ready({limits:{shaderCharacters:8}});h.start();h.gl.drawArrays(4,0,3);h.stop();const e=h.export();assert.equal(e.complete,false);assert(e.drops.shaderCharacters>0);assert.equal(e.contexts[0].programs[0].nativeShaders[0].source,null);h.api.dispose();});
});

test('fixed-stride events preserve complete aggregate counts and declared sampling policy',()=>{
  const h=ready();h.start();for(let i=0;i<257;i++){h.clock.value=100+i;h.gl.drawArrays(4,0,3);}h.stop();const e=h.export();
  assert.equal(e.complete,true);assert.deepEqual(e.contexts[0].events.map(event=>event.drawOrdinal),[1,257]);
  assert.equal(e.contexts[0].programs[0].drawCalls,257);assert.equal(e.contexts[0].combinations[0].calls,257);assert.equal(e.eventSampling.stride,256);h.api.dispose();
});

test('main-canvas identity is required and separate observed contexts are kept distinct',()=>{
  const h=harness({canvasId:'preview'});assert.throws(()=>h.api.arm(),/Main game context/);
  const gl=new h.FakeGl(),canvas=new h.Canvas(gl,'game');canvas.getContext('webgl2');const p=program(gl);geometry(gl);gl.useProgram(p.p);
  h.start();gl.drawArrays(4,0,3);h.stop();const e=h.export();assert.equal(e.complete,true);assert.equal(e.contexts.length,2);
  assert.equal(e.contexts[0].programs.length,0);assert.equal(e.contexts[1].canvasId,'game');assert.equal(e.contexts[1].programs[0].id,1);h.api.dispose();
});

test('unused disposed preview is excluded even when its loss notification arrives during capture, while a draw-used preview remains relevant',async t=>{
  for(const timing of ['before','during','used'])await t.test(timing,()=>{
    const h=ready(),gl=new h.FakeGl(),preview=new h.Canvas(gl,'preview');preview.getContext('webgl2');const p=program(gl);geometry(gl);gl.useProgram(p.p);
    gl.fail.set('isContextLost',Error('Unused preview must never be queried'));
    if(timing==='before')preview.emit('webglcontextlost');
    h.start();h.gl.drawArrays(4,0,3);
    if(timing==='used'){gl.fail.delete('isContextLost');gl.drawArrays(4,0,3);}
    if(timing!=='before')preview.emit('webglcontextlost');
    h.stop();const e=h.export(),item=e.contexts[1];
    assert.equal(e.complete,timing!=='used');assert.equal(item.lost,1);
    assert.equal(item.requiredForCapture,timing==='used');
    if(timing!=='used'){assert.equal(item.nativeExportStatus,'not-queried-unused-context');assert.equal(gl.queries.length,0);}
    else assert.equal(item.programs[0].drawCalls,1);
    h.api.dispose();
  });
});

test('active attribute matrix columns and array elements export every occupied location',()=>{
  const h=ready();h.p.attributes=[{name:'position',size:1,type:35665,location:0},{name:'instanceMatrix',size:1,type:35676,location:3},{name:'transforms[0]',size:2,type:35675,location:8}];
  h.start();h.gl.drawArrays(4,0,3);h.stop();const e=h.export();assert.equal(e.complete,true);
  const attrs=e.contexts[0].programs[0].activeAttributes;assert.deepEqual(attrs[1].occupiedLocations,[3,4,5,6]);assert.equal(attrs[1].columns,4);
  assert.deepEqual(attrs[2].occupiedLocations,[8,9,10,11,12,13]);assert.equal(attrs[2].arraySize,2);assert.equal(attrs[2].locationSpan,6);h.api.dispose();
});

test('post-window native errors are retained and rejected, with bounded draining and no queries during capture',async t=>{
  await t.test('nonzero flag',()=>{
    const h=ready();h.start();h.gl.drawArrays(4,0,3);h.gl.pendingErrors.push(1281);assert.equal(h.gl.queries.length,0);h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.deepEqual(e.contexts[0].nativeErrorChecks.beforeMetadata.flags,[1281]);
    assert.equal(e.contexts[0].nativeErrorChecks.beforeMetadata.reachedNoError,true);assert(e.sourceValidationErrors.some(value=>value.message.includes('1281')));h.api.dispose();
  });
  await t.test('bounded drain',()=>{
    const h=ready();h.start();h.gl.drawArrays(4,0,3);h.gl.pendingErrors.push(...Array(100).fill(1282));h.stop();const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.contexts[0].nativeErrorChecks.beforeMetadata.calls,8);assert.equal(e.contexts[0].nativeErrorChecks.afterMetadata.calls,8);
    assert.equal(e.contexts[0].nativeErrorChecks.beforeMetadata.reachedNoError,false);assert.equal(h.gl.queries.filter(value=>value.name==='getError').length,16);h.api.dispose();
  });
  await t.test('query throws',()=>{
    const h=ready();h.start();h.gl.drawArrays(4,0,3);h.stop();h.gl.fail.set('getError',Error('Error query unavailable'));const e=h.export();
    assert.equal(e.complete,false);assert.equal(e.contexts[0].programs[0].drawCalls,1);assert.match(e.contexts[0].nativeErrorChecks.beforeMetadata.error,/unavailable/);h.api.dispose();
  });
});

test('capture interruption, aborted cleanup and changed hook bindings never become a complete report',async t=>{
  await t.test('blur',()=>{const h=ready();h.start();h.gl.drawArrays(4,0,3);h.events.emit('blur');h.stop();const e=h.export();assert.equal(e.complete,false);assert.equal(e.capture.blurs,1);h.api.dispose();});
  await t.test('aborted partial',()=>{const h=ready();h.start();h.gl.drawArrays(4,0,3);h.api.abort('Test interruption');const e=h.export();assert.equal(e.complete,false);assert.equal(e.status,'aborted');assert.equal(e.contexts[0].programs[0].drawCalls,1);h.api.dispose();});
  await t.test('replacement hook',()=>{const h=ready();h.start();h.gl.drawArrays(4,0,3);h.stop();const replacement=()=>99;h.gl.drawArrays=replacement;const e=h.export();
    assert.equal(e.complete,false);const cleanup=h.api.dispose();assert(cleanup.failures.length>0);assert.equal(h.gl.drawArrays,replacement,'Do not overwrite a later owner');});
});

test('cleanup restores native functions once and removes event listeners without changing retained evidence',()=>{
  const h=ready();h.start();h.gl.drawArrays(4,0,3);h.stop();const evidence=h.api.exportEvidence();const result=h.api.dispose();
  assert.deepEqual(plain(result),{disposed:true,failures:[]});assert.equal(Object.hasOwn(h.gl,'drawArrays'),false);assert.deepEqual(plain(h.api.dispose()),{disposed:true});
  assert.equal(h.events.listeners.get('keydown').size,0);assert.equal(h.events.listeners.get('keyup').size,0);assert.equal(h.canvas.listeners.get('webglcontextlost').size,0);
  assert.equal(evidence.complete,true);assert.equal(h.gl.drawArrays(4,0,3),'native:drawArrays');
});
