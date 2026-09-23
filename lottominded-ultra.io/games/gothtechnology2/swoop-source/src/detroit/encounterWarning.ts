import type {RidePose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
import {RIDE_TUNING} from './rideDynamics.ts';
export function brakingLookahead(speed:number){return 4+Math.abs(speed)*.8+speed*speed/(2*RIDE_TUNING.brakeAcceleration);}
/** Identifies a closing hazard; never suggests an unverified escape direction. */
export class EncounterWarning {
 text='';private retained=0;private id='';
 reset(){this.text='';this.retained=0;this.id='';}
 step(dt:number,p:RidePose,terrain:TerrainSampler,active:boolean){
  if(!active||p.crashBlend>0||Math.abs(p.speed)<.2){this.reset();return this.text;}
  const sign=p.speed<0?-1:1,s=Math.sin(p.headingY)*sign,c=Math.cos(p.headingY)*sign,look=brakingLookahead(p.speed);
  const hazards=(terrain.navigationObstacles?.(p.x,p.z,look+8)??[]).map(o=>{
   const dx=o.x-p.x,dz=o.z-p.z,forward=dx*s+dz*c,side=Math.abs(dx*c-dz*s),closing=Math.abs(p.speed)-o.vx*s-o.vz*c;
   return {o,forward,side,closing};
  }).filter(h=>Math.abs(h.o.y-p.y)<1.5&&h.forward>0&&h.side<h.o.radius+.65&&h.forward<look+h.o.radius&&(h.closing>.2||h.forward<3)).sort((a,b)=>a.forward/Math.max(.2,a.closing)-b.forward/Math.max(.2,b.closing));
  const hazard=hazards[0];
  if(hazard){this.id=hazard.o.id;this.retained=.65;const kind=hazard.o.kind==='pedestrian'?'WALKER':hazard.o.kind==='jogger'?'JOGGER':hazard.o.kind==='cyclist'?'CYCLIST':(hazard.o.kind==='segway'||hazard.o.kind==='scooter')?'SCOOTER':hazard.o.kind==='skater'?'SKATER':'OBSTACLE';this.text=`${kind} ${p.speed<0?'BEHIND':'AHEAD'} · ${hazard.forward<Math.abs(p.speed)*.8?'BRAKE NOW':'BRAKE EARLY'}`;}
  else{this.retained=Math.max(0,this.retained-dt);if(!this.retained){this.id='';this.text='';}}
  return this.text;
 }
 get hazardId(){return this.id;}
}

