import * as T from 'three';
import type {TypedArray} from 'three';
import type {NatureRenderProbe} from './renderDiagnostics.ts';
import {LocalTreeBoundsCache} from './localTreeBoundsCache.ts';

type Stream={attribute:T.BufferAttribute;source:TypedArray};
type Part={mesh:T.InstancedMesh;base:T.Sphere;streams:Stream[];saved:Map<T.BufferAttribute,Stream>;matrix:Stream|undefined;world:Float64Array;localBounds:LocalTreeBoundsCache};
const FLOAT32_EPSILON=2**-23;
const IDENTITY_WORLD=new T.Matrix4();
type TreeShadowView={frustum:T.Frustum;margin:number};
type SelectedTreeSource={count:number;matrices:TypedArray};
const selectedTreeSources=new WeakMap<T.InstancedMesh,(maximumCount:number)=>SelectedTreeSource>();

/** Copy the existing distance-selected source matrices for an on-demand view
 * observation. Render compaction is not a scenery selection policy. No caller
 * receives the private saved stream or changes the current rendered prefix. */
export function copySelectedTreeSource(mesh:T.InstancedMesh,maximumCount=40000):SelectedTreeSource|null{
 if(!Number.isSafeInteger(maximumCount)||maximumCount<0||maximumCount>40000)throw Error('Invalid bounded tree source allowance');
 return selectedTreeSources.get(mesh)?.(maximumCount)??null;
}

function finiteMatrix(matrix:T.Matrix4){return matrix.elements.every(Number.isFinite);}
function affine(matrix:T.Matrix4){const e=matrix.elements;return finiteMatrix(matrix)&&e[3]===0&&e[7]===0&&e[11]===0&&e[15]===1;}
// Inverting an ordinary lookAt camera can put its homogeneous 1 a few double
// precision ulps away from 1. That is not a projective/malformed camera.
function cameraAffine(matrix:T.Matrix4){const e=matrix.elements;return finiteMatrix(matrix)&&Math.abs(e[3])<1e-12&&Math.abs(e[7])<1e-12&&Math.abs(e[11])<1e-12&&Math.abs(e[15]-1)<1e-12;}
function finiteSphere(sphere:T.Sphere){return Number.isFinite(sphere.center.x)&&Number.isFinite(sphere.center.y)&&Number.isFinite(sphere.center.z)&&Number.isFinite(sphere.radius)&&sphere.radius>=0;}
function finiteFrustum(frustum:T.Frustum){
 return frustum.planes.every(plane=>Number.isFinite(plane.constant)&&
  Number.isFinite(plane.normal.x)&&Number.isFinite(plane.normal.y)&&Number.isFinite(plane.normal.z)&&plane.normal.lengthSq()>.5);
}

/** The view and the live directional shadow camera both use the same
 * instance buffers. Retain the union of their conservative bounds. */
export class TreeShadowVisibility {
 private readonly camera=new T.OrthographicCamera();
 private readonly projection=new T.Matrix4();
 private readonly target=new T.Vector3();
 private readonly view:TreeShadowView={frustum:new T.Frustum(),margin:0};

 forRender(scene:T.Scene,renderer:T.WebGLRenderer,camera:T.Camera):TreeShadowView|boolean{
  const {enabled,autoUpdate,needsUpdate,type}=renderer.shadowMap;
  if(!enabled||!(autoUpdate||needsUpdate))return false;
  if(type!==T.PCFShadowMap||renderer.xr.isPresenting||renderer.capabilities.reversedDepthBuffer)return true;

  let sun:T.DirectionalLight|undefined;
  let unsupported=false;
  scene.traverseVisible(object=>{
   const light=object as T.Light&{shadow?:T.LightShadow<T.Camera>};
   if(!light.isLight||!light.castShadow||!light.layers.test(camera.layers))return;
   if(!light.shadow||!(light.shadow.autoUpdate||light.shadow.needsUpdate))return;
   if((light as T.DirectionalLight).isDirectionalLight&&!sun)sun=light as T.DirectionalLight;
   else unsupported=true;
  });
  if(unsupported)return true;
  if(!sun)return false;
  const source=sun.shadow.camera;
  if(!finiteMatrix(source.projectionMatrix)||!affine(sun.matrixWorld)||!affine(sun.target.matrixWorld))return true;

  // Match LightShadow.updateMatrices without touching the actual shadow
  // camera, its cached map or the renderer's scheduling flags.
  this.camera.projectionMatrix.copy(source.projectionMatrix);
  this.camera.up.copy(source.up);
  this.camera.position.setFromMatrixPosition(sun.matrixWorld);
  this.target.setFromMatrixPosition(sun.target.matrixWorld);
  this.camera.lookAt(this.target);
  this.camera.updateMatrixWorld(true);
  this.projection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);
  this.view.frustum.setFromProjectionMatrix(this.projection,source.coordinateSystem,source.reversedDepth);
  this.view.margin=Math.max(.02,16*FLOAT32_EPSILON*(this.camera.position.length()+1));
  return finiteFrustum(this.view.frustum)?this.view:true;
 }
}

