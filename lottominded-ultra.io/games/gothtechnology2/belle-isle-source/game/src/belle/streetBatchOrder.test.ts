import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {addStreetDetails} from './streetDetails.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {preserveStreetBatchOrder} from './streetBatchOrder.ts';
import {batchStaticArchitecture} from './staticArchitectureBatch.ts';
import type {StreetPlan} from './streetPlan.ts';

function canvasFixture(run:()=>void){
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');
 const ctx={fillRect(){},strokeRect(){},fillText(){},measureText(text:string){return {width:text.length*8};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>ctx})}});
 try{run();}finally{if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}
}
function fullPlan():StreetPlan{
 const plan=JSON.parse(readFileSync(new URL('../../public/belle/street-details.json',import.meta.url),'utf8'));
 const bytes=readFileSync(new URL('../../public/belle/street-details.bin',import.meta.url));
 const data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
 plan.boxes=[];
 for(let i=0;i<data.length;i+=plan.stride)plan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:plan.materials[data[i+7]],grade:data[i+8]});
 return plan;
}
type NativeBatch=T.BatchedMesh&{_multiDrawCount:number;_multiDrawCounts:Int32Array;_indirectTexture:T.DataTexture};
function cameraAt(x:number,z:number,yaw:number){
 const camera=new T.PerspectiveCamera(58,1440/900,.1,3500);
 camera.position.set(x,7,z);camera.lookAt(x+Math.sin(yaw)*150,2,z+Math.cos(yaw)*150);
 camera.updateMatrixWorld(true);return camera;
}
function frustumFor(camera:T.Camera){return new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}

test('full shipped street plan keeps every vertex, normal, material, bound and native source draw order',()=>canvasFixture(()=>{
 const scene=new T.Scene(),street=addStreetDetails(scene,fullPlan());
 // World surface preparation can replace a factory material with a decorated
 // clone. Eligibility must follow the authored tile kind, not that old pointer.
 for(const object of scene.children)if(object instanceof T.Mesh&&object.name.endsWith(',metal'))object.material=(object.material as T.Material).clone();
 const sources=street.batchSources();
 const sourceSet=new Set(sources),groups=new Map<T.BatchedMesh,T.Mesh[]>();
 const palette=new StaticPaletteBatch(sources,sourceSet,(batch,group)=>{groups.set(batch,group);preserveStreetBatchOrder(batch,group);});
 scene.add(palette.root);scene.updateMatrixWorld(true);
 assert(sources.length>300);assert(palette.stats.batches>=4&&palette.stats.batches<=6);
 const allTiles=scene.children.filter((o):o is T.Mesh=>o instanceof T.Mesh&&o.name.startsWith('Street detail '));
 assert(allTiles.filter(o=>o.name.endsWith(',metal')).every(o=>!sourceSet.has(o)));
 assert.equal(sourceSet.size,allTiles.filter(o=>!o.name.endsWith(',metal')).length);
 for(const [batch,group] of groups){
  assert.equal(batch.instanceCount,group.length);assert.equal(batch.material,group[0].material);
  assert.equal(batch.castShadow,false);assert.equal(batch.receiveShadow,true);assert.equal((batch as T.BatchedMesh&{_colorsTexture:T.DataTexture|null})._colorsTexture,null);
  assert.equal(batch.renderOrder,group[0].renderOrder);assert.equal(batch.layers.mask,group[0].layers.mask);
  for(const [i,source] of group.entries()){
   assert.equal(source.parent,scene);assert.equal(source.material,batch.material);
   assert.equal((source.material as T.Material).polygonOffset,false);
   assert.deepEqual(batch.getMatrixAt(i,new T.Matrix4()).elements,source.matrixWorld.elements);
   const id=batch.getGeometryIdAt(i),range=batch.getGeometryRangeAt(id)!;
   assert.equal(range.vertexCount,source.geometry.attributes.position.count);
   for(const key of ['position','normal']){
    const a=source.geometry.getAttribute(key),b=batch.geometry.getAttribute(key);
    const bytesA=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
    const bytesB=new Uint8Array(b.array.buffer,b.array.byteOffset+range.vertexStart*a.itemSize*4,a.array.byteLength);
    assert.deepEqual(bytesB,bytesA,'Every copied '+key+' byte must be identical');
   }
   assert.deepEqual(batch.getBoundingSphereAt(id,new T.Sphere()),source.geometry.boundingSphere);
  }
 }
 const receipts:{x:number;z:number;shadow:boolean;nativeDraws:number;batchedDraws:number;triangles:number}[]=[];
 for(const [x,z,yaw] of [[350,-100,1.1],[800,500,.8],[1330,1175,2.1],[2100,1400,-.5],[3200,700,-2.5]])for(const shadow of [false,true]){
  street.update(x,z);const camera=cameraAt(x,z,yaw),frustum=frustumFor(camera);
  const shown=new Map(sources.map(s=>[s,s.visible]));
  let nativeDraws=0,batchedDraws=0,triangles=0;
  palette.beginView(shadow,camera);
  for(const [batch,group] of groups){
   const expected=group.filter(s=>shown.get(s)&&frustum.intersectsObject(s));
   const projected=new Map(expected.map(s=>[s,new T.Vector3().copy(s.geometry.boundingSphere!.center).applyMatrix4(s.matrixWorld).project(camera).z]));
   expected.sort((a,b)=>projected.get(a)!==projected.get(b)!?projected.get(a)!-projected.get(b)!:a.id-b.id);
   const actual:T.Mesh[]=[];
   if(batch.visible&&frustum.intersectsObject(batch)){
    batch.onBeforeRender({} as T.WebGLRenderer,scene,camera,batch.geometry,batch.material as T.Material,null as never);
    const native=batch as NativeBatch,ids=native._indirectTexture.image.data as Uint32Array;
    for(let i=0;i<native._multiDrawCount;i++)actual.push(group[ids[i]]);
    if(native._multiDrawCount)batchedDraws++;
    assert.equal([...native._multiDrawCounts.slice(0,native._multiDrawCount)].reduce((a,b)=>a+b,0),actual.reduce((n,s)=>n+s.geometry.attributes.position.count,0));
   }
   // Groups with only one eligible source stay on their original native path.
   actual.push(...group.filter(s=>s.visible&&frustum.intersectsObject(s)));
   batchedDraws+=group.filter(s=>s.visible&&frustum.intersectsObject(s)).length;
   assert.deepEqual(actual.map(s=>s.id),expected.map(s=>s.id),'Native projected-depth/ID order and frustum membership');
   assert.equal(batch.castShadow,false);nativeDraws+=expected.length;
   triangles+=expected.reduce((n,s)=>n+s.geometry.attributes.position.count/3,0);
  }
  palette.endView();for(const s of sources)assert.equal(s.visible,shown.get(s));
  receipts.push({x,z,shadow,nativeDraws,batchedDraws,triangles});
 }
 assert(receipts.some(r=>r.nativeDraws>=10&&r.batchedDraws*2<r.nativeDraws),'A real mapped view must reduce native submissions');
 console.info('Street native submission receipts '+JSON.stringify(receipts));
 palette.dispose();assert.equal(palette.root.parent,null);assert(sources.every(s=>s.parent===scene));
}));

