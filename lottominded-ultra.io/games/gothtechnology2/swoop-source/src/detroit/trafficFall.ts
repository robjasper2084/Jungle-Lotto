import {createPose,type RidePose} from './controller.ts';
import {FallMotion,getUpPose} from './fallMotion.ts';
import {createGroundSample,type ActorImpact,type TerrainSampler} from './terrain.ts';

/** A bounded knockdown clock shared by walkers, runners, skaters and cyclists. */
export class TrafficFall {
  readonly pose:RidePose;readonly motion:FallMotion;age=0;readonly standAt:number;readonly duration:number;
  phase='brace';done=false;private rest?:RidePose;
  constructor(entry:{x:number;y:number;z:number;heading:number;speed:number},impact:ActorImpact){
    this.pose=Object.assign(createPose(),entry,{headingY:entry.heading});
    this.motion=new FallMotion(this.pose,'collision',.255,impact);
    this.standAt=this.motion.settleTime+.85+this.motion.severity*.65;
    this.duration=1.6+this.motion.severity*.7;
  }
  step(dt:number,terrain:TerrainSampler,canStand=true){
    if(dt<=0||this.done)return;this.age+=Math.min(dt,.1);
    if(this.age<this.standAt){this.motion.sample(this.age,this.pose);this.phase=this.motion.phase;this.constrain(terrain);this.rest={...this.pose};}
    else{
      if(!this.rest){this.motion.sample(this.standAt,this.pose);this.constrain(terrain);this.rest={...this.pose};}
      // Do not stand into a passing wheel. Remain kneeling until the space is clear.
      if(!canStand)this.age=Math.min(this.age,this.standAt+this.duration*.48);
      const t=Math.min(1,(this.age-this.standAt)/this.duration);getUpPose(this.rest,t,this.pose);this.phase=t<.4?'kneeling':t<.86?'getting up':'standing';this.done=t===1;
    }
  }
  get position(){const p=this.pose,c=Math.cos(p.headingY),s=Math.sin(p.headingY);return {x:p.x+c*p.crashLateral+s*p.crashForward,y:p.y,z:p.z-s*p.crashLateral+c*p.crashForward};}
  private constrain(terrain:TerrainSampler){
    const p=this.pose,end=this.position,dx=end.x-p.x,dz=end.z-p.z,length=Math.hypot(dx,dz);if(length<.001)return;
    const hit=terrain.raycastObstacle({x:p.x,y:p.y+.55,z:p.z},{x:dx,y:0,z:dz},length+.35,.3);
    let fraction=hit===null?1:Math.max(0,(hit-.35)/length);
    // Sample along the drift, so a shove cannot carry a person off a bridge or into water.
    const ground=createGroundSample();let height=p.y;
    for(let t=Math.min(.25/length,fraction);t<=fraction+1e-8;t+=.25/length){terrain.sampleGround(p.x+dx*t,p.z+dz*t,ground,height);if(ground.offCourse||Math.abs(ground.height-height)>.25){fraction=Math.max(0,t-.25/length);break;}height=ground.height;}
    p.crashLateral*=fraction;p.crashForward*=fraction;
  }
}
