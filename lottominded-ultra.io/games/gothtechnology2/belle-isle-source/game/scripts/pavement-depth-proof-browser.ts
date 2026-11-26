import * as T from 'three';
import {createPavementMesh,pavementFactoryOwner,type PavementPart} from '../src/belle/pavement.ts';
import {preparePavementDepthPrepass,type PavementDepthReceipt} from '../src/belle/pavementDepthPrepass.ts';
import {finishAsphalt} from '../src/belle/surfaceFinish.ts';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
import {ParkTerrain,type ParkMap} from '../src/belle/terrain.ts';
// This virtual module is extracted and SHA-256 checked against exact 759 source.
// It retains the actual grass shader, polygon construction and graded approaches.
import {authoredGrass,authoredPoly,authoredApproaches} from 'pavement-proof-authored';

const width=1280,height=800,canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,stencil:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,width/height,.08,22000);
scene.background=new T.Color(0x8397a8);scene.fog=new T.FogExp2(0x9ca5a4,.00012);
const hemi=new T.HemisphereLight(0xd8e4f1,0x465443,2.1),sun=new T.DirectionalLight(0xffefdc,3),lamp=new T.PointLight(0x9dbdff,600,100,2);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:450});sun.shadow.bias=-.0001;
scene.add(hemi,sun,sun.target,lamp);
const noise=new T.DataTexture(new Uint8Array([127,127,127,255]),1,1);noise.needsUpdate=true;
const atmosphere=new WorldAtmosphere(scene,noise);
const gl=renderer.getContext() as WebGL2RenderingContext;
if(typeof gl.fenceSync!=='function')throw Error('WebGL2 required');
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
const bits=(values:ArrayLike<number>)=>Array.from(new Uint32Array(Float32Array.from(values).buffer));
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function difference(a:Uint8Array,b:Uint8Array){let pixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;
 for(let j=0;j<4;j++){const delta=Math.abs(a[i+j]-b[i+j]);maxChannelDelta=Math.max(maxChannelDelta,delta);changed||=delta!==0;}if(changed)pixels++;}return{pixels,maxChannelDelta};}
async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('GPU fence unavailable');gl.flush();const start=performance.now();
 try{while(true){const status=gl.clientWaitSync(sync,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
  if(status===gl.WAIT_FAILED||gl.isContextLost())throw Error('GPU fence failed');if(performance.now()-start>60000)throw Error('GPU fence exceeded 60 seconds');await new Promise(resolve=>setTimeout(resolve,8));}}
 finally{gl.deleteSync(sync);}}
type Draw={id:number;geometryId:number;materialId:number;pass:'color'|'shadow';calls:number;triangles:number;start:number;count:number;
 world:number[];view:number[];projection:number[];positionId:number;indexId:number};
let trace:Draw[]=[];
const attributeIds=new WeakMap<object,number>();let nextAttributeId=1;
function attributeId(value:object|null|undefined){if(!value)return-1;let id=attributeIds.get(value);if(id===undefined){id=nextAttributeId++;attributeIds.set(value,id);}return id;}
const originalDirect=renderer.renderBufferDirect;
renderer.renderBufferDirect=function(...args){
 const [viewCamera,viewScene,geometry,material,object]=args,prior={...renderer.info.render};
 const result=Reflect.apply(originalDirect,this,args),after=renderer.info.render;
 if(object instanceof T.Mesh)trace.push({id:object.id,geometryId:geometry.id,materialId:attributeId(material),pass:viewScene===scene?'color':'shadow',
  calls:after.calls-prior.calls,triangles:after.triangles-prior.triangles,start:geometry.drawRange.start,count:geometry.drawRange.count,
  world:bits(object.matrixWorld.elements),view:bits(object.modelViewMatrix.elements),projection:bits(viewCamera.projectionMatrix.elements),
  positionId:attributeId(geometry.getAttribute('position')),indexId:attributeId(geometry.index)});
 return result;
};
async function render(viewScene=scene){trace=[];renderer.shadowMap.needsUpdate=true;renderer.render(viewScene,camera);await fence();
 const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('GPU readback error '+error);
 return{pixels,png:canvas.toDataURL('image/png'),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,draws:trace.slice()};}
