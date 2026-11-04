import {segment,type ParkMap,type Point} from './terrain.ts';
/** OSM bed/path IDs cross-checked against Oudolf Garden Detroit's Main Garden
 * aerial and planting drawings. Species drifts are photo-guided, not a survey. */
export const OUDOLF_BEDS=new Set(['1197169291','1197169292',...Array.from({length:16},(_,i)=>String(1197169298+i))]);
export const OUDOLF_LAWN_AISLES=new Set(['1197169293','1197169294','1197169295','1197169296','1197169297']);
export type GardenForm='umbel'|'spire'|'airy'|'grass'|'cone';
export const OUDOLF_COLORS={umbel:0xe4b936,spire:0x9271aa,airy:0xeee8d3,grass:0xa6a06b,cone:0xc288a9};
export function oudolfDrift(x:number,z:number,bed:string):GardenForm{
 // Coherent, gently wandering patches several metres across, with a grass
 // matrix between them. Avoid random colours per plant and straight rows.
 const u=x-1077,v=z-1228,n=Number(bed)%17;
 const band=Math.floor((v+u*.28+2.8*Math.sin(u*.17+n)) / 5.2);
 const patch=((band+n*3)%7+7)%7;
 return (['umbel','grass','spire','airy','cone','grass','umbel'] as const)[patch];
}

/** Short strips stop before cross paths so gravel stays continuous at junctions. */
export function oudolfLawnPanels(map:ParkMap):Point[][]{
 const cross=map.roads.filter(r=>!OUDOLF_LAWN_AISLES.has(r.id)&&r.points.some(p=>Math.hypot(p[0]-1077,p[1]-1228)<95));
 const panels:Point[][]=[];
 for(const path of map.roads.filter(r=>OUDOLF_LAWN_AISLES.has(r.id))){
  for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(!l)continue;
   const n=Math.ceil(l/.4),nx=dz/l*path.width*.5,nz=-dx/l*path.width*.5;
   for(let k=0;k<n;k++){
    const p:Point[]=[];for(const [t,side] of [[k/n,-1],[k/n,1],[(k+1)/n,1],[(k+1)/n,-1]])p.push([a[0]+dx*t+nx*side,a[1]+dz*t+nz*side]);
    if(cross.some(r=>r.points.some((q,j)=>j>0&&p.some(c=>segment(c[0],c[1],r.points[j-1],q).d<r.width*.5+.1))))continue;
    panels.push(p);
   }
  }
 }
 return panels;
}
