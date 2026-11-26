/**
 * EXPLICIT STAGING BUILD ONLY. No production default, height re-projection, or collider change.
 * Tests and art review must pass before anyone enables this in a live build.
 */
import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export type SiteId = '107310050' | '107227742';
export type StudyDefinition = Readonly<{
  id: SiteId; name: string; center: readonly [number,number]; yaw: number;
  files: readonly [string,string,string]; hashes: readonly [string,string,string];
}>;

export const STUDY_SITES: readonly StudyDefinition[] = [
  {id:'107310050',name:'Anna Scripps Whitcomb Conservatory (STAGED)',center:[1330.8,1174.7],yaw:.313,
   files:['Conservatory_Architectural_Study.glb','Conservatory_Architectural_Study_LOD1.glb','Conservatory_Architectural_Study_LOD2.glb'],
   hashes:['953eab50553c37290f33c6eff91646ebae88497ad5a07b86aa318dcad65e3963','dda98b48037f7f9196f64a9ca43e7112dc0681a0d1852aa02ca004bf65306604','235e3a1ddcec89c037a7e5b894a80226e8f7402540c8ceb691d9ec9e6948d522']},
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
export async function installStagedLandmarkStudies(loader:GLTFLoader, landmarkRoot:T.Object3D){
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
 const removed:{child:T.Object3D;parent:T.Object3D}[]=[];
 try {
  for(const entry of ready){
   for(const child of entry.originals){if(child.parent){removed.push({child,parent:child.parent});child.removeFromParent();}}
   landmarkRoot.add(entry.lod);
  }
 }catch(error){
  for(const entry of ready)entry.lod.removeFromParent();
  for(const {child,parent} of removed)parent.add(child);
  throw error;
 }
 return {
  installed:ready.map(e=>({id:e.spec.id,name:e.spec.name,removedFacades:e.originals.length})),
  // Used by staging screenshot controls; never silently call from the game loop.
  rollback(){for(const entry of ready)entry.lod.removeFromParent();for(const {child,parent} of removed)parent.add(child);},
 };
}
