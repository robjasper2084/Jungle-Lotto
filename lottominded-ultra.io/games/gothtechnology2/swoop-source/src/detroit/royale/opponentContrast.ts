import * as T from 'three';
/** Small material lift, with normal depth testing; never an outline through walls. */
export class OpponentContrast {
 private copies=new Map<T.MeshStandardMaterial,{material:T.MeshStandardMaterial;version:number}>();
 private originals:{mesh:T.Mesh;material:T.Material|T.Material[]}[]=[];
 private enabled?:boolean;
 constructor(root:T.Object3D){root.traverse(o=>{
  if(!(o instanceof T.Mesh))return;
  this.originals.push({mesh:o,material:o.material});
  const copy=(m:T.Material)=>{if(!(m instanceof T.MeshStandardMaterial))return m;let c=this.copies.get(m);if(!c){c={material:m.clone(),version:m.version};this.copies.set(m,c);}return c.material;};
  o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
 });}
 set(enabled:boolean){
  const changed=this.enabled!==enabled;this.enabled=enabled;
  for(const [source,entry]of this.copies){
   // Helmet/charm textures arrive after the actor is cloned. Preserve those
   // uploads and shader changes even when contrast stays off for the local hero.
   const updated=entry.version!==source.version;
   if(!changed&&!updated)continue;
   const copy=entry.material;
   if(updated){copy.copy(source);copy.needsUpdate=true;entry.version=source.version;}
   copy.emissive.copy(source.emissive);copy.emissiveIntensity=source.emissiveIntensity;
   if(enabled){copy.emissive.add(new T.Color('#294047'));copy.emissiveIntensity=Math.max(.35,source.emissiveIntensity);}
  }
 }
 dispose(){for(const entry of this.originals)entry.mesh.material=entry.material;this.originals=[];for(const copy of this.copies.values())copy.material.dispose();this.copies.clear();}
}
