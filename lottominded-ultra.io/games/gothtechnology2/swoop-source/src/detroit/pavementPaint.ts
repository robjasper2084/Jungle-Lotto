import * as T from 'three';
export function pavementMaterials(){
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
 return materials;
}
export function paintGeometry(width:number,length:number,x:number,z:number,yaw:number,height:(x:number,z:number)=>number){
 const geo=new T.PlaneGeometry(width,length,1,Math.max(4,Math.ceil(length))),a=geo.attributes.position;
 for(let i=0;i<a.count;i++){const u=a.getX(i),v=a.getY(i),wx=x+Math.cos(yaw)*u+Math.sin(yaw)*v,wz=z-Math.sin(yaw)*u+Math.cos(yaw)*v;a.setXYZ(i,wx,height(wx,wz)+.065,wz);}
 const index=geo.index!;for(let i=0;i<index.count;i+=3){const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);}geo.computeVertexNormals();return geo;
}
