import {MathUtils,Object3D,Quaternion,Vector3} from 'three';
import {calibrateLimb,solveAnatomicalLimb,type LimbChain} from '../../../runtime/ride-core/src/limbIK.ts';

// Runtime adaptation of the supplied showcase rig to the rider/vehicle ratio
// in the user's reference photos. Keep the source GLBs and adult bone lengths.
export const CORLEO_SCALE=.64;
export const CORLEO_RADIUS=.85;
export function fitCorleoRider(model:Object3D){
 const node=(name:string)=>{const value=model.getObjectByName(name);if(!value)throw Error('CORLEO fit target missing: '+name);return value;};
 const body=node('CR_Body'),mount=node('CR_RiderMount');
 // The exhibit references have a taller, wider windscreen, rounded shoulders,
 // broad shin covers and longer split hooves. These instance transforms keep
 // the original meshes, joint pivots, animations and package hashes intact.
 model.traverse(o=>{
  if(o.name==='CR_FrontBrow')o.scale.set(1.2,1.2,1);
  else if(o.name==='CR_FrontFuselage')o.scale.set(1.1,1.2,1);
  else if(/^CR_FrontShoulder_/.test(o.name))o.scale.set(1.12,1.25,1);
  else if(/^CR_.._(ShinArmor|ShinCore|ShinInset|UpperArmor|UpperCore|UpperInset)$/.test(o.name))o.scale.x*=1.2;
  else if(/^CR_.._(HoofArmor|HoofPad|Tread)/.test(o.name)){o.scale.x*=1.15;o.scale.z*=1.65;}
 });
 const bone=(suffix:string)=>{let result:Object3D|undefined;mount.traverse(o=>{if((o as any).isBone&&o.name.endsWith(suffix))result=o;});if(!result)throw Error('CORLEO rider bone missing: '+suffix);return result;};
 model.updateMatrixWorld(true);
 // The imported rider's L bones occupy +X; the vehicle's L labels occupy -X.
 // Match physical sides, rather than joining identically named opposite sides.
 const contacts=['L','R'].flatMap(side=>[
  {chain:{upper:bone('UpperArm_'+side),knee:bone('LowerArm_'+side),foot:bone('Hand_'+side)},socket:node('CR_FixedGrip_'+(side==='L'?'R':'L'))},
  {chain:{upper:bone('UpperLeg_'+side),knee:bone('LowerLeg_'+side),foot:bone('Foot_'+side)},socket:node('CR_StirrupPlate_'+(side==='L'?'R':'L'))},
 ]).map(({chain,socket})=>{
  const a=chain.upper.getWorldPosition(new Vector3()),b=chain.knee.getWorldPosition(new Vector3()),c=chain.foot.getWorldPosition(new Vector3());
  const inverse=socket.getWorldQuaternion(new Quaternion()).invert();
  return {chain:chain as LimbChain,socket,
   // Keep the original wrist/ankle-to-contact offset in adult-sized metres.
   offset:c.clone().sub(socket.getWorldPosition(new Vector3())).applyQuaternion(inverse),
   rotation:inverse.clone().multiply(chain.foot.getWorldQuaternion(new Quaternion())),
   hint:b.clone().sub(a).applyQuaternion(body.getWorldQuaternion(new Quaternion()).invert()).normalize(),
   anatomy:calibrateLimb(chain,new Vector3(1,0,0).applyQuaternion(body.getWorldQuaternion(new Quaternion()))),
   target:new Vector3(),worldRotation:new Quaternion(),worldHint:new Vector3(),
  };
 });
 model.scale.multiplyScalar(CORLEO_SCALE);
 mount.scale.multiplyScalar(1/CORLEO_SCALE);
 const fittedMountScale=mount.scale.clone();
 const fittedMountPosition=mount.position.clone();
 const pilot=mount.children.find(o=>/_Pilot_Root$/.test(o.name));
 if(!pilot)throw Error('CORLEO pilot root missing');
 const ground=new Vector3(),up=new Vector3(),point=new Vector3(),origin=new Vector3();
 const update=(contactsEnabled=true)=>{
  mount.scale.copy(fittedMountScale);
  mount.position.copy(fittedMountPosition);
  model.updateWorldMatrix(true,true);
  // Keep the adult rider above the road while the smaller vehicle kneels.
  // The source clips translate an adult relative to a full-size saddle: their
  // off-seat Y path cannot simply inherit the vehicle's 64% body height.
  const seated=contactsEnabled?1:1-MathUtils.smoothstep(Math.abs(pilot.position.x),.05,.45);
  model.getWorldPosition(ground);up.set(0,1,0).applyQuaternion(model.getWorldQuaternion(new Quaternion()));
  if(!contactsEnabled){
   const feet=contacts.filter(c=>c.socket.name.includes('Stirrup'));
   const lowest=Math.min(...feet.map(c=>c.chain.foot.getWorldPosition(point).sub(ground).dot(up)));
   const rise=Math.max(0,.078-lowest)*(1-seated);
   mount.getWorldPosition(origin);point.copy(origin).addScaledVector(up,rise);
   mount.position.copy(mount.parent!.worldToLocal(point));model.updateWorldMatrix(true,true);
  }
  const bodyRotation=body.getWorldQuaternion(new Quaternion());
  for(const contact of contacts){
   const leg=contact.socket.name.includes('Stirrup');
   if(!contactsEnabled&&!leg&&seated===0)continue;
   const rotation=contact.socket.getWorldQuaternion(contact.worldRotation);
   contact.target.copy(contact.offset).applyQuaternion(rotation).add(contact.socket.getWorldPosition(new Vector3()));
   rotation.multiply(contact.rotation);
   contact.worldHint.copy(contact.hint).applyQuaternion(bodyRotation);
   if(!contactsEnabled){
    contact.target.lerpVectors(contact.chain.foot.getWorldPosition(point),contact.target,seated);
    if(leg){const height=point.copy(contact.target).sub(ground).dot(up);if(height<.078)contact.target.addScaledVector(up,.078-height);}
    rotation.slerpQuaternions(contact.chain.foot.getWorldQuaternion(new Quaternion()),rotation,seated);
    contact.worldHint.lerpVectors(contact.chain.knee.getWorldPosition(point).sub(contact.chain.upper.getWorldPosition(origin)).normalize(),contact.worldHint,seated).normalize();
   }
   solveAnatomicalLimb(contact.chain,contact.target,contact.worldHint,contact.anatomy,rotation,1);
  }
 };
 update();
 return {update,contacts};
}
