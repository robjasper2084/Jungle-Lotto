import {actorTravelFraction} from './actorAvoidance.ts';
import type {NavigationObstacle} from './terrain.ts';
import {computerBikeContact} from './cyclistContacts.ts';
export interface CrowdAgent {id:string;kind?:string;distance:number;lane:number;direction:number;pace:number;speed:number;radius:number;height:number;x:number;y:number;z:number;heading:number;passing?:string;passLane?:number;wallLane?:number;wallUntil?:number;stuck?:number;motionSpeed?:number;incapacitated?:boolean;retreat?:number;behavior?:'moving'|'passing'|'yielding'|'stepping aside'}
export interface CrowdPath {length:number;runout:number;offsetSign?:number;point:(d:number,u:number)=>{x:number;y:number;z:number;heading:number};width:(d:number)=>number;walkable?:(x:number,y:number,z:number)=>boolean}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angle=(v:number)=>Math.atan2(Math.sin(v),Math.cos(v));
/** Walkability includes the body's clearance. Sample the route between endpoints
 * so a clear point beyond a building is not mistaken for a reachable lane. */
function walkableFraction(path:CrowdPath,fromDistance:number,fromLane:number,toDistance:number,toLane:number){
 if(!path.walkable)return 1;
 const steps=Math.max(1,Math.ceil((Math.abs(toDistance-fromDistance)+Math.abs(toLane-fromLane))/.15));
 for(let i=1;i<=steps;i++){const t=i/steps,q=path.point(fromDistance+(toDistance-fromDistance)*t,fromLane+(toLane-fromLane)*t);if(!path.walkable(q.x,q.y,q.z))return (i-1)/steps;}
 return 1;
}
export function crowdObstacle(a:CrowdAgent):NavigationObstacle{return {id:a.id,x:a.x,y:a.y,z:a.z,radius:a.radius,height:a.height,kind:a.kind??'pedestrian',vx:Math.sin(a.heading)*a.speed,vz:Math.cos(a.heading)*a.speed,fallen:a.incapacitated};}
/** Persistent route progress, early passing lanes, smooth acceleration, and a final no-overlap sweep. */
export function advanceCrowd(agents:CrowdAgent[],dt:number,path:CrowdPath,external:readonly NavigationObstacle[]){
 if(dt<=0)return;dt=Math.min(dt,.1);
 // Sequential reservations use already accepted positions. No pair can both claim the same space.
 for(const a of agents){
  if(a.pace===0||a.incapacitated)continue;
  const route=path.point(a.distance,0),h=route.heading+(a.direction<0?Math.PI:0),nx=Math.sin(h),nz=Math.cos(h);
  const limit=Math.max(.4,path.width(a.distance)/2-a.radius-.18),home=a.direction*Math.min(1.65,limit);
  const obstacles=agents.filter(b=>b!==a&&Math.abs(b.y-a.y)<1.3&&Math.hypot(b.x-a.x,b.z-a.z)<a.pace*3+5).map(crowdObstacle).concat(external.filter(o=>Math.abs(o.y-a.y)<1.3&&Math.hypot(o.x-a.x,o.z-a.z)<a.pace*3+5));
  // Keep all actors for steering; computer bikes can overlap without stopping one another.
  const solid=obstacles.filter(o=>!(a.kind==='cyclist'&&computerBikeContact(o)));
  const threats=obstacles.map(o=>{const dx=o.x-a.x,dz=o.z-a.z;return {o,along:dx*nx+dz*nz,side:dx*nz-dz*nx};}).filter(q=>q.along>-.15&&q.along<a.pace*2.5+3&&Math.abs(q.side)<a.radius+q.o.radius+.45).sort((b,c)=>b.along-c.along);
  const threat=threats[0];let target=home,pace=a.pace;
  if(a.wallLane!==undefined){
   if((a.distance-(a.wallUntil??a.distance))*a.direction>=0){
    if(walkableFraction(path,a.distance,a.lane,a.distance+a.direction*.8,home)===1)a.wallLane=a.wallUntil=undefined;
    else a.wallUntil=a.distance+a.direction; // Recheck after progress, not every frame beside a long wall.
   }
   if(a.wallLane!==undefined)target=clamp(a.wallLane,-limit,limit);
  }
  const passing=obstacles.find(o=>o.id===a.passing);
  if(passing&&((passing.x-a.x)*nx+(passing.z-a.z)*nz)>-(a.radius+passing.radius+1))target=a.passLane??home;else a.passing=undefined;
  if(threat&&!a.passing){
   const margin=a.radius+threat.o.radius+.3,candidates=[1,-1].map(side=>clamp(a.lane+a.direction*(path.offsetSign??1)*(threat.side+side*margin),-limit,limit));
   const clearance=(lane:number)=>{const goal=path.point(a.distance+a.direction*Math.max(2,threat.along),lane);if(path.walkable&&!path.walkable(goal.x,goal.y,goal.z))return -10;return Math.min(...obstacles.filter(o=>Math.hypot(o.x-goal.x,o.z-goal.z)<3).map(o=>Math.hypot(goal.x-o.x,goal.z-o.z)-o.radius-a.radius),10);};
   const best=candidates.map(lane=>({lane,clearance:clearance(lane)})).sort((b,c)=>c.clearance-b.clearance)[0];
   if(best.clearance>.1){target=best.lane;a.passing=threat.o.id;a.passLane=target;}
  }
  const passPoint=threat?path.point(a.distance+a.direction*Math.max(.8,threat.along),target):undefined;
  const passingClear=threat&&passPoint&&Math.hypot(passPoint.x-threat.o.x,passPoint.z-threat.o.z)>a.radius+threat.o.radius+.2;
  if(threat&&!passingClear&&solid.includes(threat.o)&&Math.abs(threat.side)<a.radius+threat.o.radius+.12){const margin=a.radius+threat.o.radius+.12,gap=threat.along-margin;
   // A slower lead actor gets a deliberate overtake; a blocked gap yields smoothly.
   pace=Math.min(pace,Math.sqrt(Math.max(0,gap)*2*1.5));
  }
  // Give an approaching player space even when they are behind us. Pick a
  // reachable shoulder and hold it long enough for the wheel to pass.
  const rider=external.find(o=>o.kind==='rider'&&!o.fallen&&Math.abs(o.y-a.y)<1.3&&Math.hypot(o.x-a.x,o.z-a.z)<3.2);
  if(rider){
   const side=(rider.x-a.x)*nz-(rider.z-a.z)*nx,offset=a.direction*(path.offsetSign??1);
   const wanted=clamp(a.lane-offset*(side>=0?1:-1)*1.25,-limit,limit),q=path.point(a.distance,wanted);
   if(!path.walkable||path.walkable(q.x,q.y,q.z)){target=wanted;a.passLane=target;a.passing=rider.id;}
  }
  a.stuck=(a.motionSpeed??a.speed)<.15?(a.stuck??0)+dt:0;
  if(a.stuck>.6){
   // Evaluate both the side step and its forward exit. A walkable shoulder
   // that still faces a building must not outrank an actual escape lane.
   const blockedAhead=walkableFraction(path,a.distance,a.lane,a.distance+a.direction*.8,a.lane)<1;
   const score=(lane:number)=>{const q=path.point(a.distance,lane),ahead=path.point(a.distance+a.direction*.8,lane),side=walkableFraction(path,a.distance,a.lane,a.distance,lane);if(side<1)return -10;const forward=walkableFraction(path,a.distance,lane,a.distance+a.direction*.8,lane),penalty=.08*Math.abs(lane-a.lane);if(forward<1)return -.5+forward*.4-penalty;const fraction=actorTravelFraction(a,q.x-a.x,q.z-a.z,a.radius,a.height,solid);return fraction*3+Math.min(2,...obstacles.map(o=>Math.hypot(ahead.x-o.x,ahead.z-o.z)-a.radius-o.radius))-penalty;};
   const choices=[target,-limit,limit,home,0].map(lane=>({lane,score:score(lane)})).sort((a,b)=>b.score-a.score);target=choices[0].lane;a.passLane=target;a.passing=threat?.o.id??a.passing;
   if(blockedAhead&&choices[0].score>.5){a.wallLane=target;a.wallUntil=a.distance+a.direction*Math.max(2,a.pace);}
   // Back up a short distance if an occupied shoulder leaves no sideways
   // escape. Never teleport or reverse the person's chosen route direction.
   if(a.stuck>2&&!a.retreat&&choices[0].score<.5){const back=path.point(a.distance-a.direction*.6,a.lane);if(walkableFraction(path,a.distance,a.lane,a.distance-a.direction*.6,a.lane)===1&&actorTravelFraction(a,back.x-a.x,back.z-a.z,a.radius,a.height,solid)>.8)a.retreat=.8;}
  }
  a.behavior=rider?'stepping aside':pace<.15?'yielding':a.passing?'passing':'moving';
  a.speed+=clamp(pace-a.speed,-2.8*dt,1.4*dt);
  const retreat=(a.retreat??0)>0;if(retreat)a.retreat=Math.max(0,a.retreat!-dt);
  const nextLane=a.lane+clamp(target-a.lane,-.85*dt,.85*dt),nextDistance=a.distance+a.direction*(retreat?-.65:a.speed)*dt;
  const next=path.point(nextDistance,nextLane),dx=next.x-a.x,dz=next.z-a.z;
  const fraction=Math.min(walkableFraction(path,a.distance,a.lane,nextDistance,nextLane),actorTravelFraction(a,dx,dz,a.radius,a.height,solid));
  a.distance+=(nextDistance-a.distance)*fraction;a.lane+=(nextLane-a.lane)*fraction;
  if(fraction<.05&&Math.abs(target-a.lane)>.02){const aside=path.point(a.distance,nextLane),sideFraction=Math.min(walkableFraction(path,a.distance,a.lane,a.distance,nextLane),actorTravelFraction(a,aside.x-a.x,aside.z-a.z,a.radius,a.height,solid));a.lane+=(nextLane-a.lane)*sideFraction;}
  const moved=path.point(a.distance,a.lane),vx=moved.x-a.x,vz=moved.z-a.z;
  if(Math.hypot(vx,vz)>.002){const wanted=Math.atan2(vx,vz);a.heading+=clamp(angle(wanted-a.heading),-1.5*dt,1.5*dt);}
  a.motionSpeed=Math.hypot(vx,vz)/dt;a.x=moved.x;a.y=moved.y;a.z=moved.z;
  if(fraction<1)a.speed*=fraction;
  const span=path.length+path.runout*2;
  if(a.distance>path.length+path.runout||a.distance< -path.runout){a.distance=((a.distance+path.runout)%span+span)%span-path.runout;Object.assign(a,path.point(a.distance,a.lane));a.heading+=a.direction<0?Math.PI:0;a.passing=undefined;a.wallLane=a.wallUntil=undefined;}
 }
}
