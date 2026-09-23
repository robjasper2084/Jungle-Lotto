import {CUT_METRES} from './geography.ts';
import {GEO,cutWidth} from './geo-profile.ts';
export interface RouteHazard {id:number;station:number;offset:number;kind:'cone'|'barrier';radius:number}
/** Seed once at run start; never pop a new obstacle into a moving rider's path. */
export function routeHazards(seed:number,start=1730):RouteHazard[]{
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const out:RouteHazard[]=[];
 for(let d=Math.max(340,start+75);d<CUT_METRES-55;d+=95){
  const station=d+random()*22;
  if([...GEO.bridges,...GEO.ramps].some(p=>Math.abs(p.at-station)<28))continue;
  const kind=random()<.7?'cone':'barrier',radius=kind==='cone'?.42:.68,width=cutWidth(station);
  const offset=(random()<.5?-1:1)*Math.min(1.3,width/2-radius-.25);
  if(width/2+Math.abs(offset)-radius<2)continue;
  out.push({id:1000+out.length,station,offset,kind,radius});
 }
 return out;
}
