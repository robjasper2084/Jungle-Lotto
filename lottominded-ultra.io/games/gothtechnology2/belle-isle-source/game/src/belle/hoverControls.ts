import * as T from 'three';
import type {HoverTransmission} from './hoverTransmission.ts';
/** Independent moving controls on the shipped handlebar sockets. No extra lights/textures. */
export class HoverControls{
 readonly throttle=new T.Group();readonly brake=new T.Group();readonly clutch=new T.Group();
 private rotation=new T.Quaternion();private axis=new T.Vector3(1,0,0);
 private grips:{anchor:T.Object3D;rest:T.Quaternion}[]=[];
 private owned:T.BufferGeometry[]=[];private materials:T.Material[]=[];private baked?:T.Object3D;
 constructor(model:T.Object3D){
  const bars=model.getObjectByName('HandlebarPivot');if(!bars)return;
  this.baked=model.getObjectByName('HandlebarPivot_Mesh');if(this.baked)this.baked.visible=false;
  const fitted=!!model.getObjectByName('Fitted first-person sleeves');
  const rubber=new T.MeshStandardMaterial({color:0x1c2328,roughness:.85}),red=new T.MeshStandardMaterial({color:0x9e1425,metalness:.65,roughness:.3}),metal=new T.MeshStandardMaterial({color:0xa4afb4,metalness:.8,roughness:.32});this.materials.push(rubber,red,metal);
  const tube=(points:number[][],radius:number)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,radius,6,false);
  const add=(g:T.BufferGeometry,m:T.Material,parent:T.Object3D)=>{this.owned.push(g);const mesh=new T.Mesh(g,m);mesh.castShadow=true;parent.add(mesh);return mesh;};
  add(tube(fitted?[[-.6,.18,-.26],[-.34,.16,-.18],[-.18,.10,0],[0,.04,0],[.18,.10,0],[.34,.16,-.18],[.6,.18,-.26]]:[[-.59,.16,-.02],[-.34,.16,-.02],[-.18,.10,0],[0,.04,0],[.18,.10,0],[.34,.16,-.02],[.59,.16,-.02]],.027),red,bars);
  const gripGeo=new T.CylinderGeometry(.038,.038,.22,10).rotateZ(Math.PI/2);
  if(!fitted){const left=add(gripGeo,rubber,bars);left.position.set(-.46,.16,-.02);}
  this.throttle.name='Working throttle grip';this.throttle.position.set(.46,.16,-.02);bars.add(this.throttle);if(!fitted)add(gripGeo.clone(),rubber,this.throttle);
  const mark=add(new T.BoxGeometry(.14,.005,.009),metal,this.throttle);mark.position.set(0,.038,0);
  for(const [side,lever] of [[-1,this.clutch],[1,this.brake]] as const){
   lever.name=side<0?'Working clutch lever':'Working brake lever';lever.position.set(side*.34,.16,fitted?-.19:.055);bars.add(lever);
   add(tube([[0,0,0],[side*.09,-.008,.065],[side*.22,-.014,.055]],.012),metal,lever);
   const cap=add(new T.SphereGeometry(.019,6,4),metal,lever);cap.position.set(side*.22,-.014,.055);
   const anchor=model.getObjectByName(side<0?'Grip_L':'Grip_R');if(anchor)this.grips.push({anchor,rest:anchor.quaternion.clone()});
  }
 }
 update(dt:number,drive:Pick<HoverTransmission,'throttle'|'clutch'|'brake'>){
  const a=1-Math.exp(-18*Math.max(0,Math.min(.12,dt)));
  this.throttle.rotation.x=T.MathUtils.lerp(this.throttle.rotation.x,-Math.max(0,drive.throttle)*.48,a);
  this.brake.rotation.y=T.MathUtils.lerp(this.brake.rotation.y,drive.brake*.45,a);
  this.clutch.rotation.y=T.MathUtils.lerp(this.clutch.rotation.y,-drive.clutch*.45,a);
  // Let the grip roll within the palm; full shaft rotation overextends this authored rig.
  const right=this.grips.find(g=>g.anchor.name==='Grip_R');if(right)right.anchor.quaternion.copy(this.rotation.setFromAxisAngle(this.axis,this.throttle.rotation.x*.35)).multiply(right.rest);
 }
 dispose(){for(const g of this.owned)g.dispose();for(const m of this.materials)m.dispose();}
}
