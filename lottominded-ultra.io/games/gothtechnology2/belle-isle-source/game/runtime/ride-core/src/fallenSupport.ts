import {Box3,MathUtils,Matrix4,Object3D,Quaternion,SkinnedMesh,Vector3,type Mesh} from 'three';
import type {RidePose} from './controller.ts';
import type {TerrainSampler} from './terrain.ts';
import {createGroundSample} from './terrain.ts';
import {solveLimb,calibrateLimb,solveAnatomicalLimb,type AnatomicalLimb,type LimbChain} from './limbIK.ts';
import {recoveryHand,recoveryFoot,recoveryWheel} from './kimodoRecovery.ts';

type Probe={mesh:Mesh;indices:number[]};
type SupportedLimb=LimbChain&{rotation:Quaternion};
type Rig={rider:Object3D;vehicle:Object3D;root:Object3D;legs:SupportedLimb[];arms:SupportedLimb[];motionScale:number;footTarget(index:number,p:RidePose):Vector3};

/** Keep the impact clearance, then relax it for a small mascot's settled side
 * pose. Full-size clearance otherwise lifts its already supported torso. */
export function settledContactMargin(p:RidePose,scale:number){
 return .045-(scale<.75&&p.crashKind===2?.01*MathUtils.smoothstep(p.crashSettle,.25,.65)*(1-MathUtils.smoothstep(p.crashRecovery,0,.2)):0);
}

/** Retarget the resting contact, after the captured impact. Ground the torso first:
 * a global correction after floor-targeted IK otherwise lifts every hand/boot. */
