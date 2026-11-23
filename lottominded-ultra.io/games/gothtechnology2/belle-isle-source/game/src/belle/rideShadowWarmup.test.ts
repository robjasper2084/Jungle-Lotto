import assert from 'node:assert/strict';
import test from 'node:test';
import {
 BoxGeometry,DirectionalLight,Group,Mesh,MeshBasicMaterial,MeshDepthMaterial,PerspectiveCamera,Scene,Vector4,WebGLRenderTarget,
 type WebGLRenderer
} from 'three';
import {warmRideShadows} from './rideShadowWarmup.ts';

test('ride warmup submits a bounded depth draw and restores the live renderer',async()=>{
 const scene=new Scene();
 const rider=new Group();rider.visible=false;
 const lamp=new DirectionalLight();lamp.castShadow=true;lamp.shadow.autoUpdate=false;
 lamp.position.set(4,6,9);lamp.target.position.set(3,0,5);
 scene.add(rider,lamp,lamp.target);
 const geometry=new BoxGeometry();
 const mesh=new Mesh(geometry,new MeshBasicMaterial());
 const depth=new MeshDepthMaterial();
 const previousTarget=new WebGLRenderTarget(8,8);
 let target=previousTarget,deleted=false;
 const draws:number[]=[];
 const nativeDraw:WebGLRenderer['renderBufferDirect']=(_camera,_scene,buffer)=>draws.push(buffer.drawRange.count);
 const fake={
  renderBufferDirect:nativeDraw,shadowMap:{enabled:true,needsUpdate:false},
  getContext:()=>({
   isContextLost:()=>false,fenceSync:()=>({}),clientWaitSync:()=>1,ALREADY_SIGNALED:1,TIMEOUT_EXPIRED:2,
   flush(){},deleteSync(){deleted=true;}
  }),
  getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  setRenderTarget:(value:WebGLRenderTarget)=>{target=value;},
  render(value:Scene,camera:Parameters<WebGLRenderer['render']>[1]){
   assert.equal(value,scene);assert.ok(rider.visible);assert.equal(target.width,1);
   assert.equal(lamp.target.position.x,433);
   this.renderBufferDirect(camera,scene,geometry,mesh.material,mesh,null!);
   this.renderBufferDirect(camera,null!,geometry,depth,mesh,null!);
  }
 };
 try{
  await warmRideShadows(fake as unknown as WebGLRenderer,scene,rider,433,773);
  assert.deepEqual(draws,[3]);assert.equal(geometry.drawRange.count,Infinity);
  assert.equal(fake.renderBufferDirect,nativeDraw);assert.equal(target,previousTarget);
  assert.equal(rider.visible,false);assert.equal(lamp.shadow.autoUpdate,false);
  assert.deepEqual(lamp.position.toArray(),[4,6,9]);assert.deepEqual(lamp.target.position.toArray(),[3,0,5]);
  assert.ok(deleted&&fake.shadowMap.needsUpdate);
 }finally{previousTarget.dispose();geometry.dispose();mesh.material.dispose();depth.dispose();}
});

for(const reveal of [false,true])test('the launch view warms the '+(reveal?'full':'clipped')+' screen pipeline and restores viewport clipping',async()=>{
 const scene=new Scene(),rider=new Group(),view=new PerspectiveCamera();
 rider.visible=false;scene.add(rider);
 const scissor=new Vector4(7,8,900,600);
 let enabled=reveal,drawn=false;
 const fake={
  shadowMap:{enabled:false},renderBufferDirect(){},
  getContext:()=>({
   isContextLost:()=>false,fenceSync:()=>({}),clientWaitSync:()=>1,ALREADY_SIGNALED:1,TIMEOUT_EXPIRED:2,
   flush(){},deleteSync(){}
  }),
  getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  getScissor:(target:Vector4)=>target.copy(scissor),getScissorTest:()=>enabled,
  setScissor:(x:Vector4|number,y:number,w:number,h:number)=>{
   if(x instanceof Vector4)scissor.copy(x);else scissor.set(x,y,w,h);
  },
  setScissorTest:(value:boolean)=>{enabled=value;},
  setRenderTarget:(target:unknown)=>assert.equal(target,null),
  render(active:Scene,camera:PerspectiveCamera){
   assert.equal(active,scene);assert.equal(camera,view);assert.ok(rider.visible);
   assert.equal(enabled,!reveal);
   assert.deepEqual(scissor.toArray(),reveal?[7,8,900,600]:[0,0,1,1]);drawn=true;
  }
 };
 await warmRideShadows(fake as unknown as WebGLRenderer,scene,rider,0,0,view,reveal);
 assert.ok(drawn);assert.equal(rider.visible,false);assert.equal(enabled,reveal);
 assert.deepEqual(scissor.toArray(),[7,8,900,600]);
});
