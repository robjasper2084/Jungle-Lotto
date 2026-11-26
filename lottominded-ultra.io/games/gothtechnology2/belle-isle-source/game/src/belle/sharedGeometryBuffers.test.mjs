import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import * as T from 'three';
import {WebGLRenderLists} from 'three/src/renderers/webgl/WebGLRenderLists.js';
import {WebGLAttributes} from 'three/src/renderers/webgl/WebGLAttributes.js';
import {WebGLBindingStates} from 'three/src/renderers/webgl/WebGLBindingStates.js';
import {WebGLGeometries} from 'three/src/renderers/webgl/WebGLGeometries.js';
import {WebGLObjects} from 'three/src/renderers/webgl/WebGLObjects.js';
import {WebGLInfo} from 'three/src/renderers/webgl/WebGLInfo.js';
import {installGpuFramePacing,gpuFramePacingDiagnostics} from './gpuFramePacing.ts';
import {installSharedGeometryBuffers,registerSharedGeometryShader} from './sharedGeometryBuffers.ts';

class Canvas extends EventTarget {
  listeners=new Map();
  addEventListener(type,callback,options){super.addEventListener(type,callback,options);const list=this.listeners.get(type)??new Set();list.add(callback);this.listeners.set(type,list);}
  removeEventListener(type,callback,options){super.removeEventListener(type,callback,options);this.listeners.get(type)?.delete(callback);}
}
function camera(){const c=new T.PerspectiveCamera(55,1,.1,200);c.position.set(0,0,20);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;}
const rendererOutput=Object.freeze({type:T.UnsignedByteType,nodes:false});
const flushPreparation=()=>Promise.resolve();
function geometry(seed=0,indexed=true,Index=Uint16Array){
  const g=new T.BufferGeometry();
  const p=[-1+seed,-1,0,1+seed,-1,0,seed,1,0,-.5+seed,-.5,-1,.5+seed,-.5,-1,seed,.5,-1];
  g.setAttribute('position',new T.BufferAttribute(new Float32Array(p),3));
  g.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],3));
  g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,1,0,0,1,0,.5,1],2));
  if(indexed)g.setIndex(new T.BufferAttribute(new Index([0,1,2,3,4,5]),1));
  return g;
}
function snapshot(object,g,material,phase){
  const total=g.index?.count??g.attributes.position.count;
  const start=Math.max(0,g.drawRange.start),end=Math.min(total,g.drawRange.start+g.drawRange.count);
  const elements=[];
  for(let j=start;j<end;j++){
    const i=g.index?g.index.array[j]:j;
    elements.push(Object.fromEntries(Object.keys(g.attributes).sort().map(name=>{
      const a=g.attributes[name];return [name,Array.from(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize))];
    })));
  }
  return {object:object.name,material:material.name,phase,elements,matrix:object.matrixWorld.elements.slice(),layout:Object.fromEntries(Object.entries(g.attributes).map(([name,a])=>[name,[a.array.constructor.name,a.itemSize,a.normalized,a.gpuType]]))};
}
/** Mirrors the reviewed native hook/collection order while using the actual
 * Three Frustum and render-list sorter. Real GL/pixel/VAO evidence is a separate
 * native fixture: these tests make no GPU performance or equivalence claim. */
function fixture({adapt=true,count=3,indexed=true,options={},shadows=true,setup}={}){
  const scene=new T.Scene(),cam=camera(),canvas=new Canvas(),meshes=[];
  const material=new T.MeshStandardMaterial();material.name='surface';
  for(let i=0;i<count;i++){
    const mesh=new T.Mesh(geometry(i*.125,indexed),material);mesh.name=`mesh-${i}`;mesh.position.set((i-1)*2,0,-i*.25);mesh.castShadow=true;scene.add(mesh);meshes.push(mesh);
  }
  const lists=new WebGLRenderLists(),rows=[],calls=[],returnValue=Symbol('native-return'),directReturn=Symbol('direct-return'),contexts=[],directCalls=[],clears=[];let target=null,depth=0;
  const info=WebGLInfo({});
  const renderer={domElement:canvas,xr:{isPresenting:false},info,autoClear:true,getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},
   renderBufferDirect:function(c,root,g,mat,object,group){
    const context=contexts.at(-1),phase=root===null?'shadow':'color';
    directCalls.push({receiver:this,args:[c,root,g,mat,object,group]});
    f.tap?.({object,geometry:g,material:mat,phase,level:depth-1,beforeResult:context?.beforeResult});
    rows.push(snapshot(object,g,mat,phase));
    renderer.info.render.calls++;renderer.info.render.triangles+=Math.max(0,Math.min(g.drawRange.count,(g.index?.count??g.attributes.position.count)-Math.max(0,g.drawRange.start)))/3;
    return directReturn;
   },render:function(root,c){
    calls.push({receiver:this,args:[root,c]});const level=depth++;let result;
    const context={beforeResult:undefined};contexts.push(context);
    try {
      root.updateMatrixWorld(true);if(c.parent===null)c.updateMatrixWorld(true);
      if(root.isScene)result=Reflect.apply(root.onBeforeRender,root,[renderer,root,c,target]);
      context.beforeResult=result;
      const matrix=new T.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse),frustum=new T.Frustum().setFromProjectionMatrix(matrix);
      const list=lists.get(root,level);list.init();
      function collect(object,groupOrder=0){
        if(object.visible===false)return;
        if(object.layers.test(c.layers)){
          if(object.isGroup)groupOrder=object.renderOrder;
          if(object.isMesh && (!object.frustumCulled||frustum.intersectsObject(object))){
            const g=object.geometry;
            f.updateObject?.(object);
            if(object.boundingSphere===undefined && g.boundingSphere===null)g.computeBoundingSphere();
            const center=(object.boundingSphere??g.boundingSphere).center.clone().applyMatrix4(object.matrixWorld).applyMatrix4(matrix);
            if(!Array.isArray(object.material)&&object.material.visible)list.push(object,g,object.material,groupOrder,center.z,null);
          }
        }
        for(const child of object.children)collect(child,groupOrder);
      }
      collect(root);list.sort(null,null,false);renderer.info.render.frame++;if(renderer.info.autoReset)renderer.info.reset();
      function draw(object,g,mat,phase){
        if(phase==='shadow')Reflect.apply(object.onBeforeShadow,object,[renderer,object,c,c,g,mat,null]);
        else {Reflect.apply(object.onBeforeRender,object,[renderer,root,c,g,mat,null]);Reflect.apply(mat.onBeforeRender,mat,[renderer,root,c,g,object,null]);}
        renderer.renderBufferDirect(c,phase==='shadow'?null:root,g,mat,object,null);
        if(phase==='shadow')Reflect.apply(object.onAfterShadow,object,[renderer,object,c,c,g,mat,null]);
        else Reflect.apply(object.onAfterRender,object,[renderer,root,c,g,mat,null]);
      }
      if(shadows&&root===scene){
        const depthMaterial=new T.MeshDepthMaterial();depthMaterial.name='native-depth';
        root.traverseVisible(object=>{if(object.isMesh && object.castShadow && object.material.visible && object.layers.test(c.layers) && (!object.frustumCulled||frustum.intersectsObject(object))){f.updateObject?.(object);draw(object,object.geometry,depthMaterial,'shadow');}});
      }
      if(renderer.autoClear||root.background?.isColor)clears.push({root,target});
      const overrideMaterial=root.overrideMaterial;
      for(const item of [...list.opaque,...list.transmissive,...list.transparent])draw(item.object,item.geometry,overrideMaterial??item.material,'color');
      if(root.isScene)Reflect.apply(root.onAfterRender,root,[renderer,root,c]);
      return returnValue;
    } finally {depth--;contexts.pop();}
  }};
  const f={scene,cam,canvas,meshes,material,renderer,rows,calls,directCalls,clears,returnValue,directReturn,handle:null,tap:null,updateObject:null,draw(){rows.length=0;const result=renderer.render(scene,cam);assert.equal(result,returnValue);return rows.slice();}};
  setup?.(f);
  if(adapt){f.handle=installSharedGeometryBuffers(renderer,scene,{rendererOutput,...options});f.handle.prepare();}
  return f;
}
function sourceDescriptors(mesh){return Object.fromEntries(['geometry','boundingSphere','onBeforeRender','onBeforeShadow','raycast'].map(k=>[k,Object.getOwnPropertyDescriptor(mesh,k)]));}
function assertRestored(f,originals){for(let i=0;i<originals.length;i++)assert.deepEqual(sourceDescriptors(f.meshes[i]),originals[i]);assert.equal(f.handle.read().scopedEntries,0);}

