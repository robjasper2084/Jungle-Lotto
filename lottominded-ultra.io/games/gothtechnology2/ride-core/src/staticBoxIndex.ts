import type {Vec3} from './terrain.ts';
import type {StaticBox} from './staticBoxSweep.ts';
type Bounds={minX:number;maxX:number;minY:number;maxY:number;minZ:number;maxZ:number};
type Entry=Bounds&{box:StaticBox;index:number};
type Node=Bounds&{entries?:Entry[];left?:Node;right?:Node};
/** Conservative broad phase only. Exact rounded-box sweeps still determine
 * contact. Authored props are immutable; no moving actors enter this index. */
export class StaticBoxIndex {
 private root?:Node;
 constructor(boxes:readonly StaticBox[]){
  const build=(entries:Entry[]):Node|undefined=>{if(!entries.length)return;
   const node:Node={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
   for(const e of entries){node.minX=Math.min(node.minX,e.minX);node.maxX=Math.max(node.maxX,e.maxX);node.minY=Math.min(node.minY,e.minY);node.maxY=Math.max(node.maxY,e.maxY);node.minZ=Math.min(node.minZ,e.minZ);node.maxZ=Math.max(node.maxZ,e.maxZ);}
   if(entries.length<=8)node.entries=entries;
   else {const axis=node.maxX-node.minX>node.maxZ-node.minZ?'x':'z';entries.sort((a,b)=>a.box[axis]-b.box[axis]||a.index-b.index);const mid=entries.length>>1;node.left=build(entries.slice(0,mid));node.right=build(entries.slice(mid));}
   return node;
  };
  this.root=build(boxes.map((box,index)=>{const c=Math.abs(Math.cos(box.yaw)),s=Math.abs(Math.sin(box.yaw)),x=c*box.hx+s*box.hz,z=s*box.hx+c*box.hz;
   return {box,index,minX:box.x-x,maxX:box.x+x,minY:box.y-box.hy,maxY:box.y+box.hy,minZ:box.z-z,maxZ:box.z+z};}));
 }
 query(origin:Vec3,delta:Vec3,radius=0):StaticBox[]{
  const r=Math.max(0,radius)+1e-7,minX=Math.min(origin.x,origin.x+delta.x)-r,maxX=Math.max(origin.x,origin.x+delta.x)+r,minY=Math.min(origin.y,origin.y+delta.y)-r,maxY=Math.max(origin.y,origin.y+delta.y)+r,minZ=Math.min(origin.z,origin.z+delta.z)-r,maxZ=Math.max(origin.z,origin.z+delta.z)+r;
  const overlaps=(b:Bounds)=>b.maxX>=minX&&b.minX<=maxX&&b.maxY>=minY&&b.minY<=maxY&&b.maxZ>=minZ&&b.minZ<=maxZ;
  const found:Entry[]=[];
  const visit=(node:Node|undefined)=>{if(!node||!overlaps(node))return;if(node.entries){for(const e of node.entries)if(overlaps(e))found.push(e);}else{visit(node.left);visit(node.right);}};
  visit(this.root);found.sort((a,b)=>a.index-b.index);return found.map(e=>e.box);
 }
}
