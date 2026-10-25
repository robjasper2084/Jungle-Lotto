/** The shared, serialized footProne value is the progress of one non-looping
 * descent. Reversing it retraces the support poses without restarting a take. */
export const PRONE_DOWN_SECONDS=1.05,PRONE_UP_SECONDS=1.10;
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=(v:number,a:number,b:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function stepPronePhase(phase:number,down:boolean,dt:number){
 const p=clamp(phase),delta=Math.max(0,Number.isFinite(dt)?dt:0)/(down?PRONE_DOWN_SECONDS:PRONE_UP_SECONDS);
 return clamp(p+(down?delta:-delta));
}
/** Knees and palms support the middle of the transition, so crawl input waits
 * until the legs are extended. Starting and reversing remain continuous. */
export function proneTravelWeight(phase:number){
 return 1-smooth(phase,0,.18)+smooth(phase,.82,1);
}