/** sqrt(||A||1 * ||A||infinity) bounds the largest linear stretch, including
 * shear. Matrix4.getMaxScaleOnAxis alone is not conservative for sheared parents.
 * Use the stored instance floats, plus a coordinate-scaled float32 margin for
 * the GPU's matrix arithmetic and clip-plane edge rounding. These tree shaders
 * change fragment tint/discard only; they do not displace vertices.
 */
function transformedSphere(source:T.Sphere,matrix:T.Matrix4,target:T.Sphere,intermediateMagnitude=0){
 if(!finiteSphere(source)||!affine(matrix))return false;
 const e=matrix.elements,a=Math.abs;
 const columns=Math.max(a(e[0])+a(e[1])+a(e[2]),a(e[4])+a(e[5])+a(e[6]),a(e[8])+a(e[9])+a(e[10]));
 const rows=Math.max(a(e[0])+a(e[4])+a(e[8]),a(e[1])+a(e[5])+a(e[9]),a(e[2])+a(e[6])+a(e[10]));
 target.center.copy(source.center).applyMatrix4(matrix);
 target.radius=source.radius*Math.sqrt(columns*rows);
 const x=a(source.center.x)+source.radius,y=a(source.center.y)+source.radius,z=a(source.center.z)+source.radius;
 const magnitude=Math.max(a(e[0])*x+a(e[4])*y+a(e[8])*z+a(e[12]),a(e[1])*x+a(e[5])*y+a(e[9])*z+a(e[13]),a(e[2])*x+a(e[6])*y+a(e[10])*z+a(e[14]),intermediateMagnitude);
 target.radius+=Math.max(.02,16*FLOAT32_EPSILON*(magnitude+target.radius+1));
 return finiteSphere(target);
}

function transformMagnitude(source:T.Sphere,instance:T.Matrix4,world:T.Matrix4){
 const a=Math.abs,e=instance.elements,w=world.elements;
 const x=a(source.center.x)+source.radius,y=a(source.center.y)+source.radius,z=a(source.center.z)+source.radius;
 const ix=a(e[0])*x+a(e[4])*y+a(e[8])*z+a(e[12]);
 const iy=a(e[1])*x+a(e[5])*y+a(e[9])*z+a(e[13]);
 const iz=a(e[2])*x+a(e[6])*y+a(e[10])*z+a(e[14]);
 // Absolute sums retain the precision budget when a parent and instance have
 // large opposing translations that cancel in their double-precision product.
 return Math.max(a(w[0])*ix+a(w[4])*iy+a(w[8])*iz+a(w[12]),a(w[1])*ix+a(w[5])*iy+a(w[9])*iz+a(w[13]),a(w[2])*ix+a(w[6])*iy+a(w[10])*iz+a(w[14]));
}

/** A render-only subset of the original distance-selected tree pairs.
 * capture() runs AFTER their existing selection writes all
 * source instances. render() runs in Scene.onBeforeRender, before Three uploads
 * instance attributes, and preserves matrix/colour/fade/density in lockstep.
 * Shadow refreshes retain casters outside the player view. No per-instance allocations or uploads occur for
 * unchanged membership; every actual view, including rotation in place, is tested.
 */
