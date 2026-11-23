/** Bounded manual-capture CPU observations. No frame or GPU policy changes. */
export interface NatureRenderFrame {
 renderPasses:number;selectionCpuMs:number;captureCpuMs:number;cullCpuMs:number;
 selectionRefreshes:number;captureCalls:number;farPoolViewCalls:number;
 farSourceInstancesAcrossViews:number;farSubmittedInstancesAcrossViews:number;compactions:number;
 captureAttributeMarks:number;captureBytesMarked:number;compactionAttributeMarks:number;compactionBytesMarked:number;
 invalidObservations:number;
}
const fields=['renderPasses','selectionCpuMs','captureCpuMs','cullCpuMs','selectionRefreshes','captureCalls','farPoolViewCalls','farSourceInstancesAcrossViews','farSubmittedInstancesAcrossViews','compactions','captureAttributeMarks','captureBytesMarked','compactionAttributeMarks','compactionBytesMarked','invalidObservations'] as const;
function emptyFrame():NatureRenderFrame{return {renderPasses:0,selectionCpuMs:0,captureCpuMs:0,cullCpuMs:0,selectionRefreshes:0,captureCalls:0,farPoolViewCalls:0,farSourceInstancesAcrossViews:0,farSubmittedInstancesAcrossViews:0,compactions:0,captureAttributeMarks:0,captureBytesMarked:0,compactionAttributeMarks:0,compactionBytesMarked:0,invalidObservations:0};}
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