test('source assumptions are pinned to the reviewed Three 0.185.1 collection, bounds and draw paths',()=>{
  const root=resolve(dirname(createRequire(import.meta.url).resolve('three')),'..');
  assert.equal(JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version,'0.185.1');
  const files={
    'objects/Mesh.js':'432460d6dc5d290ead0c4664475e71b04dbe8fa0c1c08ccd032bd65c6acc9864',
    'math/Frustum.js':'2332e8d732aace16957af57f82733969416827a4cfad8d5bea338fee9f082077',
    'renderers/WebGLRenderer.js':'867948b57a6abb84d4cfd7619b38ea14fbb2c100c1b6f78d59de2383662ab7a0',
    'renderers/webgl/WebGLShadowMap.js':'7d69ca09821ed119d7e1db25e88ad43c2b8c7dd87e8746e1c63f8b86086b3e05',
    'renderers/webgl/WebGLRenderLists.js':'2606792964fa351876798a68317b3d8ca0fb466b5fbef5f7592ecb7f40b743b0',
    'renderers/webgl/WebGLBindingStates.js':'2cff5bf80b72044bfbd952151a5888c173048755039501921063f561261ca210',
    'renderers/webgl/WebGLAttributes.js':'9132425f2359093927d6208ceedf7447e8157c1a3325cda45f941428b166fbf2',
    'renderers/webgl/WebGLGeometries.js':'d04c0ef5e4ccf862867be3a00d5c4a12de1f0939f81e7d5c50c5c4dcb3bc0eff',
    'renderers/webgl/WebGLObjects.js':'60829abba98579b02a84177ce86b3eea127a7decac487b69c70f0e3e83a1d923',
  };
  for(const [file,hash] of Object.entries(files))assert.equal(createHash('sha256').update(readFileSync(resolve(root,'src',file))).digest('hex'),hash,file);
});

test('one actual shared geometry keeps independent color/shadow draws, raw vertex values, matrices and native order',()=>{
  const a=fixture({adapt:false}),b=fixture(),originals=b.meshes.map(sourceDescriptors),shared=[];
  b.tap=({geometry})=>{shared.push(geometry);assert.equal(b.handle.read().scopedEntries,1);for(let i=0;i<b.meshes.length;i++)assert.deepEqual(sourceDescriptors(b.meshes[i]),originals[i]);};
  assert.deepEqual(b.draw(),a.draw());assert.equal(new Set(shared).size,1);assert.equal(b.handle.read().pageCount,1);
  assert.equal(b.handle.read().pooledCalls,6);assert.equal(b.handle.read().colorCalls,3);assert.equal(b.handle.read().shadowCalls,3);
  assertRestored(b,originals);assert.deepEqual(b.draw(),a.draw());assertRestored(b,originals);
});

test('different exact material identities share storage while native material ordering and callbacks remain unchanged',()=>{
  const setup=f=>{f.meshes[1].material=new T.MeshBasicMaterial();f.meshes[1].material.name='second';f.meshes[0].renderOrder=3;const group=new T.Group();group.renderOrder=2;group.add(f.meshes[2]);f.scene.add(group);};
  const a=fixture({adapt:false,setup}),b=fixture({setup});assert.deepEqual(b.draw(),a.draw());assert.equal(b.handle.read().activeEntries,3);assert.equal(b.handle.read().pageCount,1);
});

test('native Frustum and opaque z/id sorting retain source spheres, visibility and transforms',()=>{
  const setup=f=>{f.meshes[0].position.set(100,0,0);f.meshes[1].rotation.set(.1,.3,.2);f.meshes[1].scale.set(2,.5,1);f.meshes[2].geometry.translate(1,2,-5);};
  const a=fixture({adapt:false,setup}),b=fixture({setup});const rows=b.draw();assert.deepEqual(rows,a.draw());assert.equal(rows.filter(r=>r.phase==='color').length,2);
  b.meshes[1].visible=false;a.meshes[1].visible=false;assert.deepEqual(b.draw(),a.draw());assert.equal(b.handle.read().activeEntries,3);
});

test('indexed and nonindexed ranges are clamped to their original allocation including Infinity and negative start',()=>{
  for(const indexed of [true,false])for(const [start,count] of [[0,Infinity],[3,3],[-2,5],[1,100],[0,0]]){
    const setup=f=>{for(const mesh of f.meshes)mesh.geometry.setDrawRange(start,count);};
    const a=fixture({adapt:false,indexed,setup}),b=fixture({indexed,setup});assert.deepEqual(b.draw(),a.draw(),`${indexed}/${start}/${count}`);assert.equal(b.handle.read().activeEntries,3);
  }
});

test('fractional, nonfinite and inverted ranges fall back before render-item collection',()=>{
  for(const [start,count] of [[.5,3],[0,2.5],[NaN,3],[Infinity,3],[7,Infinity],[0,-1],[Number.MAX_SAFE_INTEGER+1,2]]){
    const f=fixture({setup:f=>f.meshes[0].geometry.setDrawRange(start,count)});assert.equal(f.handle.read().activeEntries,2);assert.equal(f.handle.read().rejected['unsupported-draw-range'],1);
  }
});

