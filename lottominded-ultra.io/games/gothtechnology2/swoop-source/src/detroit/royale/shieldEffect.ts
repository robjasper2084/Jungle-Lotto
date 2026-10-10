import * as T from 'three';
import type {GLTF} from '../compressedGLTFLoader.ts';

/** Higgsfield/Blender ribbons, with a bounded shared-geometry particle layer. */
export class ShieldEffect extends T.Group {
 private time=0;private particles:T.Object3D;private ribbons:T.Object3D;
 constructor(source:GLTF){
  super();const template=source.scene.getObjectByName('FX_RiderShield');
  if(!template)throw Error('Shield asset is missing FX_RiderShield');
  const model=template.clone(true);model.scale.setScalar(1);this.add(model);
  this.particles=model.getObjectByName('ShieldParticles')!;this.ribbons=model.getObjectByName('ShieldRibbons')!;
  model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;o.receiveShadow=false;}});
  this.name='Particle force field';this.visible=false;
 }
 update(dt:number,reduced:boolean,low:boolean){
  if(!this.visible)return;
  if(!reduced)this.time+=Math.min(.1,Math.max(0,dt));
  this.ribbons.scale.setScalar(reduced?1:1+Math.sin(this.time*2.4)*.022);
  this.particles.visible=!low;this.particles.rotation.y=reduced?0:Math.sin(this.time*2.4)*.12;
 }
 dispose(){this.removeFromParent();}
}
