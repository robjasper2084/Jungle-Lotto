import {CITY} from './geography.ts';
import {mappedSpline} from './mapped-spline.ts';

export const CUT_TRAFFIC=mappedSpline(CITY.cut);
export const TRAFFIC_RUNOUT=180;
// OSM 69706033 joins the Cut to the paved Riverwalk. Extending the Cut's
// tangent instead sent traffic into the harbor railings and then into water.
const riverwalk=mappedSpline(CITY.roads.find(r=>r.id==='69706033')!.points);
const approach=Array.from({length:46},(_,i)=>{const p=riverwalk.sample(TRAFFIC_RUNOUT-i*4);return[p.x,p.z];});
const route=mappedSpline([...approach.slice(0,-1),...CITY.cut]);
const start=CITY.cut[0];let origin=0,nearest=Infinity,station=0;
for(let i=1;i<route.samples.length;i++){
 const a=route.samples[i-1],b=route.samples[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
 const t=Math.max(0,Math.min(1,((start[0]-a.x)*dx+(start[1]-a.z)*dz)/(length*length)));
 const distance=Math.hypot(start[0]-a.x-dx*t,start[1]-a.z-dz*t);
 if(distance<nearest){nearest=distance;origin=station+length*t;}station+=length;
}
const cutScale=(route.length-origin)/CUT_TRAFFIC.length;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Signed Cut station; its southern runout follows the real connecting path. */
export function trafficPoint(distance:number,offset:number){
 const d=distance<0?origin+distance:origin+distance*cutScale;
 const at=clamp(d,0,route.length),p=route.sample(at);
 const ahead=route.sample(clamp(at+20,0,route.length)),behind=route.sample(clamp(at-20,0,route.length));
 const heading=Math.atan2(ahead.x-behind.x,ahead.z-behind.z);
 // Use the same smooth heading for the lateral lane and the body. Segment
 // normals at the ninety-degree entrance otherwise fold the inside lane back.
 return{x:p.x-Math.cos(heading)*offset+Math.sin(heading)*(d-at),z:p.z+Math.sin(heading)*offset+Math.cos(heading)*(d-at),heading};
}