test('integer attribute types, normalization, gpuType and every component are preserved',()=>{
  const setup=f=>{for(const mesh of f.meshes){mesh.geometry.setAttribute('color',new T.Uint8BufferAttribute([255,0,127,128,1,255,0,9,20,40,30,20,10,11,12,13,14,15],3,true));const tag=new T.Int32BufferAttribute([1,2,3,4,5,6],1);tag.gpuType=T.IntType;mesh.geometry.setAttribute('tag',tag);}};
  const a=fixture({adapt:false,setup}),b=fixture({setup});assert.deepEqual(b.draw(),a.draw());assert.equal(b.handle.read().activeEntries,3);
});

test('index element types remain unchanged and fixed primitive-restart sentinels never become vertices',()=>{
  for(const Index of [Uint8Array,Uint16Array,Uint32Array]){
    const setup=f=>{f.meshes.forEach((mesh,i)=>{mesh.geometry=geometry(i*.125,true,Index);});};
    const a=fixture({adapt:false,setup}),b=fixture({setup});assert.deepEqual(b.draw(),a.draw());
    b.tap=({geometry})=>assert.equal(geometry.index.array.constructor,Index);b.draw();
    const sentinel=Index===Uint8Array?255:Index===Uint16Array?65535:4294967295;
    const bad=fixture({setup:f=>{f.meshes[0].geometry.setIndex(new T.BufferAttribute(new Index([0,1,sentinel]),1));}});assert.equal(bad.handle.read().rejected['index-outside-source-or-restart'],1);
  }
});

test('known shader composition and cloned exact functions are approved while unknown predecessor chains remain native',()=>{
  const f=fixture({adapt:false}),material=f.material,previous=material.onBeforeCompile;
  material.onBeforeCompile=function first(shader,...args){return Reflect.apply(previous,this,[shader,...args]);};assert.equal(registerSharedGeometryShader(material,previous),true);
  const known=material.onBeforeCompile;material.onBeforeCompile=function second(shader,...args){return Reflect.apply(known,this,[shader,...args]);};assert.equal(registerSharedGeometryShader(material,known),true);
  const clone=material.clone();clone.onBeforeCompile=material.onBeforeCompile;f.meshes[1].material=clone;
  f.handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});assert.equal(f.handle.prepare().activeEntries,3);
  const g=fixture({adapt:false});const unknown=function(){};g.material.onBeforeCompile=unknown;const next=function(){};g.material.onBeforeCompile=next;assert.equal(registerSharedGeometryShader(g.material,unknown),false);
  const rejected=installSharedGeometryBuffers(g.renderer,g.scene,{rendererOutput}).prepare();assert.equal(rejected.activeEntries,0);
});

test('custom, Float16, interleaved, dynamic, instanced and upload-hook attributes stay native',()=>{
  class CustomAttribute extends T.BufferAttribute {}
  const mutations=[
    g=>g.setAttribute('position',new T.Float16BufferAttribute(new Uint16Array(18),3)),
    g=>g.setAttribute('position',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(new Float32Array(18),3),3,0)),
    g=>g.setAttribute('position',new CustomAttribute(new Float32Array(18),3)),
    g=>g.setAttribute('position',new T.InstancedBufferAttribute(new Float32Array(18),3)),
    g=>g.attributes.position.setUsage(T.DynamicDrawUsage),
    g=>g.attributes.position.onUpload(()=>{}),
  ];
  for(const mutate of mutations){const f=fixture({setup:f=>mutate(f.meshes[0].geometry)});assert.equal(f.handle.read().activeEntries,2);assert.equal(f.handle.read().rejectedEntries,1);}
});

test('nonplain objects, morphs, arrays, unknown shaders and render hooks are conservatively excluded',()=>{
  const mutations=[
    mesh=>{Object.setPrototypeOf(mesh,T.SkinnedMesh.prototype);},
    mesh=>{mesh.geometry.morphAttributes.position=[mesh.geometry.attributes.position.clone()];},
    mesh=>{mesh.material=[mesh.material];},
    mesh=>{mesh.onBeforeRender=function(){};},
    mesh=>{mesh.onAfterShadow=function(){};},
    mesh=>{mesh.raycast=function(){};},
    mesh=>{mesh.customDepthMaterial=new T.MeshDepthMaterial();},
    mesh=>{mesh.material=mesh.material.clone();mesh.material.wireframe=true;},
    mesh=>{mesh.material=new T.MeshPhysicalMaterial({transmission:.5});},
    mesh=>{mesh.material=mesh.material.clone();mesh.material.onBeforeRender=function(){};},
    mesh=>{mesh.material=mesh.material.clone();mesh.material.onBeforeCompile=function(){};},
  ];
  for(const mutate of mutations){const f=fixture({setup:f=>mutate(f.meshes[0])});assert.equal(f.handle.read().activeEntries,2);assert.equal(f.handle.read().rejectedEntries,1);}
});

test('single-material source groups remain natively ignored, including group edits between renders',()=>{
  const setup=f=>{for(const mesh of f.meshes){mesh.geometry.addGroup(0,3,0);mesh.geometry.addGroup(3,3,4);}};
  const a=fixture({adapt:false,setup}),b=fixture({setup});assert.deepEqual(b.draw(),a.draw());assert.equal(b.handle.read().activeEntries,3);
  for(const f of [a,b]){f.meshes[0].geometry.clearGroups();f.meshes[1].geometry.addGroup(1,1,8);}
  assert.deepEqual(b.draw(),a.draw());assert.equal(b.handle.read().fallbacks,0);
});

test('a custom per-draw object poisons its shared geometry and shared attribute/index streams',()=>{
  for(const sharing of ['geometry','position','index']){
    const f=fixture({count:4,setup:f=>{
      const unsafe=f.meshes[0],safe=f.meshes[1];unsafe.onBeforeRender=function(){this.geometry.setDrawRange(0,3);};
      if(sharing==='geometry')safe.geometry=unsafe.geometry;else if(sharing==='index')safe.geometry.setIndex(unsafe.geometry.index);else safe.geometry.setAttribute('position',unsafe.geometry.attributes.position);
    }});
    assert.equal(f.handle.read().activeEntries,2,sharing);assert.equal(f.handle.read().rejectedEntries,2);
  }
});

test('between-render geometry, attribute, index, layout, version and shader changes select original native storage',()=>{
  const mutations=[
    m=>{m.geometry=geometry(5);},m=>{m.geometry.setIndex(new T.Uint16BufferAttribute([0,2,1],1));},
    m=>{m.geometry.setAttribute('position',m.geometry.attributes.position.clone());},m=>{m.geometry.attributes.position.needsUpdate=true;},
    m=>{m.geometry.attributes.position.normalized=true;},m=>{m.geometry.attributes.position.setUsage(T.DynamicDrawUsage);},
    m=>{m.material=m.material.clone();},m=>{m.material.onBeforeCompile=function(){};},
  ];
  for(const mutate of mutations){const f=fixture();f.draw();mutate(f.meshes[0]);let native=false;f.tap=({object,geometry})=>{if(object===f.meshes[0]){assert.equal(geometry,object.geometry);assert.equal(geometry,f.meshes[0].geometry);native=!f.handle.read().pages.some(p=>p.geometryId===geometry.id);}};f.draw();assert.equal(native,true);assert.ok(f.handle.read().fallbacks>=1);assert.equal(f.handle.read().scopedEntries,0);}
});

