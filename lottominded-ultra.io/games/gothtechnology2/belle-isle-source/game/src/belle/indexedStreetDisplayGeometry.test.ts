import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {prepareIndexedStreetDisplayGroup} from './indexedStreetDisplayGeometry.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {batchStaticArchitecture} from './staticArchitectureBatch.ts';
import {preserveStreetBatchOrder} from './streetBatchOrder.ts';
import {addStreetDetails} from './streetDetails.ts';
import type {StreetPlan} from './streetPlan.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {loadRealisticMaterials,applyRealisticMaterials} from './realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from './photoReferenceSurfaces.ts';
import {dressSunsetGround} from './sunsetGround.ts';

const bytes=(attribute:T.BufferAttribute|T.InterleavedBufferAttribute)=>Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength);
function geometry(positions:number[],normals=positions.map((_,i)=>i%3===1?1:0)){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.computeBoundingSphere();return g;
}
function snapshot(g:T.BufferGeometry){return{
 descriptors:Object.getOwnPropertyDescriptors(g),attributes:g.attributes,index:g.index,
 position:g.attributes.position,normal:g.attributes.normal,
 positionBytes:Buffer.from(bytes(g.attributes.position)),normalBytes:Buffer.from(bytes(g.attributes.normal)),
 positionVersion:(g.attributes.position as T.BufferAttribute).version,normalVersion:(g.attributes.normal as T.BufferAttribute).version,
 sphere:g.boundingSphere,sphereValues:g.boundingSphere&&[...g.boundingSphere.center.toArray(),g.boundingSphere.radius],
 box:g.boundingBox,boxValues:g.boundingBox&&[...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()],
};}
function unchanged(g:T.BufferGeometry,before:ReturnType<typeof snapshot>){
 assert.deepEqual(Object.getOwnPropertyDescriptors(g),before.descriptors);
 assert.equal(g.attributes,before.attributes);assert.equal(g.index,before.index);
 assert.equal(g.attributes.position,before.position);assert.equal(g.attributes.normal,before.normal);
 assert.deepEqual(bytes(g.attributes.position),before.positionBytes);assert.deepEqual(bytes(g.attributes.normal),before.normalBytes);
 assert.equal((g.attributes.position as T.BufferAttribute).version,before.positionVersion);assert.equal((g.attributes.normal as T.BufferAttribute).version,before.normalVersion);
 assert.equal(g.boundingSphere,before.sphere);assert.deepEqual(g.boundingSphere&&[...g.boundingSphere.center.toArray(),g.boundingSphere.radius],before.sphereValues);
 assert.equal(g.boundingBox,before.box);assert.deepEqual(g.boundingBox&&[...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()],before.boxValues);
}
function expandedMatches(batch:T.BatchedMesh,id:number,source:T.BufferGeometry){
 const range=batch.getGeometryRangeAt(id)!;assert.equal(range.count,source.attributes.position.count);
 for(const name of ['position','normal']){
  const expected=bytes(source.getAttribute(name)),attribute=batch.geometry.getAttribute(name),actual=Buffer.alloc(expected.length);
  const data=bytes(attribute),index=batch.geometry.index;
  for(let corner=0;corner<range.count;corner++){
   const vertex=index?index.getX(range.indexStart+corner):range.vertexStart+corner;
   data.copy(actual,corner*12,vertex*12,vertex*12+12);
  }
  assert.deepEqual(actual,expected,'Expanded '+name+' bytes and triangle order');
 }
 assert.deepEqual(batch.getBoundingSphereAt(id,new T.Sphere()),source.boundingSphere);
}
function canvasFixture<A>(run:()=>A):A{
 const old=Object.getOwnPropertyDescriptor(globalThis,'document');
 const ctx={fillRect(){},strokeRect(){},fillText(){},measureText(text:string){return{width:text.length*8};}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>ctx})}});
 try{return run();}finally{if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document');}
}
function smallStreet(){
 const scene=new T.Scene(),street=canvasFixture(()=>addStreetDetails(scene,{boxes:[0,260,520].map(x=>({x,y:2,z:0,w:5,h:.01,l:8,yaw:0,material:'white'})),signs:[],stats:{},notes:[]}));
 return{scene,street,sources:street.batchSources()};
}
function cameraAt(x:number,z:number,yaw:number){
 const camera=new T.PerspectiveCamera(58,1440/900,.1,3500);camera.position.set(x,7,z);camera.lookAt(x+Math.sin(yaw)*150,2,z+Math.cos(yaw)*150);camera.updateMatrixWorld(true);return camera;
}
const renderer=()=>({extensions:{has:()=>true},xr:{isPresenting:false},shadowMap:{enabled:true,autoUpdate:true,needsUpdate:true}} as unknown as T.WebGLRenderer);

