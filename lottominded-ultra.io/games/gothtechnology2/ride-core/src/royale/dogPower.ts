import type {BattleTerrain} from './battleTerrain.ts';import type {RidePose} from '../controller.ts';import type {DogPose} from '../companion.ts';
import {gaitCadence} from '../dogGait.ts';
export type DogPower={charges:number;until:number;ready:number;radarUntil:number;radarReady:number};
export type BattleDog=DogPose&{mode:'follow'|'chase'|'pounce'|'return';target?:string;activation:number;pounceUntil:number;replan:number;path:{x:number;y:number;z:number}[]};
export function createBattleDog(p:RidePose):BattleDog{return{x:p.x+1.5,y:p.y+.02,z:p.z,heading:p.headingY,pitch:0,roll:0,speed:0,phase:0,time:0,turnRate:0,mode:'follow',activation:0,pounceUntil:0,replan:0,path:[]};}
type Rival={id:string;pose:RidePose;alive:boolean;input?:{aimYaw:number}};
/** Fixed authority steps; swept ground routes and support checks forbid a dog
 * reaching through walls, jumping water, or teleporting to a moving opponent. */
export function advanceBattleDog(d:BattleDog,owner:Rival,power:DogPower,rivals:readonly Rival[],terrain:BattleTerrain,tick:number){
 const dt=1/20,p=owner.pose,active=owner.alive&&power.until>tick;
 if(!owner.alive){d.speed=0;return;}
 if(active&&d.activation!==power.until){d.activation=power.until;d.target=undefined;d.replan=0;}
 let target=rivals.find(a=>a.id===d.target&&a.alive&&Math.hypot(a.pose.x-p.x,a.pose.z-p.z)<110);
 if(active&&!target){target=rivals.filter(a=>{const turn=Math.atan2(a.pose.x-p.x,a.pose.z-p.z)-p.headingY-(owner.input?.aimYaw??0);return a.id!==owner.id&&a.alive&&Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))<1.25&&Math.hypot(a.pose.x-d.x,a.pose.z-d.z)<90&&Math.abs(a.pose.y-d.y)<2&&terrain.line({x:d.x,y:d.y+.5,z:d.z},{x:a.pose.x,y:a.pose.y+.5,z:a.pose.z},.25);}).sort((a,b)=>Math.hypot(a.pose.x-d.x,a.pose.z-d.z)-Math.hypot(b.pose.x-d.x,b.pose.z-d.z))[0];d.target=target?.id;d.replan=0;}
 if(!active){d.target=undefined;target=undefined;}
 const goal=target?.pose??{x:p.x+Math.cos(p.headingY)*1.5-Math.sin(p.headingY)*.8,y:p.y,z:p.z-Math.sin(p.headingY)*1.5-Math.cos(p.headingY)*.8};
 if(tick>=d.replan){d.replan=tick+30;d.path=terrain.route(d,goal);}
 while(d.path.length&&Math.hypot(d.path[0].x-d.x,d.path[0].z-d.z)<1.5)d.path.shift();
 const direct=terrain.line({x:d.x,y:d.y+.45,z:d.z},{x:goal.x,y:goal.y+.45,z:goal.z},.27),at=direct?goal:d.path[0];
 const gap=Math.hypot(goal.x-d.x,goal.z-d.z);d.mode=active&&target?'chase':gap>8?'return':'follow';
 let speed=at?Math.min(active?24:17,Math.sqrt(16*Math.max(0,gap-.25))):0;
 const wanted=at?Math.atan2(at.x-d.x,at.z-d.z):d.heading,turn=Math.atan2(Math.sin(wanted-d.heading),Math.cos(wanted-d.heading));
 d.turnRate=Math.max(-4,Math.min(4,turn/dt));d.heading+=d.turnRate*dt;if(Math.abs(turn)>.5)speed=Math.min(speed,4);
 d.speed+=(speed-d.speed)*(1-Math.exp(-8*dt));
 const step=Math.min(d.speed*dt,at?Math.hypot(at.x-d.x,at.z-d.z):0),x=d.x+Math.sin(d.heading)*step,z=d.z+Math.cos(d.heading)*step,g=terrain.ground(x,z,d.y);
 if(Number.isFinite(g.height)&&Math.abs(g.height-d.y)<.35&&terrain.clear(x,z,.27,d.y)&&terrain.line({x:d.x,y:d.y+.35,z:d.z},{x,y:g.height+.35,z},.27)){d.x=x;d.z=z;d.y=g.height+.02;}else{d.speed=0;d.replan=0;}
 d.phase+=gaitCadence(d.speed)*dt;d.time+=dt;
 const contact=active&&target&&Math.hypot(target.pose.x-d.x,target.pose.z-d.z)<1.5&&Math.abs(target.pose.y-d.y)<1.2&&terrain.line({x:d.x,y:d.y+.3,z:d.z},{x:target.pose.x,y:target.pose.y+.3,z:target.pose.z},.2);
 if(contact&&d.pounceUntil<=tick)d.pounceUntil=tick+18;
 d.jumpProgress=d.pounceUntil>tick?(tick-d.pounceUntil+18)/18:0;d.jumpHeight=d.pounceUntil>tick?Math.sin(d.jumpProgress*Math.PI)*.22:0;if(d.pounceUntil>tick)d.mode='pounce';
 return contact?target?.id:undefined;
}