test('prior scene preparation selects source geometry before validation and the native call receives exact arguments',()=>{
  let seen,original;const f=fixture({setup:f=>{original=f.meshes[0].geometry;f.scene.onBeforeRender=function(...args){seen={receiver:this,args};f.meshes[0].geometry=geometry(7);return 'before-value';};}});
  f.tap=({beforeResult})=>assert.equal(beforeResult,'before-value');f.draw();assert.equal(seen.receiver,f.scene);assert.deepEqual(seen.args,[f.renderer,f.scene,f.cam,null]);assert.notEqual(f.meshes[0].geometry,original);assert.equal(f.handle.read().entries[0].fallbackReason,'source-identity-changed');
});

test('own source bounds and exact property descriptors restore before the old scene after callback',()=>{
  let sourceDescriptorsBefore;const f=fixture({setup:f=>{
    const mesh=f.meshes[0];mesh.geometry.computeBoundingSphere();Object.defineProperty(mesh,'boundingSphere',{value:mesh.geometry.boundingSphere.clone(),enumerable:false,writable:false,configurable:true});
    Object.defineProperty(mesh,'onBeforeRender',{value:T.Object3D.prototype.onBeforeRender,enumerable:true,writable:false,configurable:true});
    sourceDescriptorsBefore=f.meshes.map(sourceDescriptors);f.scene.onAfterRender=function(renderer,scene,camera){assert.equal(this,f.scene);assert.deepEqual([renderer,scene,camera],[f.renderer,f.scene,f.cam]);for(let i=0;i<f.meshes.length;i++)assert.deepEqual(sourceDescriptors(f.meshes[i]),sourceDescriptorsBefore[i]);};
  }});f.draw();assertRestored(f,sourceDescriptorsBefore);
  f.meshes[0].boundingSphere.radius+=1;f.draw();assert.equal(f.handle.read().entries[0].fallbackReason,'object-bounds-changed');
});

test('custom null-bound computation and inherited object bounds stay native without invoking custom code during preparation',()=>{
  let called=0;const f=fixture({setup:f=>{f.meshes[0].geometry.computeBoundingSphere=function(){called++;this.boundingSphere=new T.Sphere(new T.Vector3(),100);};}});
  assert.equal(called,0);assert.equal(f.handle.read().rejected['custom-source-bounds'],1);f.draw();assert.equal(called,1);
  const prior=Object.getOwnPropertyDescriptor(T.Mesh.prototype,'boundingSphere');
  try {Object.defineProperty(T.Mesh.prototype,'boundingSphere',{value:new T.Sphere(new T.Vector3(),10),configurable:true});const g=fixture();assert.equal(g.handle.read().activeEntries,0);assert.equal(g.handle.read().rejected['inherited-object-bounds'],3);}
  finally {if(prior)Object.defineProperty(T.Mesh.prototype,'boundingSphere',prior);else delete T.Mesh.prototype.boundingSphere;}
});

test('in-render native raycasting retains original triangle face indices and source geometry',()=>{
  const f=fixture(),mesh=f.meshes[1],source=mesh.geometry,ray=new T.Raycaster(new T.Vector3(0,0,20),new T.Vector3(0,0,-1));f.scene.updateMatrixWorld(true);
  const expected=[];mesh.raycast(ray,expected);let actual;
  f.tap=({object,geometry,phase})=>{if(object===mesh&&phase==='color'){assert.notEqual(geometry,source);actual=[];mesh.raycast(ray,actual);assert.equal(mesh.geometry,source);}};
  f.draw();const compact=hits=>hits.map(h=>({faceIndex:h.faceIndex,distance:h.distance,point:h.point.toArray(),object:h.object}));assert.deepEqual(compact(actual),compact(expected));assert.equal(mesh.geometry,source);
});

test('nested rendering retains native objects and the pending outer shared range',()=>{
  const a=fixture({adapt:false}),b=fixture();let once=false,nestedRows=0;
  b.tap=({level,object,geometry})=>{
    if(level===1){nestedRows++;assert.equal(geometry,object.geometry);assert.equal(b.handle.read().scopedEntries,1);assert.equal(b.handle.read().pages.some(p=>p.geometryId===geometry.id),false);}
    if(level===0&&!once){once=true;const range={...geometry.drawRange};b.renderer.render(b.scene,b.cam);assert.deepEqual(geometry.drawRange,range);assert.notEqual(object.geometry,geometry);}
  };
  const rows=b.draw();assert.equal(nestedRows,6);assert.deepEqual(rows.slice(6),a.draw());assert.equal(b.handle.read().nestedRenders,1);assert.equal(b.handle.read().scopedEntries,0);
});

test('nested rendering inside the prior scene after callback never reactivates its already restored outer scope',()=>{
  let inAfter=false,checks=0;const f=fixture({setup:f=>{const sources=f.meshes.map(m=>m.geometry);f.scene.onAfterRender=function(){if(inAfter)return;inAfter=true;assert.deepEqual(f.meshes.map(m=>m.geometry),sources);f.renderer.render(f.scene,f.cam);assert.deepEqual(f.meshes.map(m=>m.geometry),sources);assert.equal(f.handle.read().scopedEntries,0);checks++;inAfter=false;};}});
  f.draw();assert.equal(checks,1);assert.equal(f.handle.read().nestedRenders,1);assert.equal(f.handle.read().scopedEntries,0);
});

test('scene override materials use native geometry and clearing the override resumes safe pooling',()=>{
  const f=fixture(),sources=f.meshes.map(m=>m.geometry);f.scene.overrideMaterial=new T.ShaderMaterial({vertexShader:'void main(){gl_Position=vec4(float(gl_VertexID),0.,0.,1.);}'});
  f.tap=({object,geometry})=>assert.equal(geometry,sources[f.meshes.indexOf(object)]);f.draw();assert.equal(f.handle.read().pooledCalls,0);assert.equal(f.handle.read().activeEntries,3);
  f.scene.overrideMaterial=null;f.tap=null;f.draw();assert.equal(f.handle.read().pooledCalls,6);
});

