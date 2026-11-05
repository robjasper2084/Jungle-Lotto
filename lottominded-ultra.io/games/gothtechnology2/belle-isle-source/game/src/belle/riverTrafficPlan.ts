import {inside,segment,type ParkMap,type Point} from './terrain.ts';
export type BoatKind='freighter'|'tanker'|'fishing'|'leisure'|'response';
export const RIVER_ROUTES:Point[][]=[[[5200,-600],[4550,600],[3600,1350],[2400,1860],[1000,2100],[-1400,2500]],[[4900,-700],[4350,420],[3520,1040],[2420,1570],[1200,1800],[-1000,2150]]];
export const BOAT_LENGTH:Record<BoatKind,number>={freighter:150,tanker:110,fishing:8,leisure:11,response:13.7};
export function sampleRoute(points:Point[],distance:number){let left=distance;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left<=length||i===points.length-1){const t=Math.max(0,Math.min(1,left/length));return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,heading:Math.atan2(b[0]-a[0],b[1]-a[1])};}left-=length;}return{x:points[0][0],z:points[0][1],heading:0};}
export const routeLength=(points:Point[])=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
export function clearRiverRoute(map:ParkMap,route:Point[],margin:number){const shores=[map.island,map.mainland,...(map.outerIslets||[]).map(i=>i.points)];for(let d=0;d<=routeLength(route);d+=15){const p=sampleRoute(route,d);if(shores.some(s=>inside(p.x,p.z,s)||s.slice(1).some((q,i)=>segment(p.x,p.z,s[i],q).d<margin)))return false;}return true;}
export function nextBoat(random=Math.random){const r=random(),kind:BoatKind=r<.18?'tanker':r<.38?'freighter':r<.68?'fishing':'leisure';return{kind,route:kind==='freighter'||kind==='tanker'?0:1,reverse:random()>.5,speed:kind==='freighter'||kind==='tanker'?4.5+random()*1.7:2+random()*3.5,delay:35+random()*55};}
import {CatmullRomCurve3,Vector3} from 'three';
export type VesselKind='freighter'|'tanker'|'excursion'|'fishing';
export type Vessel={id:string;kind:VesselKind;length:number;width:number;height:number;speed:number;phase:number;route:RiverRoute;anchored:boolean;range:number};
export type VesselPose={x:number;z:number;heading:number;speed:number;visible:boolean;fade:number};
export class RiverRoute{
 readonly samples:Vector3[];readonly length:number;readonly closed:boolean;
 constructor(points:Point[],closed=false){this.closed=closed;const curve=new CatmullRomCurve3(points.map(p=>new Vector3(p[0],0,p[1])),closed,'centripetal');curve.arcLengthDivisions=1024;this.length=curve.getLength();this.samples=curve.getSpacedPoints(512);}
 sample(distance:number,out:VesselPose){const d=((distance%this.length)+this.length)%this.length/this.length*512,i=Math.floor(d),f=d-i,a=this.samples[i],b=this.samples[i+1];out.x=a.x+(b.x-a.x)*f;out.z=a.z+(b.z-a.z)*f;out.heading=Math.atan2(b.x-a.x,b.z-a.z);return out;}
}
export function riverClear(map:ParkMap,x:number,z:number,margin=0){
 for(let i=0;i<(margin?9:1);i++){const a=(i-1)*Math.PI/4,px=x+(i?Math.sin(a)*margin:0),pz=z+(i?Math.cos(a)*margin:0);
 if(inside(px,pz,map.island)||inside(px,pz,map.mainland)||(map.outerIslets||[]).some(p=>inside(px,pz,p.points)))return false;}
 return true;
}
export function makeRiverTraffic(map:ParkMap):Vessel[]{
 const channel:Point[]=[[-2800,3100],[-1400,2450],[-300,2140],[1100,1920],[2500,1420],[3900,850],[5200,100],[6500,-800]];
 const downstream=new RiverRoute(channel),upstream=new RiverRoute(channel.map(([x,z]):Point=>[x,z+180]).reverse());
 // Fictional Boblo-inspired circuit on the broad river side, clear of the low bridge.
 const scenic=new RiverRoute([[-850,1870],[400,1730],[2000,1500],[3700,950],[4400,150],[4600,650],[3400,1330],[1600,1950],[-650,2200]],true);
 const fleet:Vessel[]=[
 {id:'lake-freighter-west',kind:'freighter',length:190,width:23,height:24,speed:6.8,phase:.29,route:downstream,anchored:false,range:3600},
 {id:'river-tanker-east',kind:'tanker',length:145,width:21,height:20,speed:5.9,phase:.56,route:upstream,anchored:false,range:3600},
 {id:'lake-freighter-east',kind:'freighter',length:170,width:22,height:23,speed:6.4,phase:.81,route:downstream,anchored:false,range:3600},
 {id:'boblo-inspired-scenic',kind:'excursion',length:63,width:14,height:15,speed:3.2,phase:.13,route:scenic,anchored:false,range:2600}];
 let seed=2084;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const shores:Point[]=[[950,390],[1750,-90],[600,1680],[2750,1120]];
 for(const [cluster,[cx,cz]] of shores.entries())for(let i=0;i<2;i++){
  const x=cx+(random()-.5)*45,z=cz+(random()-.5)*45,anchored=random()<.68;
  const points:Point[]=Array.from({length:8},(_,j)=>[x+Math.sin(j*Math.PI/4)*18,z+Math.cos(j*Math.PI/4)*12]);
  const route=new RiverRoute(points,true);
  if(!route.samples.every(p=>riverClear(map,p.x,p.z,10)))continue;
  fleet.push({id:'fishing-'+cluster+'-'+i,kind:'fishing',length:6.5,width:2.5,height:3.1,speed:anchored?0:.65+random()*.35,phase:random(),route,anchored,range:750});
 }
 return fleet;
}
export function vesselPose(v:Vessel,time:number,x:number,z:number,out:VesselPose){
 const distanceOnRoute=v.phase*v.route.length+Math.max(0,time)*v.speed;v.route.sample(distanceOnRoute,out);out.speed=v.speed;
 const distance=Math.hypot(out.x-x,out.z-z),routeDistance=distanceOnRoute%v.route.length;
 const edge=v.route.closed?1:Math.min(routeDistance/400,(v.route.length-routeDistance)/400);
 out.fade=Math.max(0,Math.min(1,edge,(v.range-distance)/Math.min(450,v.range*.25)));out.visible=out.fade>.001;return out;
}
/** Swept bike centre against an expanded oriented vessel box. */
export function vesselRay(v:Vessel,p:VesselPose,o:{x:number;y:number;z:number},d:{x:number;y:number;z:number},max:number,half=1){
 const s=Math.sin(p.heading),c=Math.cos(p.heading),ox=o.x-p.x,oz=o.z-p.z;
 const origins=[ox*c-oz*s,o.y,ox*s+oz*c],dirs=[d.x*c-d.z*s,d.y,d.x*s+d.z*c],lo=[-v.width/2-half,-1,-v.length/2-half],hi=[v.width/2+half,v.height,v.length/2+half];let near=0,far=max;
 for(let a=0;a<3;a++){if(Math.abs(dirs[a])<1e-8){if(origins[a]<lo[a]||origins[a]>hi[a])return null;continue;}const ta=(lo[a]-origins[a])/dirs[a],tb=(hi[a]-origins[a])/dirs[a];near=Math.max(near,Math.min(ta,tb));far=Math.min(far,Math.max(ta,tb));if(near>far)return null;}
 return near<=max?near:null;
}

/** Opposing vessels use separate lanes on the broad river side of the island. */
export function trafficLane(route:number,reverse:boolean):Point[]{return RIVER_ROUTES[route].map(([x,z]):Point=>[x,z+(reverse?(route===0?100:40):0)]);}
