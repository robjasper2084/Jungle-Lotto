import {RideCore} from '../../../runtime/ride-core/src/ridecore.ts';
import {HoverController,type HoverInput,type FlightObstacle} from '../hoverController.ts';
import type {ParkTerrain} from '../terrain.ts';
import {CORLEO_RADIUS,CORLEO_SCALE} from './corleoFit.ts';
/** Ground locomotion uses the island's fixed-step controller and collision queries.
 * The exported showcase never supplies world position, speed, or heading. */
export class CorleoController extends HoverController{
 private ground:RideCore;
 private safe:{x:number;z:number;heading:number};
 private traffic?:FlightObstacle;
 constructor(terrain:ParkTerrain,spawn:{x:number;z:number;heading:number},traffic?:FlightObstacle){
  super(terrain,spawn,traffic);this.traffic=traffic;this.safe={...spawn};
  this.ground=new RideCore(terrain,{spawn:{position:{x:spawn.x,y:terrain.height(spawn.x,spawn.z),z:spawn.z},headingY:spawn.heading}});
  this.ground.controller.setHandling({maxSpeed:4.2,reverseSpeed:1.6,driveAcceleration:3.2,brakeAcceleration:7,lowSpeedYaw:1.2,highSpeedYaw:.7,maxLean:.3,hopSpeed:0,chargedHopSpeed:0,crashImpact:12});
  this.reset(spawn.x,spawn.z,spawn.heading);
 }
 override launch(){/* Ground vehicle: no lift or flight transition. */}
 override land(){this.stop();}
 override startFlight(){return false;}
 override toggleCruise(){return false;}
 override stop(){super.stop();if(this.ground){const p=this.ground.current;this.ground.reset({position:{x:p.x,y:p.y,z:p.z},headingY:p.headingY});}}
 override reset(x=this.safe.x,z=this.safe.z,heading=this.safe.heading){
  super.reset(x,z,heading);this.ground?.reset({position:{x,y:this.terrain.height(x,z),z},headingY:heading});
 }
 override advance(seconds:number,input:HoverInput){
  const dt=Math.max(0,Math.min(.12,Number.isFinite(seconds)?seconds:0)),before={...this.ground.current};
  const demand=this.drive.sample(input.throttle,input.clutch,input.brake);
  const braking=input.brake?(Math.abs(before.speed)>.05?-Math.sign(before.speed):0):demand;
  this.ground.advance(dt,{throttle:braking,steer:input.steer,hop:false,dismount:false});const p=this.ground.current;
  const dx=p.x-before.x,dz=p.z-before.z,distance=Math.hypot(dx,dz),direction={x:dx/(distance||1),y:0,z:dz/(distance||1)};
  // Full horse footprint, water edges and headroom, in addition to RideCore contacts.
  const sin=Math.sin(p.headingY),cos=Math.cos(p.headingY);
  const unsupported=[[-.65,1.1],[.65,1.1],[-.65,-1.1],[.65,-1.1]].some(([x,z])=>!this.terrain.land(p.x+(cos*x+sin*z)*CORLEO_SCALE,p.z+(-sin*x+cos*z)*CORLEO_SCALE,p.y));
  const unsafe=unsupported||!this.terrain.land(p.x,p.z,p.y)||this.terrain.obstructed(p.x,p.z,CORLEO_RADIUS)||Math.abs(this.terrain.height(p.x,p.z,p.y)-before.y)>.6||
   (distance>1e-6&&[.4,.95,1.8].some(h=>this.terrain.raycastFlight({x:before.x,y:before.y+h,z:before.z},direction,distance+CORLEO_RADIUS,.45)!==null||this.traffic?.({x:before.x,y:before.y+h,z:before.z},direction,distance+CORLEO_RADIUS,.45)!=null));
  this.collision=unsafe||p.crashBlend>.05;this.impactSpeed=this.collision?Math.abs(before.speed):0;
  if(this.collision){this.ground.reset({position:{x:before.x,y:before.y,z:before.z},headingY:before.headingY});}
  const actual=this.ground.current;
  Object.assign(this.pose,{x:actual.x,y:actual.y+.18,z:actual.z,heading:actual.headingY,speed:actual.speed,pitch:Math.max(-.2,Math.min(.2,actual.groundPitch)),roll:Math.max(-.2,Math.min(.2,actual.groundRoll)),lift:0,rpm:0});
  this.flying=false;this.landed=true;this.clearance=.18;this.boostActive=false;this.throttleDemand=Math.max(0,demand);this.hazard=this.collision;
  if(!this.collision)this.safe={x:actual.x,z:actual.z,heading:actual.headingY};return this.pose;
 }
}
