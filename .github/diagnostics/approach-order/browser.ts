/** Isolated authored-world experiment. This module is never imported by the game. */
import * as T from 'three';
import {createWorld} from '@app/world.ts';
import {ParkTerrain,type ParkMap} from '@app/terrain.ts';
import {alignScottMap} from '@app/fountainLayout.ts';
import {prepareCoastGuardMap} from '@app/coastGuard.ts';
import {activityLandmarks} from '@app/activitiesPlan.ts';
import {playgroundLandmarks} from '@app/playgrounds.ts';
import {prepareReferencePreferences} from '@app/sunsetReferencePolicy.ts';
import {installShadowMatrixCache} from '@app/shadowMatrixCache.ts';
import pins from './pins.json';

function check(ok:unknown,message:string):asserts ok{if(!ok)throw Error(message);}
const width=1280,height=800;
const canvas=document.querySelector('canvas')!;
prepareReferencePreferences();
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',outputBufferType:T.UnsignedByteType});
installShadowMatrixCache(renderer);
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(54,width/height,.08,22000),gl=renderer.getContext() as WebGL2RenderingContext;
const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
const debug=gl.getExtension('WEBGL_debug_renderer_info');
const gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
const values=(m:T.Matrix4)=>m.elements.slice();
const cameraReceipt=()=>({world:values(camera.matrixWorld),view:values(camera.matrixWorldInverse),projection:values(camera.projectionMatrix)});
const errorText=(e:unknown)=>e instanceof Error?e.stack||e.message:String(e);
const evidence:any={version:1,diagnosticOnly:true,releaseAcceptance:false,applicationSource:pins.applicationSource,
 scope:'Isolated real createWorld source, immutable original assets, fixed pose/time; no avatar or gameplay acceptance. Only two existing approach renderOrder values differ between modes.',
 gpu,viewport:[width,height,1],errors:[],queries:{available:!!ext,created:0,resolved:0,deleted:0,live:0,disjoint:false,rows:[]},cases:[],preparation:[]};
let world:Awaited<ReturnType<typeof createWorld>>,map:ParkMap,terrain:ParkTerrain,targets:T.Mesh[]=[],owners:any[]=[],context:any;
let currentCase:any,proofReference:Uint8Array|undefined,draws:any[]=[],mode='baseline',queryId=0,simulationTime=12,sourceQualityPixelRatio=1;
const materials=(mesh:T.Mesh)=>Array.isArray(mesh.material)?mesh.material:[mesh.material];
const ROAD_NAMES=new Set(['Joined island pavement · asphalt','Greater Detroit pavement','Joined ground · Island asphalt','Dequindre Cut greenway']);
function effectiveVisible(object:T.Object3D){for(let p:T.Object3D|null=object;p;p=p.parent)if(!p.visible)return false;return true;}
const nativeRoad=(o:T.Object3D)=>o instanceof T.Mesh&&ROAD_NAMES.has(o.name)&&effectiveVisible(o)&&materials(o).every(m=>m.visible&&!m.transparent&&m.opacity===1&&m.alphaTest===0&&m.name==='Island asphalt'&&m.userData.realisticSurface==='asphalt');
function owner(mesh:T.Mesh){return {mesh,geometry:mesh.geometry,material:mesh.material,compile:materials(mesh).map(m=>m.onBeforeCompile),
 key:materials(mesh).map(m=>m.customProgramCacheKey),position:mesh.geometry.getAttribute('position'),index:mesh.geometry.index,
 castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,renderOrder:mesh.renderOrder,depth:materials(mesh).map(m=>({
 id:m.uuid,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,depthWrite:m.depthWrite,depthTest:m.depthTest,depthFunc:m.depthFunc,side:m.side,blending:m.blending}))};}
function ownerReceipt(r:any){return {id:r.mesh.id,name:r.mesh.name,geometry:r.geometry.id,materials:r.depth,
 vertices:r.position.count,indices:r.index?.count??0,castShadow:r.castShadow,receiveShadow:r.receiveShadow,renderOrder:r.renderOrder};}
