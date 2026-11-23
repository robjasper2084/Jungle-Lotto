import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// SkeletonUtils.clone gives each skinned primitive a separate palette even
// when its GLTF skin lists exactly the same bones and inverse bind matrices.
export function shareRiderPalettes(meshes:readonly T.Mesh[]){
 const palettes:T.Skeleton[]=[];
 for(const mesh of meshes){
  if(!(mesh instanceof T.SkinnedMesh))continue;
  const skin=mesh.skeleton;
  const same=palettes.find(other=>other.boneInverses===skin.boneInverses&&other.bones.length===skin.bones.length&&other.bones.every((bone,i)=>bone===skin.bones[i]));
  if(same)mesh.skeleton=same;
  else palettes.push(skin);
 }
}

/** Render sibling armor silhouettes with one bone palette and one index list.
 * Originals stay in the scene with their own geometry, names and picking.
 * Toggle a source mesh or its outline and the display follows on this draw. */
export function batchArmoredInk(root:T.Object3D,actor:T.Object3D){
 const armor=root.getObjectByName('Armored_Rider_Surface');
 if(!armor)return;
 const identity=new T.Matrix4();
 const pieces=armor.children.flatMap(source=>{
  const outline=source.children.find(o=>o.userData.referenceInk);
  if(!(source instanceof T.SkinnedMesh)||!(outline instanceof T.SkinnedMesh)||Array.isArray(outline.material))return [];
  source.updateMatrix();outline.updateMatrix();
  const geo=outline.geometry;
  if(!source.matrix.equals(identity)||!outline.matrix.equals(identity)||!geo.index||Object.keys(geo.morphAttributes).length||
     geo.drawRange.start!==0||geo.drawRange.count<geo.index.count||
     !['position','normal','skinIndex','skinWeight'].every(name=>geo.hasAttribute(name)))return [];
  return [{source,outline,material:outline.material}];
 });
 if(pieces.length<2)return;
 const first=pieces[0].outline;
 if(pieces.some(({outline})=>outline.skeleton!==first.skeleton||outline.bindMode!==first.bindMode||
    !outline.bindMatrix.equals(first.bindMatrix)||outline.renderOrder!==first.renderOrder||outline.layers.mask!==first.layers.mask))return;
 const inputs=pieces.map(({outline})=>{
  const geo=new T.BufferGeometry();geo.setIndex(outline.geometry.index);
  for(const name of ['position','normal','skinIndex','skinWeight'])geo.setAttribute(name,outline.geometry.getAttribute(name));
  return geo;
 });
 const geometry=mergeGeometries(inputs,false);
 if(!geometry)return;
 const batch=new T.SkinnedMesh(geometry,pieces[0].material);
 batch.name='Anime ink · armored rider';batch.userData.referenceInk=true;batch.userData.presentationOnly=true;
 batch.bindMode=first.bindMode;batch.bind(first.skeleton,first.bindMatrix);batch.frustumCulled=false;
 batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;
 batch.raycast=()=>{}; // The individual originals return the original face and object.
 const hidden=new T.MeshBasicMaterial({side:T.BackSide});hidden.visible=false;
 for(const piece of pieces)piece.outline.material=hidden;
 const index=geometry.getIndex()!,visible=pieces.map(()=>true);
 let full:typeof index.array|undefined;
 batch.onBeforeRender=(_renderer,_scene,camera)=>{
  let changed=false;
  for(let i=0;i<pieces.length;i++){
   const {source,outline}=pieces[i],shown=source.parent===armor&&source.visible&&outline.visible&&outline.layers.test(camera.layers);
   if(visible[i]!==shown){visible[i]=shown;changed=true;}
  }
  if(!changed)return;
  full??=index.array.slice();
  let src=0,dst=0;
  for(let i=0;i<pieces.length;i++){
   const n=pieces[i].outline.geometry.index!.count;
   if(visible[i]){index.array.set(full.subarray(src,src+n),dst);dst+=n;}
   src+=n;
  }
  geometry.setDrawRange(0,dst);index.clearUpdateRanges();
  if(dst)index.addUpdateRange(0,dst);
  index.needsUpdate=true;
 };
 armor.add(batch);
 const release=()=>{
  actor.removeEventListener('removed',release);
  for(const piece of pieces)piece.outline.material=piece.material;
  batch.removeFromParent();geometry.dispose();hidden.dispose();
 };
 actor.addEventListener('removed',release);
}
