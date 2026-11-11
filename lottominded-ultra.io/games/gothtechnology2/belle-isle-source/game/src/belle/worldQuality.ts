import {environmentQuality,type EnvironmentQuality} from './environmentDetail.ts';

/** Smooth mode keeps inexpensive grounded contact shadows, but avoids an
 * additional world-sized dynamic shadow-map render on software/low-end GPUs.
 * High and Automatic retain the original dynamic-lighting policy. */
export function dynamicShadowsEnabled(quality:EnvironmentQuality):boolean{
 return quality!=='smooth';
}

/** Resolution can adapt without rebuilding unchanged detail pools. The dead
 * band keeps a recovering device from switching detail at every scale step. */
export class WorldQuality {
 requested:EnvironmentQuality='automatic';
 effective:EnvironmentQuality='automatic';
 scale=1;
 private applied:EnvironmentQuality|undefined;
 private ratio=0;
 private detail:(quality:EnvironmentQuality)=>void;
 private pixels:(ratio:number)=>void;
 private deviceRatio:()=>number;
 constructor(detail:(quality:EnvironmentQuality)=>void,pixels:(ratio:number)=>void,deviceRatio=()=>devicePixelRatio){
  this.detail=detail;this.pixels=pixels;this.deviceRatio=deviceRatio;
 }
 setQuality(value:string){
  this.requested=environmentQuality(value);this.effective=this.requested;this.scale=1;this.apply();
 }
 setBudget(value:number){
  if(this.requested!=='automatic'||!Number.isFinite(value))return;
  this.scale=Math.max(.25,Math.min(1,value));
  if(this.effective==='smooth'){
   if(this.scale>=.85)this.effective='automatic';
  }else if(this.scale<=.75)this.effective='smooth';
  this.apply();
 }
 private apply(){
  const device=this.deviceRatio(),dpr=Number.isFinite(device)&&device>0?device:1;
  const ratio=this.requested==='high'?Math.min(dpr,1.5):this.requested==='smooth'?1:Math.min(dpr,1.25)*this.scale;
  if(ratio!==this.ratio){this.ratio=ratio;this.pixels(ratio);}
  if(this.effective!==this.applied){this.applied=this.effective;this.detail(this.effective);}
 }
}
