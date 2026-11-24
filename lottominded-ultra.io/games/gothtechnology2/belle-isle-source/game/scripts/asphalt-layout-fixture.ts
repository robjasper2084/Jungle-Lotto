import * as T from 'three';
import * as candidate from '../src/belle/pavement.ts';
import {RoadContactSurface} from '../src/belle/roadContactSurface.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {CinematicTerrain} from '../src/belle/cinematicTerrain.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
// @ts-expect-error The isolated driver supplies the exact pure108 source.
import * as baselineImport from 'virtual:belle-asphalt-baseline';
// @ts-expect-error The driver extracts these exact authored construction bytes.
import * as constructionImport from 'virtual:belle-asphalt-construction';

type Side='baseline'|'candidate';
type Output='screen-msaa4'|'target-samples0';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type NativeProgram={id:number;program:WebGLProgram;vertexShader:WebGLShader;fragmentShader:WebGLShader};
type Part={kind:string;offset:number;vertices:number;indices:number[];ranges?:number[][]};
type Meta={stride:number;groups:Part[];triangles:number;bytes:number};
type Owner={scene:T.Scene;contact:RoadContactSurface;atmosphere:WorldAtmosphere;terrain:CinematicTerrain;meshes:Map<string,T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>>;asphalt:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;sourceMaterial:T.MeshStandardMaterial;shader?:Shader};
type DrawRange={start:number;count:number|string};
const baseline:Pick<typeof candidate,'addPavement'>=baselineImport;
const construction=constructionImport as {createAsphalt:()=>T.MeshStandardMaterial;cloudTexture:()=>T.DataTexture};
const sides:Side[]=['baseline','candidate'];
const width=320,height=240;
const canvas=document.createElement('canvas');canvas.id='asphalt-layout-fixture';document.body.append(canvas);
const label=document.createElement('p');document.body.prepend(label);
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=true;
const gl=renderer.getContext() as WebGL2RenderingContext;
const target=new T.WebGLRenderTarget(width,height,{samples:0,type:T.UnsignedByteType,format:T.RGBAFormat,depthBuffer:true,stencilBuffer:false});
target.texture.colorSpace=T.SRGBColorSpace;
const camera=new T.PerspectiveCamera(45,width/height,.1,300);
const owners={} as Record<Side,Owner>;
const programs=new Map<number,NativeProgram>();
const bufferIds=new WeakMap<WebGLBuffer,number>();let nextBufferId=1;
const errors:string[]=[];
let status='loading',meta:Meta,negativeControl=false,savedNormals:Uint32Array|undefined;
const views=[
 {id:'entrance-overhead',triangle:63564,offset:[.1,22,.2]},
 {id:'entrance-oblique',triangle:63564,offset:[12,7,16]},
 {id:'island-overhead',triangle:100158,offset:[.1,29,.2]},
 {id:'island-oblique',triangle:100158,offset:[-18,6,23]}
] as const;
renderer.debug.onShaderError=(context,program,vertex,fragment)=>errors.push([context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].join('\n'));

