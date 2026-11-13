/** Resolve a beach by its mapped footprint, not distance to a landmark centroid. */
type Point=readonly [number,number];
type Polygon=readonly Point[];
type BeachArea={kind:string;name:string;points:Polygon;holes?:readonly Polygon[]};

function contains(x:number,z:number,points:Polygon):boolean{
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[j],b=points[i];
  const cross=(x-a[0])*(b[1]-a[1])-(z-a[1])*(b[0]-a[0]);
  if(Math.abs(cross)<=1e-9&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&z>=Math.min(a[1],b[1])&&z<=Math.max(a[1],b[1]))return true;
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}

export function createBeachLocator(areas:readonly BeachArea[]):(x:number,z:number)=>string|undefined{
 const beaches=areas.filter(a=>a.kind==='beach'&&a.name.trim()&&a.points.length>=3).map(area=>({
  area,minX:Math.min(...area.points.map(p=>p[0])),maxX:Math.max(...area.points.map(p=>p[0])),
  minZ:Math.min(...area.points.map(p=>p[1])),maxZ:Math.max(...area.points.map(p=>p[1]))
 }));
 return (x,z)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z))return undefined;
  for(const b of beaches){
   if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)continue;
   if(contains(x,z,b.area.points)&&!b.area.holes?.some(h=>contains(x,z,h)))return b.area.name;
  }
  return undefined;
 };
}
