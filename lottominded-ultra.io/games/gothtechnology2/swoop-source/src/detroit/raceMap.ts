export type RaceMapPoint={x:number;y:number};
export type RaceMapCourse={id:string;label:string;points:readonly RaceMapPoint[];checkpoints:readonly RaceMapPoint[];next:number;finished?:boolean};

/** Proportional framing leaves screen space for endpoint badges on long city courses. */
export function fitRaceCourse(points:readonly RaceMapPoint[]){
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
 const width=Math.max(...xs)-x,height=Math.max(...ys)-y,extent=Math.max(width,height),side=extent+Math.max(50,extent*.12);
 return {x:x+width/2-side/2,y:y+height/2-side/2,w:side,h:side};
}

function compact(points:readonly RaceMapPoint[]){return points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);}
function project(points:readonly RaceMapPoint[],target:RaceMapPoint){
 let best={index:0,t:0,distance:Infinity,point:points[0]??target};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((target.x-a.x)*dx+(target.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  const point={x:a.x+dx*t,y:a.y+dy*t},distance=Math.hypot(target.x-point.x,target.y-point.y);
  if(distance<best.distance)best={index:i-1,t,distance,point};
 }
 return best;
}
/** Keep the authored lane bends between the actual start and finish gates. */
export function trimCoursePath(points:readonly RaceMapPoint[],start:RaceMapPoint,finish:RaceMapPoint):RaceMapPoint[]{
 if(points.length<2)return [start,finish];
 const a=project(points,start),b=project(points,finish);
 if(a.index+a.t>b.index+b.t)return trimCoursePath([...points].reverse(),start,finish);
 return compact([start,...points.slice(a.index+1,b.index+1),finish]);
}
export function raceMapProgress(course:RaceMapCourse){
 const total=course.checkpoints.length;
 const next=course.finished?total:Math.max(0,Math.min(total,Math.floor(Number.isFinite(course.next)?course.next:0)));
 const target=course.checkpoints[next];
 const checkpoints=course.checkpoints.map((point,index)=>({point,index,number:index+1,finish:index===total-1,state:index<next?'passed':index===next?'next':'upcoming'} as const));
 if(!next)return {next,total,target,checkpoints,passed:[] as RaceMapPoint[],remaining:course.points};
 if(next>=total)return {next,total,target,checkpoints,passed:course.points,remaining:[] as RaceMapPoint[]};
 const at=project(course.points,course.checkpoints[next-1]);
 return {next,total,target,checkpoints,passed:compact([...course.points.slice(0,at.index+1),at.point]),remaining:compact([at.point,...course.points.slice(at.index+1)])};
}
/** Off-screen next gates remain visible as a directional marker on the mini-map edge. */
export function checkpointScreenPoint(point:RaceMapPoint,width:number,height:number,padding=22){
 const center={x:width/2,y:height/2},dx=point.x-center.x,dy=point.y-center.y;
 const ratio=Math.min(1,(width/2-padding)/Math.max(.001,Math.abs(dx)),(height/2-padding)/Math.max(.001,Math.abs(dy)));
 return {x:center.x+dx*ratio,y:center.y+dy*ratio,edge:ratio<1,angle:Math.atan2(dy,dx)};
}
