import * as T from 'three';
import type {BoatController} from './boatController.ts';
/** One 1024x256 instrument texture, refreshed at 10 Hz while occupied. */
export class BoatCockpit{
 private canvas=document.createElement('canvas');private context:CanvasRenderingContext2D;private texture:T.CanvasTexture;private next=0;
 constructor(panel:T.Mesh){this.canvas.width=1024;this.canvas.height=256;this.context=this.canvas.getContext('2d')!;this.texture=new T.CanvasTexture(this.canvas);this.texture.flipY=false;this.texture.colorSpace=T.SRGBColorSpace;this.texture.anisotropy=4;panel.material=new T.MeshBasicMaterial({map:this.texture,side:T.DoubleSide,toneMapped:false});}
 update(sim:BoatController,time:number,force=false){if(!force&&time<this.next)return;this.next=time+.1;const c=this.context,t=sim.telemetry,p=sim.pose;
  c.fillStyle='#08171e';c.fillRect(0,0,1024,256);c.strokeStyle='#38515a';c.strokeRect(1,1,1022,254);
  const text=(s:string,x:number,y:number,size=20,color='#d4eee9')=>{c.fillStyle=color;c.font=`600 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);};
  const gauge=(x:number,value:number,max:number,label:string,reading:string)=>{const y=118,r=82;c.lineWidth=5;c.strokeStyle='#90a8ac';c.beginPath();c.arc(x,y,r,.75*Math.PI,2.25*Math.PI);c.stroke();for(let i=0;i<=10;i++){const a=(.75+i*.15)*Math.PI;c.lineWidth=2;c.beginPath();c.moveTo(x+Math.cos(a)*(r-8),y+Math.sin(a)*(r-8));c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.stroke();}const a=(.75+Math.min(1,Math.abs(value)/max)*1.5)*Math.PI;c.strokeStyle='#ef493f';c.lineWidth=4;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*66,y+Math.sin(a)*66);c.stroke();text(reading,x,158,24);text(label,x,186,14);};
  gauge(112,p.speed*2.23694,sim.kind==='hydroplane'?220:110,'MPH',(p.speed*2.23694).toFixed(0));
  gauge(310,sim.kind==='hydroplane'?t.powerPercent:t.rpm,sim.kind==='hydroplane'?110:7000,sim.kind==='hydroplane'?'N2 % · MODEL':'ENGINE RPM',sim.kind==='hydroplane'?t.powerPercent.toFixed(0):Math.round(t.rpm).toString());
  c.save();c.beginPath();c.rect(425,34,180,165);c.clip();c.translate(515,116);c.rotate(-p.roll);const horizon=p.pitch*350;c.fillStyle='#28607c';c.fillRect(-170,-180,340,180+horizon);c.fillStyle='#795a38';c.fillRect(-170,horizon,340,180);c.strokeStyle='#e5f2ed';c.lineWidth=3;c.beginPath();c.moveTo(-170,horizon);c.lineTo(170,horizon);c.stroke();c.restore();c.strokeStyle='#f6d274';c.beginPath();c.moveTo(466,116);c.lineTo(502,116);c.lineTo(515,126);c.lineTo(528,116);c.lineTo(564,116);c.stroke();text('HORIZON',515,221,14);
  const heading=(180-p.heading*180/Math.PI+360)%360;
  text(Math.abs(p.speed).toFixed(1)+' m/s',714,57,28);text(Math.round(heading).toString().padStart(3,'0')+'°',714,94,24);text(t.gForce.toFixed(2)+' G',714,132,23);text(Math.round(t.torqueNm)+' Nm',714,169,22);
  text('POWER',928,51,15);text(Math.round(t.powerPercent)+'%',928,86,30);c.fillStyle='#29404a';c.fillRect(866,104,124,12);c.fillStyle='#ed5348';c.fillRect(866,104,124*t.powerPercent/100,12);
  const state=sim.collision?'CONTACT':Math.abs(p.speed)<.2?'IDLE':t.planing>.8?'ON PLANE':'ACCELERATING';text(state,914,164,15,sim.collision?'#ff8975':t.planing>.8?'#8ce7ba':'#e8c578');
  text(sim.profile.name.toUpperCase(),225,232,16);text('MODELED ENGINE · LIVE MOTION',824,232,13,'#8eafb7');this.texture.needsUpdate=true;
 }
 dispose(){this.texture.dispose();}
}
