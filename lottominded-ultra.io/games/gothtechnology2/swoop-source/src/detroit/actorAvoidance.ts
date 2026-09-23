import type {NavigationObstacle,Vec3} from './terrain.ts';
export const isCharacter=(o:NavigationObstacle)=>['pedestrian','jogger','cyclist','segway','skater','scooter','rider','dog','wheel'].includes(o.kind);
/** Swept upright envelopes: stop before contact, including fast movement across a whole actor. */
export function actorContact(p:Vec3,dx:number,dz:number,radius:number,height:number,obstacles:readonly NavigationObstacle[]){
 const a=dx*dx+dz*dz;let fraction=1,actor:NavigationObstacle|undefined;
 if(a<1e-12)return {fraction,actor};
 for(const o of obstacles){
  if(o.y>=p.y+height||o.y+o.height<=p.y+.06)continue;
  const x=p.x-o.x,z=p.z-o.z,r=radius+o.radius+.06,b=x*dx+z*dz,c=x*x+z*z-r*r;
  if(c<0){if(b<0){fraction=0;actor=o;}continue;}if(b>=0)continue;
  const disc=b*b-a*c;if(disc<0)continue;const entry=(-b-Math.sqrt(disc))/a;
  if(entry>=0&&entry<=fraction){fraction=Math.max(0,entry-.001/Math.sqrt(a));actor=o;}
 }
 return {fraction,actor};
}
export function actorTravelFraction(p:Vec3,dx:number,dz:number,radius:number,height:number,obstacles:readonly NavigationObstacle[]){return actorContact(p,dx,dz,radius,height,obstacles).fraction;}
