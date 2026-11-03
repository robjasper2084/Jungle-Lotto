import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {playgrounds} from './playgrounds.ts';
export async function addPlaygrounds(scene:T.Scene,loader:GLTFLoader){
 const {scene:root}=await loader.loadAsync('./belle/playgrounds.glb');root.updateMatrixWorld(true);
 const groups=playgrounds.map(site=>({site,objects:[] as T.Mesh[]}));let triangles=0;
 root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh)return;
  mesh.castShadow=true;mesh.receiveShadow=true;mesh.geometry.computeBoundingSphere();
  const center=mesh.geometry.boundingSphere!.center.clone().applyMatrix4(mesh.matrixWorld);
  const group=groups.reduce((a,b)=>Math.hypot(a.site.center[0]-center.x,a.site.center[1]-center.z)<Math.hypot(b.site.center[0]-center.x,b.site.center[1]-center.z)?a:b);
  group.objects.push(mesh);triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
  for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]) as T.MeshStandardMaterial[]){material.envMapIntensity=.35;}
 });scene.add(root);
 let lastX=Infinity,lastZ=Infinity;
 return {stats:{sites:groups.length,meshes:groups.reduce((n,g)=>n+g.objects.length,0),triangles},update(x:number,z:number){
  if(Math.hypot(x-lastX,z-lastZ)<12)return;lastX=x;lastZ=z;
  for(const g of groups){const visible=Math.hypot(x-g.site.center[0],z-g.site.center[1])<420;for(const object of g.objects)object.visible=visible;}
 }};
}
