import {createGroundSample} from './terrain.ts';
import type {TerrainSampler} from './terrain.ts';
import type {RidePose} from './controller.ts';
import {gaitCadence} from './dogGait.ts';
import {companionRoute} from './companionNavigation.ts';
import type {DogJump} from './companionNavigation.ts';

export type DogPose={x:number;y:number;z:number;heading:number;pitch:number;roll:number;speed:number;phase:number;time:number;turnRate:number;jumpHeight?:number;jumpProgress?:number;landing?:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
// Conservative game tuning, not a measured breed speed claim. No catch-up teleport.
export const DOG_MAX_SPEED=7.5;
const state=():DogPose=>({x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed:0,phase:0,time:0,turnRate:0,jumpHeight:0,jumpProgress:0,landing:0});

/** Friendly companion has its own ground path; it never inherits the EUC's jumps or tilt. */
export class DogFollower {
  current=state();previous=state();terrain:TerrainSampler;
  private ground=createGroundSample();private vx=0;private vz=0;private heroX=0;private heroZ=0;
  private flight?:DogJump;private passingSide=0;private passingId='';jumps=0;
  constructor(terrain:TerrainSampler){this.terrain=terrain;}
  target(hero:RidePose){
    return {x:hero.x+Math.cos(hero.headingY)*1.3-Math.sin(hero.headingY)*.25,
      z:hero.z-Math.sin(hero.headingY)*1.3-Math.cos(hero.headingY)*.25};
  }
  private groundPose(){
    const p=this.current,g=this.terrain.sampleGround(p.x,p.z,this.ground,p.y),s=Math.sin(p.heading),c=Math.cos(p.heading);
    p.y=g.height+.015;
    p.pitch=Math.atan2(g.normal.x*s+g.normal.z*c,g.normal.y);
    p.roll=-Math.atan2(g.normal.x*c-g.normal.z*s,g.normal.y);
  }
  reset(hero:RidePose){
    this.flight=undefined;this.passingSide=0;this.passingId='';this.jumps=0;
    Object.assign(this.current,state(),this.target(hero),{heading:hero.headingY,y:hero.y});
    this.heroX=hero.x;this.heroZ=hero.z;this.vx=this.vz=0;this.groundPose();Object.assign(this.previous,this.current);
  }
  step(dt:number,hero:RidePose){
    if(!(dt>0))return;
    if(Math.hypot(hero.x-this.heroX,hero.z-this.heroZ)>8){this.reset(hero);return;}
    const p=this.current;Object.assign(this.previous,p);
    const target=this.target(hero),ex=target.x-p.x,ez=target.z-p.z;
    // Actual hero translation also handles reverse riding and controlled recovery.
    const hx=(hero.x-this.heroX)/dt,hz=(hero.z-this.heroZ)/dt;
    this.heroX=hero.x;this.heroZ=hero.z;
    p.landing=(p.landing??0)*Math.exp(-12*dt);
    if(this.flight){this.fly(dt);return;}
    let vx=hx+ex*5,vz=hz+ez*5;
    const cap=DOG_MAX_SPEED,wanted=Math.hypot(vx,vz);
    if(wanted>cap){vx*=cap/wanted;vz*=cap/wanted;}
    const obstacles=this.terrain.navigationObstacles?.(p.x,p.z,Math.max(5,cap*1.5))??[];
    const route=companionRoute(p.x,p.y,p.z,this.vx,this.vz,obstacles,this.passingSide);
    if(route?.jump){
      const jump=route.jump,endX=p.x+jump.vx*jump.duration,endZ=p.z+jump.vz*jump.duration;
      const landing=this.terrain.sampleGround(endX,endZ,this.ground,p.y);
      const peak=jump.launchSpeed*jump.launchSpeed/(2*9.81);
      const clear=this.terrain.raycastObstacle({x:p.x,y:p.y+peak+.5,z:p.z},{x:jump.vx,y:0,z:jump.vz},Math.hypot(jump.vx,jump.vz)*jump.duration,.3)===null;
      if(!landing.offCourse&&Math.abs(landing.height+.015-p.y)<.25&&clear){this.flight=jump;this.jumps++;this.fly(dt);return;}
    }else if(route?.waypoint){
      if(this.passingId!==route.id){this.passingId=route.id;this.passingSide=route.side;}
      const wx=route.waypoint.x-p.x,wz=route.waypoint.z-p.z,n=Math.hypot(wx,wz),pace=Math.min(cap,Math.max(2,Math.hypot(hx,hz)));
      vx=wx/Math.max(.1,n)*pace;vz=wz/Math.max(.1,n)*pace;
    }else {this.passingSide=0;this.passingId='';}
    const smooth=1-Math.exp(-5*dt),ax=(vx-this.vx)*smooth,az=(vz-this.vz)*smooth;
    const acceleration=Math.hypot(ax,az),limit=8*dt;
    const factor=acceleration>limit?limit/acceleration:1;
    this.vx+=ax*factor;this.vz+=az*factor;
    // Turn the body toward its travel direction before translating, instead of sideways skating.
    const desiredHeading=Math.atan2(this.vx,this.vz),pace=Math.hypot(this.vx,this.vz);
    if(pace>.08){p.heading+=clamp(angle(desiredHeading-p.heading),-4.5*dt,4.5*dt);const alignment=Math.max(0,Math.cos(angle(desiredHeading-p.heading)));this.vx=Math.sin(p.heading)*pace*alignment;this.vz=Math.cos(p.heading)*pace*alignment;}
    if(Math.hypot(ex,ez)<.015&&Math.hypot(hx,hz)<.05){this.vx=this.vz=0;}
    let dx=this.vx*dt,dz=this.vz*dt,length=Math.hypot(dx,dz);
    if(length>.00001){
      const nx=dx/length,nz=dz/length,origin={x:p.x,y:p.y+.4,z:p.z};
      const blocked=(ax:number,az:number)=>this.terrain.raycastObstacle(origin,{x:ax,y:0,z:az},length+.65,.22,{x:az,y:0,z:-ax})!==null;
      if(blocked(nx,nz)){
        // Short detour around shared-path traffic, with a stop if both shoulders are blocked.
        const candidates=[{x:nz,z:-nx},{x:-nz,z:nx}].sort((a,b)=>(b.x*ex+b.z*ez)-(a.x*ex+a.z*ez));
        const clear=candidates.find(d=>!blocked(d.x,d.z));
        if(clear){dx=clear.x*length*.6;dz=clear.z*length*.6;}else{dx=dz=0;}
      }
    }
    const wheelGap=Math.hypot(p.x+dx-hero.x,p.z+dz-hero.z);
    if(wheelGap<.8){
      // Yield to the wheel during a sharp carve rather than cross through the rider.
      const awayX=p.x+dx-hero.x,awayZ=p.z+dz-hero.z;
      dx=hero.x+awayX/Math.max(wheelGap,.001)*.8-p.x;
      dz=hero.z+awayZ/Math.max(wheelGap,.001)*.8-p.z;
    }
    // Final footprint guard catches a moving pedestrian entering a planned detour.
    if(obstacles.some(o=>Math.hypot(p.x+dx-o.x,p.z+dz-o.z)<o.radius+.32&&Math.abs(o.y-p.y)<1.3)){dx=dz=0;this.vx=this.vz=0;}
    p.x+=dx;p.z+=dz;p.speed=Math.hypot(dx,dz)/dt;
    if(p.speed>.08){const heading=Math.atan2(dx,dz);p.heading+=clamp(angle(heading-p.heading),-4.5*dt,4.5*dt);}
    else if(Math.abs(hero.speed)<.1&&Math.hypot(ex,ez)<.1)p.heading+=angle(hero.headingY-p.heading)*(1-Math.exp(-3*dt));
    p.turnRate+=(angle(p.heading-this.previous.heading)/dt-p.turnRate)*(1-Math.exp(-6*dt));
    p.phase+=gaitCadence(p.speed)*dt;p.time+=dt;
    this.groundPose();
  }
  private fly(dt:number){
    const f=this.flight!,p=this.current;f.elapsed+=dt;
    p.x+=f.vx*dt;p.z+=f.vz*dt;p.speed=Math.hypot(f.vx,f.vz);p.heading=Math.atan2(f.vx,f.vz);
    const floor=this.terrain.sampleGround(p.x,p.z,this.ground,p.y).height+.015;
    p.y=f.base+f.launchSpeed*f.elapsed-4.905*f.elapsed*f.elapsed;p.jumpHeight=Math.max(0,p.y-floor);
    p.jumpProgress=clamp(f.elapsed/f.duration,0,1);p.pitch=-.16*Math.cos(p.jumpProgress*Math.PI);p.roll=0;
    p.time+=dt;p.phase=.70;
    if(f.elapsed>f.duration*.5&&p.y<=floor){p.y=floor;p.jumpHeight=0;p.jumpProgress=0;p.landing=1;this.vx=f.vx;this.vz=f.vz;this.flight=undefined;this.groundPose();}
  }
  sample(alpha:number,out:DogPose){
    alpha=clamp(alpha,0,1);
    for(const key of Object.keys(out) as (keyof DogPose)[])out[key]=(this.previous[key]??0)+((this.current[key]??0)-(this.previous[key]??0))*alpha;
    out.heading=this.previous.heading+angle(this.current.heading-this.previous.heading)*alpha;
    return out;
  }
}