test('original render, before, after and nested exceptions preserve their exact thrown object and restore descriptors',()=>{
  for(const point of ['before','draw','after','nested']){
    const error={point};let fired=false;const f=fixture({setup:f=>{if(point==='before')f.scene.onBeforeRender=function(){throw error;};if(point==='after')f.scene.onAfterRender=function(){throw error;};}}),originals=f.meshes.map(sourceDescriptors);
    if(point==='draw')f.tap=()=>{throw error;};
    if(point==='nested')f.tap=({level})=>{if(level===1)throw error;if(!fired){fired=true;f.renderer.render(f.scene,f.cam);}};
    assert.throws(()=>f.draw(),e=>e===error);assertRestored(f,originals);assert.equal(f.handle.read().observerErrors,0);
  }
});

test('offscreen, ArrayCamera and XR scopes stay native while orthographic default rendering remains eligible',()=>{
  for(const kind of ['offscreen','array','xr']){
    const f=fixture();if(kind==='offscreen')f.renderer.setRenderTarget({});if(kind==='array')f.cam=new T.ArrayCamera([camera()]);if(kind==='xr')f.renderer.xr.isPresenting=true;
    f.renderer.render(f.scene,f.cam);assert.equal(f.handle.read().pooledCalls,0,kind);assert.equal(f.handle.read().activeEntries,3);
  }
  const f=fixture(),c=new T.OrthographicCamera(-10,10,10,-10,.1,200);c.position.z=20;c.updateMatrixWorld(true);f.renderer.render(f.scene,c);assert.equal(f.handle.read().pooledCalls,6);
});

test('context loss keeps native storage and deferred restoration reuses only unchanged source bytes',async()=>{
  const f=fixture();f.draw();const before=f.handle.read().pooledCalls;f.canvas.dispatchEvent(new Event('webglcontextlost'));f.draw();assert.equal(f.handle.read().pooledCalls,before);
  f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.draw();assert.equal(f.handle.read().pooledCalls,before);await flushPreparation();f.draw();assert.equal(f.handle.read().pooledCalls,before+6);
  f.canvas.dispatchEvent(new Event('webglcontextlost'));f.meshes[0].geometry.attributes.position.array[0]+=.5;f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.draw();assert.equal(f.handle.read().entries[0].fallbackReason,'source-bytes-changed-on-restore');assert.equal(f.handle.read().contextRestores,2);
});

test('lost-context retirement prevents stale native page buffer and VAO deletion after repeated restoration',async()=>{
  // Actual pinned Three cache modules own all resource registration/deletion.
  // The GL recorder only labels creation generations; it does not simulate a
  // WebGL error or claim native rendering. Native pixels remain a separate gate.
  const deletions=[],generations=[],pages=new Set();let serial=0,caches;
  const gl={
    epoch:1,lost:false,MAX_VERTEX_ATTRIBS:34921,ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,
    FLOAT:5126,HALF_FLOAT:5131,UNSIGNED_SHORT:5123,SHORT:5122,UNSIGNED_INT:5125,INT:5124,BYTE:5120,UNSIGNED_BYTE:5121,
    getParameter(parameter){assert.equal(parameter,this.MAX_VERTEX_ATTRIBS);return 16;},
    createBuffer(){return {kind:'buffer',epoch:this.epoch,id:++serial};},
    createVertexArray(){return {kind:'vao',epoch:this.epoch,id:++serial};},
    deleteBuffer(resource){deletions.push({kind:'buffer',resource,lost:gl.lost,epoch:gl.epoch});},
    deleteVertexArray(resource){deletions.push({kind:'vao',resource,lost:gl.lost,epoch:gl.epoch});},
    bindBuffer(){},bufferData(){},bufferSubData(){},bindVertexArray(){},
    enableVertexAttribArray(){},disableVertexAttribArray(){},vertexAttribDivisor(){},vertexAttribPointer(){},vertexAttribIPointer(){},
  };
  function createCaches(renderer){
    const info=renderer.info,attributes=WebGLAttributes(gl);
    const bindingStates=WebGLBindingStates(gl,attributes),geometries=WebGLGeometries(gl,attributes,info,bindingStates);
    const objects=WebGLObjects(gl,geometries,attributes,bindingStates,info);
    caches={info,attributes,bindingStates,geometries,objects};generations.push(caches);
  }
  const program=phase=>({id:phase==='shadow'?2:1,getAttributes:()=>({position:{location:0,locationSize:1},normal:{location:1,locationSize:1},uv:{location:2,locationSize:1}})});
  const f=fixture({count:4,setup:f=>{
    f.meshes[2].geometry.setIndex(null);f.meshes[3].geometry.setIndex(null);
    createCaches(f.renderer);
    // Native renderer registration precedes the adapter. Its restoration
    // recreates these factories without cleaning old geometry listeners.
    f.canvas.addEventListener('webglcontextlost',event=>event.preventDefault());
    f.canvas.addEventListener('webglcontextrestored',()=>{f.renderer.info=WebGLInfo({});createCaches(f.renderer);});
    f.updateObject=object=>{const g=caches.objects.update(object);if(!f.meshes.includes(object))pages.add(g);};
    f.tap=({object,geometry,material,phase})=>{
      assert.notEqual(object.geometry,geometry);assert.ok(pages.has(geometry));
      caches.bindingStates.setup(object,material,program(phase),geometry,geometry.index);
    };
  }});
  const sources=f.meshes.map(mesh=>mesh.geometry),descriptorsBefore=f.meshes.map(sourceDescriptors);let sourceDisposals=0;
  for(const source of sources)source.addEventListener('dispose',()=>sourceDisposals++);
  function draw(){const rows=f.draw();caches.bindingStates.resetDefaultState();return rows;}
  const firstRows=draw();assert.equal(pages.size,2);assert.equal(f.handle.read().activeEntries,4);
  const originals=[...pages].map(geometry=>({
    geometry,index:geometry.index,attributes:geometry.attributes,
    arrays:Object.values(geometry.attributes).map(a=>a.array).concat(geometry.index?[geometry.index.array]:[]),
    bytes:Object.values(geometry.attributes).map(a=>Uint8Array.from(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength))).concat(geometry.index?[Uint8Array.from(new Uint8Array(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength))]:[]),
  }));
  const listenerCounts=()=>[...pages].map(geometry=>geometry._listeners?.dispose?.length??0);
  assert.deepEqual(listenerCounts(),[1,1]);
  for(let cycle=1;cycle<=2;cycle++){
    gl.lost=true;f.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
    assert.deepEqual(listenerCounts(),[0,0]);assert.equal(caches.info.memory.geometries,sources.length);
    assert.equal(deletions.filter(d=>d.lost&&d.kind==='buffer').length,7*cycle);
    assert.equal(deletions.filter(d=>d.lost&&d.kind==='vao').length,4*cycle);
    gl.epoch++;gl.lost=false;f.canvas.dispatchEvent(new Event('webglcontextrestored'));await flushPreparation();
    assert.deepEqual(draw(),firstRows);assert.equal(pages.size,2);assert.deepEqual(listenerCounts(),[1,1]);
    assert.equal(f.handle.read().activeEntries,4);assert.equal(f.handle.read().observerErrors,0);assertRestored(f,descriptorsBefore);
    for(const original of originals){
      assert.equal(original.geometry.index,original.index);assert.equal(original.geometry.attributes,original.attributes);
      const arrays=Object.values(original.geometry.attributes).map(a=>a.array).concat(original.geometry.index?[original.geometry.index.array]:[]);
      arrays.forEach((array,i)=>{assert.equal(array,original.arrays[i]);assert.deepEqual(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),original.bytes[i]);});
    }
  }
  f.handle.dispose();assertRestored(f,descriptorsBefore);assert.deepEqual(listenerCounts(),[0,0]);
  assert.equal(sourceDisposals,0);assert.ok(generations.every(g=>g.info.memory.geometries===sources.length));
  assert.equal(deletions.filter(d=>!d.lost&&d.resource.epoch!==d.epoch).length,0);
  assert.equal(deletions.filter(d=>!d.lost&&d.kind==='buffer').length,7);
  assert.equal(deletions.filter(d=>!d.lost&&d.kind==='vao').length,4);
  assert.equal(f.handle.read().contextLosses,2);assert.equal(f.handle.read().contextRestores,2);
});