test('the constructor-free input contract is pinned to the actual native copying implementation',()=>{
 assert.equal(T.REVISION,'185');
 const hashes={
  'src/objects/BatchedMesh.js':'a7b4154d996fe13b73bfd986e09903779c902ad4dd86d8e667a83abd77aab329',
  'src/core/BufferGeometry.js':'be1b8ad6ce3e502904fd989f5b6690d8fedcbadb74508aec99fc87dfd567e8c7',
  'src/core/BufferAttribute.js':'ffd9bdc55ea7c0b5cec9865a68b71ebd076d0c49f9d50adb5f9ce570c1961c09',
 };
 for(const [path,expected] of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../../node_modules/three/'+path,import.meta.url))).digest('hex'),expected,path);
});

test('real native copies preserve signed-zero tuples, seams, every corner and original raycast metadata without constructor/random side effects',()=>{
 const g=geometry([0,-0,0,1,0,0,0,0,1,0,-0,0,0,0,1,1,0,0,0,0,0,1,0,0,0,0,1]);
 (g.attributes.normal as T.BufferAttribute).setY(7,-1);
 const material=new T.MeshStandardMaterial({side:T.DoubleSide}),mesh=new T.Mesh(g,material),batch=new T.BatchedMesh(1,9,9,material);
 mesh.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(.2,10,.2),new T.Vector3(0,-1,0));
 const rayReceipt=()=>ray.intersectObject(mesh,false).map(hit=>({object:hit.object,distance:hit.distance,point:hit.point.toArray(),faceIndex:hit.faceIndex,face:hit.face&&{a:hit.face.a,b:hit.face.b,c:hit.face.c,normal:hit.face.normal.toArray(),materialIndex:hit.face.materialIndex}}));
 const hits=rayReceipt();assert(hits.length>0);
 let sourceDisposed=0;g.addEventListener('dispose',()=>sourceDisposed++);
 Object.freeze(g.attributes);Object.freeze(g.boundingSphere!.center);Object.freeze(g.boundingSphere!);
 const before=snapshot(g),geometryMarker=new T.BufferGeometry(),objectMarker=new T.Object3D(),materialMarker=new T.Material();
 const random=Math.random;let id:number;
 Math.random=()=>{throw Error('Indexed copy consumed shared randomness');};
 try{const plan=prepareIndexedStreetDisplayGroup([g])!;assert.equal(plan.vertices,5);assert.equal(plan.indices,9);id=plan.addTo(batch,g);}
 finally{Math.random=random;}
 const afterGeometry=new T.BufferGeometry(),afterObject=new T.Object3D(),afterMaterial=new T.Material();
 assert.equal(afterGeometry.id,geometryMarker.id+1);assert.equal(afterObject.id,objectMarker.id+1);assert.equal(Reflect.get(afterMaterial,'id'),Reflect.get(materialMarker,'id')+1);
 expandedMatches(batch,id!,g);unchanged(g,before);assert.deepEqual(rayReceipt(),hits);
 batch.dispose();assert.equal(sourceDisposed,0);unchanged(g,before);
 geometryMarker.dispose();afterGeometry.dispose();materialMarker.dispose();afterMaterial.dispose();g.dispose();material.dispose();
});

