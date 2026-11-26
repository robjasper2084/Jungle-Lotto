import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {addStreetDetails} from './streetDetails.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {batchStaticArchitecture} from './staticArchitectureBatch.ts';
import type {StreetBox,StreetPlan} from './streetPlan.ts';

function canvasFixture(){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context={fillRect(){},strokeRect(){},fillText(){},measureText(text:string){return{width:text.length*10};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(name:string){assert.equal(name,'canvas');return{width:0,height:0,getContext:()=>context};}}});
 return()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');};
}
function dispose(scene:T.Scene){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
 scene.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof T.BatchedMesh)o.dispose();}});
 for(const g of geometries)g.dispose();for(const m of materials){(m as T.MeshStandardMaterial).map?.dispose();m.dispose();}
}
function shippedPlan():StreetPlan{
 const meta=JSON.parse(readFileSync(new URL('../../public/belle/street-details.json',import.meta.url),'utf8')) as StreetPlan&{stride:number;materials:StreetBox['material'][]};
 const bytes=readFileSync(new URL('../../public/belle/street-details.bin',import.meta.url));
 const floats=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);meta.boxes=[];
 for(let i=0;i<floats.length;i+=meta.stride)meta.boxes.push({x:floats[i],y:floats[i+1],z:floats[i+2],w:floats[i+3],h:floats[i+4],l:floats[i+5],yaw:floats[i+6],material:meta.materials[floats[i+7]],grade:floats[i+8]});
 return meta;
}
function simplePlan():StreetPlan{
 const kinds:StreetBox['material'][]=['white','yellow','curb','gutter','metal','green','tactile'];
 return{boxes:[20,276,532].flatMap((x,tile)=>kinds.map((material,i)=>({material,x:x+i*2,y:2.12,z:20,w:.5,h:material==='curb'?.15:.012,l:4,yaw:.1*tile,grade:.02*tile}))),signs:[],stats:{},notes:[]};
}
function matches(palette:StaticPaletteBatch,sources:readonly T.Mesh[]){
 return palette.root.children.map(object=>{
  assert(object instanceof T.BatchedMesh);
  return{batch:object,sources:sources.filter(source=>source.material===object.material)};
 });
}

test('street batching exposes original tile identities without serializing scene objects or touching signs',()=>{
 const restore=canvasFixture(),scene=new T.Scene();
 try{
  const street=addStreetDetails(scene,simplePlan()),children=[...scene.children],sources=street.batchSources();
  assert.equal(sources.length,21);assert.equal(street.batches,24);assert.deepEqual(street.batchSources(),sources);
  assert(sources.every(source=>source.parent===scene&&source.name.startsWith('Street detail ')));
  assert.equal(children.filter(object=>!sources.includes(object as T.Mesh)).length,3);
  assert.deepEqual(JSON.parse(JSON.stringify(street)),{batches:24,signs:0,boxes:21,atlas:[1024,128]});
  const geometries=sources.map(source=>source.geometry),materials=sources.map(source=>source.material);
  street.update(128,128);street.update(2000,2000);street.update(128,128);
  assert.deepEqual(scene.children,children);assert.deepEqual(sources.map(source=>source.geometry),geometries);assert.deepEqual(sources.map(source=>source.material),materials);
 }finally{dispose(scene);restore();}
});

