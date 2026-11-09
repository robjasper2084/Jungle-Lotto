import type {Plant} from './naturePlan.ts';
import type {ParkMap} from './terrain.ts';

/** Art-directed canopy around the supplied Sunset Point reference, not a tree survey.
 * Build-time only: reuse existing hardwood assets and all original runtime budgets.
 * The point lawn, route shoulders, water, buildings and monuments remain clear.
 */
export const SUNSET_CANOPY_LIMIT=72;
export function makeSunsetCanopy(map:ParkMap,existing:readonly Plant[],clear:(x:number,z:number)=>boolean,height:(x:number,z:number)=>number):Plant[]{
 const point=[...map.landmarks,...map.pois].find(p=>p.name==='Sunset Point');
 if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return [];
 const dx=point.x+3127,dz=point.z-1983,length=Math.hypot(dx,dz);
 if(length<1)return [];
 const ux=dx/length,uz=dz/length,added:Plant[]=[];
 let seed=0x51c3a77;
 const rand=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 const round=(v:number)=>Math.round(v*1000)/1000;
 // Broad irregular groups behind the open tip, with no uniform planted rows.
 const groups=[[110,-65,55],[165,45,75],[245,-45,85],[270,85,60]] as const;
 for(let attempt=0;attempt<3600&&added.length<SUNSET_CANOPY_LIMIT&&existing.length+added.length<6500;attempt++){
  const group=groups[Math.floor(rand()*groups.length)],angle=rand()*Math.PI*2,r=Math.sqrt(rand())*group[2];
  const back=group[0]+Math.cos(angle)*r,side=group[1]+Math.sin(angle)*r;
  if(back<65||back>320)continue;
  const x=round(point.x+ux*back-uz*side),z=round(point.z+uz*back+ux*side);
  if(!clear(x,z)||existing.some(p=>Math.hypot(p.x-x,p.z-z)<10)||added.some(p=>Math.hypot(p.x-x,p.z-z)<12))continue;
  const y=height(x,z);if(!Number.isFinite(y))continue;
  added.push({id:rand()<.90?'maple':'birch',x,y:round(y),z,scale:round(1.22+rand()*.40),heightScale:round(.79+rand()*.17),yaw:round(rand()*Math.PI*2),tint:round(.91+rand()*.12),canopyTone:round(.18+rand()*.62)});
 }
 return added;
}
/** Same bounded tint for 3D leaves/trunks and their existing distant impostors. */
export function canopyTint(tint:number,tone=0):[number,number,number]{
 const base=Number.isFinite(tint)?Math.max(0,Math.min(1.2,tint)):1;
 const warm=Number.isFinite(tone)?Math.max(0,Math.min(1,tone)):0;
 return [base*(1+.16*warm),base*(1-.10*warm),base*(1-.32*warm)];
}
