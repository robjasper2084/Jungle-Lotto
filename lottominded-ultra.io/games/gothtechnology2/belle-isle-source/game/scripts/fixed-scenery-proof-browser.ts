import * as T from 'three';
import {addStreetDetails} from '../src/belle/streetDetails.ts';
import {addGardens} from '../src/belle/gardens.ts';
import {addLakeHabitat} from '../src/belle/lakeHabitat.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from '../src/belle/realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from '../src/belle/photoReferenceSurfaces.ts';
import {dressSunsetGround} from '../src/belle/sunsetGround.ts';
import type {StreetPlan} from '../src/belle/streetPlan.ts';
import type {GardenPlan} from '../src/belle/gardenPlan.ts';
import type {LakeHabitatPlan} from '../src/belle/lakeHabitatPlan.ts';

// This fixture isolates the fixed local transforms. It does not install either
// shared-geometry wrapper, change the game or replace its native ride gates.
const width=960,height=600,windTime=14.25;
const canvas=document.querySelector('canvas')!;
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,outputBufferType:T.UnsignedByteType});
renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(58,width/height,.1,1200);
scene.background=new T.Color(0x738ba0);scene.fog=new T.FogExp2(0x879394,.00012);
const ambient=new T.HemisphereLight(0xd8e4f1,0x465443,2.1);scene.add(ambient);
const sun=new T.DirectionalLight(0xffefdc,3);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;
sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.camera.near=1;sun.shadow.camera.far=220;
sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const lamp=new T.PointLight(0x8cbcff,500,80,2);scene.add(lamp);
const ground=new T.Mesh(new T.PlaneGeometry(12000,12000),new T.MeshStandardMaterial({color:0x676b67,roughness:.95}));
ground.rotation.x=-Math.PI/2;ground.position.y=1.95;ground.receiveShadow=true;scene.add(ground);
const caster=new T.Mesh(new T.BoxGeometry(1.2,2.4,1.2),new T.MeshStandardMaterial({color:0x8f8070,roughness:.8}));
caster.castShadow=true;caster.receiveShadow=true;scene.add(caster);
const gl=renderer.getContext() as WebGL2RenderingContext;
if(typeof gl.fenceSync!=='function')throw Error('The pixel proof requires WebGL2');
const requireTrue=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),b=>b.toString(16).padStart(2,'0')).join('');
const matrixBytes=(values:number[])=>new Uint8Array(new Float64Array(values).buffer);
function base64(bytes:Uint8Array){let text='';for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(text);}
function changedPixels(a:Uint8Array,b:Uint8Array){
 requireTrue(a.length===b.length,'Pixel dimensions differ');let changed=0,maxDelta=0;
 for(let i=0;i<a.length;i+=4){let differs=false;for(let c=0;c<4;c++){const delta=Math.abs(a[i+c]-b[i+c]);if(delta)differs=true;maxDelta=Math.max(maxDelta,delta);}if(differs)changed++;}
 return {changed,maxDelta};
}
async function fence(){
 const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);requireTrue(sync,'GPU fence unavailable');gl.flush();const start=performance.now();
 try{while(true){const state=gl.clientWaitSync(sync!,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return;
  if(state===gl.WAIT_FAILED||gl.isContextLost())throw Error('GPU fence failed');
  if(performance.now()-start>30000)throw Error('GPU fence exceeded 30 seconds');
  await new Promise(ok=>setTimeout(ok,8));}}
 finally{gl.deleteSync(sync);}
}
async function readRendered(){
 await fence();const rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
 requireTrue(gl.getError()===gl.NO_ERROR,'GPU readback failed');
 return {rgba,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,png:canvas.toDataURL('image/png')};
}
type Family={name:string;roots:T.Object3D[];nodes:T.Object3D[]};
function ownedFamily(name:string,before:Set<T.Object3D>):Family{
 const roots=scene.children.filter(o=>!before.has(o)),nodes:T.Object3D[]=[];
 for(const root of roots)root.traverse(o=>nodes.push(o));
 requireTrue(nodes.length>0,name+' has no shipped scene objects');
 requireTrue(nodes.every(o=>!o.matrixAutoUpdate&&o.matrixWorldAutoUpdate),name+' contains an unexpected transform policy');
 return {name,roots,nodes};
}
async function json<T>(path:string):Promise<T>{const response=await fetch(path);requireTrue(response.ok,'Missing shipped plan '+path);return response.json();}
const init=(async()=>{
 const plan=await json<StreetPlan&{stride:number;materials:string[]}>('/belle/street-details.json');
 const response=await fetch('/belle/street-details.bin');requireTrue(response.ok,'Missing shipped street geometry');
 const bytes=await response.arrayBuffer(),boxes=new Float32Array(bytes);plan.boxes=[];
 for(let i=0;i<boxes.length;i+=plan.stride)plan.boxes.push({x:boxes[i],y:boxes[i+1],z:boxes[i+2],w:boxes[i+3],h:boxes[i+4],l:boxes[i+5],yaw:boxes[i+6],material:plan.materials[boxes[i+7]] as typeof plan.boxes[number]['material'],grade:boxes[i+8]});
 let before=new Set(scene.children);const street=addStreetDetails(scene,plan),streetFamily=ownedFamily('street',before);
 before=new Set(scene.children);const gardens=await addGardens(scene),gardenFamily=ownedFamily('garden',before);
 before=new Set(scene.children);const lake=await addLakeHabitat(scene),lakeFamily=ownedFamily('lake',before);
 const families=[streetFamily,gardenFamily,lakeFamily],cached=families.flatMap(f=>f.nodes);
 await loadRealisticMaterials(renderer);applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);
 gardens.setQuality('high');gardens.animate(windTime);
 const plants=(await json<GardenPlan>('/belle/nature/gardens.json')).plants;
 const okonoka=await json<LakeHabitatPlan>('/belle/nature/okonoka.json'),heron=await json<LakeHabitatPlan>('/belle/nature/heron.json');
 const generic=plants.find(p=>!p.form)!,botanical=plants.find(p=>!!p.form)!;
 const streetAnchor=(x:number,z:number)=>plan.boxes.filter(b=>b.material==='curb').reduce((best,b)=>Math.hypot(b.x-x,b.z-z)<Math.hypot(best.x-x,best.z-z)?b:best);
 const west=streetAnchor(800,500),conservatory=streetAnchor(1330,1175),log=okonoka.logs[0],rock=heron.rocks[0];
 requireTrue(generic&&botanical&&log&&rock,'Representative shipped anchor missing');
 const poses=[
  {name:'street-west',family:streetFamily,x:west.x,z:west.z,y:west.y,distance:24,yaw:.8},
  {name:'street-conservatory',family:streetFamily,x:conservatory.x,z:conservatory.z,y:conservatory.y,distance:24,yaw:2.1},
  {name:'garden-formal',family:gardenFamily,x:generic.x,z:generic.z,y:generic.y,distance:9,yaw:.8},
  {name:'garden-botanical',family:gardenFamily,x:botanical.x,z:botanical.z,y:botanical.y,distance:9,yaw:2.1},
  {name:'lake-okonoka',family:lakeFamily,x:(log.a[0]+log.b[0])/2,z:(log.a[2]+log.b[2])/2,y:1.1,distance:12,yaw:.8},
  {name:'lake-heron',family:lakeFamily,x:rock.x,z:rock.z,y:rock.y,distance:12,yaw:-2.5},
 ];
 const debug=gl.getExtension('WEBGL_debug_renderer_info'),gpu=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
 return {street,gardens,lake,families,cached,poses,gpu,sourceGeometrySha256:await hash(new Uint8Array(bytes))};
})();
function effectiveVisible(object:T.Object3D){for(let p:T.Object3D|null=object;p;p=p.parent)if(!p.visible)return false;return true;}
function geometryReceipt(cached:T.Object3D[],family:Family,x:number,z:number){
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const matrices=cached.flatMap(o=>[...o.matrix.elements,...o.matrixWorld.elements]);
 const membership=cached.filter(o=>(o as T.Mesh).isMesh).map(o=>({id:o.id,visible:effectiveVisible(o),layer:o.layers.test(camera.layers),frustum:frustum.intersectsObject(o)}));
 const raycaster=new T.Raycaster(),rays:unknown[]=[],offsets=[-.18,-.06,0,.06,.18];let hitCount=0;
 for(const dx of offsets)for(const dz of offsets){
  raycaster.set(new T.Vector3(x+dx,15,z+dz),new T.Vector3(0,-1,0));raycaster.far=20;
  const hits=raycaster.intersectObjects(family.roots,true);hitCount+=hits.length;
  rays.push(hits.map(h=>({object:h.object.id,instance:h.instanceId??null,faceIndex:h.faceIndex??null,distance:h.distance,
   point:h.point.toArray(),uv:h.uv?.toArray()??null,uv1:h.uv1?.toArray()??null,normal:h.normal?.toArray()??null,
   face:h.face?{a:h.face.a,b:h.face.b,c:h.face.c,normal:h.face.normal.toArray(),materialIndex:h.face.materialIndex}:null})));
 }
 return {matrices,membership,rays,hitCount,worldAutoUpdate:cached.every(o=>o.matrixWorldAutoUpdate)};
}
(window as unknown as {__fixedSceneryProof:()=>Promise<unknown>}).__fixedSceneryProof=async()=>{
 const {street,gardens,lake,families,cached,poses,gpu,sourceGeometrySha256}=await init;
 const rows:Record<string,unknown>[]=[],images:{name:string;png:string}[]=[],geometryReceipts:unknown[]=[];
 for(const pose of poses)for(const night of [false,true]){
  const name=pose.name+(night?'-night':'-day');
  street.update(pose.x,pose.z);gardens.update(pose.x,pose.z);lake.update(pose.x,pose.z);gardens.animate(windTime);
  camera.position.set(pose.x-Math.sin(pose.yaw)*pose.distance,pose.y+pose.distance*.32,pose.z-Math.cos(pose.yaw)*pose.distance);
  camera.lookAt(pose.x,pose.y+.3,pose.z);camera.updateMatrixWorld(true);
  ground.position.y=pose.family.name==='lake'?.95:1.95;
  sun.position.set(pose.x-35,75,pose.z+35);sun.target.position.set(pose.x,pose.y,pose.z);
  sun.intensity=night?.28:3;ambient.intensity=night?.22:2.1;lamp.intensity=night?400:0;
  lamp.position.set(pose.x-4,pose.y+5,pose.z+4);caster.position.set(pose.x+3,ground.position.y+1.2,pose.z-1);
  scene.background=new T.Color(night?0x101b31:0x738ba0);scene.updateMatrixWorld(true);
  await renderer.compileAsync(scene,camera);
  const paired=[];
  for(const automatic of [true,false]){
   for(const object of cached)object.matrixAutoUpdate=automatic;
   renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
   const rendered=await readRendered(),geometry=geometryReceipt(cached,pose.family,pose.x,pose.z);
   paired.push({rendered,geometry,matrixSha256:await hash(matrixBytes(geometry.matrices))});
  }
  const [baseline,candidate]=paired,diff=changedPixels(baseline.rendered.rgba,candidate.rendered.rgba);
  const exactMatrices=baseline.geometry.matrices.every((value,index)=>Object.is(value,candidate.geometry.matrices[index]));
  const exactFrustum=JSON.stringify(baseline.geometry.membership)===JSON.stringify(candidate.geometry.membership);
  const exactRaycasts=JSON.stringify(baseline.geometry.rays)===JSON.stringify(candidate.geometry.rays)&&baseline.geometry.hitCount===candidate.geometry.hitCount;
  geometryReceipts.push({name,matrixNodeOrder:cached.map(o=>o.id),matrixLayout:'local16/world16 Float64 values per node',
   matrixByteOrder:new Uint8Array(new Uint16Array([1]).buffer)[0]===1?'little-endian':'big-endian',
   baseline:{matrixFloat64Base64:base64(matrixBytes(baseline.geometry.matrices)),frustum:baseline.geometry.membership,rays:baseline.geometry.rays,hitCount:baseline.geometry.hitCount},
   candidate:{matrixFloat64Base64:base64(matrixBytes(candidate.geometry.matrices)),frustum:candidate.geometry.membership,rays:candidate.geometry.rays,hitCount:candidate.geometry.hitCount}});
  const rootVisibility=pose.family.roots.map(o=>o.visible);
  for(const root of pose.family.roots)root.visible=false;
  renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);const hidden=await readRendered();
  pose.family.roots.forEach((root,index)=>{root.visible=rootVisibility[index];});
  sun.castShadow=false;renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);const noShadow=await readRendered();
  sun.castShadow=true;renderer.shadowMap.needsUpdate=true;
  const visiblePixels=changedPixels(baseline.rendered.rgba,hidden.rgba).changed,shadowPixels=changedPixels(baseline.rendered.rgba,noShadow.rgba).changed;
  const visibilityRestored=pose.family.roots.every((o,index)=>o.visible===rootVisibility[index]);
  rows.push({name,family:pose.family.name,width,height,windTime,changedPixels:diff.changed,maxChannelDelta:diff.maxDelta,
   baselineRgbaSha256:await hash(baseline.rendered.rgba),candidateRgbaSha256:await hash(candidate.rendered.rgba),
   baselineMatrixSha256:baseline.matrixSha256,candidateMatrixSha256:candidate.matrixSha256,
   exactMatrices,exactFrustum,exactRaycasts,raycastHits:baseline.geometry.hitCount,
   nativeFrustumObjects:baseline.geometry.membership.length,nativeFrustumVisibleObjects:baseline.geometry.membership.filter(o=>o.visible&&o.layer&&o.frustum).length,
   baselineCalls:baseline.rendered.calls,candidateCalls:candidate.rendered.calls,baselineTriangles:baseline.rendered.triangles,candidateTriangles:candidate.rendered.triangles,
   visibleFamilyPixels:visiblePixels,visibleShadowPixels:shadowPixels,visibilityRestored,
   baselineWorldAutoUpdate:baseline.geometry.worldAutoUpdate,candidateWorldAutoUpdate:candidate.geometry.worldAutoUpdate,
   passed:diff.changed===0&&exactMatrices&&exactFrustum&&exactRaycasts&&baseline.geometry.hitCount>0&&visiblePixels>0&&shadowPixels>0&&visibilityRestored&&
    baseline.geometry.worldAutoUpdate&&candidate.geometry.worldAutoUpdate&&baseline.rendered.calls===candidate.rendered.calls&&baseline.rendered.triangles===candidate.rendered.triangles&&baseline.rendered.triangles>0});
  images.push({name:name+'-baseline',png:baseline.rendered.png},{name:name+'-candidate',png:candidate.rendered.png},
   {name:name+'-family-hidden-control',png:hidden.png},{name:name+'-shadow-off-control',png:noShadow.png});
 }
 return {gpu,threeRevision:T.REVISION,sourceGeometrySha256,cachedNodes:cached.length,
  families:families.map(f=>({name:f.name,roots:f.roots.length,nodes:f.nodes.length,names:f.nodes.map(o=>({id:o.id,name:o.name,type:o.type}))})),
  rows,images,geometryReceipts,passed:rows.length===12&&rows.every(row=>row.passed),
  scope:'Same-context pixel, matrix, native frustum, CPU-raycast and submission equivalence for exact shipped street/garden/lake objects. Only their local matrixAutoUpdate flag differs; world matrix updates stay native.',
  limitations:['This targeted fixture is not full-game native riding performance, complete visual acceptance or device certification.','The pair reuses candidate-constructed objects and tests their subsequent native updates; constructor callback timing is outside this fixture.','Shared-geometry wrapper arithmetic is outside this fixture.','Raycasts use the original CPU geometry and do not apply GPU garden wind; both alternatives use identical geometry and fixed shader time.','An ordinary fixture caster supplies the positive shadow control.']};
};
