/** Race state is independent of rendering and transport. Metres and seconds. */
export type RacePoint={x:number;z:number};
export type RaceGate=RacePoint & {radius:number};
export type RaceCourse={id:string;name:string;points:RaceGate[];heading:number;length:number};
export type RaceEntry={id:string;name:string;ai:boolean};
export type RaceProgress=RaceEntry & {next:number;passed:number;lap:number;penalty:number;finished:number|null;dnf:boolean;last:RacePoint;lastAt:number;recoverAt:number};
export const RACE_LIMIT=4;
export const RACE_MAX_SECONDS=7200;
export function bridgeCourse(b:{a:number[];b:number[];length:number}):RaceCourse{
 const ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;
 const point=(along:number,side:number,radius=3.1)=>({x:b.a[0]+ux*along+uz*side,z:b.a[1]+uz*along-ux*side,radius});
 const points:RaceGate[]=[];const lo=55,hi=b.length-55,r=4;
 for(let s=lo;s<=hi;s+=35)points.push(point(s,-r));points.push(point(hi,-r,2));
 for(let i=1;i<=8;i++){const a=Math.PI*i/8;points.push(point(hi+r*Math.sin(a),-r*Math.cos(a),1.9));}
 for(let s=hi-35;s>lo;s-=35)points.push(point(s,r));points.push(point(lo,r,2));
 for(let i=1;i<8;i++){const a=Math.PI*i/8;points.push(point(lo-r*Math.sin(a),r*Math.cos(a),1.9));}
 const length=points.reduce((sum,p,i)=>sum+Math.hypot(p.x-points[(i+1)%points.length].x,p.z-points[(i+1)%points.length].z),0);
 return{id:'macarthur-circuit-v1',name:'MacArthur Bridge Circuit',points,heading:Math.atan2(ux,uz),length};
}
export function gridSpot(c:RaceCourse,i:number){const p=c.points[0],back=8+Math.floor(i/2)*4,side=(i%2?1:-1)*.9;return{x:p.x-Math.sin(c.heading)*back+Math.cos(c.heading)*side,z:p.z-Math.cos(c.heading)*back-Math.sin(c.heading)*side,heading:c.heading};}
export function gateCrossed(a:RacePoint,b:RacePoint,g:RaceGate){const dx=b.x-a.x,dz=b.z-a.z,n=dx*dx+dz*dz,t=n?Math.max(0,Math.min(1,((g.x-a.x)*dx+(g.z-a.z)*dz)/n)):0;return Math.hypot(a.x+dx*t-g.x,a.z+dz*t-g.z)<=g.radius;}
export class RaceRules{
 readonly racers:RaceProgress[];readonly course:RaceCourse;readonly laps:number;elapsed=0;running=false;finished=false;
 constructor(course:RaceCourse,entries:RaceEntry[],laps:number){this.course=course;this.laps=laps;
  if(entries.length<1||entries.length>4||new Set(entries.map(e=>e.id)).size!==entries.length||![1,2,3].includes(laps))throw new RangeError('Race needs 1–4 unique riders and 1–3 laps');
  this.racers=entries.map((e,i)=>({...e,next:0,passed:0,lap:1,penalty:0,finished:null,dnf:false,last:gridSpot(course,i),lastAt:0,recoverAt:-10}));
 }
 tick(dt:number){if(!this.running||this.finished)return;this.elapsed+=Math.max(0,Math.min(dt,1));const first=this.racers.find(r=>r.finished!==null);if(this.elapsed>RACE_MAX_SECONDS||(first&&this.elapsed-(first.finished!-first.penalty)>90)){for(const r of this.racers)if(r.finished===null)r.dnf=true;}this.finished=this.racers.every(r=>r.finished!==null||r.dnf);}
 observe(id:string,p:RacePoint){const r=this.racers.find(r=>r.id===id);if(!r||r.dnf||r.finished!==null||!this.running||this.finished||!Number.isFinite(p.x)||!Number.isFinite(p.z))return false;
  const dt=this.elapsed-r.lastAt;if(dt<=0)return false;
  // Reject teleports and out-of-order gates. Recovery is a separate host action.
  if(Math.hypot(p.x-r.last.x,p.z-r.last.z)>Math.min(45,dt*28+2))return false;
  const crossed=gateCrossed(r.last,p,this.course.points[r.next]);r.last={...p};r.lastAt=this.elapsed;
  if(crossed){r.passed++;r.next=(r.next+1)%this.course.points.length;if(r.next===1&&r.passed>1){if(r.lap>=this.laps)r.finished=this.elapsed+r.penalty;else r.lap++;}this.finished=this.racers.every(r=>r.finished!==null||r.dnf);}
  return crossed;
 }
 recover(id:string){const r=this.racers.find(r=>r.id===id);if(!r||r.dnf||r.finished!==null||this.elapsed-r.recoverAt<2)return null;const i=r.passed?((r.next-1+this.course.points.length)%this.course.points.length):0,p=r.passed?this.course.points[i]:gridSpot(this.course,this.racers.indexOf(r)),q=this.course.points[r.passed?r.next:1];r.penalty+=3;r.recoverAt=this.elapsed;r.last={x:p.x,z:p.z};r.lastAt=this.elapsed;return{...r.last,heading:Math.atan2(q.x-p.x,q.z-p.z)};}
 disconnect(id:string){const r=this.racers.find(r=>r.id===id);if(r&&r.finished===null)r.dnf=true;this.finished=this.racers.every(r=>r.finished!==null||r.dnf);}
 standings(){return [...this.racers].sort((a,b)=>{if(a.dnf!==b.dnf)return a.dnf?1:-1;if(a.finished!==null||b.finished!==null)return(a.finished??Infinity)-(b.finished??Infinity);return b.passed-a.passed||Math.hypot(a.last.x-this.course.points[a.next].x,a.last.z-this.course.points[a.next].z)-Math.hypot(b.last.x-this.course.points[b.next].x,b.last.z-this.course.points[b.next].z);});}
}
export function aiRaceInput(p:RacePoint & {headingY:number;speed:number},c:RaceCourse,next:number,skill=1){const g=c.points[next],q=c.points[(next+1)%c.points.length],distance=Math.hypot(g.x-p.x,g.z-p.z);const desired=Math.atan2(g.x-p.x,g.z-p.z),angle=Math.atan2(Math.sin(desired-p.headingY),Math.cos(desired-p.headingY));const bend=Math.abs(Math.atan2(Math.sin(Math.atan2(q.x-g.x,q.z-g.z)-desired),Math.cos(Math.atan2(q.x-g.x,q.z-g.z)-desired)));const turning=g.radius<2.5||q.radius<2.5||Math.abs(angle)>.35||bend>.45;const speed=turning?1.7:Math.min(12*skill,2+distance*.65);return{steer:Math.max(-1,Math.min(1,-angle*2.4)),throttle:Math.max(-.8,Math.min(.8,(speed-p.speed)*.42)),stableAI:true};}
export function raceSeconds(s:number){return Math.floor(s/60)+':'+(s%60).toFixed(2).padStart(5,'0');}
export type RacePlan={type:'plan';id:string;host:string;course:string;laps:number;entries:RaceEntry[]};
export function validRacePlan(v:any,host:string,members:string[]):v is RacePlan{return v?.type==='plan'&&typeof v.id==='string'&&v.id.length<=80&&v.host===host&&['island-shoreline-v1','island-reverse-v1','island-landmarks-v1'].includes(v.course)&&[1,2,3].includes(v.laps)&&Array.isArray(v.entries)&&v.entries.length>=2&&v.entries.length<=4&&new Set(v.entries.map((e:any)=>e?.id)).size===v.entries.length&&v.entries.some((e:any)=>e?.id===host)&&v.entries.every((e:any)=>typeof e?.id==='string'&&members.includes(e.id)&&e.ai===false&&typeof e.name==='string'&&e.name.length<=24);}
