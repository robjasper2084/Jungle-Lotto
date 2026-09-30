import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
// FileReader is only used to package the generated GLB bytes in Node.
globalThis.FileReader=class {async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}};
const root=new URL('../../../exports/elmwood/',import.meta.url),report=[];
for(const name of ['white-oak','red-maple','american-elm','white-pine','weeping-willow']){
 const bytes=await fs.readFile(new URL(name+'.glb',root)),model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'' )).scene;
 model.traverse(o=>{if(typeof o.userData.pivot==='string'){o.userData.pivotDescription=o.userData.pivot;delete o.userData.pivot;}});
 let before=0,after=0;
 model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;for(const [key,attribute]of Object.entries(g.attributes)){if(attribute.isInterleavedBufferAttribute){const data=new Float32Array(attribute.count*attribute.itemSize);for(let i=0;i<attribute.count;i++)for(let k=0;k<attribute.itemSize;k++)data[i*attribute.itemSize+k]=attribute.getComponent(i,k);g.setAttribute(key,new T.BufferAttribute(data,attribute.itemSize));}}before+=g.index.count/3;
 if(o.material.name.startsWith('leaf')){
   // Keep complete connected leaf cards, evenly distributed through the crown.
   const parent=Array.from({length:g.attributes.position.count},(_,i)=>i),find=x=>parent[x]===x?x:(parent[x]=find(parent[x]));
   const index=g.index.array;for(let i=0;i<index.length;i+=3){const a=find(index[i]);parent[find(index[i+1])]=a;parent[find(index[i+2])]=a;}
   const order=new Map(),kept=[];for(let i=0;i<index.length;i+=3){const r=find(index[i]);if(!order.has(r))order.set(r,order.size);if(order.get(r)%3===0)kept.push(index[i],index[i+1],index[i+2]);}
   const used=new Map();for(const id of new Set(kept)){const r=find(id);if(!used.has(r))used.set(r,[]);used.get(r).push(id);}const p=g.attributes.position;
   for(const ids of used.values()){const centre=new T.Vector3();for(const i of ids)centre.add(new T.Vector3().fromBufferAttribute(p,i));centre.multiplyScalar(1/ids.length);for(const i of ids){const v=new T.Vector3().fromBufferAttribute(p,i).sub(centre).multiplyScalar(1.55).add(centre);p.setXYZ(i,v.x,v.y,v.z);}}
   g.setIndex(kept);g.computeBoundingBox();g.computeBoundingSphere();o.geometry=g;
 }else{o.geometry=new SimplifyModifier().modify(g,Math.floor(g.attributes.position.count*.72));o.geometry.computeVertexNormals();}
 after+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3;
 });
 const result=await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:false});const check=(await new GLTFLoader().parseAsync(result,'')).scene;check.updateMatrixWorld(true);check.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))throw new Error('Invalid LOD transform '+name);});await fs.writeFile(new URL(name+'-far.glb',root),Buffer.from(result));report.push({name,before,after});console.log(report.at(-1));
}
await fs.writeFile(new URL('lod-report.json',root),JSON.stringify(report,null,2));
