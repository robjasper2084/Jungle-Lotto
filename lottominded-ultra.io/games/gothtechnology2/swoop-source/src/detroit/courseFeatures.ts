import {CUT_METRES} from './geography.ts';
import {GEO,cutWidth} from './geo-profile.ts';
import {FULL_ROUTE_GATES} from './fullRoute.ts';
export interface CourseFeature {id:number;kind:'slippery'|'jump';station:number;offset:number;length:number;width:number;height:number}
export function courseFeatures(seed:number):CourseFeature[]{
 let state=(seed^0xa783c1)>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};const out:CourseFeature[]=[];
 for(let d=180;d<CUT_METRES-110;d+=210){const station=d+random()*45;
  if([...GEO.bridges,...GEO.ramps].some(p=>Math.abs(p.at-station)<45)||FULL_ROUTE_GATES.some(g=>Math.abs(g-station)<24))continue;
  const kind=out.length%2===0?'slippery':'jump',width=1.15;
  out.push({id:out.length,kind,station,offset:(random()<.5?-1:1)*Math.min(1.1,cutWidth(station)/2-width/2-.3),length:kind==='jump'?4.5:7,width,height:kind==='jump'?.4:0});
 }
 return out;
}
export function featureContact(features:readonly CourseFeature[],station:number,offset:number){return features.find(f=>station>=f.station&&station<f.station+f.length&&Math.abs(offset-f.offset)<=f.width/2);}
export function rampLift(f:CourseFeature,station:number){return f.kind==='jump'?Math.max(0,Math.min(1,(station-f.station)/f.length))*f.height:0;}
