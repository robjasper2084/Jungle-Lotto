import * as T from 'three';
import type {GLTF} from '../compressedGLTFLoader.ts';

/** Higgsfield/Blender ribbons, with a bounded shared-geometry particle layer. */
export class ShieldEffect extends T.Group {
 private time=0;private particles:T.Object3D;private ribbons:T.Object3D;
 private impactAge=1;private broken=false;private ripple=new T.Mesh(new T.SphereGeometry(1.12,16,10),new T.MeshBasicMaterial({color:'#b4fff1',wireframe:true,transparent:true,opacity:0,depthWrite:false}));
 constructor(source:GLTF){
  super();const template=source.scene.getObjectByName('FX_RiderShield');
  if(!template)throw Error('Shield asset is missing FX_RiderShield');
  const model=template.clone(true);model.scale.setScalar(1);this.add(model);
  this.particles=model.getObjectByName('ShieldParticles')!;this.ribbons=model.getObjectByName('ShieldRibbons')!;
  model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=false;}});
  this.name='Particle force field';this.visible=false;
  this.add(this.ripple);
 }
 hit(broken=false){this.impactAge=0;this.broken=broken;this.ripple.material.color.set(broken?'#ffb071':'#b4fff1');}
 get reacting(){return this.impactAge<.65;}
 update(dt:number,reduced:boolean,low:boolean,energized=true){
  this.impactAge+=Math.max(0,Math.min(.1,dt));if(!this.visible)return;
  const t=Math.min(1,this.impactAge/.65);this.ripple.visible=t<1;
  this.ripple.material.opacity=(1-t)*(reduced?.2:.7);this.ripple.scale.setScalar(reduced?1:1+t*(this.broken?.8:.22));
  if(!reduced)this.time+=Math.min(.1,Math.max(0,dt));
  this.ribbons.visible=energized;this.ribbons.scale.setScalar(reduced?1:1+Math.sin(this.time*2.4)*.022);
  this.particles.visible=energized&&!low;this.particles.rotation.y=reduced?0:Math.sin(this.time*2.4)*.12;
 }
 dispose(){this.ripple.geometry.dispose();this.ripple.material.dispose();this.removeFromParent();}
}
