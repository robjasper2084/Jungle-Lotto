import type {BattleTerrain} from './battleTerrain.ts';import type {RidePose} from '../controller.ts';import type {DogPose} from '../companion.ts';
import type {Vec3} from '../terrain.ts';
import {gaitCadence} from '../dogGait.ts';
import {yieldToTraffic} from '../dynamicClearance.ts';
export type DogPower={charges:number;until:number;ready:number;radarUntil:number;radarReady:number};
export type BattleDog=DogPose&{mode:'follow'|'chase'|'pounce'|'return';target?:string;activation:number;pounceUntil:number;replan:number;fallVelocity?:number;path:{x:number;y:number;z:number}[]};
export function createBattleDog(p:RidePose,terrain?:BattleTerrain):BattleDog{
 let start={x:p.x+1.5,y:p.y,z:p.z};
 if(terrain){start={x:p.x,y:p.y-p.airHeight,z:p.z};for(const side of [1,-1,0]){
  const x=p.x+Math.cos(p.headingY)*1.5*side,z=p.z-Math.sin(p.headingY)*1.5*side,g=terrain.ground(x,z,p.y-p.airHeight);
  if(!g.offCourse&&Number.isFinite(g.height)&&Math.abs(g.height-start.y)<=.35&&terrain.clear(x,z,.27,g.height)&&terrain.line({x:p.x,y:start.y+.5,z:p.z},{x,y:g.height+.5,z},.27)){start={x,y:g.height,z};break;}
 }}
 return{...start,y:start.y+.02,heading:p.headingY,pitch:0,roll:0,speed:0,phase:0,time:0,turnRate:0,mode:'follow',activation:0,pounceUntil:0,replan:0,fallVelocity:0,path:[]};
}
type Rival={id:string;pose:RidePose;alive:boolean;input?:{aimYaw:number}};
/** Fixed authority steps; swept ground routes and support checks forbid a dog
 * reaching through walls, jumping water, or teleporting to a moving opponent. */
