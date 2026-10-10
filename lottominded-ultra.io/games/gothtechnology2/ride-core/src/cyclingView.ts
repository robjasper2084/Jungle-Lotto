import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import type {RidePose} from './controller.ts';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CyclistMotion,RiderCadence} from './cyclistMotion.ts';
import {curlHandlebarHands,handlebarHandRotation,HANDLEBAR_WRIST_OFFSET} from './handlebarGrip.ts';
import type {CommunityRide} from './communityRide.ts';
export const BIKE_STYLES=[{name:'Teal city',color:0x18c4b0,accent:0xf7d568},{name:'Coral commuter',color:0xf36a56,accent:0x89dcf3},{name:'Golden cruiser',color:0xffc52f,accent:0x773ee3},{name:'Violet touring',color:0x9758df,accent:0xa5ef54},{name:'Sky blue road',color:0x43aaff,accent:0xff92bb},{name:'Lime trail',color:0xa0d73a,accent:0xff7852}] as const;
const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
type Limb={a:T.Object3D;b:T.Object3D;c:T.Object3D;rotation:T.Quaternion;side:number};
function point(a:T.Object3D,b:T.Object3D,target:T.Vector3){const from=a.getWorldPosition(v()),rotation=a.getWorldQuaternion(q()).premultiply(q().setFromUnitVectors(b.getWorldPosition(v()).sub(from).normalize(),target.clone().sub(from).normalize()));a.quaternion.copy(a.parent!.getWorldQuaternion(q()).invert().multiply(rotation));a.updateWorldMatrix(false,true);}
function ik(l:Limb,target:T.Vector3,pole:T.Vector3,rotation:T.Quaternion){const a=l.a.getWorldPosition(v()),b=l.b.getWorldPosition(v()),c=l.c.getWorldPosition(v()),l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a),d=Math.max(.02,Math.min(dir.length(),l1+l2-.001));dir.normalize();pole.addScaledVector(dir,-pole.dot(dir)).normalize();const along=(l1*l1+d*d-l2*l2)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));point(l.a,l.b,a.clone().addScaledVector(dir,along).addScaledVector(pole,bend));point(l.b,l.c,a.clone().addScaledVector(dir,d));l.c.quaternion.copy(l.c.parent!.getWorldQuaternion(q()).invert().multiply(rotation));l.c.updateWorldMatrix(false,true);}
export function styleCyclist(bike:T.Object3D,rider:T.Object3D,style:number,npc=true){
  style=Math.abs(style)%BIKE_STYLES.length;const materials:T.Material[]=[],geometry:T.BufferGeometry[]=[];
    // Every clone shares immutable geometry; remove only the unused frame nodes.
    // Legacy single-frame exports remain valid as the loading fallback.
    const unused:T.Object3D[]=[];
    bike.traverse(o=>{const variant=/^BikeStyle(?:Front)?_(\d+)$/.exec(o.name);if(variant&&Number(variant[1])!==style)unused.push(o);});
    unused.forEach(o=>o.removeFromParent());
    const palette=BIKE_STYLES[style];
    if(style===4||style===5)bike.traverse(o=>{if(/^(Front|Rear)_Tire$/.test(o.name))o.scale.x*=style===5?1.7:.75;});
    const tinted=new Map<T.Material,T.Material>();
    bike.traverse(o=>{const m=o as T.Mesh;if(!m.isMesh)return;const color=(material:T.Material)=>{const existing=tinted.get(material);if(existing)return existing;const c=material.clone() as T.MeshStandardMaterial;materials.push(c);tinted.set(material,c);if(c.name.includes('Graphite_Paint'))c.color.setHex(palette.color);if(c.name.includes('Ochre'))c.color.setHex(palette.accent);return c;};m.material=Array.isArray(m.material)?m.material.map(color):color(m.material);});
    // Reuse texture detail, with separate skin/clothing masks derived from the rig.
    if(npc)rider.traverse(o=>{const m=o as T.SkinnedMesh;if(!m.isSkinnedMesh)return;const geo=m.geometry.clone();geometry.push(geo);m.geometry=geo;const index=geo.getAttribute('skinIndex'),weight=geo.getAttribute('skinWeight'),mask=new Float32Array(index.count*2);
      for(let i=0;i<index.count;i++)for(let j=0;j<4;j++){const bone=m.skeleton.bones[index.getComponent(i,j)]?.name??'',w=weight.getComponent(i,j);if(/Head|Neck|Hand|Finger|Thumb/.test(bone))mask[i*2]+=w;else if(/Spine|Arm|ForeArm/.test(bone))mask[i*2+1]+=w;}
      geo.setAttribute('riderTint',new T.BufferAttribute(mask,2));const source=(Array.isArray(m.material)?m.material[0]:m.material) as T.MeshStandardMaterial,mat=source.clone();materials.push(mat);m.material=mat;mat.emissive.setHex(0);mat.emissiveMap=null;mat.roughness=.88;
      const skin=new T.Color([0x633c28,0xe3b499,0x85543a,0xf0c7b0,0x493020,0xc69270][style]);const shirt=new T.Color([0x32bba7,0xdb4c65,0x496ecc,0xe6a52d,0x8b50bf,0x48a675][style]);
      mat.onBeforeCompile=shader=>{shader.uniforms.rideSkin={value:skin};shader.uniforms.rideShirt={value:shirt};shader.vertexShader='attribute vec2 riderTint; varying vec2 rideTint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrideTint=riderTint;');shader.fragmentShader='uniform vec3 rideSkin; uniform vec3 rideShirt; varying vec2 rideTint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float lightness=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
        float skinMask=smoothstep(.2,.7,rideTint.x)*smoothstep(.055,.18,lightness)*smoothstep(.005,.065,diffuseColor.r-diffuseColor.b);
        diffuseColor.rgb=mix(diffuseColor.rgb,rideSkin*(.65+lightness*.6),skinMask);
        diffuseColor.rgb=mix(diffuseColor.rgb,rideShirt*(.45+lightness*.8),smoothstep(.45,.9,rideTint.y)*.78);`);};mat.customProgramCacheKey=()=> 'community-skin-shirt-v1';
    });
    const accessory=new T.MeshStandardMaterial({color:palette.accent,roughness:.72});materials.push(accessory);
    const box=(w:number,h:number,d:number,x:number,y:number,z:number)=>{const g=new T.BoxGeometry(w,h,d);geometry.push(g);const m=new T.Mesh(g,accessory);m.position.set(x,y,z);bike.add(m);};
    if(style===0){
      // Open wire basket: one draw call, rounded rim, visible gaps instead of solid slabs.
      const bars:T.BufferGeometry[]=[];
      const bar=(w:number,h:number,d:number,x:number,y:number,z:number)=>bars.push(new T.BoxGeometry(w,h,d).translate(x,y-.12,z));
      for(const y of [1.10,1.29]){for(const x of [-.21,.21])bar(.008,.009,.34,x,y,.63);for(const z of [.46,.8])bar(.42,.009,.008,0,y,z);}
      for(let j=0;j<=8;j++){const x=-.21+j*.0525;for(const z of [.46,.8])bar(.005,.19,.005,x,1.195,z);bar(.005,.005,.34,x,1.10,.63);}
      for(let j=1;j<6;j++)for(const x of [-.21,.21])bar(.005,.19,.005,x,1.195,.46+j*.34/6);
      for(const x of [-.13,.13]){bar(.013,.013,.12,x,1.16,.41);bar(.013,.08,.013,x,1.125,.46);}
      const g=mergeGeometries(bars);bars.forEach(b=>b.dispose());geometry.push(g);const basket=new T.Mesh(g,accessory);basket.name='City wire basket';bike.add(basket);bike.updateWorldMatrix(true,true);bike.getObjectByName('Bicycle_Steering_Pivot')?.attach(basket);
    }
    if(style%3===1){box(.35,.022,.34,0,.8,-.67);const fabric=new T.MeshStandardMaterial({color:palette.accent,roughness:.95});fabric.color.multiplyScalar(.4);materials.push(fabric);for(const x of [-.2,.2]){const g=new RoundedBoxGeometry(.12,.27,.3,2,.035);geometry.push(g);const bag=new T.Mesh(g,fabric);bag.position.set(x,.64,-.67);bike.add(bag);box(.125,.025,.24,x,.72,-.67);}}
    if(style%3===2){const g=new T.CylinderGeometry(.045,.045,.2,8);geometry.push(g);const bottle=new T.Mesh(g,accessory);bottle.position.set(0,.54,.08);bottle.rotation.x=-.3;bike.add(bottle);}

  return ()=>{materials.forEach(m=>m.dispose());geometry.forEach(g=>g.dispose());};
}

/** Fits the original articulated humans to measured saddle, crank and steering sockets. */
export class BicycleView {
  root=new T.Group();frame=new T.Group();bike:T.Object3D;rider:T.Object3D;head?:T.Object3D;hips:T.Object3D;
  private bones:{o:T.Object3D;p:T.Vector3;q:T.Quaternion}[]=[];private legs:Limb[]=[];private arms:Limb[]=[];
  private steering:T.Object3D;private steerRest:T.Quaternion;private crank:T.Object3D;private cleanup:()=>void;
  private disposeHands:()=>void;
  readonly style:number;private restSole=.065;private lean=.55;private spine?:T.Object3D;private neck?:T.Object3D;
  constructor(bicycle:GLTF,human:GLTF,style=0,npc=false){
    this.lean=npc?.5:.9;this.restSole=npc?.10:.065;this.style=style%BIKE_STYLES.length;this.bike=bicycle.scene.clone(true);this.rider=clone(human.scene);this.root.name='Bicycle · '+BIKE_STYLES[this.style].name;this.root.add(this.frame);this.frame.add(this.bike,this.rider);
    this.steering=this.bike.getObjectByName('Bicycle_Steering_Pivot')!;this.steerRest=this.steering.quaternion.clone();this.crank=this.bike.getObjectByName('Bicycle_Crank_Pivot')!;
    if(npc&&human.animations.length){const mixer=new T.AnimationMixer(this.rider);mixer.clipAction(human.animations[0]).play();mixer.setTime(0);}
    this.root.updateMatrixWorld(true);this.hips=this.rider.getObjectByName('Hips')!;this.head=this.rider.getObjectByName('Head');
    if(!this.hips||!this.steering||!this.crank)throw Error('The bicycle or rider rig is missing its fitted pivots.');
    this.rider.traverse(o=>{if((o as T.Bone).isBone)this.bones.push({o,p:o.position.clone(),q:o.quaternion.clone()});});
    for(const side of ['Left','Right'])for(const arm of [false,true]){const a=this.rider.getObjectByName(side+(arm?'Arm':'UpLeg')),b=this.rider.getObjectByName(side+(arm?'ForeArm':'Leg')),c=this.rider.getObjectByName(side+(arm?'Hand':'Foot'));if(!a||!b||!c)throw Error('This rider has no bicycle fit.');(arm?this.arms:this.legs).push({a,b,c,rotation:c.getWorldQuaternion(q()),side:Math.sign(this.rider.worldToLocal(c.getWorldPosition(v())).x)||1});}
    this.spine=this.rider.getObjectByName('Spine02');this.neck=this.rider.getObjectByName('Neck');
    this.cleanup=styleCyclist(this.bike,this.rider,this.style,npc);
    this.disposeHands=curlHandlebarHands(this.rider);
    this.root.traverse(o=>{const m=o as T.Mesh;if(m.isMesh){m.castShadow=!npc;m.receiveShadow=true;m.frustumCulled=!(m as T.SkinnedMesh).isSkinnedMesh;}});
  }
  apply(p:RidePose,steering=0,pedals=0){
    this.root.position.set(p.x,p.y+.008,p.z);this.root.rotation.y=p.headingY;this.frame.rotation.set(p.groundPitch,0,p.rollAngle);this.frame.updateMatrixWorld(true);
    this.steering.quaternion.copy(this.steerRest).multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering));this.crank.rotation.x=pedals;
    for(const name of ['Bicycle_Pedal_L_Pivot','Bicycle_Pedal_R_Pivot']){const o=this.bike.getObjectByName(name);if(o)o.rotation.x=-pedals;}
    for(const name of ['Bicycle_Front_Wheel_Pivot','Bicycle_Rear_Wheel_Pivot']){const o=this.bike.getObjectByName(name);if(o)o.rotation.x=p.wheelSpin;}
    for(const b of this.bones){b.o.position.copy(b.p);b.o.quaternion.copy(b.q);}this.rider.position.set(0,0,0);this.root.updateMatrixWorld(true);
    const effort=Math.max(0,p.driveIntent)*(1-p.stopFoot),brake=Math.max(0,p.brakeAmount),bank=Math.max(-.42,Math.min(.42,p.rollAngle));
    const pulse=Math.sin(pedals*2)*.007*effort,settle=Math.min(.035,Math.abs(p.riderPitch)*.08);
    const hips=this.frame.localToWorld(new T.Vector3(-bank*.045,1.07-p.stopFoot*.08-pulse-settle,-.25+p.stopFoot*.12-brake*.035));this.hips.position.copy(this.hips.parent!.worldToLocal(hips));this.root.updateMatrixWorld(true);
    const right=new T.Vector3(1,0,0).transformDirection(this.frame.matrixWorld),forward=new T.Vector3(0,0,1).transformDirection(this.frame.matrixWorld);
    const spine=this.spine;if(spine){
      const rest=spine.getWorldQuaternion(q()),parent=spine.parent!.getWorldQuaternion(q()).invert();
      let pitch=this.lean+effort*.055-brake*.10-p.stopFoot*.18+p.groundPitch*.2;
      // Lean from the saddle until both grips are reachable. Limb lengths never change.
      for(let attempt=0;attempt<8;attempt++){
        spine.quaternion.copy(parent).multiply(q().setFromAxisAngle(right,pitch).multiply(rest));spine.updateWorldMatrix(false,true);
        let excess=0;
        for(const arm of this.arms){const shoulder=arm.a.getWorldPosition(v()),elbow=arm.b.getWorldPosition(v()),hand=arm.c.getWorldPosition(v());
          const grip=this.bike.getObjectByName(arm.side>0?'Grip001':'Grip')??this.bike.getObjectByName(arm.side>0?'Grip.001':'Grip')!;
          const wrist=grip.getWorldPosition(v()).add(HANDLEBAR_WRIST_OFFSET.clone().applyQuaternion(this.frame.getWorldQuaternion(q()).multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering))));
          excess=Math.max(excess,shoulder.distanceTo(wrist)-shoulder.distanceTo(elbow)-elbow.distanceTo(hand)+.055);}
        if(excess<=0)break;pitch=Math.min(1.4,pitch+Math.min(.12,excess*2));
      }
    }
    if(this.neck){this.neck.quaternion.multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering*.22+p.riderLookYaw));this.neck.updateWorldMatrix(false,true);}
    const frameQ=this.frame.getWorldQuaternion(q());
    for(let i=0;i<2;i++){
      const side=this.legs[i].side,phase=pedals+(side>0?Math.PI:0),foot=new T.Vector3(side*.13,.33-.165*Math.cos(phase)+this.restSole,-.13-.165*Math.sin(phase));
      if(!i)foot.lerp(new T.Vector3(side*.28,this.restSole,-.1),p.stopFoot);
      ik(this.legs[i],this.frame.localToWorld(foot),forward.clone(),frameQ.clone().multiply(this.legs[i].rotation));
      const grip=this.bike.getObjectByName(side>0?'Grip001':'Grip')??this.bike.getObjectByName(side>0?'Grip.001':'Grip')!;
      const barRotation=frameQ.clone().multiply(q().setFromAxisAngle(new T.Vector3(0,1,0),steering));
      const wrist=grip.getWorldPosition(v()).add(HANDLEBAR_WRIST_OFFSET.clone().applyQuaternion(barRotation));
      ik(this.arms[i],wrist,forward.clone().multiplyScalar(-1).addScaledVector(right,side*(.3+effort*.08+brake*.10)+bank*.16),barRotation.multiply(handlebarHandRotation(side)));
    }
    this.root.updateMatrixWorld(true);
  }
  dispose(){this.root.removeFromParent();this.cleanup();this.disposeHands();const skeletons=new Set<T.Skeleton>();this.rider.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)skeletons.add((o as T.SkinnedMesh).skeleton);});skeletons.forEach(s=>s.dispose());}
}

export class CommunityView {
  root=new T.Group();views:BicycleView[]=[];private marker:T.Mesh;private markerMaterial:T.MeshBasicMaterial;private cadence=new RiderCadence();private motions:CyclistMotion[]=[];private clock=0;
  readonly ride:CommunityRide;
  constructor(ride:CommunityRide,assets:Map<string,GLTF>){
    this.ride=ride;
    this.root.name='Local community ride';this.motions=ride.riders.map((_,i)=>new CyclistMotion(i));this.views=ride.riders.map((_,i)=>{const view=new BicycleView(assets.get('DS_Bicycle_01')!,assets.get('DS_Cyclist_01')!,i,true);this.root.add(view.root);return view;});
    this.markerMaterial=new T.MeshBasicMaterial({color:0xf2cf70,side:T.DoubleSide,transparent:true,opacity:.8,depthWrite:false});this.marker=new T.Mesh(new T.RingGeometry(1.1,1.25,32),this.markerMaterial);this.marker.rotation.x=-Math.PI/2;this.root.add(this.marker);
  }
  update(visible:boolean,dt=1/60,observer?:{x:number;z:number}){
    this.root.visible=visible&&this.ride.stage!=='cleanup';
    if(!this.root.visible){return;}
    this.clock+=dt;this.ride.riders.forEach((r,i)=>{
      const view=this.views[i],distance=observer?Math.hypot(r.x-observer.x,r.z-observer.z):0;
      view.root.visible=distance<140;if(!view.root.visible)return;
      // Translation stays frame-smooth; only distant skeletal fitting runs less often.
      const motion=this.motions[i],pose=motion.step(dt,r);
      if(this.cadence.due(i,dt,distance)){
        view.apply(pose,motion.steering,motion.pedals);
      }else{view.root.position.set(r.x,r.y+.008,r.z);view.root.rotation.y=pose.headingY;}
    });
    const at=this.ride.route.at(this.ride.gates[this.ride.nextGate]??this.ride.route.length);
    this.marker.position.set(at.x,this.ride.terrain.sampleGround(at.x,at.z,{height:0,normal:{x:0,y:1,z:0},surface:'pavement',offCourse:false}).height+.055,at.z);this.marker.visible=this.ride.joined;
  }
  dispose(){this.views.forEach(v=>v.dispose());this.marker.geometry.dispose();this.markerMaterial.dispose();this.root.removeFromParent();}
}


export {CyclingSession} from './cyclingSession.ts';
export {CyclistMotion} from './cyclistMotion.ts';

export {AmbientCyclistPacks,cyclistCircuit,packStarts,AMBIENT_CYCLIST_PACE} from './ambientCyclists.ts';
