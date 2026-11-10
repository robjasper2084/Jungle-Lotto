/** Six-hole short-game interpretation within the mapped Chip and Putt Course.
 * Hole positions are authored for gameplay, not a surveyed real-world scorecard. */
export type GolfPoint=[number,number];
export type GolfHole={name:string;tee:GolfPoint;cup:GolfPoint;par:number;green:number;sand:GolfPoint;radius:number};
export const GOLF_HOLES:GolfHole[]=[
 {name:'First roll',tee:[3140,-116],cup:[3137,-125],par:2,green:13,sand:[3124,-132],radius:32},
 {name:'Lagoon approach',tee:[3120,-149],cup:[3135,-172],par:3,green:8,sand:[3127,-166],radius:35},
 {name:'Long putt',tee:[3091,-226],cup:[3102,-228],par:2,green:13,sand:[3084,-220],radius:35},
 {name:'Sand-side chip',tee:[3110,-233],cup:[3125,-258],par:3,green:8,sand:[3119,-251],radius:36},
 {name:'River bend',tee:[3069,-284],cup:[3036,-284],par:3,green:9,sand:[3046,-278],radius:44},
 {name:'Home green',tee:[3074,-233],cup:[3079,-245],par:2,green:15,sand:[3061,-248],radius:32},
];
export type GolfPhase='aim'|'moving'|'holed'|'limit';
export class GolfRound {
 holeIndex=0;strokes=0;score:number[]=[];phase:GolfPhase='aim';club:'putter'|'wedge'='putter';
 x=0;z=0;y=0;vx=0;vz=0;vy=0;aim=0;power=.45;notice='';elapsed=0;private accumulator=0;private last:GolfPoint=[0,0];
 private playable:(x:number,z:number)=>boolean;
 constructor(playable:(x:number,z:number)=>boolean=()=>true){this.playable=playable;this.startHole(0);}
 get hole(){return GOLF_HOLES[this.holeIndex];}
 get distance(){return Math.hypot(this.x-this.hole.cup[0],this.z-this.hole.cup[1]);}
 get lie(){return Math.hypot(this.x-this.hole.sand[0],this.z-this.hole.sand[1])<3.5?'sand':this.distance<this.hole.green?'green':'fairway';}
 get finished(){return this.holeIndex===GOLF_HOLES.length-1&&['holed','limit'].includes(this.phase);}
 startHole(index:number){this.holeIndex=Math.max(0,Math.min(5,index));this.x=this.hole.tee[0];this.z=this.hole.tee[1];this.y=0;this.vx=this.vz=this.vy=0;this.strokes=0;this.phase='aim';this.notice='';this.accumulator=0;this.aim=Math.atan2(this.hole.cup[0]-this.x,this.hole.cup[1]-this.z);this.club=this.hole.par===2?'putter':'wedge';this.power=.45;}
 strike(){if(this.phase!=='aim')return false;this.last=[this.x,this.z];this.strokes++;this.phase='moving';this.notice='';this.elapsed=0;this.accumulator=0;const p=Math.max(.03,Math.min(1,this.power));const speed=this.club==='putter'?.5+p*7.8:3+p*12;this.vx=Math.sin(this.aim)*speed;this.vz=Math.cos(this.aim)*speed;this.vy=this.club==='wedge'?speed*.6:0;return true;}
 next(){if(!['holed','limit'].includes(this.phase)||this.finished)return false;this.startHole(this.holeIndex+1);return true;}
 private finish(phase:'holed'|'limit'){this.phase=phase;this.vx=this.vz=this.vy=0;this.score[this.holeIndex]=this.strokes;}
 tick(dt:number,running=true){if(!running||this.phase!=='moving'||!Number.isFinite(dt))return;this.accumulator+=Math.max(0,Math.min(.1,dt));while(this.accumulator>=1/120&&this.phase==='moving'){this.step(1/120);this.accumulator-=1/120;}}
 private step(dt:number){
  this.elapsed+=dt;const ox=this.x,oz=this.z;this.x+=this.vx*dt;this.z+=this.vz*dt;
  if(this.y>0||this.vy>0){this.y+=this.vy*dt;this.vy-=9.81*dt;if(this.y<=0){this.y=0;this.vy=Math.abs(this.vy)>.85?-this.vy*.24:0;this.vx*=.71;this.vz*=.71;}}
  else{const speed=Math.hypot(this.vx,this.vz);const friction=this.lie==='sand'?4.5:this.lie==='green'?.48:1.35;const k=speed?Math.max(0,speed-friction*dt)/speed:0;this.vx*=k;this.vz*=k;}
  // Swept cup test prevents a low-speed putt from skipping across the small cup.
  const dx=this.x-ox,dz=this.z-oz,l=dx*dx+dz*dz;const t=l?Math.max(0,Math.min(1,((this.hole.cup[0]-ox)*dx+(this.hole.cup[1]-oz)*dz)/l)):0;
  if(this.y<.04&&Math.hypot(this.vx,this.vz)<1.7&&Math.hypot(ox+t*dx-this.hole.cup[0],oz+t*dz-this.hole.cup[1])<.085){this.x=this.hole.cup[0];this.z=this.hole.cup[1];this.y=-.06;this.finish('holed');this.notice='In the cup!';return;}
  if(Math.hypot(this.x-this.hole.cup[0],this.z-this.hole.cup[1])>this.hole.radius||(this.y<.04&&!this.playable(this.x,this.z))||this.elapsed>35){this.x=this.last[0];this.z=this.last[1];this.y=0;this.vx=this.vz=this.vy=0;this.strokes++;this.notice='Outside the practice area · one penalty stroke. Ball returned.';}
  if(this.y===0&&Math.abs(this.vy)<.01&&Math.hypot(this.vx,this.vz)<.035){this.vx=this.vz=this.vy=0;if(this.strokes>=8){this.finish('limit');this.notice='Eight-stroke practice limit reached.';}else{this.phase='aim';this.aim=Math.atan2(this.hole.cup[0]-this.x,this.hole.cup[1]-this.z);}}
 }
}
