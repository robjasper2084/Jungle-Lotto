import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {addStreetDetails} from './streetDetails.ts';
import type {StreetBox,StreetPlan} from './streetPlan.ts';

test('actual street materials share shader code while retaining each curb and gutter grime binding',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const context={fillRect(){}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:(name:string)=>{
  assert.equal(name,'canvas');return {width:0,height:0,getContext:(kind:string)=>{assert.equal(kind,'2d');return context;}};
 }}});
 const scene=new T.Scene();
 try{
  const kinds:StreetBox['material'][]=['white','yellow','curb','gutter','metal','green','tactile'];
  const plan:StreetPlan={boxes:kinds.map((material,i)=>({material,x:2+i*2,y:2.12,z:2,w:1,h:.2,l:1,yaw:0})),signs:[],stats:{},notes:[]};
  const input=JSON.stringify(plan),result=addStreetDetails(scene,plan);
  assert.equal(JSON.stringify(plan),input);assert.equal(result.boxes,7);assert.equal(result.signs,0);
  const materials=kinds.map(kind=>{
   const mesh=scene.children.find(o=>o.name==='Street detail 0,0,'+kind) as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
   assert(mesh&&mesh.receiveShadow);assert(mesh.geometry.attributes.position.count>0);return mesh.material;
  });
  assert.equal(new Set(materials).size,7);
  const compile=(m:T.Material)=>{
   const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader} as Parameters<T.Material['onBeforeCompile']>[0];
   m.onBeforeCompile(shader,{} as T.WebGLRenderer);return shader;
  };
  const shaders=materials.map(compile);
  assert.equal(new Set(materials.map(m=>m.customProgramCacheKey())).size,1);
  assert.equal(new Set(shaders.map(s=>s.vertexShader)).size,1);
  assert.equal(new Set(shaders.map(s=>s.fragmentShader)).size,1);
  assert.deepEqual(shaders.map(s=>s.uniforms.streetGrime.value),[false,false,true,true,false,false,false]);
  assert.equal(new Set(shaders.map(s=>s.uniforms.streetGrime)).size,7);
  assert.deepEqual(materials.map(m=>m.roughness),[.94,.93,.9,.95,.7,.9,.9]);
  assert.deepEqual(materials.map(m=>m.metalness),[0,0,0,0,.5,0,0]);
  assert(materials.every(m=>m.side===T.FrontSide&&!m.transparent&&m.opacity===1&&m.map===null));

  // Exercise the installed uploader's program cache while alternating actual
  // material bindings; a shared linked program must not retain the last curb.
  let uploaded:unknown;
  const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>1,
   getActiveUniform:()=>({name:'streetGrime',size:1,type:0x8b56}),getUniformLocation:()=>0,
   uniform1i:(_location:number,value:unknown)=>{uploaded=value;}};
  const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
  const linked=new Uniforms(gl,{});
  for(const i of [0,2,4,3,1,5,2,6,3,0]){
   Uniforms.upload(gl,linked.seq,shaders[i].uniforms,{});
   assert.equal(Boolean(uploaded),kinds[i]==='curb'||kinds[i]==='gutter');
  }
  shaders[2].uniforms.streetGrime.value=false;
  assert.equal(shaders[3].uniforms.streetGrime.value,true);
  assert.equal(compile(materials[2]).uniforms.streetGrime.value,true);
  result.update(2000,2000);assert(scene.children.filter(o=>o.name.startsWith('Street detail ')).every(o=>!o.visible));
  result.update(128,128);assert(scene.children.filter(o=>o.name.startsWith('Street detail ')).every(o=>o.visible));
 }finally{
  if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');
  const disposed=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!disposed.has(m)){disposed.add(m);(m as T.MeshStandardMaterial).map?.dispose();m.dispose();}}});
 }
});
