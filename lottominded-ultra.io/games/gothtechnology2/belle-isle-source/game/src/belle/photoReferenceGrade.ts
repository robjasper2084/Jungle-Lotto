/** Belle Isle Sunset Point photo palette controls.
 * This is an inexpensive 1D scene-lighting LUT, not a fullscreen color pass.
 * In all graphics tiers it adjusts the shared sky/water/foliage light response
 * without additional fullscreen buffers, textures, draw calls, or render passes.
 * Stops are artist-matched to the provided golden-hour Detroit River photograph;
 * they are not a calibrated camera/monitor color transform.
 */
type GradeStop={solar:number;warm:number;glint:number;foliage:number;haze:number};
export const BELLE_PHOTO_LOOKUP:readonly GradeStop[]=Object.freeze([
 {solar:-.40,warm:0,glint:0,foliage:0,haze:0},
 {solar:-.12,warm:0,glint:0,foliage:0,haze:0},
 {solar:-.02,warm:.48,glint:.16,foliage:.32,haze:.30},
 {solar:.09,warm:1,glint:1,foliage:.82,haze:.78},
 {solar:.22,warm:.85,glint:.75,foliage:.68,haze:.72},
 {solar:.38,warm:.38,glint:.24,foliage:.30,haze:.28},
 {solar:.70,warm:.04,glint:.02,foliage:0,haze:0},
 {solar:1,warm:0,glint:0,foliage:0,haze:0}
]);
const finite=(n:number,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=(t:number)=>{const s=clamp(t);return s*s*(3-2*s);};
export function sunsetPhotoGrade(solar:number,overcast:number,night:number){
 const height=clamp(finite(solar,-1),-1,1);
 let a=BELLE_PHOTO_LOOKUP[0],b=BELLE_PHOTO_LOOKUP.at(-1)!;
 for(let i=1;i<BELLE_PHOTO_LOOKUP.length;i++)if(height<=BELLE_PHOTO_LOOKUP[i].solar){a=BELLE_PHOTO_LOOKUP[i-1];b=BELLE_PHOTO_LOOKUP[i];break;}
 const t=ease((height-a.solar)/(b.solar-a.solar));
 const value=(name:'warm'|'glint'|'foliage'|'haze')=>a[name]+(b[name]-a[name])*t;
 const cloud=clamp(finite(overcast)),dark=clamp(finite(night));
 return {
  warmth:value('warm')*(1-.48*cloud)*(1-dark),
  glint:value('glint')*(1-.78*cloud)*(1-dark),
  foliage:value('foliage')*(1-.35*cloud)*(1-dark),
  haze:value('haze')*(1-.35*cloud)*(1-dark)
 };
}
/** A bounded scale blend around the existing 3D-to-card LOD boundary.
 * Keep impostors full-size outside the near radius. No new trees are spawned.
 */
export function treeLodBlend(distance:number,radius:number,transition=24){
 if(!Number.isFinite(distance)||!Number.isFinite(radius)||radius<=0||!Number.isFinite(transition)||transition<=0)return 0;
 return ease((radius-Math.max(0,distance))/transition);
}

/** Same shadow-map resolution; widen only when the viewer is above ground.
 * Quantized extent avoids projection churn from minor rider/camera motion. */
export function photoShadowExtent(cameraY:number){
 const height=Number.isFinite(cameraY)?Math.max(0,cameraY-10):0;
 return Math.min(170,55+Math.floor(height*1.4/5)*5);
}
