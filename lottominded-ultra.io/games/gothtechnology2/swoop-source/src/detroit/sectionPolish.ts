import * as T from 'three';
import {cutPoint,heightAt,hash} from './world.ts';
import {cutWidth} from './geo-profile.ts';
/** Bounded Gratiot–Adelaide detail pass. Decorative surfaces never replace collision. */
export function polishSection(groupAt:(x:number,z:number)=>T.Group,asphalt:T.MeshStandardMaterial){
 const edge=new T.MeshStandardMaterial({color:'#393b2e',roughness:1}),repair=asphalt.clone();repair.color.set('#676c6a');repair.roughness=.94;
 const steel=new T.MeshStandardMaterial({color:'#323d3c',roughness:.82}),plant=new T.MeshStandardMaterial({color:'#647452',roughness:1,side:T.DoubleSide});
 const put=(d:number,u:number,w:number,length:number,mat:T.Material,offset=.05)=>{
  const p=cutPoint(d,u),vertices:number[]=[],uv:number[]=[];
  for(const [a,b]of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){const v=cutPoint(d+b*length/2,u+a*w/2);vertices.push(v.x-p.x,heightAt(v.x,v.z)+offset,v.z-p.z);uv.push((a+1)/2,(b+1)/2);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();if(geometry.attributes.normal.getY(0)<0){const a=geometry.attributes.position,b=geometry.attributes.uv;for(let i=0;i<a.count;i+=3){const v=new T.Vector3().fromBufferAttribute(a,i+1),t=new T.Vector2(b.getX(i+1),b.getY(i+1));a.setXYZ(i+1,a.getX(i+2),a.getY(i+2),a.getZ(i+2));b.setXY(i+1,b.getX(i+2),b.getY(i+2));a.setXYZ(i+2,v.x,v.y,v.z);b.setXY(i+2,t.x,t.y);}geometry.computeVertexNormals();}
  // These sampled quads follow the bank instead of intersecting it as flat wedges.
  const mesh=new T.Mesh(geometry,mat);mesh.position.set(p.x,0,p.z);mesh.receiveShadow=true;groupAt(p.x,p.z).add(mesh);
 };
 for(let d=1758;d<1851;d+=2)for(const side of [-1,1])put(d,side*(cutWidth(d)/2+.11),.09+hash(d)*.05,2.01,edge,.024);
 for(const [d,u,w,l]of [[1768,-1,1.05,1.7],[1784,1.2,.85,2.2],[1817,-.8,.55,1.2],[1837,.95,.9,1.4]])put(d,u,w,l,repair,.048);
 for(const d of [1763,1846])for(const side of [-1,1]){
  const u=side*(cutWidth(d)/2-.28);put(d,u,.4,.7,steel,.053);
  for(let i=0;i<7;i++)put(d-.27+i*.09,u,.32,.024,edge,.055);
 }
 for(let i=0;i<90;i++){const d=1759+hash(i*19)*88,side=i%2?1:-1,u=side*(cutWidth(d)/2+.6+hash(i*31)*1.4),p=cutPoint(d,u);
  const g=new T.BufferGeometry(),vertices:number[]=[];
  for(let blade=0;blade<3;blade++){const a=blade*Math.PI/3+.2,x=Math.cos(a)*.07,z=Math.sin(a)*.07,h=.18+hash(i+blade)*.28;vertices.push(-x,0,-z,x,0,z,.03,h,.02);}
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const m=new T.Mesh(g,plant);m.position.set(p.x,heightAt(p.x,p.z),p.z);m.receiveShadow=true;groupAt(p.x,p.z).add(m);
 }
}
