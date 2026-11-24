export type HydraulicClockTarget={
 readonly hydraulicCommandRevision:number;
 readonly hydraulicCommandTime:number;
 clearHydraulicCatchUp():void;
};
export type HydraulicClockMode='active'|'preview';

/** Real animation timestamps, independent of the driving dt cap. A new owner,
 * eligibility interval or preview mode starts with a zero-time sample. Commands
 * accepted between callbacks cannot consume time before their acceptance. */
export class HydraulicFrameClock {
 private owner?:HydraulicClockTarget;
 private mode?:HydraulicClockMode;
 private previous=0;
 private revision=0;

 reset(){
  this.owner?.clearHydraulicCatchUp();
  this.owner=undefined;this.mode=undefined;this.previous=this.revision=0;
 }

 sample(now:number,owner:HydraulicClockTarget,mode:HydraulicClockMode){
  const revision=owner.hydraulicCommandRevision,accepted=owner.hydraulicCommandTime;
  if(!Number.isFinite(now)||now<0||!Number.isSafeInteger(revision)||revision<0||!Number.isFinite(accepted)||accepted<0){
   this.reset();owner.clearHydraulicCatchUp();return 0;
  }
  if(this.owner!==owner||this.mode!==mode){
   this.reset();owner.clearHydraulicCatchUp();
   this.owner=owner;this.mode=mode;this.revision=revision;this.previous=Math.max(now,accepted);
   return 0;
  }
  const since=revision===this.revision?this.previous:Math.max(this.previous,accepted);
  this.revision=revision;
  // A timestamp issued before an input handler can precede performance.now()
  // at acceptance. Keep the future anchor rather than charge that time twice.
  this.previous=Math.max(since,now);
  return Math.max(0,now-since)/1000;
 }
}

/** A collapsed setup section is not an eligible preview. Attribute records
 * preserve a close/reopen boundary even when both happen between GPU frames. */
export function observeHydraulicPreviewBoundary(details:Element|null,changed:()=>void,Observer:typeof MutationObserver|undefined=globalThis.MutationObserver){
 if(!details||!Observer)return ()=>{};
 const observer=new Observer(records=>{
  if(records.some(record=>record.type==='attributes'&&record.target===details&&record.attributeName==='open'))changed();
 });
 observer.observe(details,{attributes:true,attributeFilter:['open']});
 return ()=>observer.disconnect();
}

/** Room communications blocks input through its own open/hidden state, outside
 * a modal dialog. Retain every boundary even if chat opens and closes while
 * GPU backpressure skips the entire interval's animation callbacks. */
export function observeHydraulicInputBoundary(surface:Element|null,changed:()=>void,Observer:typeof MutationObserver|undefined=globalThis.MutationObserver){
 if(!surface||!Observer)return ()=>{};
 const observer=new Observer(records=>{
  // Rewriting an existing boolean attribute changes neither input eligibility
  // nor time ownership. A true close/reopen still has at least one old presence
  // different from the final presence, even when both mutations arrive together.
  if(records.some(record=>record.type==='attributes'&&record.target===surface&&(record.attributeName==='open'||record.attributeName==='hidden')&&(record.oldValue!==null)!==surface.hasAttribute(record.attributeName)))changed();
 });
 observer.observe(surface,{attributes:true,attributeFilter:['open','hidden'],attributeOldValue:true});
 return ()=>observer.disconnect();
}
