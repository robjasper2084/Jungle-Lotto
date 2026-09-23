import config from './cut-geospatial.json' with {type:'json'};
import {nearestCut} from './geography.ts';
export const GEO=config;
export const MAP_ORIGIN={x:config.origin.map[0],y:(config.origin.trailDatumFeet-138)*.3048,z:config.origin.map[1]};
// The inherited map projection is left-handed in a Y-up scene. Reflect its X
// axis at this boundary so geographic east/north/up form a right-handed frame.
export const toLocal=(x:number,y:number,z:number)=>({x:MAP_ORIGIN.x-x,y:y-MAP_ORIGIN.y,z:z-MAP_ORIGIN.z});
export const toMap=(x:number,y:number,z:number)=>({x:MAP_ORIGIN.x-x,y:y+MAP_ORIGIN.y,z:z+MAP_ORIGIN.z});
export function gpsAt(x:number,z:number){
  const e=-.5*x-.8660254*z,n=.8660254*x-.5*z;
  return{lat:42.3283+n/111320,lon:-83.0399+e/(111320*Math.cos(42.3283*Math.PI/180))};
}
export function sourceProfileLevel(d:number,kind:'floor'|'street'){
  const samples=GEO.profile;let i=1;while(i<samples.length-1&&samples[i].at<d)i++;
  const a=samples[i-1],b=samples[i],t=Math.max(0,Math.min(1,(d-a.at)/(b.at-a.at)));
  return(a[kind]+(b[kind]-a[kind])*t-138)*.3048;
}
// Vertical dimensions in the source pack are estimates. Calibrate a consistent
// game clearance above the highest trail level anywhere under each skew span.
// Keep the mapped footprint and original trail grades. Streets, banks, ramp
// landings, visible decks and colliders all consume this same corrected datum.
export const BRIDGE_SLAB_DEPTH=.8,BRIDGE_BEAM_DEPTH=.48;
export const BRIDGE_LEVELS=GEO.bridges.map(b=>{
  const ds=b.points.map(p=>nearestCut(p[0],p[1]).d),start=Math.min(...ds)-2,end=Math.max(...ds)+2;
  const highFloor=Math.max(...[start,end,...GEO.profile.filter(p=>p.at>start&&p.at<end).map(p=>p.at)].map(d=>sourceProfileLevel(d,'floor')));
  const minClearance=b.name.toLowerCase().includes('pedestrian')?4:4.5;
  const sourceTop=Math.max(sourceProfileLevel(start,'street'),sourceProfileLevel(end,'street'));
  const top=Math.max(sourceTop,highFloor+minClearance+BRIDGE_SLAB_DEPTH+BRIDGE_BEAM_DEPTH+.08);
  return{name:b.name,start,end,highFloor,minClearance,sourceTop,top,raise:top-sourceTop,source:'authored clearance calibration; vertical survey unverified'};
});
const streetProfile=[
  ...GEO.profile.filter(p=>!BRIDGE_LEVELS.some(b=>p.at>=b.start&&p.at<=b.end)).map(p=>({at:p.at,y:(p.street-138)*.3048})),
  ...BRIDGE_LEVELS.flatMap(b=>[{at:b.start,y:b.top},{at:b.end,y:b.top}])
].sort((a,b)=>a.at-b.at);
export function profileLevel(d:number,kind:'floor'|'street'){
  if(kind==='floor')return sourceProfileLevel(d,kind);
  let i=1;while(i<streetProfile.length-1&&streetProfile[i].at<d)i++;
  const a=streetProfile[i-1],b=streetProfile[i],t=Math.max(0,Math.min(1,(d-a.at)/(b.at-a.at)));
  return a.y+(b.y-a.y)*t;
}
export const cutWidth=(d:number)=>d<1594?6.096:4.572;
const rampProfiles=GEO.ramps.map(ramp=>{
  const lengths=[0];for(let i=1;i<ramp.points.length;i++)lengths.push(lengths[i-1]+Math.hypot(ramp.points[i][0]-ramp.points[i-1][0],ramp.points[i][1]-ramp.points[i-1][1]));
  return{ramp,lengths,low:profileLevel(ramp.at,'floor'),high:profileLevel(ramp.topAt,'street')};
});
export function nearestRamp(x:number,z:number){
  let best={distance:Infinity,height:0,width:0,id:''};
  for(const {ramp,lengths,low,high} of rampProfiles){
    for(let i=1;i<ramp.points.length;i++){
      const a=ramp.points[i-1],b=ramp.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=lengths[i]-lengths[i-1];if(!len)continue;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(len*len))),distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
      if(distance<best.distance){const progress=(lengths[i-1]+t*len)/lengths.at(-1)!;best={distance,height:low+(high-low)*progress,width:ramp.width,id:ramp.id};}
    }
  }
  return best;
}
