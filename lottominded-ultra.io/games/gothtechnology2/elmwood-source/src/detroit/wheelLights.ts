import * as T from 'three';

type LightPose={brakeAmount:number;crashBlend:number};
export function wheelLightState(p:LightPose,seconds:number,reducedMotion=false){
 const braking=p.brakeAmount>.08;
 const pulse=(seconds%1.2)<.24;
 return {braking,rear:braking?'brake':reducedMotion?'steady':'flash',rearIntensity:braking?4:reducedMotion?.8:pulse?1.8:.08,frontIntensity:2.2};
}

/** Animate each wheel's own lamp materials, never the shared source GLB. */
export class WheelLights{
 private front:T.MeshStandardMaterial[]=[];private rear:T.MeshStandardMaterial[]=[];
 private owned=new Map<T.Material,T.MeshStandardMaterial>();private beam?:T.SpotLight;private target?:T.Object3D;
 private state=wheelLightState({brakeAmount:0,crashBlend:0},0);private source=new T.Vector3(0,.7,.25);
 private vehicle:T.Object3D;
 constructor(vehicle:T.Object3D){
  this.vehicle=vehicle;
  vehicle.updateWorldMatrix(true,true);
  const lens=vehicle.getObjectByName('socket_headlight')??vehicle.getObjectByName('Headlamp_Lens');
  if(lens)this.source.copy(vehicle.worldToLocal(lens.getWorldPosition(new T.Vector3())));
  vehicle.traverse(o=>{if(!(o instanceof T.Mesh))return;
   const convert=(material:T.Material)=>{
    if(!(material instanceof T.MeshStandardMaterial))return material;
    const name=material.name+' '+o.name,back=/tail.?light|rear.*(?:lamp|light).*lens/i.test(name),front=/head.?light|headlamp.*lens/i.test(name);
    if(!back&&!front)return material;
    let copy=this.owned.get(material);if(!copy){copy=material.clone();copy.toneMapped=false;copy.emissive.set(back?'#ff1808':'#d9efff');copy.color.set(back?'#a91107':'#d9efff');this.owned.set(material,copy);(back?this.rear:this.front).push(copy);}return copy;
   };
   o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
  });
 }
 setBeam(enabled:boolean){
  if(enabled&&!this.beam){
   this.beam=new T.SpotLight('#e7f3fc',28,18,.46,.72,2);this.beam.name='EUC working road headlight';this.beam.castShadow=false;
   this.beam.position.copy(this.source);this.target=new T.Object3D();this.target.position.set(this.source.x,.035,this.source.z+7);this.beam.target=this.target;this.vehicle.add(this.beam,this.target);
  }
  if(this.beam)this.beam.visible=enabled;
 }
 update(p:LightPose,reducedMotion=false,seconds=performance.now()/1000){
  this.state=wheelLightState(p,seconds,reducedMotion);
  for(const m of this.front)m.emissiveIntensity=this.state.frontIntensity;
  for(const m of this.rear)m.emissiveIntensity=this.state.rearIntensity;
  if(this.beam)this.beam.intensity=p.crashBlend>.1?0:28;
  this.vehicle.userData.wheelLights=this.state;
 }
 get status(){return {...this.state,frontMaterials:this.front.length,rearMaterials:this.rear.length,beam:!!this.beam?.visible};}
 dispose(){for(const m of this.owned.values())m.dispose();this.beam?.removeFromParent();this.beam?.dispose();this.target?.removeFromParent();}
}
