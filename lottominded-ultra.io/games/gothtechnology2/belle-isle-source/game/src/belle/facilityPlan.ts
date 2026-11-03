import {SHELTER_PROFILES} from './shelterProfiles.ts';
import {ENCLOSED_SHELTERS} from './referenceSites.ts';
import type {Point,ParkMap} from './terrain.ts';
export type FacilitySite={id:string;name:string;kind:'shelter'|'restroom'|'shed';points:Point[];center:Point;roof:string;source:string};
export type ParkFacilities={version:number;sites:FacilitySite[];gates:{id:string;p:Point;kind:string;yaw:number;width:number;source:string}[];fences:{id:string;a:Point;b:Point;height:number;style:'stone'|'iron'|'wire'}[];notes:string};
export type FacilitySolid={a:Point;b:Point;radius:number;height:number;kind:string};
export type ShelterPlan={site:FacilitySite;posts:Point[];tables:{p:Point;yaw:number}[];eave:number};
const distance=(p:Point,a:Point,b:Point)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);};
const within=(p:Point,poly:Point[])=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
export function facilityPlan(map:ParkMap){
 const solids:FacilitySolid[]=[],shelters:ShelterPlan[]=[];
 for(const site of map.facilities?.sites||[]){if(site.kind!=='shelter'||ENCLOSED_SHELTERS.has(site.id))continue;const ring=site.points.slice(0,-1),posts:Point[]=[];
  // Even perimeter supports, inset from the roof line; never fill the pavilion with a box collider.
  let perimeter=0;const lengths=ring.map((p,i)=>{const q=ring[(i+1)%ring.length],l=Math.hypot(q[0]-p[0],q[1]-p[1]);perimeter+=l;return l;});
  const count=Math.max(4,Math.min(16,Math.round(perimeter/5)));for(let j=0;j<count;j++){let t=perimeter*j/count,i=0;while(t>lengths[i]&&i<ring.length-1){t-=lengths[i++];}const p=ring[i],q=ring[(i+1)%ring.length],k=t/lengths[i],x=p[0]+(q[0]-p[0])*k,z=p[1]+(q[1]-p[1])*k;const d=Math.hypot(x-site.center[0],z-site.center[1])||1;const point:Point=[x+(site.center[0]-x)*.5/d,z+(site.center[1]-z)*.5/d];if(within(point,site.points))posts.push(point);}
  const longest=lengths.indexOf(Math.max(...lengths)),a=ring[longest],b=ring[(longest+1)%ring.length],yaw=Math.atan2(b[1]-a[1],b[0]-a[0]);
  const tables: ShelterPlan['tables']=[];for(const side of [-1,1]){const p:Point=[site.center[0]-Math.sin(yaw)*2.7*side,site.center[1]+Math.cos(yaw)*2.7*side];if(within(p,site.points)&&ring.every((a,i)=>distance(p,a,ring[(i+1)%ring.length])>1.6))tables.push({p,yaw});}
  const eave=SHELTER_PROFILES[site.id]?.eave??3.1;shelters.push({site,posts,tables,eave});for(const p of posts)solids.push({a:p,b:p,radius:site.id==='107202876'?.35:.17,height:eave,kind:'shelter post'});for(const t of tables)solids.push({a:[t.p[0]-Math.cos(t.yaw)*.9,t.p[1]-Math.sin(t.yaw)*.9],b:[t.p[0]+Math.cos(t.yaw)*.9,t.p[1]+Math.sin(t.yaw)*.9],radius:.7,height:.85,kind:'picnic table'});
 }
 for(const f of map.facilities?.fences||[])solids.push({a:f.a,b:f.b,radius:f.style==='stone'?.17:.055,height:f.height,kind:'fence'});
 for(const g of map.facilities?.gates||[]){const n:Point=[-Math.sin(g.yaw),Math.cos(g.yaw)],d:Point=[Math.cos(g.yaw),Math.sin(g.yaw)];for(const side of [-1,1]){const p:Point=[g.p[0]+n[0]*g.width*.5*side,g.p[1]+n[1]*g.width*.5*side];solids.push({a:p,b:[p[0]+d[0]*2.2,p[1]+d[1]*2.2],radius:.08,height:1.15,kind:'open gate'});}}
 return {shelters,solids};
}
/** Grid bounds per-query work even with long mapped fences. */
export class FacilityCollision {
 private cells=new Map<string,Set<FacilitySolid>>();readonly solids:FacilitySolid[];
 constructor(map:ParkMap){this.solids=facilityPlan(map).solids;for(const s of this.solids)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-s.radius)/32);x<=Math.floor((Math.max(s.a[0],s.b[0])+s.radius)/32);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-s.radius)/32);z<=Math.floor((Math.max(s.a[1],s.b[1])+s.radius)/32);z++){const k=x+','+z;if(!this.cells.has(k))this.cells.set(k,new Set());this.cells.get(k)!.add(s);}}
 private query(x0:number,z0:number,x1:number,z1:number,r:number){const out=new Set<FacilitySolid>();for(let x=Math.floor((Math.min(x0,x1)-r)/32);x<=Math.floor((Math.max(x0,x1)+r)/32);x++)for(let z=Math.floor((Math.min(z0,z1)-r)/32);z<=Math.floor((Math.max(z0,z1)+r)/32);z++)for(const s of this.cells.get(x+','+z)||[])out.add(s);return out;}
 blocked(x:number,z:number,margin=0){for(const s of this.query(x,z,x,z,margin))if(distance([x,z],s.a,s.b)<s.radius+margin)return true;return false;}
 ray(o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half:number){let hit=max+1;for(const s of this.query(o.x,o.z,o.x+d.x*max,o.z+d.z*max,half)){
  const dx=s.b[0]-s.a[0],dz=s.b[1]-s.a[1],len=Math.hypot(dx,dz),c=len?dx/len:1,n=len?dz/len:0,px=o.x-(s.a[0]+s.b[0])/2,pz=o.z-(s.a[1]+s.b[1])/2,r=s.radius+half;let lo=0,hi=max;
  for(const [p,v,a,b]of [[px*c+pz*n,d.x*c+d.z*n,-len/2-r,len/2+r],[-px*n+pz*c,-d.x*n+d.z*c,-r,r],[o.y,d.y,1.9,2+s.height]]){if(Math.abs(v)<1e-8){if(p<a||p>b){lo=max+1;break;}}else{const q=(a-p)/v,t=(b-p)/v;lo=Math.max(lo,Math.min(q,t));hi=Math.min(hi,Math.max(q,t));}}
  if(lo<=hi&&lo<hit)hit=lo;
 }return hit<=max?hit:null;}
}
