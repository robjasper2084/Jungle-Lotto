import * as T from 'three';
import * as candidate from '../src/belle/realisticMaterials.ts';
import {StaticPaletteBatch} from '../src/belle/staticPaletteBatch.ts';
// @ts-expect-error The isolated Vite driver supplies the exact e424 source.
import * as baselineImport from 'virtual:belle-surface-baseline';

const baseline:typeof candidate=baselineImport;
type Side='baseline'|'candidate';
type Output='screen-msaa4'|'target-samples0';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type NativeProgram={id:number;program:WebGLProgram;vertexShader:WebGLShader;fragmentShader:WebGLShader};
type BatchBinding={mesh:T.BatchedMesh;material:T.Material;planar:boolean};
type BatchProof={side:Side;materialId:number;programId:number;expectedPlanar:boolean;observedPlanar:boolean;matchesExpected:boolean;mode:string;skinProfile:number[];geometryId:number};
type BatchFixture={controller:StaticPaletteBatch;sources:T.Mesh[];bindings:BatchBinding[];proofs:BatchProof[];sourceGeometryBefore:Record<string,string>;begins:number;ends:number};
type Pair={id:string;roots:Record<Side,T.Group>;materials:Record<Side,T.Material[]>;pose?:(phase:number)=>void;batches?:Record<Side,BatchFixture>};
type Captured={name:string;side:Side;material:T.Material;shader:Shader};
const width=320,height=240;
const canvas=document.createElement('canvas');canvas.id='surface-fixture';document.body.append(canvas);
const label=document.createElement('p');document.body.prepend(label);
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=true;
const gl=renderer.getContext() as WebGL2RenderingContext;
const errors:string[]=[];
renderer.debug.onShaderError=(context,program,vertex,fragment)=>{
 errors.push([context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].join('\n'));
};
const scene=new T.Scene();scene.background=new T.Color('#293746');
const camera=new T.PerspectiveCamera(45,width/height,.05,80);
const ambient=new T.HemisphereLight(0xd6e8ff,0x584b39,2.1);
const sun=new T.DirectionalLight(0xffddb4,3.2);sun.position.set(4,6,3);
sun.castShadow=true;sun.shadow.mapSize.set(256,256);sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;
Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});sun.shadow.camera.updateProjectionMatrix();
scene.add(ambient,sun,sun.target);
const groundGeometry=new T.PlaneGeometry(12,12).rotateX(-Math.PI/2);
const groundMaterial=new T.MeshStandardMaterial({color:0x878b83,roughness:.9});
const ground=new T.Mesh(groundGeometry,groundMaterial);ground.receiveShadow=true;ground.position.y=-.11;scene.add(ground);
const target=new T.WebGLRenderTarget(width,height,{samples:0,type:T.UnsignedByteType,format:T.RGBAFormat,depthBuffer:true,stencilBuffer:false});
target.texture.colorSpace=T.SRGBColorSpace;
const pairs:Pair[]=[],captured:Captured[]=[],canonicalTextures=new Map<string,{texture:T.Texture;settings:string}>();
const allGeometry=new Set<T.BufferGeometry>([groundGeometry]);
const sourceMaterials=new Set<T.Material>(),sourceTextures=new Set<T.Texture>();
const controls:string[]=[];
const cohortPrograms:Record<Output,Record<Side,Set<number>>>= {
 'screen-msaa4':{baseline:new Set(),candidate:new Set()},
 'target-samples0':{baseline:new Set(),candidate:new Set()}
};
let immutableStart:Record<string,string>={},status='loading',aliasedTextureBindings=0,batchNegativeControl=false;