test('actual shipped street batches preserve every vertex, normal, material, bound and identity instance',()=>{
 const restore=canvasFixture(),scene=new T.Scene();let palette:StaticPaletteBatch|undefined;
 try{
  const street=addStreetDetails(scene,shippedPlan()),sources=street.batchSources();
  assert(sources.length>400,'Use the full shipped street plan');
  const originals=sources.map(source=>({geometry:source.geometry,material:source.material,parent:source.parent,shadow:source.castShadow,receive:source.receiveShadow,order:source.renderOrder,layers:source.layers.mask}));
  palette=new StaticPaletteBatch([...sources],new Set(sources));
  assert.equal(palette.stats.sourceDraws,sources.length);assert.equal(palette.stats.batches,6);
  let vertices=0;
  for(const {batch,sources:group} of matches(palette,sources)){
   assert.equal(batch.instanceCount,group.length);assert.equal(batch.sortObjects,false);assert.equal(batch.perObjectFrustumCulled,true);
   assert.equal(batch.geometry.index,null);assert.equal(batch.castShadow,false);assert.equal(batch.receiveShadow,true);
   for(const [i,source] of group.entries()){
    const geometryId=batch.getGeometryIdAt(i),range=batch.getGeometryRangeAt(geometryId);
    assert(range,'Every source tile must retain a valid geometry range');
    assert.equal(range.vertexCount,source.geometry.attributes.position.count);assert.equal(range.count,source.geometry.attributes.position.count);
    assert.deepEqual(batch.getMatrixAt(i,new T.Matrix4()).elements,new T.Matrix4().elements);
    assert.equal(batch.material,source.material);assert.equal(batch.layers.mask,source.layers.mask);assert.equal(batch.renderOrder,source.renderOrder);
    for(const [name,attribute] of Object.entries(source.geometry.attributes)){
     const copied=batch.geometry.getAttribute(name);assert.equal(copied.itemSize,attribute.itemSize);assert.equal(copied.normalized,attribute.normalized);
     const start:number=range.vertexStart*attribute.itemSize,end:number=start+attribute.count*attribute.itemSize;
     assert.deepEqual(copied.array.slice(start,end),attribute.array,source.name+' '+name);
    }
    const sphere=batch.getBoundingSphereAt(geometryId,new T.Sphere());assert.deepEqual(sphere,source.geometry.boundingSphere);
    vertices+=range.vertexCount;
   }
  }
  for(const [i,source] of sources.entries())assert.deepEqual({geometry:source.geometry,material:source.material,parent:source.parent,shadow:source.castShadow,receive:source.receiveShadow,order:source.renderOrder,layers:source.layers.mask},originals[i]);
  console.log(JSON.stringify({streetBatchProof:'exact shipped geometry storage',sourceTiles:sources.length,materialBatches:palette.stats.batches,vertices,triangles:vertices/3}));
 }finally{palette?.dispose();dispose(scene);restore();}
});

test('exact batches follow original tile distance boundaries and restore all native visibility',()=>{
 const restore=canvasFixture(),scene=new T.Scene();let palette:StaticPaletteBatch|undefined;
 try{
  const street=addStreetDetails(scene,simplePlan()),sources=street.batchSources();palette=new StaticPaletteBatch([...sources],new Set(sources));
  const groups=matches(palette,sources);
  for(const [x,z] of [[128,128],[128+440,128],[128+440-1e-8,128],[384,128],[640,128],[2000,2000]])for(const shadows of [false,true]){
   street.update(x,z);const before=sources.map(source=>source.visible);palette.beginView(shadows);
   for(const {batch,sources:group} of groups){
    const expected=group.map(source=>before[sources.indexOf(source)]),useBatch=expected.filter(Boolean).length>=2;
    assert.equal(batch.visible,useBatch);
    for(const [i,source] of group.entries()){
     assert.equal(batch.getVisibleAt(i),useBatch&&expected[i]);
     assert.equal(source.visible,expected[i]&&!useBatch);
    }
   }
   palette.endView();assert.deepEqual(sources.map(source=>source.visible),before);
  }
 }finally{palette?.dispose();dispose(scene);restore();}
});

