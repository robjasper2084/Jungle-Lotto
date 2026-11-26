import * as T from 'three';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {preserveStreetBatchOrder} from './streetBatchOrder.ts';

/** Batch the small rigid pieces of landmarks and houses in ordinary views.
 * Larger forms retain their individual close/far indices and bridge span
 * ordering. Only hardware supporting an actual multi-draw path benefits. */
export function batchStaticArchitecture(scene:T.Scene,renderer:T.WebGLRenderer,roots:T.Object3D[],splitActive:()=>boolean,bridgeTiles?:T.Object3D,streetSources:T.Mesh[]=[]){
 if(!renderer.extensions.has('WEBGL_multi_draw'))return;
 const sources:T.Mesh[]=[];
 for(const root of roots)root.traverse(object=>{
  if(!(object instanceof T.Mesh)||object.name.startsWith('MacArthur')||
     object.onBeforeRender!==T.Object3D.prototype.onBeforeRender||object.onAfterRender!==T.Object3D.prototype.onAfterRender||
     object.onBeforeShadow!==T.Object3D.prototype.onBeforeShadow||object.onAfterShadow!==T.Object3D.prototype.onAfterShadow)return;
  const geometry=object.geometry;
  if((geometry.index?.count??geometry.attributes.position?.count??Infinity)<=6000)sources.push(object);
 });
 const exact=new Set<T.Mesh>();
 bridgeTiles?.traverse(o=>{if(o instanceof T.Mesh){exact.add(o);sources.push(o);}});
 const streets=new Set<T.Mesh>();
 for(const mesh of streetSources){
  if(mesh.onBeforeRender!==T.Object3D.prototype.onBeforeRender||mesh.onAfterRender!==T.Object3D.prototype.onAfterRender||
     mesh.onBeforeShadow!==T.Object3D.prototype.onBeforeShadow||mesh.onAfterShadow!==T.Object3D.prototype.onAfterShadow)continue;
  streets.add(mesh);exact.add(mesh);sources.push(mesh);
 }
 const palette=new StaticPaletteBatch(sources,exact,(batch,group)=>{
  if(group.every(source=>streets.has(source)))preserveStreetBatchOrder(batch,group);
 });
 if(!palette.stats.batches)return;
 palette.root.name='Static architecture material batches';
 palette.root.userData.warmIslandShaders=true;
 palette.root.traverse(o=>{if(o instanceof T.BatchedMesh)o.raycast=()=>{};});
 scene.add(palette.root);
 const before=scene.onBeforeRender,after=scene.onAfterRender;
 const views:({shadows:boolean;camera:T.Camera}|undefined)[]=[];
 scene.onBeforeRender=(...args)=>{
  if(views.at(-1)!==undefined)palette.endView();
  before.apply(scene,args);
  const [r,,camera,target]=args;
  const ordinary=!target&&!r.xr.isPresenting&&(camera as T.PerspectiveCamera).isPerspectiveCamera&&!splitActive();
  const shadowPass=ordinary?r.shadowMap.enabled&&(r.shadowMap.autoUpdate||r.shadowMap.needsUpdate):undefined;
  views.push(shadowPass===undefined?undefined:{shadows:shadowPass,camera});
  if(shadowPass!==undefined)palette.beginView(shadowPass,camera);
 };
 scene.onAfterRender=(...args)=>{
  if(views.pop()!==undefined)palette.endView();
  after.apply(scene,args);
  const parent=views.at(-1);
  if(parent!==undefined)palette.beginView(parent.shadows,parent.camera);
 };
 return palette;
}