function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function base64(bytes:Uint8Array){let value='';for(let i=0;i<bytes.length;i+=32768)value+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(value);}
function png(bytes:Uint8Array){
 const output=document.createElement('canvas');output.width=width;output.height=height;
 const ctx=output.getContext('2d')!,image=ctx.createImageData(width,height);
 for(let y=0;y<height;y++)image.data.set(bytes.subarray(y*width*4,(y+1)*width*4),(height-1-y)*width*4);
 ctx.putImageData(image,0,0);return output.toDataURL('image/png').split(',')[1];
}
function range(g:T.BufferGeometry):DrawRange{return {start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:'Infinity'};}
function componentBytes(attribute:T.BufferAttribute|T.InterleavedBufferAttribute){
 assert(attribute.array instanceof Float32Array,'Expected unchanged Float32 pavement components');
 const output=new Uint32Array(attribute.count*attribute.itemSize);
 const source=new Uint32Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength/4);
 const interleaved=attribute instanceof T.InterleavedBufferAttribute;
 const stride=interleaved?attribute.data.stride:attribute.itemSize,offset=interleaved?attribute.offset:0;
 for(let i=0;i<attribute.count;i++)for(let j=0;j<attribute.itemSize;j++)output[i*attribute.itemSize+j]=source[i*stride+offset+j];
 return new Uint8Array(output.buffer);
}
function geometryEvidence(){
 return Object.fromEntries(sides.map(side=>[side,Object.fromEntries([...owners[side].meshes].map(([kind,mesh])=>{
  const g=mesh.geometry,index=g.index;assert(index,'Pavement index missing');
  return [kind,{name:mesh.name,geometryId:g.id,attributes:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,{
   itemSize:a.itemSize,count:a.count,normalized:a.normalized,componentType:a.array.constructor.name,
   interleaved:a instanceof T.InterleavedBufferAttribute,stride:a instanceof T.InterleavedBufferAttribute?a.data.stride:a.itemSize,
   offset:a instanceof T.InterleavedBufferAttribute?a.offset:0,version:a instanceof T.InterleavedBufferAttribute?a.data.version:a.version,
   bytes:base64(componentBytes(a))
  }])),index:{type:index.array.constructor.name,count:index.count,bytes:base64(new Uint8Array(index.array.buffer,index.array.byteOffset,index.array.byteLength))},
   groups:g.groups,morphAttributes:Object.keys(g.morphAttributes),morphTargetsRelative:g.morphTargetsRelative,drawRange:range(g),
   boundingSphere:g.boundingSphere?{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius}:null,
   boundingBox:g.boundingBox?{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}:null,
   position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray(),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,
   material:{name:mesh.material.name,type:mesh.material.type,color:mesh.material.color.toArray(),roughness:mesh.material.roughness,metalness:mesh.material.metalness,side:mesh.material.side,transparent:mesh.material.transparent,depthWrite:mesh.material.depthWrite,depthTest:mesh.material.depthTest,key:mesh.material.customProgramCacheKey(),surface:mesh.material.userData.realisticSurface,profile:mesh.material.userData.realisticProfile},
   customRangeHooks:mesh.onBeforeRender!==T.Object3D.prototype.onBeforeRender&&mesh.onAfterRender!==T.Object3D.prototype.onAfterRender}];
 }))]));
}
function centerAt(start:number){
 const g=owners.baseline.asphalt.geometry,index=g.index!,position=g.getAttribute('position'),center=new T.Vector3();
 assert(start%3===0&&start+2<index.count,'Authored camera triangle out of range');
 for(let i=0;i<3;i++)center.add(new T.Vector3().fromBufferAttribute(position,index.getX(start+i)));
 return center.multiplyScalar(1/3);
}
function collisionEvidence(){
 const g=owners.baseline.asphalt.geometry,index=g.index!,points:number[][]=[];
 for(const view of views)points.push(centerAt(view.triangle).toArray());
 const step=Math.max(3,Math.floor(index.count/96/3)*3);
 for(let start=0;start+2<index.count;start+=step)points.push(centerAt(start).toArray());
 return points.map(([x,y,z])=>({x,y,z,terrainHeight:y-.08,baseline:owners.baseline.contact.height(x,z,y-.08),candidate:owners.candidate.contact.height(x,z,y-.08)}));
}
function graphics(){
 const saved=renderer.getRenderTarget();renderer.setRenderTarget(null);
 const debug=gl.getExtension('WEBGL_debug_renderer_info');
 const info={width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,devicePixelRatio,contextAttributes:gl.getContextAttributes(),samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),version:String(gl.getParameter(gl.VERSION)),threeRevision:T.REVISION,contextLost:gl.isContextLost()};
 renderer.setRenderTarget(saved);return info;
}
function properties(material:T.Material){return renderer.properties.get(material) as {currentProgram?:NativeProgram};}
function pointerProof(owner:Owner){
 const p=properties(owner.asphalt.material).currentProgram;assert(p,'Actual asphalt material has no linked program');
 programs.set(p.id,p);
 const attributes=[];
 for(let i=0;i<gl.getProgramParameter(p.program,gl.ACTIVE_ATTRIBUTES);i++){
  const active=gl.getActiveAttrib(p.program,i);assert(active,'Native active attribute unavailable');
  const location=gl.getAttribLocation(p.program,active.name),buffer=gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer|null;
  if(buffer&&!bufferIds.has(buffer))bufferIds.set(buffer,nextBufferId++);
  attributes.push({name:active.name,location,inputType:active.type,inputSize:active.size,enabled:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_ENABLED),size:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_SIZE),type:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_TYPE),normalized:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),integer:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_INTEGER),stride:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_STRIDE),offset:gl.getVertexAttribOffset(location,gl.VERTEX_ATTRIB_ARRAY_POINTER),divisor:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_DIVISOR),bufferId:buffer?bufferIds.get(buffer):null});
 }
 const uniforms:Record<string,unknown>={};
 for(const name of ['skinProfile','skinPlanar','belleSunDirection','belleCloudCoverage']){
  const uniform=owner.shader?.uniforms[name],location=gl.getUniformLocation(p.program,name);
  assert(uniform&&location!==null,'Actual asphalt uniform inactive or missing: '+name);
  const value=uniform.value,native=gl.getUniform(p.program,location);
  const expected=typeof value==='boolean'?value:typeof value==='number'?Math.fround(value):value.toArray().map(Math.fround);
  const observed=typeof value==='boolean'?Boolean(native):typeof value==='number'?native:Array.from(native);
  uniforms[name]={expected,observed,matches:JSON.stringify(expected)===JSON.stringify(observed)};
 }
 const vertex=gl.getShaderSource(p.vertexShader)??'',fragment=gl.getShaderSource(p.fragmentShader)??'';
 return {programId:p.id,linked:Boolean(gl.getProgramParameter(p.program,gl.LINK_STATUS)),currentProgramMatches:gl.getParameter(gl.CURRENT_PROGRAM)===p.program,
  attributes,uniforms,hasAuthoredAsphalt:vertex.includes('asphaltXZ=(modelMatrix*vec4(transformed,1.)).xz;')&&fragment.includes('asphaltRoughnessNoise'),
  hasRealSurface:fragment.includes('uniform bool skinPlanar')&&vertex.includes('skinPosition=position;skinNormal=normal;'),hasAtmosphere:vertex.includes('belleAtmosphereWorld'),hasFog:/^\s*#define\s+USE_FOG\b/m.test(fragment)};
}
function validatePointer(proof:ReturnType<typeof pointerProof>,side:Side){
 const messages:string[]=[];
 if(!proof.linked||!proof.currentProgramMatches||!proof.hasAuthoredAsphalt||!proof.hasRealSurface||!proof.hasAtmosphere||!proof.hasFog)messages.push('Missing native linked authored shader/current program proof');
 const sorted=[...proof.attributes].sort((a,b)=>a.name.localeCompare(b.name));
 if(JSON.stringify(sorted.map(a=>a.name))!==JSON.stringify(['normal','position']))messages.push('Unexpected native active attributes');
 for(const a of sorted){
  const expectedOffset=side==='baseline'&&a.name==='normal'?12:0;
  if(a.inputType!==gl.FLOAT_VEC3||a.inputSize!==1||!a.enabled||a.size!==3||a.type!==gl.FLOAT||a.normalized||a.integer||a.divisor!==0||a.stride!==(side==='baseline'?32:12)||a.offset!==expectedOffset||!a.bufferId)messages.push('Incorrect '+side+' native '+a.name+' pointer');
 }
 if(sorted.length===2&&(side==='baseline'?sorted[0].bufferId!==sorted[1].bufferId:sorted[0].bufferId===sorted[1].bufferId))messages.push('Unexpected native buffer sharing');
 if(Object.values(proof.uniforms).some(v=>!(v as {matches:boolean}).matches))messages.push('Stale actual asphalt uniform');
 return messages;
}
function render(side:Side,viewIndex:number,output:Output,subjectPresent=true){
 assert(status==='ready','Asphalt fixture is not ready');
 const owner=owners[side],view=views[viewIndex];assert(view,'Unknown asphalt view');
 const mesh=owner.asphalt,g=mesh.geometry,focus=centerAt(view.triangle),before=mesh.onBeforeRender,after=mesh.onAfterRender;
 camera.position.copy(focus).add(new T.Vector3(...view.offset));camera.lookAt(focus);camera.updateMatrixWorld(true);
 const sun=owner.scene.getObjectByName('fixture-sun') as T.DirectionalLight;
 sun.position.copy(focus).add(new T.Vector3(12,25,9));sun.target.position.copy(focus);sun.target.updateMatrixWorld(true);
 owner.atmosphere.update(1.25+viewIndex*2.5,new T.Vector3(.28,.55,-.31).normalize(),.42,.9,.15,'high',false,false);
 mesh.visible=subjectPresent;owner.scene.updateMatrixWorld(true);
 const failures:string[]=[],draws:{mode:number;count:number;type:number;offset:number;returned:boolean}[]=[],rangeSelections:DrawRange[]=[],nativeProofs:ReturnType<typeof pointerProof>[]=[];
 const previousDraw=gl.drawElements,drawDescriptor=Object.getOwnPropertyDescriptor(gl,'drawElements');let inAsphalt=false;
 const wrappedDraw=function(this:WebGL2RenderingContext,...args:Parameters<WebGL2RenderingContext['drawElements']>){
  const result=Reflect.apply(previousDraw,this,args);
  if(inAsphalt)draws.push({mode:args[0],count:args[1],type:args[2],offset:args[3],returned:true});
  return result;
 };
 // Chain the shipped range selector before drawing; capture pointers after the
 // actual draw, then always run the shipped reset. Restore both original hooks.
 mesh.onBeforeRender=function(...args){before.apply(this,args);rangeSelections.push(range(g));inAsphalt=true;};
 mesh.onAfterRender=function(...args){
  try{const proof=pointerProof(owner);nativeProofs.push(proof);failures.push(...validatePointer(proof,side));}
  catch(error){failures.push(String(error));}
  finally{inAsphalt=false;after.apply(this,args);}
 };
 const bytes=new Uint8Array(width*height*4);let samples:number|undefined,glError:number|undefined;
 try{
  Object.defineProperty(gl,'drawElements',{value:wrappedDraw,writable:true,configurable:true});
  label.textContent=[view.id,side,output,subjectPresent?'subject':'hidden'].join(' · ');
  renderer.setRenderTarget(output==='screen-msaa4'?null:target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);renderer.shadowMap.needsUpdate=true;
  renderer.render(owner.scene,camera);
  if(output==='screen-msaa4')gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
  else renderer.readRenderTargetPixels(target,0,0,width,height,bytes);
  samples=gl.getParameter(gl.SAMPLES);glError=gl.getError();
 }catch(error){failures.push(String(error));}
 finally{
  if(drawDescriptor)Object.defineProperty(gl,'drawElements',drawDescriptor);else delete (gl as unknown as Record<string,unknown>).drawElements;
  mesh.onBeforeRender=before;mesh.onAfterRender=after;mesh.visible=true;
 }
 const restored=mesh.onBeforeRender===before&&mesh.onAfterRender===after&&g.drawRange.start===0&&g.drawRange.count===Infinity&&gl.drawElements===previousDraw;
 if(!restored)failures.push('Original range/GL hooks were not restored');
 if(samples!==(output==='screen-msaa4'?4:0))failures.push('Wrong actual framebuffer sample count');
 if(glError!==gl.NO_ERROR||gl.isContextLost())failures.push('GL error or lost context');
 if(subjectPresent){
  if(draws.length!==1||nativeProofs.length!==1||rangeSelections.length!==1)failures.push('Expected one actual asphalt indexed color draw');
  const draw=draws[0],selected=rangeSelections[0];
  if(!draw||!selected||typeof selected.count!=='number'||draw.mode!==gl.TRIANGLES||draw.type!==gl.UNSIGNED_SHORT||draw.count!==selected.count||draw.offset!==selected.start*2||draw.count<=0||draw.count>=g.index!.count)failures.push('Authored bounded index range was not exercised by the native draw');
 }else if(draws.length||nativeProofs.length||rangeSelections.length)failures.push('Hidden asphalt unexpectedly drew');
 failures.push(...errors);
 return {side,view:view.id,viewIndex,output,subjectPresent,negativeControl,width,height,samples,glError,focus:focus.toArray(),camera:camera.position.toArray(),draws,rangeSelections,nativeProofs,lifecycle:{restored,finalRange:range(g)},passed:failures.length===0,failures,rgba:base64(bytes),png:png(bytes)};
}
function setNegativeControl(enabled:boolean){
 assert(status==='ready','Asphalt fixture is not ready');assert(enabled!==negativeControl,'Control must change state exactly once');
 const normal=owners.candidate.asphalt.geometry.getAttribute('normal');assert(normal instanceof T.BufferAttribute&&normal.array instanceof Float32Array,'Control requires actual normalized asphalt normal buffer');
 const words=new Uint32Array(normal.array.buffer,normal.array.byteOffset,normal.array.byteLength/4);
 if(enabled){savedNormals=words.slice();for(let i=0;i<words.length;i++)words[i]^=0x80000000;}
 else{assert(savedNormals&&savedNormals.length===words.length,'Original normal bits unavailable');words.set(savedNormals);savedNormals=undefined;}
 normal.needsUpdate=true;negativeControl=enabled;
}
function state(){return {status,graphics:graphics(),errors:[...errors],negativeControl,views:views.map(v=>({id:v.id,triangle:v.triangle})),collision:collisionEvidence(),programIds:[...programs.keys()],authoredCounts:{vertices:meta.groups.find(p=>p.kind==='asphalt')!.vertices,indices:meta.groups.find(p=>p.kind==='asphalt')!.indices.length,ranges:meta.groups.find(p=>p.kind==='asphalt')!.ranges!.length},scope:'Actual authored whole asphalt mesh and material in bounded native validation scenes; this is not a full-game performance measurement.'};}
function programEvidence(){return {state:state(),programs:[...programs.values()].map(p=>({id:p.id,linked:Boolean(gl.getProgramParameter(p.program,gl.LINK_STATUS)),vertexSource:gl.getShaderSource(p.vertexShader),fragmentSource:gl.getShaderSource(p.fragmentShader)}))};}
const ready=(async()=>{
 const info=graphics();assert(/Metal/i.test(info.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(info.renderer),'Native Metal required');
 assert(info.contextAttributes?.antialias&&info.samples===4&&info.sampleBuffers===1&&info.devicePixelRatio===1&&info.width===width&&info.height===height,'Actual default4xMSAA at320×240 DPR1 required');
 meta=await fetch('./belle/pavement.json').then(r=>{assert(r.ok,'Pavement metadata unavailable');return r.json();});
 assert(meta.stride===8&&meta.groups.length===5,'Pinned pavement format changed');
 await loadRealisticMaterials(renderer);const cloud=construction.cloudTexture();
 for(const side of sides){
  const scene=new T.Scene();scene.background=new T.Color('#293746');scene.fog=new T.FogExp2(0xb8c4c9,.00012);
  const terrain=new CinematicTerrain(scene),atmosphere=new WorldAtmosphere(scene,cloud),sourceMaterial=construction.createAsphalt();
  const materials:Record<string,T.Material>={asphalt:sourceMaterial};for(const part of meta.groups)if(part.kind!=='asphalt')materials[part.kind]=new T.MeshStandardMaterial({name:'Unrendered '+part.kind});
  const contact=new RoadContactSurface();await (side==='baseline'?baseline:candidate).addPavement(scene,materials,contact);
  const meshes=new Map<string,T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>>();
  for(const part of meta.groups){const mesh=scene.getObjectByName('Joined island pavement · '+part.kind);assert(mesh instanceof T.Mesh&&!Array.isArray(mesh.material),'Authored loader mesh missing');meshes.set(part.kind,mesh as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>);if(part.kind!=='asphalt')mesh.visible=false;}
  applyRealisticMaterials(scene);dressSunsetGround(scene);await Promise.resolve();atmosphere.flush();
  const asphalt=meshes.get('asphalt')!;assert(asphalt.geometry.getAttribute('position').count===28995&&asphalt.geometry.index?.count===138228&&asphalt.receiveShadow&&!asphalt.castShadow,'Authored asphalt geometry/shadow contract changed');
  const owner:Owner={scene,contact,atmosphere,terrain,meshes,asphalt,sourceMaterial};owners[side]=owner;
  const previous=asphalt.material.onBeforeCompile;asphalt.material.onBeforeCompile=function(shader,r){previous.call(this,shader,r);owner.shader=shader;};
  const ambient=new T.HemisphereLight(0xd5e8f8,0x63513a,1.3),sun=new T.DirectionalLight(0xffdfb0,2.1);sun.name='fixture-sun';sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:.1,far:450});sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(ambient,sun,sun.target);
 }
 const collision=collisionEvidence();assert(collision.every(p=>p.baseline===p.candidate&&Number.isFinite(p.baseline)),'Actual pavement collision queries changed');
 status='ready';return state();
})().catch(error=>{status='failed';errors.push(String(error?.stack??error));throw error;});
Object.assign(window,{__asphaltLayoutFixture:{ready,render,setNegativeControl,state,geometryEvidence,programEvidence}});
