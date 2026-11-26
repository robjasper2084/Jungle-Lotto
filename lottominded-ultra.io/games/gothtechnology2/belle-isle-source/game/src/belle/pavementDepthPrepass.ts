import * as T from 'three';
import {pavementFactoryOwner} from './pavement.ts';
import {PAVEMENT_DEPTH_CHUNKS as chunks} from './pavementDepthChunks.ts';

/** Only the reviewed final finishAsphalt → non-wind atmosphere → realistic
 * asphalt owner may issue this receipt. It is not a generic shader approval API.
 * The factory identity, geometry, material and callbacks must remain authoritative
 * for the whole native render, as they do for the original static pavement.
 * Nothing here invokes, replaces or replays a source callback or program key. */
export type PavementDepthReceipt=Readonly<{
 source:T.Mesh;geometry:T.BufferGeometry;material:T.MeshStandardMaterial;
 compile:T.Material['onBeforeCompile'];key:T.Material['customProgramCacheKey'];
}>;
export type PavementDepthOptions=Readonly<{
 /** Pinned renderer-lifetime construction contract; no public r185 node getter. */
 rendererOutput:Readonly<{type:T.TextureDataType;nodes:boolean}>;
}>;
export type PavementDepthStats=Readonly<{
 supported:boolean;prepared:number;disposed:boolean;depthDrawAttempts:number;
 entries:readonly Readonly<{sourceId:number;depthId:number;status:string;selectedIndices:number}>[];
}>;
type AttributeReceipt={attribute:T.BufferAttribute;array:T.TypedArray;version:number;count:number;itemSize:number;normalized:boolean;gpuType:number;usage:number};
const nativeMaterialRender=T.Material.prototype.onBeforeRender;
const nativeBeforeShadow=T.Object3D.prototype.onBeforeShadow,nativeAfterShadow=T.Object3D.prototype.onAfterShadow;
const nativeRaycast=T.Mesh.prototype.raycast,nativeUpload=T.BufferAttribute.prototype.onUploadCallback;
const owners=new WeakMap<T.Scene,{dispose:()=>void;read:()=>PavementDepthStats}>();

function pinnedChunks(){
 return T.REVISION==='185'&&T.ShaderLib.standard.vertexShader===chunks.standardVertex&&
  T.ShaderLib.depth.vertexShader===chunks.depthVertex&&T.ShaderLib.depth.fragmentShader===chunks.depthFragment&&
  T.ShaderChunk.project_vertex===chunks.projectVertex&&T.ShaderChunk.begin_vertex===chunks.beginVertex;
}
function opaque(material:T.MeshStandardMaterial){
 return Object.getPrototypeOf(material)===T.MeshStandardMaterial.prototype&&material.visible&&
  material.transparent===false&&material.opacity===1&&material.blending===T.NormalBlending&&
  material.depthTest===true&&material.depthWrite===true&&material.depthFunc===T.LessEqualDepth&&material.colorWrite===true&&
  material.alphaTest===0&&material.alphaHash===false&&material.alphaToCoverage===false&&material.alphaMap===null&&
  material.map===null&&material.normalMap===null&&material.bumpMap===null&&material.displacementMap===null&&
  material.wireframe===false&&material.polygonOffset===false&&material.polygonOffsetFactor===0&&material.polygonOffsetUnits===0&&
  material.stencilWrite===false&&material.clippingPlanes===null&&material.clipIntersection===false&&material.clipShadows===false&&
  material.precision===null&&(material.side===T.FrontSide||material.side===T.DoubleSide)&&
  material.onBeforeRender===nativeMaterialRender&&Object.keys(material.defines??{}).length===1&&material.defines?.STANDARD==='';
}
function attributeReceipt(attribute:T.BufferAttribute|T.InterleavedBufferAttribute|undefined):AttributeReceipt|undefined{
 if(!(attribute instanceof T.BufferAttribute)||attribute.onUploadCallback!==nativeUpload||attribute.usage!==T.StaticDrawUsage)return;
 return {attribute,array:attribute.array,version:attribute.version,count:attribute.count,itemSize:attribute.itemSize,
  normalized:attribute.normalized,gpuType:attribute.gpuType,usage:attribute.usage};
}
function sameAttribute(receipt:AttributeReceipt){
 const a=receipt.attribute;
 return a.array===receipt.array&&a.version===receipt.version&&a.count===receipt.count&&a.itemSize===receipt.itemSize&&
  a.normalized===receipt.normalized&&a.gpuType===receipt.gpuType&&a.usage===receipt.usage&&a.onUploadCallback===nativeUpload;
}
function sameNumbers(a:readonly number[],b:readonly number[]){return a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));}

