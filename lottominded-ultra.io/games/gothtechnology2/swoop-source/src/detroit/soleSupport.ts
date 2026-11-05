import type {Vector3} from 'three';

/** An ankle rolls about X, so only the convex Y/Z shoe outline can touch the
 * floor. Interior vertices cannot change its minimum at any pitch angle. */
export function soleSupport(points:readonly Vector3[]):Vector3[]{
 const sorted=[...points].sort((a,b)=>a.z-b.z||a.y-b.y);
 if(sorted.length<3)return sorted;
 const cross=(a:Vector3,b:Vector3,c:Vector3)=>(b.z-a.z)*(c.y-a.y)-(b.y-a.y)*(c.z-a.z);
 const half=(list:Vector3[])=>{const hull:Vector3[]=[];for(const p of list){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],p)<=0)hull.pop();hull.push(p);}return hull;};
 const lower=half(sorted),upper=half([...sorted].reverse());lower.pop();upper.pop();return lower.concat(upper);
}
export function soleFloor(points:readonly Vector3[],pitch:number){
 const c=Math.cos(pitch),s=Math.sin(pitch);let floor=Infinity;
 for(const p of points)floor=Math.min(floor,p.y*c-p.z*s);return floor;
}
