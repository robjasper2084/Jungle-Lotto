/** Automatic mode adapts only after sustained pressure; brief loading spikes are ignored. */
export class FrameBudget {
 scale=1;private sum=0;private count=0;private slow=0;private good=0;private warmup=2;
 reset(){this.scale=1;this.sum=this.count=this.slow=this.good=0;this.warmup=2;}
 sample(dt:number,cap:number,eligible:boolean){
  if(!eligible||!Number.isFinite(dt)||dt<=0||dt>.25){this.sum=this.count=this.good=0;return false;}
  if(this.warmup>0){this.warmup-=dt;return false;}
  this.sum+=dt;this.count++;if(this.sum<1.5)return false;
  const average=this.sum/this.count,target=1/Math.max(30,cap);this.sum=this.count=0;
  if(average>target*1.28){this.slow++;this.good=0;}else if(average<target*1.08){this.good++;this.slow=0;}else{this.slow=this.good=0;}
  const old=this.scale;
  if(this.slow>=2){this.scale=Math.max(.65,Math.round((this.scale-.1)*100)/100);this.slow=0;}
  if(this.good>=8){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);this.good=0;}
  return old!==this.scale;
 }
}
export function sceneFrameCap(cap:number,active:boolean,overlay:boolean,focused:boolean){return !focused?5:overlay?10:active?cap:30;}
