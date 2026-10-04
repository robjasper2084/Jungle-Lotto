import * as T from 'three';
import type {RidePose} from '@digital-static/ridecore';
const url=new URL('../../art/armor-keychain-20261004/lottomind-charm.webp',import.meta.url).href;
let texture:Promise<T.Texture>|undefined;
const charmTexture=()=>texture??=new T.TextureLoader().loadAsync(url).then(map=>{map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;});
/** Small split ring and articulated chain, fixed to the second left lumbar rivet. */
export class ArmorKeychain{
 readonly anchor=new T.Group();readonly swing=new T.Group();
 private age=0;private speed=0;private roll=0;private rollVelocity=0;private pitch=0;private pitchVelocity=0;private last=performance.now();private disposed=false;
 constructor(rider:T.Object3D){
  this.anchor.name='LottoMind keychain / second left back-armor attachment';
  this.anchor.position.set(.104*.72,1.143-.068,-.224);rider.add(this.anchor);rider.updateWorldMatrix(true,true);
  (rider.getObjectByName('Spine02')??rider).attach(this.anchor);
  const gold=new T.MeshStandardMaterial({color:0xd5b46c,metalness:.85,roughness:.25});
  const ring=new T.Mesh(new T.TorusGeometry(.0105,.0023,6,16),gold);ring.name='Split ring / armor fastener';this.anchor.add(ring,this.swing);
  for(let i=0;i<3;i++){const link=new T.Mesh(new T.TorusGeometry(.006,.0016,5,12),gold);link.scale.y=1.4;link.position.set(0,-.014-i*.010,-.005);if(i%2)link.rotation.y=Math.PI/2;this.swing.add(link);}
  const material=new T.MeshStandardMaterial({transparent:true,alphaTest:.25,roughness:.65,metalness:.15,side:T.DoubleSide,depthWrite:true});
  // Thin, back-to-back printed charm faces, with the original silhouette alpha.
  for(const z of [-.006,-.009]){const face=new T.Mesh(new T.PlaneGeometry(.10,.15),material);face.name='Suited LottoMind mascot charm';face.position.set(0,-.111,z);face.rotation.y=z===-.009?Math.PI:0;face.castShadow=true;this.swing.add(face);}
  void charmTexture().then(map=>{if(!this.disposed){material.map=map;material.needsUpdate=true;}}).catch(()=>{this.swing.visible=false;});
 }
 update(p:RidePose,reduced=false){
  const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-this.last)/1000));this.last=now;
  const acceleration=dt>.001?T.MathUtils.clamp((p.speed-this.speed)/dt,-8,8):0;this.speed=p.speed;this.age+=dt;
  if(reduced){this.roll=this.pitch=this.rollVelocity=this.pitchVelocity=0;this.swing.rotation.set(0,0,0);return;}
  const targetRoll=T.MathUtils.clamp(-p.rollAngle*.65+Math.sin(this.age*5)*Math.min(.02,Math.abs(p.speed)*.002),-.28,.28),targetPitch=T.MathUtils.clamp(acceleration*.012,-.12,.12);
  const steps=Math.max(1,Math.ceil(dt*120)),step=dt/steps;
  for(let i=0;i<steps;i++){this.rollVelocity+=((targetRoll-this.roll)*90-this.rollVelocity*9)*step;this.roll+=this.rollVelocity*step;this.pitchVelocity+=((targetPitch-this.pitch)*90-this.pitchVelocity*9)*step;this.pitch+=this.pitchVelocity*step;}
  this.swing.rotation.set(this.pitch,0,this.roll);
 }
 dispose(){this.disposed=true;const materials=new Set<T.Material>();this.anchor.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();materials.add(o.material as T.Material);}});materials.forEach(m=>m.dispose());this.anchor.removeFromParent();}
}
