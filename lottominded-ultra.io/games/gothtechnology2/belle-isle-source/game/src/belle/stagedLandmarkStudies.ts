/**
 * EXPLICIT STAGING BUILD ONLY. No production default, height re-projection, or collider change.
 * Tests and art review must pass before anyone enables this in a live build.
 */
import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {excludeWaterfrontSkylineSites} from './waterfrontSkyline.ts';

export type SiteId = '107310050' | '107227742';
export type StudyDefinition = Readonly<{
  id: SiteId; name: string; center: readonly [number,number]; yaw: number;
  files: readonly [string,string,string]; hashes: readonly [string,string,string];
}>;

export const STUDY_SITES: readonly StudyDefinition[] = [
  {id:'107310050',name:'Anna Scripps Whitcomb Conservatory (STAGED)',center:[1330.8,1174.7],yaw:.313,
   files:['Conservatory_Architectural_Study.glb','Conservatory_Architectural_Study_LOD1.glb','Conservatory_Architectural_Study_LOD2.glb'],
   hashes:['d4ca492b0c5d07f90c7e8a1e3a6369811e6fe765f15c73f707bd34c9d55f1ae2','6dc9148964da3db834563cefa68aa22883eef051bea15136b9f72ad3d614e20f','361951febb39f9b148b7298c10294d2a4c12590847b0021394fcbc4a24b5804e']},
  {id:'107227742',name:'Belle Isle Aquarium (STAGED)',center:[1363.78,1167.42],yaw:-2.828592653589793,
   files:['Aquarium_Arched_Entrance_Study.glb','Aquarium_Arched_Entrance_Study_LOD1.glb','Aquarium_Arched_Entrance_Study_LOD2.glb'],
   hashes:['26447779b20c5bbd2ab1ee6eb3dc1489333722e045400697c40a32cae3c69b93','51d265f0a664ac896c8c23eb50b51f39ff52eeb2adbbc252ed16340c419e3ad9','4295c700ff745bf9c413d78f3e58997f2abc5da22665ee4515bedcd72db3c554']},
] as const;

// Exact authored nodes in landmarks.glb: tank backings, walking surfaces,
// circulation rails, low timber furnishings and the centers of retained lilies.
const retainedLegacyDetails=new Set([
 '107227742_Aquarium illuminated habitat','107227742_Aquarium aged handrails',
 '107227742_Aquarium worn step nosings','107310050_Conservatory concrete paving',
 '107310050_Timber','107310050_Water lily golden heart',
]);

/** Match authored and GLTFLoader node names without renaming actual objects. */
export function legacyDetailName(id:SiteId,name:string){
 return name.startsWith(id+'_')?name.slice(id.length+1).replace(/_/g,' '):null;
}

/** Exterior-only replacement: preserve the original walkable interior and garden. */
export function replaceableLegacyMesh(id:SiteId,name:string):boolean {
 // GLTFLoader sanitizes authored spaces to underscores before installation.
 // Normalize only the detail suffix; keep the exact site identifier gate.
 const detail=legacyDetailName(id,name);
 if(detail===null)return false;
 if(retainedLegacyDetails.has(id+'_'+detail))return false;
 if(id==='107310050')return !/(leaf|flower|orchid|palm bark|botanical|koi|pond|garden|soil|pot|fern|tufa|plant|monument|bench|label)/i.test(detail);
 return !/(tank|aquatic plant|river gravel|warm pendant|jade glazed|black glazed|mosaic floor|gallery|fish|interior)/i.test(detail);
}

function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
async function loadVerified(loader:GLTFLoader,name:string,expected:string){
 if(!/^[a-f0-9]{64}$/.test(expected)) throw Error('Missing SHA-256 contract for '+name);
 const url='./belle/staged-architecture/'+encodeURIComponent(name);
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error('Staged GLB unavailable: '+name+' HTTP '+response.status);
 const raw=await response.arrayBuffer();
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)throw Error('Crypto SHA-256 unavailable; refusing unchecked GLB');
 const hash=hex(await subtle.digest('SHA-256',raw));
 if(hash!==expected)throw Error('Staged GLB hash mismatch: '+name);
 const gltf=await loader.parseAsync(raw,'./belle/staged-architecture/');
 if(!gltf.scene.children.length)throw Error('Empty staged GLB: '+name);
 return gltf.scene;
}

/**
 * Transactional: prefetch and check every LOD before hiding any original mesh.
 * This is an opt-in experimental visual replacement; NOT acceptance of collision
 * parity or measured architectural height. Existing offscreen/collision layouts
 * remain authoritative and must be reconciled before a production deployment.
 */