test('raw Float32 payload bits are copied without number conversion or tolerance welding',()=>{
 const g=geometry([0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,1]);
 const normal=g.attributes.normal.array as Float32Array,bits=new Uint32Array(normal.buffer,normal.byteOffset,normal.length);
 bits[0]=0x7fc00001;bits[9]=0x7fc00002;
 const plan=prepareIndexedStreetDisplayGroup([g])!,material=new T.MeshStandardMaterial(),batch=new T.BatchedMesh(1,plan.vertices,plan.indices,material);
 assert.equal(plan.vertices,4,'Different NaN payloads are different complete tuples');expandedMatches(batch,plan.addTo(batch,g),g);
 batch.dispose();g.dispose();material.dispose();
});

test('two u16-sized tiles use the native u32 aggregate and retain all degenerate and ordinary triangles',()=>{
 const make=(offset:number)=>{
  const positions:number[]=[];for(let repeat=0;repeat<2;repeat++)for(let i=0;i<33000;i++)positions.push(offset+i,0,i%2);
  return geometry(positions);
 };
 const geometries=[make(0),make(100000)],before=geometries.map(snapshot),plan=prepareIndexedStreetDisplayGroup(geometries)!;
 assert.equal(plan.vertices,66000);assert.equal(plan.indices,132000);
 const material=new T.MeshStandardMaterial(),batch=new T.BatchedMesh(2,plan.vertices,plan.indices,material);
 geometries.forEach(g=>expandedMatches(batch,plan.addTo(batch,g),g));
 assert(batch.geometry.index!.array instanceof Uint32Array);assert.equal(batch.geometry.attributes.position.count,66000);assert.equal(batch.geometry.index!.count,132000);
 assert.equal(batch.geometry.index!.getX(66000+32999),65999);
 geometries.forEach((g,i)=>unchanged(g,before[i]));batch.dispose();geometries.forEach(g=>g.dispose());material.dispose();
});

test('native success and failure revoke every temporary view; writes and inherited disposal cannot reach originals',()=>{
 const g=geometry([0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,1]),plan=prepareIndexedStreetDisplayGroup([g])!;
 const material=new T.MeshStandardMaterial(),good=new T.BatchedMesh(1,3,6,material),small=new T.BatchedMesh(1,1,1,material),before=snapshot(g);
 const original=Proxy.revocable,views:object[]=[];let inspected=0;
 Proxy.revocable=function<A extends object>(target:A,handler:ProxyHandler<A>){
  let checked=false;
  const result=original(target,{...handler,get(t,key,receiver){
   if(!checked){checked=true;inspected++;assert.throws(()=>Reflect.set(receiver,'index',null),/read-only/);assert.throws(()=>Reflect.get(receiver,'dispose'),/Unexpected street display input read/);}
   return handler.get!(t,key,receiver);
  }});
  views.push(result.proxy);return result;
 };
 try{expandedMatches(good,plan.addTo(good,g),g);assert.throws(()=>plan.addTo(small,g),/Reserved space request exceeds/);}
 finally{Proxy.revocable=original;}
 assert.equal(inspected,2);assert.equal(views.length,2);for(const view of views)assert.throws(()=>Reflect.get(view,'attributes'),TypeError);
 unchanged(g,before);good.dispose();small.dispose();unchanged(g,before);g.dispose();material.dispose();
});

test('unsupported input or incomplete street selection keeps the whole original material group on its existing copy path',()=>{
 const mutations=[
  (g:T.BufferGeometry)=>{g.setDrawRange(0,3);},
  (g:T.BufferGeometry)=>{g.addGroup(0,3);},
  (g:T.BufferGeometry)=>{g.getIndex=()=>null;},
  (g:T.BufferGeometry)=>{Object.freeze(g);},
 ];
 for(const mutate of mutations){
  const {scene,sources}=smallStreet();mutate(sources[1].geometry);const before=sources.map(s=>snapshot(s.geometry));
  assert.equal(prepareIndexedStreetDisplayGroup(sources.map(s=>s.geometry)),null);
  const palette=batchStaticArchitecture(scene,renderer(),[],()=>false,undefined,sources)!;
  assert.equal(palette.stats.batches,1);const batch=palette.root.children[0] as T.BatchedMesh;
  assert.equal(batch.geometry.index,null);assert.equal(batch.instanceCount,3);
  sources.forEach((source,i)=>{expandedMatches(batch,batch.getGeometryIdAt(i),source.geometry);unchanged(source.geometry,before[i]);});palette.dispose();
 }
 const {sources}=smallStreet(),all=new Set(sources),palette=new StaticPaletteBatch(sources,all,preserveStreetBatchOrder,new Set(sources.slice(0,2)));
 assert.equal(palette.stats.batches,1);assert.equal((palette.root.children[0] as T.BatchedMesh).geometry.index,null);palette.dispose();
});

