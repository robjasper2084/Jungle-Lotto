/** Targeted real-material proof, not a full-game release or performance test.
 * Baseline modules are read independently from the pinned Git tree by the driver.
 * Display meshes and geometry never change between a paired material render. */
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {finishParkLawn} from '../src/belle/parkLawn.ts';
import {CinematicTerrain} from '../src/belle/cinematicTerrain.ts';
import {finishAsphalt} from '../src/belle/surfaceFinish.ts';
import {finishMacArthurConcrete} from '../src/belle/macArthurSurface.ts';
import {finishMacArthurRailings} from '../src/belle/macArthurRailFinish.ts';
import {installMacArthurBumpCenterReuse,MACARTHUR_BUMP_CENTER_ASSIGNMENT,MACARTHUR_BUMP_CENTER_READ} from '../src/belle/macArthurBumpCenterReuse.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {ART_DIRECTIONS,ART_STYLE_IDS,ART_ROAD_WETNESS,type ArtStyleId} from '../src/belle/artDirection.ts';
import {addShoreDetails} from '../src/belle/shore.ts';
import {districts} from '../src/belle/detroitGround.ts';
import {addPavement} from '../src/belle/pavement.ts';
import {RoadContactSurface} from '../src/belle/roadContactSurface.ts';
import {ParkTerrain,type ParkMap,type Point} from '../src/belle/terrain.ts';
import {cullMacArthurSpans} from '../src/belle/macArthurSpanCulling.ts';
import {directionalShadowResolution,islandRenderOrder} from '../src/belle/worldPerformancePolicy.ts';
// These virtual modules are independently compiled from the immutable baseline.
// @ts-ignore -- resolved by the proof driver's pinned-source plugin.
import {finishParkLawn as originalLawn,poly} from 'baseline:world-materials';
// @ts-ignore -- exact pinned function extraction, not a test approximation.
import {cloudTexture} from 'fixture:cloud-texture';
// @ts-ignore -- resolved by the proof driver.
import {CinematicTerrain as OriginalTerrain} from 'baseline:cinematicTerrain.ts';
// @ts-ignore -- resolved by the proof driver.
import {finishAsphalt as originalAsphalt} from 'baseline:surfaceFinish.ts';
// @ts-ignore -- resolved by the proof driver.
import {finishMacArthurConcrete as originalMasonry} from 'baseline:macArthurSurface.ts';
// @ts-ignore -- resolved by the proof driver.
import {finishMacArthurRailings as originalRails} from 'baseline:macArthurRailFinish.ts';
// @ts-ignore -- resolved by the proof driver.
import {loadRealisticMaterials as loadOriginalMaterials,applyRealisticMaterials as originalMaterials} from 'baseline:realisticMaterials.ts';
// @ts-ignore -- resolved by the proof driver.
import {applyPhotoReferenceSurfaces as originalPhoto} from 'baseline:photoReferenceSurfaces.ts';
// @ts-ignore -- resolved by the proof driver.
import {dressSunsetGround as originalSunset} from 'baseline:sunsetGround.ts';
// @ts-ignore -- resolved by the proof driver.
import {WorldAtmosphere as OriginalAtmosphere} from 'baseline:worldAtmosphere.ts';
// @ts-ignore -- the baseline has its own live wetness uniform object.
import {ART_ROAD_WETNESS as originalWetness} from 'baseline:artDirection.ts';

type Side='baseline'|'default'|'candidate';
type Subject='lawn'|'asphalt'|'masonry';
type View='near'|'mid'|'grazing';
type Shader=Parameters<T.Material['onBeforeCompile']>[0];
type Owner={materials:(T.Material|T.Material[])[];atmosphere:WorldAtmosphere;scene:T.Scene;terrain:CinematicTerrain;masonryStats:{meshes:number;newMaterials:number}|null;bumpCenterMaterials:Set<T.Material>};
type Sample={rgba:Uint8Array;shadow:Uint8Array;png:string;calls:number;triangles:number;order:string[];cpuMs:number;fenceMs:number;gpu:{status:string;nanoseconds:number|null};};
type Fixture={name:Subject;root:T.Group;meshes:T.Mesh[];owners:Record<Side,Owner>;control:(T.Material|T.Material[])[];mask:(T.Material|T.Material[])[];bumpCenterWrong:(T.Material|T.Material[])[];focus:T.Vector3;normal:T.Vector3;geometry:unknown[];};

