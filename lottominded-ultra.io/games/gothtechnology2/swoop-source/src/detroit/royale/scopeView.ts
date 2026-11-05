import * as T from 'three';
import type {GLTF} from '../compressedGLTFLoader.ts';
import {SCOPES,type Scope} from '../../../../ride-core/src/royale/scopes.ts';

/** All pickups and mounted optics share the Blender mesh/materials. */
export class ScopeLibrary {
 private labels=new Map<Scope,T.SpriteMaterial>();
 constructor(readonly asset:GLTF){
  if(!asset.scene.getObjectByName('PRP_scope'))throw Error('Scope model missing');
 }
 model(){return this.asset.scene.clone(true);}
 pickup(kind:Scope){
  let label=this.labels.get(kind);
  if(!label){const c=document.createElement('canvas');c.width=256;c.height=96;const ctx=c.getContext('2d')!;
   ctx.fillStyle='#061d27';ctx.fillRect(0,0,256,96);ctx.strokeStyle=SCOPES[kind].color;ctx.lineWidth=7;ctx.strokeRect(4,4,248,88);
   ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=SCOPES[kind].color;ctx.fillText(SCOPES[kind].label,128,50);
   const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;label=new T.SpriteMaterial({map,depthTest:true,transparent:true});this.labels.set(kind,label);
  }
  return new ScopePickup(this.model(),label);
 }
 dispose(){for(const m of this.labels.values()){m.map?.dispose();m.dispose();}const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();this.asset.scene.traverse(o=>{if(o instanceof T.Mesh){geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
}
export class ScopePickup{
 readonly root=new T.Group();private age=0;
 constructor(private model:T.Group,label:T.SpriteMaterial){model.scale.setScalar(2.4);this.root.add(model);const sign=new T.Sprite(label);sign.position.y=.48;sign.scale.set(.9,.34,1);this.root.add(sign);}
 update(delta:number,reduced:boolean){if(!reduced)this.age+=delta;this.model.rotation.y=reduced?0:this.age*.55;}
 dispose(){this.root.removeFromParent();}
}
