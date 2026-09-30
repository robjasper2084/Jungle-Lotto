import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
/** Existing city projection, in metres. Keep the skyline at its geographic anchor. */
export function cityPoint(lat:number,lon:number){const e=(lon+83.0399)*111320*Math.cos(42.3283*Math.PI/180),n=(lat-42.3283)*111320;return{x:-.5*e+.8660254*n,z:-.8660254*e-.5*n};}
export async function buildAtwaterSkyline(scene:T.Scene){
 const root=(await new GLTFLoader().loadAsync('/exports/atwater/renaissance-center.glb')).scene;
 const p=cityPoint(42.3298,-83.0397);root.position.set(p.x,0,p.z);root.rotation.y=-Math.PI/3;root.name='Renaissance Center · geographic skyline';
 // The skyline is inexpensive distant geometry, not a streamed street tile.
 root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){(mat as T.MeshStandardMaterial).fog=false;}mesh.castShadow=false;mesh.receiveShadow=false;});
 scene.add(root);return root;
}
