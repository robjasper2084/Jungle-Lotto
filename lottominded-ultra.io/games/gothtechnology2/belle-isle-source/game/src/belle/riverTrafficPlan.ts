import {inside,segment,type ParkMap,type Point} from './terrain.ts';
export type BoatKind='freighter'|'tanker'|'fishing'|'leisure'|'response';
export const RIVER_ROUTES:Point[][]=[[[5200,-600],[4550,600],[3600,1350],[2400,1860],[1000,2100],[-1400,2500]],[[4900,-700],[4350,420],[3520,1040],[2420,1570],[1200,1800],[-1000,2150]]];
export const BOAT_LENGTH:Record<BoatKind,number>={freighter:150,tanker:110,fishing:8,leisure:11,response:13.7};
export function sampleRoute(points:Point[],distance:number){let left=distance;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(left<=length||i===points.length-1){const t=Math.max(0,Math.min(1,left/length));return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,heading:Math.atan2(b[0]-a[0],b[1]-a[1])};}left-=length;}return{x:points[0][0],z:points[0][1],heading:0};}
export const routeLength=(points:Point[])=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
export function clearRiverRoute(map:ParkMap,route:Point[],margin:number){const shores=[map.island,map.mainland,...(map.outerIslets||[]).map(i=>i.points)];for(let d=0;d<=routeLength(route);d+=15){const p=sampleRoute(route,d);if(shores.some(s=>inside(p.x,p.z,s)||s.slice(1).some((q,i)=>segment(p.x,p.z,s[i],q).d<margin)))return false;}return true;}
export function nextBoat(random=Math.random){const r=random(),kind:BoatKind=r<.18?'tanker':r<.38?'freighter':r<.68?'fishing':'leisure';return{kind,route:kind==='freighter'||kind==='tanker'?0:1,reverse:random()>.5,speed:kind==='freighter'||kind==='tanker'?4.5+random()*1.7:2+random()*3.5,delay:35+random()*55};}

/** Opposing vessels use separate lanes on the broad river side of the island. */
export function trafficLane(route:number,reverse:boolean):Point[]{return RIVER_ROUTES[route].map(([x,z]):Point=>[x,z+(reverse?(route===0?100:40):0)]);}