test('prepared-source changes reject before copying; indexed display retains the existing replacement, visibility and disposal guards',()=>{
 const {scene,street,sources}=smallStreet(),g=sources[0].geometry,plan=prepareIndexedStreetDisplayGroup([g])!;
 const batch=new T.BatchedMesh(1,plan.vertices,plan.indices,sources[0].material as T.Material);
 (g.attributes.position as T.BufferAttribute).needsUpdate=true;
 assert.throws(()=>plan.addTo(batch,g),/changed after group preparation/);batch.dispose();
 const before=sources.map(s=>snapshot(s.geometry));let originalDisposals=0;for(const source of sources)source.geometry.addEventListener('dispose',()=>originalDisposals++);
 const palette=batchStaticArchitecture(scene,renderer(),[],()=>false,undefined,sources)!,display=palette.root.children[0] as T.BatchedMesh;
 assert(display.geometry.index);const camera=cameraAt(128,0,.4),original=sources[0].geometry,replacement=new T.PlaneGeometry(3,4);replacement.computeBoundingSphere();
 sources[0].geometry=replacement;palette.beginView(false,camera);assert.equal(sources[0].visible,true);assert.equal(display.getVisibleAt(0),false);palette.endView();sources[0].geometry=original;
 const originalMaterial=sources[1].material,replacementMaterial=(originalMaterial as T.Material).clone();sources[1].material=replacementMaterial;
 palette.beginView(false,camera);assert.equal(sources[1].visible,true);assert.equal(display.getVisibleAt(1),false);palette.endView();sources[1].material=originalMaterial;
 street.update(4000,4000);palette.beginView(true,camera);assert.equal(display.visible,false);palette.endView();
 assert.deepEqual(new T.Raycaster(new T.Vector3(0,10,0),new T.Vector3(0,-1,0)).intersectObject(display,false),[],'Display batches keep their original no-op raycast');
 palette.dispose();assert.equal(originalDisposals,0);assert.equal(palette.root.parent,null);assert(sources.every(s=>s.parent===scene));
 // Listener registration is our own deliberate change after the earlier snapshots.
 for(const [i,source] of sources.entries()){assert.equal(source.geometry.attributes,before[i].attributes);assert.equal(source.geometry.index,null);assert.deepEqual(bytes(source.geometry.attributes.position),before[i].positionBytes);}
 replacement.dispose();replacementMaterial.dispose();
});