export class FallenSupport {
 private body:Probe[]=[];
 private limbs=new Map<Object3D,Probe[]>();
 private shins=new Map<Object3D,Probe[]>();
 private palms=new Map<Object3D,Quaternion>();
 private legAnatomy=new Map<Object3D,AnatomicalLimb>();
 private handle:Vector3;
 private groundCache=new Map<string,ReturnType<typeof createGroundSample>>();
 constructor(probes:Probe[],rig:Rig){
  const bendNormal=new Vector3(1,0,0).applyQuaternion(rig.root.getWorldQuaternion(new Quaternion()));
  for(const l of rig.legs)this.legAnatomy.set(l.upper,calibrateLimb(l,bendNormal));
  const grip=rig.vehicle.getObjectByName('CarryHandle_Grip'),bounds=new Box3().setFromObject(grip??rig.vehicle,true);
  this.handle=bounds.isEmpty()?new Vector3(0,.55,0):rig.vehicle.worldToLocal(grip?bounds.getCenter(new Vector3()):bounds.getCenter(new Vector3()).setY(bounds.max.y-.035));
  const classify=(mesh:Mesh,index:number)=>{
   const skin=mesh as SkinnedMesh,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
   if(!skin.isSkinnedMesh||!indices||!weights)return undefined;
   let joint=0,weight=-1;for(let k=0;k<4;k++){const w=weights.getComponent(index,k);if(w>weight){weight=w;joint=indices.getComponent(index,k);}}
   return skin.skeleton.bones[joint];
  };
  for(const {mesh,indices} of probes){
   const body=indices.filter(i=>/^(Hips|Spine\d*|Chest|[Nn]eck|Head)$/.test(classify(mesh,i)?.name??''));
   if(body.length)this.body.push({mesh,indices:body});
  }
  for(const limb of [...rig.legs,...rig.arms]){
   const bones=new Set<Object3D>();limb.foot.traverse(o=>bones.add(o));
   this.limbs.set(limb.foot,probes.map(({mesh,indices})=>({mesh,indices:indices.filter(i=>bones.has(classify(mesh,i)!))})).filter(p=>p.indices.length));
  }
  for(const limb of rig.legs){const bones=new Set<Object3D>();limb.knee.traverse(o=>bones.add(o));
   this.shins.set(limb.foot,probes.map(({mesh,indices})=>({mesh,indices:indices.filter(i=>bones.has(classify(mesh,i)!))})).filter(p=>p.indices.length));
  }
  for(const limb of rig.arms){
   const hand=limb.foot,prefix=hand.name.replace(/Hand$/,''),middle=hand.getObjectByName(prefix+'HandMiddle1'),index=hand.getObjectByName(prefix+'HandIndex1'),pinky=hand.getObjectByName(prefix+'HandPinky1');
   if(!middle||!index||!pinky)continue;
   const local=(o:Object3D)=>hand.worldToLocal(o.getWorldPosition(new Vector3()));
   const z=local(middle).normalize(),x=local(index).sub(local(pinky)).multiplyScalar(prefix==='Left'?1:-1);x.addScaledVector(z,-x.dot(z)).normalize();
   const y=z.clone().cross(x).normalize();
   this.palms.set(hand,new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z)).invert());
  }
 }
 /** Keep the thigh and shin on a shared knee hinge instead of independently
  * swinging each imported bone toward an endpoint and retaining axial twist. */
 solveLeg(limb:LimbChain,target:Vector3,pole:Vector3,rotation?:Quaternion,reach=.975,maxFlex=Math.PI){
  solveAnatomicalLimb(limb,target,pole,this.legAnatomy.get(limb.upper)!,rotation,reach,maxFlex);
 }
 /** One recovery bend direction shared by the fall, floor and get-up passes.
  * Arc from the resting skyward knee to forward-facing support; no shortest-arc
  * choice between independently generated (sometimes opposing) knee poses. */
 recoveryPole(rig:Pick<Rig,'root'>,progress:number){
  const angle=Math.PI/2*MathUtils.smoothstep(progress,.03,.34);
  return new Vector3(0,0,Math.sin(angle)).applyQuaternion(rig.root.getWorldQuaternion(new Quaternion())).add(new Vector3(0,Math.cos(angle),0));
 }
 private blendLegTarget(limb:LimbChain,target:Vector3,pole:Vector3,rotation:Quaternion|undefined,weight:number,blendPole=true){
  const hip=limb.upper.getWorldPosition(new Vector3()),ankle=limb.foot.getWorldPosition(new Vector3());
  target.lerpVectors(ankle,target,weight);
  const direction=target.clone().sub(hip).normalize(),oldDirection=ankle.clone().sub(hip).normalize();
  // Preserve the current bend plane while moving the ankle. Projecting the old
  // knee onto the NEW axis can reverse the pole when the target passes the knee.
  const start=limb.knee.getWorldPosition(new Vector3()).sub(hip);start.addScaledVector(oldDirection,-start.dot(oldDirection));
  start.applyQuaternion(new Quaternion().setFromUnitVectors(oldDirection,direction));
  const finish=pole.clone().addScaledVector(direction,-pole.dot(direction));
  if(blendPole&&start.lengthSq()>1e-8&&finish.lengthSq()>1e-8){
   start.normalize();finish.normalize();
   const angle=Math.atan2(direction.dot(start.clone().cross(finish)),start.dot(finish));
   pole.copy(start.applyAxisAngle(direction,angle*weight));
  }
  if(rotation)rotation.copy(limb.foot.getWorldQuaternion(new Quaternion()).slerp(rotation,weight));
 }
 /** Pose crossfades may preserve endpoints but reintroduce axial knee rotation.
  * Refit the current triangle after the on-foot blend without moving its joints. */
 alignLegs(rig:Rig,weight=1){
  if(weight<=0)return;
  for(const limb of rig.legs){const hip=limb.upper.getWorldPosition(new Vector3()),target=limb.foot.getWorldPosition(new Vector3());
   const pole=limb.knee.getWorldPosition(new Vector3()).sub(hip),rotation=limb.foot.getWorldQuaternion(new Quaternion());
   const bones=[limb.upper,limb.knee,limb.foot],original=weight<1?bones.map(b=>b.quaternion.clone()):undefined;
   this.solveLeg(limb,target,pole,rotation,1);
   // Restore the authored walk's segment frames gradually, rather than dropping
   // this correction in a single frame when the recovery state clears.
   if(original){bones.forEach((bone,i)=>bone.quaternion.slerpQuaternions(original[i],bone.quaternion,weight));limb.upper.updateWorldMatrix(false,true);}
  }
 }
 private lift(probes:Probe[],floor:number,terrain:TerrainSampler|undefined,margin:number){
  const p=new Vector3();let lift=-Infinity;
  for(const {mesh,indices} of probes){
   if((mesh as SkinnedMesh).isSkinnedMesh)(mesh as SkinnedMesh).skeleton.update();
   for(const i of indices){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);
    let height=floor;
    if(terrain){const x=Math.round(p.x/.35)*.35,z=Math.round(p.z/.35)*.35,key=x+','+z;
     let ground=this.groundCache.get(key);if(!ground){ground=terrain.sampleGround(x,z,createGroundSample(),floor);this.groundCache.set(key,ground);}
     height=ground.height;if(ground.normal.y>.2)height-=(ground.normal.x*(p.x-x)+ground.normal.z*(p.z-z))/ground.normal.y;
    }
    lift=Math.max(lift,height+margin-p.y);
   }
  }
  return Number.isFinite(lift)?lift:0;
 }
 apply(rig:Rig,p:RidePose,terrain?:TerrainSampler){
  if(!p.crashMotion||!p.crashKind)return;
  // Settling starts after impact; this reaches full support over about .35 s.
  const weight=MathUtils.smoothstep(p.crashSettle,0,.25)*(1-MathUtils.smoothstep(p.crashRecovery,0,.20));
  if(weight<=0)return;
  this.groundCache.clear();
  const floor=p.y-p.airHeight,scale=rig.motionScale;
  rig.rider.updateWorldMatrix(true,false);rig.rider.updateMatrixWorld(true);
  // Large mascot faces need the same protective sideways head turn a human
  // naturally makes when lying face down; otherwise the nose supports the rig.
  if(scale<.75&&(p.crashKind===1||p.crashKind===4)){
   const head=rig.rider.getObjectByName('Head');
   if(head?.parent){const axis=new Vector3(0,1,0).transformDirection(rig.rider.matrixWorld),world=head.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromAxisAngle(axis,(p.crashSide||1)*1.2*weight));
    head.quaternion.copy(head.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));rig.rider.updateMatrixWorld(true);
   }
  }
  const position=rig.rider.getWorldPosition(new Vector3());position.y+=this.lift(this.body,floor,terrain,.035)*weight;
  rig.rider.position.copy(rig.rider.parent?rig.rider.parent.worldToLocal(position):position);rig.rider.updateMatrixWorld(true);
  const heading=rig.root.getWorldQuaternion(new Quaternion()),worldUp=new Vector3(0,1,0);
  for(const [isLeg,limbs] of [[true,rig.legs],[false,rig.arms]] as const)for(const limb of limbs){
   const bones=[limb.upper,limb.knee,limb.foot],original=bones.map(b=>b.quaternion.clone());
   const current=limb.foot.getWorldPosition(new Vector3()),target=current.clone();
   target.y=terrain?terrain.sampleGround(target.x,target.z,createGroundSample(),floor).height:floor;
   target.y+=(isLeg?.085:.075)*scale+.025;
   const rotation=isLeg?heading.clone().multiply(limb.rotation):undefined,pole=isLeg&&p.crashRecovery>0?this.recoveryPole(rig,p.crashRecovery):worldUp.clone();
   if(isLeg)this.blendLegTarget(limb,target,pole,rotation,weight,p.crashRecovery<=0);
   // Bend toward the sky instead of putting an elbow/knee underneath the torso.
   if(isLeg)this.solveLeg(limb,target,pole,rotation);else solveLimb(limb,target,pole,rotation,.975);
   rig.rider.updateMatrixWorld(true);
   // Fit the actual boot/glove thickness, not just its ankle/wrist joint.
   const correction=this.lift(this.limbs.get(limb.foot)??[],floor,terrain,.03);
   if(correction>0){target.copy(limb.foot.getWorldPosition(new Vector3()));target.y+=correction*(isLeg?weight:1);if(isLeg)this.solveLeg(limb,target,pole,rotation);else solveLimb(limb,target,pole,rotation,.975);rig.rider.updateMatrixWorld(true);}
   // Arm chains blend as before; legs blend targets above so the knee hinge
   // remains anatomical throughout the transition.
   if(!isLeg)bones.forEach((bone,i)=>{const fitted=bone.quaternion.clone();bone.quaternion.copy(original[i]).slerp(fitted,weight);});
   rig.rider.updateMatrixWorld(true);
  }
 }
 /** Fit the support after silhouette clearance, so a boot cannot lift a planted
  * palm. Targets use the ground heading, never the rolling torso's axes. */
 recover(rig:Rig,p:RidePose,terrain?:TerrainSampler){
  const t=p.crashRecovery;if(!p.crashMotion||t<=0||t>=1)return;
  const maxFlex=Math.PI-Math.PI/6*MathUtils.smoothstep(t,0,.12);
  this.groundCache.clear();const scale=rig.motionScale,floor=p.y-p.airHeight;
  const heading=rig.root.getWorldQuaternion(new Quaternion());
  const forward=new Vector3(0,0,1).applyQuaternion(heading),right=new Vector3(1,0,0).applyQuaternion(heading);
  const point=(x:number,z:number,anchored=false)=>{
   const mount=anchored&&p.footMode===0?Math.max(.001,p.crashRelease):1;
   const at=new Vector3(p.x,floor,p.z).addScaledVector(right,p.crashLateral/mount+x*scale).addScaledVector(forward,p.crashForward/mount+z*scale);
   at.y=terrain?terrain.sampleGround(at.x,at.z,createGroundSample(),floor).height:floor;return at;
  };
  const contacts=[...rig.legs.map((limb,i)=>{const step=recoveryFoot(t,i,p.crashSide||1),side=i===0?1:-1;
   // A fixed upward hint can pass through the hip-to-ankle direction as the
   // pelvis rises, reversing the knee by 180 degrees. Knees face ahead instead.
   return {limb,weight:step.plant,target:point(side*.18,step.forward,true),rotation:heading.clone().multiply(limb.rotation),pole:this.recoveryPole(rig,t),leg:true,ground:true};
  }),...rig.arms.map((limb,i)=>{const hand=recoveryHand(t,i,p.crashSide||1),side=i===0?1:-1;
   return {limb,weight:hand.plant,target:point(side*.30,.25),rotation:this.palms.has(limb.foot)?heading.clone().multiply(this.palms.get(limb.foot)!):undefined,pole:forward.clone().addScaledVector(right,side*.55),leg:false,ground:true};
  })];
  if(p.footMode===0){const i=(p.crashSide||1)>0?1:0,limb=rig.arms[i];
   if(limb){const target=rig.vehicle.localToWorld(this.handle.clone());contacts[2+i]={limb,target,weight:recoveryWheel(t).grip,rotation:undefined,pole:forward.clone().addScaledVector(right,i===0?.5:-.5),leg:false,ground:false};}
  }
  const grip=contacts.find(c=>!c.ground&&c.weight>0);
  if(grip){
   const shoulder=grip.limb.upper.getWorldPosition(new Vector3()),elbow=grip.limb.knee.getWorldPosition(new Vector3()),wrist=grip.limb.foot.getWorldPosition(new Vector3());
   const reach=shoulder.distanceTo(elbow)+elbow.distanceTo(wrist),toward=grip.target.clone().sub(shoulder).setY(0);
   const distance=Math.min(.10*scale,Math.max(0,toward.length()-reach*.7))*grip.weight;
   if(distance>0){const at=rig.rider.getWorldPosition(new Vector3()).add(toward.normalize().multiplyScalar(distance));rig.rider.position.copy(rig.rider.parent?rig.rider.parent.worldToLocal(at):at);rig.rider.updateMatrixWorld(true);}
  }
  // Measure shoe/glove thickness in the proposed support orientation. Imported
  // boots are not ankle points and differ substantially between the five rigs.
  for(const c of contacts){
   if(c.weight<=0||!c.ground)continue;
   const end=c.limb.foot,current=end.getWorldPosition(new Vector3()),saved=end.quaternion.clone();
   if(c.rotation){end.quaternion.copy(end.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(c.rotation));rig.rider.updateMatrixWorld(true);}
   const correction=this.lift(this.limbs.get(end)??[],floor,undefined,.025);
   c.target.y+=Math.max(.035*scale,current.y-floor+correction);
   end.quaternion.copy(saved);rig.rider.updateMatrixWorld(true);
  }
  if(p.footMode===0)for(let i=0;i<rig.legs.length;i++){
   const step=recoveryFoot(t,i,p.crashSide||1),c=contacts[i];
   c.target.lerp(rig.footTarget(i,p),step.pedal);c.target.y+=step.clearance*scale;c.ground=step.pedal===0;
  }
  let lower=0;
  for(const c of contacts){
   if(c.weight<=0)continue;
   const a=c.limb.upper.getWorldPosition(new Vector3()),b=c.limb.knee.getWorldPosition(new Vector3()),end=c.limb.foot.getWorldPosition(new Vector3());
   const reach=(a.distanceTo(b)+b.distanceTo(end))*.965,dx=a.x-c.target.x,dz=a.z-c.target.z;
   const limit=c.target.y+Math.sqrt(Math.max(.001,reach*reach-dx*dx-dz*dz));
   lower=Math.min(lower,(limit-a.y)*c.weight);
  }
  if(lower<0){
   // Once weight transfers to the pedals, release the ground crouch gradually.
   // A distant foot target crossing full extension must not snap the pelvis up.
   if(p.footMode===0)lower*=1-MathUtils.smoothstep(t,.80,.98);
   lower=Math.max(lower,this.lift(this.body,floor,terrain,.025));
   const at=rig.rider.getWorldPosition(new Vector3());at.y+=Math.min(0,lower);
   rig.rider.position.copy(rig.rider.parent?rig.rider.parent.worldToLocal(at):at);rig.rider.updateMatrixWorld(true);
  }
  // The support reach must not fold the pelvis below the ankles. Settle into
  // a crouch above the boots; short mascot rigs retain their own scale.
  const hips=rig.rider.getObjectByName('Hips');
  if(hips){const at=hips.getWorldPosition(new Vector3()),weight=MathUtils.smoothstep(t,.02,.20),minimum=floor+.76*scale;
   const lift=Math.max(0,minimum-at.y)*weight;
   if(lift>0){const root=rig.rider.getWorldPosition(new Vector3());root.y+=lift;rig.rider.position.copy(rig.rider.parent?rig.rider.parent.worldToLocal(root):root);rig.rider.updateMatrixWorld(true);}
  }
  // Reach with the torso rather than dragging the hips across planted feet.
  // This keeps the grasp while the raised crouch protects the knees.
  if(grip){const spine=rig.rider.getObjectByName('Spine02')??rig.rider.getObjectByName('Spine');
   if(spine?.parent){const toward=grip.target.clone().sub(spine.getWorldPosition(new Vector3())).setY(0);
    if(toward.lengthSq()>1e-6){const axis=new Vector3(0,1,0).cross(toward.normalize()),world=spine.getWorldQuaternion(new Quaternion()).premultiply(new Quaternion().setFromAxisAngle(axis,.85*grip.weight));
     spine.quaternion.copy(spine.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));rig.rider.updateMatrixWorld(true);
    }
   }
  }
  for(const c of contacts){
   if(c.weight<=0)continue;
   const bones=[c.limb.upper,c.limb.knee,c.limb.foot],saved=bones.map(b=>b.quaternion.clone());
   if(c.leg)this.blendLegTarget(c.limb,c.target,c.pole,c.rotation,c.weight,false);
   if(c.leg)this.solveLeg(c.limb,c.target,c.pole,c.rotation,.975,maxFlex);else solveLimb(c.limb,c.target,c.pole,c.rotation,.975);rig.rider.updateMatrixWorld(true);
   // Correct the actual sole/palm once more after IK rotates it.
   if(c.ground){const clearance=this.lift(this.limbs.get(c.limb.foot)??[],floor,terrain,.025);
    c.target.y+=clearance*(clearance>0?1:c.weight);
    if(c.leg)this.solveLeg(c.limb,c.target,c.pole,c.rotation,.975,maxFlex);else solveLimb(c.limb,c.target,c.pole,c.rotation,.975);}
   if(!c.leg)bones.forEach((b,i)=>{const solved=b.quaternion.clone();b.quaternion.copy(saved[i]).slerp(solved,c.weight);});
   rig.rider.updateMatrixWorld(true);
  }
  // A still-folded trailing knee/boot must also clear the ground while the
  // support lowers the pelvis. Fit the limb, never lift all contacts again.
  for(const c of contacts){
   const clearance=this.lift((c.leg?this.shins:this.limbs).get(c.limb.foot)??[],floor,terrain,.025);
   if(clearance<=0)continue;
   const target=c.limb.foot.getWorldPosition(new Vector3());target.y+=clearance;
   const rotation=c.limb.foot.getWorldQuaternion(new Quaternion());
   // Clearance only translates an existing supported pose. Reusing the final
   // recovery pole here would bypass its blend, even before a foot is planted.
   const pole=c.leg?c.limb.knee.getWorldPosition(new Vector3()).sub(c.limb.upper.getWorldPosition(new Vector3())):c.pole;
   if(c.leg)this.solveLeg(c.limb,target,pole,rotation,.975,maxFlex);else solveLimb(c.limb,target,pole,rotation,.975);rig.rider.updateMatrixWorld(true);
  }
 }
}
