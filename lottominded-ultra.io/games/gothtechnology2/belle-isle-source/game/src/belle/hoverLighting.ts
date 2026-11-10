import * as T from 'three';
import {ledColor} from './hoverLightingModel.ts';
export {LED_COLORS} from './hoverLightingModel.ts';
export class HoverLighting{
 private heads:T.SpotLight[]=[];private headGlass:T.MeshBasicMaterial[]=[];private under:T.PointLight;private trim:T.MeshStandardMaterial;private elapsed=0;
 constructor(private root:T.Object3D,private rings:T.MeshStandardMaterial[]){
  const shell=new T.MeshStandardMaterial({color:0x11171a,roughness:.42,metalness:.7});
  const rim=new T.MeshStandardMaterial({color:0x708088,roughness:.28,metalness:.9});
  for(const side of[-1,1]){
   const lamp=new T.Group();lamp.name='Recessed projector headlamp';lamp.position.set(side*.34,.83,1.65);root.add(lamp);
   const anchor=new T.Vector3(side*.34,.61,1.30), end=new T.Vector3(side*.34,.81,1.59),link=end.clone().sub(anchor);
   const bracket=new T.Mesh(new T.CylinderGeometry(.023,.023,link.length(),12),shell);bracket.position.copy(anchor).addScaledVector(link,.5);bracket.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),link.normalize());bracket.name='Headlamp frame mounting strut';root.add(bracket);
   const housing=new T.Mesh(new T.CylinderGeometry(.087,.10,.15,28),shell);housing.rotation.x=Math.PI/2;lamp.add(housing);
   const bezel=new T.Mesh(new T.TorusGeometry(.069,.009,8,32),rim);bezel.position.z=.081;lamp.add(bezel);
   const material=new T.MeshBasicMaterial({color:0xfff3dd,toneMapped:true});
   const lens=new T.Mesh(new T.SphereGeometry(.061,24,16),material);lens.scale.z=.3;lens.position.z=.079;lamp.add(lens);this.headGlass.push(material);
   const hood=new T.Mesh(new T.BoxGeometry(.17,.022,.095),shell);hood.position.set(0,.078,.055);lamp.add(hood);
   const light=new T.SpotLight(0xffeed6,0,60,.30,1,2);light.position.set(side*.34,.83,1.75);light.target.position.set(side*.34,-1.4,21);root.add(light,light.target);this.heads.push(light);
  }
  this.trim=new T.MeshStandardMaterial({color:0x79dfff,emissive:0x79dfff,emissiveIntensity:2,metalness:.2,roughness:.4});
  for(const side of[-1,1]){const strip=new T.Mesh(new T.BoxGeometry(.025,.035,1.45),this.trim);strip.position.set(side*.48,.50,-.10);strip.name='Rider controlled side LED';root.add(strip);}
  this.under=new T.PointLight(0x79dfff,0,6,2);this.under.position.set(0,.24,0);root.add(this.under);
 }
 update(dt:number,running:boolean,base:string,mode:string,on:boolean,high:boolean,reduced:boolean,night=1){if(running&&!reduced)this.elapsed+=dt;const color=ledColor(base,mode,this.elapsed,reduced),power=mode==='off'?0:2.0;for(const m of[...this.rings,this.trim]){m.emissive.copy(color);m.emissiveIntensity=power;}this.trim.color.copy(color);this.under.color.copy(color);this.under.intensity=mode==='off'?0:2.4;this.heads.forEach(light=>{light.intensity=on?(high?260:140)*(.35+.65*night):0;light.angle=high?.24:.34;light.target.position.y=high?-.7:-1.4;light.target.position.z=high?30:21;});this.headGlass.forEach(m=>m.color.set(on?0xfff0d8:0x273138));}
}