function fullPlan():StreetPlan{
 const planBytes=readFileSync(new URL('../../public/belle/street-details.json',import.meta.url));
 assert.equal(createHash('sha256').update(planBytes).digest('hex'),'ed32042a8546f5ade94af3eb475bd3e5ea452c034ebdca17bd24c23b2b9edd25');
 const plan=JSON.parse(planBytes.toString('utf8'));
 const dataBytes=readFileSync(new URL('../../public/belle/street-details.bin',import.meta.url));
 assert.equal(createHash('sha256').update(dataBytes).digest('hex'),'9660caa782604b0a9e1b4f472208532c2597563ed9e5794801e645a0b4e1fc1b');
 const data=new Float32Array(dataBytes.buffer,dataBytes.byteOffset,dataBytes.byteLength/4);plan.boxes=[];
 for(let i=0;i<data.length;i+=plan.stride)plan.boxes.push({x:data[i],y:data[i+1],z:data[i+2],w:data[i+3],h:data[i+4],l:data[i+5],yaw:data[i+6],material:plan.materials[data[i+7]],grade:data[i+8]});return plan;
}
type NativeBatch=T.BatchedMesh&{_multiDrawCount:number;_multiDrawCounts:Int32Array;_multiDrawStarts:Int32Array;_indirectTexture:T.DataTexture};
function drawReceipt(palette:StaticPaletteBatch,groups:Map<T.BatchedMesh,T.Mesh[]>,scene:T.Scene,camera:T.Camera,shadows:boolean){
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 palette.beginView(shadows,camera);const rows:{sources:number[];counts:number[];nativeSources:number[]}[]=[];
 try{for(const [batch,sources] of groups){
  const ids:number[]=[],counts:number[]=[];
  if(batch.visible&&frustum.intersectsObject(batch)){
   batch.onBeforeRender({} as T.WebGLRenderer,scene,camera,batch.geometry,batch.material as T.Material,null as never);
   const native=batch as NativeBatch,indices=native._indirectTexture.image.data as Uint32Array,width=batch.geometry.index?.array.BYTES_PER_ELEMENT??1;
   for(let i=0;i<native._multiDrawCount;i++){
    const instance=indices[i],range=batch.getGeometryRangeAt(batch.getGeometryIdAt(instance))!;
    assert.equal(native._multiDrawStarts[i]/width,range.start,'Normalize native byte starts to the unchanged geometry/triangle range');
    assert.equal(native._multiDrawCounts[i],sources[instance].geometry.attributes.position.count);ids.push(sources[instance].id);counts.push(native._multiDrawCounts[i]);
   }
  }
  rows.push({sources:ids,counts,nativeSources:sources.filter(s=>s.visible&&frustum.intersectsObject(s)).map(s=>s.id)});
 }}finally{palette.endView();}return rows;
}

