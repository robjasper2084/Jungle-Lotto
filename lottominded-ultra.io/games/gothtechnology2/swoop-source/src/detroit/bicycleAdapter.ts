import {BicycleController} from '@digital-static/ridecore/cycling';
import {RideController,createPose,type RidePose,type RideActions} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
/** The original EUC remains the default; bicycle motion is shared with Elmwood. */
export class BicycleAdapter extends RideController {
  bicycle:BicycleController;cycling=false;
  constructor(terrain:TerrainSampler){super(terrain);this.bicycle=new BicycleController(terrain);}
  override reset(spawn?:Parameters<RideController['reset']>[0]){super.reset(spawn);if(this.bicycle){const p=createPose();super.writePose(p);this.bicycle.reset({position:p,headingY:p.headingY});}}
  override step(dt:number,input:RideActions){if(this.cycling)this.bicycle.step(dt,input);else super.step(dt,input);}
  override writePose(out:RidePose){if(this.cycling){Object.assign(out,createPose());this.bicycle.writePose(out);}else super.writePose(out);}
  override snapshot(){const original=super.snapshot();if(!this.cycling)return original;const b=this.bicycle.snapshot();return {...original,...b,engine:original.engine,fallPhase:original.fallPhase,trick:original.trick};}
  override recover(spawn?:Parameters<RideController['recover']>[0]){if(!this.cycling)return super.recover(spawn);const p=this.bicycle.cycle,travel=this.bicycle.travel;const ok=super.recover(spawn??{position:{x:p.x,y:p.y,z:p.z},headingY:p.headingY});if(ok)this.bicycle.travel=travel;return ok;}
  override obstacles(id:string){return this.cycling?[this.bicycle.bikeObstacle(id)]:super.obstacles(id);}
  override obstacle(id:string){return this.cycling?this.bicycle.bikeObstacle(id):super.obstacle(id);}
  override moveReadiness(id:number){return this.cycling?'Bicycle · pedal, coast and brake; EUC tricks unavailable.':super.moveReadiness(id);}
}
