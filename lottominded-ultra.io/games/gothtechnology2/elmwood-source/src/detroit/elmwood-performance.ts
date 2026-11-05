/** Counts real rendered frames; hidden-tab gaps do not enter the active sample. */
export class ElmwoodPerformance {
 frames=0;longFrames50=0;longFrames100=0;
 private previous:number|undefined;
 private windowStart:number|undefined;
 private samples:number[]=[];
 private cpu:number[]=[];
 private ride:number[]=[];private draw:number[]=[];
 fps=0;
 frameMsP95=0;
 frameMsP99=0;
 cpuMsP95=0;
 rideMsP95=0;drawMsP95=0;
 resetWindow(){this.previous=undefined;this.windowStart=undefined;this.samples=[];this.cpu=[];this.ride=[];this.draw=[];}
 rendered(now:number,cpuMs=0,rideMs=0,drawMs=0){
  this.frames++;
  if(this.previous!==undefined&&now>this.previous){const gap=now-this.previous;this.samples.push(gap);if(gap>50)this.longFrames50++;if(gap>100)this.longFrames100++;}
  this.previous=now;
  this.cpu.push(cpuMs);
  this.ride.push(rideMs);this.draw.push(drawMs);
  this.windowStart??=now;
  if(now-this.windowStart<1000||!this.samples.length)return false;
  const sorted=[...this.samples].sort((a,b)=>a-b);
  this.fps=this.samples.length*1000/(now-this.windowStart);
  this.frameMsP95=sorted[Math.ceil(sorted.length*.95)-1];
  this.frameMsP99=sorted[Math.ceil(sorted.length*.99)-1];
  const cpu=this.cpu.sort((a,b)=>a-b);this.cpuMsP95=cpu[Math.ceil(cpu.length*.95)-1]??0;
  this.ride.sort((a,b)=>a-b);this.draw.sort((a,b)=>a-b);this.rideMsP95=this.ride[Math.ceil(this.ride.length*.95)-1]??0;this.drawMsP95=this.draw[Math.ceil(this.draw.length*.95)-1]??0;
  this.windowStart=now;this.samples=[];this.cpu=[];this.ride=[];this.draw=[];
  return true;
 }
}
