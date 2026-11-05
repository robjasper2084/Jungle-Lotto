import type {ParkMap,Point} from './terrain.ts';
// Kept independent of ParkTerrain so rendering and tyre/foot support share one
// profile. Only mapped beach footprints are graded; no road or building moves.
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function distance(x:number,z:number,a:Point,b:Point){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function contains(x:number,z:number,p:Point[]){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
export function makeBeachProfiles(map:ParkMap){
 return map.areas.filter(a=>a.kind==='beach').map(a=>{
  const edges=a.points.slice(1).map((b,i)=>({a:a.points[i],b})).filter(e=>Math.hypot(e.a[0]-e.b[0],e.a[1]-e.b[1])>.01);
  const waterside=edges.filter(e=>{const x=(e.a[0]+e.b[0])/2,z=(e.a[1]+e.b[1])/2;return map.island.slice(1).some((p,i)=>distance(x,z,map.island[i],p)<.15);});
  const back=edges.filter(e=>!waterside.includes(e)),xs=a.points.map(p=>p[0]),zs=a.points.map(p=>p[1]);
  return{id:a.id,points:a.points,waterside,back,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
 });
}
export type BeachProfile=ReturnType<typeof makeBeachProfiles>[number];
export function beachHeight(profiles:BeachProfile[],x:number,z:number){
 for(const p of profiles){
  if(x<p.minX-.02||x>p.maxX+.02||z<p.minZ-.02||z>p.maxZ+.02||!p.waterside.length||!p.back.length)continue;
  const wet=Math.min(...p.waterside.map(e=>distance(x,z,e.a,e.b))),dry=Math.min(...p.back.map(e=>distance(x,z,e.a,e.b)));
  if(!contains(x,z,p.points)&&Math.min(wet,dry)>.025)continue;
  // Taper the grade in narrow corners instead of producing a sharp trench.
  const breadth=wet+dry,grade=smooth(2,12,breadth);
  return 2-1.88*grade*(1-smooth(0,1,wet/Math.max(.001,breadth)));
 }
 return 2;
}
