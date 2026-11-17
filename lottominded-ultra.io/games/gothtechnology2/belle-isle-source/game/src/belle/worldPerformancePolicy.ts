/** Render-only budgets: no collision, gameplay, or route rules change. */
/** Limit redundant directional shadow-map submissions while retaining full
 * map resolution, every caster, and the original world geometry.
 * Clock values are simulation seconds; resets cover a sky/quality transition. */
export class ShadowMapCadence {
 private last=-Infinity;
 private readonly interval:number;
 constructor(interval=1/10){this.interval=interval;}
 shouldRefresh(clock:number):boolean{
  if(!Number.isFinite(clock))return true;
  if(clock<this.last||clock-this.last>=this.interval){
   this.last=clock;
   return true;
  }
  return false;
 }
 reset(){this.last=-Infinity;}
}


export type WorldPerformanceTier='smooth'|'automatic'|'high';

/** Fewer shadow texels on high quality; the 110m caster budget keeps
 * near-rider shadows while avoiding irrelevant geometry submissions.
 * Smooth retains contact shadows instead of a directional shadow map. */
/** Software WebGL cannot sustain large shadow-texture raster passes at dense bridges.
 * Native GPU quality remains unchanged; the software renderer retains real mapped shadows. */
export function softwareWebGLRenderer(description:string):boolean{
 return /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(description);
}
export function directionalShadowResolution(quality:WorldPerformanceTier,software=false):number{
 if(software&&quality!=='smooth')return 768;
 return quality==='high'?1536:1024;
}
export function directionalCasterEligible(quality:WorldPerformanceTier,distance:number,radius:number,authored:boolean):boolean{
 if(!authored||quality==='smooth'||!Number.isFinite(distance)||!Number.isFinite(radius))return false;
 const reach=quality==='high'?110:85;
 return distance<=reach+Math.max(0,radius);
}

/** Co-op's 2–4 viewports have different culling, but share a single
 * world clock. Gate only position-independent work, not per-eye scenery. */
export class WorldFrameWork{
 private lastClock:number|undefined;
 begin(clock:number):boolean{
  if(!Number.isFinite(clock))return true;
  if(this.lastClock===clock)return false;
  this.lastClock=clock;
  return true;
 }
 reset(){this.lastClock=undefined;}
}

/** One or two desktop co-op cameras retain mapped shadows. On coarse
 * pointer devices, use the already-present contact shadows for every pane. */
export function coopMappedShadows(viewCount:number,coarsePointer:boolean):boolean{
 return viewCount<3&&!coarsePointer;
}
