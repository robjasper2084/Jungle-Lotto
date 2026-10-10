import {CommunityRide,LaneRoute,type RoutePoint} from './communityRide.ts';
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from './terrain.ts';
type Position={x:number;y:number;z:number;headingY:number};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const AMBIENT_CYCLIST_PACE=10.8;
/** Stay on an existing mapped corridor, using opposite sides for the return leg. */
export function cyclistCircuit(points:readonly RoutePoint[],offset=.8):RoutePoint[]{
 if(points.length<3)throw Error('Cyclists need a connected mapped route');
 const side=(i:number,sign:number)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;return {...points[i],x:points[i].x+dz/len*offset*sign,z:points[i].z-dx/len*offset*sign};};
 const out=points.map((_,i)=>side(i,1)),back=points.map((_,i)=>side(points.length-1-i,-1));
 const turn=(end:boolean)=>{const p=points[end?points.length-1:0],a=points[end?points.length-2:0],b=points[end?points.length-1:1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,sign=end?1:-1;
  return Array.from({length:16},(_,i)=>{const angle=(i+1)/16*Math.PI;return {x:p.x+sign*offset*(dz/len*Math.cos(angle)+dx/len*Math.sin(angle)),z:p.z+sign*offset*(-dx/len*Math.cos(angle)+dz/len*Math.sin(angle)),width:p.width};});};
 // Rounded turnarounds keep the heading and lateral rider lanes continuous.
 return [...out,...turn(true).slice(0,-1),...back,...turn(false).slice(0,-1),out[0]];
}
export function packStarts(length:number,seed:number){
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const first=random()*length;return [first,(first+length*(.35+random()*.3))%length];
}
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
/** Fixed-rate cosmetic traffic, separate from authoritative match participants. */
export class AmbientCyclistTraffic {
 readonly rides:CommunityRide[]=[];readonly starts:number[]=[];
 readonly route:LaneRoute;private ground=createGroundSample();private probe=createGroundSample();
 private accumulator=0;private ticks=0;private previous:Position[][]=[];private current:Position[][]=[];
 readonly terrain:TerrainSampler;
 constructor(terrain:TerrainSampler,points:readonly RoutePoint[],seed=randomSeed()){
  this.terrain=terrain;
  this.route=new LaneRoute(points);
  for(let pack=0;pack<2;pack++){
   const ride=new CommunityRide(this.route,terrain,AMBIENT_CYCLIST_PACE,10);ride.stage='riding';ride.joined=false;
   ride.riders.forEach((r,i)=>r.id='ambient-'+pack+'-'+i);this.rides.push(ride);
   this.previous.push(ride.riders.map(r=>({...r})));this.current.push(ride.riders.map(r=>({...r})));
  }
  this.restart(seed);
 }
 private at(station:number,offset=0){return this.route.at(((station%this.route.length)+this.route.length)%this.route.length,offset);}
 restart(seed=randomSeed(),observer?:{x:number;z:number}){
  this.starts.splice(0,2,...packStarts(this.route.length,seed));this.accumulator=0;this.ticks=0;
  // Put the first pack within sight at ride start. Never relocate active traffic.
  if(observer){this.starts[0]=(this.route.nearest(observer).s+55)%this.route.length;this.starts[1]=(this.starts[0]+this.route.length*.5)%this.route.length;}
  // Move the whole formation along its lane if a random start lands on scenery.
  // This keeps the pack together and avoids spawning a rider inside a collider.
  for(let p=0;p<2;p++){
   const randomStart=this.starts[p];
   for(let attempt=0;attempt<160;attempt++){
    const start=randomStart+attempt*.75;
    const safe=this.rides[p].riders.every((_,i)=>{
     const point=this.at(start-i*2.8,i%2?-.65:.65),g=this.terrain.sampleGround(point.x,point.z,this.probe);
     return !g.offCourse&&this.terrain.raycastObstacle({x:point.x,y:g.height+.65,z:point.z},{x:Math.sin(point.headingY),y:0,z:Math.cos(point.headingY)},.2,.32)===null;
    });
    if(safe){this.starts[p]=start%this.route.length;break;}
   }
  }
  this.rides.forEach((ride,p)=>ride.riders.forEach((r,i)=>{
   r.s=this.starts[p]-i*2.8;r.offset=r.targetOffset=i%2?-.65:.65;r.speed=AMBIENT_CYCLIST_PACE;r.blocked=false;r.passUntil=0;
   let at=this.at(r.s,r.offset);let g=this.terrain.sampleGround(at.x,at.z,this.ground);
   if(g.offCourse){r.offset=r.targetOffset=0;at=this.at(r.s);g=this.terrain.sampleGround(at.x,at.z,this.ground);}
   Object.assign(r,at,{y:g.height});Object.assign(this.previous[p][i],r);Object.assign(this.current[p][i],r);
  }));
 }
 update(dt:number,observer:{x:number;z:number},paused=false,contacts:readonly NavigationObstacle[]=[]){
  if(paused)return;
  if(!paused)this.accumulator+=clamp(dt,0,.1);
  while(this.accumulator>=.05){this.accumulator-=.05;this.ticks++;
   const neighbors=[...contacts,...this.obstacles()];
   this.rides.forEach((ride,p)=>ride.riders.forEach((r,i)=>{
    const previous=this.previous[p][i],current=this.current[p][i];Object.assign(previous,current);
    const at=this.at(r.s),ahead=this.at(r.s+8),bend=Math.abs(Math.atan2(Math.sin(ahead.headingY-at.headingY),Math.cos(ahead.headingY-at.headingY)));
    const cohesion=clamp((ride.riders[0].s-r.s-i*2.8)*.45,-.6,.6);
    let wanted=Math.min(AMBIENT_CYCLIST_PACE+cohesion,Math.sqrt(4/Math.max(.035,bend/8)));
    const near=Math.hypot(current.x-observer.x,current.z-observer.z)<150;
    if(near&&this.ticks%2===i%2){
     const clear=(offset:number)=>{
      const probe=this.at(r.s+Math.max(3,r.speed*.7),offset),dx=probe.x-current.x,dz=probe.z-current.z,d=Math.hypot(dx,dz)||1;
      if(this.terrain.sampleGround(probe.x,probe.z,this.probe,current.y).offCourse)return false;
      if(neighbors.some(o=>o.id!==r.id&&Math.abs(o.y-current.y)<2&&Math.hypot(probe.x-o.x-o.vx*.6,probe.z-o.z-o.vz*.6)<o.radius+.7))return false;
      return this.terrain.raycastObstacle({x:current.x,y:current.y+.65,z:current.z},{x:dx/d,y:0,z:dz/d},d,.32)===null;
     };
     if(!clear(r.targetOffset)&&r.s>(r.passUntil??0)){
      const alternate=[-r.targetOffset,0,-1.1,1.1].find(clear);
      if(alternate!==undefined){r.targetOffset=alternate;r.passUntil=r.s+12;}else wanted=Math.min(wanted,2.2);
     }
    }
    r.speed+=clamp(wanted-r.speed,-.3,.12);let offset=r.offset+clamp(r.targetOffset-r.offset,-.06,.06);
    let position=this.at(r.s+r.speed*.05,offset),g=this.terrain.sampleGround(position.x,position.z,this.ground,current.y);
    if(g.offCourse){offset=0;position=this.at(r.s+r.speed*.05);g=this.terrain.sampleGround(position.x,position.z,this.ground,current.y);r.targetOffset=0;}
    const distance=Math.hypot(position.x-current.x,position.z-current.z);
    const hit=near&&distance>.001?this.terrain.raycastObstacle({x:current.x,y:current.y+.65,z:current.z},{x:(position.x-current.x)/distance,y:0,z:(position.z-current.z)/distance},distance,.3):null;
    const crowded=near&&neighbors.some(o=>o.id!==r.id&&Math.abs(o.y-current.y)<2&&Math.hypot(position.x-o.x,position.z-o.z)<o.radius+.55&&Math.hypot(position.x-o.x,position.z-o.z)<Math.hypot(current.x-o.x,current.z-o.z));
    if(!g.offCourse&&(hit===null||hit>=distance)&&!crowded){r.s+=r.speed*.05;r.offset=offset;Object.assign(current,position,{y:g.height});r.blocked=false;r.wheelSpin+=distance/.34;r.pedalPhase+=distance/(.34*2.5);}
    else{
     r.speed=Math.max(0,r.speed-.6);r.blocked=true;r.passUntil=0;
     // A blocked forward sweep used to freeze lateral motion as well. Make a
     // bounded, collision-checked side step, then commit to that passing lane.
     const edge=this.at(r.s).width/2-.55,nearby=neighbors.filter(o=>o.id!==r.id&&!o.raycastSolid&&Math.abs(o.y-current.y)<2);
     const space=(x:number,z:number)=>Math.min(4,...nearby.map(o=>Math.hypot(x-o.x,z-o.z)-o.radius-.55));
     const before=space(current.x,current.z);
     const options=[-1,1].map(sign=>{const offset=clamp(r.offset+sign*.07,-edge,edge);return{...this.at(r.s,offset),offset};}).sort((a,b)=>space(b.x,b.z)-space(a.x,a.z));
     for(const side of options){
      const d=Math.hypot(side.x-current.x,side.z-current.z);if(d<.001||space(side.x,side.z)<before+.0005)continue;
      const ground=this.terrain.sampleGround(side.x,side.z,this.probe,current.y);if(ground.offCourse||Math.abs(ground.height-current.y)>.25)continue;
      const hit=this.terrain.raycastObstacle({x:current.x,y:current.y+.65,z:current.z},{x:(side.x-current.x)/d,y:0,z:(side.z-current.z)/d},d,.3);
      if(hit!==null&&hit<d)continue;
      const direction=Math.sign(side.offset-r.offset);r.offset=side.offset;r.targetOffset=clamp(side.offset+direction*.6,-edge,edge);
      Object.assign(current,side,{y:ground.height});r.thinkIn=0;break;
     }
    }
   }));
  }
  const alpha=paused?1:this.accumulator/.05;
  this.rides.forEach((ride,p)=>ride.riders.forEach((r,i)=>{const a=this.previous[p][i],b=this.current[p][i];r.x=a.x+(b.x-a.x)*alpha;r.y=a.y+(b.y-a.y)*alpha;r.z=a.z+(b.z-a.z)*alpha;r.headingY=a.headingY+Math.atan2(Math.sin(b.headingY-a.headingY),Math.cos(b.headingY-a.headingY))*alpha;}));
 }
 obstacles():NavigationObstacle[]{return this.rides.flatMap(r=>r.obstacles());}
 telemetry(){return this.rides.map(ride=>({count:ride.riders.length,riders:ride.riders.map(r=>({x:r.x,y:r.y,z:r.z,s:r.s,speed:r.speed,blocked:r.blocked}))}));}
}