test('detached source storage at restoration falls back without throwing from the context event',()=>{
  const f=fixture();f.canvas.dispatchEvent(new Event('webglcontextlost'));structuredClone(f.meshes[0].geometry.attributes.position.array.buffer,{transfer:[f.meshes[0].geometry.attributes.position.array.buffer]});
  assert.doesNotThrow(()=>f.canvas.dispatchEvent(new Event('webglcontextrestored')));assert.equal(f.handle.read().entries[0].status,'fallback');assert.equal(f.handle.read().observerErrors,0);
});

test('source disposal invalidates only its entry and handle disposal removes all owned listeners and storage',()=>{
  const f=fixture(),sources=f.meshes.map(m=>m.geometry),originals=f.meshes.map(sourceDescriptors),render=f.renderer.render;
  sources[0].dispose();assert.equal(f.handle.read().entries[0].fallbackReason,'source-disposed');f.draw();assert.equal(f.handle.read().activeEntries,2);
  const sourceDisposeListeners=sources.map(g=>g._listeners?.dispose?.length??0);assert.deepEqual(sourceDisposeListeners,[1,1,1]);
  f.handle.dispose();assertRestored(f,originals);assert.notEqual(f.renderer.render,render);assert.equal(f.handle.read().active,false);assert.equal(f.handle.read().activeEntries,0);
  assert.deepEqual(sources.map(g=>g._listeners?.dispose?.length??0),[0,0,0]);assert.ok([...f.canvas.listeners.values()].every(s=>s.size===0));assert.doesNotThrow(()=>f.handle.dispose());
});

test('disposal requested during a captured native render defers cleanup until its final draw and restoration',()=>{
  const a=fixture({adapt:false}),b=fixture(),originals=b.meshes.map(sourceDescriptors);let once=false;
  b.tap=()=>{if(!once){once=true;b.handle.dispose();assert.equal(b.handle.read().active,false);assert.equal(b.handle.read().scopedEntries,1);}};
  assert.deepEqual(b.draw(),a.draw());assertRestored(b,originals);assert.equal(b.handle.read().disabledReason,'disposed');assert.deepEqual(b.draw(),a.draw());
});

test('diagnostics are bounded copies and page/entry budgets never merge incompatible or oversized allocations',()=>{
  const f=fixture({count:5,options:{maxDiagnosticEntries:2,maxEntries:4}}),a=f.handle.read();assert.equal(a.preparedEntries,4);assert.equal(a.truncatedEntries,2);assert.equal(a.rejected['entry-budget'],1);
  a.entries[0].status='disposed';a.pages[0].bytes=-1;a.rejected.fake=9;assert.equal(f.handle.read().entries[0].status,'ready');assert.ok(f.handle.read().pages[0].bytes>0);assert.equal(f.handle.read().rejected.fake,undefined);
  for(const options of [{maxPageVertices:6},{maxPageBytes:16},{maxTotalBytes:16}]){const g=fixture({options});assert.equal(g.handle.read().activeEntries,0);assert.equal(g.handle.read().poolBytes,0);}
  const g=fixture({count:5,options:{maxPageVertices:12,maxPages:1}});assert.equal(g.handle.read().pageCount,1);assert.equal(g.handle.read().activeEntries,2);assert.equal(g.handle.read().poolBytes,2*(6*8*4+6*2));
});

test('preparation is explicit and idempotent, with independent late assets staying native until a later boundary',()=>{
  const f=fixture();assert.equal(installSharedGeometryBuffers(f.renderer,f.scene),f.handle);const old=f.handle.read();f.handle.prepare();assert.equal(f.handle.read().consideredEntries,old.consideredEntries);
  const added=[new T.Mesh(geometry(0),f.material),new T.Mesh(geometry(.1),f.material)];for(const m of added){m.name='late';f.scene.add(m);}f.draw();assert.equal(f.handle.read().preparedEntries,3);f.handle.prepare();assert.equal(f.handle.read().preparedEntries,5);assert.equal(f.handle.read().pageCount,2);
});

test('unsupported hook descriptors and a second renderer do not replace existing native or owned callbacks',()=>{
  const f=fixture({adapt:false});Object.defineProperty(f.renderer,'render',{value:f.renderer.render,configurable:false});const original=f.renderer.render,handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});assert.equal(handle.read().supported,false);assert.equal(f.renderer.render,original);
  const g=fixture(),other=fixture({adapt:false});const previous=g.scene.onBeforeRender;const rejected=installSharedGeometryBuffers(other.renderer,g.scene);assert.equal(rejected.read().supported,false);assert.equal(g.scene.onBeforeRender,previous);
});

test('an explicit audited UnsignedByte/no-node output contract is required before any preparation',()=>{
  for(const contract of [undefined,{type:T.HalfFloatType,nodes:false},{type:T.FloatType,nodes:false},{type:T.UnsignedByteType,nodes:true}]){
    const f=fixture({adapt:false}),original=f.renderer.render,direct=f.renderer.renderBufferDirect;
    const handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput:contract});
    assert.equal(handle.prepare().supported,false);assert.equal(handle.read().disabledReason,'unsupported-renderer-output-contract');
    assert.equal(f.renderer.render,original);assert.equal(f.renderer.renderBufferDirect,direct);assert.equal(f.calls.length,0);
    assert.equal(handle.read().preparationAttempts,0);assert.equal(f.renderer.info.render.frame,0);
  }
});

