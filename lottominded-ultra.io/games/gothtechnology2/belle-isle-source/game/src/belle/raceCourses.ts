import paths from './racePaths.json';
import type {RaceCourse,RaceGate} from './raceRules.ts';
export const RACE_ROUTE_IDS=['island-shoreline-v1','island-reverse-v1','island-landmarks-v1'];
export const ROUTE_COLORS=['#62e5d0','#ffcb6f','#a6a0ff'];
/** Road centerlines, not straight shortcuts between landmarks. Closed events use both directions. */
export function islandCourses(b:{a:number[];b:number[];length:number}):RaceCourse[]{
 const ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;
 const bridge=(s:number,side:number):[number,number]=>[b.a[0]+ux*s+uz*side,b.a[1]+uz*s-ux*side];
 return [paths.perimeter,[...paths.perimeter].reverse(),paths.garden].map((island,index)=>{
  const raw:number[][]=[bridge(8,-4)];for(let s=32;s<b.length-24;s+=24)raw.push(bridge(s,-4));raw.push(...island);
  for(let s=b.length-24;s>8;s-=24)raw.push(bridge(s,4));raw.push(bridge(8,4));
  // A marked low-speed turnaround on the wide mainland approach closes the circuit.
  for(let i=1;i<=12;i++){const a=Math.PI*i/12;raw.push(bridge(8-4*Math.sin(a),4*Math.cos(a)));}
  const points:RaceGate[]=[];for(let i=0;i<raw.length-1;i++){const p=raw[i],q=raw[i+1],length=Math.hypot(q[0]-p[0],q[1]-p[1]);if(length<.15)continue;const count=Math.ceil(length/22);for(let j=0;j<count;j++)points.push({x:p[0]+(q[0]-p[0])*j/count,z:p[1]+(q[1]-p[1])*j/count,radius:i>=raw.length-13?1.1:3.2});}
  const length=points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+Math.hypot(p.x-q.x,p.z-q.z);},0);
  return{id:RACE_ROUTE_IDS[index],name:['Shoreline Circuit','Reverse Island Circuit','Gardens & Landmarks Circuit'][index],points,heading:Math.atan2(ux,uz),length};
 });
}
