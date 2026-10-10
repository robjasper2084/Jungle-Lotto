import * as T from 'three';
type Shot={id:string;p:{x:number;y:number;z:number};v:{x:number;y:number;z:number}};
/** Bounded, shared geometry: two draw calls for every visible heart and sparkle.
 * This only presents accepted projectiles; collision and damage stay on the host. */
export class HeartProjectiles extends T.Group{
 readonly hearts:T.InstancedMesh;readonly sparks:T.InstancedMesh;
 private travelled=new Map<string,{p:T.Vector3;distance:number}>();private dummy=new T.Object3D();private color=new T.Color();
 constructor(readonly capacity=128){
  super();this.name='Heart projectile effects';const shape=new T.Shape();
  shape.moveTo(0,.24);shape.bezierCurveTo(-.34,.66,-.7,.24,-.4,-.08);shape.lineTo(0,-.5);shape.lineTo(.4,-.08);shape.bezierCurveTo(.7,.24,.34,.66,0,.24);
  const geometry=new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.025,curveSegments:5});geometry.translate(0,0,-.04);
  this.hearts=new T.InstancedMesh(geometry,new T.MeshStandardMaterial({color:'#ff72ac',emissive:'#ff235e',emissiveIntensity:1.4,metalness:.15,roughness:.25,transparent:true,opacity:.86,depthWrite:false}),capacity*7);
  this.sparks=new T.InstancedMesh(new T.OctahedronGeometry(1,0),new T.MeshBasicMaterial({color:'#ffd2e8',transparent:true,opacity:.72,depthWrite:false}),capacity*4);
  for(const mesh of [this.hearts,this.sparks]){mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.count=0;this.add(mesh);}
 }
 update(shots:readonly Shot[],camera:T.Camera,time:number,reduced:boolean){
  const count=Math.min(shots.length,this.capacity),d=this.dummy;let particles=0,hearts=0;
  for(let i=0;i<count;i++){
   const s=shots[i];let trail=this.travelled.get(s.id);const point=new T.Vector3(s.p.x,s.p.y,s.p.z);if(!trail){trail={p:point.clone(),distance:0};this.travelled.set(s.id,trail);}trail.distance+=trail.p.distanceTo(point);trail.p.copy(point);d.position.set(s.p.x,s.p.y,s.p.z);d.quaternion.copy(camera.quaternion);d.scale.setScalar(.34);d.updateMatrix();this.hearts.setMatrixAt(hearts++,d.matrix);
   // A readable 4-18 metre stream of progressively smaller hearts. Geometry is
   // presentation only; each tip remains the accepted host projectile position.
   if(!reduced){const speed=Math.hypot(s.v.x,s.v.y,s.v.z)||1,length=Math.min(trail.distance,18,Math.max(4,speed*.10));for(let j=0;j<6;j++){
    const distance=length*(j+1)/6;d.position.set(s.p.x-s.v.x/speed*distance,s.p.y-s.v.y/speed*distance,s.p.z-s.v.z/speed*distance);d.scale.setScalar(.28*(1-j*.11));d.updateMatrix();this.hearts.setMatrixAt(hearts++,d.matrix);
   }}
   // Four short trailing sparks, bounded in world distance at every bullet speed.
   if(!reduced){const speed=Math.hypot(s.v.x,s.v.y,s.v.z)||1;for(let j=0;j<4;j++){
    const distance=(j+1)*.65,phase=time*9+i*2+j*1.7;
    d.position.set(s.p.x-s.v.x/speed*distance+Math.sin(phase)*.045,s.p.y-s.v.y/speed*distance+Math.cos(phase)*.045,s.p.z-s.v.z/speed*distance);
    d.scale.setScalar(.035*(1-j*.16));d.updateMatrix();this.sparks.setMatrixAt(particles,d.matrix);this.sparks.setColorAt(particles++,this.color.set(j%2?'#ffe9b0':'#ff72b6'));
   }}
  }
  const live=new Set(shots.map(s=>s.id));for(const id of this.travelled.keys())if(!live.has(id))this.travelled.delete(id);
  this.hearts.count=hearts;this.sparks.count=particles;this.hearts.instanceMatrix.needsUpdate=this.sparks.instanceMatrix.needsUpdate=true;if(this.sparks.instanceColor)this.sparks.instanceColor.needsUpdate=true;
 }
 reset(){this.travelled.clear();this.hearts.count=this.sparks.count=0;}
 dispose(){for(const mesh of [this.hearts,this.sparks]){mesh.geometry.dispose();(mesh.material as T.Material).dispose();}this.removeFromParent();}
}

