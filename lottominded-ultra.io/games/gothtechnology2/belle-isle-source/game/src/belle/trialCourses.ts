import {scottLayout} from './fountainLayout.ts';
import type {ParkMap,ParkTerrain,Point} from './terrain.ts';
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
 // Center the first checkpoint in the starting view before the rider follows the bend.
 return{id:'onewheel-island-cup-v1',vehicle:'onewheel',name:'One-Wheel Island Cup',description:'One short lap of Fountain Drive. Stay on the road and pass all 16 checkpoints in order.',distance:routeLength,start:{...path[0],heading:heading(path[0],gates[0])},gates,path,color:'#ffcb6f',maxSpeed:24};
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

// The complete mapped driving loop. This stays on the road around the island;
// the eastern wetland walking trails are deliberately not treated as a road.
const PERIMETER_ROADS=[
 '8745620','443360495','42986446','42986445','660010944','1330844392','334108441','681806103','681806104','660010946','8748402','660010948',
 '657743560','8751758','1479298527','660010951','657099906','1014472287','660010956','660010958','660010960','660010968','660010976',
 '660010983','660010990','660010998','657743561','660011013','660011018','660011024','660011052','660011048','660011032','660011039',
 '1543125459','660011054','660011056','860335422','860335421','660011058','660011060','8750200','658403703','658403719',
 '1205008543','657743565','1205008544','8753238','545955464','334108440','657099911',
] as const;
// At Inselruhe the second circuit takes an inland return through Loiter Way,
// Muse Road, Central Avenue and Picnic Way, then closes at the bridge approach.
const GARDEN_ROADS=[...PERIMETER_ROADS.slice(0,PERIMETER_ROADS.indexOf('545955464')),
 '-1543310085','-1543310086','-550519577','-550519575','-587194609','-1014472282','-8769003',
 '8761197','42986437','551050169','334108440','657099911',
];

function roadLoop(map:ParkMap,ids:readonly string[]):Point[]{
 const points:Point[]=[];
 for(const token of ids){
  const reverse=token.startsWith('-'),id=reverse?token.slice(1):token,road=map.roads.find(r=>r.id===id);
  if(!road||road.foot||road.width<6)throw new Error(`Race road ${id} is missing or too narrow`);
  const next=reverse?[...road.points].reverse():road.points;
  if(points.length&&Math.hypot(points.at(-1)![0]-next[0][0],points.at(-1)![1]-next[0][1])>.05)throw new Error(`Race roads do not meet at ${id}`);
  for(const point of next)if(!points.length||Math.hypot(points.at(-1)![0]-point[0],points.at(-1)![1]-point[1])>.001)points.push([...point]);
 }
 if(Math.hypot(points[0][0]-points.at(-1)![0],points[0][1]-points.at(-1)![1])>.05)throw new Error('Island race road loop is open');
 points[points.length-1]=[...points[0]];return points;
}

/** Retain road bends while sampling ramps closely enough for a ground-level guide. */
function subdivide(points:Point[],spacing:number):Point[]{
 const result:Point[]=[[...points[0]]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing));
  for(let j=1;j<=steps;j++){const t=j/steps;result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 }
 return result;
}

function circuitGates(path:TrialPoint[],spacing:number,radius:number,halfHeight:number,markCorners=false):TrialGate[]{
 const total=length(path),count=Math.ceil(total/spacing),stations=Array.from({length:count},(_,i)=>(i+1)*total/count);
 if(markCorners){
  let meters=0;
  for(let i=1;i<path.length-1;i++){
   meters+=distance(path[i-1],path[i]);
   const turn=heading(path[i],path[i+1])-heading(path[i-1],path[i]);
   if(Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))>.65&&meters>20&&stations.every(s=>Math.abs(s-meters)>20))stations.push(meters);
  }
  stations.sort((a,b)=>a-b);
 }
 return stations.map(meters=>({...along(path,meters),heading:heading(along(path,meters-3),along(path,meters+3)),radius,halfHeight}));
}

function islandWheel(map:ParkMap,terrain:ParkTerrain,garden:boolean):TrialCourse{
 const road=roadLoop(map,garden?GARDEN_ROADS:PERIMETER_ROADS);
 if(garden)road.reverse();
 const path=subdivide(road,8).map(([x,z])=>({x,y:terrain.height(x,z),z})),gates=circuitGates(path,90,3,1.5,true);
 return{
  id:garden?'onewheel-garden-grand-tour-v1':'onewheel-island-perimeter-v1',vehicle:'onewheel',category:'island',
  name:garden?'Garden Grand Tour':'Island Perimeter Cup',
  description:garden?'A full island circuit in the reverse direction, with an inland return through Inselruhe Avenue, Loiter Way and the gardens. Brake before the marked junctions.':'Ride the complete island driving loop: Sunset Drive, Strand Drive, Lakeside Drive and Riverbank Road. Follow the shoreline roads back to the bridge approach.',
  distance:length(path),targetSeconds:garden?1260:1080,start:{...path[0],heading:heading(path[0],along(path,6))},gates,path,color:garden?'#ffa889':'#ffcb6f',maxSpeed:24,
 };
}

