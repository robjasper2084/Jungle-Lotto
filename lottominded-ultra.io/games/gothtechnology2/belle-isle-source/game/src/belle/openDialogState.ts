type DialogRoot=Node&Pick<Document,'querySelector'>;
type DialogObserver=Pick<MutationObserver,'observe'|'takeRecords'|'disconnect'>;
type ObserverFactory=(notify:(records:readonly MutationRecord[])=>void)=>DialogObserver;

function mayChangeDialogPresence(records:readonly MutationRecord[]):boolean {
 for(const record of records){
  if(record.type==='attributes'){
   const target=record.target as Element|null;
   if(record.attributeName==='open'&&target?.nodeType===1&&
    typeof target.localName==='string'&&target.localName.length>0&&
    target.localName.toLowerCase()!=='dialog')continue;
   return true;
  }
  if(record.type!=='childList'||!record.addedNodes||!record.removedNodes)return true;
  // Text/comment replacement cannot create, remove or open a dialog. Keep all
  // element changes relevant: removed subtrees can mutate again before delivery,
  // so inspecting their current descendants would not prove what was removed.
  for(const node of record.addedNodes)if(node.nodeType!==3&&node.nodeType!==8)return true;
  for(const node of record.removedNodes)if(node.nodeType!==3&&node.nodeType!==8)return true;
 }
 return false;
}

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
  observer=createObserver(records=>{
   try{if(observer&&!dirty&&mayChangeDialogPresence(records))dirty=true;}
   catch{dispose();}
  });
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 }catch{dispose();}
 function hasOpenDialog():boolean {
  if(!observer)return query();
  try{const records=observer.takeRecords();if(!dirty&&mayChangeDialogPresence(records))dirty=true;}
  catch{dispose();return query();}
  if(dirty){
   // A query exception must leave the previous result invalid.
   const current=query();open=current;dirty=false;
  }
  return open;
 }
 return {hasOpenDialog,dispose};
}
