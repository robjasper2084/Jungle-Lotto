import config from './cut-geospatial.json' with {type:'json'};
import {BASE_NAVD88} from './city-spatial.ts';
export const GEO=config;
export const datumHeight=(feet:number)=>(feet+479.25)*.3048-BASE_NAVD88;
export const MAP_ORIGIN={x:config.origin.map[0],y:datumHeight(config.origin.trailDatumFeet),z:config.origin.map[1]};
// The inherited map projection is left-handed in a Y-up scene. Reflect its X
// axis at this boundary so geographic east/north/up form a right-handed frame.
export const toLocal=(x:number,y:number,z:number)=>({x:MAP_ORIGIN.x-x,y:y-MAP_ORIGIN.y,z:z-MAP_ORIGIN.z});
export const toMap=(x:number,y:number,z:number)=>({x:MAP_ORIGIN.x-x,y:y+MAP_ORIGIN.y,z:z+MAP_ORIGIN.z});
export function gpsAt(x:number,z:number){
  const e=-.5*x-.8660254*z,n=.8660254*x-.5*z;
  return{lat:42.3283+n/111320,lon:-83.0399+e/(111320*Math.cos(42.3283*Math.PI/180))};
}
export function profileLevel(d:number,kind:'floor'|'street'){
  const samples=GEO.profile;let i=1;while(i<samples.length-1&&samples[i].at<d)i++;
  const a=samples[i-1],b=samples[i],t=Math.max(0,Math.min(1,(d-a.at)/(b.at-a.at)));
  return datumHeight(a[kind]+(b[kind]-a[kind])*t);
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
