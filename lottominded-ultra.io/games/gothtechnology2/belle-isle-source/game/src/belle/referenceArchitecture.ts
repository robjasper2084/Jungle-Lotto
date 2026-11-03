import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import layout from './referenceArchitecture.json' with {type:'json'};
export const REFERENCE_BUILDING_IDS=new Set(['107202856','368854142']);
export async function addReferenceArchitecture(scene:T.Scene,loader:GLTFLoader){
 const {scene:group}=await loader.loadAsync('./belle/reference-architecture.glb');
 group.updateMatrixWorld(true);
 const buildings=layout.filter(l=>REFERENCE_BUILDING_IDS.has(l.id)).map(l=>({layout:l,objects:[] as T.Object3D[]}));
 group.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=true;mesh.geometry.computeBoundingSphere();const c=mesh.geometry.boundingSphere!.center.clone().applyMatrix4(mesh.matrixWorld);const b=buildings.reduce((a,b)=>Math.hypot(c.x-a.layout.center[0],c.z-a.layout.center[1])<Math.hypot(c.x-b.layout.center[0],c.z-b.layout.center[1])?a:b);b.objects.push(o);for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material]) as T.MeshStandardMaterial[]){m.envMapIntensity=.30;}});
 scene.add(group);return {update(x:number,z:number){for(const b of buildings){const visible=Math.hypot(x-b.layout.center[0],z-b.layout.center[1])<650;for(const o of b.objects)o.visible=visible;}}};
}
