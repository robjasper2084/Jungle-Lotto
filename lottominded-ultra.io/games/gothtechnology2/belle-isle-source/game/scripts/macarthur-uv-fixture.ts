import * as T from 'three';
import {loadRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import type {ParkMap} from '../src/belle/terrain.ts';
import {assert,createOwner,eligibleNames,warmName,focus,lightOffsets,cameraOffsets,rayEvidence,type Owner,type BridgeMesh,type Side} from './macarthur-uv-scenes.ts';
// @ts-expect-error The isolated driver supplies the exact authored cloud function.
import {cloudTexture} from 'virtual:belle-macarthur-cloud';

type Output='screen-msaa4'|'target-samples0';
type GenericState='fresh'|'poisoned'|'reset';
type Presentation='all'|'hidden'|'no-casters'|'receiver'|'receiver-no-casters'|`omit:${string}`|`receiver-omit:${string}`|'primer'|'reverse';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Kind='color'|'shadow'|'witness';
type DrawRange={start:number;count:number|'Infinity'};
type Active={mesh:BridgeMesh;material:T.Material;kind:Kind;selected:DrawRange;camera:T.Camera};
const sides:Side[]=['baseline','candidate'],width=320,height=240,shadowSize=256;
const reverse=new URL(location.href).searchParams.get('order')==='unmapped-first';
const canvas=document.createElement('canvas');canvas.id='macarthur-uv-fixture';document.body.append(canvas);
const label=document.createElement('p');document.body.prepend(label);
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=true;
const gl=renderer.getContext() as WebGL2RenderingContext;
const initialGeneric=Array.from({length:gl.getParameter(gl.MAX_VERTEX_ATTRIBS) as number},(_,location)=>({location,value:Array.from(gl.getVertexAttrib(location,gl.CURRENT_VERTEX_ATTRIB) as Float32Array)}));
const target=new T.WebGLRenderTarget(width,height,{samples:0,type:T.UnsignedByteType,format:T.RGBAFormat,depthBuffer:true,stencilBuffer:false});target.texture.colorSpace=T.SRGBColorSpace;
const seedTarget=new T.WebGLRenderTarget(1,1,{samples:0,type:T.UnsignedByteType,format:T.RGBAFormat,depthBuffer:false,stencilBuffer:false});
const camera=new T.OrthographicCamera(-35*width/height,35*width/height,35,-35,1,400);
const owners={} as Record<Side,Owner>,programs=new Map<number,{id:number;program:WebGLProgram;vertexSource:string;fragmentSource:string}>();
const objectIds=new WeakMap<object,number>();let nextObjectId=1;
const shaderTables=new WeakMap<T.Material,Shader>();
const immutableBuffers=new Map<string,Uint8Array>();
const sourceErrors:string[]=[],seedHistory:unknown[]=[];
const retainedSeedResources:{geometry:T.BufferGeometry;material:T.ShaderMaterial}[]=[];
const poison=[.375,.625,1] as const,zero=[0,0,0] as const;
let status='loading',uvLocation:number|undefined,primed=false,everSeeded=false,attributeControl=false;
const savedUv=new Map<BridgeMesh,T.BufferAttribute>(),poisonUv=new Map<BridgeMesh,T.BufferAttribute>();
let witnessMaterial:T.RawShaderMaterial|undefined;
renderer.debug.onShaderError=(context,program,vertex,fragment)=>sourceErrors.push([context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].join('\n'));

function id(object:object|null|undefined){if(!object)return null;if(!objectIds.has(object))objectIds.set(object,nextObjectId++);return objectIds.get(object)!;}
function range(geometry:T.BufferGeometry):DrawRange{return {start:geometry.drawRange.start,count:Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:'Infinity'};}
function base64(bytes:Uint8Array){let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);}
function png(bytes:Uint8Array,w:number,h:number){const output=document.createElement('canvas');output.width=w;output.height=h;const context=output.getContext('2d')!,image=context.createImageData(w,h);for(let y=0;y<h;y++)image.data.set(bytes.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);context.putImageData(image,0,0);return output.toDataURL('image/png').split(',')[1];}
function graphics(){
 const saved=renderer.getRenderTarget();renderer.setRenderTarget(null);const debug=gl.getExtension('WEBGL_debug_renderer_info');
 const result={width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,devicePixelRatio,contextAttributes:gl.getContextAttributes(),samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),defaultDrawFramebuffer:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),version:String(gl.getParameter(gl.VERSION)),threeRevision:T.REVISION,contextLost:gl.isContextLost()};
 renderer.setRenderTarget(saved);return result;
}
const initialGraphics=graphics();
function nativeProgram(){
 const program=gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram|null;assert(program,'No native current program');const programId=id(program)!;
 const stages=gl.getAttachedShaders(program);assert(stages?.length===2,'Expected complete actual native stages');
 const vertex=stages.find(shader=>gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=stages.find(shader=>gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);
 assert(vertex&&fragment,'Missing native stage');const vertexSource=gl.getShaderSource(vertex),fragmentSource=gl.getShaderSource(fragment);assert(vertexSource&&fragmentSource,'Native shader source unavailable');
 const previous=programs.get(programId);assert(!previous||(previous.vertexSource===vertexSource&&previous.fragmentSource===fragmentSource),'Unexpected relinked program identity');
 programs.set(programId,{id:programId,program,vertexSource,fragmentSource});
 const attributes=[];
 for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_ATTRIBUTES);i++){
  const info=gl.getActiveAttrib(program,i);assert(info,'Native active input missing');const location=gl.getAttribLocation(program,info.name);
  const buffer=gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer|null;
  attributes.push({name:info.name,location,inputType:info.type,inputSize:info.size,enabled:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_ENABLED),size:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_SIZE),type:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_TYPE),normalized:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),integer:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_INTEGER),stride:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_STRIDE),offset:gl.getVertexAttribOffset(location,gl.VERTEX_ATTRIB_ARRAY_POINTER),divisor:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_DIVISOR),bufferId:id(buffer),generic:Array.from(gl.getVertexAttrib(location,gl.CURRENT_VERTEX_ATTRIB) as Float32Array)});
 }
 return {programId,linked:Boolean(gl.getProgramParameter(program,gl.LINK_STATUS)),attributes,framebufferId:id(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)),samples:gl.getParameter(gl.SAMPLES)};
}
function nativeUniforms(material:T.Material){
 const program=gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram,table=shaderTables.get(material)?.uniforms,result:Record<string,unknown>={};
 for(const name of ['skinProfile','skinPlanar','belleSunDirection','belleCloudCoverage','belleCloudTime','opacity']){
  const location=gl.getUniformLocation(program,name);if(location===null)continue;
  const value=table?.[name]?.value??(name==='opacity'?material.opacity:undefined);if(value===undefined)continue;
  const observed=gl.getUniform(program,location),expected=typeof value==='boolean'?value:typeof value==='number'?Math.fround(value):value.toArray().map(Math.fround);
  const native=typeof value==='boolean'?Boolean(observed):typeof value==='number'?observed:Array.from(observed);
  result[name]={expected,observed:native,matches:JSON.stringify(expected)===JSON.stringify(native)};
 }
 return result;
}

