import {actorTravelFraction} from './actorAvoidance.ts';
import type {NavigationObstacle} from './terrain.ts';
export interface CrowdAgent {id:string;distance:number;lane:number;direction:number;pace:number;speed:number;radius:number;height:number;x:number;y:number;z:number;heading:number;passing?:string;passLane?:number;stuck?:number;motionSpeed?:number;incapacitated?:boolean}
export interface CrowdPath {length:number;runout:number;offsetSign?:number;point:(d:number,u:number)=>{x:number;y:number;z:number;heading:number};width:(d:number)=>number;walkable?:(x:number,y:number,z:number)=>boolean}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
export function crowdObstacle(a:CrowdAgent):NavigationObstacle{return {id:a.id,x:a.x,y:a.y,z:a.z,radius:a.radius,height:a.height,kind:'pedestrian',vx:Math.sin(a.heading)*a.speed,vz:Math.cos(a.heading)*a.speed};}
/** Persistent route progress, early passing lanes, smooth acceleration, and a final no-overlap sweep. */
export function advanceCrowd(agents:CrowdAgent[],dt:number,path:CrowdPath,external:readonly NavigationObstacle[]){
 if(dt<=0)return;dt=Math.min(dt,.1);
 // Sequential reservations use already accepted positions. No pair can both claim the same space.
 for(const a of agents){
  if(a.pace===0||a.incapacitated)continue;
  const route=path.point(a.distance,0),h=route.heading+(a.direction<0?Math.PI:0),nx=Math.sin(h),nz=Math.cos(h);
  const limit=Math.max(.4,path.width(a.distance)/2-a.radius-.18),home=a.direction*Math.min(1.65,limit);
  const obstacles=agents.filter(b=>b!==a).map(crowdObstacle).concat(external).filter(o=>Math.abs(o.y-a.y)<1.3&&Math.hypot(o.x-a.x,o.z-a.z)<a.pace*3+5);
  const threats=obstacles.map(o=>{const dx=o.x-a.x,dz=o.z-a.z;return {o,along:dx*nx+dz*nz,side:dx*nz-dz*nx};}).filter(q=>q.along>-.15&&q.along<a.pace*2.5+3&&Math.abs(q.side)<a.radius+q.o.radius+.45).sort((b,c)=>b.along-c.along);
  const threat=threats[0];let target=home,pace=a.pace;
  const passing=obstacles.find(o=>o.id===a.passing);
  if(passing&&((passing.x-a.x)*nx+(passing.z-a.z)*nz)>-(a.radius+passing.radius+1))target=a.passLane??home;else a.passing=undefined;
  if(threat&&!a.passing){
   const margin=a.radius+threat.o.radius+.3,candidates=[1,-1].map(side=>clamp(a.lane+a.direction*(path.offsetSign??1)*(threat.side+side*margin),-limit,limit));
   const clearance=(lane:number)=>{const goal=path.point(a.distance+a.direction*Math.max(2,threat.along),lane);if(path.walkable&&!path.walkable(goal.x,goal.y,goal.z))return -10;return Math.min(...obstacles.filter(o=>Math.hypot(o.x-goal.x,o.z-goal.z)<3).map(o=>Math.hypot(goal.x-o.x,goal.z-o.z)-o.radius-a.radius),10);};
   target=clearance(candidates[0])>.1?candidates[0]:candidates[1];a.passing=threat.o.id;a.passLane=target;
  }
  if(threat&&Math.abs(threat.side)<a.radius+threat.o.radius+.12){const margin=a.radius+threat.o.radius+.12,gap=threat.along-margin;
   // A slower lead actor gets a deliberate overtake; a blocked gap yields smoothly.
   pace=Math.min(pace,Math.sqrt(Math.max(0,gap)*2*1.5));
  }
  a.stuck=a.speed<.15?(a.stuck??0)+dt:0;
  if(a.stuck>.6){
   // If another passer occupies our reservation, pick a reachable gap instead of queueing forever.
   const score=(lane:number)=>{const q=path.point(a.distance,lane),ahead=path.point(a.distance+a.direction*.8,lane);if(path.walkable&&!path.walkable(q.x,q.y,q.z))return -10;const fraction=actorTravelFraction(a,q.x-a.x,q.z-a.z,a.radius,a.height,obstacles);return fraction*3+Math.min(2,...obstacles.map(o=>Math.hypot(ahead.x-o.x,ahead.z-o.z)-a.radius-o.radius))-.08*Math.abs(lane-a.lane);};
   const choices=[target,-limit,limit,home,0].sort((a,b)=>score(b)-score(a));target=choices[0];a.passLane=target;a.stuck=0;
  }
  a.speed+=clamp(pace-a.speed,-2.8*dt,1.4*dt);
  const nextLane=a.lane+clamp(target-a.lane,-.85*dt,.85*dt),nextDistance=a.distance+a.direction*a.speed*dt;
  const next=path.point(nextDistance,nextLane),dx=next.x-a.x,dz=next.z-a.z;
  const fraction=path.walkable&&!path.walkable(next.x,next.y,next.z)?0:actorTravelFraction(a,dx,dz,a.radius,a.height,obstacles);
  a.distance+=(nextDistance-a.distance)*fraction;a.lane+=(nextLane-a.lane)*fraction;
  if(fraction<.05&&Math.abs(target-a.lane)>.02){const aside=path.point(a.distance,nextLane),sideFraction=path.walkable&&!path.walkable(aside.x,aside.y,aside.z)?0:actorTravelFraction(a,aside.x-a.x,aside.z-a.z,a.radius,a.height,obstacles);a.lane+=(nextLane-a.lane)*sideFraction;}
  const moved=path.point(a.distance,a.lane),vx=moved.x-a.x,vz=moved.z-a.z;
  if(Math.hypot(vx,vz)>.002){const wanted=Math.atan2(vx,vz);a.heading+=clamp(angle(wanted-a.heading),-1.5*dt,1.5*dt);}
  a.motionSpeed=Math.hypot(vx,vz)/dt;a.x=moved.x;a.y=moved.y;a.z=moved.z;
  if(fraction<1)a.speed*=fraction;
  const span=path.length+path.runout*2;
  if(a.distance>path.length+path.runout||a.distance< -path.runout){a.distance=((a.distance+path.runout)%span+span)%span-path.runout;Object.assign(a,path.point(a.distance,a.lane));a.heading+=a.direction<0?Math.PI:0;a.passing=undefined;}
 }
}
