/** Automatic mode adapts after sustained foreground pressure, including very slow frames. */
export class FrameBudget {
 scale=1;private sum=0;private count=0;private slow=0;private severe=0;private good=0;private warmup=2;
 reset(){this.scale=1;this.sum=this.count=this.slow=this.severe=this.good=0;this.warmup=2;}
 sample(dt:number,cap:number,eligible:boolean){
  // Menus, background time and the first resumed frame interrupt both pressure
  // and recovery streaks. They must not join separate bursts into a downgrade.
  if(!eligible||!Number.isFinite(dt)||dt<=0){this.sum=this.count=this.slow=this.severe=this.good=0;return false;}
  // A severe foreground stall is pressure, not missing data. Bound its weight
  // so one load hitch cannot consume the warmup or several evidence windows.
  const contribution=Math.min(dt,.5);
  if(this.warmup>0){this.warmup=Math.max(0,this.warmup-Math.min(dt,1));return false;}
  this.sum+=contribution;this.count++;if(this.sum<1.5||this.count<3)return false;
  const average=this.sum/this.count,target=1/Math.max(30,cap);this.sum=this.count=0;
  if(average>target*1.28){this.slow++;this.good=0;this.severe=average>target*3+1e-6?this.severe+1:0;}else if(average<target*1.08){this.good++;this.slow=this.severe=0;}else{this.slow=this.severe=this.good=0;}
  const old=this.scale;
  // Two separate severe windows justify the lightest tier immediately. A
  // single hitch or ordinary missed-frame pressure still cannot take this path.
  if(this.slow>=2){this.scale=this.severe>=2?.65:Math.max(.65,Math.round((this.scale-.1)*100)/100);this.slow=this.severe=0;}
  if(this.good>=8){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);this.good=0;}
  return old!==this.scale;
 }
}
export function sceneFrameCap(cap:number,active:boolean,overlay:boolean,focused:boolean){return !focused?5:overlay?10:active?cap:30;}
