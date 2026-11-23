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
 private mappedLayout:boolean|undefined;
 private ratio=0;
 private detail:(quality:EnvironmentQuality,mappedLayout:boolean)=>void;
 private pixels:(ratio:number)=>void;
 private deviceRatio:()=>number;
 private softwareRasterizer:boolean;
 constructor(detail:(quality:EnvironmentQuality,mappedLayout:boolean)=>void,pixels:(ratio:number)=>void,deviceRatio=()=>devicePixelRatio,softwareRasterizer=false){
  this.detail=detail;this.pixels=pixels;this.deviceRatio=deviceRatio;this.softwareRasterizer=softwareRasterizer;
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
  // Software WebGL has a smaller internal framebuffer budget; keep all High
  // scene materials, geometry, and shadows. Native hardware retains full DPR.
  const ratio=this.requested==='high'?Math.min(dpr,this.softwareRasterizer?.7:1.5):this.requested==='smooth'?1:Math.min(dpr,this.softwareRasterizer?.85:1.25)*this.scale;
  if(ratio!==this.ratio){this.ratio=ratio;this.pixels(ratio);}
  // Three includes the shadow layout in every lit material's program key.
  // Automatic can suspend shadow draws without relinking the entire view.
  const mappedLayout=dynamicShadowsEnabled(this.requested);
  if(this.effective!==this.applied||mappedLayout!==this.mappedLayout){
   this.applied=this.effective;this.mappedLayout=mappedLayout;
   this.detail(this.effective,mappedLayout);
  }
 }
}
