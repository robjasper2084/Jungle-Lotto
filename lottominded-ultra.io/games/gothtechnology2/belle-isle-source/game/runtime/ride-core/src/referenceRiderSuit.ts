import * as T from 'three';
import {surfaceFinish} from './surfaceFinish.ts';
import fitted from './referenceSuitGeometry.json' with {type:'json'};

const palettes:Record<string,string[]>={
 DS_Ghoulies_Rider:['#283139','#599e36','#e5cd29','#90e7ed','#182127'],
 DS_Detroit_Rider:['#101e35','#204779','#e33c28','#e6ad4c','#182430'],
 DS_Neural_Rider:['#344c65','#c2d5de','#36d7e8','#82eaff','#132335'],
 DS_Vampire_Rider:['#1c2524','#596343','#da263b','#e9ddd0','#0d141c'],
};
const geometryCache=new Map<string,T.BufferGeometry[]>();
/** Artwork-inspired panels baked against the existing neutral armor rig.
 * Geometry is shared as a template; instances own their skin and materials.
 * Cosmetic surfaces never contribute to crash contacts or recovery support. */
export function referenceRiderSuit(root:T.Object3D,id:string,_key?:T.BufferGeometry){
 const palette=palettes[id],parts=fitted[id as keyof typeof fitted];
 if(!palette||!parts)return {dispose(){}};
 let templates=geometryCache.get(id);
 if(!templates){templates=parts.map(part=>new T.BufferGeometryLoader().parse(part.geometry));geometryCache.set(id,templates);}
 const meshes:T.SkinnedMesh[]=[];
 for(let i=0;i<parts.length;i++){
  const {finish,bones}=parts[i];
  const skeletonBones=bones.map(name=>root.getObjectByName(name) as T.Bone);
  if(skeletonBones.some(bone=>!bone?.isBone))continue;
  const material=surfaceFinish(new T.MeshStandardMaterial({name:id+' / reference armor '+finish,color:palette[finish],roughness:finish===1?.34:.58,metalness:finish===1?.68:.12,side:T.DoubleSide}),finish===1?'metal':'shell');
  if(id==='DS_Neural_Rider'&&finish===2){material.emissive.set(palette[finish]);material.emissiveIntensity=.25;}
  if(id==='DS_Ghoulies_Rider'&&finish===3){material.emissive.set(palette[finish]);material.emissiveIntensity=.35;}
  const mesh=new T.SkinnedMesh(templates[i].clone(),material);mesh.name=id+' fitted reference armor '+finish;
  mesh.userData.presentationOnly=true;
  root.add(mesh);root.updateWorldMatrix(true,true);mesh.bind(new T.Skeleton(skeletonBones));
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=true;meshes.push(mesh);
 }
 return {dispose(){for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose();mesh.skeleton.dispose();(mesh.material as T.Material).dispose();}}};
}
