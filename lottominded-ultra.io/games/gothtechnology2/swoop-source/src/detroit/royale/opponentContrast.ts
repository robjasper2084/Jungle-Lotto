import * as T from 'three';
/** Small material lift, with normal depth testing; never an outline through walls. */
export class OpponentContrast {
 private copies=new Map<T.MeshStandardMaterial,T.MeshStandardMaterial>();private enabled?:boolean;
 constructor(root:T.Object3D){root.traverse(o=>{if(!(o instanceof T.Mesh))return;const copy=(m:T.Material)=>{if(!(m instanceof T.MeshStandardMaterial))return m;let c=this.copies.get(m);if(!c){c=m.clone();this.copies.set(m,c);}return c;};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});}
 set(enabled:boolean){if(this.enabled===enabled)return;this.enabled=enabled;for(const [source,copy]of this.copies){copy.emissive.copy(source.emissive);copy.emissiveIntensity=source.emissiveIntensity;if(enabled){copy.emissive.add(new T.Color('#294047'));copy.emissiveIntensity=Math.max(.35,source.emissiveIntensity);}}}
 dispose(){for(const copy of this.copies.values())copy.dispose();this.copies.clear();}
}
