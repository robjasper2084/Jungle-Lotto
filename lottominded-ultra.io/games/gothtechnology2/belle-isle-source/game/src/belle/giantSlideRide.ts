import {applySlideSeat} from './slideSeat.ts';
import * as T from 'three';
import {GiantSlideMotion,SLIDE_ENTRY,slideLocal,stairHeight,GIANT_SLIDE} from './giantSlide.ts';
import {footState} from '../../runtime/ride-core/src/onFoot.ts';
import {createPose,type RidePose} from '../../runtime/ride-core/src/controller.ts';
import type {RideCore} from '../../runtime/ride-core/src/ridecore.ts';
import type {ThreeRiderView} from '../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';
import {solveLimb} from '../../runtime/ride-core/src/limbIK.ts';
export class GiantSlideRide {
 readonly motion=new GiantSlideMotion();readonly button=document.createElement('button');
 private state:ReturnType<RideCore['controller']['captureState']>|undefined;
 private pose:RidePose=createPose();private park={x:0,y:0,z:0,heading:0};
 private sack=new T.Mesh(new T.BoxGeometry(.60,.035,1.05),new T.MeshStandardMaterial({color:0x927754,roughness:1}));
 constructor(private core:RideCore,private hero:ThreeRiderView,scene:T.Scene,private changed:()=>void){
  this.button.id='giant-slide-action';this.button.type='button';this.button.hidden=true;document.getElementById('ridehud')!.append(this.button);this.button.onclick=()=>this.interact();this.sack.visible=false;this.sack.name='Giant Slide riding mat';scene.add(this.sack);
 }
 get active(){return this.state!==undefined;}
 interact(){
  if(this.active){this.motion.descend();return;}
  const p=this.core.current;if(p.crashBlend>0||Math.abs(p.speed)>1||!this.motion.start(p))return;
  this.state=this.core.controller.captureState();this.park=p.footMode?{x:p.parkX,y:p.parkY,z:p.parkZ,heading:p.parkHeading}:{x:p.x,y:p.y,z:p.z,heading:p.headingY};
  this.pose={...createPose(),footMode:2,footBlend:1,parkX:this.park.x,parkY:this.park.y,parkZ:this.park.z,parkHeading:this.park.heading};this.changed();
 }
 cancel(){if(!this.state)return;this.core.controller.restoreState(this.state);this.sync();this.state=undefined;this.motion.cancel();this.sack.visible=false;this.changed();}
 private sync(){this.core.clearPendingActions();this.core.controller.writePose(this.core.current);Object.assign(this.core.previous,this.core.current);Object.assign(this.core.renderPose,this.core.current);}
 update(dt:number,enabled:boolean){
  const p=this.core.current,near=Math.hypot(p.x-SLIDE_ENTRY.x,p.z-SLIDE_ENTRY.z)<6;
  this.button.hidden=!enabled||(!this.active&&!near);
  this.button.disabled=this.active?this.motion.stage!=='ready':Math.abs(p.speed)>1||p.crashBlend>0;
  this.button.textContent=!this.active?(Math.abs(p.speed)>1?'Stop to climb the slide':'Climb Giant Slide · E'):this.motion.stage==='ready'?'Slide down · E':this.motion.stage==='climb'?'Climbing stairs · R to leave':'Sliding · R to leave';
  if(!this.active)return null;
  if(enabled)this.motion.update(dt);
  const m=this.motion;Object.assign(this.pose,m.position,{headingY:m.heading,speed:m.stage==='climb'?m.speed:0,footTime:m.time,footCycle:m.travel/1.45,footPhase:m.travel/1.45%1});
  if(m.stage==='done'){
   const state=this.state!;state.fields.pose={...this.pose};state.fields.walking={...footState(),mode:2,time:m.time,phase:this.pose.footPhase};this.core.controller.restoreState(state);this.sync();this.state=undefined;this.sack.visible=false;this.changed();return this.core.renderPose;
  }
  return this.pose;
 }
 /** Pose only; the attraction never changes bone lengths or normal ride physics. */
 present(){
  const m=this.motion,h=this.hero;this.sack.visible=this.active&&m.seat>.01;if(!this.active)return;
  if(m.stage==='climb'){
   // Fit existing walk contacts to the actual treads, keeping the swing-foot lift.
   for(const leg of h.legs){const p=leg.foot.getWorldPosition(new T.Vector3()),local=slideLocal(p.x,p.z);if(Math.abs(local.u-GIANT_SLIDE.stairsX)>.7||local.v>19.5||local.v< -18)continue;
    const lift=Math.max(.02,p.y-h.root.position.y-.08);p.y=Math.max(p.y,GIANT_SLIDE.origin[1]+stairHeight(local.v)+.08+lift);solveLimb(leg,p,new T.Vector3(0,0,1).transformDirection(h.root.matrixWorld),leg.foot.getWorldQuaternion(new T.Quaternion()),.98);
   }
   h.root.updateMatrixWorld(true);return;
  }
  if(m.seat<=0||!h.hips)return;
  applySlideSeat(h,m.heading,m.seat);
  const forward=new T.Vector3(Math.sin(m.heading),0,Math.cos(m.heading));
  this.sack.position.copy(h.root.position).addScaledVector(forward,.29);this.sack.position.y+=.045;this.sack.rotation.set(0,m.heading,0);
 }
}