test('invisible-material preparation uses native cache registration and attribute uploads without draws, clears or app callbacks',()=>{
  const uploads=[],pages=[];let serial=0,attributes,bindingStates,appBefore=0,appAfter=0;
  const gl={
    MAX_VERTEX_ATTRIBS:34921,ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,
    FLOAT:5126,HALF_FLOAT:5131,UNSIGNED_SHORT:5123,SHORT:5122,UNSIGNED_INT:5125,INT:5124,BYTE:5120,UNSIGNED_BYTE:5121,
    getParameter(parameter){assert.equal(parameter,this.MAX_VERTEX_ATTRIBS);return 16;},
    createBuffer(){return {id:++serial};},createVertexArray(){return {id:++serial};},
    bindBuffer(){},bufferData(target,data,usage){uploads.push({target,data,usage});},bufferSubData(){},bindVertexArray(){},
    deleteBuffer(){},deleteVertexArray(){},enableVertexAttribArray(){},disableVertexAttribArray(){},vertexAttribDivisor(){},vertexAttribPointer(){},vertexAttribIPointer(){},
  };
  const f=fixture({adapt:false,setup:f=>{
    attributes=WebGLAttributes(gl);bindingStates=WebGLBindingStates(gl,attributes);
    const geometries=WebGLGeometries(gl,attributes,f.renderer.info,bindingStates),objects=WebGLObjects(gl,geometries,attributes,bindingStates,f.renderer.info);
    f.updateObject=object=>{objects.update(object);if(!f.meshes.includes(object)&&!pages.includes(object.geometry))pages.push(object.geometry);};
    f.scene.onBeforeRender=()=>{appBefore++;};f.scene.onAfterRender=()=>{appAfter++;};
  }});
  f.renderer.info.render.calls=7;f.renderer.info.render.triangles=13;f.renderer.info.render.lines=2;f.renderer.info.render.points=3;
  const before={...f.renderer.info.render},sourceState=f.meshes.map(sourceDescriptors);
  f.handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});f.handle.prepare();
  assert.equal(pages.length,1);assert.equal(f.directCalls.length,0);assert.equal(f.clears.length,0);assert.equal(appBefore,0);assert.equal(appAfter,0);
  assert.equal(f.renderer.autoClear,true);assert.equal(f.renderer.info.autoReset,true);assert.equal(f.renderer.getRenderTarget(),null);
  assert.deepEqual(f.renderer.info.render,{...before,frame:before.frame+1});assertRestored(f,sourceState);
  assert.equal(uploads.length,3);assert.ok(uploads.every(u=>u.target===gl.ARRAY_BUFFER));
  for(const a of Object.values(pages[0].attributes))assert.ok(attributes.get(a));
  assert.equal(attributes.get(pages[0].index),undefined,'index is intentionally deferred to native draw binding');
  assert.equal(pages[0]._listeners.dispose.length,1);
  for(const mesh of f.meshes)assert.equal(attributes.get(mesh.geometry.attributes.position),undefined,'preparation did not visit app objects');
  f.tap=({object,geometry,material})=>bindingStates.setup(object,material,{id:1,getAttributes:()=>({position:{location:0,locationSize:1},normal:{location:1,locationSize:1},uv:{location:2,locationSize:1}})},geometry,geometry.index);
  f.draw();assert.equal(appBefore,1);assert.equal(appAfter,1);assert.equal(f.clears.length,1);assert.equal(f.directCalls.length,6);
  assert.equal(uploads.filter(u=>u.target===gl.ELEMENT_ARRAY_BUFFER).length,1);assert.ok(attributes.get(pages[0].index));
  assert.equal(f.handle.read().preparationRenders,1);assert.equal(f.handle.read().preparationFrames,1);assert.equal(f.handle.read().renderCalls,1);
  f.handle.dispose();
});

test('offscreen and XR preparation defer in bounded microtasks while real unready frames stay native',async()=>{
  for(const kind of ['offscreen','xr']){
    const f=fixture({adapt:false}),target={kind};f.renderer.autoClear=false;f.renderer.info.autoReset=false;
    if(kind==='offscreen')f.renderer.setRenderTarget(target);else f.renderer.xr.isPresenting=true;
    f.handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});f.handle.prepare();
    assert.equal(f.calls.length,0);assert.equal(f.handle.read().preparationReady,false);assert.equal(f.handle.read().preparationQueued,true);
    await flushPreparation();assert.equal(f.calls.length,0);assert.equal(f.handle.read().preparationQueued,false);
    const deferred=f.handle.read().preparationDeferrals;await flushPreparation();assert.equal(f.handle.read().preparationDeferrals,deferred,'no self-rescheduling loop');
    assert.equal(f.renderer.getRenderTarget(),kind==='offscreen'?target:null);
    f.renderer.setRenderTarget(null);f.renderer.xr.isPresenting=false;
    f.tap=({object,geometry})=>assert.equal(geometry,object.geometry);f.draw();assert.equal(f.handle.read().pooledCalls,0);assert.equal(f.handle.read().preparationRenders,0);
    await flushPreparation();assert.equal(f.handle.read().preparationReady,true);assert.equal(f.handle.read().preparationRenders,1);assert.equal(f.handle.read().preparationFrames,1);
    assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.info.autoReset,false);
    f.tap=null;f.draw();assert.equal(f.handle.read().pooledCalls,6);f.handle.dispose();
  }
});

test('a returning outer render wrapper cannot claim page readiness without a native frame increment',async()=>{
  let allow=false;
  const f=fixture({adapt:false,setup:f=>{const original=f.renderer.render;f.renderer.render=function(...args){if(args[0]!==f.scene&&!allow)return f.returnValue;return Reflect.apply(original,this,args);};}});
  f.handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});f.handle.prepare();await flushPreparation();
  assert.equal(f.handle.read().preparationReady,false);assert.equal(f.handle.read().preparationFrames,0);assert.equal(f.handle.read().preparationFailures,0);
  assert.equal(f.renderer.info.render.frame,0);assert.equal(f.handle.read().preparationQueued,false);
  f.draw();assert.equal(f.handle.read().pooledCalls,0);assert.equal(f.renderer.info.render.frame,1);
  allow=true;await flushPreparation();assert.equal(f.handle.read().preparationReady,true);assert.equal(f.renderer.info.render.frame,2);
  assert.equal(f.handle.read().preparationFrames,1);assert.equal(f.handle.read().renderCalls,1);f.handle.dispose();
});

test('preparation exceptions retain native increments, restore public state and leave subsequent app renders native',()=>{
  for(const afterNative of [false,true]){
    const error={afterNative};const f=fixture({adapt:false,setup:f=>{const original=f.renderer.render;f.renderer.render=function(...args){if(args[0]===f.scene)return Reflect.apply(original,this,args);if(afterNative)Reflect.apply(original,this,args);throw error;};}});
    const sourceState=f.meshes.map(sourceDescriptors);f.renderer.autoClear=false;f.renderer.info.autoReset=false;
    f.handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});assert.doesNotThrow(()=>f.handle.prepare());
    const stats=f.handle.read();assert.equal(stats.preparationReady,false);assert.equal(stats.preparationFailures,1);assert.equal(stats.preparationFrames,afterNative?1:0);assert.equal(stats.preparationRenders,0);assert.equal(stats.active,false);
    assert.equal(f.renderer.autoClear,false);assert.equal(f.renderer.info.autoReset,false);assert.equal(f.directCalls.length,0);assert.equal(f.clears.length,0);assertRestored(f,sourceState);
    f.tap=({object,geometry})=>assert.equal(object.geometry,geometry);assert.doesNotThrow(()=>f.draw());assert.equal(f.handle.read().pooledCalls,0);f.handle.dispose();
  }
});

