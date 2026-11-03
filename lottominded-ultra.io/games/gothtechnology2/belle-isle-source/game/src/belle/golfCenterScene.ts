import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import layout from './golfCenterLayout.json' with {type:'json'};

/** Static, material-batched landmark. No new per-frame actors or dynamic lights. */
export async function addGolfCenter(scene:T.Scene,loader:GLTFLoader){
 const {scene:group}=await loader.loadAsync('./belle/golf-center.glb');
 group.name='Belle Isle Golf Center · clubhouse and open range';
 let meshes=0,triangles=0;
 group.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh)return;
  meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
  mesh.receiveShadow=true;mesh.castShadow=mesh.name.startsWith('Golf_clubhouse')||mesh.name.startsWith('Golf clubhouse');
  for(const mat of (Array.isArray(mesh.material)?mesh.material:[mesh.material]) as T.MeshStandardMaterial[]){
   mat.side=T.DoubleSide;mat.envMapIntensity=/glazing/.test(mat.name)?.55:.28;
  }
 });
 scene.add(group);
 return{stats:{meshes,triangles,stations:layout.stationCount},update(x:number,z:number){group.visible=Math.hypot(x-layout.center[0],z-layout.center[1])<700;}};
}
