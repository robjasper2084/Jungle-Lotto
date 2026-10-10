// At most 250 ms of simulation work per callback. Lost wall time is measured;
// the match clock advances only for executed 60 Hz steps, never client timestamps.
export class RoyaleClock {
 private accumulator=0;
 readonly metrics={steps:0,droppedMs:0,overloadCallbacks:0,maxStepMs:0};
 advance(ms:number,step:()=>void){
  if(!Number.isFinite(ms)||ms<0)throw Error('Invalid simulation interval');
  const available=this.accumulator+ms/1000;
  if(available>.25){this.metrics.droppedMs+=(available-.25)*1000;this.metrics.overloadCallbacks++;}
  this.accumulator=Math.min(.25,available);
  let count=0;
  while(this.accumulator+1e-10>=1/60&&count<15){
   const start=performance.now();step();this.metrics.maxStepMs=Math.max(this.metrics.maxStepMs,performance.now()-start);
   this.accumulator=Math.max(0,this.accumulator-1/60);count++;this.metrics.steps++;
  }
  return count;
 }
}
