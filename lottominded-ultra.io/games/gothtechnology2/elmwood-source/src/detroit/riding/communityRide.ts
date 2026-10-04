// Swoop route adapter: shared event rules with early narrowing and committed passing.
import {createGroundSample,type TerrainSampler,type NavigationObstacle} from '@digital-static/ridecore';
export type RoutePoint={x:number;z:number;width?:number};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export const COMMUNITY_PACE=7.2;
const PACK_LATERAL_SPEED=1.9;
const movingContact=(o:NavigationObstacle)=>['person','pedestrian','rider','cyclist','segway','skater','dog'].includes(o.kind);
export class LaneRoute {
  readonly lengths=[0];readonly length:number;
  readonly loop:boolean;readonly points:readonly RoutePoint[];constructor(points:readonly RoutePoint[],loop=false){this.loop=loop;this.points=points;if(points.length<2)throw Error('A community ride needs a connected lane.');for(let i=1;i<points.length;i++){const d=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);if(d<.001)throw Error('Duplicate route point');this.lengths.push(this.lengths.at(-1)!+d);}this.length=this.lengths.at(-1)!;}
  at(distance:number,offset=0){const s=this.loop?((distance%this.length)+this.length)%this.length:clamp(distance,0,this.length);let i=1;while(i<this.lengths.length-1&&this.lengths[i]<s)i++;const a=this.points[i-1],b=this.points[i],length=this.lengths[i]-this.lengths[i-1],f=(s-this.lengths[i-1])/length,dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,width=Math.min(a.width??3,b.width??3),l=clamp(offset,-width/2+.5,width/2-.5);return {x:a.x+(b.x-a.x)*f+dz*l,z:a.z+(b.z-a.z)*f-dx*l,headingY:Math.atan2(dx,dz),width};}
  nearest(p:{x:number;z:number},reference?:number){let best={distance:Infinity,s:0},score=Infinity;for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],dx=b.x-a.x,dz=b.z-a.z,f=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz),0,1),d=Math.hypot(p.x-a.x-dx*f,p.z-a.z-dz*f),station=this.lengths[i-1]+f*(this.lengths[i]-this.lengths[i-1]),s=this.loop&&reference!==undefined?station+Math.round((reference-station)/this.length)*this.length:station,cost=d+(reference===undefined?0:Math.min(.25,Math.abs(s-reference)*.002));if(cost<score){best={distance:d,s};score=cost;}}return best;}
  section(from:number,to:number){return new LaneRoute([this.at(from),...this.points.filter((_,i)=>this.lengths[i]>from&&this.lengths[i]<to),this.at(to)]);}
}
export type CommunityStage='assembling'|'rollout'|'riding'|'regroup'|'finishing'|'complete'|'cleanup'|'hangout';
export type CommunityDestination={name:string;slots:{x:number;z:number;headingY:number;approach:{x:number;z:number}}[]};
export type PackRider={id:string;s:number;speed:number;x:number;y:number;z:number;headingY:number;wheelSpin:number;pedalPhase:number;offset:number;blocked:boolean;thinkIn:number;targetOffset:number;passUntil?:number;jamTime?:number;ghostUntil?:number;parking?:boolean;parkLeg?:number;parked?:boolean};
/** One bounded pack, shared by spectators and participants. Progress uses mapped arc length. */
export class CommunityRide {
  autoStart=false;
  get continuous(){return this.route.loop&&!this.destination;}
  get laps(){return Math.max(0,Math.floor(Math.min(...this.riders.map(r=>r.s))/this.route.length));}
  stage:CommunityStage='assembling';joined=false;eligible=false;completed=false;timer=0;elapsed=0;nextGate=0;regrouped=false;runId=0;message='Approach the gathering and join the ride.';
  readonly riders:PackRider[]=[];readonly gates:number[]=[];private ground=createGroundSample();private probe=createGroundSample();private previousPlayer?:{x:number;z:number};private participation=0;
  readonly route:LaneRoute;readonly terrain:TerrainSampler;readonly pace:number;readonly destination?:CommunityDestination;constructor(route:LaneRoute,terrain:TerrainSampler,pace=COMMUNITY_PACE,count=4,destination?:CommunityDestination){this.destination=destination;this.route=route;this.terrain=terrain;this.pace=pace;
    for(let i=0;i<Math.min(8,Math.max(2,count));i++)this.riders.push({id:'community-'+i,s:4+(count-i-1)*3.4,speed:0,x:0,y:0,z:0,headingY:0,wheelSpin:0,pedalPhase:i*1.77,offset:.55,blocked:false,thinkIn:0,targetOffset:.55});
    for(let s=3;s<route.length-2;s+=8)this.gates.push(s);this.gates.push(route.length-2);this.restart();
  }
  restart(){this.runId++;this.stage='assembling';this.joined=this.eligible=this.completed=this.regrouped=false;this.timer=0;this.elapsed=0;this.nextGate=0;this.participation=0;this.previousPlayer=undefined;this.message=this.destination?'Gathering · riding to '+this.destination.name+' in 5 seconds. Join nearby.':'Gathering · join nearby, on a bicycle or EUC.';this.riders.forEach((r,i)=>{r.s=4+(this.riders.length-i-1)*2.2;r.speed=0;r.blocked=false;r.offset=r.targetOffset=this.formationOffset(i,r.s);r.thinkIn=0;r.passUntil=0;r.jamTime=r.ghostUntil=0;r.parking=r.parked=false;r.parkLeg=0;this.place(r);});}
  private laneWidth(s:number,speed:number){return Math.min(...[0,5,Math.max(10,speed*2.5)].map(d=>this.route.at(s+d).width));}
  private formationOffset(index:number,s:number){
    if(this.laneWidth(s,this.pace)<3.8||!this.continuous&&s>this.route.length-32)return 0;
    return (index%2?-.9:.9)+Math.sin(s*.035+index*1.7)*.08;
  }
  private pathOffset(r:PackRider,target:number,distance:number){return r.offset+clamp(target-r.offset,-distance/Math.max(2,r.speed)*PACK_LATERAL_SPEED,distance/Math.max(2,r.speed)*PACK_LATERAL_SPEED);}
  private clearLane(r:PackRider,offset:number,contacts:readonly NavigationObstacle[]){
    let previous={x:r.x,y:r.y,z:r.z};
    // Validate the entire passing corridor, including moving actors, before changing lanes.
    const horizon=Math.max(12,r.speed*2.4);
    for(let d=0;d<=horizon;d+=.65){
      const at=this.route.at(r.s+d,this.pathOffset(r,offset,d)),g=this.terrain.sampleGround(at.x,at.z,this.probe,r.y);
      if(g.offCourse||g.surface==='grass'||g.normal.y<.85||Math.abs(g.height-previous.y)>.4)return false;
      const length=Math.hypot(at.x-previous.x,at.z-previous.z);
      if(length>.001){const hit=this.terrain.raycastObstacle({x:previous.x,y:previous.y+.6,z:previous.z},{x:(at.x-previous.x)/length,y:0,z:(at.z-previous.z)/length},length+.35,.45);if(hit!==null&&hit<length+.35)return false;}
      for(const o of contacts){if(o.id===r.id||Math.abs(o.y-r.y)>2)continue;const time=Math.min(2,d/Math.max(2,r.speed)),x=o.x+o.vx*time,z=o.z+o.vz*time,previousGap=Math.hypot(previous.x-x,previous.z-z),gap=Math.hypot(at.x-x,at.z-z);if(gap<o.radius+.65&&(previousGap>=o.radius+.65||gap<previousGap-1e-6))return false;}
      previous={x:at.x,y:g.height,z:at.z};
    }
    return true;
  }
  private place(r:PackRider){const at=this.route.at(r.s,r.offset);Object.assign(r,at);r.y=this.terrain.sampleGround(r.x,r.z,this.ground).height;}
  private yieldSideways(r:PackRider,dt:number,obstacles:readonly NavigationObstacle[]){
    const clearance=(x:number,z:number)=>Math.min(...this.riders.filter(o=>o!==r).map(o=>Math.hypot(x-o.x,z-o.z)));
    const current=clearance(r.x,r.z),edge=this.route.at(r.s).width/2-.55;
    const options=[-1,1].map(sign=>{const offset=clamp(r.offset+sign*PACK_LATERAL_SPEED*dt,-edge,edge),at=this.route.at(r.s,offset);return {...at,offset,space:clearance(at.x,at.z)};}).sort((a,b)=>b.space-a.space);
    for(const at of options){
      if(at.space<=current+.001)continue;
      const g=this.terrain.sampleGround(at.x,at.z,this.ground,r.y),d=Math.hypot(at.x-r.x,at.z-r.z);
      if(g.offCourse||g.surface==='grass'||Math.abs(g.height-r.y)>.3||!d)continue;
      const hit=this.terrain.raycastObstacle({x:r.x,y:r.y+.6,z:r.z},{x:(at.x-r.x)/d,y:0,z:(at.z-r.z)/d},d,.32);
      if(hit!==null&&hit<d||obstacles.some(o=>!o.id.startsWith('community-')&&Math.abs(o.y-r.y)<2&&Math.hypot(at.x-o.x,at.z-o.z)<o.radius+.6&&Math.hypot(at.x-o.x,at.z-o.z)<=Math.hypot(r.x-o.x,r.z-o.z)))continue;
      r.targetOffset=clamp(at.offset+Math.sign(at.offset-r.offset)*.3,-edge,edge);r.offset=at.offset;r.passUntil=r.s+8;this.place(r);return;
    }
  }
  join(p:{x:number;z:number}){if(this.stage==='cleanup'||this.stage==='complete'||this.stage==='hangout')return false;const near=this.route.nearest(p,this.riders[0].s),gap=Math.min(...this.riders.map(r=>Math.hypot(r.x-p.x,r.z-p.z)));if(near.distance>4||gap>22){this.message='Ride to the gathering or catch the pack to join.';return false;}this.joined=true;this.eligible=!this.continuous&&this.stage==='assembling'&&near.s<12;this.previousPlayer={...p};this.message=this.continuous?'Joined the continuous tour · stay with the pack for as many laps as you like.':this.eligible?'Joined · follow every lane marker.':'Rejoined for the ride · completion requires starting at the gathering.';if(this.stage==='assembling'){this.stage='rollout';this.timer=5;}return true;}
  leave(){this.joined=false;this.eligible=false;this.message='Left the ride. The pack continues; catch up to rejoin.';}
  cancel(){this.leave();this.stage='cleanup';this.message='Ride cancelled. Restart from the gathering when ready.';}
  recover(){this.eligible=false;this.message='Recovered · enjoy the ride; restart at the gathering for completion.';}
  continue(){if(this.stage==='rollout')this.timer=0;if(this.stage==='regroup'){this.timer=0;this.stage='riding';}}
  obstacles():NavigationObstacle[]{return this.stage==='cleanup'?[]:this.riders.map(r=>({id:r.id,x:r.x,y:r.y,z:r.z,radius:.55,height:1.8,kind:'cyclist',vx:Math.sin(r.headingY)*r.speed,vz:Math.cos(r.headingY)*r.speed}));}
  private park(r:PackRider,index:number,dt:number,contacts:readonly NavigationObstacle[],player:{x:number;y:number;z:number}){
    if(r.parked)return;const slot=this.destination!.slots[index],target=r.parkLeg?slot:slot.approach;
    const dx=target.x-r.x,dz=target.z-r.z,distance=Math.hypot(dx,dz);
    if(distance<.09){if(!r.parkLeg){r.parkLeg=1;return;}r.speed=0;r.parked=true;r.headingY=slot.headingY;return;}
    const speed=Math.min(1.3,Math.sqrt(distance*1.6));r.speed+=clamp(speed-r.speed,-dt*2,dt);
    const travel=Math.min(distance,r.speed*dt),x=r.x+dx/distance*travel,z=r.z+dz/distance*travel,g=this.terrain.sampleGround(x,z,this.ground,r.y);
    const blocked=[...contacts,{id:'player',...player,radius:.6},...this.riders.filter(o=>o!==r).map(o=>({...o,radius:.55}))].some(o=>Math.abs(o.y-r.y)<2&&Math.hypot(o.x-x,o.z-z)<o.radius+.58);
    const hit=this.terrain.raycastObstacle({x:r.x,y:r.y+.6,z:r.z},{x:dx/distance,y:0,z:dz/distance},travel,.35);
    if(blocked||g.offCourse||g.surface==='grass'||hit!==null&&hit<travel){r.speed=0;r.blocked=true;return;}
    r.blocked=false;r.x=x;r.z=z;r.y=g.height;r.headingY=Math.atan2(dx,dz);r.wheelSpin+=travel/.34;
  }
  step(dt:number,player:{x:number;y:number;z:number;speed:number},contacts:readonly NavigationObstacle[]=[],paused=false){
    if(paused||dt<=0||!Number.isFinite(dt)||this.stage==='cleanup'||this.stage==='complete'||this.stage==='hangout')return;dt=Math.min(dt,.05);this.elapsed+=dt;
    if(this.joined){const near=this.route.nearest(player,this.gates[this.nextGate]??this.route.length),jump=this.previousPlayer?Math.hypot(player.x-this.previousPlayer.x,player.z-this.previousPlayer.z):0;if(jump>Math.max(3,Math.abs(player.speed)*dt+1))this.eligible=false;
      if(this.eligible&&near.distance<2.1&&jump<3){if(player.speed>.25)this.participation+=jump;const gate=this.gates[this.nextGate];if(gate!==undefined&&Math.abs(near.s-gate)<4)this.nextGate++;}
      this.previousPlayer={x:player.x,z:player.z};
    }
    if(this.stage==='assembling'){if(!this.destination&&!this.autoStart||this.elapsed<5)return;this.stage='rollout';this.timer=1.5;this.message=this.destination?'Rolling together · follow the pack to GothTechnology at 2000 Mack.':'Rolling together · explore the grounds with the pack.';}
    if(this.stage==='rollout'){this.timer=Math.max(0,this.timer-dt);if(this.timer>0)return;this.stage='riding';}
    if(this.stage==='regroup'){this.timer=Math.max(0,this.timer-dt);if(this.timer<=0)this.stage='riding';}
    // Look ahead far enough to change lanes at cruising pace, rather than stop
    // at a cone. A snapshot keeps cohesion independent of per-rider update order.
    const active=this.riders.filter(r=>!r.parking&&!r.parked),front=Math.max(...active.map(r=>r.s)),back=Math.min(...active.map(r=>r.s));
    const buckets=new Map<string,NavigationObstacle[]>();for(const o of contacts){const k=Math.floor(o.x/12)+','+Math.floor(o.z/12);const list=buckets.get(k)??[];list.push(o);buckets.set(k,list);}
    for(let i=0;i<this.riders.length;i++){
      const r=this.riders[i];if(r.parked)continue;if(r.parking){this.park(r,i,dt,contacts,player);continue;}
      const at=this.route.at(r.s),turn=this.route.at(r.s+6).headingY-at.headingY,curve=Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))/6;
      const width=this.laneWidth(r.s,r.speed),single=width<3.8||!this.continuous&&r.s>this.route.length-32;
      const formationLag=i*(single?4.1:2.2),catchup=clamp((front-r.s-formationLag)*.32,-.5,1.2),cohesion=r.s>=front-1?clamp((front-back-12)*.15,0,1.1):0;
      let desired=Math.min(this.pace+catchup-cohesion,Math.sqrt(2.2/Math.max(.015,curve)),single?4.3:Infinity);
      if(r.s>=front-1&&front-back>22)desired=Math.min(desired,Math.max(0,(32-(front-back))*.45));
      const finish=this.route.length-1-(this.destination?0:i*3.4),stop=this.continuous?Infinity:finish;
      desired=Math.min(desired,Math.sqrt(Math.max(0,stop-r.s)*4.8));
      const nearby:NavigationObstacle[]=[];const bx=Math.floor(r.x/12),bz=Math.floor(r.z/12);for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)nearby.push(...(buckets.get((bx+x)+','+(bz+z))??[]));
      // Prefer a clear passing lane; recover crowd deadlocks without disabling scenery.
      const dynamicNear=nearby.some(o=>movingContact(o)&&Math.abs(o.y-r.y)<2&&Math.hypot(o.x-r.x,o.z-r.z)<4)||this.riders.some(o=>o!==r&&Math.hypot(o.x-r.x,o.z-r.z)<4);
      r.jamTime=r.speed<.7&&dynamicNear?(r.jamTime??0)+dt:0;
      if(r.jamTime>1.5){r.ghostUntil=this.elapsed+3;r.jamTime=0;}
      const crowdPass=this.elapsed<(r.ghostUntil??0),obstacles=crowdPass?nearby.filter(o=>!movingContact(o)):nearby;
      // Stagger across wide pavement. Commit to an open passing corridor;
      // return to formation after the obstruction is behind the whole bicycle.
      r.thinkIn-=dt;
      if(r.thinkIn<=0){r.thinkIn=.12;
        const preferred=this.formationOffset(i,r.s),edge=Math.max(0,width/2-.65);
        if(single)r.targetOffset=0;
        if(!this.clearLane(r,r.targetOffset,obstacles)){
          const alternatives=[preferred,-preferred,-edge,edge,0].map(n=>clamp(n,-edge,edge));
          alternatives.sort((a,b)=>Math.abs(a-r.offset)-Math.abs(b-r.offset));
          const alternative=alternatives.find(offset=>this.clearLane(r,offset,obstacles));
          if(alternative!==undefined){r.targetOffset=alternative;r.passUntil=r.s+Math.max(12,r.speed*2.4);}
        }else if(r.s>=(r.passUntil??0)&&this.clearLane(r,preferred,obstacles))r.targetOffset=preferred;
      }
      // Do not merge sideways while recovering an overlap. The leading rider
      // first rolls straight out, creating room for the riders behind to follow.
      const crowded=this.riders.some(o=>o!==r&&Math.hypot(r.x-o.x,r.z-o.z)<1.25);
      const nextOffset=crowded?r.offset:r.offset+clamp(r.targetOffset-r.offset,-dt*PACK_LATERAL_SPEED,dt*PACK_LATERAL_SPEED);

      for(const o of obstacles){
        if(o.id.startsWith('community-')||Math.abs(o.y-r.y)>2)continue;
        const near=this.route.nearest(o,r.s),along=near.s-r.s;if(along<-.3||along>Math.max(14,r.speed*2.4))continue;
        const future=this.route.at(r.s+Math.max(0,along),this.pathOffset(r,r.targetOffset,Math.max(0,along))),time=Math.min(2,Math.max(0,along)/Math.max(2,r.speed));
        const gap=Math.hypot(r.x-o.x,r.z-o.z),futureGap=Math.hypot(future.x-o.x-o.vx*time,future.z-o.z-o.vz*time);
        if(gap<o.radius+.68&&futureGap>=gap)continue;
        if(futureGap<o.radius+.68)desired=Math.min(desired,Math.sqrt(Math.max(0,along-o.radius-1)*5.6));
      }
      // A rider in the other lane can stay alongside. Brake only for a bicycle
      // ahead whose current or merging lane actually conflicts with our path.
      for(const other of crowdPass?[]:active){if(other===r)continue;const gap=other.s-r.s;
        if(gap<=0||gap>12)continue;
        const ownLane=this.pathOffset(r,r.targetOffset,gap),theirLane=this.pathOffset(other,other.targetOffset,gap);
        if(Math.min(Math.abs(ownLane-other.offset),Math.abs(ownLane-theirLane))<1.3){
          const headway=2.3+r.speed*.2;desired=Math.min(desired,Math.max(0,other.speed+(gap-headway)*1.5));
        }
      }
      const acceleration=desired>r.speed?2.3:4.2;r.speed+=clamp(desired-r.speed,-acceleration*dt,acceleration*dt);
      const candidate=this.route.at(Math.min(stop,r.s+r.speed*dt),nextOffset),d=Math.hypot(candidate.x-r.x,candidate.z-r.z),g=this.terrain.sampleGround(candidate.x,candidate.z,this.ground,r.y);
      const hit=d>.0001?this.terrain.raycastObstacle({x:r.x,y:r.y+.6,z:r.z},{x:(candidate.x-r.x)/d,y:0,z:(candidate.z-r.z)/d},d,.32):null;
      const blocks=(o:{x:number;y:number;z:number},radius:number)=>Math.abs(o.y-r.y)<2&&Math.hypot(candidate.x-o.x,candidate.z-o.z)<radius&&Math.hypot(candidate.x-o.x,candidate.z-o.z)<=Math.hypot(r.x-o.x,r.z-o.z)+1e-7;
      const packBlocked=!crowdPass&&this.riders.some(o=>o!==r&&blocks(o,1.25));
      r.blocked=g.offCourse||g.surface==='grass'||(hit!==null&&hit<d)||packBlocked||obstacles.some(o=>!o.id.startsWith('community-')&&blocks(o,o.radius+.6));
      if(r.blocked){r.speed=0;r.thinkIn=0;if(packBlocked)this.yieldSideways(r,dt,obstacles);}else{const heading=d>.001?Math.atan2(candidate.x-r.x,candidate.z-r.z):r.headingY;r.offset=nextOffset;r.s=Math.min(stop,r.s+r.speed*dt);this.place(r);r.headingY=heading;r.wheelSpin+=d/.34;if(r.speed>.15)r.pedalPhase+=r.speed*dt/(.34*2.5);}
      if(this.destination&&r.s>=finish-.1){r.parking=true;r.speed=0;this.message='Arriving at GothTechnology · parking in the lot.';}
      if(!this.destination&&!this.continuous&&r.s>=finish-.1){r.parked=true;r.speed=0;}
    }
    if(!this.continuous&&this.stage==='riding'&&this.riders[0].s>this.route.length-10){this.stage='finishing';this.message='Final stretch — finish beside the pack.';}
    if(this.continuous){const station=this.riders[0].s%this.route.length;this.nextGate=this.gates.findIndex(g=>g>station);if(this.nextGate<0)this.nextGate=0;this.message='Continuous tour · lap '+(this.laps+1)+'. Catch the pack and join anytime.';}
    if(this.destination&&this.riders.every(r=>r.parked)){this.stage='hangout';this.completed=this.joined&&this.eligible&&this.nextGate===this.gates.length&&this.participation>this.route.length*.8;this.message='Parked at '+this.destination.name+' · the group is hanging out in the lot. Stay, explore the store, or restart the gathering.';return;}
    if(!this.destination&&!this.continuous&&this.stage==='finishing'&&this.riders.at(-1)!.s>=this.route.length-2-(this.riders.length-1)*3.4){
      const near=this.route.nearest(player,this.route.length);if(!this.joined||near.s>=this.route.length-5&&near.distance<3){this.stage='complete';this.completed=this.joined&&this.eligible&&this.nextGate===this.gates.length&&this.participation>this.route.length*.8;this.riders.forEach(r=>r.speed=0);this.message=this.completed?'Community ride complete · every lane marker passed.':'Pack finished · restart at the gathering for a complete ride.';}
    }
  }
}

