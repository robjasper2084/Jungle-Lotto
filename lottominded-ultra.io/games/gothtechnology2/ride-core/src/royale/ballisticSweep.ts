import type {Vec3} from '../terrain.ts';
export type TargetVolume={id:number;previous:Vec3;current:Vec3;alive:boolean;bounds?:{x:number;z:number;minY:number;maxY:number}};
/** Relative segment vs swept moving target volume, metres; no frame endpoint hit shortcut. */
export function movingTargetHit(start:Vec3,end:Vec3,target:TargetVolume,radius:number,t0:number,t1:number){
 const a=target.previous,b=target.current;
 const from={x:start.x-a.x-(b.x-a.x)*t0,y:start.y-a.y-(b.y-a.y)*t0,z:start.z-a.z-(b.z-a.z)*t0};
 const delta={x:end.x-start.x-(b.x-a.x)*(t1-t0),y:end.y-start.y-(b.y-a.y)*(t1-t0),z:end.z-start.z-(b.z-a.z)*(t1-t0)};
 let low=0,high=1;
 const box=target.bounds??{x:.42,z:.42,minY:.2,maxY:1.95};
 for(const [key,min,max]of [['x',-box.x-radius,box.x+radius],['y',box.minY-radius,box.maxY+radius],['z',-box.z-radius,box.z+radius]] as const){
  if(Math.abs(delta[key])<1e-9){if(from[key]<min||from[key]>max)return null;}
  else{let enter=(min-from[key])/delta[key],leave=(max-from[key])/delta[key];if(enter>leave)[enter,leave]=[leave,enter];low=Math.max(low,enter);high=Math.min(high,leave);if(low>high)return null;}
 }
 return low;
}
/** C++ supplies the curve. Eight 1/480 s chords cap arc error below 0.01 mm at 12 m/s². */
export function traceBallistic(point:(seconds:number)=>Vec3,radius:number,targets:TargetVolume[],sweep:(p:Vec3,d:Vec3,r:number)=>number|null,ground:(x:number,z:number)=>{height:number}){
 let start=point(0);
 for(let sub=0;sub<8;sub++){
  const end=point((sub+1)/480),d={x:end.x-start.x,y:end.y-start.y,z:end.z-start.z};
  let first=sweep(start,d,radius)??1.001,target=-1;
  for(const candidate of targets){if(!candidate.alive)continue;const t=movingTargetHit(start,end,candidate,radius,sub/8,(sub+1)/8);if(t!==null&&t<first){first=t;target=candidate.id;}}
  if(first<=1)return target;
  if(end.y-radius<ground(end.x,end.z).height)return -1;
  start=end;
 }
 return -2;
}