/** A real Three draw supplies its missing color through ShaderMaterial's
 * defaultAttributeValues path. A new geometry deliberately forces the pinned
 * binding cache to run that path for every seed/reset. No gl.vertexAttrib call
 * is made by this fixture. */
function seedGeneric(value:readonly number[],purpose:'poison'|'reset'){
 assert(uvLocation!==undefined&&Number.isSafeInteger(uvLocation)&&uvLocation>=0,'Mapped depth UV location is unavailable');everSeeded=true;
 const oldTarget=renderer.getRenderTarget(),oldViewport=renderer.getViewport(new T.Vector4()),oldScissor=renderer.getScissor(new T.Vector4()),oldScissorTest=renderer.getScissorTest();
 const genericBefore=Array.from(gl.getVertexAttrib(uvLocation,gl.CURRENT_VERTEX_ATTRIB) as Float32Array),scene=new T.Scene(),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const material=new T.ShaderMaterial({glslVersion:T.GLSL3,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:`layout(location=${uvLocation}) in vec3 color;\nout vec3 seedColor;\nvoid main(){seedColor=color;gl_Position=vec4(position,1.);}`,fragmentShader:'in vec3 seedColor;out vec4 seedOutput;void main(){seedOutput=vec4(seedColor,1.);}'});
 material.defaultAttributeValues.color=[value[0],value[1],value[2]];const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
 const draws:{mode:number;first:number;count:number;returned:boolean}[]=[],previous=gl.drawArrays,descriptor=Object.getOwnPropertyDescriptor(gl,'drawArrays');let proof:ReturnType<typeof nativeProgram>|undefined;
 mesh.onAfterRender=()=>{proof=nativeProgram();};
 const wrapper=function(this:WebGL2RenderingContext,...args:Parameters<WebGL2RenderingContext['drawArrays']>){const result=Reflect.apply(previous,this,args);draws.push({mode:args[0],first:args[1],count:args[2],returned:true});return result;};
 try{Object.defineProperty(gl,'drawArrays',{value:wrapper,writable:true,configurable:true});renderer.setRenderTarget(seedTarget);renderer.setViewport(0,0,1,1);renderer.setScissorTest(false);renderer.render(scene,new T.Camera());}
 finally{if(descriptor)Object.defineProperty(gl,'drawArrays',descriptor);else delete (gl as unknown as Record<string,unknown>).drawArrays;renderer.setRenderTarget(oldTarget);renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(oldScissorTest);retainedSeedResources.push({geometry,material});}
 assert(proof,'Real Three generic seed did not draw');const color=proof.attributes.find(attribute=>attribute.name==='color');
 const expected=[...value,1],observed=Array.from(gl.getVertexAttrib(uvLocation,gl.CURRENT_VERTEX_ATTRIB) as Float32Array);
 const restored=renderer.getRenderTarget()===oldTarget&&renderer.getViewport(new T.Vector4()).equals(oldViewport)&&renderer.getScissor(new T.Vector4()).equals(oldScissor)&&renderer.getScissorTest()===oldScissorTest;
 const receipt={purpose,path:'Three ShaderMaterial.defaultAttributeValues.color through a real returned drawArrays',location:uvLocation,genericBefore,expected,observed,color,draws,proof,defaultColor:[...value],geometryHasColor:false,geometryId:id(geometry),hooksRestored:gl.drawArrays===previous,targetViewportScissorRestored:restored,viewportBefore:oldViewport.toArray(),scissorBefore:oldScissor.toArray(),scissorTestBefore:oldScissorTest,glError:gl.getError()};
 seedHistory.push(receipt);
 assert(color?.location===uvLocation&&!color.enabled&&JSON.stringify(color.generic)===JSON.stringify(expected)&&JSON.stringify(observed)===JSON.stringify(expected)&&draws.length===1&&draws[0].count===3&&receipt.hooksRestored&&restored&&receipt.glError===gl.NO_ERROR,'Real Three color seed did not establish the observed generic UV state');
 return receipt;
}
function witness(){
 assert(uvLocation!==undefined&&Number.isSafeInteger(uvLocation)&&uvLocation>=0,'Witness requires the actual linked mapped-depth location');
 if(!witnessMaterial){witnessMaterial=new T.RawShaderMaterial({glslVersion:T.GLSL3,side:T.DoubleSide,toneMapped:false,vertexShader:`precision highp float;\nlayout(location=${uvLocation===0?1:0}) in vec3 position;\nlayout(location=${uvLocation}) in vec2 uv;\nuniform mat4 projectionMatrix;uniform mat4 modelViewMatrix;out vec2 witnessUv;\nvoid main(){witnessUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:'precision highp float;in vec2 witnessUv;out vec4 witnessOutput;void main(){witnessOutput=vec4(.15+.7*witnessUv.x,.20+.7*witnessUv.y,.35,1.);}'});Object.assign(witnessMaterial,{defaultAttributeValues:{}});}return witnessMaterial;
}
function configure(owner:Owner,view:number){
 assert(view===0||view===1,'Unknown view');camera.position.copy(focus).add(new T.Vector3(...cameraOffsets[view]));camera.lookAt(focus);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
 owner.sun.position.copy(focus).add(new T.Vector3(...lightOffsets[view]));owner.sun.target.position.copy(focus);owner.sun.target.updateMatrixWorld(true);
 owner.atmosphere.update(1.25+view*5.5,new T.Vector3(...lightOffsets[view]).normalize(),.42,.9,.15,'high',false,false);owner.scene.updateMatrixWorld(true);
}

function render(side:Side,view:number,output:Output,generic:GenericState='fresh',presentation:Presentation='all',diagnosticWitness=false){
 assert(status==='ready','Standalone fixture not ready');assert(primed||presentation==='primer'||presentation==='reverse','Actual warm mapped-depth primer must draw first');
 assert(!attributeControl||diagnosticWitness,'Witness control cannot enter product quality captures');
 if(generic==='fresh')assert(!everSeeded,'An explicitly reset context cannot be called fresh');
 const genericBefore=uvLocation===undefined?null:Array.from(gl.getVertexAttrib(uvLocation,gl.CURRENT_VERTEX_ATTRIB) as Float32Array);
 const seed=generic==='fresh'?null:seedGeneric(generic==='poisoned'?poison:zero,generic==='poisoned'?'poison':'reset');
 const owner=owners[side];configure(owner,view);
 const saved=owner.meshes.map(mesh=>({mesh,visible:mesh.visible,castShadow:mesh.castShadow,material:mesh.material,compile:mesh.material.onBeforeCompile,colorWrite:mesh.material.colorWrite,depthWrite:mesh.material.depthWrite,before:mesh.onBeforeRender,after:mesh.onAfterRender,beforeShadow:mesh.onBeforeShadow,afterShadow:mesh.onAfterShadow}));
 const materialHooks=new Map<T.Material,T.Material['onBeforeCompile']>();
 for(const item of saved){
  const {mesh}=item;mesh.visible=presentation==='reverse'||(presentation==='primer'?mesh===owner.warm:mesh!==owner.warm&&presentation!=='hidden'&&!presentation.startsWith('omit:'+mesh.name));
  mesh.castShadow=!diagnosticWitness&&!['no-casters','receiver-no-casters'].includes(presentation)&&presentation!=='receiver-omit:'+mesh.name;
  if(diagnosticWitness&&mesh!==owner.warm)mesh.material=witness() as unknown as T.MeshStandardMaterial;
  else if(presentation.startsWith('receiver')){mesh.material.colorWrite=false;mesh.material.depthWrite=false;}
  const material=mesh.material;
  if(!materialHooks.has(material)){
   const previous=material.onBeforeCompile;materialHooks.set(material,previous);
   material.onBeforeCompile=function(shader,r){previous.call(this,shader,r);shaderTables.set(material,shader);};
  }
 }
 const receipts:unknown[]=[],selections:unknown[]=[],resets:unknown[]=[],failures:string[]=[];let active:Active|undefined;
 for(const item of saved){const {mesh}=item;
  mesh.onBeforeRender=function(...args){item.before.apply(this,args);active={mesh,material:args[4],kind:diagnosticWitness?'witness':'color',selected:range(mesh.geometry),camera:args[2]};selections.push({name:mesh.name,kind:active.kind,range:active.selected});};
  mesh.onAfterRender=function(...args){try{item.after.apply(this,args);}finally{resets.push({name:mesh.name,kind:diagnosticWitness?'witness':'color',range:range(mesh.geometry)});active=undefined;}};
  mesh.onBeforeShadow=function(...args){item.beforeShadow.apply(this,args);active={mesh,material:args[5],kind:'shadow',selected:range(mesh.geometry),camera:args[3]};selections.push({name:mesh.name,kind:'shadow',range:active.selected});};
  mesh.onAfterShadow=function(...args){try{item.afterShadow.apply(this,args);}finally{resets.push({name:mesh.name,kind:'shadow',range:range(mesh.geometry)});active=undefined;}};
 }
 const previousDraw=gl.drawElements,drawDescriptor=Object.getOwnPropertyDescriptor(gl,'drawElements');
 const wrappedDraw=function(this:WebGL2RenderingContext,...args:Parameters<WebGL2RenderingContext['drawElements']>){
  const result=Reflect.apply(previousDraw,this,args);
  if(active){const {mesh,material,kind,selected}=active;
   receipts.push({name:mesh.name,kind,geometryId:id(mesh.geometry),materialType:material.type,materialMap:!!(material as T.MeshStandardMaterial).map,materialOpacity:material.opacity,materialAlphaTest:material.alphaTest,materialAlphaHash:material.alphaHash,materialAlphaToCoverage:material.alphaToCoverage,customDepth:!!mesh.customDepthMaterial,customDistance:!!mesh.customDistanceMaterial,selected,fullIndexCount:mesh.geometry.index!.count,indexBytes:mesh.geometry.index!.array.BYTES_PER_ELEMENT,cameraMatrixWorld:active.camera.matrixWorld.toArray(),cameraProjection:active.camera.projectionMatrix.toArray(),draw:{mode:args[0],count:args[1],type:args[2],offset:args[3],returned:true},native:nativeProgram(),uniforms:nativeUniforms(material)});
  }
  return result;
 };
 const bytes=new Uint8Array(width*height*4),shadowBytes=new Uint8Array(shadowSize*shadowSize*4);
 let samples:number|undefined,glError:number|undefined,shadowMetadata:unknown=null,resetSeed:unknown=null;
 try{
  Object.defineProperty(gl,'drawElements',{value:wrappedDraw,writable:true,configurable:true});
  label.textContent=[side,view,output,generic,presentation,diagnosticWitness?'diagnostic UV witness':'actual product materials'].join(' · ');
  renderer.setRenderTarget(output==='screen-msaa4'?null:target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.shadowMap.needsUpdate=true;
  renderer.render(owner.scene,camera);samples=gl.getParameter(gl.SAMPLES);
  if(output==='screen-msaa4')gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);else renderer.readRenderTargetPixels(target,0,0,width,height,bytes);
  const map=owner.sun.shadow.map;assert(map instanceof T.WebGLRenderTarget,'Actual native WebGL shadow target missing');assert(map.width===shadowSize&&map.height===shadowSize,'Actual shadow target size changed');
  const oldTarget=renderer.getRenderTarget(),oldFramebuffer=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);renderer.readRenderTargetPixels(map,0,0,shadowSize,shadowSize,shadowBytes);
  const restored=renderer.getRenderTarget()===oldTarget&&gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===oldFramebuffer;
  shadowMetadata={width:map.width,height:map.height,type:map.texture.type,format:map.texture.format,colorSpace:map.texture.colorSpace,samples:map.samples,depthTexture:map.depthTexture?{type:map.depthTexture.type,format:map.depthTexture.format}:null,readback:'RGBA8 BasicDepthPacking color attachment; not native depthTexture bytes',readbackRestored:restored,lightPosition:owner.sun.position.toArray(),lightTarget:owner.sun.target.position.toArray(),lightMatrixWorld:owner.sun.matrixWorld.toArray(),camera:{left:owner.sun.shadow.camera.left,right:owner.sun.shadow.camera.right,top:owner.sun.shadow.camera.top,bottom:owner.sun.shadow.camera.bottom,near:owner.sun.shadow.camera.near,far:owner.sun.shadow.camera.far,matrixWorld:owner.sun.shadow.camera.matrixWorld.toArray(),projection:owner.sun.shadow.camera.projectionMatrix.toArray()}};
  if(!restored)failures.push('Shadow color readback changed the active framebuffer');glError=gl.getError();
 }catch(error){failures.push(String(error));}
 finally{
  if(drawDescriptor)Object.defineProperty(gl,'drawElements',drawDescriptor);else delete (gl as unknown as Record<string,unknown>).drawElements;
  for(const [material,hook]of materialHooks)material.onBeforeCompile=hook;
  for(const item of saved){const {mesh}=item;mesh.onBeforeRender=item.before;mesh.onAfterRender=item.after;mesh.onBeforeShadow=item.beforeShadow;mesh.onAfterShadow=item.afterShadow;mesh.visible=item.visible;mesh.castShadow=item.castShadow;mesh.material=item.material;mesh.material.colorWrite=item.colorWrite;mesh.material.depthWrite=item.depthWrite;}
  if(generic==='poisoned')try{resetSeed=seedGeneric(zero,'reset');}catch(error){failures.push('Generic restoration: '+String(error));}
 }
 const restored=saved.every(item=>item.mesh.onBeforeRender===item.before&&item.mesh.onAfterRender===item.after&&item.mesh.onBeforeShadow===item.beforeShadow&&item.mesh.onAfterShadow===item.afterShadow&&item.mesh.material===item.material&&item.mesh.material.onBeforeCompile===item.compile&&item.mesh.material.colorWrite===item.colorWrite&&item.mesh.material.depthWrite===item.depthWrite&&item.mesh.geometry.drawRange.start===0&&item.mesh.geometry.drawRange.count===Infinity)&&gl.drawElements===previousDraw;
 const visibilityRestored=saved.every(item=>item.mesh.visible===item.visible),casterRestored=saved.every(item=>item.mesh.castShadow===item.castShadow),genericAfter=uvLocation===undefined?null:Array.from(gl.getVertexAttrib(uvLocation,gl.CURRENT_VERTEX_ATTRIB) as Float32Array);
 const genericRestored=generic!=='poisoned'||JSON.stringify(genericBefore)===JSON.stringify(genericAfter);
 if(!restored||!visibilityRestored||!casterRestored||!genericRestored)failures.push('Original hooks/materials/ranges/visibility/generic input were not restored');if(samples!==(output==='screen-msaa4'?4:0))failures.push('Wrong actual output sample count');if(glError!==gl.NO_ERROR||gl.isContextLost())failures.push('GL error or lost context');failures.push(...sourceErrors);
 return {side,view,output,generic,presentation,diagnosticWitness,attributeControl,width,height,samples,glError,seed,resetSeed,everSeeded,uvLocation,genericBefore,genericAfter,focus:focus.toArray(),camera:{position:camera.position.toArray(),matrixWorld:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},receipts,selections,resets,lifecycle:{restored,visibilityRestored,casterRestored,genericRestored},shadow:shadowMetadata,passed:failures.length===0,failures,rgba:base64(bytes),png:png(bytes,width,height),shadowRgba:base64(shadowBytes),shadowPng:png(shadowBytes,shadowSize,shadowSize)};
}
function prime(){
 assert(status==='ready'&&!primed&&!everSeeded,'Priming must be the first real rendering');
 const result=render('baseline',0,'screen-msaa4','fresh',reverse?'reverse':'primer');
 const shadowRows=result.receipts.filter((row:unknown)=>(row as {kind:string}).kind==='shadow') as {name:string;native:ReturnType<typeof nativeProgram>}[];
 assert(shadowRows.length===(reverse?5:1),'Unexpected actual priming shadow submissions');
 if(!reverse){
  assert(shadowRows[0].name===warmName,'Warm mapped limestone did not prime first');const uv=shadowRows[0].native.attributes.find(attribute=>attribute.name==='uv');assert(uv?.enabled&&Number.isSafeInteger(uv.location)&&uv.location>=0,'Mapped limestone must bind a real UV array');uvLocation=uv.location;
  assert(JSON.stringify(initialGeneric[uvLocation].value)===JSON.stringify([0,0,0,1]),'Fresh mapped UV generic state was not the context default');
 }else assert(shadowRows.every(row=>!row.native.attributes.some(attribute=>attribute.name==='uv')),'Reversed native depth path unexpectedly consumes UV');
 primed=true;return result;
}
async function setAttributeControl(enabled:boolean){
 assert(primed&&!reverse&&enabled!==attributeControl,'Invalid diagnostic UV control transition');
 for(const mesh of owners.candidate.eligible){
  if(enabled){const original=mesh.geometry.getAttribute('uv');assert(original instanceof T.BufferAttribute,'Candidate zero attribute unavailable');savedUv.set(mesh,original);
   let changed=poisonUv.get(mesh);if(!changed){const values=new Float32Array(original.count*2);for(let i=0;i<original.count;i++){values[i*2]=poison[0];values[i*2+1]=poison[1];}changed=new T.BufferAttribute(values,2);poisonUv.set(mesh,changed);}mesh.geometry.setAttribute('uv',changed);
  }else{const original=savedUv.get(mesh);assert(original,'Original UV identity unavailable');mesh.geometry.setAttribute('uv',original);savedUv.delete(mesh);}
 }
 attributeControl=enabled;
 return {enabled,attributes:await Promise.all(owners.candidate.eligible.map(async mesh=>({name:mesh.name,sourceHasUv:mesh===owners.candidate.warm||owners.candidate.inputs.get(mesh)!.geometry.hasAttribute('uv'),attribute:await attributeEvidence(mesh.geometry.getAttribute('uv'))}))) };
}
async function retain(bytes:Uint8Array){
 const digest=await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>),sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
 if(!immutableBuffers.has(sha256))immutableBuffers.set(sha256,bytes);return {sha256,bytes:bytes.byteLength};
}
async function attributeEvidence(attribute:T.BufferAttribute|T.InterleavedBufferAttribute){
 const interleaved=attribute instanceof T.InterleavedBufferAttribute;
 return {objectId:id(attribute),arrayType:attribute.array.constructor.name,itemSize:attribute.itemSize,count:attribute.count,normalized:attribute.normalized,interleaved,stride:interleaved?attribute.data.stride:attribute.itemSize,offset:interleaved?attribute.offset:0,usage:interleaved?attribute.data.usage:attribute.usage,version:interleaved?attribute.data.version:attribute.version,buffer:await retain(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength))};
}
async function geometryRecord(geometry:T.BufferGeometry){
 assert(geometry.index,'Original/display bridge index missing');
 return {objectId:id(geometry),attributes:Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async([name,a])=>[name,await attributeEvidence(a)]))),index:await attributeEvidence(geometry.index),groups:geometry.groups,drawRange:range(geometry),morphAttributes:Object.keys(geometry.morphAttributes),morphTargetsRelative:geometry.morphTargetsRelative,boundingBox:geometry.boundingBox?{objectId:id(geometry.boundingBox),min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}:null,boundingSphere:geometry.boundingSphere?{objectId:id(geometry.boundingSphere),center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius}:null};
}
async function geometryEvidence(){
 assert(!attributeControl,'Geometry proof requires restored original candidate attribute objects');
 const result:Record<string,unknown>={};
 for(const side of sides){const owner=owners[side],rows=[];
  for(const mesh of owner.meshes){const input=owner.inputs.get(mesh)!,material=mesh.material;
   const source=await geometryRecord(input.geometry),display=await geometryRecord(mesh.geometry);
   rows.push({name:mesh.name,source,display,matrixWorld:mesh.matrixWorld.toArray(),sourceMatrixWorld:input.matrixWorld,sourceGeometryObjectUnchanged:input.geometry.index===input.index,originalAttributeObjectsRetained:Object.entries(input.attributes).every(([name,a])=>input.geometry.getAttribute(name)===a&&mesh.geometry.getAttribute(name)===a),materialObjectUnchanged:material===input.material,compileUnchanged:material.onBeforeCompile===input.compile,keyUnchanged:material.customProgramCacheKey===input.key,raycastWrapperPresent:mesh.raycast!==input.raycast,rays:rayEvidence(mesh,input.rays),originalRays:input.rays,material:{name:material.name,type:material.type,side:material.side,shadowSide:material.shadowSide,transparent:material.transparent,opacity:material.opacity,alphaTest:material.alphaTest,alphaHash:material.alphaHash,alphaToCoverage:material.alphaToCoverage,depthWrite:material.depthWrite,colorWrite:material.colorWrite,defines:material.defines,customKey:material.customProgramCacheKey(),map:!!material.map,customDepth:!!mesh.customDepthMaterial,customDistance:!!mesh.customDistanceMaterial}});
  }
  result[side]={rows,receiptNames:owner.receipts?[...owner.receipts.keys()].map(mesh=>mesh.name):[],detail:owner.detail.stats,constructionStats:owner.constructionStats};
 }
 return {sides:result,buffers:[...immutableBuffers].map(([sha256,bytes])=>({sha256,bytes:bytes.byteLength})),note:'Exact source/display typed-array byte views are content addressed; one retained copy per distinct immutable byte sequence. Layout and object-identity references remain per mesh.'};
}
function bufferBytes(sha256:string){const bytes=immutableBuffers.get(sha256);assert(bytes,'Unknown retained geometry buffer');return base64(bytes);}
function state(){return {status,reverse,primed,everSeeded,attributeControl,uvLocation,initialGraphics,initialGeneric,graphics:graphics(),errors:[...sourceErrors],seedHistory,expected:{qualityColor:8,qualityShadow:8,witnessPairs:4,witnessControls:8},scope:'Actual shipped decorated/cull bridge in a bounded standalone scene. Warm stone primes the mapped depth program, then is excluded identically from the four-caster quality captures. Diagnostic UV witness and reversed-order contract are separate from product equivalence.'};}
function programEvidence(){return [...programs.values()].map(({program,...entry})=>({...entry,linked:Boolean(gl.getProgramParameter(program,gl.LINK_STATUS))}));}
const ready=(async()=>{
 assert(T.REVISION==='185','Pinned Three revision changed');assert(/Metal/i.test(initialGraphics.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(initialGraphics.renderer),'Native Metal renderer required');
 assert(initialGraphics.defaultDrawFramebuffer&&initialGraphics.contextAttributes?.antialias&&initialGraphics.samples===4&&initialGraphics.sampleBuffers===1&&initialGraphics.devicePixelRatio===1&&initialGraphics.width===width&&initialGraphics.height===height,'Actual default4xMSAA at320x240 DPR1 required');
 const [asset,map]=await Promise.all([fetch('/belle/landmarks.glb').then(response=>{assert(response.ok,'Actual shipped landmark asset unavailable');return response.arrayBuffer();}),fetch('/belle/map.json').then(response=>{assert(response.ok,'Actual shipped map unavailable');return response.json() as Promise<ParkMap>;}),loadRealisticMaterials(renderer)]);
 const cloud=cloudTexture() as T.Texture;
 for(const side of sides){owners[side]=await createOwner(side,asset,map,cloud);if(reverse){const children=owners[side].landmarks.scene.children,warm=owners[side].warm;assert(warm.parent===owners[side].landmarks.scene,'Actual root order contract changed');children.splice(children.indexOf(warm),1);children.push(warm);}}
 status='ready';return state();
})().catch(error=>{status='failed';sourceErrors.push(String(error?.stack??error));throw error;});
Object.assign(window,{__macArthurUvFixture:{ready,prime,render,setAttributeControl,geometryEvidence,bufferBytes,programEvidence,state}});
