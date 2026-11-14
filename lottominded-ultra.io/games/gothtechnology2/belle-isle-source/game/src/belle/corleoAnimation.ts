import * as T from 'three';

/** The authored files face -Z and carry the showcase's absolute X/Z travel.
 * Keep the stance height, but let the terrain controller own horizontal travel
 * and the jump arc. Never change the supplied source GLBs.
 */
export function inPlaceCorleoClip(source:T.AnimationClip,jump=false){
 const clip=source.clone();
 for(const track of clip.tracks){
  if(track.name!=='CR_Root.position')continue;
  const values=track.values;
  for(let i=0;i<values.length;i+=3){values[i]=0;values[i+2]=0;if(jump)values[i+1]=1.62;}
 }
 return clip;
}

export function disposeCorleoModel(root:T.Object3D){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
 root.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  geometries.add(object.geometry);
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   materials.add(material);for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);
  }
 });
 textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
