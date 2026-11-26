import {performance} from 'node:perf_hooks';
import {isPromise} from 'node:util/types';

const MAX_ENTRIES=512,MAX_PHASE_MARKS=64;

/** Passive Node timing for the harness's existing operations. A settlement is
 * not successful-case acceptance; native input receipts belong to the case
 * lifecycle. Never race, await, retry, or replace an operation's return value. */
export function createCadillacOperationTiming({now=()=>performance.now()}={}){
 let lastNodeMs=null,currentPhase=null,observedOperations=0,settledOperations=0,phaseMarks=0,droppedOperations=0,droppedPhaseMarks=0;
 const entries=[],phases=[];
 function stamp(){
  let atNodeMs;try{atNodeMs=now();}catch{return{atNodeMs:null,clockError:'threw'};}
  if(!Number.isFinite(atNodeMs)||atNodeMs<0)return{atNodeMs:null,clockError:'invalid'};
  if(lastNodeMs!==null&&atNodeMs<lastNodeMs)return{atNodeMs:null,clockError:'regressed'};
  lastNodeMs=atNodeMs;return{atNodeMs,clockError:null};
 }
 function phase(name){
  currentPhase=typeof name==='string'?name:null;const time=stamp();
  const mark={sequence:++phaseMarks,name:currentPhase,...time};
  if(phases.length<MAX_PHASE_MARKS)phases.push(mark);else droppedPhaseMarks++;
 }
 function observe(label,operation){
  const start=stamp(),entry={sequence:++observedOperations,label:typeof label==='string'?label:null,phase:currentPhase,
   settlement:'pending',startedAtNodeMs:start.atNodeMs,completedAtNodeMs:null,durationMs:null,timingAvailable:false,
   startedClockError:start.clockError,completedClockError:null,settlementObservationError:null};
  if(entries.length<MAX_ENTRIES)entries.push(entry);else droppedOperations++;
  function finish(settlement){
   settledOperations++;const end=stamp();entry.settlement=settlement;entry.completedAtNodeMs=end.atNodeMs;entry.completedClockError=end.clockError;
   entry.timingAvailable=entry.startedAtNodeMs!==null&&end.atNodeMs!==null;
   if(entry.timingAvailable)entry.durationMs=end.atNodeMs-entry.startedAtNodeMs;
  }
  let result;try{result=operation();}catch(error){finish('rejected');throw error;}
  if(isPromise(result)){
   // Observe the original native promise without calling a replacement .then
   // property or assimilating arbitrary returned objects as thenables.
   try{Promise.prototype.then.call(result,()=>finish('resolved'),()=>finish('rejected'));}
   catch{entry.settlementObservationError='unavailable';}
  }else finish('resolved');
  return result;
 }
 return{observe,phase,snapshot:()=>({version:1,clock:'Node performance.now; independent of page performance.now',
  observedOperations,settledOperations,pendingOperations:observedOperations-settledOperations,droppedOperations,phaseMarks,droppedPhaseMarks,
  entries:entries.map(entry=>({...entry})),phases:phases.map(mark=>({...mark})),
  note:'Settlement records Node observation of the original operation, not successful-case acceptance. Native input receipts remain owned by the case lifecycle.'})};
}