function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
const query=new URLSearchParams(location.search),width=Number(query.get('width')||960),height=Number(query.get('height')||600);
assert(Number.isInteger(width)&&width>=320&&width<=1920&&Number.isInteger(height)&&height>=240&&height<=1200,'Invalid proof dimensions');
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const gl=renderer.getContext() as WebGL2RenderingContext;
assert(typeof gl.fenceSync==='function','WebGL2 completion fences are required');
const debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,width/height,.05,12000);
scene.fog=new T.FogExp2(0xb8c4c9,.00007);
const ambient=new T.HemisphereLight(0xd5e8f8,0x63513a,1.3),sun=new T.DirectionalLight(0xffdfb0,2.1);
sun.castShadow=true;sun.shadow.mapSize.setScalar(directionalShadowResolution('high',/SwiftShader/i.test(gpu)));
sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;
Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:.1,far:450});
scene.add(ambient,sun,sun.target);
// The one fixture caster verifies that each real subject can receive a shadow.
// It is identical across paired renders and omitted from derivative masks.
const caster=new T.Mesh(new T.BoxGeometry(1.8,1.8,1.8),new T.MeshStandardMaterial({color:0x8f8070,roughness:.8}));
caster.castShadow=true;scene.add(caster);
const shaders=new Map<T.Material,Shader>(),shaderSources=new Map<T.Material,{vertex:string;fragment:string}>();
const submittedMaterials=new Set<T.Material>();
const drawOrder:string[]=[];
const images:{name:string;png:string}[]=[],rows:Record<string,unknown>[]=[],timings:Record<string,unknown>[]=[],controls:Record<string,unknown>[]=[],errors:string[]=[];
const resources:{path:string;sha256:string;bytes:number}[]=[];
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
const textHash=(value:string)=>hash(new TextEncoder().encode(value));
function meshList(root:T.Object3D){const values:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh)values.push(o);});return values;}
function changed(a:Uint8Array,b:Uint8Array){assert(a.length===b.length,'Capture sizes changed');let pixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let different=false;for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);maxChannelDelta=Math.max(maxChannelDelta,d);different ||= d!==0;}if(different)pixels++;}return{pixels,maxChannelDelta};}
function png(bytes:Uint8Array,w=width,h=height){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d')!,p=ctx.createImageData(w,h);for(let y=0;y<h;y++)p.data.set(bytes.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);ctx.putImageData(p,0,0);return c.toDataURL('image/png');}
function differencePng(a:Uint8Array,b:Uint8Array){const bytes=new Uint8Array(a.length);for(let i=0;i<bytes.length;i+=4){const d=Math.max(...[0,1,2,3].map(c=>Math.abs(a[i+c]-b[i+c])));bytes.set(d?[255,Math.min(255,d*12),0,255]:[0,0,0,255],i);}return png(bytes);}
async function asset(path:string){const response=await fetch(path);assert(response.ok,'Required asset unavailable: '+path);const bytes=new Uint8Array(await response.arrayBuffer());resources.push({path,sha256:await hash(bytes),bytes:bytes.length});return bytes;}
async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);assert(sync,'GPU completion fence unavailable');gl.flush();const start=performance.now();try{for(;;){const state=gl.clientWaitSync(sync,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return performance.now()-start;assert(state!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU completion failed');assert(performance.now()-start<60000,'GPU completion exceeded 60 seconds');await new Promise(resolve=>setTimeout(resolve,8));}}finally{gl.deleteSync(sync);}}
function observe(material:T.Material){if(shaders.has(material))return;const old=material.onBeforeCompile;material.onBeforeCompile=function(shader,r){old.call(this,shader,r);shaders.set(this,shader);shaderSources.set(this,{vertex:shader.vertexShader,fragment:shader.fragmentShader});};}
function cloneMaterial(material:T.Material,cache=new Map<T.Material,T.Material>()){let result=cache.get(material);if(!result){result=material.clone();result.onBeforeCompile=material.onBeforeCompile;result.onBeforeRender=material.onBeforeRender;result.customProgramCacheKey=material.customProgramCacheKey;cache.set(material,result);}return result;}
const factors:Record<Subject,string>={lawn:'belleLawnResolved',asphalt:'repairResolved',masonry:'belleBridgeAA'};
const grassWithdrawal={status:'withdrawn',candidateEnabled:false,proofPurpose:'Original lawn regression only; candidate slot uses original terrain and lawn shaders.'} as const;
async function originalLawnEquivalence(){
 const original=new T.MeshStandardMaterial(),current=new T.MeshStandardMaterial();
 try{
  originalLawn(original);finishParkLawn(current);
  const originalCallback=original.onBeforeCompile.toString(),currentCallback=current.onBeforeCompile.toString();
  const originalKey=original.customProgramCacheKey(),currentKey=current.customProgramCacheKey();
  const shader=()=>({uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader} as Shader);
  const originalShader=shader(),currentShader=shader();
  original.onBeforeCompile(originalShader,renderer);current.onBeforeCompile(currentShader,renderer);
  const callbackEqual=originalCallback===currentCallback,cacheKeyEqual=originalKey===currentKey,vertexShaderEqual=originalShader.vertexShader===currentShader.vertexShader,fragmentShaderEqual=originalShader.fragmentShader===currentShader.fragmentShader;
  const receipt=async(callback:string,key:string,source:Shader)=>({callbackSha256:await textHash(callback),cacheKeySha256:await textHash(key),vertexShaderSha256:await textHash(source.vertexShader),fragmentShaderSha256:await textHash(source.fragmentShader)});
  return {callbackEqual,cacheKeyEqual,vertexShaderEqual,fragmentShaderEqual,original:await receipt(originalCallback,originalKey,originalShader),current:await receipt(currentCallback,currentKey,currentShader),passed:callbackEqual&&cacheKeyEqual&&vertexShaderEqual&&fragmentShaderEqual};
 }finally{original.dispose();current.dispose();}
}
function diagnosticMaterial(material:T.Material,subject:Subject,mode:'disabled'|'mask'){
 const m=cloneMaterial(material),old=m.onBeforeCompile,key=m.customProgramCacheKey();
 m.onBeforeCompile=(shader,r)=>{
  old.call(m,shader,r);const factor=factors[subject],decl=new RegExp('float '+factor+'=[^;]+;');
  if(!decl.test(shader.fragmentShader)){
   if(mode==='mask')shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor=vec4(0.,0.,1.,1.);');
   return;
  }
  if(mode==='disabled')shader.fragmentShader=shader.fragmentShader.replace(decl,'float '+factor+'=0.;');
  else{
   shader.fragmentShader=shader.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/,'void main(){\nfloat surfaceProofFilter=0.;');
   shader.fragmentShader=shader.fragmentShader.replace(decl,match=>match+'surfaceProofFilter='+factor+';');
   shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor=surfaceProofFilter>0.?vec4(0.,1.,0.,1.):vec4(1.,0.,0.,1.);');
  }
 };
 m.customProgramCacheKey=()=>key+'|fixture-only-'+mode+'-'+subject;m.needsUpdate=true;return m;
}
function variants(materials:(T.Material|T.Material[])[],subject:Subject,mode:'disabled'|'mask'){
 const cache=new Map<T.Material,T.Material>();const one=(m:T.Material)=>{if(!cache.has(m))cache.set(m,diagnosticMaterial(m,subject,mode));return cache.get(m)!;};
 return materials.map(m=>Array.isArray(m)?m.map(one):one(m));
}
function wrongBumpCenterVariants(materials:(T.Material|T.Material[])[],eligible:ReadonlySet<T.Material>){
 const cache=new Map<T.Material,T.Material>();
 const one=(material:T.Material)=>{
  if(!eligible.has(material))return material;
  let m=cache.get(material);if(m)return m;
  m=cloneMaterial(material);const target=m,old=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=(shader,r)=>{
   old.call(target,shader,r);
   assert(shader.fragmentShader.split(MACARTHUR_BUMP_CENTER_ASSIGNMENT).length===2&&shader.fragmentShader.includes(MACARTHUR_BUMP_CENTER_READ),'Bump center positive control did not find exactly one installed cache assignment and its read');
   // Alter only the reused bump-center sample. The diffuse map sample, offset
   // bump fetches, grain, geometry and all actual texture objects are retained.
   shader.fragmentShader=shader.fragmentShader.replace(MACARTHUR_BUMP_CENTER_ASSIGNMENT,'belleMacArthurMapCenterRed = 0.0;');
  };
  m.customProgramCacheKey=()=>key+'|fixture-only-wrong-bump-center';m.needsUpdate=true;cache.set(material,m);return m;
 };
 return materials.map(m=>Array.isArray(m)?m.map(one):one(m));
}
async function prepare(root:T.Group,subject:Subject,side:Side,noise:T.Texture):Promise<Owner>{
 const prep=new T.Scene(),copy=root.clone(true),cache=new Map<T.Material,T.Material>();
 for(const mesh of meshList(copy)){
  const multiple=Array.isArray(mesh.material),list=multiple?mesh.material as T.Material[]:[mesh.material as T.Material];
  const clones=list.map(m=>cloneMaterial(m,cache));mesh.material=multiple?clones:clones[0];
 }
 const originals=new Set(meshList(copy).flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]));
 for(const m of originals){
  if(!(m instanceof T.MeshStandardMaterial))continue;
  if(m.name==='Park lawn')(side==='baseline'?originalLawn:finishParkLawn)(m);
  if(m.name==='Island asphalt'){if(side==='baseline')originalAsphalt(m);else finishAsphalt(m,{skipInvisiblePatches:side==='candidate'});}
 }
 let masonryStats:Owner['masonryStats']=null;
 if(subject==='masonry'){
  if(side==='baseline'){masonryStats=originalMasonry(copy);originalRails(copy);}else{masonryStats=finishMacArthurConcrete(copy,{skipInvisibleGrain:side==='candidate'});finishMacArthurRailings(copy);}
  assert(masonryStats&&masonryStats.meshes>0&&masonryStats.newMaterials>0,'The actual '+side+' masonry decorator did no work');
  for(const mesh of meshList(copy))for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m instanceof T.MeshStandardMaterial&&m.map&&/limestone/i.test(m.name)){m.bumpMap=m.map;m.bumpScale=.018;m.roughness=.88;}
 }
 const terrain=side==='baseline'?new OriginalTerrain(prep):new CinematicTerrain(prep);
 const atmosphere:WorldAtmosphere=side==='baseline'?new OriginalAtmosphere(prep,noise):new WorldAtmosphere(prep,noise);
 prep.add(copy);await Promise.resolve();
 (side==='baseline'?originalMaterials:applyRealisticMaterials)(prep);
 (side==='baseline'?originalPhoto:applyPhotoReferenceSurfaces)(prep);
 (side==='baseline'?originalSunset:dressSunsetGround)(prep);
 await Promise.resolve();
 const materials=meshList(copy).map(mesh=>mesh.material);
 const bumpCenterMaterials=new Set<T.Material>();
 if(subject==='masonry'&&side==='candidate'){
  for(const material of new Set(materials.flat()))if(installMacArthurBumpCenterReuse(material,{enabled:true}))bumpCenterMaterials.add(material);
  assert(bumpCenterMaterials.size>0,'No final actual MacArthur masonry material was eligible for bump-center reuse');
 }
 for(const m of new Set(materials.flat()))observe(m);
 return {materials,atmosphere,scene:prep,terrain,masonryStats,bumpCenterMaterials};
}
async function geometryReceipt(mesh:T.Mesh){
 const g=mesh.geometry,attrs:Record<string,unknown>={};
 for(const [name,a] of Object.entries(g.attributes))attrs[name]={itemSize:a.itemSize,count:a.count,normalized:a.normalized,interleaved:'isInterleavedBufferAttribute' in a,sha256:await hash(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))};
 return {name:mesh.name,matrix:mesh.matrix.toArray(),attributes:attrs,index:g.index?{count:g.index.count,sha256:await hash(new Uint8Array(g.index.array.buffer,g.index.array.byteOffset,g.index.array.byteLength))}:null,groups:g.groups.map(x=>({...x})),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder};
}
async function buildFixtures(){
 const [mapBytes,landBytes,glbBytes]=await Promise.all([asset('/belle/map.json'),asset('/belle/beach-land.json'),asset('/belle/landmarks.glb')]);
 const map=JSON.parse(new TextDecoder().decode(mapBytes)) as ParkMap,dry=JSON.parse(new TextDecoder().decode(landBytes)) as Point[][][],terrain=new ParkTerrain(map,true);
 // Real material maps, including their original sampler/filter settings.
 await Promise.all([loadRealisticMaterials(renderer),loadOriginalMaterials(renderer)]);
 const grass=new T.MeshStandardMaterial({name:'Park lawn',color:0x8f9b7e,roughness:.8});
 const lawn=new T.Group();lawn.name='Original mainland, island and graded approaches';
 for(const rings of dry){const mesh=new T.Mesh(poly(rings[0],2,rings.slice(1)),grass);mesh.name='Original island dry land';mesh.receiveShadow=true;mesh.renderOrder=islandRenderOrder.ground;lawn.add(mesh);}
 for(const [outline,...holes] of districts.flat){const mesh=new T.Mesh(poly(outline,2,holes),grass);mesh.name='Detroit mainland';mesh.receiveShadow=true;lawn.add(mesh);}
 const shore=new T.Scene();addShoreDetails(shore,map,terrain,grass,new T.MeshStandardMaterial({color:0xbebdb2,roughness:.8}));
 const ramps=meshList(shore).filter(m=>m.name==='Graded bridge approach');assert(ramps.length===2,'Both original graded bridge approaches are required');
 for(const mesh of ramps)lawn.add(mesh);
 const asphaltRoot=new T.Scene(),asphalt=new T.MeshStandardMaterial({name:'Island asphalt',color:0x979b99,roughness:.8});
 const contact=new RoadContactSurface();await addPavement(asphaltRoot,{asphalt,concrete:asphalt,gravel:asphalt,wood:asphalt,pavers:asphalt},contact);
 const pavement=new T.Group(),road=meshList(asphaltRoot).find(m=>m.name==='Joined island pavement · asphalt');assert(road,'Shipped joined asphalt missing');pavement.add(road);
 const model=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glbBytes.buffer,'/belle/');model.scene.updateMatrixWorld(true);
 const masonry=new T.Group(),bridgeMeshes=meshList(model.scene).filter(m=>/^MacArthur[ _]/.test(m.name));assert(bridgeMeshes.length>0,'Actual MacArthur landmark geometry missing');
 for(const mesh of bridgeMeshes){const world=mesh.matrixWorld.clone();masonry.add(mesh);world.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.castShadow=true;mesh.receiveShadow=true;mesh.geometry.computeBoundingSphere();}
 masonry.updateMatrixWorld(true);cullMacArthurSpans(masonry);
 const warm=bridgeMeshes.find(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).some(m=>/warm limestone/i.test(m.name)));assert(warm,'Actual warm masonry material missing');
 const b=map.bridge,ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;
 const lawnXZ=[b.a[0]-ux*65+uz*24,b.a[1]-uz*65-ux*24];
 const lawnFocus=new T.Vector3(lawnXZ[0],terrain.height(...lawnXZ as [number,number])+.006,lawnXZ[1]);
 const roadPosition=road.geometry.getAttribute('position'),index=road.geometry.index!;
 let roadFocus=new T.Vector3(),score=Infinity;
 for(let i=0;i<index.count;i+=3){const p=new T.Vector3();for(let k=0;k<3;k++)p.add(new T.Vector3().fromBufferAttribute(roadPosition,index.getX(i+k)));p.multiplyScalar(1/3);const d=(p.x-800)**2+(p.z-500)**2;if(d<score){score=d;roadFocus=p;}}
 // Aim at an actual upward-facing limestone triangle near the first third of
 // the bridge. This exposes its grain and provides an actual shadow receiver.
 const positions=warm.geometry.getAttribute('position'),indices=warm.geometry.index!;
 const target=new T.Vector3(b.a[0]+ux*b.length*.35,8,b.a[1]+uz*b.length*.35);let bridgeFocus=new T.Vector3(),bridgeNormal=new T.Vector3(0,1,0);score=Infinity;
 for(let i=0;i<indices.count;i+=3){const a=new T.Vector3().fromBufferAttribute(positions,indices.getX(i)),bb=new T.Vector3().fromBufferAttribute(positions,indices.getX(i+1)),c=new T.Vector3().fromBufferAttribute(positions,indices.getX(i+2));const normal=bb.clone().sub(a).cross(c.clone().sub(a));if(normal.lengthSq()<1e-8)continue;normal.normalize();if(normal.y<.8)continue;const p=a.add(bb).add(c).multiplyScalar(1/3).applyMatrix4(warm.matrixWorld),d=p.distanceToSquared(target);if(d<score){score=d;bridgeFocus=p;bridgeNormal=normal;}}
 assert(Number.isFinite(score),'No real upward-facing masonry triangle for the control');
 const noise=cloudTexture();renderer.initTexture(noise);
 const definitions=[{name:'lawn' as const,root:lawn,focus:lawnFocus,normal:new T.Vector3(0,1,0)},{name:'asphalt' as const,root:pavement,focus:roadFocus,normal:new T.Vector3(0,1,0)},{name:'masonry' as const,root:masonry,focus:bridgeFocus,normal:bridgeNormal}];
 const fixtures:Fixture[]=[];
 for(const definition of definitions){
  const meshes=meshList(definition.root),baseline=await prepare(definition.root,definition.name,'baseline',noise),currentDefault=await prepare(definition.root,definition.name,'default',noise),candidate=await prepare(definition.root,definition.name,'candidate',noise);
  assert(meshes.length===baseline.materials.length&&meshes.length===currentDefault.materials.length&&meshes.length===candidate.materials.length,'Material ownership does not match source geometry');
  meshes.forEach((mesh,i)=>{const before=mesh.onBeforeRender,beforeShadow=mesh.onBeforeShadow;mesh.onBeforeRender=function(...args){before.apply(this,args);submittedMaterials.add(args[4]);drawOrder.push('color:'+i+':'+args[4].name);};mesh.onBeforeShadow=function(...args){beforeShadow.apply(this,args);drawOrder.push('shadow:'+i);};});
  const fixture={...definition,meshes,owners:{baseline,default:currentDefault,candidate},control:variants(candidate.materials,definition.name,'disabled'),mask:variants(candidate.materials,definition.name,'mask'),bumpCenterWrong:wrongBumpCenterVariants(candidate.materials,candidate.bumpCenterMaterials),geometry:await Promise.all(meshes.map(geometryReceipt))};
  definition.root.visible=false;scene.add(definition.root);fixtures.push(fixture);
 }
 return {fixtures,map,terrain,contact};
}
function configure(fixture:Fixture,view:View,style:ArtStyleId){
 const look=ART_DIRECTIONS[style],night=style==='noir'||style==='detroit2084',focus=fixture.focus;
 const offset=view==='near'?new T.Vector3(3,3.5,4.5):view==='mid'?new T.Vector3(25,32,38):new T.Vector3(70,4,110);
 if(fixture.name==='asphalt'&&view==='near')offset.set(8,12,14);
 if(fixture.name==='masonry'&&view==='mid')offset.set(28,24,40);
 camera.position.copy(focus).add(offset);camera.lookAt(focus);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 scene.background=new T.Color(look.palette.horizon);(scene.fog as T.FogExp2).color.set(look.palette.fog);
 sun.color.set(look.palette.sun);sun.intensity=(night?.17:2.1)*look.sunScale;ambient.intensity=(night?.35:1.3)*look.ambientScale;
 sun.position.copy(focus).add(new T.Vector3(-22,45,15));sun.target.position.copy(focus);sun.target.updateMatrixWorld(true);
 caster.position.copy(focus).add(new T.Vector3(.7,1.15,-.4));caster.visible=true;
 const extent=view==='near'?12:55;Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});sun.shadow.camera.updateProjectionMatrix();
 ART_ROAD_WETNESS.value=look.roadWetness;originalWetness.value=look.roadWetness;
 const direction=sun.position.clone().sub(focus).normalize();
 for(const owner of Object.values(fixture.owners))owner.atmosphere.update(5.25,direction,night?.55:.42,night?.08:.9,.15,'high',true,false);
 scene.updateMatrixWorld(true);return {position:camera.position.toArray(),matrixWorld:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray(),focus:focus.toArray(),roadWetness:look.roadWetness,style,view,night};
}
function use(fixture:Fixture,side:Side|'disabled'|'mask'|'bump-center-wrong'){
 const materials=side==='disabled'?fixture.control:side==='mask'?fixture.mask:side==='bump-center-wrong'?fixture.bumpCenterWrong:fixture.owners[side].materials;
 fixture.meshes.forEach((mesh,i)=>{mesh.material=materials[i];});
}
async function render(capture=true,measure=false):Promise<Sample>{
 drawOrder.length=0;renderer.shadowMap.needsUpdate=true;let elapsed:WebGLQuery|null=null;
 if(measure&&timer){assert(gl.getQuery(timer.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)===null,'An unrelated GPU elapsed query is active');elapsed=gl.createQuery();assert(elapsed,'Could not allocate elapsed query');gl.beginQuery(timer.TIME_ELAPSED_EXT,elapsed);}
 const started=performance.now();renderer.render(scene,camera);const cpuMs=performance.now()-started;
 if(elapsed)gl.endQuery(timer!.TIME_ELAPSED_EXT);
 const counts={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},order=[...drawOrder],fenceMs=await fence();
 const timing={status:measure?(timer?'pending':'unavailable'):'not-requested',nanoseconds:null as number|null};
 if(elapsed){try{const deadline=performance.now()+30000;while(!gl.getQueryParameter(elapsed,gl.QUERY_RESULT_AVAILABLE)){assert(performance.now()<deadline,'GPU elapsed result remained unavailable');await new Promise(resolve=>setTimeout(resolve,8));}if(gl.getParameter(timer!.GPU_DISJOINT_EXT))timing.status='disjoint';else{const n=Number(gl.getQueryParameter(elapsed,gl.QUERY_RESULT));assert(Number.isFinite(n)&&n>=0,'Invalid GPU elapsed value');timing.status='available';timing.nanoseconds=n;}}finally{gl.deleteQuery(elapsed);}}
 const rgba=capture?new Uint8Array(width*height*4):new Uint8Array();let shadow=new Uint8Array();
 if(capture){gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);if(sun.castShadow&&sun.shadow.map){const map=sun.shadow.map;assert(map instanceof T.WebGLRenderTarget,'Unexpected shadow target type');shadow=new Uint8Array(map.width*map.height*4);renderer.readRenderTargetPixels(map,0,0,map.width,map.height,shadow);}}
 assert(gl.getError()===gl.NO_ERROR,'GL error during original render or readback');
 return {rgba,shadow,png:capture?png(rgba):'',...counts,order,cpuMs,fenceMs,gpu:timing};
}
function keep(name:string,sample:Sample){images.push({name,png:sample.png});}
function maskCounts(bytes:Uint8Array){let active=0,inactive=0;for(let i=0;i<bytes.length;i+=4){if(bytes[i]===0&&bytes[i+1]===255&&bytes[i+2]===0)active++;if(bytes[i]===255&&bytes[i+1]===0&&bytes[i+2]===0)inactive++;}return{active,inactive};}
function shaderReceipt(material:T.Material){const s=shaders.get(material);assert(s,'Expected production material was never compiled');const textures:Record<string,unknown>={};for(const [name,u] of Object.entries(s.uniforms)){if(u.value instanceof T.Texture){const t=u.value,data=t.source.data as {width?:number;height?:number;src?:string;currentSrc?:string};textures[name]={width:data?.width,height:data?.height,url:data?.currentSrc||data?.src||null,colorSpace:t.colorSpace,format:t.format,type:t.type,minFilter:t.minFilter,magFilter:t.magFilter,wrapS:t.wrapS,wrapT:t.wrapT,anisotropy:t.anisotropy,flipY:t.flipY};}}return{name:material.name,key:material.customProgramCacheKey(),textures,roughness:(material as T.MeshStandardMaterial).roughness,materialSide:material.side,opacity:material.opacity,depthWrite:material.depthWrite,depthTest:material.depthTest};}
function nativeProgram(material:T.Material){
 const property=renderer.properties.get(material) as {currentProgram?:{id:number;program:WebGLProgram;vertexShader:WebGLShader;fragmentShader:WebGLShader}};
 const program=property.currentProgram;assert(program,'Actual material has no linked native program');
 assert(gl.getProgramParameter(program.program,gl.LINK_STATUS),'Actual material native program did not link');
 const vertex=gl.getShaderSource(program.vertexShader),fragment=gl.getShaderSource(program.fragmentShader);
 assert(vertex&&fragment,'Actual linked program shader source unavailable');
 return {id:program.id,vertex,fragment,linked:true,submitted:submittedMaterials.has(material)};
}