function hull(points:Point[]):Point[]{
 const sorted=[...new Map(points.map(p=>[`${p[0]},${p[1]}`,p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=(input:Point[])=>{const out:Point[]=[];for(const point of input){while(out.length>1&&cross(out.at(-2)!,out.at(-1)!,point)<=0)out.pop();out.push(point);}return out;};
 const lower=half(sorted),upper=half([...sorted].reverse()),result=[...lower.slice(0,-1),...upper.slice(0,-1)];
 if(result.length<3)throw new Error('Island outline is unavailable for Sky Circuit');return result;
}

/**
 * Rounded seaward envelope of the real island outline, including the eastern
 * wetland tip. An offshore course avoids forcing the existing 36 m aircraft
 * ceiling through tall tree crowns. Arc bends remain flyable at cruising speed.
 */
function offshoreLoop(map:ParkMap,padding:number,reverse:boolean):Point[]{
 const outline=hull(map.island),rounded:Point[]=[];
 for(let i=0;i<outline.length;i++){
  const a=outline[(i+outline.length-1)%outline.length],p=outline[i],b=outline[(i+1)%outline.length];
  const from=Math.atan2(-(p[0]-a[0]),p[1]-a[1]),to=Math.atan2(-(b[0]-p[0]),b[1]-p[1]),sweep=((to-from)%TAU+TAU)%TAU;
  const steps=Math.max(1,Math.ceil(sweep/(Math.PI/18)));
  for(let j=0;j<=steps;j++){const angle=from+sweep*j/steps;rounded.push([p[0]+padding*Math.cos(angle),p[1]+padding*Math.sin(angle)]);}
 }
 rounded.push([...rounded[0]]);
 const points=subdivide(rounded,28).slice(0,-1);
 if(reverse)points.reverse();
 // Both flight starts look out along the river near the bridge, with the first
 // checkpoint ahead. They do not spawn the rider in the eastern habitat.
 let first=0,nearest=Infinity;
 for(let i=0;i<points.length;i++){const d=Math.hypot(points[i][0]-map.bridge.b[0],points[i][1]-map.bridge.b[1]);if(d<nearest){nearest=d;first=i;}}
 const path=[...points.slice(first),...points.slice(0,first)];path.push([...path[0]]);return path;
}

function islandSky(map:ParkMap,wide:boolean):TrialCourse{
 const outline=offshoreLoop(map,wide?140:55,wide),flat=outline.map(([x,z])=>({x,y:0,z})),total=length(flat);let meters=0;
 const path=flat.map((p,i)=>{if(i)meters+=distance(flat[i-1],p);return{...p,y:(wide?34:31)+(wide?1.5:1.2)*Math.sin(TAU*(wide?2:1)*meters/total)};});
 path[path.length-1]={...path[0]};
 const gates=circuitGates(path,140,10,4);
 return{
  id:wide?'sky-outer-island-crown-v1':'sky-coastline-circuit-v1',vehicle:'hoverbike',category:'island',
  name:wide?'Outer Island Crown':'Coastline Circuit',
  description:wide?'A wider, higher reverse circuit around the entire island. Follow the river gates through two gentle climbs and descents, then return to the bridge.':'Fly a complete near-shore circuit around Belle Isle, including the eastern wetland tip. Follow the numbered river gates through a gentle altitude change.',
  distance:length(path),targetSeconds:wide?720:660,start:{...path[0],heading:heading(path[0],along(path,12))},gates,path,color:wide?'#a6a0ff':'#62e5d0',maxSpeed:35,
 };
}

export function trialCourses(map:ParkMap,terrain:ParkTerrain):TrialCourse[]{
 const practice=[wheelCup(map,terrain),bridgeSkyline(map),sunsetHalo(map)].map(course=>({...course,category:'practice' as const,description:`Practice sprint. ${course.description}`,targetSeconds:Math.ceil(course.distance/(course.vehicle==='onewheel'?5.5:12)/5)*5}));
 return [islandWheel(map,terrain,false),islandWheel(map,terrain,true),islandSky(map,false),islandSky(map,true),...practice];
}