export interface TreeBoundsCounts {requests:number;transforms:number}
export class TreeInstanceVisibility {
 private readonly boundsCounts?:TreeBoundsCounts;
 private readonly parts:Part[];
 private readonly pool:'far'|'near';
 private readonly renderProbe?:NatureRenderProbe;
 private count=0;private shown=0;private ready=false;
 private indices=new Uint32Array(0);private bounds=new Float64Array(0);
 private readonly matrix=new T.Matrix4();private readonly combined=new T.Matrix4();
 private readonly projection=new T.Matrix4();private readonly frustum=new T.Frustum();
 private readonly sphere=new T.Sphere();private readonly union=new T.Sphere();
 private readonly paired=new T.Sphere();
 constructor(meshes:readonly T.InstancedMesh[],renderProbe?:NatureRenderProbe,pool:'far'|'near'='far',boundsCounts?:TreeBoundsCounts){
  this.boundsCounts=boundsCounts;
  this.renderProbe=renderProbe;this.pool=pool;
  this.parts=meshes.map(mesh=>{
   mesh.geometry.computeBoundingSphere();
   const base=mesh.geometry.boundingSphere!.clone();
   // Crown wind displaces local x/z by at most .12/.066 before instancing.
   if(pool==='near'&&mesh.userData.seasonalLeaf)base.radius+=.14;
   return {mesh,base,streams:[],saved:new Map(),matrix:undefined,world:new Float64Array(16).fill(NaN),localBounds:new LocalTreeBoundsCache(mesh.instanceMatrix.count)};
  });
  // Registration happens once. Capture, frustum selection, rendering and
  // uploads retain their exact original code and do no advisory work.
  for(const part of this.parts)selectedTreeSources.set(part.mesh,maximumCount=>{
   if(!this.ready||!part.matrix)throw Error('Selected tree source snapshot is not ready: '+(part.mesh.name||part.mesh.uuid));
   if(!Number.isSafeInteger(this.count)||this.count<0||this.count>maximumCount||part.matrix.source.length<this.count*16)
    throw Error('View observation exceeds bounded selected tree sources '+JSON.stringify({mesh:part.mesh.name||part.mesh.uuid,count:this.count,maximumCount,matrixElements:part.matrix.source.length}));
   return{count:this.count,matrices:part.matrix.source.slice(0,this.count*16)};
  });
  if(pool==='near')for(const part of this.parts){
   const mesh=part.mesh,raycast=mesh.raycast;
   // Camera compaction is render-only. Picking and photo occlusion retain
   // all selected sources and their original instance IDs in any direction.
   mesh.raycast=(ray,hits)=>{
    if(!this.ready||!part.matrix||this.count===this.shown)return raycast.call(mesh,ray,hits);
    const display=mesh.instanceMatrix.array,count=mesh.count;
    try{
     mesh.instanceMatrix.array=part.matrix.source;mesh.count=this.count;
     raycast.call(mesh,ray,hits);
    }finally{mesh.instanceMatrix.array=display;mesh.count=count;}
   };
  }
 }
 get sourceCount(){return this.count;}
 get visibleCount(){return this.shown;}

