/** Bounded manual-capture CPU observations. No frame or GPU policy changes. */
import {copyRenderSubmissionFrame,renderSubmissionOperationNames,type RenderSubmissionFrame} from './renderSubmissionDiagnostics.ts';
import {ProgramCensusSummary} from './renderProgramCensus.ts';
export interface NatureRenderFrame {
 renderPasses:number;selectionCpuMs:number;captureCpuMs:number;cullCpuMs:number;
 selectionRefreshes:number;captureCalls:number;farPoolViewCalls:number;
 farSourceInstancesAcrossViews:number;farSubmittedInstancesAcrossViews:number;compactions:number;
 captureAttributeMarks:number;captureBytesMarked:number;compactionAttributeMarks:number;compactionBytesMarked:number;
 invalidObservations:number;
}
const fields=['renderPasses','selectionCpuMs','captureCpuMs','cullCpuMs','selectionRefreshes','captureCalls','farPoolViewCalls','farSourceInstancesAcrossViews','farSubmittedInstancesAcrossViews','compactions','captureAttributeMarks','captureBytesMarked','compactionAttributeMarks','compactionBytesMarked','invalidObservations'] as const;
export const RENDER_DIAGNOSTICS_NOTE='Manual capture CPU observations across all actual world-scene render passes in the sampled callback. selectionCpuMs times view.render and INCLUDES captureCpuMs; cullCpuMs times the following far-pool loop and is disjoint. Do not add captureCpuMs to selectionCpuMs. Pool/source/submitted counts are sums across views, not unique trees. Far-helper capture and compaction bytes count CPU-side attribute marks (other scene buffers are excluded), may mark the same buffer twice before one draw, and are not actual driver uploads or GPU time. Top render work rows describe the current callback; previousEligibleCallback associates the preceding eligible profiled callback with a subsequent frame interval, not proof of its cause.';
function emptyFrame():NatureRenderFrame{return {renderPasses:0,selectionCpuMs:0,captureCpuMs:0,cullCpuMs:0,selectionRefreshes:0,captureCalls:0,farPoolViewCalls:0,farSourceInstancesAcrossViews:0,farSubmittedInstancesAcrossViews:0,compactions:0,captureAttributeMarks:0,captureBytesMarked:0,compactionAttributeMarks:0,compactionBytesMarked:0,invalidObservations:0};}
export function copyNatureRenderFrame(value:NatureRenderFrame|undefined):NatureRenderFrame|null{
 if(!value)return null;
 for(const key of fields)if(!Number.isFinite(value[key])||value[key]<0)return null;
 const copy=emptyFrame();for(const key of fields)copy[key]=value[key];return copy;
}
export class NatureRenderProbe {
 active=false;
 private frame=emptyFrame();
 private clock:()=>number;
 constructor(clock:()=>number=()=>performance.now()){this.clock=clock;}
 beginFrame(capturing:boolean){this.active=capturing;if(capturing)for(const key of fields)this.frame[key]=0;}
 cancelFrame(){this.active=false;}
 now(){return this.active?this.clock():0;}
 elapsed(phase:'selectionCpuMs'|'captureCpuMs'|'cullCpuMs',start:number){
  if(!this.active)return;
  const duration=this.clock()-start;
  if(Number.isFinite(duration)&&duration>=0)this.frame[phase]+=duration;else this.frame.invalidObservations++;
 }
 pass(){if(this.active)this.frame.renderPasses++;}
 refresh(){if(this.active)this.frame.selectionRefreshes++;}
 capture(){if(this.active)this.frame.captureCalls++;}
 pool(source:number,submitted:number){if(!this.active)return;if(!Number.isSafeInteger(source)||source<0||!Number.isSafeInteger(submitted)||submitted<0||submitted>source){this.frame.invalidObservations++;return;}this.frame.farPoolViewCalls++;this.frame.farSourceInstancesAcrossViews+=source;this.frame.farSubmittedInstancesAcrossViews+=submitted;}
 compact(){if(this.active)this.frame.compactions++;}
 marked(kind:'capture'|'compaction',bytes:number){if(!this.active)return;if(!Number.isSafeInteger(bytes)||bytes<0){this.frame.invalidObservations++;return;}if(kind==='capture'){this.frame.captureAttributeMarks++;this.frame.captureBytesMarked+=bytes;}else{this.frame.compactionAttributeMarks++;this.frame.compactionBytesMarked+=bytes;}}
 finishFrame():NatureRenderFrame|undefined{if(!this.active)return;this.active=false;return {...this.frame};}
}
export function createNatureRenderProbe(search:string,clock?:()=>number){return new URLSearchParams(search).get('profile')==='manual'?new NatureRenderProbe(clock):undefined;}

