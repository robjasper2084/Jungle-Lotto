import * as T from 'three';
import {Hero} from '../actors.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';
import type {RiderId} from '../riderChoices.ts';
import type {RidePose} from '../controller.ts';
import type {CombatState,Weapon} from '../../../../ride-core/src/royale/rules.ts';
import type {TerrainSampler} from '../../../../ride-core/src/terrain.ts';
import {EQUIPMENT_SOCKETS} from '../../../../ride-core/src/royale/combatProfiles.ts';
import {EquipmentLibrary,WeaponView} from './equipment.ts';
import {CombatRig} from './combatRig.ts';
import {FpsMotion,reloadPose} from './fpsMotion.ts';
/** A separate instance of the selected hero's skinned hands. The world actor,
 * authoritative muzzle and other players' poses are never moved by view animation. */
export class FirstPersonView {
 readonly root=new T.Group();private hero:Hero;private weapon:WeaponView;private rig:CombatRig;private motion=new FpsMotion();
 private magazine=new T.Mesh(new T.BoxGeometry(.055,.13,.085),new T.MeshStandardMaterial({color:'#293a3c',metalness:.65,roughness:.4}));
 constructor(data:Map<string,GLTF>,library:EquipmentLibrary,readonly skin:RiderId){
  this.hero=new Hero(data,undefined,skin);this.weapon=new WeaponView(library);this.rig=new CombatRig(this.hero,this.weapon);
  this.root.name='First-person hands and weapon';this.root.add(this.hero.root,this.weapon.root,this.magazine);this.root.visible=false;
 }
 pickup(tick:number){this.rig.pickup(tick);}
 update(p:RidePose,state:CombatState,kind:Weapon,tick:number,yaw:number,pitch:number,camera:T.Camera,dt:number,shot:boolean,ads:boolean,reduced:boolean,terrain:TerrainSampler,healingUntil=0){
  this.root.visible=true;this.root.position.set(0,0,0);this.root.quaternion.identity();this.root.updateMatrixWorld(true);
  this.hero.apply({...p,seated:0});this.hero.visibility.setFirstPerson(true);this.hero.vehicle.visible=false;
  this.weapon.select(kind);if(shot)this.rig.interruptPickup();if(shot)this.weapon.fire(reduced);this.weapon.update(dt,reduced);this.rig.apply({...p,seated:0},yaw,pitch,state,tick,healingUntil);
  const r=reloadPose(state,tick),m=this.motion.update(dt,kind,shot,Math.abs(p.speed),p.airHeight>.03,ads,reduced,r),scale=this.hero.motionScale;
  const f=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion),right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const obstacle=terrain.raycastObstacle(camera.position,f,.95,.07),blocked=obstacle===null?0:T.MathUtils.clamp((.95-obstacle)/.6,0,1);
  const bob=reduced||ads?0:Math.sin(p.footCycle*Math.PI*2)*Math.min(.012,Math.abs(p.speed)*.003);
  const target=camera.position.clone().addScaledVector(f,(.68+.18*m.aim-.14*blocked-.065*m.kick)*scale).addScaledVector(right,((1-m.aim)*.18+m.run*.09)*scale)
   .addScaledVector(up,(-(1-m.aim)*.19-.12*r.lower-.22*m.equip-.14*m.run-.18*blocked-.045*m.land+bob)*scale);
  const sight=healingUntil>tick?this.hero.arms[0].foot.getWorldPosition(new T.Vector3()).lerp(this.hero.arms[1].foot.getWorldPosition(new T.Vector3()),.5):this.weapon.socket(EQUIPMENT_SOCKETS.sight_axis);
  if(healingUntil>tick)target.addScaledVector(up,-.10*scale);
  const mag=this.weapon.socket(EQUIPMENT_SOCKETS.magazine_socket);
  const roll=-(r.lower*.18+m.run*.23+blocked*.28);this.root.quaternion.setFromAxisAngle(f,roll);
  this.root.position.copy(target).sub(sight.clone().applyQuaternion(this.root.quaternion));this.magazine.position.copy(mag).addScaledVector(up,-r.magazine*.22*scale).addScaledVector(right,-r.magazine*.065*scale);
  this.magazine.quaternion.copy(this.weapon.root.quaternion);this.magazine.scale.setScalar(scale);this.magazine.visible=r.active&&r.magazine>.02;
  this.root.updateMatrixWorld(true);
  return {reload:r.phase,obstruction:blocked,rigRight:this.rig.errorR,rigLeft:this.rig.errorL};
 }
 hide(){this.root.visible=false;}
 dispose(){this.hero.dispose();this.weapon.dispose();this.magazine.geometry.dispose();this.magazine.material.dispose();this.root.removeFromParent();}
}