test('context generations and disposal cancel stale queued preparation without extra frame increments',async()=>{
  const f=fixture(),initial=f.handle.read().preparationAttempts,frame=f.renderer.info.render.frame;
  f.canvas.dispatchEvent(new Event('webglcontextlost'));f.canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(f.handle.read().preparationQueued,true);f.canvas.dispatchEvent(new Event('webglcontextlost'));await flushPreparation();
  assert.equal(f.handle.read().preparationAttempts,initial);assert.equal(f.renderer.info.render.frame,frame);assert.equal(f.handle.read().preparationReady,false);
  f.canvas.dispatchEvent(new Event('webglcontextrestored'));f.handle.dispose();await flushPreparation();
  assert.equal(f.handle.read().preparationAttempts,initial);assert.equal(f.renderer.info.render.frame,frame);assert.equal(f.handle.read().preparationQueued,false);
});

test('startup and deferred restoration preparation do not create animation callbacks or synthetic accepted frames',async()=>{
  let loop=null,inLoop=false,lost=false,accepted=0;const timestamps=[],preparationBoundaries=[];
  const f=fixture({adapt:false,setup:f=>{
    const original=f.renderer.render;f.renderer.render=function(...args){if(args[0]!==f.scene){preparationBoundaries.push(inLoop);assert.equal(inLoop,false);}return Reflect.apply(original,this,args);};
    f.renderer.getContext=()=>({isContextLost:()=>lost});f.renderer.setAnimationLoop=callback=>{loop=callback;};f.renderer.dispose=()=>{};
  }});
  const cleanup=installGpuFramePacing(f.renderer,{mode:'browser'});
  f.handle=installSharedGeometryBuffers(f.renderer,f.scene,{rendererOutput});f.handle.prepare();
  assert.equal(gpuFramePacingDiagnostics(f.renderer).animationCallbacks,0);assert.equal(gpuFramePacingDiagnostics(f.renderer).renderedCallbacks,0);assert.equal(f.renderer.info.render.frame,1);
  f.renderer.setAnimationLoop(now=>{inLoop=true;try{timestamps.push(now);f.draw();accepted++;}finally{inLoop=false;}});
  loop(100);assert.equal(accepted,1);assert.equal(gpuFramePacingDiagnostics(f.renderer).renderedCallbacks,1);
  lost=true;f.canvas.dispatchEvent(new Event('webglcontextlost'));lost=false;f.canvas.dispatchEvent(new Event('webglcontextrestored'));
  loop(116);assert.equal(f.handle.read().preparationRenders,1);const counted=gpuFramePacingDiagnostics(f.renderer).renderedCallbacks,frame=f.renderer.info.render.frame;
  await flushPreparation();assert.equal(f.renderer.info.render.frame,frame+1);assert.equal(gpuFramePacingDiagnostics(f.renderer).renderedCallbacks,counted);assert.equal(accepted,2);
  loop(132);assert.deepEqual(timestamps,[100,116,132]);assert.equal(accepted,3);assert.equal(gpuFramePacingDiagnostics(f.renderer).animationCallbacks,3);assert.equal(gpuFramePacingDiagnostics(f.renderer).renderedCallbacks,3);
  assert.equal(f.handle.read().preparationRenders,2);assert.equal(f.handle.read().preparationFrames,2);assert.deepEqual(preparationBoundaries,[false,false]);
  f.renderer.setAnimationLoop(null);f.handle.dispose();cleanup();
});

test('direct calls outside an eligible root scope retain exact receiver, arguments, return and source range',()=>{
  const f=fixture(),object=f.meshes[0],geometry=object.geometry,range={...geometry.drawRange},foreign={name:'borrowed receiver'},group={start:0,count:3};
  const args=[f.cam,null,geometry,new T.MeshDepthMaterial(),object,group];
  assert.equal(Reflect.apply(f.renderer.renderBufferDirect,foreign,args),f.directReturn);
  const recorded=f.directCalls.at(-1);assert.equal(recorded.receiver,foreign);assert.deepEqual(recorded.args,args);assert.deepEqual(geometry.drawRange,range);
  assert.equal(f.handle.read().pooledCalls,0);assert.equal(f.handle.read().scopedEntries,0);f.handle.dispose();
});

test('a prior object callback changing target, override or XR state immediately leaves later direct draws native',()=>{
  for(const kind of ['target','override','xr']){
    const setup=f=>{
      f.callbackCalls=0;f.meshes[0].renderOrder=-1;
      f.meshes[0].onBeforeRender=function(){
        f.callbackCalls++;assert.equal(this,f.meshes[0]);
        if(kind==='target')f.renderer.setRenderTarget({name:'callback target'});
        if(kind==='override')f.scene.overrideMaterial=new T.ShaderMaterial();
        if(kind==='xr')f.renderer.xr.isPresenting=true;
      };
      f.scene.onAfterRender=()=>{f.renderer.setRenderTarget(null);f.scene.overrideMaterial=null;f.renderer.xr.isPresenting=false;};
    };
    const a=fixture({adapt:false,shadows:false,setup}),b=fixture({shadows:false,setup}),originals=b.meshes.map(sourceDescriptors);
    assert.equal(b.handle.read().activeEntries,2);assert.equal(b.callbackCalls,0);
    b.tap=({object,geometry})=>assert.equal(geometry,object.geometry);
    assert.deepEqual(b.draw(),a.draw());assert.equal(b.callbackCalls,1);assert.equal(a.callbackCalls,1);
    assert.equal(b.handle.read().pooledCalls,0);assert.equal(b.handle.read().fallbacks,0);assertRestored(b,originals);b.handle.dispose();
  }
});

test('pooled storage observes every dynamically updated draw range once per native submission',()=>{
 const baseline=fixture({adapt:false}),candidate=fixture();
 for(const [start,count] of [[0,Infinity],[1,5],[3,3],[-2,5],[0,0],[2,Infinity]]){
  for(const f of [baseline,candidate])for(const mesh of f.meshes)mesh.geometry.setDrawRange(start,count);
  assert.deepEqual(candidate.draw(),baseline.draw(),String(start)+'/'+String(count));
  assert.equal(candidate.handle.read().fallbacks,0,'An in-range dynamic draw remains pooled');
 }
 assert.equal(candidate.handle.read().activeEntries,3);
});
