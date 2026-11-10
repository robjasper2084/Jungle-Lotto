import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import * as T from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
type Entry={mesh:number;primitive:number;vertices:number;originalCount:number;hash:number;count:number;offset:number;length:number};
export const indexHash=(array:ArrayLike<number>)=>{let h=2166136261;for(let i=0;i<array.length;i++)h=Math.imul(h^array[i],16777619);return h>>>0;};
/** Preserve every original vertex attribute; only the display index set changes. */
export function detailGeometry(original:T.BufferGeometry,e:Entry,indices:Uint32Array){
 if(original.getAttribute('position').count!==e.vertices||original.index?.count!==e.originalCount||indexHash(original.index.array)!==e.hash||indices.length!==e.count||indices.length%3||indices.some(v=>v>=e.vertices))return null;
 const g=new T.BufferGeometry();for(const [name,a]of Object.entries(original.attributes))g.setAttribute(name,a);
 g.setIndex(new T.BufferAttribute(indices,1));g.boundingBox=original.boundingBox?.clone()??null;g.boundingSphere=original.boundingSphere?.clone()??null;return g;
}
export class LandmarkDetail{
 private task?:Promise<void>;
 private palette?:StaticPaletteBatch;
 readonly stats={simplified:0,sourceDraws:0,batches:0};
 private items:{mesh:T.Mesh;full:T.BufferGeometry;reduced:T.BufferGeometry}[]=[];
 private asset:GLTF;constructor(asset:GLTF){this.asset=asset;}
 prepare(){return this.task??=this.load().catch(error=>{console.warn('Split-screen landmark detail unavailable; using original models.',error);});}
 private async load(){
  const responses=await Promise.all([fetch('./belle/landmark-detail.json'),fetch('./belle/landmark-detail.bin')]);if(responses.some(r=>!r.ok))throw Error('Landmark detail download failed');
  const [meta,buffer]=await Promise.all([responses[0].json(),responses[1].arrayBuffer()]);if(meta.version!==1)throw Error('Landmark detail version');await MeshoptDecoder.ready;
  const meshes=new Map<string,T.Mesh[]>();this.asset.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const a=this.asset.parser.associations.get(o) as {meshes?:number;primitives?:number}|undefined;if(a?.meshes===undefined)return;const key=a.meshes+':'+(a.primitives??0);meshes.set(key,[...(meshes.get(key)??[]),o]);});
  for(const e of meta.entries as Entry[]){
   const targets=meshes.get(e.mesh+':'+e.primitive);if(!targets?.length)continue;
   const indices=new Uint32Array(e.count);MeshoptDecoder.decodeIndexSequence(new Uint8Array(indices.buffer),e.count,4,new Uint8Array(buffer,e.offset,e.length));
   for(const mesh of targets){const full=mesh.geometry,reduced=detailGeometry(full,e,indices);if(!reduced)continue;this.items.push({mesh,full,reduced});}
  }
  this.stats.simplified=this.items.length;
  this.setActive(true);const sources:T.Mesh[]=[];this.asset.scene.traverse(o=>{if(o instanceof T.Mesh)sources.push(o);});
  try{this.palette=new StaticPaletteBatch(sources);}finally{this.setActive(false);}
  this.asset.scene.parent?.add(this.palette.root);Object.assign(this.stats,this.palette.stats);
 }
 get batchRoot(){return this.palette?.root;}
 beginView(){this.palette?.beginView();}
 endView(){this.palette?.endView();}
 setActive(active:boolean){for(const i of this.items)i.mesh.geometry=active?i.reduced:i.full;}
}
