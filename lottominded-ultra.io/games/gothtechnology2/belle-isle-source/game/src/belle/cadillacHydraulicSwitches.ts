import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {invalidateAnimatedShadow} from '../../runtime/ride-core/src/shadowBudget.ts';
import {HYDRAULIC_SMART_POSES,type HydraulicSmartPose} from './hydraulicController.ts';

export type HydraulicSwitchPickState={riding:boolean;parked:boolean;hydraulicMode:boolean;inside:boolean;blocked:boolean};
type Variant='cadillac'|'hydraulic-cadillac';
type Targets={FL:number;FR:number;RL:number;RR:number};
const poses:HydraulicSmartPose[]=['front-up','back-up','pancake'];
const corners=['FL','FR','RL','RR'] as const;
const MAX_REACH=1.8,FLICK_SECONDS=.30;

/** Measured against the source GLB tunnel surface and the existing cabin eye
 * anchors. A narrow pedestal occupies the gap between the front seats. The
 * switches stay below both eye lines and are within arm's reach of the driver. */
export const CADILLAC_HYDRAULIC_SWITCH_FIT={
 cadillac:{floorY:.374,position:[0,.840,.17] as const},
 'hydraulic-cadillac':{floorY:.395,position:[0,.840,.17] as const},
} as const;
type Switch={pose:HydraulicSmartPose;root:T.Group;lever:T.Group;indicator:T.MeshStandardMaterial;tip:T.Object3D;rest:number;age:number};
function visible(object:T.Object3D){
 for(let node:T.Object3D|null=object;node;node=node.parent)if(!node.visible)return false;
 const material=(object as T.Mesh).material;
 return !material||([] as T.Material[]).concat(material).some(value=>value.visible&&value.opacity>0);
}
function belongs(object:T.Object3D,ancestor:T.Object3D){for(let node:T.Object3D|null=object;node;node=node.parent)if(node===ancestor)return true;return false;}
function merge(parts:T.BufferGeometry[]){const result=mergeGeometries(parts,false);for(const part of parts)part.dispose();if(!result)throw Error('Cadillac switch geometry could not be combined');return result;}
const box=(x:number,y:number,z:number,px=0,py=0,pz=0)=>new T.BoxGeometry(x,y,z).translate(px,py,pz);

/** This class only presents switches and identifies a completed pointer tap.
 * The caller owns trusted input, command acceptance, and hydraulic/audio state.
 * Picking uses the visible cabin meshes, so occupants and trim can occlude it. */
export class CadillacHydraulicSwitches{
 readonly root=new T.Group();
 private readonly switches:Switch[]=[];
 private readonly geometries=new Set<T.BufferGeometry>();
 private readonly materials=new Set<T.Material>();
 private readonly ray=new T.Raycaster();
 private readonly ndc=new T.Vector2();
 private readonly cameraPoint=new T.Vector3();
 private readonly localEye=new T.Vector3();
 private disposed=false;
 private selected:HydraulicSmartPose|null='pancake';
 private readonly chrome=new T.MeshStandardMaterial({name:'Cadillac hydraulic switch chrome',color:0xd8dce0,metalness:1,roughness:.19});
 private readonly black=new T.MeshStandardMaterial({name:'Cadillac hydraulic switch black',color:0x101316,metalness:.12,roughness:.48});

