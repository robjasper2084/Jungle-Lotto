export type MonumentSolid={x:number;z:number;radius:number;height:number};
type Monument={x:number;z:number;radius:number;height:number;model:string;yaw:number;indoor?:boolean};
// Pedestal footprints, rather than decorative horns, arms or water jets.
export function monumentSolids(monuments:Monument[]):MonumentSolid[]{
 return monuments.flatMap(m=>{
  if(m.indoor)return [];
  if(m.model==='one_world')return [-1,1].map(side=>({x:m.x+side*Math.cos(m.yaw),z:m.z-side*Math.sin(m.yaw),radius:.38,height:.56}));
  const radius=({scott_fountain:24.74,barbour:4.65,williams:3.2,flagpole:4.1,pond_lantern:.6} as Record<string,number>)[m.model]??m.radius;
  return [{x:m.x,z:m.z,radius,height:m.height}];
 });
}
export function rayMonument(o:{x:number;y:number;z:number},d:{x:number;z:number},max:number,s:MonumentSolid,half:number){
 if(o.y>2+s.height+.2)return null;
 const x=o.x-s.x,z=o.z-s.z,r=s.radius+half,c=x*x+z*z-r*r;
 if(c<=0)return 0;
 const a=d.x*d.x+d.z*d.z;if(a<1e-10)return null;
 const b=x*d.x+z*d.z,disc=b*b-a*c;if(disc<0)return null;
 const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=max?t:null;
}
