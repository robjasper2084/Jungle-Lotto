/** Keep the browser's live tag collection, not a cached modal result.
 * Each check sees synchronous insertion/removal and open-attribute changes.
 * No MutationObserver delay, layout/style read, event, or input side effect. */
export function createOpenDialogProbe(doc:Document):()=>boolean{
 const dialogs=doc.getElementsByTagName('dialog');
 return ()=>{
  for(let i=0,count=dialogs.length;i<count;i++)if(dialogs[i].hasAttribute('open'))return true;
  return false;
 };
}
