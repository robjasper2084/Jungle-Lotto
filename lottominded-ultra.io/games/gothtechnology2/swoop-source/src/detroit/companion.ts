import {createGroundSample} from './terrain.ts';
import type {TerrainSampler,NavigationObstacle} from './terrain.ts';
import type {RidePose} from './controller.ts';
import {gaitCadence} from './dogGait.ts';
import {dogSteering,dogStepSpeed} from './dogSteering.ts';
import {companionRoute} from './companionNavigation.ts';
import type {DogJump} from './companionNavigation.ts';

export type DogPose={sit?:number;lie?:number;barking?:number;x:number;y:number;z:number;heading:number;pitch:number;roll:number;speed:number;phase:number;time:number;turnRate:number;gaitSpeed?:number;lookYaw?:number;jumpHeight?:number;jumpProgress?:number;landing?:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const angle=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
// Game sprint tuning, not a measured breed speed claim. Catch-up stays continuous.
export const DOG_MAX_SPEED=12.5;
const state=():DogPose=>({x:0,y:0,z:0,heading:0,pitch:0,roll:0,speed:0,phase:0,time:0,turnRate:0,gaitSpeed:0,lookYaw:0,jumpHeight:0,jumpProgress:0,landing:0});

/** Friendly companion has its own ground path; it never inherits the EUC's jumps or tilt. */
export class DogFollower {
  current=state();previous=state();terrain:TerrainSampler;
  private ground=createGroundSample();private vx=0;private vz=0;private heroX=0;private heroZ=0;
  private blockedFor=0;private escapeHeading?:number;private escapeTime=0;
  private flight?:DogJump;private passingSide=0;private passingId='';jumps=0;
  command='come';sit=0;lie=0;barking=0;private chaseGoal?:{x:number;z:number};private chaseSeconds=0;
  private heldPose='stand';
  order(command:string,targets:readonly {x:number;z:number}[]=[]){
    if(['lay','lie','lay down','lie down'].includes(command.toLowerCase()))command='down';
    if(!['sit','down','stay','come','chase','bark'].includes(command))return 'Unknown dog command';
    if(command==='bark'){this.barking=1.3;return 'Barking on command';}
    if(command!=='stay')this.heldPose=command==='sit'?'sit':command==='down'?'down':'stand';
    this.command=command;this.chaseSeconds=0;
    if(command==='chase'){this.chaseGoal=targets.filter(t=>Math.hypot(t.x-this.current.x,t.z-this.current.z)<35).sort((a,b)=>Math.hypot(a.x-this.current.x,a.z-this.current.z)-Math.hypot(b.x-this.current.x,b.z-this.current.z))[0];if(!this.chaseGoal){this.command='come';return 'No nearby target';}}
    return command==='come'?'Coming back':command==='down'?'Lying down':command==='sit'?'Sitting':command==='stay'?'Staying':'Chasing';
  }
  mode:'follow'|'wait'|'regroup'='follow';private wasDown=false;private waiting?:{x:number;z:number};
  constructor(terrain:TerrainSampler){this.terrain=terrain;}
  updateTargets(targets:readonly {x:number;z:number}[]){if(this.command==='chase'&&this.chaseGoal){const old=this.chaseGoal;const next=targets.filter(t=>Math.hypot(t.x-old.x,t.z-old.z)<8).sort((a,b)=>Math.hypot(a.x-old.x,a.z-old.z)-Math.hypot(b.x-old.x,b.z-old.z))[0];if(next)this.chaseGoal=next;else this.command='come';}}
  target(hero:RidePose){
    if(this.command==='chase'&&this.chaseGoal)return this.chaseGoal;
    const s=Math.sin(hero.headingY),c=Math.cos(hero.headingY),ground=this.terrain.sampleGround(hero.x,hero.z,createGroundSample(),hero.y);
    // On narrow waterfront walks the outside shoulder can be water. Choose a
    // supported side, then fall in behind, instead of targeting the basin floor.
    const candidates=[{x:hero.x+c*1.3-s*.25,z:hero.z-s*1.3-c*.25},{x:hero.x-c*1.3-s*.25,z:hero.z+s*1.3-c*.25},{x:hero.x-s*1.15,z:hero.z-c*1.15}];
    return candidates.find(q=>{const g=this.terrain.sampleGround(q.x,q.z,createGroundSample(),ground.height);return !g.offCourse&&Math.abs(g.height-ground.height)<.22&&g.normal.y>.8;})??candidates[2];
  }
  private groundPose(){
    const p=this.current,g=this.terrain.sampleGround(p.x,p.z,this.ground,p.y),s=Math.sin(p.heading),c=Math.cos(p.heading);
    p.y=g.height+.015;
    p.pitch=Math.atan2(g.normal.x*s+g.normal.z*c,g.normal.y);
    p.roll=-Math.atan2(g.normal.x*c-g.normal.z*s,g.normal.y);
  }
  reset(hero:RidePose){
    this.command='come';this.heldPose='stand';this.sit=this.lie=this.barking=0;this.chaseGoal=undefined;this.mode='follow';this.wasDown=false;this.waiting=undefined;
    this.blockedFor=0;this.escapeHeading=undefined;this.escapeTime=0;
    this.flight=undefined;this.passingSide=0;this.passingId='';this.jumps=0;
    Object.assign(this.current,state(),this.target(hero),{heading:hero.headingY,y:hero.y});
    this.heroX=hero.x;this.heroZ=hero.z;this.vx=this.vz=0;this.groundPose();Object.assign(this.previous,this.current);
  }
  step(dt:number,hero:RidePose){
    if(!(dt>0))return;
    const p=this.current;Object.assign(this.previous,p);
    this.barking=Math.max(0,this.barking-dt);p.barking=this.barking;
    this.sit+=((!this.flight&&this.heldPose==='sit'?1:0)-this.sit)*(1-Math.exp(-dt*5));this.lie+=((!this.flight&&this.heldPose==='down'?1:0)-this.lie)*(1-Math.exp(-dt*5));p.sit=this.sit;p.lie=this.lie;
    if(!this.flight&&['sit','down','stay'].includes(this.command)){p.speed=p.gaitSpeed=0;p.time+=dt;this.vx=this.vz=0;this.heroX=hero.x;this.heroZ=hero.z;this.groundPose();return;}
    if(this.command==='chase'&&(this.chaseSeconds+=dt)>12){this.command='come';this.chaseGoal=undefined;}

    const down=hero.crashMotion>0||hero.crashBlend>0,teleported=Math.hypot(hero.x-this.heroX,hero.z-this.heroZ)>8;
    if(down&&!this.wasDown){this.waiting=undefined;this.mode='wait';}
    if(!down&&(this.wasDown||teleported))this.mode='regroup';this.wasDown=down;
    const s=Math.sin(hero.headingY),c=Math.cos(hero.headingY);
    const body={x:hero.x+hero.crashLateral*c+hero.crashForward*s,z:hero.z-hero.crashLateral*s+hero.crashForward*c};
    const virtual:NavigationObstacle[]=[{id:'hero-wheel',x:hero.x+hero.wheelCrashLateral*c+hero.wheelCrashForward*s,y:hero.y,z:hero.z-hero.wheelCrashLateral*s+hero.wheelCrashForward*c,radius:.55,height:2,kind:'rider',vx:0,vz:0}];
    if(down)virtual.push({id:'fallen-rider',...body,y:hero.y,radius:1.15,height:1.2,kind:'rider',vx:0,vz:0});
    if(down&&!this.waiting){
      // Wait behind the fall's forward sweep. Verify ground and traffic before choosing it.
      const candidates=[{x:p.x,z:p.z},...[1,-1].map(side=>({x:hero.x+c*2.4*side-s*1.8,z:hero.z-s*2.4*side-c*1.8}))];
      this.waiting=candidates.find(q=>{
        const g=this.terrain.sampleGround(q.x,q.z,createGroundSample(),p.y);
        return !g.offCourse&&g.normal.y>.88&&Math.abs(g.height-p.y)<.6&&!virtual.some(o=>Math.hypot(q.x-o.x,q.z-o.z)<o.radius+.65)&&!(this.terrain.navigationObstacles?.(q.x,q.z,2)??[]).some(o=>Math.abs(o.y-p.y)<1.3&&Math.hypot(q.x-o.x,q.z-o.z)<o.radius+.6);
      });
    }
    if(this.waiting&&virtual.some(o=>Math.hypot(this.waiting!.x-o.x,this.waiting!.z-o.z)<o.radius+.5))this.waiting=undefined;
    const target=down?(this.waiting??{x:p.x,z:p.z}):this.target(hero),ex=target.x-p.x,ez=target.z-p.z;
    // Actual hero translation also handles reverse riding and controlled recovery.
    const hx=down||teleported||this.command==='chase'?0:(hero.x-this.heroX)/dt,hz=down||teleported||this.command==='chase'?0:(hero.z-this.heroZ)/dt;
    this.heroX=hero.x;this.heroZ=hero.z;
    p.landing=(p.landing??0)*Math.exp(-12*dt);
    if(this.flight){this.fly(dt);return;}
    let vx=hx+ex*6,vz=hz+ez*6;
    // Start braking before the formation point, leaving sprint pace available
    // for a moving rider while avoiding a fast overshoot on recall.
    const approachCap=Math.hypot(hx,hz)+Math.sqrt(11*Math.max(0,Math.hypot(ex,ez)-.08));
    const cap=Math.min(DOG_MAX_SPEED,approachCap),wanted=Math.hypot(vx,vz);
    if(wanted>cap){vx*=cap/wanted;vz*=cap/wanted;}
    const obstacles=[...(this.terrain.navigationObstacles?.(p.x,p.z,Math.max(5,cap*1.5))??[]).filter(o=>o.id!=='companion'),...virtual];
    const stopped=Math.hypot(this.vx,this.vz)<.1;
    const route=companionRoute(p.x,p.y,p.z,stopped?vx:this.vx,stopped?vz:this.vz,obstacles.filter(o=>o.id!=='hero-wheel'||this.mode!=='follow'),this.passingSide);
    if(route?.jump){
      const jump=route.jump,endX=p.x+jump.vx*jump.duration,endZ=p.z+jump.vz*jump.duration;
      const landing=this.terrain.sampleGround(endX,endZ,this.ground,p.y);
      const peak=jump.launchSpeed*jump.launchSpeed/(2*9.81);
      const clear=this.terrain.raycastObstacle({x:p.x,y:p.y+peak+.5,z:p.z},{x:jump.vx,y:0,z:jump.vz},Math.hypot(jump.vx,jump.vz)*jump.duration,.3)===null;
      if(p.speed>=2.5&&!landing.offCourse&&Math.abs(landing.height+.015-p.y)<.25&&clear){this.flight=jump;this.jumps++;this.fly(dt);return;}
    }else if(route?.waypoint){
      if(this.passingId!==route.id){this.passingId=route.id;this.passingSide=route.side;}
      // A detour needs spare pace to regain lost ground, not just match the rider.
      const catchup=Math.min(4.8,Math.hypot(ex,ez)*1.2);
      const wx=route.waypoint.x-p.x,wz=route.waypoint.z-p.z,n=Math.hypot(wx,wz),pace=Math.min(cap,Math.max(2,Math.hypot(hx,hz)+catchup));
      vx=wx/Math.max(.1,n)*pace;vz=wz/Math.max(.1,n)*pace;
    }else {this.passingSide=0;this.passingId='';}
    const gap=Math.hypot(ex,ez),heroPace=Math.hypot(hx,hz);
    let desiredHeading=Math.hypot(vx,vz)>.015?Math.atan2(vx,vz):p.heading;
    let pace=Math.hypot(vx,vz);
    // The approach brake stops within 8 cm. Align inside that same stopping
    // envelope, otherwise the dog can stop just outside a smaller turn gate.
    if(gap<.1&&heroPace<.05){pace=0;desiredHeading=down?p.heading:hero.headingY;}
    const origin={x:p.x,y:p.y+.4,z:p.z};
    const blocked=(heading:number,distance:number)=>this.terrain.raycastObstacle(origin,{x:Math.sin(heading),y:0,z:Math.cos(heading)},distance,.22,{x:Math.cos(heading),y:0,z:-Math.sin(heading)})!==null;
    // Unknown geometry gets an early steering request, never a sideways translation.
    if(!route?.approachJump&&blocked(desiredHeading,Math.max(.7,p.speed*.45))){
      const side=this.passingSide||((angle(desiredHeading-p.heading)>=0)?1:-1);
      const clear=[side,-side].map(d=>p.heading+d*1.05).find(h=>!blocked(h,1.1));
      if(clear!==undefined){desiredHeading=clear;pace=Math.min(pace,2.1);}
      else pace=0;
    }
    // Commit to going along a fence instead of re-aiming through it every frame.
    // Replan after a short stall, including a turnaround when a gate corners us.
    const goalHeading=Math.atan2(ex,ez),goalBlocked=blocked(goalHeading,Math.min(10,Math.max(.8,gap)));
    if(this.blockedFor>.3&&goalBlocked&&gap>.7&&this.escapeHeading===undefined){
      const side=this.passingSide||1;
      const options=[side*Math.PI/2,-side*Math.PI/2,side*2.35,-side*2.35,Math.PI];
      const clear=options.map(a=>goalHeading+a).find(h=>!blocked(h,1.5));
      if(clear!==undefined){this.escapeHeading=clear;this.escapeTime=0;this.mode='regroup';}
    }
    if(this.escapeHeading!==undefined){
      this.escapeTime+=dt;
      if((!goalBlocked&&this.escapeTime>1)||gap<.5){this.escapeHeading=undefined;this.blockedFor=0;}
      else {
        if(blocked(this.escapeHeading,1.0)&&this.escapeTime>.5){
          const next=[.65,-.65,Math.PI/2,-Math.PI/2,Math.PI].map(a=>this.escapeHeading!+a).find(h=>!blocked(h,1.2));
          if(next!==undefined)this.escapeHeading=next;
        }
        desiredHeading=this.escapeHeading;pace=Math.min(3,Math.max(1.8,gap));
      }
    }
    const steering=dogSteering(p.heading,p.speed,p.turnRate,desiredHeading,pace,dt);
    p.heading=steering.heading;p.turnRate=steering.turnRate;
    p.lookYaw=(p.lookYaw??0)+(steering.lookYaw-(p.lookYaw??0))*(1-Math.exp(-8*dt));
    this.vx=Math.sin(p.heading)*steering.speed;this.vz=Math.cos(p.heading)*steering.speed;
    if((gap<.015||steering.speed<.015)&&heroPace<.05){this.vx=this.vz=0;}
    let dx=this.vx*dt,dz=this.vz*dt;
    if(blocked(p.heading,Math.hypot(dx,dz)+.65)){dx=dz=0;this.vx=this.vz=0;}
    const wheelGap=Math.hypot(p.x+dx-hero.x,p.z+dz-hero.z);
    if(wheelGap<.8&&wheelGap<Math.hypot(p.x-hero.x,p.z-hero.z)){
      // Yield to the wheel during a sharp carve rather than cross through the rider.
      dx=dz=0;this.vx=this.vz=0;
    }
    // Final footprint guard catches a moving pedestrian entering a planned detour.
    if(obstacles.some(o=>Math.hypot(p.x+dx-o.x,p.z+dz-o.z)<o.radius+.32&&Math.hypot(p.x+dx-o.x,p.z+dz-o.z)<Math.hypot(p.x-o.x,p.z-o.z)&&Math.abs(o.y-p.y)<1.3)){dx=dz=0;this.vx=this.vz=0;}
    const nextGround=this.terrain.sampleGround(p.x+dx,p.z+dz,createGroundSample(),p.y);
    if(nextGround.offCourse||Math.abs(nextGround.height-p.y)>.22||this.terrain.waterAt?.(p.x+dx,p.z+dz,p.y)){dx=dz=0;this.vx=this.vz=0;}
    this.blockedFor=gap>.7&&goalBlocked?this.blockedFor+dt:0;
    p.x+=dx;p.z+=dz;p.speed=Math.hypot(dx,dz)/dt;
    p.gaitSpeed=dogStepSpeed(p.speed,p.turnRate);
    p.phase+=gaitCadence(p.gaitSpeed)*dt;p.time+=dt;
    this.groundPose();
    if(!down&&Math.hypot(ex,ez)<.35)this.mode='follow';
  }
  private fly(dt:number){
    const f=this.flight!,p=this.current;f.elapsed+=dt;
    p.x+=f.vx*dt;p.z+=f.vz*dt;p.speed=Math.hypot(f.vx,f.vz);p.heading=Math.atan2(f.vx,f.vz);
    const floor=this.terrain.sampleGround(p.x,p.z,this.ground,p.y).height+.015;
    p.y=f.base+f.launchSpeed*f.elapsed-4.905*f.elapsed*f.elapsed;p.jumpHeight=Math.max(0,p.y-floor);
    p.jumpProgress=clamp(f.elapsed/f.duration,0,1);p.pitch=-.16*Math.cos(p.jumpProgress*Math.PI);p.roll=0;
    p.turnRate*=Math.exp(-8*dt);p.lookYaw=(p.lookYaw??0)*Math.exp(-8*dt);p.gaitSpeed=p.speed;
    p.time+=dt;p.phase=.70;
    if(f.elapsed>f.duration*.5&&p.y<=floor){p.y=floor;p.jumpHeight=0;p.jumpProgress=0;p.landing=1;this.vx=f.vx;this.vz=f.vz;this.flight=undefined;this.groundPose();}
  }
  sample(alpha:number,out:DogPose){
    alpha=clamp(alpha,0,1);
    for(const key of Object.keys(this.current) as (keyof DogPose)[])out[key]=(this.previous[key]??0)+((this.current[key]??0)-(this.previous[key]??0))*alpha;
    out.heading=this.previous.heading+angle(this.current.heading-this.previous.heading)*alpha;
    return out;
  }
}