 capture(sourceIds?:ArrayLike<number>){
  this.ready=false;
  const count=this.parts[0]?.mesh.count??0;
  if(!Number.isSafeInteger(count)||count<0||this.parts.some(({mesh})=>mesh.count!==count||(mesh.castShadow&&this.pool==='far')||mesh.morphTexture))return;
  const hasSourceIds=sourceIds!=null&&Number.isSafeInteger(sourceIds.length)&&sourceIds.length>=count;
  if(this.indices.length<count){this.indices=new Uint32Array(count);this.bounds=new Float64Array(count*4);}
  let reuseLocalBounds=true,firstPart=true;
  for(const {mesh} of this.parts){
   if(!mesh.matrixWorld.equals(IDENTITY_WORLD))reuseLocalBounds=false;
   // A later malformed stream makes capture return before updateBounds. Do
   // not change the old paired bounds in that case; original writes and
   // validation below still run in their original order.
   const usable=(attribute:unknown)=>attribute instanceof T.BufferAttribute&&attribute.count>=count&&(attribute as T.InstancedBufferAttribute).meshPerAttribute===1;
   if(!usable(mesh.instanceMatrix)||(mesh.instanceColor&&!usable(mesh.instanceColor))||Object.values(mesh.geometry.attributes).some(attribute=>(attribute as T.InstancedBufferAttribute).isInstancedBufferAttribute&&!usable(attribute)))reuseLocalBounds=false;
  }
  for(const part of this.parts){
   const {mesh}=part;part.streams.length=0;
   const attributes=[mesh.instanceMatrix,...(mesh.instanceColor?[mesh.instanceColor]:[]),...Object.values(mesh.geometry.attributes).filter(attribute=>(attribute as T.InstancedBufferAttribute).isInstancedBufferAttribute)];
   for(const attribute of attributes){
    if(!(attribute instanceof T.BufferAttribute)||attribute.count<count||(attribute as T.InstancedBufferAttribute).meshPerAttribute!==1)return;
    let stream=part.saved.get(attribute);
    if(!stream||stream.source.length!==attribute.array.length){stream={attribute,source:attribute.array.slice()};part.saved.set(attribute,stream);}
    else stream.source.set(attribute.array.subarray(0,count*attribute.itemSize));
    // Three's first bufferData upload does not consume updateRanges. A later
    // full source rewrite must replace any earlier compact-prefix range even
    // when the new view keeps every source and render() makes no further edit.
    attribute.clearUpdateRanges();
    if(count)attribute.addUpdateRange(0,count*attribute.itemSize);
    attribute.needsUpdate=true;
    if(this.renderProbe?.active)this.renderProbe.marked('capture',count?count*attribute.itemSize*attribute.array.BYTES_PER_ELEMENT:attribute.array.byteLength);
    part.streams.push(stream);
    if(attribute===mesh.instanceMatrix)part.matrix=stream;
   }
   if(!part.matrix)return;
   // Photo-subject raycasts use this same mesh after the world render. Keep its
   // broad-phase sphere over ALL selected sources, not just the first view.
   part.localBounds.prepare(part.base,part.matrix.source);
   this.union.makeEmpty();let valid=true,transforms=0;
   for(let i=0;i<count;i++){
    this.matrix.fromArray(part.matrix.source,i*16);
    const sourceId=hasSourceIds?sourceIds![i]:undefined;
    if(!part.localBounds.restore(sourceId,i*16,this.sphere)){
     if(!transformedSphere(part.base,this.matrix,this.sphere)){valid=false;reuseLocalBounds=false;break;}
     transforms++;part.localBounds.remember(sourceId,i*16,this.sphere);
    }
    this.union.union(this.sphere);
    // With exact identity parents the existing world-bound transform repeats
    // this local transform. Reuse it only within this capture. An identity
    // product can change either sign of zero (including signed-zero parent
    // coefficients); keep the original fallback for any zero centre component.
    if(reuseLocalBounds){
     if(this.sphere.center.x===0||this.sphere.center.y===0||this.sphere.center.z===0)reuseLocalBounds=false;
     else{
      const j=i*4;
      if(firstPart)this.paired.copy(this.sphere);
      else{this.paired.center.set(this.bounds[j],this.bounds[j+1],this.bounds[j+2]);this.paired.radius=this.bounds[j+3];this.paired.union(this.sphere);}
      this.bounds[j]=this.paired.center.x;this.bounds[j+1]=this.paired.center.y;this.bounds[j+2]=this.paired.center.z;this.bounds[j+3]=this.paired.radius;
     }
    }
   }
   if(valid&&this.boundsCounts){this.boundsCounts.requests+=count;this.boundsCounts.transforms+=transforms;}
   if(!mesh.boundingSphere)mesh.boundingSphere=new T.Sphere();
   if(valid)mesh.boundingSphere.copy(this.union);
   else mesh.boundingSphere.set(new T.Vector3(),Infinity);
   firstPart=false;
  }
  this.count=this.shown=count;
  for(let i=0;i<count;i++)this.indices[i]=i;
  this.ready=true;
  if(reuseLocalBounds){for(const part of this.parts)part.world.set(part.mesh.matrixWorld.elements);}
  else this.updateBounds();
 }

 private updateBounds(){
  for(const part of this.parts)part.world.set(part.mesh.matrixWorld.elements);
  for(let i=0;i<this.count;i++){
   this.union.makeEmpty();let valid=true;
   for(const part of this.parts){
    this.matrix.fromArray(part.matrix!.source,i*16);
    this.combined.multiplyMatrices(part.mesh.matrixWorld,this.matrix);
    if(!transformedSphere(part.base,this.combined,this.sphere,transformMagnitude(part.base,this.matrix,part.mesh.matrixWorld))){valid=false;break;}
    this.union.union(this.sphere);
   }
   const j=i*4;
   this.bounds[j]=this.union.center.x;this.bounds[j+1]=this.union.center.y;this.bounds[j+2]=this.union.center.z;
   // A malformed bound or transform retains this source instance.
   this.bounds[j+3]=valid?this.union.radius:Infinity;
  }
 }

