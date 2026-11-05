import polygonClipping from '../game/node_modules/polygon-clipping/dist/polygon-clipping.esm.js';
// Closed OSM water polygons take priority. Centerline-only canal gaps receive
// an explicitly approximate 8 m width. Never cut dry land for buried culverts.
export function buildWaterTopology(island,water,canals){
 const sourcePolys=water.map(w=>[w.points,...w.holes]);
 function inside(p,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){let a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
 const isWater=p=>water.some(w=>inside(p,w.points)&&!w.holes.some(h=>inside(p,h)));
 const additions=[];
 for(const route of canals){
  const r=route.width/2;
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.01)continue;
   const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(!inside(mid,island)||isWater(mid)&&isWater(a)&&isWater(b))continue;
   const nx=-dz/l*r,nz=dx/l*r,ring=[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz],[a[0]+nx,a[1]+nz]];additions.push([ring]);
   for(const p of [a,b]){const circle=Array.from({length:13},(_,j)=>[p[0]+Math.cos(j*Math.PI/6)*r,p[1]+Math.sin(j*Math.PI/6)*r]);additions.push([circle]);}
  }
 }
 const merged=polygonClipping.union(...sourcePolys,...additions);
 const landPolygons=polygonClipping.difference([island],merged);
 return {water:merged.map((p,i)=>({id:'hydro-'+i,name:'Mapped island water',points:p[0],holes:p.slice(1)})),landPolygons,addedCanalPieces:additions.length};
}

export function dryArea(points,water){return polygonClipping.difference([points],...water.map(w=>[w.points,...w.holes]));}
