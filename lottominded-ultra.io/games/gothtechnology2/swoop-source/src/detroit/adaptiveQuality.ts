/** Frame-budget controller with hysteresis; never changes physics or XR refresh. */
export class AdaptiveQuality {
 scale=1;detail=1;private samples:number[]=[];private good=0;
 reset(){this.scale=1;this.detail=1;this.samples=[];this.good=0;}
 sample(ms:number,active:boolean,targetFPS=60){
  if(!active||!Number.isFinite(ms)||ms<=0||ms>1000){this.samples=[];this.good=0;return false;}
  this.samples.push(ms);if(this.samples.length<180)return false;
  const values=this.samples.sort((a,b)=>a-b),p90=values[Math.floor(values.length*.9)];this.samples=[];
  const before=this.scale,detailBefore=this.detail,budget=1000/Math.max(30,Math.min(120,targetFPS));
  // Reduce distant scenery and shadow cost before sacrificing nearby clarity.
  if(p90>budget*1.35){if(this.detail>.65)this.detail=Math.max(.65,Math.round((this.detail-.1)*100)/100);else this.scale=Math.max(.65,Math.round((this.scale-.1)*100)/100);this.good=0;}
  else if(p90<budget*1.08){if(++this.good>=4){if(this.scale<1)this.scale=Math.min(1,this.scale+.05);else this.detail=Math.min(1,this.detail+.05);this.good=0;}}
  else this.good=0;
  return before!==this.scale||detailBefore!==this.detail;
 }
}
