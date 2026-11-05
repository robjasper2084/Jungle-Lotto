import {scottLayout} from './fountainLayout.ts';
import type {ParkMap,ParkTerrain} from './terrain.ts';
import type {TrialCourse,TrialGate,TrialPoint} from './trialRules.ts';

const TAU=Math.PI*2;
const distance=(a:TrialPoint,b:TrialPoint)=>Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
const length=(points:TrialPoint[])=>points.slice(1).reduce((total,p,i)=>total+distance(points[i],p),0);
const heading=(a:TrialPoint,b:TrialPoint)=>Math.atan2(b.x-a.x,b.z-a.z);

/** A closed route includes its start again at the end, but the first gate is ahead. */
function along(points:TrialPoint[],meters:number):TrialPoint{
 const total=length(points);let remaining=((meters%total)+total)%total;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],span=distance(a,b);
  if(remaining<=span){const t=span?remaining/span:0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};}
  remaining-=span;
 }
 return {...points[0]};
}

function wheelCup(map:ParkMap,terrain:ParkTerrain):TrialCourse{
 // This is the mapped, 8.4 m wide Fountain Drive circle, not the fountain basin.
 const road=map.roads.find(r=>r.id==='8733696');
 if(!road||road.points.length<3)throw new Error('Fountain Drive race road is missing');
 const path=road.points.map(([x,z])=>({x,y:terrain.height(x,z),z}));
 if(distance(path[0],path[path.length-1])>.01)path.push({...path[0]});
 const routeLength=length(path),direction=(meters:number)=>heading(along(path,meters-2),along(path,meters+2));
 const gates:TrialGate[]=Array.from({length:16},(_,i)=>{
  const meters=(i+1)*routeLength/16;
  return{...along(path,meters),heading:direction(meters),radius:Math.min(3,(road.width-2)/2),halfHeight:1.5};
 });
 return{id:'onewheel-island-cup-v1',vehicle:'onewheel',name:'One-Wheel Island Cup',description:'One short lap of Fountain Drive. Stay on the road and pass all 16 checkpoints in order.',distance:routeLength,start:{...path[0],heading:direction(0)},gates,path,color:'#ffcb6f',maxSpeed:24};
}

function bridgeSkyline(map:ParkMap):TrialCourse{
 const b=map.bridge,ux=(b.b[0]-b.a[0])/b.length,uz=(b.b[1]-b.a[1])/b.length;
 const first=100,last=b.length-100,turn=70;
 // The outgoing leg follows the bridge; the return leg is 140 m over the river.
 // These broad bends avoid under-bridge ribs and stay above the 24 m vessel ceiling.
 const point=(s:number,side:number):TrialPoint=>({x:b.a[0]+ux*s+uz*side,y:30+side/(turn*2)*4,z:b.a[1]+uz*s-ux*side});
 const turnPoint=(center:number,a:number)=>point(center+turn*Math.sin(a),turn-turn*Math.cos(a));
 const direction=(alongSpeed:number,sideSpeed:number)=>Math.atan2(ux*alongSpeed+uz*sideSpeed,uz*alongSpeed-ux*sideSpeed);
 const gates:TrialGate[]=[],path:TrialPoint[]=[point(first,0)];
 const gate=(p:TrialPoint,h:number)=>gates.push({...p,heading:h,radius:9,halfHeight:4});
 for(let i=1;i<=5;i++)gate(point(first+(last-first)*i/5,0),direction(1,0));
 for(let i=1;i<=4;i++){const a=Math.PI*i/4;gate(turnPoint(last,a),direction(Math.cos(a),Math.sin(a)));}
 for(let i=1;i<=5;i++)gate(point(last-(last-first)*i/5,turn*2),direction(-1,0));
 for(let i=1;i<=4;i++){const a=Math.PI+Math.PI*i/4;gate(turnPoint(first,a),direction(Math.cos(a),Math.sin(a)));}
 const straightSteps=Math.ceil((last-first)/25);
 for(let i=1;i<=straightSteps;i++)path.push(point(first+(last-first)*i/straightSteps,0));
 for(let i=1;i<=12;i++)path.push(turnPoint(last,Math.PI*i/12));
 for(let i=1;i<=straightSteps;i++)path.push(point(last-(last-first)*i/straightSteps,turn*2));
 for(let i=1;i<=12;i++)path.push(turnPoint(first,Math.PI+Math.PI*i/12));
 return{id:'sky-bridge-v1',vehicle:'hoverbike',name:'Bridge Skyline',description:'Fly above MacArthur Bridge, climb into the river return gates, then sweep back through the finish.',distance:length(path),start:{...path[0],heading:direction(1,0)},gates,path,color:'#62e5d0',maxSpeed:35};
}

function sunsetHalo(map:ParkMap):TrialCourse{
 const fountain=scottLayout(map),point=(a:number):TrialPoint=>({x:fountain.x+180*Math.sin(a),y:34,z:fountain.z+125*Math.cos(a)});
 const direction=(a:number)=>Math.atan2(180*Math.cos(a),-125*Math.sin(a));
 const path=Array.from({length:97},(_,i)=>point(TAU*i/96));
 const gates:TrialGate[]=Array.from({length:16},(_,i)=>{const a=TAU*(i+1)/16;return{...point(a),heading:direction(a),radius:9,halfHeight:4};});
 // The western-island planting tops out below 31 m; these gates are above it.
 // Keep this course west of the 30 m Peace Carillon, not directly over its roof.
 return{id:'sky-sunset-v1',vehicle:'hoverbike',name:'Sunset Halo',description:'Sweep above Scott Fountain and Sunset Drive through a broad, high loop. Hold your altitude through all 16 gates.',distance:length(path),start:{...path[0],heading:direction(0)},gates,path,color:'#a6a0ff',maxSpeed:35};
}

export function trialCourses(map:ParkMap,terrain:ParkTerrain):TrialCourse[]{
 return [wheelCup(map,terrain),bridgeSkyline(map),sunsetHalo(map)];
}
