import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {addStreetDetails} from './streetDetails.ts';
import {StaticPaletteBatch} from './staticPaletteBatch.ts';
import {preserveStreetBatchOrder} from './streetBatchOrder.ts';
import {batchStaticArchitecture} from './staticArchitectureBatch.ts';
import type {StreetPlan} from './streetPlan.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {applyPhotoReferenceSurfaces} from './photoReferenceSurfaces.ts';
import {dressSunsetGround} from './sunsetGround.ts';

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
type NativeBatch=T.BatchedMesh&{_multiDrawCount:number;_multiDrawCounts:Int32Array;_multiDrawStarts:Int32Array;_indirectTexture:T.DataTexture};
function drawCount(geometry:T.BufferGeometry){return geometry.index?.count??geometry.attributes.position.count;}
function cameraAt(x:number,z:number,yaw:number){
 const camera=new T.PerspectiveCamera(58,1440/900,.1,3500);
 camera.position.set(x,7,z);camera.lookAt(x+Math.sin(yaw)*150,2,z+Math.cos(yaw)*150);
 camera.updateMatrixWorld(true);return camera;
}
function frustumFor(camera:T.Camera){return new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}

test('identity street arithmetic is limited to the pinned native batching vertex branches',()=>{
 assert.equal(T.REVISION,'185');
 const files:Record<string,string>={
  'src/renderers/webgl/WebGLProgram.js':'a341febd40f5f16253c1fd624f6ae7d0ca34b7a5411fcee1699b87962081ec72',
  'src/renderers/shaders/ShaderChunk/batching_vertex.glsl.js':'266f63ad1197571269f6eb9363a2c916e120fccee3d897181805c831918ef34b',
  'src/renderers/shaders/ShaderChunk/batching_pars_vertex.glsl.js':'f1010ad0951f5870cb4d12789dd0799a59eb365da814682f8e2a5f9fa585d0c9',
  'src/renderers/shaders/ShaderChunk/defaultnormal_vertex.glsl.js':'4246f76524da8fcde17934603abf0467163fff241441b19ea5c6fe02f0ff61cb',
  'src/renderers/shaders/ShaderChunk/project_vertex.glsl.js':'74632caa5cc4a9812b1bb423aac7574748e648613c18898c6bf57d26b85600d3',
  'src/renderers/shaders/ShaderChunk/worldpos_vertex.glsl.js':'d291ca05988f57312c060b33fa271472b3756b6a6b737934f5a04f882bf4f17f',
 };
 for(const [path,hash] of Object.entries(files))assert.equal(createHash('sha256').update(readFileSync(new URL('../../node_modules/three/'+path,import.meta.url))).digest('hex'),hash,path);
 assert.deepEqual(Object.entries(T.ShaderChunk).filter(([,value])=>/\bUSE_BATCHING\b/.test(value)).map(([key])=>key).sort(),
  ['batching_pars_vertex','batching_vertex','defaultnormal_vertex','project_vertex','worldpos_vertex']);
 const program=readFileSync(new URL('../../node_modules/three/src/renderers/webgl/WebGLProgram.js',import.meta.url),'utf8');
 assert.match(program,/parameters\.batching \? '#define USE_BATCHING' : ''/);
 assert.match(program,/prefixVertex \+ vertexShader/,'The original Mesh variant never defines the disabled macro, while the BatchedMesh prefix precedes our undef');
});

test('street identity shader preserves native fragment/uniform work, material identity and callback receiver/arguments',()=>{
 const material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry();
 const sources=[new T.Mesh(geometry,material),new T.Mesh(geometry,material)];
 const calls:unknown[][]=[],renderer={} as T.WebGLRenderer,receiver=new T.MeshStandardMaterial();receiver.name='receiver';
 const uniform={value:17},result={original:true};
 const original:T.Material['onBeforeCompile']=function(this:T.Material,...args){calls.push([this,...args]);args[0].uniforms.authored=uniform;args[0].vertexShader='// authored vertex\n'+args[0].vertexShader;args[0].fragmentShader='// authored fragment\n'+args[0].fragmentShader;return result;};
 material.onBeforeCompile=original;material.customProgramCacheKey=function(){return this.name+'-original-key';};
 const shader=()=>({uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader}) as Parameters<T.Material['onBeforeCompile']>[0];
 const native=shader();assert.equal(Reflect.apply(original,receiver,[native,renderer]),result);
 const batch=new T.BatchedMesh(2,geometry.attributes.position.count*2,geometry.index!.count*2,material);
 const version=material.version;assert.notEqual(preserveStreetBatchOrder(batch,sources),false);
 const candidate=shader();assert.equal(Reflect.apply(material.onBeforeCompile,receiver,[candidate,renderer]),result);
 assert.deepEqual(calls,[[receiver,native,renderer],[receiver,candidate,renderer]]);
 assert.equal(candidate.vertexShader,'#undef USE_BATCHING\n'+native.vertexShader);
 assert.equal(candidate.fragmentShader,native.fragmentShader);assert.equal(candidate.uniforms.authored,uniform);
 assert.equal(batch.material,material);assert.equal(material.version,version+1);
 assert.equal(material.customProgramCacheKey.call(receiver),'receiver-original-key|street-identity-vertex-v1');
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey;
 assert.notEqual(preserveStreetBatchOrder(batch,sources),false);assert.equal(material.version,version+1);
 assert.equal(material.onBeforeCompile,compile);assert.equal(material.customProgramCacheKey,key);
 material.onBeforeCompile=original;assert.equal(preserveStreetBatchOrder(batch,sources),false,'An externally replaced callback is not silently approved');
 batch.dispose();geometry.dispose();material.dispose();receiver.dispose();
});

