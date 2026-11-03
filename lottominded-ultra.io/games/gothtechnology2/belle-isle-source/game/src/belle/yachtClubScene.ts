import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {YACHT,yachtInside,yachtWorld} from './yachtClub.ts';
export async function addYachtClub(scene:T.Scene,loader:GLTFLoader){
 const gltf=await loader.loadAsync('./belle/yacht-club.glb');const group=gltf.scene;group.name='Detroit Yacht Club · clubhouse and marina';
 let triangles=0,meshes=0;const interiors:T.Object3D[]=[];
 group.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;m.receiveShadow=true;m.castShadow=o.name.startsWith('DYC_exterior')||o.name.startsWith('DYC exterior');if(/interior/i.test(o.name))interiors.push(o);for(const mat of(Array.isArray(m.material)?m.material:[m.material]) as T.MeshStandardMaterial[]){mat.side=T.DoubleSide;mat.envMapIntensity=.35;if(/glass/.test(mat.name))mat.envMapIntensity=.75;}});scene.add(group);
 const lighting=new T.Group();scene.add(lighting);for(const [u,v,y]of[[-40,-4,8],[-7,-3,7],[26,-2,7]]){const p=yachtWorld(u,v),lamp=new T.PointLight(0xffd5a0,36,26,2);lamp.position.set(p.x,y,p.z);lighting.add(lamp);}
 let lastX=Infinity,lastZ=Infinity;
 return {stats:{boats:YACHT.boats.length,piers:YACHT.piers.length,triangles,meshes},update(x:number,z:number){const d=Math.hypot(x-YACHT.center[0],z-YACHT.center[1]);if(Math.hypot(x-lastX,z-lastZ)<2)return;lastX=x;lastZ=z;group.visible=d<1000;for(const o of interiors)o.visible=d<180;lighting.visible=d<85&&yachtInside(x,z);}};
}
