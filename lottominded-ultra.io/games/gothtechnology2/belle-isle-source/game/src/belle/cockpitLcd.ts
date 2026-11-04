import * as T from 'three';
import {cockpitTelemetry,type CockpitInput} from './cockpitTelemetry.ts';
/** Physical cockpit instrument; one small unlit texture, refreshed at HUD rate. */
export class CockpitLcd{
 readonly root=new T.Group();private brackets=new T.Group();private canvas=document.createElement('canvas');private context:CanvasRenderingContext2D;private texture:T.CanvasTexture;
 constructor(parent:T.Object3D){
  this.root.name='Hoverbike LCD dashboard';this.canvas.width=512;this.canvas.height=256;this.context=this.canvas.getContext('2d')!;this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.texture.minFilter=T.LinearFilter;this.texture.generateMipmaps=false;
  const housing=new T.Mesh(new T.BoxGeometry(.43,.235,.035),new T.MeshStandardMaterial({color:0x11191c,roughness:.53,metalness:.45}));const panel=new T.Mesh(new T.PlaneGeometry(.394,.197),new T.MeshBasicMaterial({map:this.texture,toneMapped:false}));panel.position.z=.019;panel.name='Speed altitude heading display';this.root.add(housing,panel);
  this.root.position.set(0,1.57,.50);this.root.rotation.set(-Math.atan2(.55,.84),Math.PI,0,'YXZ');parent.add(this.root);
  const bracketMaterial=new T.MeshStandardMaterial({color:0x1c252b,metalness:.68,roughness:.42});
  parent.add(this.brackets);
  for(const x of[-.12,.12]){const a=new T.Vector3(x,1.23,.20),b=new T.Vector3(x,1.48,.44),delta=b.clone().sub(a);const bracket=new T.Mesh(new T.CylinderGeometry(.016,.016,delta.length(),8),bracketMaterial);bracket.name='Dashboard support bracket';bracket.position.copy(a).add(b).multiplyScalar(.5);bracket.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());this.brackets.add(bracket);}
 }
 setVisible(visible:boolean){this.root.visible=visible;this.brackets.visible=visible;}
 update(input:CockpitInput){
  const p=cockpitTelemetry(input),c=this.context;c.fillStyle='#071a20';c.fillRect(0,0,512,256);
  c.strokeStyle='#35606c';c.lineWidth=2;c.strokeRect(8,8,496,240);c.fillStyle='#7bc9d7';c.font='bold 19px monospace';c.fillText('SWOOP / 2084',24,37);c.textAlign='right';c.fillStyle=p.warning?'#ffb36d':'#a5ecbc';c.fillText(p.warning||p.mode,488,37);c.textAlign='left';
  c.fillStyle='#edfaf8';c.font='bold 99px monospace';c.fillText(String(p.speed).padStart(2,'0'),22,143);c.font='17px monospace';c.fillStyle='#87b9c6';c.fillText('KM/H',30,168);
  c.fillStyle='#edfaf8';c.font='bold 37px monospace';c.fillText(p.height+' m',282,104);c.font='15px monospace';c.fillStyle='#87b9c6';c.fillText('ABOVE GROUND',284,128);c.fillStyle='#d5efea';c.font='bold 26px monospace';c.fillText(p.compass+' '+String(p.bearing).padStart(3,'0')+'°',282,173);
  c.fillStyle='#163c45';c.fillRect(23,188,466,2);c.font='18px monospace';c.fillStyle=p.lights?'#87dfec':'#789398';c.fillText(p.lights?'HEADLIGHTS ON':'HEADLIGHTS OFF',24,224);c.textAlign='right';c.fillStyle='#d4dbc0';c.fillText(input.boost?'BOOST ACTIVE':'FLIGHT SYSTEM',486,224);c.textAlign='left';this.texture.needsUpdate=true;
 }
}