export async function installStagedLandmarkStudies(loader:GLTFLoader, landmarkRoot:T.Object3D,skylineRoot?:T.Group){
 const ready:{spec:StudyDefinition;lod:T.LOD;originals:T.Object3D[]}[]=[];
 for(const spec of STUDY_SITES){
  const candidates:T.Object3D[]=[];
  landmarkRoot.traverse(o=>{if((o as T.Mesh).isMesh&&replaceableLegacyMesh(spec.id,o.name))candidates.push(o);});
  if(!candidates.length)throw Error('No replaceable legacy facade found for '+spec.name);
  const lod=new T.LOD();lod.name=spec.id+'_STAGED_LODS';lod.position.set(spec.center[0],2,spec.center[1]);lod.rotation.y=spec.yaw;
  for(let i=0;i<3;i++){
   const root=await loadVerified(loader,spec.files[i],spec.hashes[i]);
   root.name=spec.id+'_STAGED_LOD'+i;
   root.visible=i===0; // LOD.update selects one level before each real render
   root.traverse(o=>{if(o instanceof T.Mesh){
    o.geometry.computeBoundingSphere();o.receiveShadow=true;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    // The authored glass uses BLEND. Casting an opaque pane shadow would make
    // the restored Palm House and its accessible entrance look sealed.
    o.castShadow=!materials.some(m=>m.transparent||m.opacity<1);
   }});
   lod.addLevel(root,[0,180,480][i],.12);
  }
  ready.push({spec,lod,originals:candidates});
 }
 // Do not delete geometry or reparent the old scene to prepare a replacement.
 // Explicit detach rather than hide: static architecture batching and future
 // distance culling cannot reactivate removed facades.
 const removed:{child:T.Object3D;parent:T.Object3D;index:number}[]=[],parentOrders=new Map<T.Object3D,T.Object3D[]>();
 let skyline:ReturnType<typeof excludeWaterfrontSkylineSites>|undefined,active=true,sealed=false;
 const listeners:(()=>void)[]=[];
 const ownedNodes=ready.flatMap(entry=>{const nodes:T.Object3D[]=[];entry.lod.traverse(o=>nodes.push(o));return nodes;});
 const geometryOwners=ownedNodes.filter((o):o is T.Mesh=>o instanceof T.Mesh).map(mesh=>({mesh,geometry:mesh.geometry}));
 let hierarchy:{node:T.Object3D;parent:T.Object3D|null}[]=[],materialOwners:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[];
 function rollback(){
  if(!active)return;active=false;for(const stop of listeners.splice(0))stop();
  skyline?.rollback();
  for(const entry of ready)entry.lod.removeFromParent();
  // Restoring the actual original draw owners also lets the batch's ancestor
  // membership guard retire detached staged sources on the next real render.
  for(const {child,parent,index}of [...removed].sort((a,b)=>a.index-b.index)){if(child.parent&&child.parent!==parent)continue;if(!child.parent)parent.add(child);const at=parent.children.indexOf(child);if(at!==index){parent.children.splice(at,1);parent.children.splice(Math.min(index,parent.children.length),0,child);}}
 }
 function watch(object:T.Object3D|T.Material|T.BufferGeometry,type:'removed'|'dispose'){
  const events=object as T.EventDispatcher<{removed:{};dispose:{}}>;
  events.addEventListener(type,rollback);listeners.push(()=>events.removeEventListener(type,rollback));
 }
 function maintainOwnership(){
  if(!active)return false;
  const valid=(!skyline||skyline.intact())&&hierarchy.every(({node,parent})=>node.parent===parent)&&
   geometryOwners.every(({mesh,geometry})=>mesh.geometry===geometry)&&materialOwners.every(({mesh,material})=>mesh.material===material);
  if(!valid)rollback();return valid;
 }
 try {
  for(const entry of ready){
   for(const child of entry.originals){if(child.parent){const parent=child.parent;if(!parentOrders.has(parent))parentOrders.set(parent,parent.children.slice());removed.push({child,parent,index:parentOrders.get(parent)!.indexOf(child)});child.removeFromParent();}}
   landmarkRoot.add(entry.lod);
  }
  if(skylineRoot)skyline=excludeWaterfrontSkylineSites(skylineRoot,ready.map(entry=>entry.spec.id));
  hierarchy=ownedNodes.map(node=>({node,parent:node.parent}));
  for(const node of ownedNodes)watch(node,'removed');
  watch(landmarkRoot,'removed');
  for(const geometry of new Set(geometryOwners.map(owner=>owner.geometry)))watch(geometry,'dispose');
  if(skylineRoot)for(const node of skylineRoot.children)if(node instanceof T.Mesh)watch(node.geometry,'dispose');
 }catch(error){
  rollback();
  throw error;
 }
 return {
  installed:ready.map(e=>({id:e.spec.id,name:e.spec.name,removedFacades:e.originals.length})),
  // World decoration legitimately clones materials before this explicit seal.
  // Thereafter a replaced/disposed staged draw falls back as one transaction.
  sealOwnership(){if(sealed||!maintainOwnership())return;sealed=true;materialOwners=geometryOwners.map(({mesh})=>({mesh,material:mesh.material}));
   for(const material of new Set(materialOwners.flatMap(({material})=>Array.isArray(material)?material:[material])))watch(material,'dispose');
  },
  maintainOwnership,
  // Explicit cleanup and failed ownership both restore the same prior scene.
  rollback,dispose:rollback,
 };
}
