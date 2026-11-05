/** Yield construction work back to input/video/paint, without a hidden-tab rAF wait. */
export class WorkSlice {
 private started:number;
 constructor(private milliseconds=6,private now=()=>performance.now(),private yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0))){this.started=now();}
 async checkpoint(){
  if(this.now()-this.started<this.milliseconds)return;
  await this.yieldTask();this.started=this.now();
 }
}