function rectangle(x:number,z:number,y:number,w:number,l:number){
 const vertices=[[x-w/2,y,z-l/2],[x-w/2,y,z+l/2],[x+w/2,y,z-l/2],[x+w/2,y,z+l/2]];
 const data=new Float32Array(vertices.flatMap(([a,b,c])=>[a,b,c,0,1,0,a/8,c/8]));
 return{buffer:data.buffer,part:{kind:'asphalt',offset:0,vertices:4,indices:[0,1,2,2,1,3],ranges:[[6,x-w/2,y,z-l/2,x+w/2,y,z+l/2]]} as PavementPart};
}
function geometryForRectangle(x:number,z:number,y:number,w:number,l:number){const r=rectangle(x,z,y,w,l);return createPavementMesh(r.buffer,r.part,8,new T.MeshBasicMaterial()).geometry;}
const startCamera={matrixWorld:[-.43808948975740325,2.7755575615628914e-17,.8989313649907306,0,.3195231959165713,.9346961248202004,.1557179550256197,0,-.840227663336169,.35544782211472403,-.4094805484007036,0,4.507587308565813,5.814214590996292,16.664564622722438,1],
 projection:[1.2266315659407192,0,0,0,0,1.9626105055051506,0,0,0,0,-1.0000072727537193,-1,0,0,-.16000058182029753,0]};

const ready=(async()=>{
 const [metadata,bytes,map]=await Promise.all([fetch('/belle/pavement.json').then(r=>r.json()),fetch('/belle/pavement.bin').then(r=>r.arrayBuffer()),fetch('/belle/map.json').then(r=>r.json())]) as [{stride:number;groups:PavementPart[]},ArrayBuffer,ParkMap];
 const terrain=new ParkTerrain(map),grass=authoredGrass(),asphalt=new T.MeshStandardMaterial({color:0x979b99,roughness:.8});asphalt.name='Island asphalt';finishAsphalt(asphalt);
 // The measured expensive approaches use the exact recovered source span.
 authoredApproaches(scene,map,terrain,grass);
 for(const points of [map.island,map.mainland]){const ground=new T.Mesh(authoredPoly(points,2),grass);ground.name='Authored grass context';ground.receiveShadow=true;ground.renderOrder=-102;scene.add(ground);}
 const materialByKind:Record<string,T.Material>={asphalt,concrete:new T.MeshStandardMaterial({color:0x948f81}),gravel:new T.MeshStandardMaterial({color:0xa8a297}),wood:new T.MeshStandardMaterial({color:0x8c755a}),pavers:new T.MeshStandardMaterial({color:0x978d7a})};
 const sources:T.Mesh[]=[];for(const part of metadata.groups){if(!part.vertices)continue;const source=createPavementMesh(bytes,part,metadata.stride,materialByKind[part.kind]??materialByKind.concrete);
  terrain.roadContact.add(source.geometry);scene.add(source);if(part.kind==='asphalt')sources.push(source);}
 // Separate factory-owned stress geometry covers coplanar and both sides of a
 // small depth separation. Its earlier/later color draws always retain order.
 const synthetic=rectangle(30000,0,2,1200,1200),stress=createPavementMesh(synthetic.buffer,synthetic.part,8,asphalt);scene.add(stress);sources.push(stress);
 const under=new T.Mesh(geometryForRectangle(30000,0,2,1200,1200),grass);under.renderOrder=-102;under.receiveShadow=true;scene.add(under);
 const bands:T.Mesh[]=[];for(const [x,y,color,order]of[[29600,2,0xd82939,-1],[30000,2,0x1fced2,1],[30200,2+.015625,0xe7be31,1],[30400,2-.015625,0x803bba,1]]){
  const mesh=new T.Mesh(geometryForRectangle(x,0,y,160,1200),new T.MeshBasicMaterial({color,depthFunc:T.LessEqualDepth}));mesh.renderOrder=order;scene.add(mesh);bands.push(mesh);}
 const caster=new T.Mesh(new T.BoxGeometry(3,3,3),new T.MeshStandardMaterial({color:0x9e8d73,roughness:.8}));caster.castShadow=true;caster.receiveShadow=true;scene.add(caster);
 await loadRealisticMaterials(renderer);atmosphere.flush();applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);scene.updateMatrixWorld(true);
 const receipts:PavementDepthReceipt[]=sources.map(source=>{const material=source.material as T.MeshStandardMaterial;return{source,geometry:source.geometry,material,compile:material.onBeforeCompile,key:material.customProgramCacheKey};});
 const handle=preparePavementDepthPrepass(scene,renderer,receipts,{rendererOutput:{type:T.UnsignedByteType,nodes:false}});
 if(handle.read().prepared!==sources.length)throw Error('Actual factory/decorator path did not prepare all expected depth views');
 const depthBySource=new Map(handle.read().entries.map(e=>[e.sourceId,scene.getObjectById(e.depthId) as T.Mesh])),depths=[...depthBySource.values()];
 const depthIds=new Set(depths.map(mesh=>mesh.id));
 // Intentional fault injection is separate fixture geometry. Production depth
 // owners reject such polygon offsets, so none of their fields are weakened.
 const faulty=sources.map(source=>{
  const g=new T.BufferGeometry();for(const [name,a]of Object.entries(source.geometry.attributes))g.setAttribute(name,a);g.setIndex(source.geometry.index);g.boundingSphere=source.geometry.boundingSphere;
  const m=new T.MeshDepthMaterial({colorWrite:false,depthWrite:true,depthTest:true,depthFunc:T.LessEqualDepth,side:(source.material as T.Material).side,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-2});
  const mesh=new T.Mesh(g,m);mesh.renderOrder=-103;mesh.visible=false;mesh.raycast=()=>{};
  const owner=pavementFactoryOwner(source)!,selection={start:0,count:0};mesh.onBeforeRender=(_r,_s,c)=>{owner.range!.select(c,selection);g.setDrawRange(selection.start,selection.count);};scene.add(mesh);return mesh;
 });
 // Adding only depth materials does not rewrap source shader owners.
 await Promise.resolve();for(const r of receipts)if(r.source.material!==r.material||r.material.onBeforeCompile!==r.compile||r.material.customProgramCacheKey!==r.key)throw Error('Source owner changed during proof setup');
 const ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 return{terrain,sources,stress,caster,bands,receipts,handle,depthBySource,depths,depthIds,faulty,gpu,assetSha256:await hash(new Uint8Array(bytes))};
})();

