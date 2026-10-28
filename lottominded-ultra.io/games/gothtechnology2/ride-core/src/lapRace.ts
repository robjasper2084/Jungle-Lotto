export type RacePoint={x:number;y:number;z:number};
export type RaceEntry={id:string;name:string;pose:RacePoint&{headingY?:number}};
export type LapRacer={id:string;name:string;next:number;completed:number;finish?:number;previous:RacePoint;invalid:boolean};
const distance=(a:RacePoint,b:RacePoint)=>Math.hypot(a.x-b.x,a.z-b.z);
/** Sequential swept gates, height filtering and relocation detection are shared
 * across hosts. No progress is inferred from a bot's intended path. */
export class LapRace {
 readonly racers:LapRacer[];elapsed=0;countdown=3;stage:'grid'|'racing'|'finished'='grid';
 constructor(readonly course:readonly RacePoint[],entries:readonly RaceEntry[],readonly laps=3){
  if(course.length<3||!entries.length||new Set(entries.map(p=>p.id)).size!==entries.length||laps<1)throw Error('Race needs a course and unique entrants');
  this.racers=entries.map(p=>({id:p.id,name:p.name,next:1,completed:0,previous:{...p.pose},invalid:false}));
 }
 update(dt:number,entries:readonly RaceEntry[],paused=false){
  if(paused||dt<=0||this.stage==='finished')return;
  dt=Math.min(dt,.15);
  if(this.stage==='grid'){
   const ready=this.racers.every(r=>{const p=entries.find(e=>e.id===r.id)?.pose;return p&&distance(p,this.course[0])<6&&Math.abs(p.y-this.course[0].y)<2;});
   this.countdown=ready?Math.max(0,this.countdown-dt):3;
   for(const r of this.racers){const p=entries.find(e=>e.id===r.id)?.pose;if(p)r.previous={...p};}
   if(this.countdown===0)this.stage='racing';return;
  }
  this.elapsed+=dt;
  for(const r of this.racers){
   const p=entries.find(e=>e.id===r.id)?.pose;if(!p||r.finish!==undefined)continue;
   const old=r.previous,travel=distance(p,old),g=this.course[r.next];
   if(travel>Math.max(5,dt*65)){r.invalid=true;r.previous={...p};continue;}
   // Recovery doesn't award skipped gates; the rider must return to the pending gate.
   const dx=p.x-old.x,dz=p.z-old.z,t=Math.max(0,Math.min(1,((g.x-old.x)*dx+(g.z-old.z)*dz)/(dx*dx+dz*dz||1)));
   if(Math.hypot(old.x+dx*t-g.x,old.z+dz*t-g.z)<3.2&&Math.abs(p.y-g.y)<2){
    r.invalid=false;r.completed++;r.next=(r.next+1)%this.course.length;
    if(r.next===1&&r.completed>=this.laps*this.course.length)r.finish=this.elapsed;
   }
   r.previous={...p};
  }
  if(this.racers.every(r=>r.finish!==undefined))this.stage='finished';
 }
 rank(){return [...this.racers].sort((a,b)=>a.finish!==undefined&&b.finish!==undefined?a.finish-b.finish:a.finish!==undefined?-1:b.finish!==undefined?1:b.completed-a.completed||distance(a.previous,this.course[a.next])-distance(b.previous,this.course[b.next]));}
 lap(r:LapRacer){return Math.min(this.laps,1+Math.floor(r.completed/this.course.length));}
}
/** A reversible lane circuit works on narrow maps without cutting through scenery. */
export function outAndBack(points:readonly RacePoint[]){
 const sampled:RacePoint[]=[];
 for(const p of points)if(!sampled.length||distance(sampled.at(-1)!,p)>=8)sampled.push({x:p.x,y:p.y,z:p.z});
 return sampled.length>=3?[...sampled,...sampled.slice(1,-1).reverse()]:[];
}