function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function bytesBase64(bytes:Uint8Array){let result='';for(let i=0;i<bytes.length;i+=32768)result+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(result);}
function pngFromPixels(bytes:Uint8Array){
 const imageCanvas=document.createElement('canvas');imageCanvas.width=width;imageCanvas.height=height;
 const ctx=imageCanvas.getContext('2d')!;const image=ctx.createImageData(width,height);
 for(let y=0;y<height;y++)image.data.set(bytes.subarray(y*width*4,(y+1)*width*4),(height-1-y)*width*4);
 ctx.putImageData(image,0,0);return imageCanvas.toDataURL('image/png').split(',')[1];
}
function textureSettings(texture:T.Texture){return JSON.stringify([texture.colorSpace,texture.type,texture.format,texture.wrapS,texture.wrapT,texture.minFilter,texture.magFilter,texture.anisotropy,texture.flipY,texture.channel]);}
function observe(material:T.Material,side:Side,name:string){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=function(shader,r){
  previous.call(this,shader,r);
  // Both modules load the real assets independently. Bind the identical immutable
  // texture objects after checking their source URL and sampling state agree.
  // A wrong texture/profile binding remains wrong; this does not remap surfaces.
  for(const field of ['skinColor','skinDetail']){
   const texture=shader.uniforms[field]?.value as T.Texture|undefined;if(!texture)continue;
   const image=texture.image as HTMLImageElement;const key=new URL(image.currentSrc||image.src,location.href).pathname;
   assert(key.startsWith('/belle/skins/'),'Unexpected surface texture '+key);
   const settings=textureSettings(texture),prior=canonicalTextures.get(key);
   if(prior){assert(prior.settings===settings,'Texture sampling state changed for '+key);shader.uniforms[field].value=prior.texture;aliasedTextureBindings++;}
   else canonicalTextures.set(key,{texture,settings});
  }
  captured.push({name,side,material,shader});
 };
}
function material(name:string,options:T.MeshStandardMaterialParameters={},authored=false){
 const value=new T.MeshStandardMaterial({color:0xb9a58b,roughness:.6,metalness:0,...options});value.name=name;
 if(authored){
  value.onBeforeCompile=shader=>{
   shader.uniforms.fixtureAuthoredGain={value:new T.Vector3(.93,1.03,.89)};
   shader.fragmentShader='uniform vec3 fixtureAuthoredGain;\n'+shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.rgb*=fixtureAuthoredGain;');
  };
  value.customProgramCacheKey=()=> 'fixture-authored-surface-v1';
 }
 sourceMaterials.add(value);return value;
}
function geometry(value:T.BufferGeometry){allGeometry.add(value);return value;}
const planar=geometry(new T.PlaneGeometry(1.8,1.8,8,8).rotateX(-Math.PI/2));
const box=geometry(new T.BoxGeometry(1.45,1.25,1.3,3,3,3));
function ordinary(g:T.BufferGeometry,m:T.Material){const mesh=new T.Mesh(g,m);mesh.position.y=.65;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function addPair(id:string,make:()=>T.Object3D,pose?:(roots:Record<Side,T.Group>,phase:number)=>void){
 const roots={} as Record<Side,T.Group>,materials={} as Record<Side,T.Material[]>;
 for(const side of ['baseline','candidate'] as const){
  const root=new T.Group();root.name=id+' '+side;root.add(make());
  (side==='baseline'?baseline:candidate).applyRealisticMaterials(root);
  const set=new Set<T.Material>();root.traverse(object=>{if(object instanceof T.Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])set.add(m);});
  // MeshStandardMaterial.clone does not preserve arbitrary defines. The real
  // wheel display installs this after surface dressing; match that ordering.
  if(id==='moving-original-coordinates')for(const m of set){
   const standard=m as T.MeshStandardMaterial;
   standard.defines={...standard.defines,BELLE_ORIGINAL_SURFACE_COORDS:1};standard.needsUpdate=true;
  }
  materials[side]=[...set];for(const m of set)observe(m,side,id);
  root.visible=false;scene.add(root);roots[side]=root;
 }
 const pair:Pair={id,roots,materials,pose:pose?phase=>pose(roots,phase):undefined};pairs.push(pair);return pair;
}
function checker(normal=false){
 const pixels=new Uint8Array(8*8*4);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const i=(y*8+x)*4,on=(x+y)%2===0;
  pixels.set(normal?[on?150:110,128,250,255]:[on?210:90,on?150:190,on?90:160,on?255:40],i);
 }
 const value=new T.DataTexture(pixels,8,8,T.RGBAFormat);value.colorSpace=normal?T.NoColorSpace:T.SRGBColorSpace;
 value.wrapS=value.wrapT=T.RepeatWrapping;value.repeat.set(2,2);value.needsUpdate=true;sourceTextures.add(value);return value;
}
function addStaticBatchPair(){
 const id='static-palette-projection-bindings',roots={} as Record<Side,T.Group>,materials={} as Record<Side,T.Material[]>,batches={} as Record<Side,BatchFixture>;
 const authored=material('fixture concrete batch source',{color:0xffffff});
 const format=(g:T.BufferGeometry)=>JSON.stringify([Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name]),g.index?.array.constructor.name]);
 assert(format(planar)===format(box),'Batch inputs must have identical attribute/index formats');
 const sourceGeometryBefore=fingerprint([planar,box]);
 for(const side of ['baseline','candidate'] as const){
  const root=new T.Group();root.name=id+' '+side;const sources:T.Mesh[]=[];
  for(let i=0;i<4;i++){
   const flat=i<2,mesh=ordinary(flat?planar:box,authored);
   mesh.name='fixture-batch-'+(flat?'planar-':'triplanar-')+i;
   mesh.position.set(i%2?1.1:-1.1,.65,i<2?-.95:.95);
   root.add(mesh);sources.push(mesh);
  }
  (side==='baseline'?baseline:candidate).applyRealisticMaterials(root);
  const controller=new StaticPaletteBatch(sources);
  assert(controller.stats.sourceDraws===4&&controller.stats.batches===2,side+' must produce 2 projection-safe batches from 4 compatible sources');
  assert(JSON.stringify(sourceGeometryBefore)===JSON.stringify(fingerprint([planar,box])),'Batch construction changed source geometry bytes');
  const batch:BatchFixture={controller,sources,bindings:[],proofs:[],sourceGeometryBefore,begins:0,ends:0};
  for(const child of controller.root.children){
   assert(child instanceof T.BatchedMesh,'Expected a real Three BatchedMesh');
   const m=child.material as T.Material,flat=child.name.includes('fixture-batch-planar-');
   batch.bindings.push({mesh:child,material:m,planar:flat});geometry(child.geometry);observe(m,side,id);
   child.onAfterRender=()=>{
    const p=properties(m).currentProgram;assert(p,'Batch draw did not select a linked program');
    const fragment=gl.getShaderSource(p.fragmentShader)??'';
    let observed:boolean,mode:string;
    if(side==='baseline'){
     assert(!/uniform\s+bool\s+skinPlanar/.test(fragment),'Baseline must retain its original compile-time projection');
     observed=!/vec3\s+skinWeights\s*\(/.test(fragment);mode='baseline-compiled-projection';
    }else{
     const location=gl.getUniformLocation(p.program,'skinPlanar');assert(location!==null,'Candidate batch skinPlanar is inactive');
     observed=Boolean(gl.getUniform(p.program,location));mode='candidate-native-uniform-after-draw';
    }
    const profileLocation=gl.getUniformLocation(p.program,'skinProfile');assert(profileLocation!==null,'Batch skinProfile is inactive');
    const profile=Array.from(gl.getUniform(p.program,profileLocation) as Float32Array);
    assert(profile.every((v,i)=>v===Math.fround([.6,.32,.008][i])),'Concrete profile changed in batch');
    batch.proofs.push({side,materialId:(m as T.Material&{id:number}).id,programId:p.id,expectedPlanar:flat,observedPlanar:observed,matchesExpected:observed===flat,mode,skinProfile:profile,geometryId:child.geometry.id});
   };
  }
  assert(batch.bindings.filter(b=>b.planar).length===1&&batch.bindings.filter(b=>!b.planar).length===1,'Must have one batch of each projection');
  if(side==='candidate'){
   assert(new Set(batch.bindings.map(b=>b.material.customProgramCacheKey())).size===1,'Candidate batches must share the shader key');
   assert(new Set(batch.bindings.map(b=>b.material.userData.realisticProfile)).size===2,'Candidate batch binding identities must stay distinct');
  }
  root.add(controller.root);root.visible=false;scene.add(root);roots[side]=root;materials[side]=batch.bindings.map(b=>b.material);batches[side]=batch;
 }
 pairs.push({id,roots,materials,batches});
}
function buildPairs(){
 const axisSources=[material('fixture concrete'),material('fixture rubber'),material('fixture concrete'),material('fixture rubber')];
 for(const [i,id] of ['axis-planar-pigment','axis-planar-zero','axis-triplanar-pigment','axis-triplanar-zero'].entries())
  addPair(id,()=>ordinary(i<2?planar:box,axisSources[i]));
 addPair('ordered-material-switches',()=>{
  const group=new T.Group(),order=[0,1,2,3,0,2];
  for(const [i,index] of order.entries()){
   const mesh=ordinary(index<2?planar:box,axisSources[index]);mesh.scale.setScalar(.52);
   mesh.position.set((i%3-1)*1.4,.5,(Math.floor(i/3)-.5)*1.5);mesh.renderOrder=i+1;group.add(mesh);
  }
  return group;
 });
 const authored=material('fixture brick authored',{color:0xadbdae},true);
 addPair('authored-shader-hook',()=>ordinary(box,authored));
 const albedo=checker(),normal=checker(true);
 const textured=material('fixture brick alpha mapped',{map:albedo,normalMap:normal,normalScale:new T.Vector2(.35,.28),alphaTest:.35,side:T.DoubleSide});
 addPair('maps-normal-alpha-shadow',()=>ordinary(box,textured));
 const texturedZero=material('fixture cloth alpha mapped',{map:albedo,normalMap:normal,normalScale:new T.Vector2(.2,.25),alphaTest:.35,side:T.DoubleSide});
 addPair('maps-normal-zero-pigment',()=>ordinary(planar,texturedZero));
 const instanceMaterial=material('fixture wood instanced');
 addPair('instanced-color-material',()=>{
  const mesh=new T.InstancedMesh(box,instanceMaterial,3),matrix=new T.Matrix4();
  for(let i=0;i<3;i++){matrix.compose(new T.Vector3((i-1)*1.45,.62,0),new T.Quaternion().setFromEuler(new T.Euler(0,i*.24,0)),new T.Vector3(.64,.9,.64));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new T.Color().setRGB(.7+i*.13,1-i*.08,.8));}
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();return mesh;
 });
 const original=geometry(new T.BoxGeometry(1.5,1.1,1.2,3,3,3));
 original.setAttribute('originalSurfacePosition',original.getAttribute('position').clone());
 original.setAttribute('originalSurfaceNormal',original.getAttribute('normal').clone());
 original.applyMatrix4(new T.Matrix4().makeRotationY(.53));
 assert(original.getAttribute('position').array.some((v,i)=>Math.abs(v-original.getAttribute('originalSurfacePosition').array[i])>1e-6),'Original surface positions must differ from transformed positions');
 const originalMaterial=material('fixture wood original coordinates');
 addPair('moving-original-coordinates',()=>ordinary(original,originalMaterial),(roots,phase)=>{for(const root of Object.values(roots)){root.rotation.y=phase*.3;root.rotation.z=phase*.12;}});
 const skinGeometry=geometry(new T.PlaneGeometry(1.8,2.1,12,12));
 const count=skinGeometry.getAttribute('position').count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){const t=T.MathUtils.clamp((skinGeometry.getAttribute('position').getY(i)+1.05)/2.1,0,1);indices[i*4+1]=1;weights[i*4]=1-t;weights[i*4+1]=t;}
 skinGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));skinGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
 const skinMaterial=material('fixture cloth skinned',{side:T.DoubleSide});
 addPair('skinned-cloth-motion',()=>{
  const mesh=new T.SkinnedMesh(skinGeometry,skinMaterial),base=new T.Bone(),tip=new T.Bone();base.name='fixture-base';tip.name='fixture-tip';tip.position.y=.8;base.add(tip);mesh.add(base);mesh.bind(new T.Skeleton([base,tip]));mesh.position.y=1.02;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
 },(roots,phase)=>{for(const root of Object.values(roots))root.getObjectByName('fixture-tip')!.rotation.z=.16+phase*.22;});
 addStaticBatchPair();
}
function fingerprint(geometries:Iterable<T.BufferGeometry>=allGeometry){
 const result:Record<string,string>={};
 for(const g of geometries){
  let hash=2166136261;
  for(const a of [...Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([,a])=>a),...(g.index?[g.index]:[])]){
   const array=a.array,bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
   for(const n of bytes)hash=Math.imul(hash^n,16777619);
  }
  result[String(g.id)]=(hash>>>0).toString(16);
 }
 return result;
}
function graphics(){
 renderer.setRenderTarget(null);const debug=gl.getExtension('WEBGL_debug_renderer_info');
 return {width,height,devicePixelRatio,contextAttributes:gl.getContextAttributes(),samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),vendor:String(gl.getParameter(debug?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),version:String(gl.getParameter(gl.VERSION)),threeRevision:T.REVISION};
}
function properties(material:T.Material){return renderer.properties.get(material) as {programs?:Map<string,NativeProgram>;currentProgram?:NativeProgram};}
function materialPrograms(materials:T.Material[]){return [...new Set(materials.flatMap(m=>[...(properties(m).programs?.values()??[])].map(p=>p.id)))].sort((a,b)=>a-b);}
function state(){
 const cohort=pairs.filter(p=>p.id.startsWith('axis-'));
 return {status,graphics:graphics(),cases:pairs.map(p=>p.id),errors:[...errors],controls:[...controls],aliasedTextureBindings,
  immutableGeometry:JSON.stringify(immutableStart)===JSON.stringify(fingerprint()),
  batching:pairs.filter(p=>p.batches).map(p=>({case:p.id,sides:Object.fromEntries((['baseline','candidate'] as const).map(side=>{
   const b=p.batches![side];return [side,{sourceDraws:b.controller.stats.sourceDraws,batches:b.controller.stats.batches,begins:b.begins,ends:b.ends,sourceGeometryBefore:b.sourceGeometryBefore,sourceGeometryUnchanged:JSON.stringify(b.sourceGeometryBefore)===JSON.stringify(fingerprint(new Set(b.sources.map(m=>m.geometry)))),sourceVisibility:b.sources.map(m=>m.visible),batchRootVisible:b.controller.root.visible,bindings:b.bindings.map(v=>({planar:v.planar,profile:v.material.userData.realisticProfile,shaderKey:v.material.customProgramCacheKey(),geometryId:v.mesh.geometry.id}))}];
  }))})),
  programCounts:{rendererLive:renderer.info.programs?.length??0,
   cohort:Object.fromEntries((['baseline','candidate'] as const).map(side=>[side,materialPrograms(cohort.flatMap(p=>p.materials[side]))])),
   cohortByOutput:Object.fromEntries(Object.entries(cohortPrograms).map(([output,sides])=>[output,Object.fromEntries(Object.entries(sides).map(([side,programs])=>[side,[...programs].sort((a,b)=>a-b)]))])),
   all:Object.fromEntries((['baseline','candidate'] as const).map(side=>[side,materialPrograms(pairs.flatMap(p=>p.materials[side]))]))},
  materialKeys:pairs.map(p=>({case:p.id,baseline:p.materials.baseline.map(m=>m.customProgramCacheKey()),candidate:p.materials.candidate.map(m=>m.customProgramCacheKey())}))};
}
function select(id:string,side:Side,view:number){
 const pair=pairs.find(p=>p.id===id);assert(pair,'Unknown fixture case '+id);
 for(const p of pairs)for(const root of Object.values(p.roots))root.visible=false;
 pair.roots[side].visible=true;pair.pose?.(view);
 camera.fov=view===0?45:50;camera.position.set(...(view===0?[3.2,3.0,4.3]:[5.8,1.4,5.1]) as [number,number,number]);camera.lookAt(0,.6,0);camera.updateProjectionMatrix();
 scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);return pair;
}
function projectedSubjectBounds(root:T.Object3D){
 const bounds=new T.Box3().setFromObject(root,true);if(bounds.isEmpty())return null;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const p=new T.Vector3(x,y,z).project(camera),px=(p.x+1)*width/2,py=(p.y+1)*height/2;
  minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
 }
 return {minX:Math.max(0,Math.floor(minX)),minY:Math.max(0,Math.floor(minY)),maxX:Math.min(width-1,Math.ceil(maxX)),maxY:Math.min(height-1,Math.ceil(maxY))};
}
function drawAndRead(output:Output){
 let renderError:string|null=null;renderer.shadowMap.needsUpdate=true;
 try{renderer.render(scene,camera);}catch(error){renderError=String((error as Error)?.stack??error);}
 const pixels=new Uint8Array(width*height*4);
 if(output==='screen-msaa4')gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 else renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
 // Return captured bytes even if a GL, shader, or render check failed. The
 // driver writes every image and its diagnostics before accepting/rejecting it.
 return {rgba:bytesBase64(pixels),png:pngFromPixels(pixels),samples:gl.getParameter(gl.SAMPLES) as number,glError:gl.getError(),contextLost:gl.isContextLost(),shaderErrors:[...errors],renderError};
}
function render(id:string,side:Side,view:number,output:Output){
 assert(status==='ready','Fixture is not ready');const pair=select(id,side,view);
 const batch=pair.batches?.[side],visibility=batch?.sources.map(m=>m.visible);
 const integrityErrors:string[]=[],check=(value:unknown,message:string)=>{if(!value)integrityErrors.push(message);};
 const batchingLifecycle=batch?{before:visibility!,during:[] as boolean[],after:[] as boolean[],restored:false}:undefined;
 if(batch){
  assert(!batch.controller.root.visible,'Previous batch view was not closed');batch.proofs.length=0;
  batch.controller.beginView();batch.begins++;batchingLifecycle!.during=batch.sources.map(m=>m.visible);
  assert(batch.controller.root.visible&&batchingLifecycle!.during.every(v=>!v),'Batch view did not replace all 4 source meshes');
 }
 try{
 label.textContent=[id,side,'view'+view,output].join(' · ');
 renderer.setRenderTarget(output==='screen-msaa4'?null:target);renderer.setViewport(0,0,width,height);renderer.setScissorTest(false);
 const subject=pair.roots[side],subjectBounds=projectedSubjectBounds(subject),actual=drawAndRead(output);
 const batchProof=batch?[...batch.proofs]:undefined;
 if(id.startsWith('axis-'))for(const m of pair.materials[side]){
  const program=properties(m).currentProgram;check(program,'No current linked program for '+id);
  if(program)cohortPrograms[output][side].add(program.id);
 }
 check(captured.some(c=>c.name===id&&c.side===side&&c.shader.uniforms.skinProfile),'Surface shader was not exercised: '+id+' '+side);
 if(id==='authored-shader-hook')check(captured.some(c=>c.name===id&&c.side===side&&c.shader.uniforms.fixtureAuthoredGain),'Authored hook was not chained');
 const originalCoordinateProof=id==='moving-original-coordinates'?pair.materials[side].map(m=>{
  const p=properties(m).currentProgram;check(p,'Original-coordinate material has no linked program');if(!p)return {side,missingProgram:true};
  const source=gl.getShaderSource(p.vertexShader)??'';
  const defined=/^\s*#define\s+BELLE_ORIGINAL_SURFACE_COORDS\s+1\b/m.test(source);
  const positionLocation=gl.getAttribLocation(p.program,'originalSurfacePosition'),normalLocation=gl.getAttribLocation(p.program,'originalSurfaceNormal');
  check(defined&&positionLocation>=0&&normalLocation>=0,'Original-coordinate shader branch/active attributes missing for '+side);
  return {side,materialId:(m as T.Material&{id:number}).id,programId:p.id,defined,positionLocation,normalLocation,sourceAssignsOriginalPosition:source.includes('skinPosition=originalSurfacePosition;skinNormal=originalSurfaceNormal;')};
 }):undefined;
 if(batch){
  check(batchProof!.length===2,'Both real batches must draw once in the color pass');
  if(!batchNegativeControl)check(batchProof!.every(p=>p.matchesExpected),'Projection binding changed across native batch draws');
  check(new Set(batchProof!.map(p=>p.programId)).size===(side==='baseline'?2:1),'Unexpected native batch program sharing');
 }
 // A flat valid material can have very few 8-bit colors. Prove that this exact
 // subject affects the framebuffer by hiding only its root, then restoring it.
 // Camera, lighting, geometry, material uniforms and output stay unchanged.
 if(batch)batch.proofs.length=0;subject.visible=false;
 const hidden=drawAndRead(output),hiddenBatchProof=batch?[...batch.proofs]:undefined;
 subject.visible=true;if(batch)batch.proofs.length=0;
 const restored=drawAndRead(output),restoredBatchProof=batch?[...batch.proofs]:undefined;
 if(batch){
  check(hiddenBatchProof!.length===0,'Hidden batch subject unexpectedly drew');
  check(restoredBatchProof!.length===2,'Restored batch subject must draw both batches');
  check(JSON.stringify(batchProof)===JSON.stringify(restoredBatchProof),'Batch bindings/programs changed after visibility restoration');
 }
 return {id,side,view,output,width,height,...actual,integrityErrors,programIds:materialPrograms(pair.materials[side]),rendererPrograms:renderer.info.programs?.length??0,originalCoordinateProof,batchingLifecycle,batchProof,
  visibilityProof:{subjectBounds,onlySubjectVisibilityChanged:true,hidden,restored,hiddenBatchProof,restoredBatchProof}};
 }finally{
  pair.roots[side].visible=true;
  if(batch){batch.controller.endView();batch.ends++;batchingLifecycle!.after=batch.sources.map(m=>m.visible);
   batchingLifecycle!.restored=!batch.controller.root.visible&&batchingLifecycle!.after.every((v,i)=>v===visibility![i]);
   check(batchingLifecycle!.restored,'Batch endView did not restore source visibility');}
 }
}
function setNegativeControl(enabled:boolean){
 const rows=captured.filter(c=>c.name==='axis-triplanar-pigment'&&c.side==='candidate');assert(rows.length>0,'Control material has not compiled');
 for(const row of rows){const uniform=row.shader.uniforms.skinPlanar;assert(uniform&&typeof uniform.value==='boolean','Candidate skinPlanar bool missing');uniform.value=enabled;}
 if(enabled)controls.push('Changed candidate axis-triplanar-pigment skinPlanar from false to true');
}
function setBatchNegativeControl(enabled:boolean){
 const batch=pairs.find(p=>p.id==='static-palette-projection-bindings')!.batches!.candidate;
 const material=batch.bindings.find(b=>!b.planar)!.material;
 const rows=captured.filter(c=>c.side==='candidate'&&c.material===material);assert(rows.length>0,'Triplanar batch has not compiled');
 for(const row of rows){const uniform=row.shader.uniforms.skinPlanar;assert(uniform&&typeof uniform.value==='boolean','Batch skinPlanar missing');uniform.value=enabled;}
 batchNegativeControl=enabled;if(enabled)controls.push('Changed the candidate triplanar batch to the planar binding while keeping actual geometry and grouping');
}
function programEvidence(){
 const programs=(renderer.info.programs??[]) as unknown as NativeProgram[];
 return {state:state(),programs:programs.map(p=>({id:p.id,linked:gl.getProgramParameter(p.program,gl.LINK_STATUS),
  vertexSource:gl.getShaderSource(p.vertexShader),fragmentSource:gl.getShaderSource(p.fragmentShader),
  owners:pairs.flatMap(pair=>(['baseline','candidate'] as const).flatMap(side=>pair.materials[side].filter(m=>materialPrograms([m]).includes(p.id)).map(m=>({case:pair.id,side,materialId:(m as T.Material&{id:number}).id,name:m.name,key:m.customProgramCacheKey()}))))}))};
}
const ready=(async()=>{
 const info=graphics();assert(/Metal/i.test(info.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(info.renderer),'Native Metal required: '+info.renderer);
 assert(info.contextAttributes?.antialias&&info.samples===4,'Actual default-framebuffer4xMSAA required');assert(info.devicePixelRatio===1,'Fixture requires DPR1');
 await baseline.loadRealisticMaterials(renderer);await candidate.loadRealisticMaterials(renderer);
 buildPairs();immutableStart=fingerprint();status='ready';return state();
})().catch(error=>{status='failed';errors.push(String(error?.stack??error));throw error;});
// Explicit calls keep capture/diagnostics outside all performance workflows.
Object.assign(window,{__surfaceProgramFixture:{ready,render,state,programEvidence,setNegativeControl,setBatchNegativeControl}});
