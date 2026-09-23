/** Frame-budget controller with hysteresis; never changes physics or XR refresh. */
export class AdaptiveQuality {
 scale=1;private samples:number[]=[];private good=0;
 sample(ms:number,active:boolean){
  if(!active||!Number.isFinite(ms)||ms<=0||ms>100){this.samples=[];this.good=0;return false;}
  this.samples.push(ms);if(this.samples.length<180)return false;
  const values=this.samples.sort((a,b)=>a-b),p90=values[Math.floor(values.length*.9)];this.samples=[];
  const before=this.scale;
  if(p90>19){this.scale=Math.max(.65,Math.round((this.scale-.1)*100)/100);this.good=0;}
  else if(p90<14){if(++this.good>=4){this.scale=Math.min(1,this.scale+.05);this.good=0;}}
  else this.good=0;
  return before!==this.scale;
 }
}
