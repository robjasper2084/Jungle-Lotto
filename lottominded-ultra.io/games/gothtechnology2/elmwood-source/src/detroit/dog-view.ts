import * as T from 'three';
import type {GLTF} from './compressedGLTFLoader.ts';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import type {DogCompanion} from './companion.ts';

export class DogView {
  root=new T.Group();model:T.Object3D;mixer:T.AnimationMixer;
  private ground=new T.Group();private actions:T.AnimationAction[];private weights=[1,0,0];
  private phase=0;private seated?:T.AnimationAction;private lying?:T.AnimationAction;
  private accents:{node:T.Object3D;base:T.Quaternion;kind:string}[]=[];
  private supports:{mesh:T.SkinnedMesh;indices:number[]}[]=[];
  private supportPoint=new T.Vector3();private supportMatrix=new T.Matrix4();private groundInverse=new T.Matrix4();
  private supportAge=1;private supportSit=-1;private supportLie=-1;private supportLift=0;
  gait='idle';
  constructor(asset:GLTF,coat:'fawn'|'chestnut'='fawn'){
    this.model=clone(asset.scene);this.root.name='Digital Static Boerboel companion';
    this.root.add(this.ground);this.ground.add(this.model);
    this.model.traverse(o=>{const m=o as T.Mesh;if(m.isMesh){m.castShadow=m.receiveShadow=true;m.frustumCulled=false;if(coat==='chestnut'){const tint=(original:T.Material)=>{const material=original.clone() as T.MeshStandardMaterial;if(material.color)material.color.multiply(new T.Color('#cfa17c'));return material;};m.material=Array.isArray(m.material)?m.material.map(tint):tint(m.material);}}});
    this.mixer=new T.AnimationMixer(this.model);
    this.actions=['Dog_Idle','Dog_Trot','Dog_Run'].map(name=>{
      const clip=asset.animations.find(c=>c.name===name);if(!clip)throw new Error('Missing companion animation: '+name);
      const fixed=clip.clone();fixed.tracks=fixed.tracks.filter(t=>!t.name.startsWith('tail.'));
      return this.mixer.clipAction(fixed).setEffectiveWeight(name==='Dog_Idle'?1:0).play();
    });
    this.mixer.update(0);
    for(const [name,key]of [['Dog_Sit','seated'],['Dog_Down','lying']] as const){const clip=asset.animations.find(c=>c.name===name);if(clip){const fixed=clip.clone();fixed.tracks=fixed.tracks.filter(t=>!t.name.startsWith('tail.'));this[key]=this.mixer.clipAction(fixed).setEffectiveWeight(0).play();}}
    for(const kind of ['head','jaw']){const node=this.model.getObjectByName(kind);if(node)this.accents.push({node,base:node.quaternion.clone(),kind});}
    this.model.traverse(o=>{const mesh=o as T.SkinnedMesh;if(!mesh.isSkinnedMesh)return;const p=mesh.geometry.getAttribute('position');this.supports.push({mesh,indices:Array.from({length:p.count},(_,i)=>i).filter(i=>p.getY(i)<.7)});});
  }
  update(dog:DogCompanion,dt:number){
    this.root.position.set(dog.x,dog.y+.018,dog.z);this.root.rotation.y=dog.heading;
    this.ground.rotation.set(dog.groundPitch,0,dog.groundRoll);
    const move=T.MathUtils.smoothstep(dog.speed,.05,.55),run=T.MathUtils.smoothstep(dog.speed,2.2,4.5);
    const goals=[1-move,move*(1-run),move*run],blend=1-Math.exp(-dt*9);
    const pose=dog as DogCompanion&{sit?:number;lie?:number;excitement?:number;barking?:number;lookYaw?:number},lie=this.lying?Math.max(0,Math.min(1,pose.lie??0)):0,sit=this.seated?Math.max(0,Math.min(1-lie,pose.sit??0)):0;
    this.seated?.setEffectiveWeight(sit);this.lying?.setEffectiveWeight(lie);
    for(let i=0;i<3;i++){this.weights[i]+=(goals[i]-this.weights[i])*blend;this.actions[i].setEffectiveWeight(this.weights[i]*(1-sit-lie));}
    // Share a stride phase so switching gaits cannot randomly cross the legs.
    // Cycle travel is stride length / stance fraction from the baked Blender clips.
    const cycleTravel=T.MathUtils.lerp(.38/.55,.46/.24,run);
    this.phase=(this.phase+dog.speed*dt/cycleTravel)%1;
    for(const action of this.actions.slice(1)){
      action.setEffectiveTimeScale(0);
      action.time=this.phase*action.getClip().duration;
    }
    this.gait=lie>.5?'down':sit>.5?'sit':dog.speed<.15?'idle':dog.speed<3.2?'trot':'run';
    // Remove last frame's additive pose before the mixer (also when paused).
    for(const accent of this.accents)accent.node.quaternion.copy(accent.base);
    this.mixer.update(dt);
    for(const accent of this.accents){
      accent.base.copy(accent.node.quaternion);
      if(pose.excitement===undefined)continue;
      if(accent.kind==='head')accent.node.rotateZ(pose.lookYaw??0);
      if(accent.kind==='jaw'&&pose.barking)accent.node.rotateX(Math.max(0,Math.sin((1.3-pose.barking)*Math.PI*5))*.16);
    }
    // Ground the visible skin, including the seated haunch, not only the rig origin.
    this.supportAge+=dt;this.ground.position.y=0;
    if(sit+lie>.001&&(this.supportAge>.2||Math.abs(sit-this.supportSit)>.001||Math.abs(lie-this.supportLie)>.001)){
      this.root.updateMatrixWorld(true);this.groundInverse.copy(this.ground.matrixWorld).invert();let floor=Infinity;
      for(const {mesh,indices}of this.supports){mesh.skeleton.update();this.supportMatrix.multiplyMatrices(this.groundInverse,mesh.matrixWorld);const p=mesh.geometry.getAttribute('position');for(const index of indices){this.supportPoint.fromBufferAttribute(p,index);mesh.applyBoneTransform(index,this.supportPoint);this.supportPoint.applyMatrix4(this.supportMatrix);floor=Math.min(floor,this.supportPoint.y);}}
      if(Number.isFinite(floor))this.supportLift=Math.max(0,.02-floor);
      this.supportSit=sit;this.supportLie=lie;this.supportAge=0;
    }
    if(sit+lie>.001)this.ground.position.y=this.supportLift;else this.supportLift=0;
  }
}
