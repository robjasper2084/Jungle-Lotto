import * as T from 'three';
import {makeRoadSign} from './roadSigns.ts';
import {CITY,riverEdge} from './geography.ts';
import {heightAt,type DetroitWorld} from './world.ts';
import {MILLIKEN_BERM} from './millikenTerrain.ts';
/** Authored landscape detail on mapped roads. No map photography is baked into assets. */
export function buildRiverfrontDetails(scene:T.Scene,world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group){
 const concrete=new T.MeshStandardMaterial({color:0xb8b4a8,roughness:.92}),metal=new T.MeshStandardMaterial({color:0x263e3b,metalness:.5,roughness:.48}),asphalt=new T.MeshStandardMaterial({color:0x424747,roughness:.96}),white=new T.MeshStandardMaterial({color:0xe2e3cf});
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,angle=0){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.rotation.y=angle;mesh.receiveShadow=true;groupAt(x,z).add(mesh);return mesh;}
 function sign(x:number,z:number,name:string,stop=false,angle=0,allWay=false){const root=makeRoadSign(name,stop,allWay);root.position.set(x,heightAt(x,z),z);root.rotation.y=angle;groupAt(x,z).add(root);}
 // Label actual named streets at well-separated visible road starts.
 const used:{x:number;z:number;name:string}[]=[];
 for(const road of CITY.roads){if(!road.name)continue;const p=road.points[0],q=road.points[1];if(!q||!world.chunks.some(c=>Math.abs(c.x-p[0])<50&&Math.abs(c.z-p[1])<50)||used.some(a=>a.name===road.name&&Math.hypot(a.x-p[0],a.z-p[1])<180))continue;
  const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<1)continue;const x=p[0]+dz/len*(road.width/2+1.7),z=p[1]-dx/len*(road.width/2+1.7);sign(x,z,road.name,false,Math.atan2(dx,dz));used.push({x,z,name:road.name});
 }
 // Orleans/Atwater all-way stop visible in Google Street View, Nov 2024.
 // Positions follow mapped curb approaches; offsets are approximate, not surveyed.
 const junctionX=-69.07,junctionZ=-1134.33;
 for(const [ux,uz] of [[.996,-.086],[.079,.997],[-.079,-.997]]){
  sign(junctionX+ux*9-uz*5.5,junctionZ+uz*9+ux*5.5,'STOP',true,Math.atan2(ux,uz),true);
  // Paired crosswalk boundary lines and a stop bar, as seen in the Orleans panorama.
  const angle=Math.atan2(ux,uz);
  for(const distance of [5.2,7.5]){const x=junctionX+ux*distance,z=junctionZ+uz*distance;box(x,heightAt(x,z)+.07,z,8.6,.012,.12,white,angle);}
  const x=junctionX+ux*9-uz*2.25,z=junctionZ+uz*9+ux*2.25;box(x,heightAt(x,z)+.075,z,4.2,.015,.30,white,angle);
 }
 // Other controls remain authored outside the Atwater corridor; do not fabricate its inventory.
 const stops:{x:number;z:number}[]=[];
 for(const road of CITY.roads){if(!road.name||['Atwater Street','Mack Avenue','Jefferson Avenue'].includes(road.name))continue;
  for(const end of [0,road.points.length-1]){const p=road.points[end],q=road.points[end===0?1:end-1];if(!q)continue;
   if(!world.chunks.some(c=>Math.abs(c.x-p[0])<50&&Math.abs(c.z-p[1])<50))continue;
   if(p[0]<200&&p[1]<-650)continue;
   const junction=CITY.roads.some(other=>other.name!==road.name&&other.width>=road.width&&other.points.some(v=>Math.hypot(v[0]-p[0],v[1]-p[1])<9));if(!junction)continue;
   const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<10)continue;const ux=dx/len,uz=dz/len;
   const x=p[0]+ux*9-uz*(road.width/2+1),z=p[1]+uz*9+ux*(road.width/2+1);
   if(stops.some(a=>Math.hypot(a.x-x,a.z-z)<14))continue;sign(x,z,'STOP',true,Math.atan2(ux,uz));stops.push({x,z});
  }
 }
 // Small off-street lots beside the fictional Mack destinations, with clear drive aisles.
 for(const x of [2495,2583]){const z=-1471,y=heightAt(x,z);box(x,y+.025,z,20,.05,25,asphalt);
  for(let i=0;i<=6;i++)box(x-8+i*2.7,y+.057,z-6,.09,.015,5.4,white);
  box(x,y+.15,z-12.2,20,.25,.25,concrete);sign(x+9,z+10,'STOP',true,-Math.PI/2);
  const plane=new T.PlaneGeometry(20,25);plane.rotateX(-Math.PI/2);plane.translate(x,y+.05,z);const indexed=plane.toNonIndexed();world.addRideSurface(indexed.attributes.position.array as Float32Array);plane.dispose();indexed.dispose();
 }
 // A gently curving paved viewing walk climbs the berm. Match render and collision.
 const b=MILLIKEN_BERM;
 for(let i=0;i<70;i++){const t=i/69,z=b.z+b.rz*.92*(1-t),x=b.x+Math.sin(t*Math.PI*1.4)*10;const y=heightAt(x,z),nextT=Math.min(1,t+1/69),nz=b.z+b.rz*.92*(1-nextT),nx=b.x+Math.sin(nextT*Math.PI*1.4)*10;const angle=Math.atan2(nx-x,nz-z);box(x,y+.04,z,2.6,.08,1.9,concrete,angle);const p=new T.PlaneGeometry(2.6,1.9);p.rotateX(-Math.PI/2);p.rotateY(angle);p.translate(x,y+.08,z);const g=p.toNonIndexed();world.addRideSurface(g.attributes.position.array as Float32Array);p.dispose();g.dispose();}
 sign(b.x+5,b.z,'Ze Mound');
 // Handrails follow the same sampled berm as the walking surface.
 for(let i=0;i<35;i++){const t=i/34,z=b.z+b.rz*.92*(1-t),x=b.x+Math.sin(t*Math.PI*1.4)*10;
  for(const side of [-1,1]){const px=x+side*1.65,y=heightAt(px,z);box(px,y+.52,z,.055,1.04,.055,metal);
   if(i<34){const nt=(i+1)/34,nz=b.z+b.rz*.92*(1-nt),nx=b.x+Math.sin(nt*Math.PI*1.4)*10+side*1.65,ny=heightAt(nx,nz)+1.04;
    const a=new T.Vector3(px,y+1.04,z),q=new T.Vector3(nx,ny,nz),d=q.clone().sub(a);const rail=new T.Mesh(new T.CylinderGeometry(.035,.035,d.length(),6),metal);rail.position.copy(a).add(q).multiplyScalar(.5);rail.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());groupAt(px,z).add(rail);
   }
  }
 }

 // River surface follows the mapped shoreline instead of covering park terrain.
 const positions:number[]=[];for(let z=-1900;z<450;z+=20){const a=riverEdge(z)-3,c=riverEdge(z+20)-3;positions.push(a,-.3,z,a-1400,-.3,z,c,-.3,z+20,c,-.3,z+20,a-1400,-.3,z,c-1400,-.3,z+20);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const time={value:0};const water=new T.MeshStandardMaterial({color:0x285d68,metalness:.35,roughness:.3,side:T.DoubleSide});water.onBeforeCompile=s=>{s.uniforms.riverTime=time;s.vertexShader='uniform float riverTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += .055*sin(position.x*.16+riverTime*.8)+.035*cos(position.z*.22-riverTime*.6);');};const mesh=new T.Mesh(geometry,water);mesh.name='Detroit River shoreline';scene.add(mesh);
 return {update:(seconds:number)=>{time.value=seconds;}};
}
