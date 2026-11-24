import * as T from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {WorldAtmosphere} from '../src/belle/worldAtmosphere.ts';
import {LandmarkDetail} from '../src/belle/landmarkDetail.ts';
import {addReferenceIsland} from '../src/belle/referenceIsland.ts';
import {ParkTerrain,type ParkMap} from '../src/belle/terrain.ts';
// @ts-expect-error The standalone driver extracts the exact baseline world spans.
import * as baselineImport from 'virtual:belle-macarthur-world-baseline';
// @ts-expect-error The standalone driver extracts the exact proposed world spans.
import * as candidateImport from 'virtual:belle-macarthur-world-candidate';

export type Side='baseline'|'candidate';
export type BridgeMesh=T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
export const warmName='MacArthur_Higgsfield_•_warm_limestone';
export const eligibleNames=[
 'MacArthur_MacArthur_galvanized_crash_barrier',
 'MacArthur_MacArthur_sidewalk_expansion_joints',
 'MacArthur_Painted_steel_glazing_bars',
 'MacArthur_Patinated_bronze'
] as const;
export const focus=new T.Vector3(264,8,467);
export const lightOffsets=[[60,110,45],[-60,110,-45]] as const;
export const cameraOffsets=[[54,72,42],[-54,72,-42]] as const;
type Receipt={geometry:T.BufferGeometry;material:T.Material;compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey']};
type Construction={initial:(scene:T.Scene,landmarks:GLTF)=>unknown;dress:(scene:T.Scene)=>void;capture:(landmarks:GLTF)=>Map<T.Mesh,Receipt>|undefined;cull:(landmarks:GLTF,receipts:Map<T.Mesh,Receipt>|undefined)=>void};
export type Input={geometry:T.BufferGeometry;attributes:Record<string,T.BufferAttribute|T.InterleavedBufferAttribute>;index:T.BufferAttribute;material:T.MeshStandardMaterial;compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey'];raycast:T.Mesh['raycast'];matrixWorld:number[];rays:ReturnType<typeof rayEvidence>};
export type Owner={side:Side;scene:T.Scene;landmarks:GLTF;atmosphere:WorldAtmosphere;detail:LandmarkDetail;referenceGarden:Awaited<ReturnType<typeof addReferenceIsland>>;meshes:BridgeMesh[];eligible:BridgeMesh[];warm:BridgeMesh;inputs:Map<BridgeMesh,Input>;receipts:Map<T.Mesh,Receipt>|undefined;receiver:T.Mesh<T.PlaneGeometry,T.MeshStandardMaterial>;sun:T.DirectionalLight;constructionStats:unknown};

export function assert(value:unknown,message:string):asserts value{if(!value)throw Error(message);}
function hitValue(hit:T.Intersection){return {distance:hit.distance,point:hit.point.toArray(),faceIndex:hit.faceIndex??null,face:hit.face?{a:hit.face.a,b:hit.face.b,c:hit.face.c,materialIndex:hit.face.materialIndex}:null};}
export function rayEvidence(mesh:BridgeMesh,probes?:{origin:number[];direction:number[]}[]){
 const geometry=mesh.geometry,index=geometry.index,position=geometry.attributes.position;assert(index,'Actual bridge index missing');
 const rays=probes??[];
 if(!probes){
  // Sample real triangles through the length of each authored mesh. Degenerate
  // cap triangles are skipped, never replaced by synthetic geometry.
  for(const fraction of [0,.25,.5,.75]){
   let start=Math.floor(index.count*fraction/3)*3,found=false;
   for(;start+2<index.count&&!found;start+=3){
    const a=new T.Vector3().fromBufferAttribute(position,index.getX(start)),b=new T.Vector3().fromBufferAttribute(position,index.getX(start+1)),c=new T.Vector3().fromBufferAttribute(position,index.getX(start+2));
    const normal=b.clone().sub(a).cross(c.clone().sub(a));if(normal.lengthSq()<1e-12)continue;
    normal.normalize().transformDirection(mesh.matrixWorld);
    const middle=a.add(b).add(c).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld),origin=middle.clone().addScaledVector(normal,3),direction=normal.negate();
    const ray=new T.Raycaster(origin,direction,0,6),hits:T.Intersection[]=[];mesh.raycast(ray,hits);
    if(hits.length){rays.push({origin:origin.toArray(),direction:direction.toArray()});found=true;}
   }
   assert(found,'No nondegenerate authored ray hit for '+mesh.name);
  }
 }
 return rays.map(({origin,direction})=>{
  const ray=new T.Raycaster(new T.Vector3().fromArray(origin),new T.Vector3().fromArray(direction),0,6),hits:T.Intersection[]=[];mesh.raycast(ray,hits);
  hits.sort((a,b)=>a.distance-b.distance||(a.faceIndex??0)-(b.faceIndex??0));
  return {origin,direction,hits:hits.map(hitValue)};
 });
}

/** Actual shipped asset, decorators, asynchronous construction boundary and
 * span culler. Only presentation after construction is bounded to five meshes.
 * All unused scene objects and their owned resources remain alive. */
export async function createOwner(side:Side,asset:ArrayBuffer,map:ParkMap,cloud:T.Texture):Promise<Owner>{
 const construction=(side==='baseline'?baselineImport:candidateImport) as Construction;
 const landmarks=await new GLTFLoader().parseAsync(asset.slice(0),'/belle/');
 const scene=new T.Scene();scene.background=new T.Color('#293746');scene.fog=new T.FogExp2(0xb8c4c9,.00012);
 const atmosphere=new WorldAtmosphere(scene,cloud),constructionStats=construction.initial(scene,landmarks);
 await Promise.resolve();construction.dress(scene);
 const receipts=construction.capture(landmarks);
 assert(side==='baseline'?receipts===undefined:receipts?.size===4,'Actual world receipt cohort changed');
 const referenceGarden=await addReferenceIsland(scene,map,new ParkTerrain(map));
 const detail=new LandmarkDetail(landmarks);await detail.prepareDistant(scene);await Promise.resolve();
 assert(detail.stats.simplified>0,'Actual LandmarkDetail/Meshopt preparation did not run');
 const meshes:BridgeMesh[]=[];
 landmarks.scene.traverse(object=>{
  if(!(object instanceof T.Mesh)||!/^MacArthur[ _]/.test(object.name))return;
  assert(!Array.isArray(object.material)&&object.material instanceof T.MeshStandardMaterial,'Unexpected actual MacArthur material');
  meshes.push(object as BridgeMesh);
 });
 assert(meshes.length===5,'Actual asset must contain exactly five MacArthur meshes');
 const warm=meshes.find(mesh=>mesh.name===warmName);assert(warm&&warm.geometry.hasAttribute('uv')&&warm.material.map,'Actual mapped limestone missing');
 const eligible=eligibleNames.map(name=>{const mesh=meshes.find(value=>value.name===name);assert(mesh,'Missing actual caster '+name);return mesh;});
 scene.updateMatrixWorld(true);
 const inputs=new Map<BridgeMesh,Input>();
 for(const mesh of meshes){
  const material=mesh.material,geometry=mesh.geometry;assert(geometry.index,'Actual authored index missing');
  inputs.set(mesh,{geometry,attributes:{...geometry.attributes},index:geometry.index,material,compile:material.onBeforeCompile,key:material.customProgramCacheKey,raycast:mesh.raycast,matrixWorld:mesh.matrixWorld.toArray(),rays:rayEvidence(mesh)});
  if(mesh!==warm)assert(!geometry.hasAttribute('uv')&&!material.map&&!mesh.customDepthMaterial&&!mesh.customDistanceMaterial,'Opaque missing-UV input changed');
 }
 if(receipts)for(const [mesh,receipt]of receipts){
  assert(mesh.geometry===receipt.geometry&&mesh.material===receipt.material&&receipt.material.onBeforeCompile===receipt.compile&&receipt.material.customProgramCacheKey===receipt.key,'Queued construction invalidated actual world receipt');
 }
 // Instrumentation is deliberately later than this call: the product rejects
 // non-default object render/shadow callbacks when deciding eligibility.
 construction.cull(landmarks,receipts);
 let addedBytes=0;
 for(const mesh of meshes){
  const input=inputs.get(mesh)!;assert(mesh.geometry!==input.geometry,'Actual span culler did not create a display');
  assert(mesh.material===input.material&&mesh.material.onBeforeCompile===input.compile&&mesh.material.customProgramCacheKey===input.key,'Culling changed a material callback or key');
  assert(mesh.geometry.boundingBox===input.geometry.boundingBox&&mesh.geometry.boundingSphere===input.geometry.boundingSphere,'Original bound sharing changed');
  for(const [name,attribute]of Object.entries(input.attributes))assert(mesh.geometry.getAttribute(name)===attribute,'Original attribute identity changed: '+name);
  assert(input.geometry.index===input.index&&JSON.stringify(mesh.matrixWorld.toArray())===JSON.stringify(input.matrixWorld),'Source index or transform changed');
  const uv=mesh.geometry.getAttribute('uv');
  if(mesh===warm)assert(uv===input.attributes.uv,'Authored limestone UV identity changed');
  else if(side==='baseline')assert(!uv,'Baseline display acquired a UV');
  else{assert(uv instanceof T.BufferAttribute&&uv.array instanceof Float32Array&&uv.itemSize===2&&!uv.normalized&&uv.count===mesh.geometry.attributes.position.count&&uv.array.every(value=>Object.is(value,0)),'Candidate display UV is not the exact zero vec2 storage');addedBytes+=uv.array.byteLength;}
  assert(JSON.stringify(rayEvidence(mesh,input.rays))===JSON.stringify(input.rays),'Actual authored ray hits changed');
 }
 assert(addedBytes===(side==='candidate'?1668768:0),'Unexpected display UV allocation');
 // Retain the complete constructed scene but render the actual bridge cohort.
 scene.traverse(object=>{if(object instanceof T.Mesh)object.visible=meshes.includes(object as BridgeMesh);});
 const receiver=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshStandardMaterial({name:'Native MacArthur receiver',color:0x92958d,roughness:.82,metalness:0}));
 receiver.rotation.x=-Math.PI/2;receiver.position.set(focus.x,0,focus.z);receiver.receiveShadow=true;receiver.castShadow=false;
 const ambient=new T.HemisphereLight(0xd5e8f8,0x63513a,1.3),sun=new T.DirectionalLight(0xffdfb0,2.1);
 sun.castShadow=true;sun.shadow.mapSize.set(256,256);sun.shadow.bias=-.00003;sun.shadow.normalBias=.035;
 Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:400});
 scene.add(receiver,ambient,sun,sun.target);await Promise.resolve();atmosphere.flush();scene.updateMatrixWorld(true);
 return {side,scene,landmarks,atmosphere,detail,referenceGarden,meshes,eligible,warm,inputs,receipts,receiver,sun,constructionStats};
}
