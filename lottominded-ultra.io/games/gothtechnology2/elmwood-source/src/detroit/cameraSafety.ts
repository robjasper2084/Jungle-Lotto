type Point={x:number;y:number;z:number};
type Ray=(origin:Point,direction:Point,max:number)=>number|null;
const origin:Point={x:0,y:0,z:0},direction:Point={x:0,y:0,z:0};
const offsets=[0,.65,-.65,1.3,-1.3,Math.PI];
/** Keep the eye outside the rider even when a fall's target is inside a tree/wall.
 * A zero-distance hit describes an embedded target, not a zero-length camera boom. */
export function clearCameraBoom(eye:Point,anchor:Point,cast:Ray,floor:number){
  eye.y=Math.max(eye.y,floor+.35);
  let dx=eye.x-anchor.x,dy=eye.y-anchor.y,dz=eye.z-anchor.z;
  const length=Math.hypot(dx,dy,dz);if(length<.001)return;
  direction.x=dx/length;direction.y=dy/length;direction.z=dz/length;
  const hit=cast(anchor,direction,length);
  if(hit===null)return;
  if(hit>1.35){const reach=hit-.25;eye.x=anchor.x+direction.x*reach;eye.y=anchor.y+direction.y*reach;eye.z=anchor.z+direction.z*reach;return;}
  const angle=Math.atan2(dx,dz),radius=Math.max(2.6,Math.min(5.5,Math.hypot(dx,dz)));
  // Rare obstruction fallback only; normal riding uses one ray.
  for(const lift of [0,1.4,3.2])for(const offset of offsets){
    origin.x=anchor.x+Math.sin(angle+offset)*radius;
    origin.z=anchor.z+Math.cos(angle+offset)*radius;
    origin.y=Math.max(floor+.65,anchor.y+Math.max(.6,dy)+lift);
    direction.x=0;direction.y=1;direction.z=0;
    const embedded=cast(origin,direction,.08);if(embedded!==null&&embedded<.04)continue;
    dx=origin.x-anchor.x;dy=origin.y-anchor.y;dz=origin.z-anchor.z;
    const distance=Math.hypot(dx,dy,dz);
    direction.x=dx/distance;direction.y=dy/distance;direction.z=dz/distance;
    const forward=cast(anchor,direction,distance);
    if(forward===null||forward>1.35){
      const scale=forward===null?1:(forward-.25)/distance;
      eye.x=anchor.x+dx*scale;eye.y=anchor.y+dy*scale;eye.z=anchor.z+dz*scale;return;
    }
    // An embedded anchor can still be framed from a clear outside endpoint.
    if(forward<.04){direction.x=-direction.x;direction.y=-direction.y;direction.z=-direction.z;
      const reverse=cast(origin,direction,distance);
      if(reverse===null||reverse>.35){eye.x=origin.x;eye.y=origin.y;eye.z=origin.z;return;}
    }
  }
  // Preserve a readable elevated view instead of collapsing into the model.
  eye.y=Math.max(eye.y,floor+3.8);
}
