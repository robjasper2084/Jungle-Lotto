import {batchRigidChildren} from './batchRigid.ts';
import {HoverControls} from '../hoverControls.ts';
import * as T from 'three';
import {DefaultLoadingManager} from 'three';
import {createVehicleContactShadow} from '../contactShadow.ts';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {solveLimb} from '../../../runtime/ride-core/src/limbIK.ts';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {ThreeRiderView} from '../../../runtime/elmwood-source/src/detroit/riding/threeRiderView.ts';
import {riderProfile,PairSimulation} from './simulation.ts';
import {assignPlayer,SOURCE_REVISION,type PlayerManifest,type PreparedActor} from './coop.ts';

const REQUIRED_BONES=['Hips','Head','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'];
export function riderSourceURL(manifest:PlayerManifest){
 const m=assignPlayer(manifest.seat,manifest);
 return 'https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/'+SOURCE_REVISION+'/'+m.rider.sourcePath;
}
/** Runtime integrity validation applies to the exact committed bytes, not user URLs. */
export async function verifyRiderBytes(bytes:ArrayBuffer,blob:string){
 if(bytes.byteLength<20||bytes.byteLength>64*1024*1024)throw new Error('The selected rider file is incomplete or too large.');
 const header=new DataView(bytes),decode=new TextDecoder();
 if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength||header.getUint32(16,true)!==0x4e4f534a)throw new Error('The selected rider is not a complete GLB.');
 const n=header.getUint32(12,true);if(n%4||n>bytes.byteLength-20)throw new Error('Invalid rider model metadata.');
 const metadata=JSON.parse(decode.decode(new Uint8Array(bytes,20,n)));
 if(!Array.isArray(metadata.skins)||!metadata.skins.length)throw new Error('The selected rider has no usable skeleton.');
 for(const resource of [...(metadata.images??[]),...(metadata.buffers??[])])if(resource.uri&&!String(resource.uri).startsWith('data:'))throw new Error('Rider textures must be embedded in the approved GLB.');
 const prefix=new TextEncoder().encode('blob '+bytes.byteLength+'\0'),payload=new Uint8Array(prefix.length+bytes.byteLength);payload.set(prefix);payload.set(new Uint8Array(bytes),prefix.length);
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',payload))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(digest!==blob)throw new Error('The selected rider does not match its approved source.');
 return metadata;
}
function freeSource(asset:GLTF){
 const materials=new Set<T.Material>(),textures=new Set<T.Texture>(),geometries=new Set<T.BufferGeometry>();
 asset.scene.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);});
 for(const m of materials){for(const v of Object.values(m))if(v instanceof T.Texture)textures.add(v);m.dispose();}
 for(const t of textures)t.dispose();for(const g of geometries)g.dispose();
}
export class CoopAssets{
 private cache=new Map<string,Promise<GLTF>>();
 private assets=new Set<GLTF>();
 private closed=false;
 private hoverTask?:Promise<GLTF>;
 async hover(signal:AbortSignal){if(!this.hoverTask)this.hoverTask=(async()=>{const url=DefaultLoadingManager.resolveURL(new URL('./belle/vehicles/hero-hoverbike.glb',document.baseURI).href);
   const response=await fetch(url,{signal,credentials:'omit'});
   if(!response.ok)throw new Error('Hoverbike could not load (HTTP '+response.status+').');const asset=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');if(this.closed||signal.aborted){freeSource(asset);throw new Error('Hoverbike preparation cancelled.');}this.assets.add(asset);return asset;})();return this.hoverTask;}
 async rider(manifest:PlayerManifest,signal:AbortSignal):Promise<GLTF>{
  if(this.closed||signal.aborted)throw signal.reason??new Error('Rider preparation cancelled.');
  let task=this.cache.get(manifest.riderId);
  if(!task){
   task=(async()=>{
    const response=await fetch(riderSourceURL(manifest),{signal,credentials:'omit'});
    if(!response.ok)throw new Error('The selected rider could not download (HTTP '+response.status+').');
    const bytes=await response.arrayBuffer();await verifyRiderBytes(bytes,manifest.rider.blob);
    if(signal.aborted||this.closed)throw signal.reason??new Error('Rider preparation cancelled.');
    const asset=await new GLTFLoader().parseAsync(bytes,'');
    if(signal.aborted||this.closed){freeSource(asset);throw signal.reason??new Error('Rider preparation cancelled.');}
    for(const name of REQUIRED_BONES)if(!asset.scene.getObjectByName(name)){freeSource(asset);throw new Error('The selected rider is missing '+name+'.');}
    this.assets.add(asset);return asset;
   })();this.cache.set(manifest.riderId,task);
  }
  return task;
 }
 dispose(){this.closed=true;for(const asset of this.assets)freeSource(asset);this.assets.clear();this.cache.clear();}
}
export type RenderActor=PreparedActor&{manifest:PlayerManifest;view:ThreeRiderView;root:T.Group;apply:(seconds:number)=>void;camera:T.PerspectiveCamera;firstPerson:boolean;yaw:number;pitch:number;snap:boolean;footError:()=>number};
export function createRenderActor(manifest:PlayerManifest,rider:GLTF,wheel:GLTF,simulation:PairSimulation,hoverAsset?:GLTF):RenderActor{
 const ownedMaterials=new Set<T.Material>();
 // Vehicle lights mutate material values; isolate materials but reuse immutable mesh data.
 const vehicle=wheel.scene.clone(true);
 vehicle.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;const clone=(m:T.Material)=>{const c=m.clone();ownedMaterials.add(c);return c;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);});
 const core=simulation.actors[manifest.seat];
 const view=new ThreeRiderView(rider,{...wheel,scene:vehicle},simulation.terrain,riderProfile(manifest.riderId));
 view.root.name='Co-op Player '+(manifest.seat+1)+' · '+manifest.riderId;view.root.userData.coopSeat=manifest.seat;
 view.apply(core.renderPose);view.root.updateMatrixWorld(true);
 const root=new T.Group();root.name=view.root.name;root.add(view.root);
 const contact=createVehicleContactShadow(root,simulation.terrain);contact.setQuality('smooth');
 const hover=hoverAsset?cloneSkeleton(hoverAsset.scene):undefined;
 if(hover){hover.name='Co-op hoverbike '+(manifest.seat+1);hover.getObjectByName('HeroRoot')?.removeFromParent();hover.traverse(o=>{if(o.name==='Hero_FPVArms')o.visible=false;});hover.scale.multiplyScalar(view.motionScale);root.add(hover);}
 const controls=hover?new HoverControls(hover):undefined;
 const batches=hover?batchRigidChildren(hover,new Set(hoverAsset?.animations.flatMap(a=>a.tracks.map(t=>t.name.split('.')[0])))):undefined;
 const rotors:T.Object3D[]=[];hover?.traverse(o=>{if(o.name.startsWith('Rotor_'))rotors.push(o);});
 const target=new T.Vector3(),pole=new T.Vector3(),hip=new T.Vector3(),q=new T.Quaternion();
 const grips=hover?[hover.getObjectByName('Grip_L')!,hover.getObjectByName('Grip_R')!]:[];
 const feet=hover?[hover.getObjectByName('Foot_L')!,hover.getObjectByName('Foot_R')!]:[];
 const seatAnchor=hover?.getObjectByName('SeatAnchor');
 const bindTargets=(limbs:typeof view.arms,anchors:T.Object3D[])=>limbs.map(l=>anchors.slice().sort((a,b)=>l.upper.getWorldPosition(target).distanceToSquared(a.getWorldPosition(hip))-l.upper.getWorldPosition(target).distanceToSquared(b.getWorldPosition(hip)))[0]);
 let armTargets:T.Object3D[]|undefined,legTargets:T.Object3D[]|undefined;
 const apply=(seconds:number)=>{
  view.apply(core.renderPose);
  const groundPose=core.renderPose;contact.update({x:groundPose.x,y:groundPose.y,z:groundPose.z,heading:groundPose.headingY,vehicle:hover&&simulation.mounted[manifest.seat]?'hoverbike':'onewheel'});
  if(!hover)return;
  const flight=simulation.hovers[manifest.seat]!,p=flight.pose;
  controls?.update(seconds,flight.drive);
  rotors.forEach((r,i)=>r.rotateY(Math.min(.05,Math.max(0,seconds))*p.rpm*(i%2?-1:1)*32));
  hover.position.set(p.x,p.y,p.z);hover.rotation.set(p.pitch,p.heading,p.roll,'YXZ');hover.updateMatrixWorld(true);
  view.vehicle.visible=false;
  if(!simulation.mounted[manifest.seat]||!view.hips||!seatAnchor)return;
  // The selected hero uses the bike's authored contact sockets, not a scaled duplicate rider.
  view.root.updateMatrixWorld(true);seatAnchor.getWorldPosition(hip);hip.y+=.10*view.motionScale;
  view.hips.position.copy(view.hips.parent!.worldToLocal(hip));view.root.updateMatrixWorld(true);
  armTargets??=bindTargets(view.arms,grips);legTargets??=bindTargets(view.legs,feet);
  view.arms.forEach((limb,i)=>{armTargets![i].getWorldPosition(target);pole.set(i===0?1:-1,-.3,-.35).applyAxisAngle(T.Object3D.DEFAULT_UP,p.heading);solveLimb(limb,target,pole,undefined,.98);});
  view.legs.forEach((limb,i)=>{legTargets![i].getWorldPosition(target);pole.set(i===0?.3:-.3,.2,1).applyAxisAngle(T.Object3D.DEFAULT_UP,p.heading);solveLimb(limb,target,pole,view.root.getWorldQuaternion(q).multiply(limb.rotation),.98);});
  view.root.updateMatrixWorld(true);
 };
 let disposed=false;
 const actor:RenderActor={manifest,identity:view.rider,view,root,apply,camera:new T.PerspectiveCamera(62,1,.08,22000),firstPerson:false,yaw:0,pitch:.12,snap:true,
  footError:()=>Math.max(...view.legs.map((l,i)=>l.foot.getWorldPosition(new T.Vector3()).distanceTo(view.footTarget(i,core.renderPose)))),
  validate:()=>view.legs.length===2&&view.arms.length===2&&view.bones.length>=24&&Number.isFinite(actor.footError())&&(hoverAsset?!!seatAnchor&&grips.every(Boolean)&&feet.every(Boolean):actor.footError()<.12),
  dispose:()=>{if(disposed)return;disposed=true;root.removeFromParent();batches?.dispose();controls?.dispose();contact.dispose();view.dispose();for(const m of ownedMaterials)m.dispose();}
 };
 return actor;
}