function assertOwners(){
 for(const r of owners){const m=r.mesh as T.Mesh;check(m.geometry===r.geometry&&m.material===r.material&&m.geometry.getAttribute('position')===r.position&&m.geometry.index===r.index,'Approach geometry/material identity changed');
  check(m.castShadow===r.castShadow&&m.receiveShadow===r.receiveShadow,'Approach shadow state changed');
  check(materials(m).every((v,i)=>v.onBeforeCompile===r.compile[i]&&v.customProgramCacheKey===r.key[i]),'Approach shader changed');
  check(same(owner(m).depth,r.depth),'Approach depth/opacity state changed');
  check(m.renderOrder===(mode==='candidate'?-103:0),'Unexpected approach order');
 }
}
const direct=renderer.renderBufferDirect;
renderer.renderBufferDirect=function(...args:Parameters<typeof direct>){
 const [viewCamera,viewScene,geometry,material,object]=args,prior={...renderer.info.render};
 const result=Reflect.apply(direct,this,args),after=renderer.info.render;
 draws.push({object:object.id,name:object.name,geometry:geometry.id,material:material.uuid,
  pass:viewScene===scene?'color':'shadow',camera:viewCamera.id,order:object.renderOrder,
  start:geometry.drawRange.start,count:Number.isFinite(geometry.drawRange.count)?geometry.drawRange.count:null,
  calls:after.calls-prior.calls,triangles:after.triangles-prior.triangles,lines:after.lines-prior.lines,points:after.points-prior.points});
 return result;
};
async function fence(){const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);check(sync,'WebGL2 GPU fence unavailable');gl.flush();const started=performance.now();
 try{for(;;){const status=gl.clientWaitSync(sync,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return;
  check(status!==gl.WAIT_FAILED&&!gl.isContextLost(),'GPU fence failed');check(performance.now()-started<90000,'GPU fence timed out');await new Promise(r=>setTimeout(r,8));}}
 finally{gl.deleteSync(sync);}}
function setMode(value:string){check(value==='baseline'||value==='candidate','Unknown mode');mode=value;for(const mesh of targets)mesh.renderOrder=mode==='candidate'?-103:0;assertOwners();}
function settings(){return {viewport:[canvas.width,canvas.height,renderer.getPixelRatio()],context:gl.getContextAttributes(),
 quality:world.quality.requested,effectiveQuality:world.quality.effective,scale:world.quality.scale,
 sourceQualityPixelRatio,fixturePixelRatio:renderer.getPixelRatio(),fixedResolutionOverride:sourceQualityPixelRatio!==renderer.getPixelRatio(),simulationTime,
 shadow:{enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type,lights:scene.children.filter((x:any)=>x.isDirectionalLight).map((x:any)=>({id:x.id,cast:x.castShadow,size:x.shadow.mapSize.toArray(),bias:x.shadow.bias,normalBias:x.shadow.normalBias}))},
 exposure:renderer.toneMappingExposure,toneMapping:renderer.toneMapping,outputColorSpace:renderer.outputColorSpace,
 hour:world.sky.hour,artStyle:world.sky.artStyle};}
function shadowMaps(){return scene.children.filter((x:any)=>x.isDirectionalLight).map((x:any)=>({id:x.id,castShadow:x.castShadow,
 intensity:x.shadow.intensity,requestedSize:x.shadow.mapSize.toArray(),allocatedSize:x.shadow.map?[x.shadow.map.width,x.shadow.map.height]:null}));}
function draw(){assertOwners();const before=renderer.info.render.frame;draws=[];renderer.render(scene,camera);assertOwners();
 check(gl.getError()===gl.NO_ERROR,'WebGL error');check(!gl.isContextLost(),'Context lost');
 return {mode,frameBefore:before,frameAfter:renderer.info.render.frame,draws:draws.slice(),camera:cameraReceipt(),settings:settings()};}