 constructor(private readonly body:T.Object3D,readonly variant:Variant){
  const fit=CADILLAC_HYDRAULIC_SWITCH_FIT[variant];if(!fit)throw Error('Unknown Cadillac switch fit');
  this.root.name='Cadillac_Hydraulic_SwitchBank';this.root.position.fromArray(fit.position);body.add(this.root);
  this.materials.add(this.chrome);this.materials.add(this.black);
  const floor=fit.floorY-fit.position[1],postHeight=-.025-floor-.014;
  const chromeParts=[box(.178,.014,.286,0,-.013,0),box(.084,.012,.14,0,floor+.007,0)];
  const blackParts=[box(.168,.032,.276,0,-.006,0),box(.036,postHeight,.08,0,floor+.014+postHeight/2,0)];
  for(let i=0;i<3;i++){
   const z=(i-1)*.085;
   chromeParts.push(box(.122,.005,.062,0,.013,z));
   blackParts.push(box(.115,.004,.055,0,.017,z));
  }
  this.addMesh(this.root,merge(chromeParts),this.chrome,'Chrome console frame');
  this.addMesh(this.root,merge(blackParts),this.black,'Black console and tunnel mount');
  const stemGeometry=new T.CylinderGeometry(.0045,.006,.044,10,1).translate(0,.022,0);
  const capGeometry=new T.CapsuleGeometry(.011,.017,3,8).translate(0,.050,0);
  const plateGeometry=box(.114,.004,.054);
  const indicatorGeometry=box(.009,.003,.014);
  for(const geometry of [stemGeometry,capGeometry,plateGeometry,indicatorGeometry])this.geometries.add(geometry);
  for(const [i,pose]of poses.entries()){
   const root=new T.Group();root.name='Cadillac_Hydraulic_Switch_'+pose;root.position.set(0,.020,(i-1)*.085);this.root.add(root);
   // The visible rectangular face is also part of the clickable switch. There
   // are no invisible hitboxes extending through neighbouring cabin geometry.
   this.addMesh(root,plateGeometry,this.black,'Switch face · '+pose);
   const lever=new T.Group();lever.name='Toggle lever · '+pose;root.add(lever);
   this.addMesh(lever,stemGeometry,this.chrome,'Chrome toggle · '+pose);
   this.addMesh(lever,capGeometry,this.black,'Black toggle grip · '+pose);
   const indicator=new T.MeshStandardMaterial({name:'Hydraulic switch indicator · '+pose,color:0xd6ab58,emissive:0xd6ab58,emissiveIntensity:pose==='pancake'?.38:.025,metalness:.65,roughness:.32});
   this.materials.add(indicator);const light=this.addMesh(root,indicatorGeometry,indicator,'Hydraulic switch lamp · '+pose);light.position.set(-.041,.004,0);
   const tip=new T.Object3D();tip.name='Hydraulic switch aim · '+pose;tip.position.set(0,.050,0);lever.add(tip);
   const rest=pose==='pancake'?-.28:.16;lever.rotation.z=rest;
   this.switches.push({pose,root,lever,indicator,tip,rest,age:FLICK_SECONDS});
  }
 }
 private addMesh(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,name:string){
  this.geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 pick(camera:T.Camera,point:{x:number;y:number},state:HydraulicSwitchPickState):HydraulicSmartPose|null{
  if(this.disposed||!state.riding||!state.parked||!state.hydraulicMode||!state.inside||state.blocked||!visible(this.root)||!(camera as T.PerspectiveCamera).isPerspectiveCamera)return null;
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>1||Math.abs(point.y)>1)return null;
  camera.updateWorldMatrix(true,false);this.body.updateWorldMatrix(true,true);
  if(!camera.matrixWorld.elements.every(Number.isFinite)||!camera.projectionMatrix.elements.every(Number.isFinite))return null;
  camera.getWorldPosition(this.cameraPoint);this.localEye.copy(this.cameraPoint);this.body.worldToLocal(this.localEye);
  // A falsely labelled exterior perspective must not click through a window.
  if(Math.abs(this.localEye.x)>.86||this.localEye.y<.65||this.localEye.y>1.50||this.localEye.z< -1.65||this.localEye.z>1.02)return null;
  this.ndc.set(point.x,point.y);this.ray.setFromCamera(this.ndc,camera);this.ray.near=.01;this.ray.far=MAX_REACH;
  const target=this.ray.intersectObjects(this.switches.map(item=>item.root),true).find(hit=>visible(hit.object));
  if(!target||target.distance>MAX_REACH)return null;
  const control=this.switches.find(item=>belongs(target.object,item.root));if(!control)return null;
  // Raycast the real body (including its seated occupants) only on a tap. The
  // animation loop never scans source meshes or performs intersection queries.
  this.ray.far=target.distance+.001;
  const first=this.ray.intersectObject(this.body,true).find(hit=>visible(hit.object));
  return first&&belongs(first.object,control.root)?control.pose:null;
 }
 syncTargets(targets:Targets){
  if(this.disposed||!corners.every(corner=>Number.isFinite(targets[corner])))return;
  const next=poses.find(pose=>corners.every(corner=>Math.abs(targets[corner]-HYDRAULIC_SMART_POSES[pose][corner])<.002))??null;
  if(next===this.selected)return;this.selected=next;
  for(const item of this.switches){item.rest=item.pose===next?-.28:.16;item.indicator.emissiveIntensity=item.pose===next?.38:.025;}
 }
 trigger(pose:HydraulicSmartPose,reduced=false){
  if(this.disposed)return false;const item=this.switches.find(control=>control.pose===pose);if(!item)return false;
  item.age=reduced?FLICK_SECONDS:0;this.update(0,reduced);return true;
 }
 update(seconds:number,reduced=false){
  if(this.disposed)return;const dt=T.MathUtils.clamp(Number.isFinite(seconds)?seconds:0,0,.1);let moved=false;
  for(const item of this.switches){
   item.age=reduced?FLICK_SECONDS:Math.min(FLICK_SECONDS,item.age+dt);
   const flick=item.age<FLICK_SECONDS?Math.sin(Math.PI*item.age/FLICK_SECONDS)*.48:0;
   const desired=item.rest-flick,next=reduced?desired:T.MathUtils.lerp(item.lever.rotation.z,desired,1-Math.exp(-dt*28));
   const angle=Math.abs(next-desired)<.0001?desired:next;
   if(Math.abs(angle-item.lever.rotation.z)>1e-8){item.lever.rotation.z=angle;moved=true;}
  }
  if(moved)invalidateAnimatedShadow(this.root);
 }
 reset(){if(this.disposed)return;for(const item of this.switches)item.age=FLICK_SECONDS;this.syncTargets({FL:0,FR:0,RL:0,RR:0});this.update(0,true);}
 diagnostics(){
  this.root.updateWorldMatrix(true,true);let triangles=0,meshes=0;this.root.traverse(object=>{const mesh=object as T.Mesh;if(mesh.isMesh){meshes++;triangles+=(mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;}});
  return{variant:this.variant,activePose:this.selected,maxReachMetres:MAX_REACH,meshes,triangles,texturesAdded:0,geometries:this.geometries.size,materials:this.materials.size,
   switches:this.switches.map(item=>({pose:item.pose,angle:item.lever.rotation.z,world:item.tip.getWorldPosition(new T.Vector3()).toArray(),moving:item.age<FLICK_SECONDS||Math.abs(item.lever.rotation.z-item.rest)>.0001}))};
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.root.removeFromParent();for(const geometry of this.geometries)geometry.dispose();for(const material of this.materials)material.dispose();this.geometries.clear();this.materials.clear();}
}
