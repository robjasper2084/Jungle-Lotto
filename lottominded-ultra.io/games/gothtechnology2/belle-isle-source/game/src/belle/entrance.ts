import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roadIndex} from './streetPlan.ts';
import type {ParkMap,ParkTerrain} from './terrain.ts';

/** Reference-informed welcome sign at its mapped Jefferson Avenue location.
 * The photograph is observation only: lettering and ornaments are authored here.
 * Tulips are a spring presentation, not a claim about year-round planting. */
export function addEntrance(scene:T.Scene,data:ParkMap,terrain:ParkTerrain){
 const sign=data.entranceSign;if(!sign)return;
 const [x,z]=sign.point,y=terrain.height(x,z),yaw=(180-sign.direction)*Math.PI/180;
 const group=new T.Group();group.name='Belle Isle Park entrance · Jefferson Avenue';group.position.set(x,y,z);group.rotation.y=yaw;scene.add(group);
 const dark=new T.MeshStandardMaterial({color:0x252f32,roughness:.73,metalness:.38}),panel=new T.MeshStandardMaterial({color:0x687a80,roughness:.86});
 function box(w:number,h:number,d:number,px:number,py:number,pz:number,m:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;}
 box(5.6,1.7,.20,0,1.75,0,panel);
 for(const side of [-1,1]){box(.13,2.9,.16,side*2.95,1.45,0,dark);box(.13,.13,.32,side*2.95,2.85,0,dark);}
 box(6.04,.12,.25,0,2.66,0,panel);box(6.04,.12,.25,0,.84,0,panel);
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=512;const c=canvas.getContext('2d')!;
 c.fillStyle='#71858d';c.fillRect(0,0,1536,512);c.strokeStyle='#303c40';c.lineWidth=9;c.strokeRect(12,12,1512,488);
 // Curved ivory scroll, wine-red serif title and inset fountain medallion.
 c.beginPath();c.moveTo(76,96);c.bezierCurveTo(330,132,1110,1,1458,96);c.lineTo(1458,307);c.bezierCurveTo(1130,215,380,264,76,307);c.closePath();c.fillStyle='#e5ddc9';c.fill();c.strokeStyle='#6b4236';c.lineWidth=4;c.stroke();
 c.fillStyle='#6e302b';c.font='bold 133px Georgia';c.textAlign='center';c.fillText('BELLE ISLE PARK',768,240,1330);
 c.beginPath();c.ellipse(768,376,136,104,0,0,Math.PI*2);c.fillStyle='#9fc0ca';c.fill();c.strokeStyle='#3f4c50';c.stroke();
 c.fillStyle='#253b40';c.fillRect(681,426,174,9);c.fillRect(706,409,124,9);c.fillRect(746,343,44,69);c.beginPath();c.ellipse(768,347,66,11,0,0,Math.PI*2);c.fill();c.fillRect(762,321,12,28);c.beginPath();c.arc(768,311,11,0,Math.PI*2);c.fill();
 c.fillStyle='#d8c6a0';c.font='32px Georgia';c.fillText('CITY OF DETROIT',350,380);c.fillText('RECREATION DEPT.',1170,380);
 c.beginPath();c.arc(1420,84,57,0,Math.PI*2);c.fillStyle='#243a35';c.fill();c.strokeStyle='#ccbb83';c.lineWidth=5;c.stroke();c.font='17px Georgia';c.fillStyle='#e2d4a6';c.fillText('MICHIGAN',1420,75);c.fillText('STATE PARK',1420,103);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const face=new T.Mesh(new T.PlaneGeometry(5.6,1.7),new T.MeshStandardMaterial({map:texture,roughness:.9}));face.position.set(0,1.75,.108);group.add(face);
 const reverse=face.clone();reverse.rotation.y=Math.PI;reverse.position.z=-.108;group.add(reverse);
 const occupied=roadIndex(data.roads),dummy=new T.Object3D(),color=new T.Color();let seed=42;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const stemsG=new T.CylinderGeometry(.012,.018,.5,5).translate(0,.25,0),leafG=new T.SphereGeometry(1,5,3).scale(.05,.25,.025).rotateZ(.3).translate(.055,.2,0);
 const greenery=mergeGeometries([stemsG,leafG,leafG.clone().rotateY(Math.PI)])!;
 const stems=new T.InstancedMesh(greenery,new T.MeshStandardMaterial({color:0x4e7137,roughness:1}),420);
 const cup=new T.LatheGeometry([new T.Vector2(.025,0),new T.Vector2(.09,.04),new T.Vector2(.12,.16),new T.Vector2(.11,.23)],8).translate(0,.48,0);
 const blooms=new T.InstancedMesh(cup,new T.MeshStandardMaterial({color:0xffffff,roughness:.85,side:T.DoubleSide}),420);
 let count=0;const co=Math.cos(yaw),si=Math.sin(yaw);
 for(let attempt=0;attempt<650&&count<420;attempt++){
  const lx=(random()-.5)*9,lz=.7+random()*4.5;if((lx/4.5)**2+((lz-2.7)/2.5)**2>1)continue;
  const wx=x+co*lx+si*lz,wz=z-si*lx+co*lz;
  if(!terrain.land(wx,wz)||occupied(wx,wz,'',.55))continue;
  dummy.position.set(wx,terrain.height(wx,wz)+.03,wz);dummy.rotation.set(0,random()*6.28,0);const scale=.7+random()*.5;dummy.scale.setScalar(scale);dummy.updateMatrix();stems.setMatrixAt(count,dummy.matrix);blooms.setMatrixAt(count,dummy.matrix);const hue=random();blooms.setColorAt(count++,color.setHSL(hue<.83?.005:hue<.94?.13:.79,.72,.36+random()*.14));
 }
 stems.count=blooms.count=count;for(const mesh of[stems,blooms]){mesh.name='Jefferson entrance tulip bed';mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);}
 const shrub=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0x607441,roughness:1}),36);let n=0;
 for(let i=0;i<36;i++){const lx=(i%12-5.5)*.63,lz=-.8+Math.floor(i/12)*.4,wx=x+co*lx+si*lz,wz=z-si*lx+co*lz;if(occupied(wx,wz,'',.55)||!terrain.land(wx,wz))continue;dummy.position.set(wx,terrain.height(wx,wz)+.32,wz);dummy.scale.set(.52,.36+random()*.13,.5);dummy.updateMatrix();shrub.setMatrixAt(n++,dummy.matrix);}
 shrub.count=n;shrub.name='Entrance evergreen border';shrub.computeBoundingSphere();scene.add(shrub);
}
