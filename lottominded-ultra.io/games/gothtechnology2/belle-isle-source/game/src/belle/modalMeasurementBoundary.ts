type BoundaryObserver=Pick<MutationObserver,'observe'|'disconnect'>;
type ObserverFactory=(notify:(records:readonly MutationRecord[])=>void)=>BoundaryObserver;

/** Remember modal transitions even when a GPU wait prevents any game callback
 * from seeing the open dialog. Inspect mutation records, not the final DOM state:
 * a dialog can open and close before this observer's microtask runs. */
export function observeModalMeasurementBoundaries(root:Node,onBoundary:()=>void,
 createObserver:ObserverFactory=notify=>new MutationObserver(notify)):()=>void {
 let disposed=false;
 const observer=createObserver(records=>{
  if(!disposed&&records.some(record=>record.type==='attributes'&&record.attributeName==='open'&&record.target.nodeName==='DIALOG'))onBoundary();
 });
 observer.observe(root,{subtree:true,attributes:true,attributeFilter:['open']});
 return ()=>{if(disposed)return;disposed=true;observer.disconnect();};
}
