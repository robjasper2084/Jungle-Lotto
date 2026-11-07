import * as T from 'three';
import {hoverLightLevels,type HoverLightLevels} from './visualPolishPolicy.ts';
import {ledColor} from './hoverLightingModel.ts';
export {LED_COLORS} from './hoverLightingModel.ts';
export class HoverLighting{
 private levels:HoverLightLevels={headlights:0,underglow:0,emissive:0};
 private heads:T.SpotLight[]=[];private headGlass:T.MeshBasicMaterial[]=[];private under:T.PointLight;private trim:T.MeshStandardMaterial;private elapsed=0;
 constructor(private root:T.Object3D,private rings:T.MeshStandardMaterial[]){
  const shell=new T.MeshStandardMaterial({color:0x11171a,roughness:.42,metalness:.7});
  for(const side of[-1,1]){const housing=new T.Mesh(new T.BoxGeometry(.27,.12,.10),shell);housing.position.set(side*.34,.83,1.65);root.add(housing);const material=new T.MeshBasicMaterial({color:0xfff2da,toneMapped:false});const glass=new T.Mesh(new T.PlaneGeometry(.23,.065),material);glass.position.set(side*.34,.83,1.706);root.add(glass);this.headGlass.push(material);const light=new T.SpotLight(0xfff2de,0,70,Math.PI/8,.65,1.65);light.position.copy(glass.position);light.target.position.set(side*.34,-1.5,20);root.add(light,light.target);this.heads.push(light);}
  this.trim=new T.MeshStandardMaterial({color:0x79dfff,emissive:0x79dfff,emissiveIntensity:2,metalness:.2,roughness:.4});
  for(const side of[-1,1]){const strip=new T.Mesh(new T.BoxGeometry(.025,.035,1.45),this.trim);strip.position.set(side*.48,.50,-.10);strip.name='Rider controlled side LED';root.add(strip);}
  this.under=new T.PointLight(0x79dfff,0,6,2);this.under.position.set(0,.24,0);root.add(this.under);
 }
 update(dt:number,running:boolean,base:string,mode:string,on:boolean,high:boolean,reduced:boolean,nightAmount=1){if(running&&!reduced)this.elapsed+=dt;const color=ledColor(base,mode,this.elapsed,reduced),levels=hoverLightLevels(nightAmount,on,high,mode!=='off',this.levels),power=levels.emissive;for(const m of[...this.rings,this.trim]){m.emissive.copy(color);m.emissiveIntensity=power;}this.trim.color.copy(color);this.under.color.copy(color);this.under.intensity=levels.underglow;this.heads.forEach(light=>{light.intensity=levels.headlights;light.angle=high?Math.PI/12:Math.PI/7;light.target.position.y=high?-.6:-1.5;light.target.position.z=high?28:20;});this.headGlass.forEach(m=>m.color.set(on?0xfff2da:0x263138));}
}
