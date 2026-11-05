import * as T from 'three';

/** Lightweight controller gloves. Shared geometry, two instanced draw calls,
 * no asset download, shadows or per-frame allocations. Tracking loss hides them. */
export class XRHands {
 readonly grips:T.Group[]=[];
 readonly rays:T.Group[]=[];
 private gloves:T.InstancedMesh[]=[];
 private sources:Array<XRInputSource|undefined>=[];
 private geometry=new T.SphereGeometry(1,8,6);
 private material=new T.MeshStandardMaterial({color:'#52676a',roughness:.87,metalness:.02});
 private part=new T.Object3D();
 private listeners:Array<()=>void>=[];
 constructor(renderer:T.WebGLRenderer,origin:T.Group){
  for(let i=0;i<2;i++){
   const grip=renderer.xr.getControllerGrip(i),ray=renderer.xr.getController(i);
   const glove=new T.InstancedMesh(this.geometry,this.material,18);glove.name='Tracked VR glove';glove.frustumCulled=false;glove.visible=false;
   grip.add(glove);origin.add(grip,ray);this.grips.push(grip);this.rays.push(ray);this.gloves.push(glove);
   const connected=(e:{data:XRInputSource})=>{this.sources[i]=e.data;this.pose(i,false);};
   const disconnected=()=>{this.sources[i]=undefined;glove.visible=false;};
   grip.addEventListener('connected',connected);grip.addEventListener('disconnected',disconnected);
   this.listeners.push(()=>{grip.removeEventListener('connected',connected);grip.removeEventListener('disconnected',disconnected);});
  }
 }
 private pose(i:number,trigger:boolean){
  const mesh=this.gloves[i],side=this.sources[i]?.handedness==='left'?-1:1,p=this.part;let n=0;
  const piece=(x:number,y:number,z:number,sx:number,sy:number,sz:number,rx=0,rz=0)=>{p.position.set(x*side,y,z);p.rotation.set(rx,0,rz*side);p.scale.set(sx,sy,sz);p.updateMatrix();mesh.setMatrixAt(n++,p.matrix);};
  piece(0,-.012,.022,.036,.023,.050); // palm and wrist
  piece(0,-.008,.078,.030,.022,.025);
  for(let finger=0;finger<4;finger++){
   const x=(finger-1.5)*.018,z=-.020+(finger===3?.009:0),extended=finger===0&&!trigger;
   piece(x,.002,z,.009,.010,extended?.026:.018,extended?-.18:-.6);
   piece(x,extended?-.002:-.019,z-(extended?.031:.018),.008,.009,.016,extended?-.15:-1.2);
   piece(x,extended?-.005:-.035,z-(extended?.052:.013),.007,.008,.011,extended?-.15:-2);
  }
  piece(-.039,-.004,.010,.012,.013,.025,.45,-.55);
  piece(-.038,-.025,-.010,.010,.011,.020,1.1,-.4);
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
 }
 update(active:boolean){for(let i=0;i<2;i++){const source=this.sources[i];this.gloves[i].visible=active&&!!source?.gamepad&&!source.hand; if(this.gloves[i].visible)this.pose(i,!!source?.gamepad?.buttons[0]?.pressed);}}
 controller(hand:XRHandedness){const i=this.sources.findIndex(s=>s?.handedness===hand&&!!s.gamepad);return i<0?undefined:{grip:this.grips[i],ray:this.rays[i]};}
 dispose(){this.listeners.forEach(f=>f());this.gloves.forEach(g=>g.removeFromParent());this.grips.forEach(g=>g.removeFromParent());this.rays.forEach(g=>g.removeFromParent());this.geometry.dispose();this.material.dispose();}
}