test('street batching retains original fallback, callbacks, live colors and visibility controls',()=>canvasFixture(()=>{
 const scene=new T.Scene();
 const street=addStreetDetails(scene,{boxes:[0,260,520].map(x=>({x,y:2,z:0,w:5,h:.01,l:8,yaw:0,material:'white'})),signs:[],stats:{},notes:[]});
 const sources=street.batchSources(),original=sources.map(s=>({geometry:s.geometry,material:s.material}));
 const renderer={extensions:{has:()=>true},xr:{isPresenting:false},shadowMap:{enabled:true,autoUpdate:true,needsUpdate:true}} as unknown as T.WebGLRenderer;
 const callback=()=>{};sources[2].onBeforeRender=callback;
 const palette=batchStaticArchitecture(scene,renderer,[],()=>false,undefined,sources)!;
 assert.equal(palette.stats.sourceDraws,2);assert.equal(palette.root.userData.warmIslandShaders,true);
 const batch=palette.root.children[0] as T.BatchedMesh,camera=cameraAt(128,0,.4);
 const material=sources[0].material as T.MeshStandardMaterial;material.color.setRGB(.2,.3,.4);
 assert.equal(batch.material,material);assert.deepEqual((batch.material as T.MeshStandardMaterial).color,material.color);
 sources[0].geometry=new T.PlaneGeometry(3,4);sources[0].geometry.computeBoundingSphere();
 palette.beginView(false,camera);assert.equal(sources[0].visible,true);assert.equal(batch.visible,false);palette.endView();
 sources[0].geometry=original[0].geometry;sources[0].material=material.clone();
 palette.beginView(false,camera);assert.equal(sources[0].visible,true);assert.equal(batch.visible,false);palette.endView();
 sources[0].material=original[0].material;
 street.update(4000,4000);palette.beginView(true,camera);assert(sources.every(s=>!s.visible));assert.equal(batch.visible,false);palette.endView();
 assert.equal(sources[2].onBeforeRender,callback);palette.dispose();
}));