test('the full original decorated plan retains seven groups, native order/culling, shaders and the complete expanded stream',async()=>{
 const scene=new T.Scene(),noise=new T.Texture(),atmosphere=new WorldAtmosphere(scene,noise),textures:T.Texture[]=[];
 const street=canvasFixture(()=>addStreetDetails(scene,fullPlan()));await Promise.resolve();
 const load=T.TextureLoader.prototype.loadAsync;T.TextureLoader.prototype.loadAsync=async()=>{const t=new T.Texture({width:1,height:1} as HTMLImageElement);textures.push(t);return t;};
 const gl={capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer;
 try{await loadRealisticMaterials(gl);}finally{T.TextureLoader.prototype.loadAsync=load;}
 applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);
 const sources=street.batchSources(),selected=new Set(sources),before=sources.map(s=>snapshot(s.geometry)),originalGroups=new Map<T.BatchedMesh,T.Mesh[]>(),indexedGroups=new Map<T.BatchedMesh,T.Mesh[]>();
 const compile=(m:T.Material)=>{const s={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,numPointLights:4,numPointLightShadows:0} as Parameters<T.Material['onBeforeCompile']>[0];m.onBeforeCompile(s,gl);return s;};
 const programs=new Map<T.Material,{key:string;version:number;compile:T.Material['onBeforeCompile'];shader:ReturnType<typeof compile>}>();
 const random=Math.random;let calls=0;Math.random=()=>{calls++;return random();};
 let original!:StaticPaletteBatch,indexed!:StaticPaletteBatch,baselineCalls=0,indexedCalls=0;
 try{
  original=new StaticPaletteBatch(sources,selected,(batch,group)=>{originalGroups.set(batch,group);return preserveStreetBatchOrder(batch,group);});baselineCalls=calls;
  for(const batch of originalGroups.keys()){const material=batch.material as T.Material;programs.set(material,{key:material.customProgramCacheKey(),version:material.version,compile:material.onBeforeCompile,shader:compile(material)});}calls=0;
  indexed=new StaticPaletteBatch(sources,selected,(batch,group)=>{indexedGroups.set(batch,group);return preserveStreetBatchOrder(batch,group);},selected);indexedCalls=calls;
 }finally{Math.random=random;}
 assert.equal(indexedCalls,baselineCalls,'Exactly the original batch/material/texture UUID randomness footprint');
 // Scene rediscovery may install the same atmosphere-owner wrapper later.
 // The candidate constructor itself must leave these existing bindings intact.
 for(const [material,program] of programs){assert.equal(material.onBeforeCompile,program.compile);assert.equal(material.version,program.version);assert.equal(material.customProgramCacheKey(),program.key);}
 scene.add(original.root,indexed.root);scene.updateMatrixWorld(true);await Promise.resolve();atmosphere.flush();
 assert.equal(sources.length,355);assert.equal(original.stats.batches,7);assert.equal(indexed.stats.batches,7);
 assert.deepEqual([...indexedGroups.values()].map(g=>g.map(s=>s.id)),[...originalGroups.values()].map(g=>g.map(s=>s.id)));
 assert.deepEqual([...indexedGroups.values()].map(g=>g.length),[2,90,2,79,85,63,34]);
 let vertices=0,corners=0,storageBytes=0;const oldBatches=[...originalGroups.keys()];
 for(const [ordinal,[batch,group]] of [...indexedGroups.entries()].entries()){
  const old=oldBatches[ordinal];assert.equal(batch.material,old.material);assert.equal(batch.customSort!==null,true);assert.equal(batch.perObjectFrustumCulled,old.perObjectFrustumCulled);
  assert.equal(batch.renderOrder,old.renderOrder);assert.equal(batch.layers.mask,old.layers.mask);assert.equal(batch.castShadow,old.castShadow);assert.equal(batch.receiveShadow,old.receiveShadow);
  assert.deepEqual(batch.boundingBox,old.boundingBox);assert.deepEqual(batch.boundingSphere,old.boundingSphere);
  assert.equal(batch.geometry.id-old.geometry.id,oldBatches.length,'No extra geometry construction between the two native batches');assert.equal(batch.id-old.id,oldBatches.length+1,'No extra Object3D construction');
  const material=batch.material as T.Material,a=compile(material),program=programs.get(material)!,b=program.shader;
  assert.equal(material.customProgramCacheKey(),program.key);
  assert.equal(a.vertexShader,b.vertexShader);assert.equal(a.fragmentShader,b.fragmentShader);assert.equal((a.vertexShader.match(/#undef USE_BATCHING/g)||[]).length,1);
  for(const [name,uniform] of Object.entries(atmosphere.uniforms))assert.equal(a.uniforms[name],uniform);
  for(const [i,source] of group.entries()){
   assert.equal(batch.getGeometryIdAt(i),old.getGeometryIdAt(i));assert.deepEqual(batch.getMatrixAt(i,new T.Matrix4()).elements,source.matrixWorld.elements);
   expandedMatches(batch,batch.getGeometryIdAt(i),source.geometry);corners+=source.geometry.attributes.position.count;
  }
  const unique=batch.geometry.attributes.position.count;vertices+=unique;
  assert.equal(batch.geometry.index!.array instanceof Uint32Array,unique>65535);
  storageBytes+=bytes(batch.geometry.attributes.position).length+bytes(batch.geometry.attributes.normal).length+bytes(batch.geometry.index!).length;
 }
 assert.equal(vertices,1178264);assert.equal(corners,2028750);assert.equal(storageBytes,36014604);
 for(const [x,z,yaw] of [[350,-100,1.1],[800,500,.8],[1330,1175,2.1],[2100,1400,-.5],[3200,700,-2.5]])for(const shadows of [false,true]){
  street.update(x,z);const camera=cameraAt(x,z,yaw),visible=sources.map(s=>s.visible);
  assert.deepEqual(drawReceipt(indexed,indexedGroups,scene,camera,shadows),drawReceipt(original,originalGroups,scene,camera,shadows));assert.deepEqual(sources.map(s=>s.visible),visible);
 }
 sources.forEach((source,i)=>unchanged(source.geometry,before[i]));original.dispose();indexed.dispose();sources.forEach((source,i)=>unchanged(source.geometry,before[i]));
 console.info('Indexed street CPU receipt '+JSON.stringify({sourceTiles:sources.length,groups:indexed.stats.batches,originalCorners:corners,uniqueVertices:vertices,batchBytes:storageBytes,originalRandomCalls:baselineCalls,indexedRandomCalls:indexedCalls,nativeBrowserRun:false}));
 atmosphere.dispose();noise.dispose();textures.forEach(t=>t.dispose());scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
});
