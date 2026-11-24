/** Native correctness/binding fixture. Never gameplay or release acceptance. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createServer} from 'vite';
import {build,transform} from 'esbuild';

async function httpModuleImports(body){
 const result=await build({stdin:{contents:body,loader:'js',sourcefile:'observed-http-response.mjs'},bundle:true,write:false,metafile:true,format:'esm',external:['*'],treeShaking:false,logLevel:'silent'});
 return Object.values(result.metafile.inputs).flatMap(input=>input.imports).map(({path,kind})=>({path,kind}));
}
function canonicalAdapterImport(imports,moduleUrl){
 const candidates=imports.filter(row=>/sharedGeometryBuffers\.ts|geometry-adapter\.mjs/.test(new URL(row.path,moduleUrl).pathname));
 assert.equal(candidates.length,1,'Exactly one actual adapter module import required');
 return new URL(candidates[0].path,moduleUrl).href;
}

function pixelDifference(a,b){
 if(a.length!==b.length)throw Error('Pixel byte lengths differ');
 let changedPixels=0,maxChannelDifference=0;
 for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);changed||=d!==0;maxChannelDifference=Math.max(maxChannelDifference,d);}if(changed)changedPixels++;}
 return {changedPixels,maxChannelDifference};
}
function scalarFromBytes(bytes,offset,type,normalized){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const readers={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5124:['getInt32',4,2147483647],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};
 const format=readers[type];if(!format||offset<0||offset+format[1]>bytes.length)throw Error('Unobserved or out-of-range vertex/index storage');
 let value=view[format[0]](offset,true);
 if(normalized&&type!==5126)value=Math.max(-1,value/format[2]);
 if(!Number.isFinite(value))throw Error('Nonfinite fixture vertex data');
 return value;
}
function copiedUpload(data,offset=0,length){
 if(typeof data==='number'){if(!Number.isSafeInteger(data)||data<0||data>4*1024*1024)throw Error('Fixture buffer bound exceeded');return new Uint8Array(data);}
 const unit=data.BYTES_PER_ELEMENT||1,start=(data.byteOffset||0)+offset*unit;
 const size=length===undefined||length===0?data.byteLength-offset*unit:length*unit;
 if(!Number.isSafeInteger(size)||size<0||size>4*1024*1024)throw Error('Fixture upload bound exceeded');
 return new Uint8Array(data.buffer||data,start,size).slice();
}

async function fixtureMain(){
 const T=await import('three');
 const {installSharedGeometryBuffers,registerSharedGeometryShader}=await import('/geometry-adapter.mjs');
 const {WorldAtmosphere}=await import('/src/belle/worldAtmosphere.ts');
 const width=384,height=256,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const check=(condition,message)=>{if(!condition)throw Error(message);};
 const result=window.__sharedGeometryResult={version:1,passed:false,trustedStart:false,width,height,threeRevision:T.REVISION,
  contexts:[],contextLifecycle:[],preparations:[],cases:[],controls:[],coverage:{},errors:[],expectedCaseCount:30,currentStep:null,
  scope:'Exact native pixels and effective vertex/index command semantics plus actual VAO/buffer observations. Readback fences, mirrored buffers and verification overhead are confined to this fixture; no performance claim.'};
 const pixelsOut=window.__sharedGeometryPixels={};
 const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const base64=bytes=>{let value='';for(let at=0;at<bytes.length;at+=8192)value+=String.fromCharCode(...bytes.subarray(at,at+8192));return btoa(value);};
 function hook(owner,name,make,restores){
  const original=owner[name],descriptor=Object.getOwnPropertyDescriptor(owner,name);check(typeof original==='function','Missing native method '+name);
  const wrapped=make(original);Object.defineProperty(owner,name,descriptor?{...descriptor,value:wrapped}:{value:wrapped,writable:true,configurable:true});
  check(owner[name]===wrapped,'Observation hook did not install '+name);
  restores.push(()=>{if(owner[name]!==wrapped)return;if(descriptor)Object.defineProperty(owner,name,descriptor);else delete owner[name];});
 }
 function observe(renderer){
  const gl=renderer.getContext(),restores=[];
  let active=false,scope=null,shadowDepth=0,shadowOwner=null,shadowRestore=()=>{},epoch=0;
  let buffers,vaos,programs,currentVao,arrayBuffer,currentProgram,sequence,entries,binds,draws,unattributed;
  const reset=()=>{buffers=new Map();vaos=new Map([[null,{id:0,attributes:new Map(),element:null}]]);programs=new Map();currentVao=null;arrayBuffer=null;currentProgram=null;epoch++;};reset();
  const buffer=value=>{if(value===null)return null;let row=buffers.get(value);if(!row){row={id:buffers.size+1,bytes:null,deleted:false};buffers.set(value,row);}return row;};
  const vao=value=>{let row=vaos.get(value);if(!row){row={id:vaos.size,attributes:new Map(),element:null};vaos.set(value,row);}return row;};
  const program=value=>{if(value===null)return null;let row=programs.get(value);if(!row){row={id:programs.size+1,attributes:new Map()};programs.set(value,row);}return row;};
  const bound=target=>target===gl.ARRAY_BUFFER?arrayBuffer:target===gl.ELEMENT_ARRAY_BUFFER?vao(currentVao).element:null;
  hook(gl,'bindVertexArray',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl){currentVao=args[0];vao(currentVao);if(active)binds.push({vao:vao(currentVao).id,returned:true});}return value;},restores);
  hook(gl,'bindBuffer',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl){buffer(args[1]);if(args[0]===gl.ARRAY_BUFFER)arrayBuffer=args[1];else if(args[0]===gl.ELEMENT_ARRAY_BUFFER)vao(currentVao).element=args[1];}return value;},restores);
  hook(gl,'bufferData',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl&&(args[0]===gl.ARRAY_BUFFER||args[0]===gl.ELEMENT_ARRAY_BUFFER)){const row=buffer(bound(args[0]));check(row,'Unobserved bufferData binding');row.bytes=copiedUpload(args[1],args[3]||0,args[4]);row.deleted=false;}return value;},restores);
  hook(gl,'bufferSubData',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl&&(args[0]===gl.ARRAY_BUFFER||args[0]===gl.ELEMENT_ARRAY_BUFFER)){const row=buffer(bound(args[0])),data=copiedUpload(args[2],args[3]||0,args[4]);check(row?.bytes&&args[1]>=0&&args[1]+data.length<=row.bytes.length,'Unobserved bufferSubData storage');row.bytes.set(data,args[1]);}return value;},restores);
  hook(gl,'deleteBuffer',original=>function(...args){const value=Reflect.apply(original,this,args);const row=buffers.get(args[0]);if(this===gl&&row)row.deleted=true;return value;},restores);
  for(const name of ['enableVertexAttribArray','disableVertexAttribArray'])hook(gl,name,original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl){const row=vao(currentVao).attributes.get(args[0])||{};row.enabled=name==='enableVertexAttribArray';vao(currentVao).attributes.set(args[0],row);}return value;},restores);
  for(const name of ['vertexAttribPointer','vertexAttribIPointer'])hook(gl,name,original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl){const old=vao(currentVao).attributes.get(args[0])||{};vao(currentVao).attributes.set(args[0],{...old,buffer:arrayBuffer,size:args[1],type:args[2],normalized:name==='vertexAttribPointer'&&args[3],stride:args[name==='vertexAttribPointer'?4:3],offset:args[name==='vertexAttribPointer'?5:4]});}return value;},restores);
  hook(gl,'vertexAttribDivisor',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl){const old=vao(currentVao).attributes.get(args[0])||{};vao(currentVao).attributes.set(args[0],{...old,divisor:args[1]});}return value;},restores);
  hook(gl,'useProgram',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl){currentProgram=args[0];program(currentProgram);}return value;},restores);
  hook(gl,'getAttribLocation',original=>function(...args){const value=Reflect.apply(original,this,args);if(this===gl&&value>=0)program(args[0]).attributes.set(value,String(args[1]));return value;},restores);
  function capture(method,args){
   check(draws.length<256,'Fixture native draw bound exceeded');
   if(!scope){unattributed++;return null;}
   const indexed=/Elements/.test(method),count=args[indexed?1:2],first=indexed?0:args[1],instances=/Instanced/.test(method)?args[indexed?4:3]:1;
   check(Number.isInteger(count)&&count>=0&&count<=12000&&instances===1,'Fixture primitive count/instance bound exceeded');
   const state=vao(currentVao),p=program(currentProgram);check(p&&p.attributes.size,'Native active attribute locations were not observed');
   let indices;
   if(indexed){const b=buffer(state.element),type=args[2],unit=type===gl.UNSIGNED_SHORT?2:type===gl.UNSIGNED_INT?4:type===gl.UNSIGNED_BYTE?1:0;
    check(b?.bytes&&!b.deleted&&unit,'Actual native index-buffer bytes are unavailable');indices=Array.from({length:count},(_,i)=>scalarFromBytes(b.bytes,args[3]+i*unit,type,false));
   }else indices=Array.from({length:count},(_,i)=>first+i);
   const attributes={},bindings={};
   for(const [location,name]of [...p.attributes].sort((a,b)=>a[1].localeCompare(b[1]))){
    const attr=state.attributes.get(location);check(attr?.enabled&&attr.buffer&&!(attr.divisor>0),'Fixture requires observed noninstanced enabled attributes: '+name);
    const b=buffer(attr.buffer),unit=attr.type===gl.FLOAT||attr.type===gl.INT||attr.type===gl.UNSIGNED_INT?4:attr.type===gl.SHORT||attr.type===gl.UNSIGNED_SHORT?2:1;
    check(b?.bytes&&!b.deleted,'Actual native attribute-buffer bytes are unavailable');
    const stride=attr.stride||attr.size*unit;
    attributes[name]=indices.flatMap(index=>Array.from({length:attr.size},(_,component)=>scalarFromBytes(b.bytes,attr.offset+index*stride+component*unit,attr.type,attr.normalized)));
    bindings[name]={buffer:b.id,size:attr.size,type:attr.type,normalized:!!attr.normalized,stride:attr.stride,offset:attr.offset};
   }
   const entry=entries.get(scope.object.id),pooled=!!entry&&entry.sharedGeometryId===scope.geometry.id;
   const vertexOffset=pooled?entry.vertexOffset:0;
   const semantic={phase:scope.phase,camera:scope.camera.name||scope.camera.type,object:scope.object.name,
    material:scope.sourceMaterial.name,actualMaterialType:scope.material.type,mode:args[0],count,instances,
    sourceIndices:indices.map(index=>index-vertexOffset),attributes,
    world:Array.from(scope.object.matrixWorld.elements),projection:Array.from(scope.camera.projectionMatrix.elements),view:Array.from(scope.camera.matrixWorldInverse.elements)};
   return {sequence:++sequence,method,args:Array.from(args),returned:false,semantic,
    binding:{epoch,vao:state.id,program:p.id,indexBuffer:indexed?buffer(state.element).id:null,attributes:bindings},
    geometry:{actualId:scope.geometry.id,sourceObjectId:scope.object.id,pooled,vertexOffset,
     sharedGeometryId:pooled?entry.sharedGeometryId:null,sourceGeometryId:entry?.sourceGeometryId??null}};
  }
  for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])hook(gl,name,original=>function(...args){
   const row=active&&this===gl?capture(name,args):null;
   try{const value=Reflect.apply(original,this,args);if(row)row.returned=true;return value;}finally{if(row)draws.push(row);}
  },restores);
  hook(renderer,'renderBufferDirect',original=>function(...args){
   if(!active)return Reflect.apply(original,this,args);
   const previous=scope,[camera,,geometry,material,object]=args;
   check(!Array.isArray(object.material),'Fixture command owner requires one source material');
   scope={camera,geometry,material,object,sourceMaterial:object.material,
    phase:shadowDepth?'shadow':renderer.getRenderTarget()?'offscreen':'color'};
   try{return Reflect.apply(original,this,args);}finally{scope=previous;}
  },restores);
  function refresh(){
   if(shadowOwner!==renderer.shadowMap){
    shadowRestore();shadowOwner=renderer.shadowMap;const owner=shadowOwner,original=owner.render,descriptor=Object.getOwnPropertyDescriptor(owner,'render');
    const wrapped=function(...args){if(!active)return Reflect.apply(original,this,args);shadowDepth++;try{return Reflect.apply(original,this,args);}finally{shadowDepth--;}};
    Object.defineProperty(owner,'render',descriptor?{...descriptor,value:wrapped}:{value:wrapped,writable:true,configurable:true});
    shadowRestore=()=>{if(owner.render!==wrapped)return;if(descriptor)Object.defineProperty(owner,'render',descriptor);else delete owner.render;};
   }
  }
  const restored=()=>reset();renderer.domElement.addEventListener('webglcontextrestored',restored);
  return {begin(snapshot){refresh();entries=new Map((snapshot?.entries||[]).map(entry=>[entry.sourceId,entry]));binds=[];draws=[];sequence=0;unattributed=0;scope=null;shadowDepth=0;active=true;},
   end(){active=false;check(unattributed===0,'A native draw had no direct submission owner');return {vaoBinds:binds,nativeDraws:draws,unattributedDraws:unattributed};},
   dispose(){active=false;renderer.domElement.removeEventListener('webglcontextrestored',restored);shadowRestore();for(const restore of restores.reverse())restore();}};
 }
 function graphics(renderer,label){
  const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
  const receipt={label,renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),version:String(gl.getParameter(gl.VERSION)),
   attributes:gl.getContextAttributes(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],
   defaultFramebufferBound:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS)};
  result.contexts.push(receipt);check(/Metal/i.test(receipt.renderer)&&!/SwiftShader|llvmpipe|softpipe/i.test(receipt.renderer),'Native Metal required');
  check(receipt.defaultFramebufferBound&&receipt.attributes?.antialias===true&&receipt.samples===4&&receipt.sampleBuffers===1,'Actual default framebuffer must be native4xMSAA');return receipt;
 }
 function makeSide(candidate){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;renderer.shadowMap.type=T.PCFShadowMap;
  const receipt=graphics(renderer,candidate?'candidate':'baseline'),observer=observe(renderer),scene=new T.Scene();scene.background=new T.Color(0x18242f);
  const checker=new T.DataTexture(new Uint8Array([255,255,255,255,96,134,167,255,96,134,167,255,255,255,255,255]),2,2);checker.colorSpace=T.SRGBColorSpace;checker.magFilter=T.NearestFilter;checker.minFilter=T.NearestFilter;checker.needsUpdate=true;
  const materials=[new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,map:checker,roughness:.7}),
   new T.MeshStandardMaterial({color:0xe7c1ff,vertexColors:true,map:checker,roughness:.35}),new T.MeshBasicMaterial({color:0xffffff,vertexColors:true,map:checker})];
  materials.forEach((m,i)=>m.name='fixture-material-'+i);
  const known=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.6});known.name='known-fixture-shader';
  const previous=known.onBeforeCompile;known.onBeforeCompile=function(shader,r){previous.call(this,shader,r);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb *= vec3(0.91, 0.98, 0.93);');};
  known.customProgramCacheKey=()=>'fixture-known-surface-v1';check(registerSharedGeometryShader(known,previous),'Known native-backed shader registration failed');materials.push(known);
  const meshes=[],geometries=new Set(),allMaterials=new Set(materials),colors=[0xe85647,0x5de083,0x4c90ef,0xe6c44c,0xc57be6,0x4fd5db];
  function colorize(g,color,retainGroups=false){if(!retainGroups)g.clearGroups();const count=g.getAttribute('position').count,c=new T.Color(color),values=new Float32Array(count*3);for(let i=0;i<count;i++)c.toArray(values,i*3);g.setAttribute('color',new T.BufferAttribute(values,3));g.computeBoundingSphere();g.computeBoundingBox();geometries.add(g);return g;}
  for(let i=0;i<15;i++){
   const g=colorize(i%3===0?new T.BoxGeometry(.68,.78,.58):i%3===1?new T.SphereGeometry(.4,10,6):new T.ConeGeometry(.42,.85,10),colors[i%colors.length],i===0);
   const m=new T.Mesh(g,materials[i<10?0:i<12?1:i<14?2:3]);m.name='source-'+i;m.castShadow=true;m.receiveShadow=true;
   m.position.set((i%5-2)*.95,.5+Math.floor(i/5)*.08,(Math.floor(i/5)-1)*1.05);m.rotation.y=(i%4)*.23;meshes.push(m);scene.add(m);
  }
  // Two same-layout nonindexed sources exercise drawArrays without changing the
  // shader or vertices. They remain separate meshes and primitive sequences.
  for(let i=0;i<2;i++){const original=new T.TetrahedronGeometry(.36),g=colorize(original.index?original.toNonIndexed():original,colors[i+2]);const m=new T.Mesh(g,materials[0]);m.name='nonindexed-'+i;m.position.set(-.65+i*1.3,.45,2.15);m.castShadow=true;m.receiveShadow=true;meshes.push(m);scene.add(m);}
  const floor=new T.Mesh(colorize(new T.PlaneGeometry(18,18),0x818879),materials[0]);floor.name='source-floor';floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;meshes.push(floor);scene.add(floor);
  const partial=new T.Mesh(colorize(new T.BoxGeometry(.7,.7,.7),0xeeac42),materials[0]);partial.name='source-partial-range';partial.position.set(2.65,.45,.2);partial.geometry.setDrawRange(6,24);partial.castShadow=true;meshes.push(partial);scene.add(partial);
  const target=new T.WebGLRenderTarget(width,height,{samples:4,depthBuffer:true});target.texture.colorSpace=T.SRGBColorSpace;
  const nestedTarget=new T.WebGLRenderTarget(width,height,{samples:4,depthBuffer:true});nestedTarget.texture.colorSpace=T.SRGBColorSpace;
  const camera=new T.PerspectiveCamera(43,width/height,.1,40),ortho=new T.OrthographicCamera(-3.4,3.4,2.3,-2.3,.1,40);
  camera.name='perspective';ortho.name='orthographic';
  const place=(view,x=0,aim=0)=>{view.position.set(x,4.3,7.6);view.lookAt(aim,.35,0);view.updateProjectionMatrix();view.updateMatrixWorld(true);};place(camera);place(ortho);
  const left=new T.PerspectiveCamera(43,width/2/height,.1,40),right=left.clone();left.name='array-left';right.name='array-right';place(left,-1,-1);place(right,1,1);
  left.viewport=new T.Vector4(0,0,width/2,height);right.viewport=new T.Vector4(width/2,0,width/2,height);const array=new T.ArrayCamera([left,right]);array.name='array';
  const sun=new T.DirectionalLight(0xffefd0,2.5);sun.position.set(-3,7,4);sun.target.position.set(0,0,0);sun.castShadow=false;sun.shadow.mapSize.set(256,256);
  Object.assign(sun.shadow.camera,{left:-6,right:6,bottom:-6,top:6,near:.1,far:30});sun.shadow.camera.name='shadow-camera';sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.001;
  scene.add(new T.AmbientLight(0xbfd6f6,.7),sun,sun.target);
  const helperMaterial=new T.MeshBasicMaterial({color:0xe8d568}),helper=new T.Mesh(colorize(new T.PlaneGeometry(.22,.22),0xffffff),helperMaterial);allMaterials.add(helperMaterial);
  helper.name='callback-helper';helper.position.set(0,1.7,0);helper.renderOrder=10;helper.visible=false;scene.add(helper);meshes.push(helper);
  let nestedActive=false;
  const side={candidate,renderer,observer,receipt,scene,meshes,materials,geometries,allMaterials,checker,target,nestedTarget,camera,ortho,array,view:camera,place,sun,offscreen:false,
   mode:null,sceneSelections:0,sceneBeforeCalls:0,sceneAfterCalls:0,helperCalls:0,handle:null,alternate:null,selectionOriginal:null};
  helper.onBeforeRender=function(){
   side.helperCalls++;
   if(side.mode==='throw')throw Error('fixture intentional render failure');
   if(side.mode==='nested'&&!nestedActive){nestedActive=true;const previousTarget=renderer.getRenderTarget();
    try{renderer.setRenderTarget(nestedTarget);renderer.render(scene,ortho);}finally{renderer.setRenderTarget(previousTarget);nestedActive=false;}}
  };
  side.originalHelperCallback=helper.onBeforeRender;
  const unsupported=[];
  for(const kind of ['custom','interleaved','morph','wireframe']){
   let g=colorize(new T.BoxGeometry(.48,.48,.48),0xff84bc),m=materials[0].clone();m.name='unsupported-'+kind;allMaterials.add(m);
   if(kind==='custom')m.onBeforeCompile=()=>{};
   if(kind==='wireframe')m.wireframe=true;
   if(kind==='interleaved'){const old=g.getAttribute('position'),data=new Float32Array(old.count*3);data.set(old.array);g.setAttribute('position',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(data,3),3,0));}
   if(kind==='morph'){g.morphAttributes.position=[g.getAttribute('position').clone()];g.morphAttributes.position[0].setY(0,.8);}
   const mesh=new T.Mesh(g,m);mesh.name='unsupported-'+kind;mesh.position.set(-1.1+unsupported.length*.75,1.4,.2);mesh.visible=false;if(kind==='morph')mesh.morphTargetInfluences[0]=.7;unsupported.push(mesh);meshes.push(mesh);scene.add(mesh);
  }
  side.unsupported=unsupported;side.helper=helper;
  const descriptorKeys=['geometry','boundingSphere','onBeforeRender','onAfterRender','onBeforeShadow','onAfterShadow','raycast'];
  side.nativeHooks=()=>new Map(meshes.map(mesh=>[mesh,{geometry:mesh.geometry,before:mesh.onBeforeRender,after:mesh.onAfterRender,
   beforeShadow:mesh.onBeforeShadow,afterShadow:mesh.onAfterShadow,raycast:mesh.raycast,
   descriptors:Object.fromEntries(descriptorKeys.map(key=>[key,Object.getOwnPropertyDescriptor(mesh,key)]))}]));
  side.assertRestored=before=>{for(const [mesh,row]of before){check(mesh.geometry===row.geometry,'Original geometry not restored: '+mesh.name);
   for(const [key,value]of [['onBeforeRender',row.before],['onAfterRender',row.after],['onBeforeShadow',row.beforeShadow],['onAfterShadow',row.afterShadow],['raycast',row.raycast]])check(mesh[key]===value,'Original callback not restored: '+mesh.name+'/'+key);
   for(const key of descriptorKeys){const current=Object.getOwnPropertyDescriptor(mesh,key),old=row.descriptors[key];check(!!current===!!old&&(!current||['value','get','set','writable','enumerable','configurable'].every(field=>current[field]===old[field])),'Original descriptor not restored: '+mesh.name+'/'+key);}}};
  scene.onBeforeRender=()=>{side.sceneBeforeCalls++;for(const mesh of meshes)check(mesh.onBeforeRender=== (mesh===helper?side.originalHelperCallback:side.customCallbacks?.get(mesh)||T.Object3D.prototype.onBeforeRender),'Original scene before hook saw temporary object callback');
   if(side.mode==='selection'){side.selectionOriginal=meshes[0].geometry;meshes[0].geometry=side.alternate;side.sceneSelections++;}};
  scene.onAfterRender=()=>{side.sceneAfterCalls++;if(side.selectionOriginal){check(meshes[0].geometry===side.alternate,'Scene after hook did not see its selected original geometry');meshes[0].geometry=side.selectionOriginal;side.selectionOriginal=null;}
   if(side.expectedBoundary)side.assertRestored(side.expectedBoundary);
   if(side.mode==='after-nested'&&!nestedActive){const originalState=side.nativeHooks(),previousTarget=renderer.getRenderTarget();nestedActive=true;
    try{renderer.setRenderTarget(nestedTarget);renderer.render(scene,ortho);}finally{renderer.setRenderTarget(previousTarget);nestedActive=false;}
    side.assertRestored(originalState);
   }};
  // Exercise the actual production decorator and its registered compile chain.
  // A tiny fixed data texture supplies cloud noise; no production skin loading
  // or replacement shader implementation is introduced by this fixture.
  const noise=new T.DataTexture(new Uint8Array([36,36,36,255,215,215,215,255,142,142,142,255,87,87,87,255]),2,2);
  noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.needsUpdate=true;
  const atmosphere=new WorldAtmosphere(scene,noise);atmosphere.flush();atmosphere.update(1.25,new T.Vector3(-.3,.85,.4).normalize(),.46,1,.1,'high',false,false);
  check(atmosphere.stats.materials>=3&&atmosphere.uniforms.belleAirStrength.value>0,'Actual production atmosphere must be active');
  side.atmosphere=atmosphere;side.noise=noise;
  const originalRender=renderer.render,originalBefore=scene.onBeforeRender,originalAfter=scene.onAfterRender;
  if(candidate){side.handle=installSharedGeometryBuffers(renderer,scene);const prepared=side.handle.prepare();result.preparations.push({side:'candidate',stage:'initialization',snapshot:prepared});check(prepared.supported&&prepared.active&&prepared.preparedEntries>=10&&prepared.pageCount>=1,'Candidate did not prepare the supported fixture');}
  side.originalRender=originalRender;side.originalSceneBefore=originalBefore;side.originalSceneAfter=originalAfter;
  side.dispose=()=>{side.handle?.dispose();atmosphere.dispose();observer.dispose();for(const geometry of geometries)geometry.dispose();for(const material of allMaterials)material.dispose();checker.dispose();noise.dispose();target.dispose();nestedTarget.dispose();sun.shadow.dispose();renderer.dispose();renderer.forceContextLoss();};
  return side;
 }
 async function completed(renderer){
  const gl=renderer.getContext();check(!gl.isContextLost(),'Context lost before readback');const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);check(fence,'Readback completion fence unavailable');
  const submittedWallMs=performance.now();gl.flush();
  try{for(;;){const value=gl.clientWaitSync(fence,0,0);if(value===gl.ALREADY_SIGNALED||value===gl.CONDITION_SATISFIED)return {submittedWallMs,observedCompleteWallMs:performance.now()};
   check(value!==gl.WAIT_FAILED&&!gl.isContextLost()&&performance.now()-submittedWallMs<45000,'Native fixture readback deadline/fence failure');await new Promise(resolve=>requestAnimationFrame(resolve));}}
  finally{gl.deleteSync(fence);}
 }
 async function render(side,expectThrow){
  const {renderer,observer}=side,before=side.nativeHooks(),snapshot=side.handle?.read()??null;side.expectedBoundary=before;
  renderer.setRenderTarget(side.offscreen?side.target:null);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);
  let observations,thrown=null;observer.begin(snapshot);
  try{renderer.render(side.scene,side.view);}catch(error){thrown=String(error.message||error);if(!expectThrow||!thrown.includes('fixture intentional render failure'))throw error;}
  finally{observations=observer.end();side.assertRestored(before);}
  check(!!thrown===!!expectThrow,'Expected exception delivery changed');
  const completion=await completed(renderer),pixels=new Uint8Array(width*height*4),gl=renderer.getContext();
  if(side.offscreen)renderer.readRenderTargetPixels(side.target,0,0,width,height,pixels);else gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  check(gl.getError()===gl.NO_ERROR,'WebGL error after render/readback');check(observations.nativeDraws.length>0&&observations.nativeDraws.every(x=>x.returned),'Actual native draws are required');
  return {pixels,sha256:await hash(pixels),completion,observations,thrown,adapter:side.handle?.read()??null,
   callbacks:{before:side.sceneBeforeCalls,after:side.sceneAfterCalls,helper:side.helperCalls,selections:side.sceneSelections},
   atmosphere:{...side.atmosphere.stats,airStrength:side.atmosphere.uniforms.belleAirStrength.value,cloudStrength:side.atmosphere.uniforms.belleCloudStrength.value}};
 }
 function show(name,before,after){
  const article=document.createElement('article');article.id=name;const h=document.createElement('h2');h.textContent=name;article.append(h);
  const row=document.createElement('section');article.append(row);document.querySelector('main').append(article);
  for(const [label,bytes]of [['Native baseline',before],['Shared geometry candidate',after]]){const holder=document.createElement('div'),caption=document.createElement('p'),canvas=document.createElement('canvas');caption.textContent=label;canvas.width=width;canvas.height=height;
   const flipped=new Uint8ClampedArray(bytes.length);for(let y=0;y<height;y++)flipped.set(bytes.subarray(y*width*4,(y+1)*width*4),(height-y-1)*width*4);
   canvas.getContext('2d').putImageData(new ImageData(flipped,width,height),0,0);holder.append(caption,canvas);row.append(holder);}
 }
 async function restoreContext(side,label){
  const {renderer}=side,canvas=renderer.domElement,gl=renderer.getContext(),waits=[];
  const receipt={side:label,eventDeadlineMs:15000,events:[],requests:[],glErrors:[],timeouts:[],subsequentTasks:0,completed:false,error:null};result.contextLifecycle.push(receipt);
  const stage=name=>{receipt.stage=name;result.currentStep.stage=name;result.currentStep.side=label;};
  const errorReceipt=(name,allowed)=>{check(receipt.glErrors.length<4,'GL receipt bound');const code=gl.getError();receipt.glErrors.push({stage:name,code,wallMs:performance.now()});check(allowed.includes(code),'Unexpected context lifecycle GL error '+code);};
  function wait(type){let cancel;const promise=new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);canvas.removeEventListener(type,listener);};
   const listener=event=>{if(type==='webglcontextlost')event.preventDefault();try{check(receipt.events.length<2,'Context event bound');receipt.events.push({type,wallMs:performance.now(),trusted:event.isTrusted,defaultPrevented:event.defaultPrevented,contextLost:gl.isContextLost()});check(event.isTrusted&&(type!=='webglcontextlost'||event.defaultPrevented),'Trusted native context lifecycle required');resolve();}catch(error){reject(error);}finally{cleanup();}};
   const timer=setTimeout(()=>{cleanup();receipt.timeouts.push({type,wallMs:performance.now()});reject(Error(type+' timeout'));},15000);cancel=cleanup;canvas.addEventListener(type,listener,{once:true});
  });waits.push(()=>cancel());return promise;}
  const request=(kind,fn)=>{check(receipt.requests.length<2,'Context request bound');const row={kind,wallMs:performance.now(),contextLostBefore:gl.isContextLost(),returned:false};receipt.requests.push(row);fn();row.returned=true;row.contextLostAfter=gl.isContextLost();};
  try{stage('before-loss');check(gl.getExtension('WEBGL_lose_context'),'Native context loss extension required');errorReceipt('before-loss',[gl.NO_ERROR]);
   const lost=wait('webglcontextlost');request('lose',()=>renderer.forceContextLoss());await lost;errorReceipt('after-loss-event',[gl.NO_ERROR,gl.CONTEXT_LOST_WEBGL]);
   stage('after-loss-event-task');await new Promise(resolve=>setTimeout(resolve,0));receipt.subsequentTasks=1;receipt.afterLossTaskWallMs=performance.now();
   const restored=wait('webglcontextrestored');request('restore',()=>renderer.forceContextRestore());errorReceipt('after-restore-request',[gl.NO_ERROR,gl.CONTEXT_LOST_WEBGL]);await restored;
   await new Promise(resolve=>requestAnimationFrame(resolve));check(!gl.isContextLost(),'Native restoration missing');errorReceipt('after-restored-event',[gl.NO_ERROR]);
   renderer.setRenderTarget(null);graphics(renderer,label+'-restored');receipt.completed=true;stage('context-restored');
  }catch(error){receipt.error=String(error.stack||error);throw error;}finally{for(const cancel of waits)cancel();receipt.finishedWallMs=performance.now();}
 }
 const button=document.querySelector('button');button.addEventListener('click',async event=>{
  result.trustedStart=event.isTrusted;button.disabled=true;let sides;
  const references=new Map();
  async function step(spec){
   result.currentStep={step:spec.name,stage:'preparation'};
   if(spec.restore){await restoreContext(sides[0],'baseline');await restoreContext(sides[1],'candidate');delete result.currentStep.side;}
   if(spec.apply)for(const side of sides)spec.apply(side);
   result.currentStep.stage='baseline-render';const baseline=await render(sides[0],spec.throw);
   result.currentStep.stage='candidate-render';const candidate=await render(sides[1],spec.throw);
   const semantics=read=>read.observations.nativeDraws.map(row=>row.semantic);
   const difference=pixelDifference(baseline.pixels,candidate.pixels),commandsEqual=same(semantics(baseline),semantics(candidate));
   const row={name:spec.name,passed:false,equivalencePassed:difference.changedPixels===0&&commandsEqual,...difference,commandsEqual,
    baseline:{sha256:baseline.sha256,completion:baseline.completion,observations:baseline.observations,callbacks:baseline.callbacks,atmosphere:baseline.atmosphere,thrown:baseline.thrown},
    candidate:{sha256:candidate.sha256,completion:candidate.completion,observations:candidate.observations,callbacks:candidate.callbacks,atmosphere:candidate.atmosphere,thrown:candidate.thrown,adapter:candidate.adapter},
    conditions:{vaoReduction:!!spec.reduction,unsupportedFallback:!!spec.unsupported,allNative:!!spec.allNative,mutationFallback:spec.fallback||null,expectedThrow:!!spec.throw,contextRestore:!!spec.restore}};
   result.cases.push(row);pixelsOut[spec.name]={baseline:base64(baseline.pixels),candidate:base64(candidate.pixels)};show(spec.name,baseline.pixels,candidate.pixels);
   result.currentStep.stage='assertions';check(row.equivalencePassed,'Pixel or effective native draw semantics mismatch: '+spec.name);
   check(same(baseline.callbacks,candidate.callbacks),'Original callback delivery changed: '+spec.name);
   const draws=candidate.observations.nativeDraws,pooled=draws.filter(d=>d.geometry.pooled);
   check(candidate.adapter.observerErrors===0&&candidate.adapter.scopedEntries===0&&candidate.adapter.truncatedEntries===0&&candidate.adapter.truncatedPages===0,'Candidate diagnostic errors/scoped state/truncation prevent complete fixture validation');
   if(spec.allNative)check(pooled.length===0,'Unsupported whole render was pooled: '+spec.name);
   if(spec.reduction){
    const a=baseline.observations.vaoBinds.length,b=candidate.observations.vaoBinds.length;
    check(a>b&&pooled.length>=4,'Actual native VAO bindings were not reduced');
    const sharing=new Map();for(const d of pooled){const key=JSON.stringify(d.binding);const set=sharing.get(key)||new Set();set.add(d.semantic.object);sharing.set(key,set);}
    check([...sharing.values()].some(set=>set.size>=3),'Distinct source meshes did not share actual native VAO and buffer bindings');
    row.actualBindingReduction={baseline:a,candidate:b,fewer:a-b,pooledDraws:pooled.length,largestSharedSourceGroup:Math.max(...[...sharing.values()].map(set=>set.size))};result.coverage.actualVaoAndBufferSharing=true;
   }
   if(spec.fallback){const affected=draws.filter(d=>d.semantic.object===spec.fallback);check(affected.length>0&&affected.every(d=>!d.geometry.pooled),'Mutated source did not use native fallback: '+spec.fallback);result.coverage.mutationFallback=true;}
   if(spec.pooled){for(const name of spec.pooled)check(draws.some(d=>d.semantic.object===name&&d.geometry.pooled),'Required registered/range source was not pooled: '+name);}
   if(spec.atmosphere){check(candidate.atmosphere.materials>=3&&candidate.atmosphere.airStrength>0&&pooled.some(d=>d.semantic.object==='source-0')&&pooled.some(d=>d.semantic.object==='source-14'),'Actual registered atmosphere and known predecessor shader must pool');result.coverage.productionAtmosphere=true;}
   if(spec.groups){const source=sides[1].meshes[0],a=baseline.observations.nativeDraws.filter(d=>d.semantic.object===source.name&&d.semantic.phase==='color'),b=draws.filter(d=>d.semantic.object===source.name&&d.semantic.phase==='color');
    row.groupedSingleMaterial={object:source.name,groups:source.geometry.groups.map(group=>({...group})),baselineColorDraws:a.length,candidateColorDraws:b.length,candidatePooledColorDraws:b.filter(d=>d.geometry.pooled).length};
    check(!Array.isArray(source.material)&&row.groupedSingleMaterial.groups.length===6&&a.length===1&&b.length===1&&b[0].geometry.pooled,'Native single-material BoxGeometry groups must remain ignored on the pooled positive path');result.coverage.singleMaterialGroups=true;}
   if(spec.unsupported){for(const mesh of sides[1].unsupported){const affected=draws.filter(d=>d.semantic.object===mesh.name);check(affected.length>0&&affected.every(d=>!d.geometry.pooled),'Unsupported source was pooled: '+mesh.name);}result.coverage.unsupportedNativeFallback=true;}
   if(spec.array){const names=new Set(draws.filter(d=>d.semantic.phase==='color').map(d=>d.semantic.camera));check(names.has('array-left')&&names.has('array-right'),'Both native array views required');result.coverage.arrayViews=true;}
   if(spec.shadow){check(pooled.some(d=>d.semantic.phase==='shadow')&&pooled.some(d=>d.semantic.phase==='color'),'Actual pooled native shadow and color calls required');result.coverage.shadows=true;}
   if(spec.nested){const inner=draws.filter(d=>d.semantic.phase==='offscreen');check(inner.length>0&&inner.every(d=>!d.geometry.pooled)&&candidate.adapter.nestedRenders>0,'Nested native fallback rendering required');result.coverage.nestedRestoration=true;}
   if(spec.afterNested)result.coverage.afterRenderNestedRestoration=true;
   if(spec.override)result.coverage.overrideShaderFallback=true;
   if(spec.throw)result.coverage.exceptionRestoration=true;
   if(spec.restore){check(candidate.adapter.contextLosses>=1&&candidate.adapter.contextRestores>=1,'Candidate context lifecycle counters missing');result.coverage.contextRestore=true;}
   if(spec.disposed){check(!candidate.adapter.active&&sides[1].renderer.render===sides[1].originalRender&&sides[1].scene.onBeforeRender===sides[1].originalSceneBefore&&sides[1].scene.onAfterRender===sides[1].originalSceneAfter,'Disposal did not restore original hooks');result.coverage.disposal=true;}
   if(spec.changeFrom){const reference=references.get(spec.changeFrom);check(reference,'Missing control reference');const visible=pixelDifference(reference.pixels,baseline.pixels);check(visible.changedPixels>=64,'Visible change control is ineffective: '+spec.name);result.controls.push({name:spec.name,reference:spec.changeFrom,visibleDifference:visible,passed:true});}
   if(spec.equalTo)check(baseline.sha256===references.get(spec.equalTo)?.sha256,'Baseline restoration control changed');
   references.set(spec.name,{pixels:baseline.pixels,sha256:baseline.sha256});row.passed=true;result.currentStep.stage='complete';
  }
  try{
   check(event.isTrusted,'Trusted explicit native launch required');sides=[];result.currentStep={step:'initialization',stage:'baseline-scene'};sides.push(makeSide(false));result.currentStep.stage='candidate-scene';sides.push(makeSide(true));
   const setNormal=s=>{s.offscreen=false;s.view=s.camera;s.place(s.camera);s.mode=null;s.helper.visible=false;s.sun.castShadow=false;s.renderer.shadowMap.enabled=false;};
   const definitions=[
    {name:'initial',atmosphere:true,groups:true,pooled:['nonindexed-0','nonindexed-1','source-partial-range']},
    {name:'repeat-bindings',reduction:true},
    {name:'camera-culling',apply:s=>s.place(s.camera,5.5,5.5),changeFrom:'initial'},
    {name:'camera-restored',apply:s=>s.place(s.camera),equalTo:'initial'},
    {name:'visibility',apply:s=>s.meshes[6].visible=false,changeFrom:'initial'},
    {name:'visibility-restored',apply:s=>s.meshes[6].visible=true,equalTo:'initial'},
    {name:'transform-and-depth-tie',apply:s=>{s.meshes[1].position.copy(s.meshes[0].position);s.meshes[1].rotation.copy(s.meshes[0].rotation);s.meshes[2].scale.set(1.2,.72,.91);},changeFrom:'initial'},
    {name:'shadows',apply:s=>{s.sun.castShadow=true;s.renderer.shadowMap.enabled=true;s.renderer.shadowMap.needsUpdate=true;},shadow:true,changeFrom:'transform-and-depth-tie'},
    {name:'orthographic',apply:s=>{s.view=s.ortho;},changeFrom:'shadows'},
    {name:'offscreen-fallback',apply:s=>{s.offscreen=true;},allNative:true},
    {name:'array-views',apply:s=>{s.offscreen=false;s.view=s.array;},array:true,allNative:true},
    {name:'nested-render',apply:s=>{setNormal(s);s.helper.visible=true;s.mode='nested';},nested:true},
    {name:'after-render-nested',apply:s=>{setNormal(s);s.mode='after-nested';},nested:true,afterNested:true},
    {name:'override-shader-fallback',apply:s=>{setNormal(s);const material=new T.MeshBasicMaterial({color:0xffffff,vertexColors:true});material.name='unsupported-vertex-id-override';
     material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += float(gl_VertexID % 3) * 0.11;');};material.customProgramCacheKey=()=>'fixture-vertex-id-override';s.allMaterials.add(material);s.scene.overrideMaterial=material;},allNative:true,override:true,changeFrom:'after-render-nested'},
    {name:'override-restored',apply:s=>{s.scene.overrideMaterial=null;},reduction:true},
    {name:'throw-restoration',apply:s=>{s.helper.visible=true;s.mode='throw';},throw:true},
    {name:'after-throw',apply:setNormal,reduction:true},
    {name:'prior-scene-selection',apply:s=>{s.alternate=s.meshes[0].geometry.clone();s.alternate.scale(1.8,.6,1.3);s.geometries.add(s.alternate);s.mode='selection';},fallback:'source-0',changeFrom:'after-throw'},
    {name:'partial-draw-range',apply:s=>{s.mode=null;s.meshes[3].geometry.setDrawRange(6,12);},pooled:['source-3'],changeFrom:'after-throw'},
    {name:'attribute-version',apply:s=>{const a=s.meshes[4].geometry.getAttribute('position');for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)*1.65);a.needsUpdate=true;},fallback:'source-4',changeFrom:'partial-draw-range'},
    {name:'attribute-replacement',apply:s=>{const g=s.meshes[5].geometry,a=g.getAttribute('position').clone();for(let i=0;i<a.count;i++)a.setX(i,a.getX(i)*1.7);g.setAttribute('position',a);},fallback:'source-5'},
    {name:'index-version',apply:s=>{const a=s.meshes[7].geometry.getIndex();for(let i=0;i<Math.min(30,a.count);i+=3){a.array[i+1]=a.array[i];a.array[i+2]=a.array[i];}a.needsUpdate=true;},fallback:'source-7'},
    {name:'index-replacement',apply:s=>{const g=s.meshes[8].geometry,index=g.index.array.slice(0,Math.floor(g.index.count/6)*3);g.setIndex(new T.BufferAttribute(index,1));},fallback:'source-8'},
    {name:'geometry-replacement',apply:s=>{const g=s.meshes[9].geometry.clone();g.scale(.45,1.8,.6);s.geometries.add(g);s.meshes[9].geometry=g;},fallback:'source-9'},
    {name:'custom-policy-fallback',apply:s=>{const m=s.meshes[10].material.clone();m.name='late-unknown-shader';m.onBeforeCompile=()=>{};s.allMaterials.add(m);s.meshes[10].material=m;},fallback:'source-10'},
    {name:'source-disposal',apply:s=>s.meshes[11].geometry.dispose(),fallback:'source-11'},
    {name:'unsupported-fallbacks',apply:s=>{for(const m of s.unsupported)m.visible=true;},unsupported:true,changeFrom:'source-disposal'},
    {name:'context-restored',restore:true},
    {name:'restored-repeat',reduction:true},
    {name:'disposed-native',apply:s=>s.handle?.dispose(),disposed:true},
   ];
   check(definitions.length===result.expectedCaseCount,'Planned fixture case count changed');
   for(const spec of definitions)await step(spec);
   check(result.cases.length===result.expectedCaseCount&&result.cases.every(row=>row.passed),'Every planned native case must pass');
   check(result.controls.length>=6&&result.controls.every(row=>row.passed),'Meaningful visible controls are required');
   result.coverage.persistentFrames=true;result.coverage.partialAndNonindexed=true;result.coverage.knownShader=true;result.coverage.orthographicAndOffscreen=true;
   check(Object.keys(result.coverage).length>=12&&Object.values(result.coverage).every(Boolean),'Required fixture paths missing');result.passed=true;
  }catch(error){result.errors.push(String(error.stack||error));}
  finally{for(const side of sides||[])try{side.dispose();}catch(error){result.errors.push('Cleanup: '+String(error));result.passed=false;}document.body.dataset.complete='true';}
 });document.body.dataset.ready='true';
}

async function run(){
 const game=resolve(import.meta.dirname,'..'),httpOnly=process.argv.includes('--check-fixture-http');
 if(process.argv.includes('--self-test')){
  assert.deepEqual(pixelDifference(new Uint8Array([1,2,3,4]),new Uint8Array([1,3,3,4])),{changedPixels:1,maxChannelDifference:1});
  const floats=new Float32Array([1.5,-2.25,3.75]);assert.equal(scalarFromBytes(new Uint8Array(floats.buffer),4,5126,false),-2.25);
  assert.deepEqual(Array.from(copiedUpload(floats,1,1)),Array.from(new Uint8Array(floats.buffer,4,4)));
  assert.throws(()=>scalarFromBytes(new Uint8Array(2),1,5123,false),/out-of-range/);
  assert.throws(()=>copiedUpload(5*1024*1024),/bound/);
  const parsed=await httpModuleImports('import {registerSharedGeometryShader} from "/@id/__x00__geometry-adapter.mjs?v=one"; await import("/deps/three.js?v=two");');
  assert.deepEqual(parsed,[{path:'/@id/__x00__geometry-adapter.mjs?v=one',kind:'import-statement'},{path:'/deps/three.js?v=two',kind:'dynamic-import'}]);
  assert.equal(canonicalAdapterImport(parsed,'http://fixture/src/belle/worldAtmosphere.ts'),'http://fixture/@id/__x00__geometry-adapter.mjs?v=one');
  assert.notEqual(canonicalAdapterImport([{path:'/src/belle/sharedGeometryBuffers.ts'}],'http://fixture/geometry-fixture.mjs'),canonicalAdapterImport(parsed,'http://fixture/geometry-fixture.mjs'));
  assert.throws(()=>canonicalAdapterImport([],'http://fixture/geometry-fixture.mjs'),/Exactly one/);
  console.log('Shared geometry fixture helper checks: 9 passed');return;
 }
 const output=resolve(game,process.env.BELLE_GEOMETRY_OUTPUT||'output/shared-geometry-equivalence');
 assert(!process.env.BELLE_GEOMETRY_ADAPTER_SOURCE||httpOnly,'Adapter source overrides are HTTP-check only.');
 const adapterPath=resolve(process.env.BELLE_GEOMETRY_ADAPTER_SOURCE||resolve(game,'src/belle/sharedGeometryBuffers.ts'));
 const require=createRequire(import.meta.url),threeRoot=resolve(dirname(require.resolve('three')),'..');
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const sourcePaths={fixture:import.meta.filename,adapter:adapterPath,packageLock:resolve(game,'package-lock.json'),threePackage:resolve(threeRoot,'package.json'),
  nativeRenderer:resolve(threeRoot,'src/renderers/WebGLRenderer.js'),nativeBindings:resolve(threeRoot,'src/renderers/webgl/WebGLBindingStates.js'),
  nativeAttributes:resolve(threeRoot,'src/renderers/webgl/WebGLAttributes.js'),nativeGeometries:resolve(threeRoot,'src/renderers/webgl/WebGLGeometries.js'),nativeFrustum:resolve(threeRoot,'src/math/Frustum.js'),
  worldAtmosphere:resolve(game,'src/belle/worldAtmosphere.ts'),atmosphereShaders:resolve(game,'src/belle/atmosphereShaders.ts'),physicalLighting:resolve(game,'src/belle/physicalLighting.ts')};
 const sources=Object.fromEntries(await Promise.all(Object.entries(sourcePaths).map(async([name,path])=>[name,{path,sha256:hash(await readFile(path))}])));
 assert.equal(JSON.parse(await readFile(sourcePaths.threePackage,'utf8')).version,'0.185.1','Pinned Three version required');
 const adapterSource=await readFile(adapterPath,'utf8'),adapterModule=(await transform(adapterSource,{loader:'ts',format:'esm',target:'es2022',sourcefile:'sharedGeometryBuffers.ts'})).code;
 await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});
 await writeFile(resolve(output,'adapter-source.ts'),adapterSource);await writeFile(resolve(output,'fixture-source.mjs'),await readFile(import.meta.filename));
 const report={version:1,scope:'Native shared immutable geometry pixel/command/binding equivalence only; not gameplay or release performance.',
  candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:game,encoding:'utf8'}).trim(),
  baseline:'Same pinned Three and persistent scene without installing the geometry pool.',httpOnly,sources,startedAt:new Date().toISOString(),passed:false,cases:[],errors:[],failedRequests:[],artifacts:[]};
 if(process.env.GITHUB_SHA&&!httpOnly)assert.equal(report.candidate,process.env.GITHUB_SHA,'Checked-out native workflow head required');
 const moduleSource='const pixelDifference='+pixelDifference.toString()+';\nconst scalarFromBytes='+scalarFromBytes.toString()+';\nconst copiedUpload='+copiedUpload.toString()+';\n('+fixtureMain.toString()+')();';
 const html='<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Shared geometry native equivalence</title><style>body{background:#111c26;color:#edf2f1;font:15px Arial;margin:24px}button{min-height:44px;padding:12px 20px}section{display:flex;flex-wrap:wrap;gap:16px}canvas{width:384px;max-width:100%;height:auto}article{margin:24px 0}h2{font-size:18px}</style></head><body><h1>Shared geometry native equivalence</h1><p>Pixel, command and real VAO/buffer observations. This is not gameplay or performance acceptance.</p><button type="button">Run native verification</button><main></main><script type="module" src="/geometry-fixture.mjs"></script></body></html>';
 const server=await createServer({root:game,configFile:false,publicDir:false,logLevel:'error',cacheDir:resolve(output,'vite-cache'),optimizeDeps:{noDiscovery:true,include:['three']},
  server:{host:'127.0.0.1',port:0,strictPort:false},plugins:[{name:'native-shared-geometry-fixture',enforce:'pre',configureServer(server){server.middlewares.use((request,response,next)=>{if(new URL(request.url,'http://fixture').pathname==='/'){response.setHeader('Content-Type','text/html');response.end(html);}else next();});},
   resolveId(id){if(id==='/geometry-fixture.mjs')return '\0geometry-fixture.mjs';if(id==='/geometry-adapter.mjs'||id.endsWith('/sharedGeometryBuffers.ts')||id==='./sharedGeometryBuffers.ts')return '\0geometry-adapter.mjs';},
   load(id){if(id==='\0geometry-fixture.mjs')return moduleSource;if(id==='\0geometry-adapter.mjs')return adapterModule;}}]});
 function dependency(name){try{return require(name);}catch(error){try{return createRequire(resolve(game,'../../package.json'))(name);}catch{}if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;return createRequire(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))(name);}}
 async function bounded(promise,milliseconds){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bounded fixture collection expired')),milliseconds);})]);}finally{clearTimeout(timer);}}
 let browser,context,page,transformPassed=false;const saved=new Set();
 async function retain(partial=false){
  const end=performance.now()+(partial?20000:90000),remaining=()=>{const value=end-performance.now();assert(value>0,'Evidence collection deadline expired');return value;};
  const value=await bounded(page.evaluate(()=>window.__sharedGeometryResult),Math.min(remaining(),10000));assert(value&&Array.isArray(value.cases),'Browser result missing');
  for(const key of ['contexts','contextLifecycle','preparations','cases','controls','coverage','trustedStart','scope','expectedCaseCount','currentStep','threeRevision'])report[key]=value[key];
  for(const error of value.errors)if(!report.errors.includes(error))report.errors.push(error);
  report.collection={partial,completedCases:value.cases.filter(c=>c.passed).length,retainedCases:value.cases.length,finished:false};
  // Save all raw pixels before screenshots so a later UI/export failure cannot
  // erase already completed native evidence.
  for(const row of value.cases){assert.match(row.name,/^[a-z0-9-]+$/);
   if(['baseline','candidate'].some(side=>!saved.has(row.name+'-'+side+'.rgba'))){
    const pixels=await bounded(page.evaluate(name=>window.__sharedGeometryPixels[name],row.name),Math.min(remaining(),10000));
    for(const side of ['baseline','candidate']){const file=row.name+'-'+side+'.rgba';if(saved.has(file))continue;const bytes=Buffer.from(pixels[side],'base64');assert.equal(bytes.length,value.width*value.height*4);assert.equal(hash(bytes),row[side].sha256);await writeFile(resolve(output,file),bytes);saved.add(file);report.artifacts.push({file,bytes:bytes.length,sha256:hash(bytes),format:'RGBA8 bottom row first',width:value.width,height:value.height});}
   }
  }
  for(const row of value.cases){const file=row.name+'.png';if(saved.has(file))continue;const bytes=await page.locator('#'+row.name).screenshot({path:resolve(output,file),timeout:Math.min(remaining(),5000)});saved.add(file);report.artifacts.push({file,bytes:bytes.length,sha256:hash(bytes),format:'Paired displayed native readbacks'});}
  report.collection.finished=true;return value;
 }
 try{
  await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
  report.httpTransforms=[];report.moduleIdentity={verified:false,fixtureAdapter:null,atmosphereAdapter:null};
  async function observeHttp(path,label){
   const response=await fetch(new URL(path,origin)),body=await response.text(),file='http-'+label+'.mjs';
   const receipt={path,url:response.url,status:response.status,bytes:Buffer.byteLength(body),sha256:hash(body),file,imports:[]};
   report.httpTransforms.push(receipt);await writeFile(resolve(output,file),body);
   assert.equal(response.status,200);assert(!/import\(['"]three['"]\)|from\s*['"]three['"]/.test(body),'Unresolved browser import');
   receipt.imports=await httpModuleImports(body);return receipt;
  }
  const fixtureHttp=await observeHttp('/geometry-fixture.mjs','fixture');
  await observeHttp('/geometry-adapter.mjs','adapter-direct');
  const atmosphereHttp=await observeHttp('/src/belle/worldAtmosphere.ts','world-atmosphere');
  report.moduleIdentity.fixtureAdapter=canonicalAdapterImport(fixtureHttp.imports,fixtureHttp.url);
  report.moduleIdentity.atmosphereAdapter=canonicalAdapterImport(atmosphereHttp.imports,atmosphereHttp.url);
  assert.equal(report.moduleIdentity.fixtureAdapter,report.moduleIdentity.atmosphereAdapter,'Fixture and production atmosphere must load the same canonical adapter module URL including query identity');
  const canonicalHttp=await observeHttp(report.moduleIdentity.fixtureAdapter,'adapter-canonical');
  report.moduleIdentity.canonicalResponse=canonicalHttp.url;report.moduleIdentity.verified=true;transformPassed=true;
  if(!httpOnly){
   assert.equal(process.platform,'darwin','Native fixture requires macOS Metal; local use is HTTP transform only.');
   let chromium;try{({chromium}=dependency('playwright'));}catch{({chromium}=dependency('@playwright/test'));}
   browser=await chromium.launch({...(process.env.BELLE_BROWSER_PATH?{executablePath:process.env.BELLE_BROWSER_PATH}:{channel:'chrome'}),headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']});report.browser=browser.version();
   context=await browser.newContext({viewport:{width:1050,height:850},deviceScaleFactor:1,reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(45000);
   page.on('pageerror',error=>report.errors.push(error.stack||error.message));page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
   await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.getByRole('button',{name:'Run native verification',exact:true}).click();
   await page.waitForFunction(()=>document.body.dataset.complete==='true',null,{timeout:300000});const value=await retain();
   assert(value.trustedStart&&value.passed&&value.cases.length===30&&value.cases.every(c=>c.passed),'Every native pixel/command/binding/control/lifecycle case must pass');
   assert(value.contextLifecycle.length===2&&value.contextLifecycle.every(r=>r.completed),'Both real native context restoration paths required');
   report.passed=true;
  }
  for(const [name,entry]of Object.entries(sources))assert.equal(hash(await readFile(entry.path)),entry.sha256,'Verification source changed: '+name);
 }catch(error){report.errors.push(error.stack||String(error));if(page&&!httpOnly)try{await retain(true);}catch(other){report.errors.push('Partial evidence: '+(other.stack||String(other)));}}
 finally{
  for(const [name,close]of [['context',()=>context?.close()],['browser',()=>browser?.close()],['server',()=>server.close()]])try{await bounded(Promise.resolve().then(close),10000);}catch(error){report.errors.push(name+' cleanup: '+error.message);}
  report.finishedAt=new Date().toISOString();report.passed=report.passed&&!report.errors.length&&!report.failedRequests.length;
  await writeFile(resolve(output,httpOnly?'http-transform.json':'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('BELLE_GEOMETRY_EQUIVALENCE '+JSON.stringify({httpOnly,transformPassed,passed:report.passed,candidate:report.candidate,tree:report.tree,sources:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.sha256])),moduleIdentity:report.moduleIdentity,preparations:report.preparations?.map(row=>({side:row.side,supported:row.snapshot.supported,active:row.snapshot.active,preparedEntries:row.snapshot.preparedEntries,pageCount:row.snapshot.pageCount,rejected:row.snapshot.rejected})),cases:report.cases.length,controls:report.controls?.length??0,coverage:report.coverage,artifacts:report.artifacts.length,errors:report.errors,failedRequests:report.failedRequests}));
  if(!(httpOnly?transformPassed&&!report.errors.length:report.passed))process.exitCode=1;
 }
}
await run();
