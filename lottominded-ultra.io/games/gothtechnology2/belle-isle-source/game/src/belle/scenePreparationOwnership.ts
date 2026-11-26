/** Each asynchronous preparation owns its own release. Finishing nested or
 * overlapping work must not resume scene submission while another owner still
 * needs the loading lock. Releases are idempotent for handoff/finally cleanup. */
export class ScenePreparationOwnership {
 private owners=new Set<object>();
 private changed:(busy:boolean)=>void;
 constructor(changed:(busy:boolean)=>void){this.changed=changed;}
 acquire(){
  const owner={};this.owners.add(owner);
  if(this.owners.size===1)this.changed(true);
  return ()=>{
   if(!this.owners.delete(owner))return;
   if(!this.owners.size)this.changed(false);
  };
 }
}
