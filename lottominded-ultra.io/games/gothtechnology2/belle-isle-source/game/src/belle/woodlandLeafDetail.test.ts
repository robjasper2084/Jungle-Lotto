import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {addWoodlandFloor} from './woodland.ts';
import type {ParkMap} from './terrain.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {hasAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {installWoodlandLeafDetail,WOODLAND_LEAF_DETAIL_ORIGINAL,WOODLAND_LEAF_DETAIL_MASKED,WOODLAND_LEAF_DETAIL_KEY} from './woodlandLeafDetail.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
function material(){
 const scene=new T.Scene();
 addWoodlandFloor(scene,{areas:[{kind:'wood',id:'proof',points:[[0,0],[1,0],[1,1],[0,1],[0,0]]}]} as unknown as ParkMap);
 return (scene.children[0] as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>).material;
}
function shader():Shader{return {vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Shader;}
function compile(m:T.Material){const s=shader();m.onBeforeCompile(s,{} as T.WebGLRenderer);return s;}
function state(m:T.Material){return {compile:m.onBeforeCompile,render:m.onBeforeRender,key:m.customProgramCacheKey,version:m.version};}

test('woodland original block is pinned to d4f4baa8 and the actual unchanged factory',()=>{
 assert.equal(createHash('sha256').update(WOODLAND_LEAF_DETAIL_ORIGINAL).digest('hex'),'96f51eec55e5dc5456cbf00e51754f7c05d2dd654c651263bc05111e296cf66e');
 const source=readFileSync(new URL('./woodland.ts',import.meta.url),'utf8');
 assert.equal(source.split(WOODLAND_LEAF_DETAIL_ORIGINAL).length-1,1);
 const original=material();assert.equal(original.customProgramCacheKey(),'flatwoods-leaf-litter-v1');
 assert.equal(compile(original).fragmentShader.split(WOODLAND_LEAF_DETAIL_ORIGINAL).length-1,1);
});

test('woodland experiment is disabled by default and explicitly off without changing the original',()=>{
 const m=material(),before=state(m),original=compile(m);
 assert.equal(installWoodlandLeafDetail(m),false);assert.equal(installWoodlandLeafDetail(m,{enabled:false}),false);
 assert.deepEqual(state(m),before);assert.deepEqual(compile(m),original);
});

test('only the final named ordinary opaque woodland material can opt in',()=>{
 for(const change of [
  (m:T.MeshStandardMaterial)=>{m.name='Park lawn';},
  (m:T.MeshStandardMaterial)=>{m.transparent=true;},
  (m:T.MeshStandardMaterial)=>{m.opacity=.5;},
  (m:T.MeshStandardMaterial)=>{m.alphaTest=.1;},
  (m:T.MeshStandardMaterial)=>{m.alphaHash=true;},
  (m:T.MeshStandardMaterial)=>{m.wireframe=true;},
 ]){
  const m=material();change(m);const before=state(m);
  assert.equal(installWoodlandLeafDetail(m,{enabled:true}),false);assert.deepEqual(state(m),before);
 }
 class Derived extends T.MeshStandardMaterial{}
 const derived=new Derived();derived.name='Flatwoods forest floor';assert.equal(installWoodlandLeafDetail(derived,{enabled:true}),false);
});

test('enabled wrapper replaces only the exact leaf block and preserves inherited receiver and bindings',()=>{
 const m=material(),originalHook=m.onBeforeCompile,uniform={value:new T.Texture()};let receiver:T.Material|undefined;
 m.onBeforeCompile=function(s,r){receiver=this;originalHook.call(this,s,r);s.uniforms.ownerTexture=uniform;s.fragmentShader+='\n// completed owner decoration';};
 m.customProgramCacheKey=()=>'finished-woodland-material';
 const before=compile(m),render=m.onBeforeRender,options={enabled:true},version=m.version;
 assert.equal(installWoodlandLeafDetail(m,options),true);options.enabled=false;
 const after=compile(m);
 assert.equal(receiver,m);assert.equal(after.vertexShader,before.vertexShader);assert.equal(after.uniforms.ownerTexture,uniform);
 assert.equal(after.fragmentShader.replace(WOODLAND_LEAF_DETAIL_MASKED,WOODLAND_LEAF_DETAIL_ORIGINAL),before.fragmentShader);
 assert.equal(m.onBeforeRender,render);assert.equal(m.version,version+1);
 assert.equal(m.customProgramCacheKey(),'finished-woodland-material|'+WOODLAND_LEAF_DETAIL_KEY);
 const installed=state(m);assert.equal(installWoodlandLeafDetail(m,{enabled:true}),true);assert.deepEqual(state(m),installed);
});

test('both derivatives remain unconditional and original visible/final arithmetic is retained',()=>{
 const branch=WOODLAND_LEAF_DETAIL_MASKED.indexOf('if(detail>0.){'),end=WOODLAND_LEAF_DETAIL_MASKED.indexOf('\n   }',branch);
 assert(branch>0&&end>branch);
 assert.equal((WOODLAND_LEAF_DETAIL_MASKED.slice(0,branch).match(/fwidth\(q\)/g)||[]).length,2);
 assert(!/fwidth|dFdx|dFdy|texture/.test(WOODLAND_LEAF_DETAIL_MASKED.slice(branch,end)));
 for(const expression of [
  'cell=floor(q*9.),p=fract(q*9.)-.5;',
  'seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453)',
  'angle=seed*6.283;',
  'p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;',
  'float detail=1.-smoothstep(.05,.25,length(fwidth(q)));',
 ])assert(WOODLAND_LEAF_DETAIL_ORIGINAL.includes(expression)&&WOODLAND_LEAF_DETAIL_MASKED.includes(expression),expression);
 const originalLeaf='leaf=1.-smoothstep(.15,.15+length(fwidth(q))*7.,length(p*vec2(1.,2.8)));';
 assert(WOODLAND_LEAF_DETAIL_ORIGINAL.includes(originalLeaf));
 assert(WOODLAND_LEAF_DETAIL_MASKED.includes(originalLeaf.replace('fwidth(q)','leafFootprint')));
 const final=WOODLAND_LEAF_DETAIL_ORIGINAL.slice(WOODLAND_LEAF_DETAIL_ORIGINAL.indexOf('   float litterTone='));
 assert.equal(WOODLAND_LEAF_DETAIL_MASKED.slice(end+'\n   }\n'.length),final);
 assert(WOODLAND_LEAF_DETAIL_MASKED.includes('float seed=0.,leaf=0.;'));
});

test('changed, duplicate or conflicting inherited shader blocks fail before candidate replacement',()=>{
 for(const modify of [
  (s:Shader)=>{s.fragmentShader=s.fragmentShader.replace('leaf*detail*.48','leaf*detail*.49');},
  (s:Shader)=>{s.fragmentShader+=WOODLAND_LEAF_DETAIL_ORIGINAL;},
  (s:Shader)=>{s.vertexShader=s.vertexShader.replace('forestXZ=position.xz;','forestXZ=position.zy;');},
  (s:Shader)=>{s.fragmentShader+='\nfloat leafFootprint;';},
 ]){
  const m=material(),old=m.onBeforeCompile;m.onBeforeCompile=function(s,r){old.call(this,s,r);modify(s);};
  assert(installWoodlandLeafDetail(m,{enabled:true}));const s=shader();
  assert.throws(()=>m.onBeforeCompile(s,{} as T.WebGLRenderer),/Woodland leaf-detail proof contract/);
  assert(!s.fragmentShader.includes(WOODLAND_LEAF_DETAIL_MASKED));
 }
});

test('copied diagnostic hooks validate their receiver and overwritten installations cannot silently succeed',()=>{
 const m=material();assert(installWoodlandLeafDetail(m,{enabled:true}));
 const clone=m.clone();clone.onBeforeCompile=m.onBeforeCompile;clone.customProgramCacheKey=m.customProgramCacheKey;
 assert(compile(clone).fragmentShader.includes(WOODLAND_LEAF_DETAIL_MASKED));
 clone.name='Park lawn';assert.throws(()=>compile(clone),/approved material changed/);
 m.onBeforeCompile=()=>{};assert.throws(()=>installWoodlandLeafDetail(m,{enabled:true}),/installed hooks changed/);
});

test('final wrapper retains the real atmosphere owner, uniforms and complete original shader',()=>{
 const m=material(),scene=new T.Scene(),noise=new T.Texture();scene.add(new T.Mesh(new T.BoxGeometry(),m));
 const atmosphere=new WorldAtmosphere(scene,noise);atmosphere.flush();
 const before=compile(m);assert(hasAtmosphereProgram(m.onBeforeCompile,atmosphere));
 assert(installWoodlandLeafDetail(m,{enabled:true}));assert(hasAtmosphereProgram(m.onBeforeCompile,atmosphere));
 const after=compile(m);assert.equal(after.uniforms.belleCloudNoise,atmosphere.uniforms.belleCloudNoise);
 assert.equal(after.vertexShader,before.vertexShader);
 assert.equal(after.fragmentShader.replace(WOODLAND_LEAF_DETAIL_MASKED,WOODLAND_LEAF_DETAIL_ORIGINAL),before.fragmentShader);
 for(const key of Object.keys(before.uniforms))assert.equal(after.uniforms[key],before.uniforms[key]);
 atmosphere.dispose();noise.dispose();
});
