type DialogRoot=Node&Pick<Document,'querySelector'>;
type DialogObserver=Pick<MutationObserver,'observe'|'takeRecords'|'disconnect'>;
type ObserverFactory=(notify:(records:readonly MutationRecord[])=>void)=>DialogObserver;

/** Cache only the presence of dialog[open], never a frame's input/modal policy.
 * DOM mutations enqueue observer records synchronously. Draining this private
 * observer before every read sees even a dialog opened inside the current game
 * callback, before MutationObserver delivery. The separate measurement-boundary
 * observer keeps its own records, including an open/close between two reads.
 * Observe the Document for its lifetime, including back/forward-cache resumes.
 */
export function createOpenDialogState(root:DialogRoot,
 createObserver:ObserverFactory=notify=>new MutationObserver(notify)) {
 let observer:DialogObserver|undefined,dirty=true,open=false;
 const query=()=>!!root.querySelector('dialog[open]');
 function dispose(){
  const previous=observer;observer=undefined;dirty=true;
  try{previous?.disconnect();}catch{/* Live queries remain authoritative. */}
 }
 try{
  observer=createObserver(records=>{if(observer&&records.length)dirty=true;});
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 }catch{dispose();}
 function hasOpenDialog():boolean {
  if(!observer)return query();
  try{if(observer.takeRecords().length)dirty=true;}
  catch{dispose();return query();}
  if(dirty){
   // A query exception must leave the previous result invalid.
   const current=query();open=current;dirty=false;
  }
  return open;
 }
 return {hasOpenDialog,dispose};
}
