/** Render-only policy. Metres/radians/seconds; no vehicle or race-state writes. */
export const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
export const unit=(n:number)=>clamp(n,0,1);
export const smooth=(a:number,b:number,n:number)=>{const t=unit((n-a)/(b-a));return t*t*(3-2*t);};
export type PresentationQuality='smooth'|'automatic'|'high';
const SMOOTH_BUDGET=Object.freeze({reflectionSize:32,reflectionInterval:120,cloudStrength:.10,wind:.45,aircraft:false});
const DETAIL_BUDGET=Object.freeze({reflectionSize:64,reflectionInterval:45,cloudStrength:.22,wind:1,aircraft:true});
export function presentationBudget(q:string,xr=false){return q==='smooth'||xr?SMOOTH_BUDGET:DETAIL_BUDGET;}
export function fogColumn(cameraHeight:number,fragmentHeight:number){
 const a=clamp(cameraHeight,0,10000),b=clamp(fragmentHeight,0,10000);
 // Simpson integration of exponential density along the view ray.
 return .24+.76*(Math.exp(-a/140)+4*Math.exp(-(a+b)/280)+Math.exp(-b/140))/6;
}
export function reflectionRequired(now:number,last:number,hour:number,lastHour:number,coverage:number,lastCoverage:number,interval:number){
 if(!Number.isFinite(now)||now<2)return false;
 if(!Number.isFinite(last))return true;
 if(now-last<interval)return false;
 const delta=Math.abs(((hour-lastHour+36)%24)-12);
 return delta>=.12||Math.abs(coverage-lastCoverage)>.035||now-last>=interval*3;
}
export function aircraftFrame(time:number,out={age:0,x:0,y:0,z:0,heading:0,fade:0,visible:false}){
 const t=Number.isFinite(time)?Math.max(0,time):0,phase=t%240;
 // One 90-second crossing per four minutes; fades make loop reposition invisible.
 const age=phase-45,visible=age>0&&age<90;
 const fade=visible?smooth(0,8,age)*(1-smooth(78,90,age)):0;
 out.age=age;out.x=-5200+age*125;out.y=1850;out.z=-3300+age*12;out.heading=Math.atan2(125,12);out.fade=fade;out.visible=visible&&fade>.001;return out;
}
export const RIDER_CLIPS={
 idle:{duration:4.2,keys:[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]]},
 acceleration:{duration:.5,keys:[[0,0],[.23,-1],[.65,-.35],[1,0]]},
 braking:{duration:.65,keys:[[0,0],[.22,1],[.65,.32],[1,0]]},
 landing:{duration:.75,keys:[[0,0],[.16,1],[.48,.2],[.72,-.1],[1,0]]}
} as const;
export function sampleRiderClip(name:keyof typeof RIDER_CLIPS,age:number,loop=false){
 const c=RIDER_CLIPS[name],t=loop?((age/c.duration)%1+1)%1:unit(age/c.duration);
 if(!Number.isFinite(t))return 0;
 for(let i=1;i<c.keys.length;i++){const a=c.keys[i-1],b=c.keys[i];if(t<=b[0])return a[1]+(b[1]-a[1])*smooth(a[0],b[0],t);}
 return 0;
}
export interface EucInput {speed:number;riderPitch?:number;brakeAmount?:number;rollAngle?:number;turnIntent?:number;landingCompression?:number;bodyBob?:number;airBlend?:number;footMode?:number;footBlend?:number;crashBlend?:number;stopFoot?:number;seated?:number}
export interface EucMotion {pitch:number;drop:number;shift:number;lateral:number;hipTilt:number;hipYaw:number;chestRoll:number;chestYaw:number;headRoll:number;headYaw:number;neck:number;shoulders:number[];hands:{x:number;y:number;z:number;wrist:number}[]}
/** Alters only the already-created render target. The measured input stays immutable.
 * Current shared foot/arm solvers run AFTER this hook, preserving pedal contacts.
 */
export function articulateEuc(target:EucMotion,p:Readonly<EucInput>,clock:number,reduced:boolean){
 if(reduced||!Number.isFinite(p.speed)||(p.footMode??0)!==0||(p.footBlend??0)>.01||(p.crashBlend??0)>0||(p.stopFoot??0)>.01||(p.seated??0)>.01)return;
 const fast=smooth(5,20,Math.abs(p.speed)),air=unit(p.airBlend??0),turn=clamp(p.turnIntent??0,-1,1),carve=smooth(.025,.4,Math.abs(p.rollAngle??0));
 const brake=unit(p.brakeAmount??0),load=clamp((p.riderPitch??0)/.5,-1,1),landing=unit(p.landingCompression??0);
 // Measured envelopes select the attack segment of authored response curves.
 const accelPose=-sampleRiderClip('acceleration',Math.max(0,load)*.115),brakePose=sampleRiderClip('braking',brake*.143),landPose=sampleRiderClip('landing',landing*.12);
 const breathe=sampleRiderClip('idle',clock,true)*(1-fast)*.004;
 target.pitch=clamp(target.pitch+fast*.055+Math.sign(load)*accelPose*.025+brakePose*.028+breathe,-.3,.93);
 target.drop=clamp(target.drop+fast*.012+landPose*.026+air*.009,0,.46);
 target.shift=clamp(target.shift+load*.009-brake*.018,-.3,.2);
 target.lateral=clamp(target.lateral-turn*carve*.009,-.2,.2);
 target.hipYaw=clamp(target.hipYaw-turn*carve*.025,-.3,.3);
 target.chestYaw=clamp(target.chestYaw-turn*carve*.045,-.42,.42);
 target.headYaw=clamp(target.headYaw-turn*(.018+.055*carve),-.8,.8);
 target.neck=-target.pitch*.78;
 for(let i=0;i<2;i++){
  const side=i===0?1:-1,outside=side!==Math.sign(p.rollAngle??0),h=target.hands[i];if(!h)continue;
  const balance=carve*(outside?1:.25);
  h.x+=side*(.014*balance+.010*air);h.y+=.020*balance+.012*landing+breathe*.5;h.z+=.016*fast+.014*brake;
  target.shoulders[i]=(target.shoulders[i]??0)+side*(.012*balance+breathe*.4);
 }
}
export function windMask(y:number,low:number,high:number){return (1-unit((y-low)/Math.max(.0001,high-low)))**2;}
