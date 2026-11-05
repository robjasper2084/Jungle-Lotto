/** Bounded first-30-second telemetry. Pause/hidden gaps are excluded, and the
 * completed report stays available instead of being overwritten by a calm view. */
export class StartupFrames {
 private last:number|undefined;private elapsed=0;private frames:number[]=[];private cpu:number[]=[];private actors=0;
 reset(){this.last=undefined;this.elapsed=0;this.frames=[];this.cpu=[];this.actors=0;}
 pause(){this.last=undefined;}
 get activeMs(){return this.elapsed;}
 sample(now:number,cpu:number,actors=0){
  if(this.elapsed>=30000)return;
  if(this.last!==undefined){const gap=Math.max(0,now-this.last);this.elapsed+=gap;this.frames.push(gap);this.cpu.push(cpu);this.actors=Math.max(this.actors,actors);}
  this.last=now;
 }
 get report(){const sorted=[...this.frames].sort((a,b)=>a-b),cpu=[...this.cpu].sort((a,b)=>a-b),percent=(a:number[],p:number)=>a[Math.max(0,Math.ceil(a.length*p)-1)]??0;return {complete:this.elapsed>=30000,activeMs:Math.round(this.elapsed),frames:sorted.length,fps:this.elapsed?sorted.length*1000/this.elapsed:0,p95:percent(sorted,.95),p99:percent(sorted,.99),max:sorted.at(-1)??0,over50:sorted.filter(n=>n>50).length,over100:sorted.filter(n=>n>100).length,cpuP95:percent(cpu,.95),maxActors:this.actors};}
}