test('identity street shader rejects nonidentity or color/alpha variants before changing their materials',()=>{
 for(const change of [
  (sources:T.Mesh[],_batch:T.BatchedMesh)=>{sources[0].position.x=1;sources[0].updateMatrixWorld(true);},
  (sources:T.Mesh[],_batch:T.BatchedMesh)=>{sources[0].matrixWorld.elements[12]=1;},
  (_sources:T.Mesh[],batch:T.BatchedMesh)=>{batch.matrix.elements[12]=1;},
  (_sources:T.Mesh[],batch:T.BatchedMesh)=>{batch.matrixWorld.elements[12]=1;},
  (sources:T.Mesh[])=>{(sources[0].material as T.Material).transparent=true;},
  (sources:T.Mesh[])=>{(sources[0].material as T.Material).alphaTest=.5;},
  (sources:T.Mesh[])=>{(sources[0].material as T.Material).opacity=.5;},
  (sources:T.Mesh[])=>{(sources[0].material as T.Material).vertexColors=true;},
  (_sources:T.Mesh[],batch:T.BatchedMesh)=>{const geometry=new T.BoxGeometry(),id=batch.addGeometry(geometry);batch.setColorAt(batch.addInstance(id),new T.Color());geometry.dispose();},
 ]){
  const material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(),sources=[new T.Mesh(geometry,material),new T.Mesh(geometry,material)];
  const batch=new T.BatchedMesh(2,geometry.attributes.position.count*2,geometry.index!.count*2,material),compile=material.onBeforeCompile,key=material.customProgramCacheKey;
  change(sources,batch);const version=material.version;assert.equal(preserveStreetBatchOrder(batch,sources),false);
  assert.equal(material.onBeforeCompile,compile);assert.equal(material.customProgramCacheKey,key);assert.equal(material.version,version);
  assert.equal(batch.customSort,null);batch.dispose();geometry.dispose();material.dispose();
 }
});

