import {BicycleController} from '@digital-static/ridecore/cycling';
import {NEUTRAL_ACTIONS} from '@digital-static/ridecore';
import {FollowCamera} from './riding/followCamera.ts';
import {RideCore,RIDECORE,HUMAN_PROFILE,createPose,copyPose,lerpPose} from '@digital-static/ridecore';
import type {RideActions,RiderProfile,Vec3,RideEvent} from '@digital-static/ridecore';
import type {TerrainSampler} from '../simulation/world.ts';
import {rideCoreTerrain} from './ridecore-terrain.ts';
export {RIDECORE};

/** Actual Digital Static RideCore runtime, with fixed-step camera interpolation. */
export class RideMotion {
  readonly core:RideCore;readonly bicycle:BicycleController;cycling=false;
  readonly terrain:ReturnType<typeof rideCoreTerrain>;
  readonly pose=createPose();
  readonly follow:FollowCamera;
  readonly view={positionX:0,positionY:0,positionZ:0,targetX:0,targetY:0,targetZ:0,roll:0,fov:55*Math.PI/180};
  private previous=createPose();
  private previousCamera={...this.view};
  private currentCamera={...this.view};
  private accumulator=0;
  private pendingHop=false;
  private pendingTrick=0;
  readonly events:RideEvent[]=[];
  constructor(map:TerrainSampler,profile:RiderProfile=HUMAN_PROFILE){
    this.terrain=rideCoreTerrain(map);this.core=new RideCore(this.terrain,{profile});this.bicycle=new BicycleController(this.terrain);this.follow=new FollowCamera(this.terrain);
    this.reset({x:0,y:0,z:0},0);
  }
  get sim(){return this.cycling?this.bicycle:this.core.controller;}
  setProfile(profile:RiderProfile){this.core.setProfile(profile);copyPose(this.core.current,this.previous);copyPose(this.core.current,this.pose);}
  private captureCamera(){const c=this.follow;Object.assign(this.currentCamera,{positionX:c.eye.x,positionY:c.eye.y,positionZ:c.eye.z,targetX:c.target.x,targetY:c.target.y,targetZ:c.target.z,roll:c.roll,fov:c.fov*Math.PI/180});}
  reset(position:Vec3,headingY:number){
    this.core.reset({position,headingY});this.bicycle.reset({position,headingY});if(this.cycling)this.bicycle.writePose(this.core.current);copyPose(this.core.current,this.previous);copyPose(this.core.current,this.pose);
    this.follow.reset(this.pose);this.captureCamera();Object.assign(this.previousCamera,this.currentCamera);Object.assign(this.view,this.currentCamera);
    this.accumulator=0;this.clearPendingInput();this.events.length=0;
  }
  clearPendingInput(){this.pendingHop=false;this.pendingTrick=0;}
  render(alpha:number){
    lerpPose(this.previous,this.core.current,alpha,this.pose);
    for(const key of Object.keys(this.view) as (keyof typeof this.view)[])this.view[key]=this.previousCamera[key]+(this.currentCamera[key]-this.previousCamera[key])*alpha;
  }
  update(dt:number,actions:Partial<RideActions>,paused=false){
    this.events.length=0;
    if(paused){this.clearPendingInput();return;}
    if(!Number.isFinite(dt)||dt<0)throw new RangeError('Frame time must be finite and non-negative');
    this.pendingHop ||= !!actions.hop;
    if(actions.trick)this.pendingTrick=actions.trick;
    this.accumulator+=Math.min(dt,.1);const step=1/RIDECORE.fixedHz;
    while(this.accumulator+1e-12>=step){
      copyPose(this.core.current,this.previous);Object.assign(this.previousCamera,this.currentCamera);
      const result=this.cycling?(this.bicycle.step(step,{...NEUTRAL_ACTIONS,...actions,hop:false,hopHeld:false,trick:0,crouch:false}),this.bicycle.writePose(this.core.current),{events:[] as RideEvent[]}):this.core.advance(step,{...actions,hop:this.pendingHop,trick:this.pendingTrick});this.pendingHop=false;this.pendingTrick=0;
      this.events.push(...result.events);
      for(const event of result.events)if(event.type==='landing')this.follow.landing(event.impact);
      this.follow.step(step,this.core.current);this.captureCamera();
      this.accumulator=Math.max(0,this.accumulator-step);
    }
    this.render(this.accumulator/step);
  }
}
