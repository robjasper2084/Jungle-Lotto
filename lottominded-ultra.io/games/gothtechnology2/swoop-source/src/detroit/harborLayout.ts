import data from './harbor-data.json' with {type:'json'};
export const DOCK_TOP=.23,DOCK_WIDTH=2.4;
// Follow OSM access path 1314969278 through its gate, then path 1036654268 onto the pier.
export const HARBOR_GANGWAY={shore:{x:-93.45,z:-1284.91,y:.035},bend:{x:-98.1,z:-1284.48,y:0},dock:{x:-98.434,z:-1287.611,y:DOCK_TOP},width:2.4};
export function harborGangwayPoints(){
 const g=HARBOR_GANGWAY,first=Math.hypot(g.bend.x-g.shore.x,g.bend.z-g.shore.z),second=Math.hypot(g.dock.x-g.bend.x,g.dock.z-g.bend.z);
 return [g.shore,{...g.bend,y:g.shore.y+(g.dock.y-g.shore.y)*first/(first+second)},g.dock];
}
/** Shared mitered edges join the two ramp segments without a gap at the bend. */
export function harborGangwayEdges(){
 const route=harborGangwayPoints(),h=HARBOR_GANGWAY.width/2;
 const normals=route.slice(1).map((b,i)=>{const a=route[i],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);return{x:-dz/l,z:dx/l};});
 return route.map((p,i)=>{
  const a=normals[Math.max(0,i-1)],b=normals[Math.min(i,normals.length-1)],nx=a.x+b.x,nz=a.z+b.z,len=Math.hypot(nx,nz);
  const x=nx/len,z=nz/len,offset=h/(x*a.x+z*a.z);
  return{left:{x:p.x+x*offset,y:p.y,z:p.z+z*offset},right:{x:p.x-x*offset,y:p.y,z:p.z-z*offset}};
 });
}
export function harborFixtures(){
 const pedestals:{x:number;z:number;heading:number}[]=[],pilings:{x:number;z:number}[]=[],boats:{x:number;z:number;heading:number}[]=[];
 for(const w of data.ways.filter(w=>['59202738','59202739'].includes(w.id))){
  const a=w.points[0],b=w.points[1],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=dz/l,nz=-dx/l;
  for(let d=8;d<l-5;d+=15){const x=a[0]+dx*d/l,z=a[1]+dz*d/l;pedestals.push({x:x+nx*1.03,z:z+nz*1.03,heading:Math.atan2(dx,dz)});pilings.push({x:x-nx*1.8,z:z-nz*1.8});}
  for(let d=17;d<l-9;d+=18){const x=a[0]+dx*d/l,z=a[1]+dz*d/l;boats.push({x:x+nx*7.2,z:z+nz*7.2,heading:Math.atan2(nx,nz)});}
 }
 return{pedestals,pilings,boats};
}
