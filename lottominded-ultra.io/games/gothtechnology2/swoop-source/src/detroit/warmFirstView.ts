import * as T from 'three';
import {WorkSlice} from '../../../ride-core/src/workSlice.ts';
/** Finish GPU preparation behind the startup screen, without uploading distant districts. */
export async function warmFirstView(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,actors:readonly T.Object3D[]=[]){
 // Roster models can be outside the opening camera/AOI. Upload their buffers now,
 // without changing their positions or leaving their visibility/culling altered.
 const restore:(()=>void)[]=[];
 for(const root of actors){const visible=root.visible;root.visible=true;restore.push(()=>root.visible=visible);
  root.traverse(o=>{const culled=o.frustumCulled;o.frustumCulled=false;restore.push(()=>o.frustumCulled=culled);});
 }
 try{
 const slice=new WorkSlice(),textures=new Set<T.Texture>();
 scene.traverseVisible(o=>{
  const material=(o as T.Mesh).material;if(!material)return;
  for(const m of Array.isArray(material)?material:[material])for(const value of Object.values(m))
   if(value instanceof T.Texture&&!value.isRenderTargetTexture&&!(value as T.VideoTexture).isVideoTexture)textures.add(value);
 });
 for(const texture of textures){renderer.initTexture(texture);await slice.checkpoint();}
 await renderer.compileAsync(scene,camera);
 renderer.render(scene,camera);
 await new Promise<void>(resolve=>setTimeout(resolve,0));
 }finally{for(const reset of restore)reset();}
}
