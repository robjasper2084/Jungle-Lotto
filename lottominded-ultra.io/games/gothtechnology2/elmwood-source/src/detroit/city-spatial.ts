import detail from './city-detail.json' with {type:'json'};
import elevation from './city-elevation.json' with {type:'json'};
export const CITY_DETAIL=detail;
export const BASE_NAVD88=elevation.baseNavd88Metres;
export const RIVER_Y=174.5-BASE_NAVD88;
export function cityElevation(x:number,z:number){
  const lat=42.3283+(.8660254*x-.5*z)/111320,lon=-83.0399+(-.5*x-.8660254*z)/(111320*Math.cos(42.3283*Math.PI/180));
  const e=elevation.extent,w=elevation.width,h=elevation.height;
  const u=Math.max(0,Math.min(w-1,(lon-e.xmin)/(e.xmax-e.xmin)*w-.5)),v=Math.max(0,Math.min(h-1,(e.ymax-lat)/(e.ymax-e.ymin)*h-.5));
  const a=Math.floor(u),b=Math.floor(v),c=Math.min(a+1,w-1),d=Math.min(b+1,h-1),tx=u-a,tz=v-b,V=elevation.values;
  return (V[b*w+a]*(1-tx)+V[b*w+c]*tx)*(1-tz)+(V[d*w+a]*(1-tx)+V[d*w+c]*tx)*tz-BASE_NAVD88;
}
const shoreCells=new Map<number,number[][][]>();
for(const s of detail.shoreSegments)for(let k=Math.floor(Math.min(s[0][1],s[1][1])/64);k<=Math.floor(Math.max(s[0][1],s[1][1])/64);k++){
  if(!shoreCells.has(k))shoreCells.set(k,[]);shoreCells.get(k)!.push(s);
}
export function shoreIntersections(z:number){
  const hits:number[]=[];
  for(const [a,b] of shoreCells.get(Math.floor(z/64))??[])if((a[1]>z)!==(b[1]>z))hits.push(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));
  return hits;
}
export function mappedRiverEdge(z:number){const hits=shoreIntersections(z);return hits.length?Math.min(...hits):undefined;}
export function inMappedRiver(x:number,z:number){const hits=shoreIntersections(z);return hits.length?hits.filter(h=>h>x).length%2===1:false;}
type Area=typeof detail.areas[number];
const areaCells=new Map<string,Area[]>();
for(const a of detail.areas){
  const xs=a.points.map(p=>p[0]),zs=a.points.map(p=>p[1]);
  for(let x=Math.floor(Math.min(...xs)/64);x<=Math.floor(Math.max(...xs)/64);x++)for(let z=Math.floor(Math.min(...zs)/64);z<=Math.floor(Math.max(...zs)/64);z++){
    const key=x+','+z;if(!areaCells.has(key))areaCells.set(key,[]);areaCells.get(key)!.push(a);
  }
}
export function insidePolygon(x:number,z:number,points:number[][]){
  let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
export function landAt(x:number,z:number){
  const areas=(areaCells.get(Math.floor(x/64)+','+Math.floor(z/64))??[]).filter(a=>insidePolygon(x,z,a.points));
  return areas.find(a=>a.kind==='water')??areas.find(a=>a.kind==='parking')??areas.find(a=>a.kind==='plaza')??areas[0];
}
