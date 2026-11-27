/** One independent ten-minute collection case, followed by bounded cleanup. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
export const CASE_MS=10*60_000,CLEANUP_MS=30_000;
export class CaseBudget{
 constructor({now=()=>performance.now()}={}){this.now=now;this.started=now();this.stopped=false;}
 elapsed(){return this.now()-this.started;}
 stop(){this.stopped=true;}
 check(){if(this.stopped||this.elapsed()>=CASE_MS)throw Error('View preflight exceeded its independent ten-minute case budget');}
 remaining(maximum=CASE_MS){this.check();assert(Number.isFinite(maximum)&&maximum>0);return Math.max(1,Math.min(maximum,CASE_MS-this.elapsed()));}
 async run(label,operation,maximum=90_000){
  const remaining=this.remaining(maximum);let timer;
  try{
   const result=await Promise.race([
    Promise.resolve().then(()=>{this.check();return operation(remaining);}),
    new Promise((_,reject)=>{timer=setTimeout(()=>{this.stop();reject(Error(label+' exceeded the bounded case deadline'));},remaining);})
   ]);this.check();return result;
  }finally{clearTimeout(timer);}
 }
}
/** Cleanup uses an absolute total deadline; no failure extends later stages. */
export async function cleanupWithin(steps,{now=()=>performance.now()}={}){
 const started=now(),rows=[];
 for(const {name,maximumMs,run}of steps){
  const remaining=Math.min(maximumMs,CLEANUP_MS-(now()-started));
  if(remaining<=0){rows.push({name,complete:false,error:'Absolute cleanup deadline exhausted'});continue;}
  let timer;const before=now();
  try{await Promise.race([Promise.resolve().then(run),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' cleanup deadline exceeded')),remaining);})]);rows.push({name,complete:true,elapsedMs:now()-before});}
  catch(error){rows.push({name,complete:false,elapsedMs:now()-before,error:String(error?.stack||error)});}
  finally{clearTimeout(timer);}
 }
 const elapsedMs=now()-started;return{budgetMs:CLEANUP_MS,elapsedMs,steps:rows,complete:elapsedMs<=CLEANUP_MS&&rows.every(row=>row.complete)};
}
