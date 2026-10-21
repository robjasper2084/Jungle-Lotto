import * as T from 'three';

/** Correct the legacy nylon export without changing shared assets or metal gear. */
export class RiderSurfaces {
 private owned=new Map<T.Material,T.Material>();
 constructor(root:T.Object3D){
  const prepare=(source:T.Material)=>{
   if(source.name!=='Dark riding garments / original UV detail'||!(source as T.MeshStandardMaterial).isMeshStandardMaterial)return source;
   let material=this.owned.get(source);if(material)return material;
   const cloth=(source as T.MeshPhysicalMaterial).clone();
   cloth.metalness=0;cloth.metalnessMap=null;cloth.roughness=Math.max(.87,cloth.roughness);
   if(cloth.isMeshPhysicalMaterial){cloth.specularColor.setRGB(1,1,1);cloth.specularIntensity=.35;}
   this.owned.set(source,cloth);return cloth;
  };
  root.traverse(o=>{const mesh=o as T.Mesh;if(mesh.isMesh)mesh.material=Array.isArray(mesh.material)?mesh.material.map(prepare):prepare(mesh.material);});
 }
 dispose(){for(const material of this.owned.values())material.dispose();this.owned.clear();}
}
