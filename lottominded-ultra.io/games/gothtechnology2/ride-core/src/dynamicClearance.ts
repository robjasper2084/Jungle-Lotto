/** Moving actors have priority over companion formation and held dog commands.
 * Clearance is sampled against each map's real collision/surface queries. */
export type TrafficBody={x:number;z:number;y?:number;radius:number;vx?:number;vz?:number};
export type YieldBody={x:number;z:number;y:number;heading:number;speed:number};
export function yieldToTraffic(body:YieldBody,traffic:readonly TrafficBody[],dt:number,clear:(x:number,z:number)=>boolean){
 const vx=Math.sin(body.heading)*body.speed,vz=Math.cos(body.heading)*body.speed;
 const nearby=traffic.filter(o=>Math.abs((o.y??body.y)-body.y)<1.3&&Math.hypot(o.x-body.x,o.z-body.z)<12);
 let threat:TrafficBody|undefined,urgency=0;
 for(const o of nearby){
  const x=body.x-o.x,z=body.z-o.z,rx=vx-(o.vx??0),rz=vz-(o.vz??0),r=o.radius+.46;
  const t=Math.max(0,Math.min(.65,-(x*rx+z*rz)/(rx*rx+rz*rz||1)));
  const gap=Math.hypot(x,z),future=Math.hypot(x+rx*t,z+rz*t);
  const incoming=x*(o.vx??0)+z*(o.vz??0)>0;
  const risk=Math.max(r-gap,incoming?(r-future)*(1-t*.7):0);
  if(risk>urgency){urgency=risk;threat=o;}
 }
 if(!threat)return;
 const ox=body.x-threat.x,oz=body.z-threat.z,ovx=threat.vx??0,ovz=threat.vz??0;
 // Choose the nearest shoulder of an approaching wheel, otherwise back away.
 const moving=Math.hypot(ovx,ovz)>.5,side=(ox*ovz-oz*ovx)>=0?1:-1;
 const heading=moving?Math.atan2(ovz*side,-ovx*side):Math.atan2(ox||.001,oz);
 const speed=Math.min(3,Math.max(.35,urgency*6)),step=speed*Math.min(dt,.06);
 let best=-Infinity,result:{x:number;z:number;speed:number;heading:number}|undefined;
 for(const turn of [0,.65,-.65,1.3,-1.3,2,-2,Math.PI]){
  const h=heading+turn,s=Math.sin(h),c=Math.cos(h),x=body.x+s*step,z=body.z+c*step;
  if(!clear(x,z)||!clear(body.x+s*Math.max(step,.45),body.z+c*Math.max(step,.45)))continue;
  let score=-Math.abs(turn)*.09;
  for(const o of nearby){
   const old=Math.hypot(body.x-o.x,body.z-o.z),now=Math.hypot(x-o.x,z-o.z);
   if(now<o.radius+.34&&now<old-.0001){score=-Infinity;break;}
   const future=Math.hypot(body.x+s*.8-o.x-(o.vx??0)*.25,body.z+c*.8-o.z-(o.vz??0)*.25);
   score+=Math.min(1,future-o.radius)*1.5+Math.min(.25,now-old)*8;
  }
  if(score>best){best=score;result={x,z,speed,heading:h};}
 }
 // A surrounded dog stops; friendly collision priority still lets a rider leave.
 return result??{x:body.x,z:body.z,speed:0,heading:body.heading};
}
