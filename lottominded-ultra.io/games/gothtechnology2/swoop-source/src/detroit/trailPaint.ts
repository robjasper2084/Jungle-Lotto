import * as T from 'three';
import {cutPoint,heightAt} from './world.ts';
import {cutWidth,GEO,nearestRamp} from './geo-profile.ts';

/** Separate pedestrian strip and opposing bicycle arrows, from the supplied Cut photo. */
export function trailPaintSites(){
 const sites:{at:number;offset:number;type:'bike'|'walk'|'arrow';reverse:boolean}[]=[];
 for(let at=70;at<2550;at+=110){
  if(GEO.bridges.some(b=>Math.abs(b.at-at)<24))continue;
  const width=cutWidth(at),p=cutPoint(at);
  if(nearestRamp(p.x,p.z).distance<12)continue;
  for(const [offset,type,reverse] of [[-width*.25,'bike',true],[width*.23,'bike',false],[width*.34,'walk',false]] as const){
   const station=at+(type==='walk'?9:0);
   sites.push({at:station,offset,type,reverse});sites.push({at:station+(reverse?-3:3),offset,type:'arrow',reverse});
  }
 }
 return sites;
}
export function buildTrailPaint(groupAt:(x:number,z:number)=>T.Group){
 const materials=new Map<string,T.MeshStandardMaterial>();
 for(const type of ['bike','walk','arrow']){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=384;const c=canvas.getContext('2d')!;
  c.strokeStyle=c.fillStyle='#e2e0ce';c.lineWidth=13;c.lineCap='round';c.lineJoin='round';
  const line=(points:number[][])=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
  const circle=(x:number,y:number,r:number,fill=false)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);fill?c.fill():c.stroke();};
  if(type==='bike'){
   circle(58,252,43);circle(198,252,43);line([[58,252],[104,163],[151,252],[58,252]]);line([[151,252],[180,158],[198,252]]);line([[104,163],[180,158],[170,131],[195,131]]);line([[85,154],[120,154]]);
  }else if(type==='walk'){
   circle(140,65,22,true);line([[130,112],[112,206],[76,306]]);line([[112,206],[174,249],[190,311]]);line([[125,132],[78,176],[47,173]]);line([[128,134],[171,180],[207,186]]);
  }else{
   c.beginPath();c.moveTo(128,58);c.lineTo(220,164);c.lineTo(157,164);c.lineTo(157,314);c.lineTo(99,314);c.lineTo(99,164);c.lineTo(36,164);c.closePath();c.fill();
  }
  // A restrained worn-paint pattern, shared by every instance.
  c.globalCompositeOperation='destination-out';for(let i=0;i<380;i++){const x=(i*73)%256,y=(i*137)%384;c.fillRect(x,y,1+(i%3),1);}
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  materials.set(type,new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2}));
 }
 const sites=trailPaintSites();
 for(const site of sites){
  const width=site.type==='arrow'?.68:site.type==='walk'?.8:1.12,height=site.type==='arrow'?1.45:1.65;
  const geo=new T.PlaneGeometry(width,height,1,4),a=geo.attributes.position;
  const p=cutPoint(site.at,site.offset),yaw=p.heading+(site.reverse?Math.PI:0);
  // Conform every vertex to the riding surface; map reflection keeps forward at the top.
  for(let i=0;i<a.count;i++){
   const x=a.getX(i),z=a.getY(i),wx=p.x+Math.cos(yaw)*x+Math.sin(yaw)*z,wz=p.z-Math.sin(yaw)*x+Math.cos(yaw)*z;
   a.setXYZ(i,wx,heightAt(wx,wz)+.052,wz);
  }
  // Mapping plane +Y to map +Z reverses its winding.
  const index=geo.index!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,materials.get(site.type));mesh.name='Painted trail '+site.type;mesh.receiveShadow=true;mesh.renderOrder=2;groupAt(p.x,p.z).add(mesh);
 }
 return sites.length;
}