/** A depth-only view of factory asphalt, before ground −102. Every original
 * color draw, including quantized equal-depth LessEqual draws, stays in place.
 * It shares native vertex/index objects and copies exact source world elements,
 * owns its range, material, model-view matrix and VAOs. No extra shadow draw,
 * raycast hit, geometry simplification, GL query or source-material mutation.
 *
 * Between-view source changes fail closed. Unknown mid-render mutations of this
 * explicitly static source are not supported by the factory contract. Views
 * outside the audited default-target camera path retain the original color pass.
 */
export function preparePavementDepthPrepass(scene:T.Scene,renderer:T.WebGLRenderer,receipts:readonly PavementDepthReceipt[],options:PavementDepthOptions){
 const existing=owners.get(scene);if(existing)return existing;
 let disposed=false,contextActive=true,depthDrawAttempts=0;
 let context=renderer.getContextAttributes();
 const beforeDescriptor=Object.getOwnPropertyDescriptor(scene,'onBeforeRender'),originalBefore=scene.onBeforeRender;
 const viewStamp:{frame:number;camera:T.Camera|null}={frame:-1,camera:null};
 const before:T.Scene['onBeforeRender']=function(this:T.Scene,...args){
  let result:unknown;
  try{result=Reflect.apply(originalBefore,this,args);}
  catch(error){viewStamp.frame=-1;viewStamp.camera=null;for(const entry of entries)entry.suspend('scene-before-threw');throw error;}
  // r185 increments frame after this hook and before shadow/color submissions.
  // A missing wrapper, nested render or a different ArrayCamera child cannot
  // accidentally reuse a prior view's approval.
  if(!disposed&&scene.onBeforeRender===before&&this===scene&&args[0]===renderer&&args[1]===scene){
   viewStamp.frame=renderer.info.render.frame+1;viewStamp.camera=args[2];
   // r185 collects the render list after this hook. Reject an unsupported
   // private view now, before even a zero-count native draw can be queued.
   // The complete per-draw validation below remains independently mandatory.
   for(const entry of entries)entry.preflight(renderer,scene,args[2]);
  }else{viewStamp.frame=-1;viewStamp.camera=null;for(const entry of entries)entry.suspend('unsupported-view');}
  return result;
 };
 const fixedContract=options.rendererOutput.type===T.UnsignedByteType&&options.rendererOutput.nodes===false;
 const supported=!!context&&context.depth===true&&context.stencil===false&&fixedContract&&pinnedChunks()&&
  typeof originalBefore==='function'&&(!beforeDescriptor||('value'in beforeDescriptor&&beforeDescriptor.configurable===true&&beforeDescriptor.writable===true));
 const entries:{source:T.Mesh;depth:T.Mesh;geometry:T.BufferGeometry;material:T.MeshDepthMaterial;status:string;selectedIndices:number;
  preflight:(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera)=>void;suspend:(reason:string)=>void;release:()=>void}[]=[];
 const canvas=renderer.domElement;
 function contextLost(){contextActive=false;}
 function contextRestored(){context=renderer.getContextAttributes();contextActive=!!context&&context.depth===true&&context.stencil===false;}
 canvas?.addEventListener('webglcontextlost',contextLost);canvas?.addEventListener('webglcontextrestored',contextRestored);
 if(supported)Object.defineProperty(scene,'onBeforeRender',{value:before,writable:true,configurable:true,enumerable:beforeDescriptor?.enumerable??false});
 if(supported)for(const receipt of receipts){
  const {source,geometry,material,compile,key}=receipt,owner=pavementFactoryOwner(source),range=owner?.range;
  if(!owner||owner.kind!=='asphalt'||owner.geometry!==geometry||!range||range.geometry!==geometry||
   Object.getPrototypeOf(source)!==T.Mesh.prototype||source.parent!==scene||source.geometry!==geometry||source.material!==material||
   material.onBeforeCompile!==compile||material.customProgramCacheKey!==key||!opaque(material)||
   material.name!=='Island asphalt'||material.userData.realisticSurface!=='asphalt'||
   !['asphalt|planar','asphalt|triplanar'].includes(material.userData.realisticProfile)||
   source.onBeforeRender!==range.before||source.onAfterRender!==range.after||source.onBeforeShadow!==nativeBeforeShadow||source.onAfterShadow!==nativeAfterShadow||
   source.raycast!==nativeRaycast||source.castShadow||source.customDepthMaterial||source.customDistanceMaterial||
   !geometry.index||geometry.groups.length||Object.keys(geometry.morphAttributes).length||
   geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||!geometry.boundingSphere||
   Object.keys(geometry.attributes).join('|')!=='position|normal|uv')continue;
  const attributes=Object.entries(geometry.attributes).map(([name,value])=>({name,receipt:attributeReceipt(value)})),index=attributeReceipt(geometry.index);
  if(!index||attributes.some(value=>!value.receipt))continue;
  const attributesObject=geometry.attributes,sourceIndex=geometry.index,sourceSphere=geometry.boundingSphere;
  const sphere=sourceSphere.clone(),matrix=source.matrix,matrixWorld=source.matrixWorld,layers=source.layers;
  const matrixValues=matrix.elements.slice(),worldValues=matrixWorld.elements.slice(),layerMask=layers.mask;
  if(!matrixValues.every(Number.isFinite)||!worldValues.every(Number.isFinite)||!matrix.equals(new T.Matrix4())||!matrixWorld.equals(new T.Matrix4()))continue;
  const materialVersion=material.version,side=material.side,frustumCulled=source.frustumCulled;
  const geometryView=new T.BufferGeometry();
  for(const [name,attribute]of Object.entries(geometry.attributes))geometryView.setAttribute(name,attribute);
  geometryView.setIndex(sourceIndex);geometryView.boundingSphere=sourceSphere;geometryView.boundingBox=geometry.boundingBox;geometryView.setDrawRange(0,0);
  const depthMaterial=new T.MeshDepthMaterial({colorWrite:false,depthTest:true,depthWrite:true,depthFunc:T.LessEqualDepth,side,depthPacking:T.BasicDepthPacking});
  depthMaterial.name='Factory asphalt depth';depthMaterial.allowOverride=false;
  const depth=new T.Mesh(geometryView,depthMaterial);depth.name='Factory asphalt depth · '+source.id;
  depth.matrixAutoUpdate=false;depth.matrixWorldAutoUpdate=false;depth.matrixWorld.copy(matrixWorld);depth.layers.mask=layerMask;
  depth.frustumCulled=frustumCulled;depth.renderOrder=-103;depth.castShadow=false;depth.receiveShadow=false;
  depth.raycast=()=>{};
  const depthMatrix=depth.matrixWorld,depthLocal=depth.matrix,depthLayers=depth.layers,depthVersion=depthMaterial.version,depthCompile=depthMaterial.onBeforeCompile,depthKey=depthMaterial.customProgramCacheKey;
  const entry={source,depth,geometry:geometryView,material:depthMaterial,status:'ready',selectedIndices:0,
   preflight:(_renderer:T.WebGLRenderer,_scene:T.Scene,_camera:T.Camera)=>{},suspend:(_reason:string)=>{},release:()=>{}};
  const selection={start:0,count:0};let released=false,privateOwnershipLost=false,privateVisible=false,requestedVisible=true;
  function valid(viewRenderer:T.WebGLRenderer,viewScene:T.Scene,viewCamera:T.Camera,preflight=false):string|null{
   if(disposed||released||!contextActive)return'disposed-or-lost-context';
   if(privateOwnershipLost)return'depth-owner-changed';
   if(!requestedVisible)return'view-disabled';
   if(viewRenderer!==renderer||viewScene!==scene||scene.onBeforeRender!==before||viewStamp.camera!==viewCamera||
    viewStamp.frame!==renderer.info.render.frame+(preflight?1:0)||(!preflight&&!privateVisible)||
    renderer.getRenderTarget()!==null||scene.overrideMaterial!==null||
    renderer.xr.isPresenting||(viewCamera as T.ArrayCamera).isArrayCamera||viewCamera.coordinateSystem!==T.WebGLCoordinateSystem||viewCamera.reversedDepth||
    renderer.capabilities.logarithmicDepthBuffer||renderer.capabilities.reversedDepthBuffer||renderer.localClippingEnabled||renderer.clippingPlanes.length)return'unsupported-view';
   if(!pinnedChunks())return'shader-contract-changed';
   if(depth.geometry!==geometryView||depth.material!==depthMaterial||depth.matrixWorld!==depthMatrix||
    geometryView.index!==sourceIndex||Object.keys(geometryView.attributes).join('|')!=='position|normal|uv'||geometryView.groups.length||Object.keys(geometryView.morphAttributes).length||
    geometryView.boundingSphere!==sourceSphere||attributes.some(({name,receipt:attribute})=>geometryView.attributes[name]!==attribute!.attribute)||
    depth.matrixAutoUpdate||depth.matrixWorldAutoUpdate||depth.matrix!==depthLocal||!sameNumbers(depthLocal.elements,matrixValues)||!sameNumbers(depthMatrix.elements,worldValues)||
    depth.layers!==depthLayers||depthLayers.mask!==layerMask||depth.frustumCulled!==frustumCulled||depth.renderOrder!==-103||depth.castShadow||depth.receiveShadow||
    depthMaterial.version!==depthVersion||depthMaterial.onBeforeCompile!==depthCompile||depthMaterial.customProgramCacheKey!==depthKey||depthMaterial.onBeforeRender!==nativeMaterialRender||
    depthMaterial.colorWrite||!depthMaterial.depthTest||!depthMaterial.depthWrite||depthMaterial.depthFunc!==T.LessEqualDepth||depthMaterial.side!==side||
    depthMaterial.transparent||depthMaterial.alphaTest!==0||depthMaterial.alphaHash||depthMaterial.alphaToCoverage||depthMaterial.map||depthMaterial.alphaMap||depthMaterial.displacementMap||
    depthMaterial.polygonOffset||depthMaterial.polygonOffsetFactor!==0||depthMaterial.polygonOffsetUnits!==0||depthMaterial.stencilWrite||depthMaterial.allowOverride||
    depthMaterial.wireframe||depthMaterial.clippingPlanes!==null||depthMaterial.depthPacking!==T.BasicDepthPacking||depthMaterial.precision!==null)return'depth-owner-changed';
   if(source.parent!==scene||depth.parent!==source||source.geometry!==geometry||source.material!==material||
    source.matrix!==matrix||source.matrixWorld!==matrixWorld||source.layers!==layers||layers.mask!==layerMask||source.frustumCulled!==frustumCulled||
    !sameNumbers(matrix.elements,matrixValues)||!sameNumbers(matrixWorld.elements,worldValues)||
    source.position.x!==0||source.position.y!==0||source.position.z!==0||source.quaternion.x!==0||source.quaternion.y!==0||source.quaternion.z!==0||source.quaternion.w!==1||
    source.scale.x!==1||source.scale.y!==1||source.scale.z!==1)return'source-owner-changed';
   if(!source.visible||!scene.visible||!source.layers.test(viewCamera.layers))return'source-hidden';
   if(source.onBeforeRender!==range!.before||source.onAfterRender!==range!.after||source.onBeforeShadow!==nativeBeforeShadow||source.onAfterShadow!==nativeAfterShadow||
    source.raycast!==nativeRaycast||source.castShadow||source.customDepthMaterial||source.customDistanceMaterial)return'source-callback-changed';
   if(material.version!==materialVersion||material.side!==side||material.onBeforeCompile!==compile||material.customProgramCacheKey!==key||!opaque(material))return'material-changed';
   if(geometry.attributes!==attributesObject||geometry.index!==sourceIndex||geometry.boundingSphere!==sourceSphere||!sourceSphere.equals(sphere)||
    geometry.groups.length||Object.keys(geometry.morphAttributes).length||geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||
    Object.keys(geometry.attributes).join('|')!=='position|normal|uv'||!sameAttribute(index!)||
    attributes.some(({name,receipt:attribute})=>geometry.attributes[name]!==attribute!.attribute||!sameAttribute(attribute!)))return'geometry-changed';
   return null;
  }
  entry.suspend=(reason)=>{privateVisible=false;geometryView.setDrawRange(0,0);entry.selectedIndices=0;if(!released)entry.status=reason;};
  entry.preflight=(viewRenderer,viewScene,viewCamera)=>{
   entry.suspend('ready');
   const reason=valid(viewRenderer,viewScene,viewCamera,true);if(reason){entry.suspend(reason);return;}
   privateVisible=true;
  };
  // Callers may disable this optional view (the proof does so for its native
  // baseline). Enabling it never bypasses the current preflight decision.
  Object.defineProperty(depth,'visible',{get:()=>requestedVisible&&privateVisible,set:(next:unknown)=>{
   if(typeof next!=='boolean'){privateOwnershipLost=true;entry.suspend('depth-owner-changed');return;}
   requestedVisible=next;if(!next)entry.suspend('view-disabled');
  },enumerable:true,configurable:false});
  depth.onBeforeRender=function(viewRenderer,viewScene,viewCamera){
   // Only this owned view changes. A throw in any later renderer step cannot
   // leave the original geometry range or material in a modified state.
   geometryView.setDrawRange(0,0);entry.selectedIndices=0;
   const reason=valid(viewRenderer,viewScene,viewCamera);if(reason){entry.suspend(reason);return;}
   range.select(viewCamera,selection);geometryView.setDrawRange(selection.start,selection.count);
   entry.status='active';entry.selectedIndices=selection.count;if(selection.count>0)depthDrawAttempts++;
  };
  depth.onAfterRender=()=>{geometryView.setDrawRange(0,0);};
  depth.onBeforeShadow=()=>{geometryView.setDrawRange(0,0);};
  // This private implementation mesh must never submit a replacement geometry,
  // material or callback from a stale native render-list item. A replacement
  // request disables the view without touching the caller's replacement object.
  // Assigning the same value (as generic traversals sometimes do) is harmless.
  for(const name of ['geometry','material','onBeforeRender','onAfterRender','onBeforeShadow','raycast'] as const){
   const value=depth[name];Object.defineProperty(depth,name,{get:()=>value,set:(next:unknown)=>{
    if(next!==value){privateOwnershipLost=true;geometryView.setDrawRange(0,0);}
   },enumerable:Object.getOwnPropertyDescriptor(depth,name)?.enumerable??false,configurable:false});
  }
  entry.release=()=>{
   if(released)return;released=true;privateVisible=false;entry.status='disposed';entry.selectedIndices=0;
   geometry.removeEventListener('dispose',entry.release);material.removeEventListener('dispose',entry.release);
   depth.removeFromParent();geometryView.setDrawRange(0,0);
   // r185 WebGLGeometries reads these fields during its dispose listener. Strip
   // this view only, so shared native GPU buffers remain owned by color geometry.
   geometryView.setIndex(null);for(const name of Object.keys(geometryView.attributes))geometryView.deleteAttribute(name);
   geometryView.dispose();depthMaterial.dispose();
  };
  geometry.addEventListener('dispose',entry.release);material.addEventListener('dispose',entry.release);
  entries.push(entry);source.add(depth);
 }
 function read():PavementDepthStats{return {supported,prepared:entries.length,disposed,depthDrawAttempts,
  entries:entries.map(entry=>({sourceId:entry.source.id,depthId:entry.depth.id,status:entry.status,selectedIndices:entry.selectedIndices}))};}
 function dispose(){if(disposed)return;disposed=true;for(const entry of entries)entry.release();
  canvas?.removeEventListener('webglcontextlost',contextLost);canvas?.removeEventListener('webglcontextrestored',contextRestored);
  if(scene.onBeforeRender===before){if(beforeDescriptor)Object.defineProperty(scene,'onBeforeRender',beforeDescriptor);else Reflect.deleteProperty(scene,'onBeforeRender');}
  owners.delete(scene);}
 const handle={read,dispose};owners.set(scene,handle);return handle;
}
