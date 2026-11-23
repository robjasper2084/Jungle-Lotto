import {
 OrthographicCamera,Vector3,Vector4,WebGLRenderTarget,
 type Camera,type DirectionalLight,type Object3D,type Scene,type WebGLRenderer
} from 'three';
import {GpuFrameGate} from './gpuFramePacing.ts';

/** Prepare Three's real depth programs while the ride selector covers the view.
 * compile() only visits color materials. The shadow pass chooses its own
 * programs based on the caster, including skinning and the material's maps.
 */
export async function warmRideShadows(renderer:WebGLRenderer,scene:Scene,rider:Object3D,x:number,z:number,launchView?:Camera){
 const gl=renderer.getContext() as WebGL2RenderingContext;
 if(gl.isContextLost())return;
 const light=renderer.shadowMap.enabled
  ?scene.children.find(object=>(object as DirectionalLight).isDirectionalLight&&object.castShadow) as DirectionalLight|undefined
  :undefined;
 if(!light&&!launchView)return;
 const camera=new OrthographicCamera(-20,20,20,-20,.1,300);
 camera.position.set(x,120,z+12);camera.lookAt(x,0,z);
 const target=light?new WebGLRenderTarget(1,1):undefined;
 const previousTarget=renderer.getRenderTarget(),cube=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
 const previousScissor=launchView?renderer.getScissor(new Vector4()):undefined;
 const scissorTest=launchView?renderer.getScissorTest():false;
 const draw=renderer.renderBufferDirect,visible=rider.visible,autoUpdate=light?.shadow.autoUpdate;
 const offset=light?new Vector3(x-light.target.position.x,0,z-light.target.position.z):undefined;
 if(light&&offset){
  light.position.add(offset);light.target.position.add(offset);
  light.shadow.autoUpdate=true;renderer.shadowMap.needsUpdate=true;
 }
 rider.visible=true;
 try{
  if(target){
   renderer.renderBufferDirect=function(view,drawScene,geometry,material,object,group){
    // Three r185 passes a null scene for a depth draw. Submit only the first
    // triangle so the driver prepares the actual vertex and depth pipeline.
    if(drawScene!==null)return;
    const {start,count}=geometry.drawRange;
    geometry.setDrawRange(start,Math.min(count,3));
    try{draw.call(this,view,drawScene,geometry,material,object,group);}
    finally{geometry.setDrawRange(start,count);}
   };
   renderer.setRenderTarget(target);
   renderer.render(scene,camera);
  }
  if(launchView){
   // A render target uses different color output state from the screen.
   // Exercise the screen shaders and vertex bindings through a tiny scissor.
   renderer.renderBufferDirect=draw;
   renderer.setRenderTarget(null);
   renderer.setScissor(0,0,1,1);
   renderer.setScissorTest(true);
   renderer.render(scene,launchView);
  }
 }finally{
  renderer.renderBufferDirect=draw;rider.visible=visible;
  if(light&&offset){
   light.position.sub(offset);light.target.position.sub(offset);light.shadow.autoUpdate=autoUpdate!;
   renderer.shadowMap.needsUpdate=true;
  }
  renderer.setRenderTarget(previousTarget,cube,mip);
  if(previousScissor){renderer.setScissor(previousScissor);renderer.setScissorTest(scissorTest);}
  target?.dispose();
 }
 // A driver can return from the warmup with uploads still queued. Let the
 // loading screen paint until those commands retire before accepting input.
 const gate=new GpuFrameGate(gl);
 const deadline=performance.now()+3000;
 try{
  gate.submitted();
  while(!gate.ready()&&!gl.isContextLost()&&performance.now()<deadline)
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 }finally{gate.clear();}
}

