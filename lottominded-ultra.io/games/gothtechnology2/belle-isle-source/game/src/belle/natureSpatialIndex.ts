/** Source-order-preserving spatial queries for immutable nature placements.
 * This is exact culling on existing coordinates, not geometry simplification:
 * visible instances, distances, materials and LOD thresholds are unchanged.
 */
export class NatureSpatialIndex<T extends {x:number;z:number}> {
 private cells=new Map<string,number[]>();
 constructor(private points:readonly T[],private cellSize=96){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw Error('Invalid nature cell size');
  points.forEach((p,i)=>{
   if(!Number.isFinite(p.x)||!Number.isFinite(p.z))throw Error('Invalid nature placement');
   const key=Math.floor(p.x/cellSize)+','+Math.floor(p.z/cellSize);
   const list=this.cells.get(key);
   if(list)list.push(i);else this.cells.set(key,[i]);
  });
 }
 within(x:number,z:number,r:number):T[]{
  if(![x,z,r].every(Number.isFinite)||r<=0)return [];
  const x0=Math.floor((x-r)/this.cellSize),x1=Math.floor((x+r)/this.cellSize);
  const z0=Math.floor((z-r)/this.cellSize),z1=Math.floor((z+r)/this.cellSize);
  const r2=r*r;
  if((x1-x0+1)*(z1-z0+1)>this.points.length/2)
   return this.points.filter(p=>(p.x-x)**2+(p.z-z)**2<r2);
  const ids:number[]=[];
  for(let a=x0;a<=x1;a++)for(let b=z0;b<=z1;b++){
   const list=this.cells.get(a+','+b);if(list)ids.push(...list);
  }
  // The original Array.filter order must survive later stable distance sorts.
  ids.sort((a,b)=>a-b);
  return ids.filter(i=>{
   const p=this.points[i];return (p.x-x)**2+(p.z-z)**2<r2;
  }).map(i=>this.points[i]);
 }
}