export function advanceBattleDog(d:BattleDog,owner:Rival,power:DogPower,rivals:readonly Rival[],terrain:BattleTerrain,tick:number,route:(from:Vec3,to:Vec3)=>Vec3[]|undefined=(a,b)=>terrain.route(a,b)){
 const dt=1/20,p=owner.pose,active=owner.alive&&power.until>tick;
 if(!owner.alive){d.speed=0;return;}
 // A blocked horizontal step must not freeze the dog in midair. Settle at its
 // own feet, independently of its owner's height and the next route waypoint.
 const support=terrain.ground(d.x,d.z,d.y),floor=support.height+.02;
 if(!support.offCourse&&Number.isFinite(floor)&&floor<=d.y+.35){
  if(d.y>floor+.04){d.fallVelocity=(d.fallVelocity??0)-13*dt;d.y=Math.max(floor,d.y+d.fallVelocity*dt);}else d.y=floor;
  if(d.y<=floor+.001)d.fallVelocity=0;
 }
 if(active&&d.activation!==power.until){d.activation=power.until;d.target=undefined;d.replan=0;}
 let target=rivals.find(a=>a.id===d.target&&a.alive&&Math.hypot(a.pose.x-p.x,a.pose.z-p.z)<110);
 if(active&&!target){target=rivals.filter(a=>{const turn=Math.atan2(a.pose.x-p.x,a.pose.z-p.z)-p.headingY-(owner.input?.aimYaw??0);return a.id!==owner.id&&a.alive&&Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<1.25&&Math.hypot(a.pose.x-d.x,a.pose.z-d.z)<90&&Math.abs(a.pose.y-d.y)<2&&terrain.line({x:d.x,y:d.y+.5,z:d.z},{x:a.pose.x,y:a.pose.y+.5,z:a.pose.z},.25);}).sort((a,b)=>Math.hypot(a.pose.x-d.x,a.pose.z-d.z)-Math.hypot(b.pose.x-d.x,b.pose.z-d.z))[0];d.target=target?.id;d.replan=0;}
 if(!active){d.target=undefined;target=undefined;}
 const goal=target?.pose??{x:p.x+Math.cos(p.headingY)*1.5-Math.sin(p.headingY)*.8,y:p.y,z:p.z-Math.sin(p.headingY)*1.5-Math.cos(p.headingY)*.8};
 if(tick>=d.replan){d.replan=tick+30;const nextRoute=route(d,goal);if(nextRoute)d.path=nextRoute;}
 while(d.path.length&&Math.hypot(d.path[0].x-d.x,d.path[0].z-d.z)<1.5)d.path.shift();
 const direct=terrain.line({x:d.x,y:d.y+.45,z:d.z},{x:goal.x,y:goal.y+.45,z:goal.z},.27),at=direct?goal:d.path[0];
 const gap=Math.hypot(goal.x-d.x,goal.z-d.z);d.mode=active&&target?'chase':gap>8?'return':'follow';
 let speed=at?Math.min(active?24:17,Math.sqrt(16*Math.max(0,gap-.25))):0;
 const wanted=at?Math.atan2(at.x-d.x,at.z-d.z):d.heading,turn=Math.atan2(Math.sin(wanted-d.heading),Math.cos(wanted-d.heading));
 d.turnRate=Math.max(-4,Math.min(4,turn/dt));d.heading+=d.turnRate*dt;if(Math.abs(turn)>.5)speed=Math.min(speed,4);
 d.speed+=(speed-d.speed)*(1-Math.exp(-8*dt));
 const escape=yieldToTraffic(d,[owner,...rivals.filter(r=>r.id!==owner.id&&r.alive&&r.id!==target?.id)].map(r=>({x:r.pose.x,y:r.pose.y,z:r.pose.z,radius:.6,vx:Math.sin(r.pose.headingY)*r.pose.speed,vz:Math.cos(r.pose.headingY)*r.pose.speed})),dt,(x,z)=>{const g=terrain.ground(x,z,d.y);return !g.offCourse&&Math.abs(g.height-d.y)<.35&&terrain.clear(x,z,.27,d.y)&&terrain.line({x:d.x,y:d.y+.4,z:d.z},{x,y:g.height+.4,z},.27);});
 const step=Math.min(d.speed*dt,at?Math.hypot(at.x-d.x,at.z-d.z):0),x=escape?.x??d.x+Math.sin(d.heading)*step,z=escape?.z??d.z+Math.cos(d.heading)*step,g=terrain.ground(x,z,d.y);
 if(escape){d.speed=escape.speed;d.heading=escape.heading;d.replan=0;}
 if(Number.isFinite(g.height)&&Math.abs(g.height-d.y)<.35&&terrain.clear(x,z,.27,d.y)&&terrain.line({x:d.x,y:d.y+.35,z:d.z},{x,y:g.height+.35,z},.27)){d.x=x;d.z=z;d.y=g.height+.02;}else{d.speed=0;d.replan=0;}
 d.phase+=gaitCadence(d.speed)*dt;d.time+=dt;
 const contact=active&&target&&Math.hypot(target.pose.x-d.x,target.pose.z-d.z)<1.5&&Math.abs(target.pose.y-d.y)<1.2&&terrain.line({x:d.x,y:d.y+.3,z:d.z},{x:target.pose.x,y:target.pose.y+.3,z:target.pose.z},.2);
 if(contact&&d.pounceUntil<=tick)d.pounceUntil=tick+18;
 d.jumpProgress=d.pounceUntil>tick?(tick-d.pounceUntil+18)/18:0;d.jumpHeight=d.pounceUntil>tick?Math.sin(d.jumpProgress*Math.PI)*.22:0;if(d.pounceUntil>tick)d.mode='pounce';
 return contact?target?.id:undefined;
}