async function image(){const receipt=draw();const pixels=new Uint8Array(width*height*4);
 // Preserve the original context's preserveDrawingBuffer:false. Read pixels
 // synchronously in the rendering task, before a compositor yield can discard
 // the default framebuffer; readPixels itself waits for these pixels.
 gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);check(gl.getError()===gl.NO_ERROR,'Readback error');
 const png=canvas.toDataURL('image/png'),colors=new Set<number>();let nonzeroRgbPixels=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i]||pixels[i+1]||pixels[i+2])nonzeroRgbPixels++;if(colors.size<32)colors.add(((pixels[i]<<24)|(pixels[i+1]<<16)|(pixels[i+2]<<8)|pixels[i+3])>>>0);}
 check(nonzeroRgbPixels>width*height*.01&&colors.size>=8,'Blank or discarded framebuffer');await fence();
 return {...receipt,pixels,pixelSha256:await sha(pixels),png,content:{nonzeroRgbPixels,distinctColorsAtLeast:colors.size,readback:'same-task before compositor yield'}};}
function rawBase64(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
function delta(a:Uint8Array,b:Uint8Array){check(a.length===b.length,'RGBA length changed');let pixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let different=false;
 for(let c=0;c<4;c++){const d=Math.abs(a[i+c]-b[i+c]);different ||=d!==0;maxChannelDelta=Math.max(maxChannelDelta,d);}if(different)pixels++;}return{pixels,maxChannelDelta};}
async function measure(value:string,phase:string,index:number){
 setMode(value);check(ext,'Elapsed GPU query unavailable');if(gl.getParameter(ext.GPU_DISJOINT_EXT)){evidence.queries.disjoint=true;throw Error('Disjoint GPU query before frame');}
 const query=gl.createQuery();check(query,'GPU query allocation failed');const row:any={id:queryId++,case:currentCase.name,mode:value,phase,index,status:'pending',nanoseconds:null};
 evidence.queries.created++;evidence.queries.live++;evidence.queries.rows.push(row);let ended=false;
 try{gl.beginQuery(ext.TIME_ELAPSED_EXT,query);const receipt=draw();gl.endQuery(ext.TIME_ELAPSED_EXT);ended=true;await fence();const start=performance.now();
  while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){check(performance.now()-start<30000,'GPU query unresolved');await new Promise(r=>setTimeout(r,8));}
  if(gl.getParameter(ext.GPU_DISJOINT_EXT)){evidence.queries.disjoint=true;throw Error('Disjoint GPU query after frame');}row.nanoseconds=gl.getQueryParameter(query,gl.QUERY_RESULT);
  check(Number.isFinite(row.nanoseconds)&&row.nanoseconds>0,'Invalid elapsed GPU result');row.status='resolved';evidence.queries.resolved++;return {...receipt,query:row};
 }catch(error){row.status='failed';row.error=errorText(error);if(gl.getParameter(ext.GPU_DISJOINT_EXT))evidence.queries.disjoint=true;throw error;}
 finally{if(!ended)try{gl.endQuery(ext.TIME_ELAPSED_EXT);}catch{}gl.deleteQuery(query);evidence.queries.deleted++;evidence.queries.live--;}
}
const ready=(async()=>{
 map=await fetch('./belle/map.json').then(r=>{check(r.ok,'Original map missing');return r.json();});alignScottMap(map);prepareCoastGuardMap(map);
 for(const p of [...activityLandmarks(),...playgroundLandmarks])if(!map.landmarks.some(l=>l.id===p.id))map.landmarks.push(p);
 terrain=new ParkTerrain(map,true);world=await createWorld(scene,renderer,map,terrain,text=>evidence.preparation.push(text));
 world.sky.preview(false);world.setQuality('smooth');world.sky.tick(0,false,true);
 targets=[];scene.traverse(o=>{if(o instanceof T.Mesh&&o.name==='Graded bridge approach')targets.push(o);});
 check(targets.length===2,'Expected the two original approach meshes');owners=targets.map(owner);
 for(const r of owners){check(r.position.count===1353&&r.index?.count===7680&&r.renderOrder===0,'Original approach topology/order changed');
  check(r.depth.length===1&&r.depth[0].transparent===false&&r.depth[0].opacity===1&&r.depth[0].alphaTest===0&&r.depth[0].depthWrite&&r.depth[0].depthTest&&r.depth[0].depthFunc===T.LessEqualDepth,'Approach is not the original opaque depth surface');
  check(r.castShadow===false&&r.receiveShadow===true,'Original approach shadow policy changed');}
 const mainland=scene.children.filter(o=>o.name==='Detroit mainland'),sky=scene.getObjectByName('Belle Isle changing sky') as T.Mesh;
 check(mainland.length>0&&mainland.every(o=>o.renderOrder===0),'Actual Detroit mainland order missing');
 check(sky instanceof T.Mesh&&sky.renderOrder===-100&&(sky.material as T.Material).depthWrite===false,'Actual source sky missing');
 check(scene.children.some(o=>o.name.startsWith('Joined ground')&&o.renderOrder===-102),'Actual early ground missing');
 context={mainland:mainland.map(o=>({id:o.id,name:o.name,order:o.renderOrder})),sky:{id:sky.id,order:sky.renderOrder},
  factory:'unmodified src/belle/world.ts createWorld',targets:owners.map(ownerReceipt)};
 evidence.context=context;return context;
})();
ready.catch(error=>evidence.errors.push(errorText(error)));
function point(s:number,w:number,above=0){const b=map.bridge,ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;
 const x=b.a[0]+ux*s+uz*w,z=b.a[1]+uz*s-ux*w;return new T.Vector3(x,terrain.height(x,z)+above,z);}
