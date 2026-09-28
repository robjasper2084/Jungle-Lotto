/** Counts real rendered frames; hidden-tab gaps do not enter the active sample. */
export class ElmwoodPerformance {
 frames=0;
 private previous:number|undefined;
 private windowStart:number|undefined;
 private samples:number[]=[];
 fps=0;
 frameMsP95=0;
 frameMsP99=0;
 resetWindow(){this.previous=undefined;this.windowStart=undefined;this.samples=[];}
 rendered(now:number){
  this.frames++;
  if(this.previous!==undefined&&now>this.previous)this.samples.push(now-this.previous);
  this.previous=now;
  this.windowStart??=now;
  if(now-this.windowStart<1000||!this.samples.length)return false;
  const sorted=[...this.samples].sort((a,b)=>a-b);
  this.fps=this.samples.length*1000/(now-this.windowStart);
  this.frameMsP95=sorted[Math.ceil(sorted.length*.95)-1];
  this.frameMsP99=sorted[Math.ceil(sorted.length*.99)-1];
  this.windowStart=now;this.samples=[];
  return true;
 }
}