(window as unknown as {__pavementDepthProof:()=>Promise<unknown>}).__pavementDepthProof=async()=>{
 const f=await ready,rows:Record<string,unknown>[]=[],images:{name:string;png:string}[]=[];
 const poses=[{name:'original-software-start',position:[0,0,0],target:[0,0,0],recorded:true,stress:false},
  {name:'island-landing',position:[431,9,778],target:[600,2,640],recorded:false,stress:false},
  {name:'island-far-road',position:[1320,40,1500],target:[1600,2,900],recorded:false,stress:false},
  {name:'quantized-near',position:[30000,150,300],target:[30000,2,0],recorded:false,stress:true},
  {name:'quantized-far',position:[30000,1400,2500],target:[30000,2,0],recorded:false,stress:true}];
 for(const pose of poses)for(const night of pose.stress?[false]:[false,true]){
  const name=pose.name+(night?'-night':'-day');
  if(pose.recorded){camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;camera.matrixWorld.fromArray(startCamera.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.matrix.copy(camera.matrixWorld);camera.position.setFromMatrixPosition(camera.matrixWorld);
   camera.projectionMatrix.fromArray(startCamera.projection);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
  else{camera.matrixAutoUpdate=true;camera.matrixWorldAutoUpdate=true;camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3().fromArray(pose.target));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);}
  const direction=new T.Vector3(0,0,-1).transformDirection(camera.matrixWorld),ahead=new T.Vector3().copy(camera.position).addScaledVector(direction,24);
  const groundY=pose.stress?2:f.terrain.height(ahead.x,ahead.z);f.caster.position.set(ahead.x,groundY+1.5,ahead.z);f.caster.visible=!pose.stress;
  sun.position.set(ahead.x-35,groundY+70,ahead.z+35);sun.target.position.set(ahead.x,groundY,ahead.z);
  sun.intensity=night?.16:3;hemi.intensity=night?.24:2.1;lamp.intensity=night?600:0;lamp.position.set(ahead.x+4,groundY+7,ahead.z+3);
  scene.background=new T.Color(night?0x142033:0x8397a8);atmosphere.update(12,new T.Vector3(-.4,.7,.4).normalize(),.35,night?.04:1,.2,'high',false,false);
  scene.updateMatrixWorld(true);const cameraInput={world:bits(camera.matrixWorld.elements),view:bits(camera.matrixWorldInverse.elements),projection:bits(camera.projectionMatrix.elements)};
  f.depths.forEach(d=>d.visible=true);await renderer.compileAsync(scene,camera);
  f.depths.forEach(d=>d.visible=false);const baseline=await render();
  f.depths.forEach(d=>d.visible=true);const candidate=await render();const stats=f.handle.read();
  const originalBaseline=baseline.draws.filter(d=>!f.depthIds.has(d.id)),originalCandidate=candidate.draws.filter(d=>!f.depthIds.has(d.id));
  const depthDraws=candidate.draws.filter(d=>f.depthIds.has(d.id)&&d.calls>0),colorStable=same(originalBaseline,originalCandidate);
  const exactDepthInputs=depthDraws.every(d=>{const sourceId=stats.entries.find(e=>e.depthId===d.id)!.sourceId,source=candidate.draws.find(row=>row.id===sourceId&&row.pass==='color');
   return!!source&&same(d.world,source.world)&&same(d.view,source.view)&&same(d.projection,source.projection)&&d.positionId===source.positionId&&d.indexId===source.indexId&&d.start===source.start&&d.count===source.count;});
  const extraCalls=depthDraws.reduce((n,d)=>n+d.calls,0),extraTriangles=depthDraws.reduce((n,d)=>n+d.triangles,0);
  const pixelDifference=difference(baseline.pixels,candidate.pixels);
  f.depths.forEach(d=>d.visible=false);f.sources.forEach(s=>s.visible=false);const hidden=await render();f.sources.forEach(s=>s.visible=true);
  const originalMaterials=f.sources.map(s=>s.material);const plain=f.sources.map(s=>{const m=(s.material as T.MeshStandardMaterial).clone();m.onBeforeCompile=T.Material.prototype.onBeforeCompile;m.customProgramCacheKey=T.Material.prototype.customProgramCacheKey;return m;});
  f.sources.forEach((s,i)=>s.material=plain[i]);const shaderOff=await render();f.sources.forEach((s,i)=>s.material=originalMaterials[i]);plain.forEach(m=>m.dispose());
  sun.castShadow=false;const shadowOff=await render();sun.castShadow=true;
  f.faulty.forEach(d=>d.visible=true);const wrongDepth=await render();f.faulty.forEach(d=>d.visible=false);
  const visibleAsphaltPixels=difference(baseline.pixels,hidden.pixels).pixels,visibleShaderPixels=difference(baseline.pixels,shaderOff.pixels).pixels,
   visibleShadowPixels=difference(baseline.pixels,shadowOff.pixels).pixels,rejectedBiasedDepthPixels=difference(baseline.pixels,wrongDepth.pixels).pixels;
  const cameraUnchanged=same(cameraInput,{world:bits(camera.matrixWorld.elements),view:bits(camera.matrixWorldInverse.elements),projection:bits(camera.projectionMatrix.elements)});
  const ownersUnchanged=f.receipts.every(r=>r.source.material===r.material&&r.material.onBeforeCompile===r.compile&&r.material.customProgramCacheKey===r.key);
  const passed=pixelDifference.pixels===0&&colorStable&&exactDepthInputs&&extraCalls>0&&extraTriangles>0&&
   candidate.calls===baseline.calls+extraCalls&&candidate.triangles===baseline.triangles+extraTriangles&&depthDraws.every(d=>d.pass==='color')&&
   visibleAsphaltPixels>0&&visibleShaderPixels>0&&(pose.stress||visibleShadowPixels>0)&&rejectedBiasedDepthPixels>0&&cameraUnchanged&&ownersUnchanged;
  rows.push({name,passed,changedPixels:pixelDifference.pixels,maxChannelDelta:pixelDifference.maxChannelDelta,
   visibleAsphaltPixels,visibleShaderPixels,visibleShadowPixels,rejectedBiasedDepthPixels,originalDrawsIdentical:colorStable,exactDepthInputs,
   baselineCalls:baseline.calls,candidateCalls:candidate.calls,extraDepthCalls:extraCalls,baselineTriangles:baseline.triangles,candidateTriangles:candidate.triangles,extraDepthTriangles:extraTriangles,
   cameraInput,cameraUnchanged,ownersUnchanged,baselineRgbaSha256:await hash(baseline.pixels),candidateRgbaSha256:await hash(candidate.pixels),depthStats:stats,
   baselineDraws:baseline.draws,candidateDraws:candidate.draws});
  for(const [suffix,capture]of[['baseline',baseline],['candidate',candidate],['asphalt-hidden',hidden],['asphalt-shader-off',shaderOff],['shadow-off',shadowOff],['rejected-biased-depth',wrongDepth]] as const)images.push({name:name+'-'+suffix,png:capture.png});
 }
 // Positive proof that this far pose contains actual quantized equal-depth
 // samples on two distinct authored Float32 height planes, not only exact ties.
 const equalityScene=new T.Scene();equalityScene.background=new T.Color(0);
 const equalBase=new T.Mesh(f.stress.geometry,new T.MeshBasicMaterial({colorWrite:false,depthFunc:T.LessEqualDepth}));
 const equalProbe=new T.Mesh(geometryForRectangle(30000,0,2-.015625,1200,1200),new T.MeshBasicMaterial({color:0x00ffff,depthFunc:T.EqualDepth,depthWrite:false}));equalProbe.renderOrder=1;equalityScene.add(equalBase,equalProbe);
 const equalCapture=await render(equalityScene);let quantizedEqualPixels=0;for(let i=0;i<equalCapture.pixels.length;i+=4)if(equalCapture.pixels[i+1]||equalCapture.pixels[i+2])quantizedEqualPixels++;
 images.push({name:'quantized-depth-equality-positive-control',png:equalCapture.png});
 // A real unsupported live opacity/transparent change must draw only the native
 // color path, retain exact pixels, and submit zero depth triangles.
 const live=f.stress.material as T.MeshStandardMaterial;live.transparent=true;live.opacity=.65;
 f.depths.forEach(d=>d.visible=false);const fallbackBaseline=await render();f.depths.forEach(d=>d.visible=true);const fallbackCandidate=await render();
 const fallbackDepthCalls=fallbackCandidate.draws.filter(d=>f.depthIds.has(d.id)).reduce((n,d)=>n+d.calls,0),fallbackPixels=difference(fallbackBaseline.pixels,fallbackCandidate.pixels).pixels;
 live.transparent=false;live.opacity=1;
 images.push({name:'unsupported-transparent-baseline',png:fallbackBaseline.png},{name:'unsupported-transparent-candidate',png:fallbackCandidate.png});
 f.handle.dispose();renderer.renderBufferDirect=originalDirect;
 return{gpu:f.gpu,threeRevision:T.REVISION,width,height,assetSha256:f.assetSha256,rows,images,quantizedEqualPixels,unsupportedFallback:{changedPixels:fallbackPixels,depthCalls:fallbackDepthCalls},
  scope:'Targeted original-759 asphalt/decorator/range and quantized-depth proof; context geometry is a fixture. Not full-game performance or controls acceptance.',
  passed:rows.length===8&&rows.every(row=>row.passed)&&quantizedEqualPixels>0&&fallbackPixels===0&&fallbackDepthCalls===0};
};
