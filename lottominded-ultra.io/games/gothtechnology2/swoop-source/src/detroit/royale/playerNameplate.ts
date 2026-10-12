import * as T from 'three';
import {playerLabel} from './playerIdentity.ts';
/** Depth-tested world label: follows the head and never draws through scenery. */
export class PlayerNameplate {
 readonly root:T.Sprite;private canvas=document.createElement('canvas');private texture:T.CanvasTexture;private key='';
 constructor(){this.canvas.width=512;this.canvas.height=96;this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;this.root=new T.Sprite(new T.SpriteMaterial({map:this.texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}));this.root.name='Online player name';this.root.visible=false;}
 update(name:string,bot:boolean,head:T.Vector3,camera:T.Camera,visible:boolean){
  const distance=head.distanceTo(camera.position);this.root.visible=visible&&distance<=75;if(!this.root.visible)return;
  const label=playerLabel(name,bot);if(label!==this.key){this.key=label;this.root.name=label;const c=this.canvas.getContext('2d')!;c.clearRect(0,0,512,96);c.fillStyle='rgba(5,18,27,.92)';c.beginPath();c.roundRect(3,3,506,90,18);c.fill();c.strokeStyle=bot?'#dfbf77':'#78ead7';c.lineWidth=4;c.stroke();c.fillStyle='#f2fffd';c.textAlign='center';c.textBaseline='middle';c.font='700 34px system-ui, sans-serif';c.fillText(label,256,48,474);this.texture.needsUpdate=true;}
  this.root.position.copy(head);this.root.position.y+=.43;const width=Math.max(2.5,Math.min(7,distance*.12));this.root.scale.set(width,width*96/512,1);
 }
 dispose(){this.root.removeFromParent();this.texture.dispose();(this.root.material as T.SpriteMaterial).dispose();}
}