(window as unknown as {__surfaceFragmentProof:()=>Promise<unknown>}).__surfaceFragmentProof=async()=>{
 let fixtures:Fixture[]=[];const materialEvidence:unknown[]=[];
 let lawnEquivalence:Awaited<ReturnType<typeof originalLawnEquivalence>>|null=null;
 try{
  lawnEquivalence=await originalLawnEquivalence();
  assert(lawnEquivalence.passed,'The current lawn helper differs from the independently extracted original callback, key, or generated shaders');
  ({fixtures}=await buildFixtures());
  for(const fixture of fixtures){
   fixture.root.visible=true;
   for(const view of ['near','mid','grazing'] as View[])for(const style of ART_STYLE_IDS){
    const id=fixture.name+'-'+view+'-'+style,inputs=configure(fixture,view,style);
    console.log('[surface-proof] '+id);
    for(const side of ['baseline','default','candidate'] as Side[]){use(fixture,side);await renderer.compileAsync(scene,camera);}
    use(fixture,'baseline');const baseline=await render();use(fixture,'default');const currentDefault=await render();use(fixture,'candidate');const candidate=await render();use(fixture,'baseline');const repeat=await render();
    const color=changed(baseline.rgba,candidate.rgba),defaultColor=changed(baseline.rgba,currentDefault.rgba),determinism=changed(baseline.rgba,repeat.rgba),shadow=changed(baseline.shadow,candidate.shadow),defaultShadow=changed(baseline.shadow,currentDefault.shadow),shadowRepeat=changed(baseline.shadow,repeat.shadow);
    const orderEqual=JSON.stringify(baseline.order)===JSON.stringify(candidate.order)&&JSON.stringify(baseline.order)===JSON.stringify(repeat.order);
    const defaultOrderEqual=JSON.stringify(baseline.order)===JSON.stringify(currentDefault.order);
    const geometryEqual=baseline.calls===candidate.calls&&baseline.triangles===candidate.triangles&&baseline.calls===repeat.calls&&baseline.triangles===repeat.triangles;
    const defaultGeometryEqual=baseline.calls===currentDefault.calls&&baseline.triangles===currentDefault.triangles;
    const row={name:id,subject:fixture.name,optimizationApplied:fixture.name!=='lawn',inputs,width,height,changedPixels:color.pixels,maxChannelDelta:color.maxChannelDelta,defaultChangedPixels:defaultColor.pixels,defaultMaxChannelDelta:defaultColor.maxChannelDelta,repeatChangedPixels:determinism.pixels,shadowChangedPixels:shadow.pixels,defaultShadowChangedPixels:defaultShadow.pixels,shadowRepeatChangedPixels:shadowRepeat.pixels,orderEqual,defaultOrderEqual,geometryEqual,defaultGeometryEqual,baselineCalls:baseline.calls,defaultCalls:currentDefault.calls,candidateCalls:candidate.calls,baselineTriangles:baseline.triangles,defaultTriangles:currentDefault.triangles,candidateTriangles:candidate.triangles,baselineRgbaSha256:await hash(baseline.rgba),defaultRgbaSha256:await hash(currentDefault.rgba),candidateRgbaSha256:await hash(candidate.rgba),baselineShadowSha256:await hash(baseline.shadow),defaultShadowSha256:await hash(currentDefault.shadow),candidateShadowSha256:await hash(candidate.shadow),passed:color.pixels===0&&defaultColor.pixels===0&&determinism.pixels===0&&shadow.pixels===0&&defaultShadow.pixels===0&&shadowRepeat.pixels===0&&orderEqual&&defaultOrderEqual&&geometryEqual&&defaultGeometryEqual};
    rows.push(row);keep(id+'-baseline',baseline);keep(id+'-default',currentDefault);keep(id+'-candidate',candidate);
    if(color.pixels)images.push({name:id+'-difference',png:differencePng(baseline.rgba,candidate.rgba)});
    if(defaultColor.pixels)images.push({name:id+'-default-difference',png:differencePng(baseline.rgba,currentDefault.rgba)});
    if(determinism.pixels)keep(id+'-baseline-repeat',repeat);
    if(style==='authentic'){
     let bumpCenterWrongPixels:number|undefined;
     if(fixture.name==='masonry'){
      use(fixture,'bump-center-wrong');const wrongCenter=await render();keep(id+'-bump-center-wrong-control',wrongCenter);
      bumpCenterWrongPixels=changed(candidate.rgba,wrongCenter.rgba).pixels;
     }
     use(fixture,'disabled');const disabled=await render();keep(id+'-detail-disabled-control',disabled);
     caster.visible=false;const oldBackground=scene.background;scene.background=new T.Color(0x000000);use(fixture,'mask');const mask=await render();keep(id+'-filter-mask',mask);const counts=maskCounts(mask.rgba);scene.background=oldBackground;caster.visible=true;
     let hiddenPixels:number|undefined,shadowPixels:number|undefined;
     if(view==='near'){
      use(fixture,'baseline');fixture.root.visible=false;const hidden=await render();fixture.root.visible=true;keep(id+'-subject-hidden-control',hidden);hiddenPixels=changed(baseline.rgba,hidden.rgba).pixels;
      sun.castShadow=false;const shadowOff=await render();sun.castShadow=true;keep(id+'-shadow-off-control',shadowOff);shadowPixels=changed(baseline.rgba,shadowOff.rgba).pixels;
     }
     use(fixture,'baseline');const restored=await render();
     const restoredPixels=changed(baseline.rgba,restored.rgba).pixels,detailPixels=changed(candidate.rgba,disabled.rgba).pixels;
     controls.push({subject:fixture.name,view,detailDisabledChangedPixels:detailPixels,subjectHiddenChangedPixels:hiddenPixels,shadowOffChangedPixels:shadowPixels,bumpCenterWrongChangedPixels:bumpCenterWrongPixels,maskActivePixels:counts.active,maskInactivePixels:counts.inactive,restoredChangedPixels:restoredPixels,passed:restoredPixels===0&&(hiddenPixels===undefined||hiddenPixels>=16)&&(shadowPixels===undefined||shadowPixels>=16)&&counts.active+counts.inactive>=16});
     // Both variants have already completed genuine render/readback before the
     // warmed ABBA sequence. Timing remains distinct from correctness acceptance.
     const repetitions=fixture.name==='masonry'?3:1,lanes=[];
     for(let repetition=1;repetition<=repetitions;repetition++)for(const side of ['baseline','candidate','candidate','baseline'] as Side[]){use(fixture,side);const sample=await render(false,true);lanes.push({side,repetition,cpuMs:sample.cpuMs,fenceMs:sample.fenceMs,gpu:sample.gpu,calls:sample.calls,triangles:sample.triangles});}
     timings.push({subject:fixture.name,optimizationApplied:fixture.name!=='lawn',view,width,height,order:'ABBA',repetitions,lanes,scope:'Warmed targeted fixture renders with elapsed-query overhead; not full-game frame intervals or release acceptance.'});
    }
   }
   for(const side of ['baseline','default','candidate'] as Side[]){
    const materials=[...new Set(fixture.owners[side].materials.flat())],selected=materials.filter(m=>shaderSources.get(m)?.fragment.includes(factors[fixture.name]));
    assert(selected.length>0,'No actual '+fixture.name+' material contained its expected filter');
    assert(selected.some(material=>submittedMaterials.has(material)),'No decorated '+side+' '+fixture.name+' material reached a real display submission');
    for(const material of selected){
     const source=shaderSources.get(material)!,native=nativeProgram(material),pattern=new RegExp('if\\s*\\(\\s*'+factors[fixture.name]+'\\s*>\\s*0\\.'),hasGuard=pattern.test(source.fragment),linkedGuard=pattern.test(native.fragment);
     const expectedGuard=side==='candidate'&&fixture.name!=='lawn';
     assert(hasGuard===expectedGuard&&linkedGuard===expectedGuard,'Expected independent original/candidate shader path not observed in linked '+fixture.name+' program');
     const bumpCenterReuseInstalled=fixture.owners[side].bumpCenterMaterials.has(material);
     const bumpCenterMarkerObserved=source.fragment.includes(MACARTHUR_BUMP_CENTER_ASSIGNMENT)&&source.fragment.includes(MACARTHUR_BUMP_CENTER_READ);
     const linkedBumpCenterMarkerObserved=native.fragment.includes(MACARTHUR_BUMP_CENTER_ASSIGNMENT)&&native.fragment.includes(MACARTHUR_BUMP_CENTER_READ);
     assert(bumpCenterMarkerObserved===bumpCenterReuseInstalled&&linkedBumpCenterMarkerObserved===bumpCenterReuseInstalled,'Unexpected bump-center reuse path in '+side+' '+fixture.name+' linked material');
     if(bumpCenterReuseInstalled)assert(side==='candidate'&&fixture.name==='masonry'&&native.submitted,'An installed bump-center candidate did not reach a real masonry display submission');
     materialEvidence.push({subject:fixture.name,side,...shaderReceipt(material),guardObserved:hasGuard,linkedGuardObserved:linkedGuard,bumpCenterReuseInstalled,bumpCenterMarkerObserved,linkedBumpCenterMarkerObserved,nativeProgramId:native.id,nativeLinked:native.linked,submitted:native.submitted,masonryStats:fixture.owners[side].masonryStats,vertexSha256:await textHash(source.vertex),fragmentSha256:await textHash(source.fragment),nativeVertexSha256:await textHash(native.vertex),nativeFragmentSha256:await textHash(native.fragment)});
    }
   }
   fixture.root.visible=false;
  }
 }catch(error){errors.push(String(error instanceof Error?error.stack:error));}
 const coverage=fixtures.map(f=>{const own=controls.filter(c=>c.subject===f.name),active=own.reduce((n,c)=>n+Number(c.maskActivePixels),0),inactive=own.reduce((n,c)=>n+Number(c.maskInactivePixels),0),detail=Math.max(0,...own.map(c=>Number(c.detailDisabledChangedPixels)));return{subject:f.name,activeFilterPixels:active,inactiveFilterPixels:inactive,effectiveDetailPixels:detail,passed:own.length===3&&active>=16&&inactive>=16&&detail>=16&&own.every(c=>c.passed)};});
 const bumpControls=controls.filter(c=>c.subject==='masonry'),installedMaterials=fixtures.find(f=>f.name==='masonry')?.owners.candidate.bumpCenterMaterials.size??0;
 const effectivePixels=Math.max(0,...bumpControls.map(c=>Number(c.bumpCenterWrongChangedPixels))),restoredChangedPixels=Math.max(0,...bumpControls.map(c=>Number(c.restoredChangedPixels)));
 const masonryBumpCenterControl={installedMaterials,effectivePixels,restoredChangedPixels,views:bumpControls.map(c=>c.view),passed:installedMaterials>0&&bumpControls.length===3&&effectivePixels>=16&&restoredChangedPixels===0&&bumpControls.every(c=>c.passed)};
 return {gpu,threeRevision:T.REVISION,width,height,grassWithdrawal,lawnEquivalence,dpr:renderer.getPixelRatio(),antialias:gl.getContextAttributes()?.antialias,shadowMapSize:sun.shadow.mapSize.toArray(),shadowReadback:'RGBA8 shadow target color attachment; effective receiver shadows also have an independent off/on control. Native depth texture bytes are not claimed.',rows,controls,coverage,masonryBumpCenterControl,timings,images,errors,resources,materials:materialEvidence,geometry:fixtures.map(f=>({subject:f.name,meshes:f.geometry})),
  scope:'Pinned original and opt-in asphalt/masonry fragment candidates, plus original lawn regression coverage after grass candidate withdrawal, on shared actual geometry with actual materials/textures, controlled camera/light/style inputs, zero RGBA tolerance and shadow readback. Targeted fixture only; not full-world collision, gameplay, controls, physical-device or sustained performance acceptance.',
  passed:errors.length===0&&rows.length===36&&rows.every(r=>r.passed)&&coverage.length===3&&coverage.every(c=>c.passed)&&masonryBumpCenterControl.passed};
};
