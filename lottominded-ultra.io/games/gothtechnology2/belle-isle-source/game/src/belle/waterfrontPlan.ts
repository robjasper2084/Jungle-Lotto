import layout from './waterfrontLayout.json' with {type:'json'};
import type {ParkMap,Point} from './terrain.ts';
import type {LagoonBridge} from './lagoonBridge.ts';
export const waterfrontRails:LagoonBridge[]=[...layout.piers,...layout.bridges].flatMap(s=>s.points.slice(1).map((p,i)=>({id:s.id,a:s.points[i] as Point,b:p as Point,width:s.width+.16,floor:2.04,railHeight:s.style==='covered'?2.4:1.12})));
for(const pier of layout.piers){const b=pier.points.at(-1)!,a=pier.points.at(-2)!,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=dz/l*pier.width/2,nz=-dx/l*pier.width/2;waterfrontRails.push({id:pier.id+'_end',a:[b[0]+nx,b[1]+nz],b:[b[0]-nx,b[1]-nz],width:.08,floor:2.04,railHeight:1.12});}
export function pierDeck(x:number,z:number){return layout.piers.some(s=>s.points.slice(1).some((p,i)=>{const a=s.points[i],dx=p[0]-a[0],dz=p[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<=s.width/2;}));}
export function prepareWaterfrontMap(map:ParkMap){for(const pier of layout.piers){if(!map.landmarks.some(l=>l.id===pier.id)){map.landmarks.push({id:pier.id,name:pier.name,x:pier.points[0][0],z:pier.points[0][1],kind:'viewpoint',description:'Walkable fishing pier, with railings and lamps modeled from the supplied photographs.'});}}}
