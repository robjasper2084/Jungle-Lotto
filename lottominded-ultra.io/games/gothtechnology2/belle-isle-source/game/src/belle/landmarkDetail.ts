import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
type Entry={mesh:number;primitive:number;vertices:number;originalCount:number;hash:number;count:number;offset:number;length:number;error?:number};
export const indexHash=(array:ArrayLike<number>)=>{let h=2166136261;for(let i=0;i<array.length;i++)h=Math.imul(h^array[i],16777619);return h>>>0;};
/** Preserve every original vertex attribute; only the display index set changes. */
export function detailGeometry(original:T.BufferGeometry,e:Entry,indices:Uint32Array){
 if(original.getAttribute('position').count!==e.vertices||original.index?.count!==e.originalCount||indexHash(original.index.array)!==e.hash||indices.length!==e.count||indices.length%3||indices.some(v=>v>=e.vertices))return null;
 const g=new T.BufferGeometry();for(const [name,a]of Object.entries(original.attributes))g.setAttribute(name,a);
 g.setIndex(new T.BufferAttribute(indices,1));g.boundingBox=original.boundingBox?.clone()??null;g.boundingSphere=original.boundingSphere?.clone()??null;return g;
}
export class LandmarkDetail{
 private indices?:Promise<void>;
 private batches?:Promise<void>;
 private palette?:StaticPaletteBatch;
 private splitActive=false;
 readonly stats={simplified:0,sourceDraws:0,batches:0};
 private items:{mesh:T.Mesh;full:T.BufferGeometry;reduced:T.BufferGeometry;bounds:T.Sphere;error:number}[]=[];
 private asset:GLTF;constructor(asset:GLTF){this.asset=asset;}
 private prepareIndices(){return this.indices??=this.load().catch(error=>{console.warn('Landmark detail unavailable; using original models.',error);});}
 private async load(){
  const responses=await Promise.all([fetch('./belle/landmark-detail.json'),fetch('./belle/landmark-detail.bin')]);if(responses.some(r=>!r.ok))throw Error('Landmark detail download failed');
  const [meta,buffer]=await Promise.all([responses[0].json(),responses[1].arrayBuffer()]);if(meta.version!==1)throw Error('Landmark detail version');await MeshoptDecoder.ready;
  const meshes=new Map<string,T.Mesh[]>();this.asset.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const a=this.asset.parser.associations.get(o) as {meshes?:number;primitives?:number}|undefined;if(a?.meshes===undefined)return;const key=a.meshes+':'+(a.primitives??0);meshes.set(key,[...(meshes.get(key)??[]),o]);});
  for(const e of meta.entries as Entry[]){
   const targets=meshes.get(e.mesh+':'+e.primitive);if(!targets?.length)continue;
   const indices=new Uint32Array(e.count);MeshoptDecoder.decodeIndexSequence(new Uint8Array(indices.buffer),e.count,4,new Uint8Array(buffer,e.offset,e.length));
   for(const mesh of targets){
    const full=mesh.geometry,reduced=detailGeometry(full,e,indices);if(!reduced)continue;
    mesh.updateWorldMatrix(true,false);if(!full.boundingSphere)full.computeBoundingSphere();
    const matrix=mesh.matrixWorld,axis=matrix.elements;
    // The matrix row/column norm bound also covers a scaled or sheared parent.
    const columns=Math.max(...[0,4,8].map(i=>Math.abs(axis[i])+Math.abs(axis[i+1])+Math.abs(axis[i+2])));
    const rows=Math.max(...[0,1,2].map(i=>Math.abs(axis[i])+Math.abs(axis[i+4])+Math.abs(axis[i+8])));
    const scale=Math.sqrt(rows*columns),bounds=full.boundingSphere!.clone();
    bounds.center.applyMatrix4(matrix);bounds.radius*=scale;
    const raycast=mesh.raycast;
    mesh.raycast=function(ray,hits){
     const display=this.geometry;
     this.geometry=full;
     try{raycast.call(this,ray,hits);}finally{this.geometry=display;}
    };
    this.items.push({mesh,full,reduced,bounds,error:scale*(e.error??Infinity)});
   }
  }
  this.stats.simplified=this.items.length;
 }
 /** Select the exported display indices only while drawing a distant world view.
  * Full bounds, geometry for photo/collision queries, materials and all vertex
  * attributes stay with the source mesh. Normal views incur no palette batches. */
 async prepareDistant(scene:T.Scene){
  await this.prepareIndices();
  if(!this.items.length)return;
  const pixels=new T.Vector2(),before=scene.onBeforeRender,after=scene.onAfterRender;
  scene.onBeforeRender=(...args)=>{
   before.apply(scene,args);
   if(this.splitActive)return;
   const [renderer,,camera,target]=args,view=camera as T.PerspectiveCamera;
   const perspective=view.isPerspectiveCamera&&!(camera as T.ArrayCamera).isArrayCamera&&!renderer.xr.isPresenting&&!target;
   const p=camera.projectionMatrix.elements,eye=camera.matrixWorldInverse.elements;
   renderer.getDrawingBufferSize(pixels);
   // Project the exported object-space error at the nearest possible depth
   // of the sphere. Include the lateral motion from changing that depth at
   // a viewport edge. A tighter FOV or a larger buffer retains finer detail.
   const focal=pixelErrorScale(p,pixels.x,pixels.y);
   for(const {mesh,full,reduced,bounds,error} of this.items){
    const c=bounds.center,near=-(eye[2]*c.x+eye[6]*c.y+eye[10]*c.z+eye[14])-bounds.radius;
    mesh.geometry=perspective&&mesh.visible&&!mesh.castShadow&&subpixelLandmark(error,near,focal)?reduced:full;
   }
  };
  scene.onAfterRender=(...args)=>{
   if(!this.splitActive)for(const item of this.items)item.mesh.geometry=item.full;
   after.apply(scene,args);
  };
 }
 prepare(){return this.batches??=this.prepareIndices().then(()=>this.buildPalette()).catch(error=>{
  console.warn('Split-screen landmark batching unavailable; using original meshes.',error);
 });}
 private buildPalette(){
  this.setActive(true);const sources:T.Mesh[]=[];this.asset.scene.traverse(o=>{if(o instanceof T.Mesh)sources.push(o);});
  try{this.palette=new StaticPaletteBatch(sources);}finally{this.setActive(false);}
  this.asset.scene.parent?.add(this.palette.root);Object.assign(this.stats,this.palette.stats);
 }
 get batchRoot(){return this.palette?.root;}
 get isSplitActive(){return this.splitActive;}
 beginView(){this.palette?.beginView();}
 endView(){this.palette?.endView();}
 setActive(active:boolean){this.splitActive=active;for(const i of this.items)i.mesh.geometry=active?i.reduced:i.full;}
}

function pixelErrorScale(p:readonly number[],width:number,height:number){
 return Math.hypot(width*(Math.abs(p[0])+1+Math.abs(p[8])),height*(Math.abs(p[5])+1+Math.abs(p[9])))*.5;
}
/** Keep the authored close view and cap the projected simplification error
 * at half a drawing-buffer pixel. Invalid metadata falls back to full detail. */
export function subpixelLandmark(error:number,near:number,pixelScale:number){
 return Number.isFinite(error)&&error>=0&&Number.isFinite(near)&&near>64+error&&
  Number.isFinite(pixelScale)&&pixelScale>0&&error*pixelScale<=(near-error)*.5;
}
