import * as T from 'three';
import {GEO,nearestRamp,cutWidth} from './geo-profile.ts';
import {pointOnCut,nearestCut} from './geography.ts';
import type {DetroitWorld} from './world.ts';
type Point={x:number;y:number;z:number};
export type RailRun={name:string;a:Point;b:Point;height:number;kind:'fence'|'rail'|'gate'};
/** Reference-informed additions: black steel mesh fencing and ramp handrails.
 * Existing mapped bridge parapets remain authoritative. Gates are secured open. */
export function routeRailLayout(heightAt:(x:number,z:number)=>number):RailRun[]{
 const runs:RailRun[]=[];
 for(const ramp of GEO.ramps)for(let i=1;i<ramp.points.length;i++){
  const a=ramp.points[i-1],b=ramp.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.5)continue;
  const count=Math.ceil(len/2.4);
  for(const side of [-1,1])for(let j=0;j<count;j++){
   const point=(t:number)=>{const x=a[0]+dx*t-dz/len*side*(ramp.width/2+.23),z=a[1]+dz*t+dx/len*side*(ramp.width/2+.23);return {x,y:heightAt(x,z),z};};
   runs.push({name:ramp.name+' handrail',a:point(j/count),b:point((j+1)/count),height:1.08,kind:'rail'});
  }
 }
 // Top of the authored retaining walls, with ramp gaps. Avoid putting rails across the trail.
 for(const w of GEO.walls){
    if(w.offset>0&&w.at<945&&w.at+7.8>916)continue; // Open Campbell Terrace frontage.
  const a=pointOnCut(w.at,w.offset),b=pointOnCut(w.at+7.8,w.offset),mid={x:(a.x+b.x)/2,z:(a.z+b.z)/2},r=nearestRamp(mid.x,mid.z);
  if(r.distance<r.width/2+2)continue;
  const count=3;for(let i=0;i<count;i++){
   const point=(t:number)=>{const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;return{x,y:heightAt(x,z)+w.height,z};};
   runs.push({name:'Retaining wall safety fence '+w.at,a:point(i/count),b:point((i+1)/count),height:1.2,kind:'fence'});
  }
 }
 for(const r of GEO.ramps){
  const a=r.points.at(-2)!,b=r.points.at(-1)!,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.5)continue;
  for(const side of [-1,1]){const x=b[0]-dz/len*side*(r.width/2+.42),z=b[1]+dx/len*side*(r.width/2+.42),end={x:x-dx/len*2.2,z:z-dz/len*2.2};
   runs.push({name:r.name+' open access gate',a:{x,y:heightAt(x,z),z},b:{...end,y:heightAt(end.x,end.z)},height:1.25,kind:'gate'});
  }
 }
 return runs.filter(run=>[run.a,run.b,{x:(run.a.x+run.b.x)/2,z:(run.a.z+run.b.z)/2}].every(p=>{const c=nearestCut(p.x,p.z);return Math.abs(c.u)>cutWidth(c.d)/2+.4;}));
}
export function buildRouteRails(world:DetroitWorld,groupAt:(x:number,z:number)=>T.Group,heightAt:(x:number,z:number)=>number){
 const runs=routeRailLayout(heightAt),steel=new T.MeshStandardMaterial({color:'#27383a',metalness:.65,roughness:.55}),wire=new T.LineBasicMaterial({color:'#485451',transparent:true,opacity:.72});
 const lineBins=new Map<T.Group,number[]>();
 const bar=(g:T.Group,a:T.Vector3,b:T.Vector3,width:number)=>{const mesh=new T.Mesh(new T.BoxGeometry(width,a.distanceTo(b),width),steel);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);};
 for(const run of runs){const a=new T.Vector3(run.a.x,run.a.y,run.a.z),b=new T.Vector3(run.b.x,run.b.y,run.b.z),g=groupAt((a.x+b.x)/2,(a.z+b.z)/2),up=new T.Vector3(0,run.height,0);
  for(const p of [a,b])bar(g,p,p.clone().add(up),run.kind==='gate'?.10:.065);
  for(const y of [run.height,.48])bar(g,a.clone().add(new T.Vector3(0,y,0)),b.clone().add(new T.Vector3(0,y,0)),.045);
  if(run.kind!=='rail'){
   const lines=lineBins.get(g)??[],length=a.distanceTo(b),columns=Math.ceil(length/.13);
   for(let i=1;i<columns;i++){const p=a.clone().lerp(b,i/columns);lines.push(p.x,p.y+.10,p.z,p.x,p.y+run.height-.07,p.z);}
   for(let y=.18;y<run.height-.07;y+=.18)lines.push(a.x,a.y+y,a.z,b.x,b.y+y,b.z);
   lineBins.set(g,lines);
  }
  const length=Math.hypot(b.x-a.x,b.z-a.z),mid=a.clone().add(b).multiplyScalar(.5);
  world.addBox({x:mid.x,y:Math.min(a.y,b.y)+run.height/2,z:mid.z,hx:.06,hy:(run.height+Math.abs(b.y-a.y))/2,hz:length/2,kind:'rail',yaw:Math.atan2(b.x-a.x,b.z-a.z)});
 }
 for(const [g,points]of lineBins){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));const mesh=new T.LineSegments(geo,wire);mesh.name='Steel fence mesh';g.add(mesh);}
 return {runs:runs.length,gates:runs.filter(r=>r.kind==='gate').length};
}