test('full shipped indexed street plan keeps every vertex, normal, index, material, bound and native source draw order',()=>canvasFixture(()=>{
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
 assert(allTiles.every(source=>source.geometry.index?.array instanceof Uint16Array),'Every shipped tile retains its compact indexed source geometry');
 assert(allTiles.filter(o=>o.name.endsWith(',metal')).every(o=>!sourceSet.has(o)));
 assert.equal(sourceSet.size,allTiles.filter(o=>!o.name.endsWith(',metal')).length);
 let wideIndexBatches=0;
 for(const [batch,group] of groups){
  assert.equal(batch.instanceCount,group.length);assert.equal(batch.material,group[0].material);
  assert.equal(batch.castShadow,false);assert.equal(batch.receiveShadow,true);assert.equal((batch as T.BatchedMesh&{_colorsTexture:T.DataTexture|null})._colorsTexture,null);
  assert.equal(batch.renderOrder,group[0].renderOrder);assert.equal(batch.layers.mask,group[0].layers.mask);
  const batchIndex=batch.geometry.index;assert(batchIndex);
  if(batch.geometry.attributes.position.count>65535){assert(batchIndex.array instanceof Uint32Array);wideIndexBatches++;}
  else assert(batchIndex.array instanceof Uint16Array);
  for(const [i,source] of group.entries()){
   assert.equal(source.parent,scene);assert.equal(source.material,batch.material);
   assert.equal((source.material as T.Material).polygonOffset,false);
   assert.deepEqual(batch.getMatrixAt(i,new T.Matrix4()).elements,source.matrixWorld.elements);
   const id=batch.getGeometryIdAt(i),range=batch.getGeometryRangeAt(id);assert(range);
   assert.equal(range.vertexCount,source.geometry.attributes.position.count);
   const sourceIndex=source.geometry.index;assert(sourceIndex);
   assert.equal(range.indexCount,sourceIndex.count);assert.equal(range.count,sourceIndex.count);assert.equal(range.start,range.indexStart);
   for(let j=0;j<sourceIndex.count;j++)assert.equal(batchIndex.getX(range.indexStart+j),sourceIndex.getX(j)+range.vertexStart,'Every index retains the original triangle order after rebasing');
   for(const key of ['position','normal']){
    const a=source.geometry.getAttribute(key),b=batch.geometry.getAttribute(key);
    const bytesA=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);
    const bytesB:Uint8Array=new Uint8Array(b.array.buffer,b.array.byteOffset+range.vertexStart*a.itemSize*4,a.array.byteLength);
    assert.deepEqual(bytesB,bytesA,'Every copied '+key+' byte must be identical');
   }
   assert.deepEqual(batch.getBoundingSphereAt(id,new T.Sphere()),source.geometry.boundingSphere);
  }
 }
 assert(wideIndexBatches>0,'Actual combined material batches must exercise 16-bit source indices rebased into 32-bit storage');
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
    for(let i=0;i<native._multiDrawCount;i++){
     const source=group[ids[i]],range=batch.getGeometryRangeAt(batch.getGeometryIdAt(ids[i]));assert(range);
     actual.push(source);
     assert.equal(native._multiDrawCounts[i],drawCount(source.geometry),'Native multi-draw counts indices, not unique vertices');
     const indexBytes=(batch.geometry.index!.array as Uint16Array|Uint32Array).BYTES_PER_ELEMENT;
     assert.equal(native._multiDrawStarts[i],range.indexStart*indexBytes,'Native indexed multi-draw offsets are byte addresses in the combined index buffer');
    }
    if(native._multiDrawCount)batchedDraws++;
    assert.equal([...native._multiDrawCounts.slice(0,native._multiDrawCount)].reduce((a,b)=>a+b,0),actual.reduce((n,s)=>n+drawCount(s.geometry),0));
   }
   // Groups with only one eligible source stay on their original native path.
   actual.push(...group.filter(s=>s.visible&&frustum.intersectsObject(s)));
   batchedDraws+=group.filter(s=>s.visible&&frustum.intersectsObject(s)).length;
   assert.deepEqual(actual.map(s=>s.id),expected.map(s=>s.id),'Native projected-depth/ID order and frustum membership');
   assert.equal(batch.castShadow,false);nativeDraws+=expected.length;
   triangles+=expected.reduce((n,s)=>n+drawCount(s.geometry)/3,0);
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

test('actual street decoration and scene rediscovery retain one atmosphere owner and the original shader/uniform bindings',async()=>{
 const scene=new T.Scene(),noise=new T.Texture(),atmosphere=new WorldAtmosphere(scene,noise),textures:T.Texture[]=[];
 const renderer={capabilities:{getMaxAnisotropy:()=>8},initTexture(){}} as unknown as T.WebGLRenderer;
 let street!:ReturnType<typeof addStreetDetails>;
 canvasFixture(()=>{street=addStreetDetails(scene,{boxes:[0,260,520].map(x=>({x,y:2,z:0,w:5,h:.01,l:8,yaw:0,material:'white'})),signs:[],stats:{},notes:[]});});
 await Promise.resolve();
 const load=T.TextureLoader.prototype.loadAsync;
 T.TextureLoader.prototype.loadAsync=async url=>{const texture=new T.Texture({width:1,height:1} as HTMLImageElement);texture.name=url;textures.push(texture);return texture;};
 try{await loadRealisticMaterials(renderer);}finally{T.TextureLoader.prototype.loadAsync=load;}
 applyRealisticMaterials(scene);applyPhotoReferenceSurfaces(scene);dressSunsetGround(scene);
 const sources=street.batchSources();
 const compile=(material:T.Material)=>{
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,numPointLights:4,numPointLightShadows:0} as Parameters<T.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader,renderer);return shader;
 };
 const materials=[...new Set(sources.map(source=>source.material as T.Material))],before=new Map(materials.map(material=>[material,{key:material.customProgramCacheKey(),shader:compile(material)}]));
 const palette=new StaticPaletteBatch(sources,new Set(sources),preserveStreetBatchOrder);scene.add(palette.root);
 await Promise.resolve();atmosphere.flush();assert.equal(palette.stats.batches,1);
 atmosphere.update(13,new T.Vector3(0,1,0),.4,1,0,'high',false,false);
 for(const material of materials){
  const original=before.get(material)!,shader=compile(material);
  assert.equal(material.customProgramCacheKey(),original.key+'|street-identity-vertex-v1','Scene rediscovery keeps the original atmosphere owner/key');
  assert.equal(shader.vertexShader,'#undef USE_BATCHING\n'+original.shader.vertexShader);assert.equal(shader.fragmentShader,original.shader.fragmentShader);
  assert.equal((shader.vertexShader.match(/varying vec3 belleAtmosphereWorld;/g)||[]).length,1);
  for(const [name,uniform] of Object.entries(atmosphere.uniforms))assert.equal(shader.uniforms[name],uniform);
  assert.equal(shader.uniforms.belleCloudTime.value,13);
 }
 assert(sources.every(source=>source.material===(palette.root.children[0] as T.Mesh).material));
 palette.dispose();atmosphere.dispose();noise.dispose();textures.forEach(texture=>texture.dispose());
 scene.traverse(object=>{if(object instanceof T.Mesh)object.geometry.dispose();});materials.forEach(material=>material.dispose());
});