function pose(index:number){
 camera.up.set(0,1,0);
 if(index===0){camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;camera.matrixWorld.fromArray(pins.observation.camera.matrixWorld);
  camera.matrix.copy(camera.matrixWorld);camera.matrixWorldInverse.copy(camera.matrixWorld).invert();camera.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);
  camera.projectionMatrix.fromArray(pins.observation.camera.projectionMatrix);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();return {name:'recorded-software-start',recorded:true};}
 camera.matrixAutoUpdate=true;camera.matrixWorldAutoUpdate=true;camera.up.set(0,1,0);
 const choices=[null,[-90,42,7,-85,32],[-12,25,5,-70,0],[-1300,800,500,-70,0],[map.bridge.length+60,-42,8,map.bridge.length+55,-32]];
 if(index<5){const p=choices[index]!;camera.position.copy(point(p[0],p[1],p[2]));camera.lookAt(point(p[3],p[4],.006));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  return{name:['','mainland-edge','mainland-near','mainland-far','island-edge'][index],recorded:false};}
 // Find a real road/deck that occludes an original approach. No substitute box
 // or depth material is introduced to make this case succeed.
 scene.updateMatrixWorld(true);const opaque:T.Object3D[]=[];scene.traverse(o=>{if(o instanceof T.Mesh&&effectiveVisible(o)&&materials(o).every(m=>m.visible&&!m.transparent&&m.opacity===1&&m.alphaTest===0))opaque.push(o);});
 for(const s of [map.bridge.length+20,map.bridge.length+40,map.bridge.length+60,-20,-50,-90]){
  const aim=point(s,0,.006),eye=aim.clone().add(new T.Vector3(0,30,0));const ray=new T.Raycaster(eye,new T.Vector3(0,-1,0));
  const hit=ray.intersectObjects(opaque,false),approach=hit.find(h=>targets.includes(h.object as T.Mesh)),front=hit[0];
  if(approach&&front&&nativeRoad(front.object)&&front.distance+.001<approach.distance){
   camera.position.copy(eye);camera.up.set(0,0,-1);camera.lookAt(aim);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   return{name:'real-road-occlusion',recorded:false,occlusion:{front:{id:front.object.id,name:front.object.name,distance:front.distance,ownerKind:'source-asphalt-road',effectiveVisible:true,
    materials:materials(front.object as T.Mesh).map(m=>({name:m.name,surface:m.userData.realisticSurface,visible:m.visible}))},approach:{id:approach.object.id,distance:approach.distance}}};
  }
 }
 throw Error('No real opaque road/approach occlusion found');
}
async function prepare(index:number){await ready;check(Number.isInteger(index)&&index>=0&&index<14,'Unknown case');setMode('baseline');
 const extra=index>=12,p=extra?(index===12?0:5):Math.floor(index/2),night=extra?index===12:index%2===1,quality=extra?'high':'smooth';
 const setup=pose(p);world.setQuality('smooth');world.setQuality(quality);sourceQualityPixelRatio=renderer.getPixelRatio();renderer.setPixelRatio(1);renderer.setSize(width,height,false);
 // Full resolution is fixed for both fixture modes, including supplemental
 // High shadow correctness cases. No production quality policy is modified.
 world.sky.configure({hour:night?22:13,cycle:false,clouds:'scattered'});world.sky.tick(0,false,true);
 simulationTime=12+index;world.update(simulationTime,camera.position.x,camera.position.z,camera,false,false);await world.sky.prepareReflections(camera,camera.position.x,camera.position.z);
 scene.updateMatrixWorld(true);await renderer.compileAsync(scene,camera);await fence();
 currentCase={index,name:setup.name+(night?'-night':'-day')+'-'+quality,pose:setup,night,quality,
  timing:!extra,camera:cameraReceipt(),settings:settings(),context,owners:owners.map(ownerReceipt),proof:[],samples:[]};
 proofReference=undefined;evidence.cases.push(currentCase);
 // Consume the original source's scheduled map update once, retaining this
 // native preparation pass. Subsequent ABBA frames use its naturally cached
 // maps; no shadow update is forced and no first-pass work is discarded.
 currentCase.nativePreparation={...draw(),shadowMaps:shadowMaps()};await fence();
 if(quality==='high'){check(currentCase.nativePreparation.draws.some((d:any)=>d.pass==='shadow'&&d.calls>0&&d.triangles>0),'High preparation has no native shadow casters');
  check(currentCase.nativePreparation.shadowMaps.some((s:any)=>s.castShadow&&s.intensity>0&&s.allocatedSize?.[0]>0&&s.allocatedSize?.[1]>0),'High native shadow map not allocated');}
 if('occlusion' in setup&&setup.occlusion){const roadId=setup.occlusion.front.id;check(currentCase.nativePreparation.draws.some((d:any)=>d.pass==='color'&&d.object===roadId&&d.calls>0),'Selected source road did not render');}
 return {name:currentCase.name,timing:!extra};
}
async function proofImage(index:number){check(currentCase&&index===currentCase.proof.length&&index<4,'Proof images must be collected in order');
 setMode(['baseline','candidate','candidate','baseline'][index]);const {pixels,png,...receipt}=await image();if(index===0)proofReference=pixels;
 const row={...receipt,index,difference:delta(proofReference!,pixels)};currentCase.proof.push(row);
 currentCase.proofPassed=currentCase.proof.length===4&&currentCase.proof.every((r:any)=>r.difference.pixels===0&&r.difference.maxChannelDelta===0);
 return {...row,png,rawRgbaBase64:rawBase64(pixels),rawLayout:'RGBA8 bottom-up; unmodified gl.readPixels'};
}
async function timing(){check(currentCase?.timing,'Case is correctness only');
 const warm=['baseline','candidate','candidate','baseline'];
 const measured=[...warm,...['candidate','baseline','baseline','candidate'],...warm,...['candidate','baseline','baseline','candidate']];
 for(const [phase,order]of [['warmup',warm],['measured',measured]] as const)for(let i=0;i<order.length;i++){const sample=await measure(order[i],phase,i);currentCase.samples.push(sample);}
 return {name:currentCase.name,samples:currentCase.samples.length};
}
const wrap=(fn:Function)=>async(...args:any[])=>{try{return await fn(...args);}catch(error){evidence.errors.push(errorText(error));throw error;}finally{setMode('baseline');}};
(window as any).__approachOrder={ready:()=>ready,prepare:wrap(prepare),proofImage:wrap(proofImage),timing:wrap(timing),read:()=>evidence};
