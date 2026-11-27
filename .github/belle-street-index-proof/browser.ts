/** Isolated street comparison. All game imports are immutable, driver-bound Git bytes. */
import * as T from 'three';
import plan from 'proof:plan';
import {StaticPaletteBatch as OriginalPalette} from 'original:staticPaletteBatch.ts';
import {StaticPaletteBatch as IndexedPalette} from 'candidate:staticPaletteBatch.ts';
import {addStreetDetails} from 'baseline:streetDetails.ts';
import {preserveStreetBatchOrder} from 'baseline:streetBatchOrder.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from 'baseline:realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from 'baseline:photoReferenceSurfaces.ts';
import {dressSunsetGround} from 'baseline:sunsetGround.ts';
import {WorldAtmosphere} from 'baseline:worldAtmosphere.ts';
import {cloudTexture} from 'original:cloudTexture';

type Lane='original'|'indexed'|'restored';
type Group={mesh:T.BatchedMesh;sources:T.Mesh[];ordinal:number;sortRows:any[]};
const assert=(v:unknown,message:string):asserts v=>{if(!v)throw Error(message);};
const same=(a:unknown,b:unknown,message:string)=>assert(JSON.stringify(a)===JSON.stringify(b),message);
const hash=async(b:Uint8Array|string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof b==='string'?new TextEncoder().encode(b):b as Uint8Array<ArrayBuffer>)),v=>v.toString(16).padStart(2,'0')).join('');
const raw=(a:ArrayBufferView)=>new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
const words=(a:number[])=>Array.from(new Uint32Array(new Float64Array(a).buffer));
const base64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
const ids=new WeakMap<object,number>();let nextId=1;
const id=(object:object|null|undefined)=>{if(!object)return null;let value=ids.get(object);if(!value){value=nextId++;ids.set(object,value);}return value;};
const persisted=new Set<string>();
async function persist(name:string,payload:any){assert(!persisted.has(name),'Duplicate evidence '+name);const ack=await(window as any).persistStreetEvidence(name,payload);assert(ack?.persisted===true&&ack.name===name,'Evidence was not acknowledged '+name);persisted.add(name);}
const json=(name:string,value:any)=>persist(name,{kind:'json',value});
async function binary(name:string,bytes:Uint8Array,format:string,extra:any={}){
 const gzip=new Uint8Array(await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 await persist(name,{kind:format==='RGBA8-bottom-up'?'pixels':'binary',format,bytes:bytes.length,sha256:await hash(bytes),gzipBase64:base64(gzip),...(format==='RGBA8-bottom-up'?{}:{endianness:'little',elements:bytes.length/({Float32:4,Float64:8,Uint16:2,Uint32:4} as any)[format]}),...extra});
 return name;
}
function changed(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Pixel size changed');let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])n++;return n;}

(window as any).runStreetIndexProof=async()=>{
 assert(plan.candidate?.commit&&plan.candidate?.tree,'UNBOUND candidate cannot run');
 assert(T.REVISION==='185','Only the pinned Three r185 path is allowed');
 assert(new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4,'Little-endian typed arrays required');
 const started=performance.now(),guard=()=>assert(performance.now()-started<plan.bounds.driverMs,'Proof internal deadline expired');
 const width=plan.viewport.width,height=plan.viewport.height,canvas=document.querySelector('canvas')!;
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType});
 renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const gl=renderer.getContext() as WebGL2RenderingContext,extension=gl.getExtension('WEBGL_multi_draw') as any;
 assert(extension&&typeof gl.fenceSync==='function','Actual WebGL2 multi-draw and fences are mandatory');
 const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2') as any;
 assert(timer,'GPU timing extension unavailable; no replacement renderer or CPU-time substitution');
 const debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(58,width/height,.1,3500);
 scene.background=new T.Color(0x738ba0);scene.fog=new T.FogExp2(0x879394,.00012);
 const atmosphere=new WorldAtmosphere(scene,cloudTexture());
 const ambient=new T.HemisphereLight(0xd8e4f1,0x465443,2.1);scene.add(ambient);
 const sun=new T.DirectionalLight(0xffefdc,3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-120,right:120,top:120,bottom:-120,near:1,far:600});sun.shadow.bias=-.0001;scene.add(sun,sun.target);
 const lamp=new T.PointLight(0x8cbcff,500,80,2);scene.add(lamp);
 const caster=new T.Mesh(new T.BoxGeometry(15,12,8),new T.MeshStandardMaterial({color:0x8f8070,roughness:.8}));caster.castShadow=true;caster.receiveShadow=true;scene.add(caster);
 const ground=new T.Mesh(new T.PlaneGeometry(12000,12000),new T.MeshStandardMaterial({color:0x676b67,roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=1.95;ground.receiveShadow=true;scene.add(ground);
 let original:any,indexed:any,street:any,sources:T.Mesh[]=[],tiles:T.Mesh[]=[];
 const groups:{original:Group[];indexed:Group[]}={original:[],indexed:[]},groupByMesh=new Map<T.Object3D,{group:Group;lane:'original'|'indexed'}>();
 const programMap=new Map<WebGLProgram,any>(),nativeBuffers=new Map<string,WebGLBuffer>(),textures=new Set<T.Texture>(),sourceDisposals=new Map<T.BufferGeometry,number>();
 const catalog:any={groups:[]},errors:string[]=[],completed:string[]=[],caseReceipts:any[]=[];
 let currentContext:any=null,currentDraws:any[]|null=null,observing=false;
 const restorers:(()=>void)[]=[];
 async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'GPU fence allocation failed');gl.flush();const begin=performance.now();try{for(;;){guard();const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return performance.now()-begin;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU fence failed');assert(performance.now()-begin<plan.bounds.fenceMs,'GPU fence deadline');await new Promise(r=>setTimeout(r,8));}}finally{gl.deleteSync(sync);}}
 function programRecord(program:WebGLProgram,streetProgram:boolean){
  let p=programMap.get(program);if(p){p.street ||= streetProgram;return p;}
  const shaders=gl.getAttachedShaders(program)||[],vertex=shaders.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.VERTEX_SHADER),fragment=shaders.find(s=>gl.getShaderParameter(s,gl.SHADER_TYPE)===gl.FRAGMENT_SHADER);assert(vertex&&fragment,'Attached shader source unavailable');
  const attributes=[];for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_ATTRIBUTES);i++){const a=gl.getActiveAttrib(program,i)!;attributes.push({index:i,name:a.name,size:a.size,type:a.type,location:gl.getAttribLocation(program,a.name)});}
  for(const a of attributes){if(a.name==='gl_VertexID')assert(a.location===-1&&a.size===1&&a.type===gl.INT,'Unexpected gl_VertexID reflection');else assert(!a.name.startsWith('gl_')&&a.location>=0,'Unknown built-in or unbound user attribute');}
  p={id:id(program),linked:gl.getProgramParameter(program,gl.LINK_STATUS)===true,street:streetProgram,vertex:gl.getShaderSource(vertex)||'',fragment:gl.getShaderSource(fragment)||'',attributes,uniforms:[]};
  for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i)!;p.uniforms.push({index:i,name:u.name,size:u.size,type:u.type});}
  programMap.set(program,p);return p;
 }
 function uniformValues(program:WebGLProgram,p:any){
  const old=gl.getParameter(gl.ACTIVE_TEXTURE),result:any[]=[];
  const floats=new Set([gl.FLOAT,gl.FLOAT_VEC2,gl.FLOAT_VEC3,gl.FLOAT_VEC4,gl.FLOAT_MAT2,gl.FLOAT_MAT3,gl.FLOAT_MAT4,gl.FLOAT_MAT2x3,gl.FLOAT_MAT2x4,gl.FLOAT_MAT3x2,gl.FLOAT_MAT3x4,gl.FLOAT_MAT4x2,gl.FLOAT_MAT4x3]);
  const samplerTargets=new Map<number,number>([[gl.SAMPLER_2D,gl.TEXTURE_BINDING_2D],[gl.SAMPLER_2D_SHADOW,gl.TEXTURE_BINDING_2D],[gl.INT_SAMPLER_2D,gl.TEXTURE_BINDING_2D],[gl.UNSIGNED_INT_SAMPLER_2D,gl.TEXTURE_BINDING_2D],[gl.SAMPLER_CUBE,gl.TEXTURE_BINDING_CUBE_MAP],[gl.SAMPLER_3D,gl.TEXTURE_BINDING_3D],[gl.SAMPLER_2D_ARRAY,gl.TEXTURE_BINDING_2D_ARRAY]]);
  try{for(const u of p.uniforms){const location=gl.getUniformLocation(program,u.name);assert(location!==null,'Active uniform without location');const value=gl.getUniform(program,location),values=ArrayBuffer.isView(value)?Array.from(value as any):[value];let encoded:any;
   if(floats.has(u.type))encoded={kind:'Float32',words:Array.from(new Uint32Array(new Float32Array(values as number[]).buffer))};else encoded={kind:'integer-or-boolean',values};
   const target=samplerTargets.get(u.type);if(target){encoded.textures=values.map(unit=>{assert(Number.isInteger(unit),'Noninteger texture unit');gl.activeTexture(gl.TEXTURE0+(unit as number));return{unit,nativeTexture:id(gl.getParameter(target))};});}
   result.push({name:u.name,type:u.type,size:u.size,value:encoded});
  }}finally{gl.activeTexture(old);}return result;
 }
 function captureNative(method:string,args:any[]){
  if(!observing)return;assert(currentContext&&currentDraws,'Native draw bypassed the observed Three direct path');
  const {object,material,geometry,root}=currentContext,owned=groupByMesh.get(object),program=gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;assert(program,'Native draw has no current program');
  const p=programRecord(program,!!owned),attributes=[];
  for(const a of p.attributes){if(a.location<0)continue;const columns=a.type===gl.FLOAT_MAT4?4:a.type===gl.FLOAT_MAT3?3:a.type===gl.FLOAT_MAT2?2:1;for(let element=0;element<a.size;element++)for(let column=0;column<columns;column++){const location=a.location+element*columns+column,buffer=gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING) as WebGLBuffer;attributes.push({name:a.name,location,arrayElement:element,column,enabled:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_ENABLED),size:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_SIZE),type:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_TYPE),normalized:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),stride:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_STRIDE),offset:gl.getVertexAttribOffset(location,gl.VERTEX_ATTRIB_ARRAY_POINTER),divisor:gl.getVertexAttrib(location,gl.VERTEX_ATTRIB_ARRAY_DIVISOR),buffer:id(buffer)});if(owned){assert(columns===1&&a.size===1,'Unexpected street matrix/array attribute');nativeBuffers.set(owned.lane+'-'+owned.group.ordinal+'-'+a.name,buffer);}}}
  const element=gl.getParameter(gl.ELEMENT_ARRAY_BUFFER_BINDING) as WebGLBuffer|null;if(owned&&element)nativeBuffers.set(owned.lane+'-'+owned.group.ordinal+'-index',element);
  const state:any={};for(const [name,key]of [['depthTest',gl.DEPTH_TEST],['depthMask',gl.DEPTH_WRITEMASK],['depthFunc',gl.DEPTH_FUNC],['colorMask',gl.COLOR_WRITEMASK],['blend',gl.BLEND],['cullFace',gl.CULL_FACE],['cullMode',gl.CULL_FACE_MODE],['frontFace',gl.FRONT_FACE],['viewport',gl.VIEWPORT],['scissor',gl.SCISSOR_BOX],['scissorTest',gl.SCISSOR_TEST],['polygonOffset',gl.POLYGON_OFFSET_FILL]] as const){const value=gl.getParameter(key);state[name]=ArrayBuffer.isView(value)?Array.from(value as any):value;}
  const draw:any={object:owned?'street-group-'+owned.group.ordinal:object.id,actualObjectId:object.id,group:owned?.group.ordinal??null,geometry:geometry.id,material:material.id,program:p.id,phase:root===null?'shadow':'color',target:id(gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)),reflectionAttributes:p.attributes,attributes,elementBuffer:id(element),uniforms:uniformValues(program,p),state,transformWords:words([...object.matrixWorld.elements,...object.modelViewMatrix.elements,...object.normalMatrix.elements]),method};
  if(owned){
   const elementDraw=method==='multiDrawElementsWEBGL';assert(elementDraw||method==='multiDrawArraysWEBGL','Street multi-draw unexpectedly used a fallback call');const drawCount=args[elementDraw?6:5],starts=Array.from((elementDraw?args[4]:args[1]).slice(elementDraw?args[5]:args[2],(elementDraw?args[5]:args[2])+drawCount)),counts=Array.from((elementDraw?args[1]:args[3]).slice(elementDraw?args[2]:args[4],(elementDraw?args[2]:args[4])+drawCount));
   Object.assign(draw,{mode:args[0],indexType:elementDraw?args[3]:null,drawCount,starts,counts,indirect:Array.from((object as any)._indirectTexture.image.data.slice(0,drawCount)),sortRows:owned.group.sortRows});
  }else draw.arguments=args.map(a=>ArrayBuffer.isView(a)?Array.from(a as any):a);
  currentDraws.push(draw);
 }
 function wrap(target:any,key:string){const previous=target[key];assert(typeof previous==='function','Required native method missing '+key);const observer=function(this:any,...args:any[]){captureNative(key,args);return Reflect.apply(previous,target,args);};target[key]=observer;assert(target[key]===observer,'Cannot observe native method '+key);restorers.push(()=>{assert(target[key]===observer,'Native observer was replaced');target[key]=previous;});}
 for(const key of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])wrap(gl,key);
 for(const key of ['multiDrawArraysWEBGL','multiDrawElementsWEBGL'])wrap(extension,key);
 const direct=renderer.renderBufferDirect;renderer.renderBufferDirect=function(this:T.WebGLRenderer,...args:any[]){const previous=currentContext;currentContext={camera:args[0],root:args[1],geometry:args[2],material:args[3],object:args[4]};try{return Reflect.apply(direct,this,args);}finally{currentContext=previous;}} as any;
 restorers.push(()=>{renderer.renderBufferDirect=direct;});
 function prepare(lane:'original'|'indexed'){return(mesh:T.BatchedMesh,list:T.Mesh[])=>{assert(preserveStreetBatchOrder(mesh,list)!==false,'Original order/identity guard rejected '+lane);const group:Group={mesh,sources:list,ordinal:groups[lane].length,sortRows:[]};groups[lane].push(group);groupByMesh.set(mesh,{group,lane});const sort=mesh.customSort!;mesh.setCustomSort(function(list:any,camera:T.Camera){Reflect.apply(sort,mesh,[list,camera]);if(observing)group.sortRows=list.map((row:any)=>({start:row.start,count:row.count,index:row.index,z:row.z,zWords:words([row.z])}));});};}
 async function sourceSnapshot(){
  const result=[];for(const mesh of tiles){const g=mesh.geometry,p=g.getAttribute('position') as T.BufferAttribute,n=g.getAttribute('normal') as T.BufferAttribute;assert(g.index===null,'Original geometry became indexed');result.push({id:mesh.id,name:mesh.name,geometryId:g.id,geometryUuid:g.uuid,geometryIdentity:id(g),attributesIdentity:id(g.attributes),attributeNames:Object.keys(g.attributes).sort(),index:null,positionIdentity:id(p),normalIdentity:id(n),positionArrayIdentity:id(p.array),normalArrayIdentity:id(n.array),positionSha256:await hash(raw(p.array)),normalSha256:await hash(raw(n.array)),positionCount:p.count,normalCount:n.count,itemSizes:[p.itemSize,n.itemSize],normalized:[p.normalized,n.normalized],usage:[p.usage,n.usage],gpuTypes:[p.gpuType,n.gpuType],versions:[p.version,n.version],drawRange:{start:g.drawRange.start,count:g.drawRange.count===Infinity?'Infinity':g.drawRange.count},groups:g.groups,morphNames:Object.keys(g.morphAttributes),boundingBoxIdentity:id(g.boundingBox),boundingBox:g.boundingBox?words([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()]):null,boundingSphereIdentity:id(g.boundingSphere),boundingSphere:g.boundingSphere?words([...g.boundingSphere.center.toArray(),g.boundingSphere.radius]):null,disposeEvents:sourceDisposals.get(g),raycastIdentity:id(mesh.raycast),matrixWords:words([...mesh.matrix.elements,...mesh.matrixWorld.elements]),parentId:mesh.parent?.id??null,materialId:(mesh.material as any).id,materialUuid:(mesh.material as T.Material).uuid,layers:mesh.layers.mask,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder});}return result;
 }
 function raycastSnapshot(){
  const raycaster=new T.Raycaster(),rows=[];for(const control of plan.groupVisibilityControls){const pose=plan.poses.find((p:any)=>control.case.startsWith(p.name+'-'));camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3(...pose.target));camera.updateMatrixWorld(true);const [x,y]=control.witness.pixelTopLeft;raycaster.setFromCamera(new T.Vector2((x+.5)/width*2-1,1-(y+.5)/height*2),camera);
   // Original scene geometries are the authority. Neither display root supplies hits.
   rows.push({group:control.group,pose:pose.name,hits:raycaster.intersectObjects(tiles,false).map(h=>({object:h.object.id,name:h.object.name,faceIndex:h.faceIndex,face:h.face?{a:h.face.a,b:h.face.b,c:h.face.c,materialIndex:h.face.materialIndex,normal:words(h.face.normal.toArray())}:null,distance:words([h.distance]),point:words(h.point.toArray()),uv:h.uv?words(h.uv.toArray()):null}))});}return rows;
 }
 function setCase(c:any){
  original.endView();indexed.endView();const pose=plan.poses.find((p:any)=>p.name===c.pose);street.update(pose.x,pose.z);camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3(...pose.target));camera.updateMatrixWorld(true);
  const frontX=pose.x+Math.sin(pose.yaw)*38,frontZ=pose.z+Math.cos(pose.yaw)*38;sun.position.set(frontX-55,95,frontZ+45);sun.target.position.set(frontX,2,frontZ);sun.intensity=c.night?.07:3;ambient.intensity=c.night?.22:2.1;lamp.intensity=c.night?700:0;lamp.position.set(frontX-Math.cos(pose.yaw)*8,8,frontZ+Math.sin(pose.yaw)*8);caster.position.set(frontX+Math.cos(pose.yaw)*8,8,frontZ-Math.sin(pose.yaw)*8);
  scene.background=new T.Color(c.night?0x101b31:0x738ba0);sun.castShadow=c.shadows;renderer.shadowMap.enabled=c.shadows;scene.updateMatrixWorld(true);
  const direction=new T.Vector3().subVectors(sun.position,sun.target.position).normalize();atmosphere.update(18.25,direction,.42,c.night?0:1,.15,'cinematic',false,false);scene.updateMatrixWorld(true);
 }
 function choose(lane:Lane,hide:number|null=null){original.endView();indexed.endView();const palette=lane==='indexed'?indexed:original;palette.beginView(sun.castShadow,camera);if(hide!==null)groups[lane==='indexed'?'indexed':'original'][hide].mesh.visible=false;}
 async function renderOnce(capture=false){guard();assert(renderer.getRenderTarget()===null,'Default target required');renderer.shadowMap.needsUpdate=true;const draws:any[]=[];currentDraws=draws;observing=capture;try{renderer.render(scene,camera);}finally{observing=false;currentDraws=null;}const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;const fenceWaitMs=await fence();assert(gl.getError()===gl.NO_ERROR&&!gl.isContextLost(),'GPU render error');return{calls,triangles,draws,fenceWaitMs};}
 async function warm(){for(let i=0;i<plan.warmRendersPerLane;i++)await renderOnce();}
 function matrixSnapshot(lane:Lane){const metadata:any[]=[],values:number[]=[];scene.traverse(o=>{if(o===original.root||o===indexed.root||groupByMesh.has(o))return;metadata.push({id:o.id,parentId:o.parent?.id??null,name:o.name,visible:o.visible});values.push(...o.matrix.elements,...o.matrixWorld.elements);});metadata.push({id:camera.id,parentId:null,name:'proof-camera',visible:true});values.push(...camera.matrix.elements,...camera.matrixWorld.elements,...camera.projectionMatrix.elements);for(const g of groups[lane==='indexed'?'indexed':'original']){metadata.push({id:'street-group-'+g.ordinal,parentId:'active-palette',name:g.mesh.name,visible:g.mesh.visible});values.push(...g.mesh.matrix.elements,...g.mesh.matrixWorld.elements);}return{metadata,bytes:raw(new Float64Array(values))};}
 async function captureGpuBuffers(){
  for(const lane of ['original','indexed'] as const)for(const g of groups[lane]){
   const target=catalog.groups[g.ordinal][lane];for(const key of ['position','normal',...(lane==='indexed'?['index']:[])]){
    if(target.buffers[key])continue;const buffer=nativeBuffers.get(lane+'-'+g.ordinal+'-'+key);if(!buffer)continue;const attribute=(key==='index'?g.mesh.geometry.index:g.mesh.geometry.getAttribute(key)) as T.BufferAttribute;assert(attribute,'Audited native attribute absent');const bytes=new Uint8Array(attribute.array.byteLength),old=gl.getParameter(gl.COPY_READ_BUFFER_BINDING);try{gl.bindBuffer(gl.COPY_READ_BUFFER,buffer);assert(gl.getBufferParameter(gl.COPY_READ_BUFFER,gl.BUFFER_SIZE)===bytes.length,'Native buffer allocation size differs');gl.getBufferSubData(gl.COPY_READ_BUFFER,0,bytes);}finally{gl.bindBuffer(gl.COPY_READ_BUFFER,old);}assert(gl.getError()===gl.NO_ERROR,'GPU buffer readback error');assert(await hash(bytes)===await hash(raw(attribute.array)),'Native upload differs from constructed display data');const format=attribute.array instanceof Float32Array?'Float32':attribute.array instanceof Uint32Array?'Uint32':'Uint16',name=lane+'-group-'+g.ordinal+'-'+key;
    await binary(name,bytes,format);target.buffers[key]={nativeBuffer:id(buffer),receipt:name,bytes:bytes.length,sha256:await hash(bytes)};
   }
  }
 }
 async function capture(c:any,lane:Lane,label:string,hide:number|null=null){
  choose(lane,hide);await warm();const work=await renderOnce(true),pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);assert(gl.getError()===gl.NO_ERROR,'Frame readback failed');const name=c.name+'-'+label+'-'+lane,rgba=await binary(name+'-rgba',pixels,'RGBA8-bottom-up',{width,height,png:canvas.toDataURL('image/png')});
  const shadows=[];if(sun.castShadow){const target=sun.shadow.map;assert(target,'Shadow-on case has no actual target');const bytes=new Uint8Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,bytes);assert(gl.getError()===gl.NO_ERROR,'Shadow target readback failed');const receipt=await binary(name+'-shadow',bytes,'RGBA8-bottom-up',{width:target.width,height:target.height});shadows.push({lightId:sun.id,textureUuid:target.texture.uuid,width:target.width,height:target.height,receipt});}
  const matrix=matrixSnapshot(lane),matrices=await binary(name+'-matrices',matrix.bytes,'Float64');await captureGpuBuffers();
  const frame={case:c.name,lane,label,calls:work.calls,triangles:work.triangles,rgba,shadows,matrices,matrixMetadata:matrix.metadata,originalVisibility:sources.map(s=>({id:s.id,visible:s.visible})),draws:work.draws};
  // The main case omits a redundant label in its canonical frame filename.
  await json(c.name+(label==='main'?'':'-'+label)+'-'+lane+'-frame',frame);original.endView();indexed.endView();return{frame,pixels};
 }
 async function timings(c:any){
  const rows:any[]=[];
  for(const [ordinal,lane]of plan.timing.blocks.flat().entries()){
   choose(lane);const query=gl.createQuery();assert(query,'GPU query allocation failed');let row:any={case:c.name,ordinal,block:Math.floor(ordinal/4),position:ordinal%4,lane,status:'pending',disjointBefore:!!gl.getParameter(timer.GPU_DISJOINT_EXT)};
   try{gl.beginQuery(timer.TIME_ELAPSED_EXT,query);const began=performance.now();try{renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);}finally{row.cpuSubmitMs=performance.now()-began;gl.endQuery(timer.TIME_ELAPSED_EXT);}row.fenceWaitMs=await fence();const wait=performance.now();while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){guard();assert(performance.now()-wait<plan.bounds.queryMs,'GPU timer availability deadline');await new Promise(r=>setTimeout(r,8));}row.gpuNanoseconds=gl.getQueryParameter(query,gl.QUERY_RESULT);row.disjointAfter=!!gl.getParameter(timer.GPU_DISJOINT_EXT);row.status='available';assert(gl.getError()===gl.NO_ERROR,'GPU timed-render error');}
   catch(error){row.status='failed';row.error=String(error);throw error;}
   finally{gl.deleteQuery(query);rows.push(row);await json(c.name+'-timing-'+ordinal,row);original.endView();indexed.endView();}
  }
  await json(c.name+'-timings',rows);return rows;
 }
 try{
  assert(gl.drawingBufferWidth===width&&gl.drawingBufferHeight===height,'Actual drawing buffer differs from the frozen viewport');
  await json('start',{baseline:plan.baseline,candidate:plan.candidate.commit,candidateTree:plan.candidate.tree,threeRevision:T.REVISION,gpu,viewport:plan.viewport,actualContextAttributes:gl.getContextAttributes(),scope:plan.scope,caseNames:plan.cases.map((c:any)=>c.name),plan});
  const response=await fetch('/belle/street-details.json');assert(response.ok,'Street metadata missing');const sourcePlan=await response.json(),responseBin=await fetch('/belle/street-details.bin');assert(responseBin.ok,'Street binary missing');const bytes=await responseBin.arrayBuffer();assert(await hash(new Uint8Array(bytes))===plan.assets.binarySha256,'Original geometry asset SHA mismatch');const data=new Float32Array(bytes);assert(sourcePlan.stride===9,'Unexpected original stride');sourcePlan.boxes=[];for(let i=0;i<data.length;i+=sourcePlan.stride)sourcePlan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:sourcePlan.materials[data[i+7]],grade:data[i+8]});street=addStreetDetails(scene,sourcePlan);sourcePlan.boxes.length=0;await Promise.resolve();
  const initTexture=renderer.initTexture;renderer.initTexture=function(texture:T.Texture){const value=Reflect.apply(initTexture,this,[texture]);if(String((texture.image as any)?.currentSrc??(texture.image as any)?.src??'').includes('/belle/skins/'))textures.add(texture);return value;};try{await loadRealisticMaterials(renderer);}finally{renderer.initTexture=initTexture;}assert(textures.size===57,'All original texture objects must be warmed');
  applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);scene.updateMatrixWorld(true);sources=street.batchSources();tiles=scene.children.filter(o=>o instanceof T.Mesh&&o.name.startsWith('Street detail ')) as T.Mesh[];assert(tiles.length===429&&sources.length===355,'Original factory population differs');
  for(const mesh of tiles){sourceDisposals.set(mesh.geometry,0);mesh.geometry.addEventListener('dispose',()=>sourceDisposals.set(mesh.geometry,(sourceDisposals.get(mesh.geometry)??0)+1));}
  const sourceBefore=await sourceSnapshot();await json('source-before',sourceBefore);const raycastBefore=raycastSnapshot();await json('raycast-before',raycastBefore);
  const exact=new Set(sources);const constructorTimes:any={};let began=performance.now();original=new OriginalPalette(sources,exact,prepare('original'));constructorTimes.originalMs=performance.now()-began;
  const hooks=[...new Set(sources.map(s=>s.material as T.Material))].map(m=>({m,compile:m.onBeforeCompile,key:m.customProgramCacheKey,version:m.version}));
  // No await, scene-add or atmosphere flush may separate these constructors.
  began=performance.now();indexed=new IndexedPalette(sources,exact,prepare('indexed'),exact);constructorTimes.indexedMs=performance.now()-began;
  assert(hooks.every(h=>h.m.onBeforeCompile===h.compile&&h.m.customProgramCacheKey===h.key&&h.m.version===h.version),'Candidate construction changed shared material callback/key/version');
  assert(groups.original.length===7&&groups.indexed.length===7,'Both native paths must retain all seven groups');
  for(const palette of [original,indexed]){palette.root.traverse((o:T.Object3D)=>{if(o instanceof T.BatchedMesh)o.raycast=()=>{};});scene.add(palette.root);}await Promise.resolve();atmosphere.flush();scene.updateMatrixWorld(true);
  for(let i=0;i<7;i++){
   const a=groups.original[i],b=groups.indexed[i],expected=plan.groups[i];assert(a.mesh.material===b.mesh.material,'Shared original material identity lost');assert(a.sources.length===b.sources.length&&a.sources.every((source,index)=>source===b.sources[index]),'Source identity/order changed');same(a.sources.map(s=>s.name),expected.sourceNames,'Native group membership differs');assert(a.mesh.geometry.index===null&&b.mesh.geometry.index!==null,'Both actual native input paths required');assert((b.mesh.geometry.index!.array.constructor as any).name===expected.indexType,'Native aggregate index width differs');
   const side=(g:Group)=>({vertices:g.mesh.geometry.getAttribute('position').count,indices:g.mesh.geometry.index?.count??0,indexType:g.mesh.geometry.index?.array.constructor.name??null,policy:{sortObjects:g.mesh.sortObjects,perObjectFrustumCulled:g.mesh.perObjectFrustumCulled,castShadow:g.mesh.castShadow,receiveShadow:g.mesh.receiveShadow,layers:g.mesh.layers.mask,renderOrder:g.mesh.renderOrder},batchBounds:{box:g.mesh.boundingBox?words([...g.mesh.boundingBox.min.toArray(),...g.mesh.boundingBox.max.toArray()]):null,sphere:g.mesh.boundingSphere?words([...g.mesh.boundingSphere.center.toArray(),g.mesh.boundingSphere.radius]):null},ranges:g.sources.map((_,instance)=>{const geometryId=g.mesh.getGeometryIdAt(instance),range=g.mesh.getGeometryRangeAt(geometryId)!,box=g.mesh.getBoundingBoxAt(geometryId,new T.Box3()),sphere=g.mesh.getBoundingSphereAt(geometryId,new T.Sphere()),matrix=g.mesh.getMatrixAt(instance,new T.Matrix4());return{geometryId,...range,bounds:{box:words([...box.min.toArray(),...box.max.toArray()]),sphere:words([...sphere.center.toArray(),sphere.radius])},matrixWords:words(matrix.elements)};}),buffers:{}});
   const entry={ordinal:i,material:(a.mesh.material as any).id,key:(a.mesh.material as T.Material).customProgramCacheKey(),sources:await Promise.all(a.sources.map(async s=>({id:s.id,name:s.name,corners:s.geometry.getAttribute('position').count,positionSha256:await hash(raw(s.geometry.getAttribute('position').array)),normalSha256:await hash(raw(s.geometry.getAttribute('normal').array))}))),original:side(a),indexed:side(b)};assert(entry.key===expected.customProgramCacheKey,'Original decorated program key changed');catalog.groups.push(entry);
  }
  await json('construction',{constructorTimes,orderedOriginalSourceIds:sources.map(s=>s.id),sharedMaterialHooksUnchangedByCandidate:true,flushOrdering:'both constructors, then common scene-add and WorldAtmosphere.flush',comparison:'one startup construction observation per lane; not a balanced performance estimate'});
  await json('textures',[...textures].map(t=>({uuid:t.uuid,sourceUuid:t.source.uuid,imageIdentity:id(t.image),url:new URL((t.image as any).currentSrc||(t.image as any).src).pathname,format:t.format,internalFormat:t.internalFormat,type:t.type,colorSpace:t.colorSpace,wrapS:t.wrapS,wrapT:t.wrapT,minFilter:t.minFilter,magFilter:t.magFilter,anisotropy:t.anisotropy,generateMipmaps:t.generateMipmaps})));
  same(await sourceSnapshot(),sourceBefore,'Candidate allocation changed an original geometry/raycast identity');same(raycastSnapshot(),raycastBefore,'Candidate changed original raycasting');
  for(const c of plan.cases){
   guard();setCase(c);choose('original');await renderer.compileAsync(scene,camera);original.endView();choose('indexed');await renderer.compileAsync(scene,camera);indexed.endView();
   const frames=[];for(const lane of plan.lanes)frames.push(await capture(c,lane,'main'));
   const differences={candidate:changed(frames[0].pixels,frames[1].pixels),restored:changed(frames[0].pixels,frames[2].pixels)};
   const controls=[...plan.groupVisibilityControls.filter((x:any)=>x.case===c.name).map((x:any)=>({label:'group-'+x.group,group:x.group})),...(plan.shadowControl.case===c.name?[{label:'shadow',group:null}]:[])];
   const checks=[];for(const control of controls){
    if(control.label==='shadow')sun.castShadow=false;
    const a=await capture(c,'original',control.label,control.group),b=await capture(c,'indexed',control.label,control.group);
    if(control.label==='shadow')sun.castShadow=c.shadows;
    const r=await capture(c,'restored',control.label);checks.push({label:control.label,visiblePixels:changed(frames[0].pixels,a.pixels),candidateDifference:changed(a.pixels,b.pixels),restoredDifference:changed(frames[0].pixels,r.pixels)});
   }
   const measured=await timings(c),passed=differences.candidate===0&&differences.restored===0&&checks.every(x=>x.visiblePixels>0&&x.candidateDifference===0&&x.restoredDifference===0)&&measured.every(x=>!x.disjointBefore&&!x.disjointAfter);
   const row={case:c.name,passed,differences,controls:checks,timingQueries:measured.length};caseReceipts.push(row);await json(c.name+'-result',row);completed.push(c.name);
  }
  original.endView();indexed.endView();await json('source-after',await sourceSnapshot());await json('raycast-after',raycastSnapshot());
  assert(catalog.groups.every((g:any)=>['position','normal'].every(k=>g.original.buffers[k]&&g.indexed.buffers[k])&&g.indexed.buffers.index),'Some group never reached actual audited native buffer binding');
 }catch(error){errors.push(String(error));await json('browser-failure',{errors,completed});}
 finally{
  if(catalog.groups.length)await json('geometry-catalog',catalog);
  for(const p of programMap.values()){p.vertexSha256=await hash(p.vertex);p.fragmentSha256=await hash(p.fragment);await json('program-'+p.id,p);}
  try{original?.endView();indexed?.endView();for(const restore of restorers.reverse())restore();original?.dispose();indexed?.dispose();atmosphere.dispose();renderer.dispose();}catch(error){errors.push('Browser cleanup: '+String(error));}
 }
 const result={schema:'belle-street-index-browser-v1',baseline:plan.baseline,candidate:plan.candidate.commit,candidateTree:plan.candidate.tree,gpu,threeRevision:T.REVISION,completed,caseReceipts,errors,passed:errors.length===0&&completed.length===20&&caseReceipts.every(r=>r.passed),scope:plan.scope,shadowReadback:'RGBA8 color attachment of the actual shadow target; not native depth texture bytes',timingInterpretation:'GPU timer-query samples are separate from fenced pixel/buffer readbacks. Submission and fence-wall times are separate fields; no FPS or controls acceptance follows.'};await json('browser-result',result);return result;
};
