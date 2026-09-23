import * as T from 'three';
import {cutPoint,heightAt} from './world.ts';
import {toLocal} from './geo-profile.ts';
import {rampLift,type CourseFeature} from './courseFeatures.ts';
export class CourseFeatureView {
 private items:T.Group[]=[];
 constructor(private scene:T.Scene){}
 set(features:readonly CourseFeature[]){for(const g of this.items){g.removeFromParent();g.traverse(o=>{const m=o as T.Mesh;if(m.isMesh||(o as T.LineSegments).isLineSegments){m.geometry.dispose();for(const material of Array.isArray(m.material)?m.material:[m.material]){(material as T.MeshBasicMaterial).map?.dispose();material.dispose();}}});}this.items=[];
  for(const f of features){const group=new T.Group(),positions:number[]=[];const vertex=(d:number,u:number)=>{const q=cutPoint(d,u),p=toLocal(q.x,heightAt(q.x,q.z)+rampLift(f,d)+.025,q.z);return[p.x,p.y,p.z];};
   for(let i=0;i<12;i++){const a=f.station+f.length*i/12,b=f.station+f.length*(i+1)/12,l=f.offset-f.width/2,r=f.offset+f.width/2;positions.push(...vertex(a,l),...vertex(b,l),...vertex(a,r),...vertex(a,r),...vertex(b,l),...vertex(b,r));}
   if(f.kind==='jump'){
    const a=f.station,b=a+f.length,l=f.offset-f.width/2,r=f.offset+f.width/2;
    const base=(d:number,u:number)=>{const q=cutPoint(d,u),p=toLocal(q.x,heightAt(q.x,q.z)+.025,q.z);return[p.x,p.y,p.z];};
    positions.push(...base(a,l),...base(b,l),...vertex(b,l),...base(a,r),...vertex(b,r),...base(b,r),...base(b,l),...base(b,r),...vertex(b,l),...vertex(b,l),...base(b,r),...vertex(b,r));
   }
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const material=new T.MeshStandardMaterial({color:f.kind==='jump'?0x987346:0x416e7b,roughness:f.kind==='jump'?.8:.12,metalness:f.kind==='jump'?.1:.4,side:T.DoubleSide});const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);
   const edges=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:f.kind==='jump'?0xffcc5e:0x86d8ed}));group.add(edges);
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#142c2a';ctx.fillRect(0,0,512,192);ctx.strokeStyle='#f8d66e';ctx.lineWidth=12;ctx.strokeRect(6,6,500,180);ctx.fillStyle='#fff1ba';ctx.font='bold 50px sans-serif';ctx.textAlign='center';ctx.fillText(f.kind==='jump'?'JUMP AHEAD':'SLIPPERY',256,82);ctx.font='32px sans-serif';ctx.fillText('20 m · PASS OTHER SIDE',256,140);
   const sign=new T.Mesh(new T.PlaneGeometry(1.7,.64),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),side:T.DoubleSide})),q=cutPoint(f.station-20,Math.sign(f.offset)*2.5),p=toLocal(q.x,heightAt(q.x,q.z),q.z);sign.position.set(p.x,p.y+1.25,p.z);sign.rotation.y=-q.heading+Math.PI;group.add(sign);const pole=new T.Mesh(new T.CylinderGeometry(.025,.025,1.25,5),new T.MeshStandardMaterial({color:0xc4b88b}));pole.position.set(p.x,p.y+.625,p.z);group.add(pole);const centre=cutPoint(f.station);group.userData.center=toLocal(centre.x,0,centre.z);this.scene.add(group);this.items.push(group);
  }
 }
 update(players:readonly {x:number;z:number}[]){for(const g of this.items){const p=g.userData.center;g.visible=players.some(r=>Math.hypot(r.x-p.x,r.z-p.z)<160);}}
}