 render(camera:T.Camera,shadow:TreeShadowView|boolean=false){
  // The camera LCD uses a separate layer-only overlay pass. It must not empty
  // the world buffers and force their restoration on every subsequent frame.
  if(!this.ready||!this.parts.some(({mesh})=>mesh.layers.test(camera.layers)))return this.shown;
  if(this.parts.some(part=>part.world.some((value,i)=>value!==part.mesh.matrixWorld.elements[i])))this.updateBounds();
  // XR supplies ArrayCamera here. Keep the original source set for both eyes;
  // a single-eye or inferred combined frustum could drop visible geometry.
  let cull=shadow!==true&&!(camera as T.ArrayCamera).isArrayCamera&&cameraAffine(camera.matrixWorld)&&cameraAffine(camera.matrixWorldInverse)&&finiteMatrix(camera.projectionMatrix);
  if(cull){
   const worldDet=camera.matrixWorld.determinant(),projectionDet=camera.projectionMatrix.determinant();
   cull=Number.isFinite(worldDet)&&Math.abs(worldDet)>1e-12&&Number.isFinite(projectionDet)&&Math.abs(projectionDet)>1e-12;
  }
  if(cull){
   this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
   this.frustum.setFromProjectionMatrix(this.projection,T.WebGLCoordinateSystem,camera.reversedDepth);
   cull=finiteFrustum(this.frustum);
  }
  const e=camera.matrixWorld.elements,cameraMargin=16*FLOAT32_EPSILON*(Math.max(Math.abs(e[12]),Math.abs(e[13]),Math.abs(e[14]))+1);
  const shadowView=typeof shadow==='object'?shadow:undefined;
  let kept=0,dirtyStart=this.count,dirtyEnd=0;
  for(let i=0;i<this.count;i++){
   const j=i*4,radius=this.bounds[j+3];
   this.sphere.center.set(this.bounds[j],this.bounds[j+1],this.bounds[j+2]);this.sphere.radius=radius+cameraMargin;
   if(cull&&Number.isFinite(radius)&&!this.frustum.intersectsSphere(this.sphere)){
    this.sphere.radius=radius+(shadowView?.margin??0);
    if(!shadowView?.frustum.intersectsSphere(this.sphere))continue;
   }
   if(kept>=this.shown||this.indices[kept]!==i){
    dirtyStart=Math.min(dirtyStart,kept);dirtyEnd=kept+1;
   }
   this.indices[kept++]=i;
  }
  if(dirtyEnd||kept!==this.shown){
   if(this.renderProbe?.active)this.renderProbe.compact();
   for(const {mesh,streams} of this.parts){
    mesh.count=kept;
    for(const {attribute,source} of streams){
     const stride=attribute.itemSize,target=attribute.array;
     if(!dirtyEnd)continue;
     let first=dirtyStart;
     while(first<dirtyEnd){
      const start=this.indices[first];
      let end=first+1;
      while(end<dirtyEnd&&this.indices[end]===start+end-first)end++;
      if(end-first>=4)target.set(source.subarray(start*stride,(start+end-first)*stride),first*stride);
      else for(let i=first;i<end;i++)for(let n=0;n<stride;n++)target[i*stride+n]=source[this.indices[i]*stride+n];
      first=end;
     }
     // A previous render or capture may still have a range awaiting upload.
     // Keep that data dirty even if this view changes only the end of the pool.
     let uploadStart=dirtyStart*stride,uploadEnd=dirtyEnd*stride;
     for(const range of attribute.updateRanges){
      uploadStart=Math.min(uploadStart,range.start);
      uploadEnd=Math.max(uploadEnd,range.start+range.count);
     }
     attribute.clearUpdateRanges();
     attribute.addUpdateRange(uploadStart,uploadEnd-uploadStart);
     attribute.needsUpdate=true;
     if(this.renderProbe?.active)this.renderProbe.marked('compaction',(uploadEnd-uploadStart)*attribute.array.BYTES_PER_ELEMENT);
    }
   }
   this.shown=kept;
  }
  if(this.renderProbe?.active)this.renderProbe.pool(this.count,this.shown);
  return this.shown;
 }
}

export {TreeInstanceVisibility as FarTreeVisibility};
