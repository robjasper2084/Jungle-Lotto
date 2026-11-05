import type {Vec3} from '../terrain.ts';
type Entry={id:number;rank:number;point:Vec3};
type Node={entry:Entry;axis:'x'|'z';left?:Node;right?:Node};
/** Exact nearest-node lookup for an immutable authored graph. Insertion order
 * breaks equal-distance ties, matching the original Map scan. */
export class NavigationNearest {
 private root?:Node;
 constructor(points:readonly Vec3[],eligible:Iterable<number>){
  const build=(entries:Entry[],depth:number):Node|undefined=>{
   if(!entries.length)return;const axis=depth%2?'z':'x',middle=entries.length>>1;
   entries.sort((a,b)=>a.point[axis]-b.point[axis]||a.rank-b.rank);
   return {entry:entries[middle],axis,left:build(entries.slice(0,middle),depth+1),right:build(entries.slice(middle+1),depth+1)};
  };
  this.root=build(Array.from(eligible,(id,rank)=>({id,rank,point:points[id]})),0);
 }
 nearest(point:Vec3){
  let best=0,distance=Infinity,rank=Infinity;
  const visit=(node:Node|undefined)=>{if(!node)return;
   const e=node.entry,d=Math.hypot(point.x-e.point.x,point.z-e.point.z);
   if(d<distance||d===distance&&e.rank<rank){distance=d;rank=e.rank;best=e.id;}
   const delta=point[node.axis]-e.point[node.axis];
   visit(delta<0?node.left:node.right);
   if(Math.abs(delta)<=distance)visit(delta<0?node.right:node.left);
  };
  visit(this.root);return best;
 }
}
