import * as T from 'three';

/** Physically restrained restoration glazing/plant finish. Render materials
 * only: layout, navigable aisles, opaque framing and collisions stay authored. */
export function tuneConservatoryMaterial(material:T.MeshStandardMaterial){
 if(material.name==='Conservatory clear panes'){
  material.transparent=true;material.opacity=.40;
  material.color.setRGB(.73,.81,.79);material.roughness=.13;material.metalness=.04;
  material.envMapIntensity=.85;material.depthWrite=false;material.side=T.DoubleSide;
  material.needsUpdate=true;
  return 'glazing';
 }
 if(material.name.startsWith('Conservatory leaf')){
  material.side=T.DoubleSide;material.roughness=Math.max(.78,material.roughness);
  material.metalness=0;material.needsUpdate=true;
  return 'foliage';
 }
 return null;
}
