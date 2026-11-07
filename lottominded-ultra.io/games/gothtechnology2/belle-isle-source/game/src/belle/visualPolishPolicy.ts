/** Presentation only: no simulation, weather settings, audio or record mutations. */
export interface HoverLightLevels { headlights:number; underglow:number; emissive:number }
const unit=(value:number,fallback=0)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;

/** Reuse `out` in the frame loop; smooth twilight without changing light count. */
export function hoverLightLevels(
 nightAmount:number, headlightsOn:boolean, highBeam:boolean, ledsOn:boolean,
 out:HoverLightLevels={headlights:0,underglow:0,emissive:0},
):HoverLightLevels {
 const n=unit(nightAmount),night=n*n*(3-2*n);
 out.headlights=headlightsOn?(highBeam?180+920*night:90+460*night):0;
 out.underglow=ledsOn?.8+8.2*night:0;
 out.emissive=ledsOn?.9+1.9*night:0;
 return out;
}

/** Retain the night baseline; modest existing hemispheric fill in daytime. */
export function skyFillIntensity(daylight:number,overcast:number):number {
 return 1.18+unit(daylight)*(.18+.08*unit(overcast));
}

/** User choice wins; only first-time compact/touch layouts default collapsed. */
export function initiallyCollapsedMap(saved:string|null,touch:boolean,width:number):boolean {
 if(saved==='true')return true;
 if(saved==='false')return false;
 return Number.isFinite(width)&&(width<=600||(touch&&width<=900));
}

export function hoverHelpText(touch:boolean,drone:boolean):string {
 if(touch)return 'Left thumb: move · Right side: look · UP / DOWN: height';
 return drone
  ?'W / S forward / back · A / D strafe · ← / → turn · E / Q height · release to hold · drag to look'
  :'W / S speed · A / D steer · E / Q height · Space brake · Shift boost · drag to look';
}

export interface ShrubVariation { x:number;z:number;scaleX:number;scaleY:number;scaleZ:number;yaw:number;hue:number;saturation:number;lightness:number }
/** Per-index seed does not alter the existing flower RNG or simulation RNG. */
export function entranceShrubVariation(index:number):ShrubVariation {
 let seed=(Math.trunc(Number.isFinite(index)?index:0)^0x5eeda11)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return {x:(random()-.5)*.14,z:(random()-.5)*.10,
  scaleX:.43+random()*.16,scaleY:.32+random()*.17,scaleZ:.41+random()*.14,
  yaw:random()*Math.PI*2,hue:.22+random()*.035,saturation:.24+random()*.11,lightness:.30+random()*.07};
}