export interface RenderWorkRow {sample:number;place:string;x:number;z:number;renderMs:number;draws:number;triangles:number;nature:NatureRenderFrame;submission?:RenderSubmissionFrame|null}
export function copyRenderWorkRow(row:RenderWorkRow):RenderWorkRow{return {...row,nature:{...row.nature},...(row.submission?{submission:copyRenderSubmissionFrame(row.submission)}:{})};}
type Group={frames:number;renderCpuMsTotal:number;maxRenderCpuMs:number;selectionCpuMsTotal:number;captureCpuMsTotal:number;cullCpuMsTotal:number};
const group=():Group=>({frames:0,renderCpuMsTotal:0,maxRenderCpuMs:0,selectionCpuMsTotal:0,captureCpuMsTotal:0,cullCpuMsTotal:0});
/** Constant-sized totals and at most 100 located render-work rows. */
export class RenderDiagnosticsSummary {
 private count=0;private invalid=0;private totals=emptyFrame();private maxima=emptyFrame();
 private refreshed=group();private retained=group();private top:RenderWorkRow[]=[];
 private limit:number;
 constructor(limit=100){this.limit=Math.max(0,Math.min(100,Number.isFinite(limit)?Math.floor(limit):100));}
 invalidSample(){this.invalid++;}
 add(row:RenderWorkRow){
  this.count++;for(const key of fields){this.totals[key]+=row.nature[key];this.maxima[key]=Math.max(this.maxima[key],row.nature[key]);}
  const g=row.nature.selectionRefreshes?this.refreshed:this.retained;g.frames++;g.renderCpuMsTotal+=row.renderMs;g.maxRenderCpuMs=Math.max(g.maxRenderCpuMs,row.renderMs);g.selectionCpuMsTotal+=row.nature.selectionCpuMs;g.captureCpuMsTotal+=row.nature.captureCpuMs;g.cullCpuMsTotal+=row.nature.cullCpuMs;
  if(!this.limit)return;
  if(this.top.length<this.limit)this.top.push(copyRenderWorkRow(row));
  else{let least=0;for(let i=1;i<this.top.length;i++)if(this.top[i].renderMs<this.top[least].renderMs)least=i;if(row.renderMs>this.top[least].renderMs)this.top[least]=copyRenderWorkRow(row);}
 }
 report(){return {profiledCallbacks:this.count,invalidDiagnosticSamples:this.invalid,totals:{...this.totals},maxima:{...this.maxima},callbacksWithSelectionRefresh:{...this.refreshed},callbacksWithoutSelectionRefresh:{...this.retained},topRenderWork:this.top.slice().sort((a,b)=>b.renderMs-a.renderMs).map(copyRenderWorkRow),note:RENDER_DIAGNOSTICS_NOTE};}
}

export const SUBMISSION_DIAGNOSTICS_NOTE='Manual eligible-render-window CPU observations only. Direct draw timing includes nested GL operations; do not sum those inclusive categories. outsideDirectCpuMs identifies operation time observed outside renderer.renderBufferDirect. matrix times the world scene updateMatrixWorld call, not every camera update. GL-call durations can include synchronous driver work and are not GPU execution time. Hook coverage is recorded separately; missing hooks are not zero-cost evidence. No upload byte count is inferred. Top direct draws retain at most three bounded object/material labels per callback. The observer adds CPU work and does not change frame acceptance, FPS, graphics or GPU pacing.';
type SubmissionOperationTotals={calls:number;cpuMs:number;maxCallCpuMs:number;maxFrameCpuMs:number;outsideDirectCalls:number;outsideDirectCpuMs:number;maxOutsideDirectFrameCpuMs:number};
const submissionOperationTotals=():SubmissionOperationTotals=>({calls:0,cpuMs:0,maxCallCpuMs:0,maxFrameCpuMs:0,outsideDirectCalls:0,outsideDirectCpuMs:0,maxOutsideDirectFrameCpuMs:0});
/** CPU totals retain the existing located lists; program detail has its own cap. */
export class RenderSubmissionSummary {
 private count=0;private invalid=0;
 private programCensus:ProgramCensusSummary|undefined;
 private operations=Object.fromEntries(renderSubmissionOperationNames.map(name=>[name,submissionOperationTotals()])) as Record<typeof renderSubmissionOperationNames[number],SubmissionOperationTotals>;
 invalidSample(){this.invalid++;}
 add(frame:RenderSubmissionFrame){
  this.count++;
  if(frame.programCensus){this.programCensus??=new ProgramCensusSummary();this.programCensus.add(frame.programCensus,this.count);}
  for(const name of renderSubmissionOperationNames){
   const value=frame.operations[name],total=this.operations[name];
   total.calls+=value.calls;total.cpuMs+=value.cpuMs;total.maxCallCpuMs=Math.max(total.maxCallCpuMs,value.maxCpuMs);total.maxFrameCpuMs=Math.max(total.maxFrameCpuMs,value.cpuMs);
   total.outsideDirectCalls+=value.outsideDirectCalls;total.outsideDirectCpuMs+=value.outsideDirectCpuMs;total.maxOutsideDirectFrameCpuMs=Math.max(total.maxOutsideDirectFrameCpuMs,value.outsideDirectCpuMs);
  }
 }
 report(){return {profiledCallbacks:this.count,invalidDiagnosticSamples:this.invalid,operations:Object.fromEntries(renderSubmissionOperationNames.map(name=>[name,{...this.operations[name]}])),...(this.programCensus?{programCensus:this.programCensus.report()}:{}),note:SUBMISSION_DIAGNOSTICS_NOTE};}
}
