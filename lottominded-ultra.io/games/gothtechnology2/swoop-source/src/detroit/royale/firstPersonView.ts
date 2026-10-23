import * as T from 'three';
import {weaponReadyAmount} from '../../../../ride-core/src/royale/holster.ts';
import {Hero} from '../actors.ts';
import {FpsArms} from './fpsArms.ts';
import type {GLTF} from '../compressedGLTFLoader.ts';
import type {RiderId} from '../riderChoices.ts';
import type {RidePose} from '../controller.ts';
import type {CombatState,Weapon} from '../../../../ride-core/src/royale/rules.ts';
import type {TerrainSampler} from '../../../../ride-core/src/terrain.ts';
import {EQUIPMENT_SOCKETS} from '../../../../ride-core/src/royale/combatProfiles.ts';
import {EquipmentLibrary,WeaponView} from './equipment.ts';
import {CombatRig} from './combatRig.ts';
import {FpsMotion,reloadPose,WeaponSwap} from './fpsMotion.ts';
import {FpsWeaponSway} from './fpsControlFlow.ts';
/** A separate instance of the selected hero's skinned hands. The world actor,
 * authoritative muzzle and other players' poses are never moved by view animation. */
export class FirstPersonView {
 readonly root=new T.Group();private hero:Hero;private weapon:WeaponView;private rig:CombatRig;private motion=new FpsMotion();private swap=new WeaponSwap();
 private arms:FpsArms;private materials=new Set<T.Material>();private previousForward?:T.Vector3;private sway=new T.Vector2();
 private fpsSway=new FpsWeaponSway();private previousTick=-1;
 private forwardScratch=new T.Vector3();private rightScratch=new T.Vector3();private upScratch=new T.Vector3();private swayScratch=new T.Vector2();
 private magazine=new T.Mesh(new T.BoxGeometry(.055,.13,.085),new T.MeshStandardMaterial({color:'#293a3c',metalness:.65,roughness:.4}));
 constructor(data:Map<string,GLTF>,library:EquipmentLibrary,readonly skin:RiderId){
  this.hero=new Hero(data,undefined,skin);this.weapon=new WeaponView(library);this.rig=new CombatRig(this.hero,this.weapon,true);
  // View-only materials preserve the world rider's clothing and shared assets.
  const copies=new Map<T.Material,T.Material>();
  this.hero.root.traverse(o=>{if(!(o instanceof T.Mesh))return;o.castShadow=false;
   const copy=(source:T.Material)=>{let material=copies.get(source);if(!material){material=source.clone();
    if(material instanceof T.MeshStandardMaterial){material.aoMapIntensity=.5;material.envMapIntensity=.9;
     if(/garment|nylon|rubber|glove/i.test(material.name))material.color.multiplyScalar(1.22);
    }copies.set(source,material);this.materials.add(material);}return material;};
   o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);
  });
  this.root.name='First-person hands and weapon';this.root.add(this.hero.root,this.weapon.root,this.magazine);this.arms=new FpsArms(this.hero,this.root);this.root.visible=false;
 }
 pickup(tick:number){this.rig.pickup(tick);}
 resetMotion(){this.previousForward=undefined;this.previousTick=-1;this.sway.set(0,0);this.fpsSway.reset();this.motion.reset();this.swap.reset();}
 update(p:RidePose,state:CombatState,kind:Weapon,tick:number,yaw:number,pitch:number,camera:T.Camera,dt:number,shot:boolean,ads:boolean,reduced:boolean,terrain:TerrainSampler,healingUntil=0,burntwax=true){
  if(this.previousTick>=0&&(tick<this.previousTick||tick-this.previousTick>12))this.resetMotion();this.previousTick=tick;
  this.root.visible=true;this.root.scale.setScalar(1);this.root.position.set(0,0,0);this.root.quaternion.identity();this.root.updateMatrixWorld(true);
  this.hero.apply({...p,seated:0});this.hero.visibility.setFirstPerson(true);this.hero.vehicle.visible=false;
  const equip=this.swap.update(dt,kind,shot,reduced);this.weapon.select(equip.weapon as Weapon);if(shot)this.rig.interruptPickup();if(shot)this.weapon.fire(reduced);this.weapon.update(dt,reduced);this.rig.apply({...p,seated:0},yaw,pitch,state,tick,healingUntil);
  const r=reloadPose(state,tick),m=this.motion.update(dt,kind,shot,Math.abs(p.speed),p.airHeight>.03,ads,reduced,r,p.footMode===2),scale=this.hero.motionScale;
  const f=this.forwardScratch.set(0,0,-1).applyQuaternion(camera.quaternion),right=this.rightScratch.set(1,0,0).applyQuaternion(camera.quaternion),up=this.upScratch.set(0,1,0).applyQuaternion(camera.quaternion);
  const obstacle=terrain.raycastObstacle(camera.position,f,.95,.07),blocked=obstacle===null?0:T.MathUtils.clamp((.95-obstacle)/.6,0,1);
  const bob=burntwax||reduced||ads||p.footMode!==2?0:Math.sin(p.footCycle*Math.PI*2)*Math.min(.012,Math.abs(p.speed)*.003);
  const previous=this.previousForward??f,weight=reduced?0:1-m.aim;
  const lagX=T.MathUtils.clamp(previous.dot(right)*.45,-.022,.022)*weight,lagY=T.MathUtils.clamp(previous.dot(up)*.35,-.016,.016)*weight;
  const sway=this.fpsSway.update(dt,dt>0?previous.dot(right)/dt:0,dt>0?previous.dot(up)/dt:0,p.footCycle,p.speed,p.footMode===2&&p.airHeight<.03,ads,reduced,shot);
  if(burntwax)this.sway.set(sway.x,sway.y);else this.sway.lerp(this.swayScratch.set(lagX,lagY),1-Math.exp(-14*Math.min(.1,dt)));
  if(dt>0)(this.previousForward??=new T.Vector3()).copy(f);
  if(reduced)this.sway.set(0,0);
  // Smaller presentation scale clears the lower corners without changing hitboxes or muzzle authority.
  const wide=T.MathUtils.clamp((((camera as T.PerspectiveCamera).aspect??1)-.45)/.85,0,1),viewScale=.64+.10*wide;
  const target=camera.position.clone().addScaledVector(f,(.80+.01*m.aim-.11*blocked-.045*m.kick)*scale).addScaledVector(right,((1-m.aim)*.20*(.5+.5*wide)+m.run*.07+this.sway.x)*scale)
   .addScaledVector(up,(-(1-m.aim)*.15-.12*r.lower-.26*equip.lower-.14*m.run-.18*blocked-.035*m.land+bob+this.sway.y)*scale);
  const sight=healingUntil>tick?this.hero.arms[0].foot.getWorldPosition(new T.Vector3()).lerp(this.hero.arms[1].foot.getWorldPosition(new T.Vector3()),.5):this.weapon.sight();
  if(healingUntil>tick)target.addScaledVector(up,-.025*scale).addScaledVector(right,-.12*scale);
  const mag=this.weapon.socket(EQUIPMENT_SOCKETS.magazine_socket);
  // A small hip-view cant reveals the camera lens/receiver silhouette, then
  // settles squarely onto the optic. Hands and sockets move as one rigid frame.
  const roll=-(r.lower*.18+m.run*.18+blocked*.24+(reduced?0:.065*(1-m.aim)))+(burntwax?sway.roll:0);this.root.quaternion.setFromAxisAngle(f,roll);
  this.root.scale.setScalar(viewScale);this.root.position.copy(target).sub(sight.clone().multiplyScalar(viewScale).applyQuaternion(this.root.quaternion));this.magazine.position.copy(mag).addScaledVector(up,-r.magazine*.22*scale).addScaledVector(right,-r.magazine*.065*scale);
  this.magazine.quaternion.copy(this.weapon.root.quaternion);this.magazine.scale.setScalar(scale);this.magazine.visible=r.active&&r.magazine>.02;
  this.root.updateMatrixWorld(true);this.arms.update(camera,scale,viewScale);
  const ready=weaponReadyAmount(state,tick);
  const healing=healingUntil>tick;
  if(!healing)this.root.position.addScaledVector(up,-.72*(1-ready)*scale);
  if((ready<=0&&!healing)||p.footMode===3)this.root.visible=false;
  this.root.updateMatrixWorld(true);
  return {reload:r.phase,obstruction:blocked,rigRight:this.rig.errorR,rigLeft:this.rig.errorL};
 }
 hide(){this.root.visible=false;}
 dispose(){this.arms.dispose();this.hero.dispose();this.weapon.dispose();this.magazine.geometry.dispose();this.magazine.material.dispose();for(const m of this.materials)m.dispose();this.root.removeFromParent();}
}