test('native architecture integration leaves unsupported hardware and special views on original street draws',()=>{
 const restore=canvasFixture(),scene=new T.Scene();let palette:StaticPaletteBatch|undefined;
 try{
  const street=addStreetDetails(scene,simplePlan()),sources=street.batchSources();street.update(384,128);
  const before=scene.onBeforeRender,after=scene.onAfterRender,children=[...scene.children],visibility=sources.map(source=>source.visible);
  let supported=false,split=false;
  const renderer={extensions:{has:(name:string)=>name==='WEBGL_multi_draw'&&supported},xr:{isPresenting:false},shadowMap:{enabled:true,autoUpdate:false,needsUpdate:true}} as unknown as T.WebGLRenderer;
  assert.equal(batchStaticArchitecture(scene,renderer,[],()=>split,undefined,sources),undefined);
  assert.equal(scene.onBeforeRender,before);assert.equal(scene.onAfterRender,after);assert.deepEqual(scene.children,children);
  supported=true;palette=batchStaticArchitecture(scene,renderer,[],()=>split,undefined,sources);assert(palette);
  const invoke=(phase:'before'|'after',camera:T.Camera,target:unknown=null)=>Reflect.apply(phase==='before'?scene.onBeforeRender:scene.onAfterRender,scene,[renderer,scene,camera,target]);
  for(const kind of ['split','xr','target','orthographic']){
   split=kind==='split';renderer.xr.isPresenting=kind==='xr';
   const camera=kind==='orthographic'?new T.OrthographicCamera():new T.PerspectiveCamera(),target=kind==='target'?{}:null;
   invoke('before',camera,target);assert.equal(palette.root.visible,false);assert.deepEqual(sources.map(source=>source.visible),visibility);invoke('after',camera,target);
  }
  split=false;renderer.xr.isPresenting=false;const camera=new T.PerspectiveCamera();
  invoke('before',camera);assert.equal(palette.root.visible,true);assert(sources.every(source=>!source.visible));
  invoke('after',camera);assert.equal(palette.root.visible,false);assert.deepEqual(sources.map(source=>source.visible),visibility);
 }finally{palette?.dispose();dispose(scene);restore();}
});

test('source replacement falls back without hiding the changed geometry or material',()=>{
 const restore=canvasFixture(),scene=new T.Scene();let palette:StaticPaletteBatch|undefined;
 try{
  const street=addStreetDetails(scene,simplePlan()),sources=street.batchSources();street.update(384,128);
  palette=new StaticPaletteBatch([...sources],new Set(sources));const groups=matches(palette,sources);
  const changed=groups[0].sources[0],old=changed.geometry;changed.geometry=old.clone();
  palette.beginView(true);assert.equal(changed.visible,true);assert.equal(groups[0].batch.getVisibleAt(0),false);palette.endView();
  changed.geometry.dispose();changed.geometry=old;
  const material=changed.material;changed.material=(material as T.Material).clone();
  palette.beginView(false);assert.equal(changed.visible,true);assert.equal(groups[0].batch.getVisibleAt(0),false);palette.endView();
  changed.material.dispose();changed.material=material;
 }finally{palette?.dispose();dispose(scene);restore();}
});

test('street integration excludes custom draw callbacks and nonidentity placement before batching',()=>{
 const restore=canvasFixture(),scene=new T.Scene();let palette:StaticPaletteBatch|undefined;
 try{
  const street=addStreetDetails(scene,simplePlan()),sources=street.batchSources();street.update(384,128);
  const material=sources[0].material,group=sources.filter(source=>source.material===material);assert.equal(group.length,3);
  let callbacks=0;group[0].onBeforeRender=()=>{callbacks++;};group[1].position.x=3;
  const renderer={extensions:{has:()=>true},xr:{isPresenting:false},shadowMap:{enabled:true,autoUpdate:false,needsUpdate:true}} as unknown as T.WebGLRenderer;
  palette=batchStaticArchitecture(scene,renderer,[],()=>false,undefined,sources);assert(palette);
  assert.equal(palette.stats.sourceDraws,18);assert.equal(palette.stats.batches,6);
  assert(palette.root.children.every(object=>(object as T.BatchedMesh).material!==material));
  const camera=new T.PerspectiveCamera();Reflect.apply(scene.onBeforeRender,scene,[renderer,scene,camera,null]);
  assert(group.every(source=>source.visible));assert.equal(group[1].position.x,3);assert.equal(callbacks,0);
  Reflect.apply(scene.onAfterRender,scene,[renderer,scene,camera,null]);assert(sources.every(source=>source.visible));
 }finally{palette?.dispose();dispose(scene);restore();}
});
