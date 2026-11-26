import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installMacArthurBumpCenterReuse,MACARTHUR_BUMP_CENTER_ASSIGNMENT,MACARTHUR_BUMP_CENTER_READ,MACARTHUR_BUMP_CENTER_KEY} from './macArthurBumpCenterReuse.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {hasAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {registerSharedGeometryShader} from './sharedGeometryBuffers.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0];
function material(){
 const texture=new T.Texture();texture.colorSpace=T.SRGBColorSpace;
 return new T.MeshStandardMaterial({name:'Higgsfield • warm limestone · MacArthur masonry',map:texture,bumpMap:texture,bumpScale:.018,side:T.DoubleSide,roughness:.84});
}
function shader():Shader{return {vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Shader;}
function compile(m:T.Material){const s=shader();m.onBeforeCompile(s,{} as T.WebGLRenderer);return s;}
function renderCallback(m:T.Material){m.onBeforeRender({} as T.WebGLRenderer,new T.Scene(),new T.PerspectiveCamera(),new T.BufferGeometry(),new T.Mesh(),new T.Group());}

test('bump-center reuse is disabled by default without changing material state',()=>{
 const m=material(),before={compile:m.onBeforeCompile,render:m.onBeforeRender,key:m.customProgramCacheKey,version:m.version};
 assert.equal(installMacArthurBumpCenterReuse(m),false);
 assert.equal(installMacArthurBumpCenterReuse(m,{enabled:false}),false);
 assert.deepEqual({compile:m.onBeforeCompile,render:m.onBeforeRender,key:m.customProgramCacheKey,version:m.version},before);
});

test('only actual ordinary mapped MacArthur bump materials can opt in',()=>{
 const cases:[string,(m:T.MeshStandardMaterial)=>void][]=[
  ['unrelated material',m=>{m.name='Casino buff masonry';}],
  ['independent bump texture',m=>{m.bumpMap=m.map!.clone();}],
  ['normal map suppresses bump',m=>{m.normalMap=new T.Texture();}],
  ['video decoding',m=>{Object.assign(m.map!,{isVideoTexture:true});}],
  ['different UV channel',m=>{m.map!.channel=1;}],
  ['unsupported colorspace',m=>{m.map!.colorSpace=T.NoColorSpace;}],
  ['unsupported texture type',m=>{m.map!.type=T.FloatType;}],
  ['wireframe suppresses bump',m=>{m.wireframe=true;}],
  ['transparent material',m=>{m.transparent=true;}],
  ['zero bump has no saving',m=>{m.bumpScale=0;}],
  ['custom UV define',m=>{m.defines={...m.defines,MAP_UV:'uv1'};}],
 ];
 for(const [name,change] of cases){
  const m=material();change(m);const before={compile:m.onBeforeCompile,key:m.customProgramCacheKey,version:m.version};
  assert.equal(installMacArthurBumpCenterReuse(m,{enabled:true}),false,name);
  assert.deepEqual({compile:m.onBeforeCompile,key:m.customProgramCacheKey,version:m.version},before,name);
 }
});

test('reuse replaces only the center fetch and retains the raw color sample, both offsets and derivatives',()=>{
 const m=material(),map=m.map!,originalMapChunk=T.ShaderChunk.map_fragment,originalBumpChunk=T.ShaderChunk.bumpmap_pars_fragment;
 map.offset.set(.17,.31);map.repeat.set(2,3);map.rotation=.24;map.updateMatrix();
 const matrix=map.matrix.toArray(),uniform={value:.6};
 m.onBeforeCompile=s=>{s.uniforms.ownerUniform=uniform;};m.customProgramCacheKey=()=>'finished-real-material';
 const before=compile(m),options={enabled:true};assert.equal(installMacArthurBumpCenterReuse(m,options),true);options.enabled=false;
 const after=compile(m),key=m.customProgramCacheKey();
 assert.equal(key,'finished-real-material|'+MACARTHUR_BUMP_CENTER_KEY);
 assert.equal(after.uniforms.ownerUniform,uniform);assert.equal(after.vertexShader,before.vertexShader);
 const expectedMap=originalMapChunk.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );','vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n\t'+MACARTHUR_BUMP_CENTER_ASSIGNMENT);
 const expectedBump=originalBumpChunk.replace('float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;',MACARTHUR_BUMP_CENTER_READ);
 assert.equal(after.fragmentShader,'float belleMacArthurMapCenterRed;\n'+before.fragmentShader.replace('#include <map_fragment>',expectedMap).replace('#include <bumpmap_pars_fragment>',expectedBump));
 assert(expectedMap.indexOf(MACARTHUR_BUMP_CENTER_ASSIGNMENT)<expectedMap.indexOf('#ifdef DECODE_VIDEO_TEXTURE'));
 assert.equal((expectedBump.match(/texture2D\( bumpMap,/g)||[]).length,2);
 for(const unchanged of [
  'vec2 dSTdx = dFdx( vBumpMapUv );','vec2 dSTdy = dFdy( vBumpMapUv );',
  'float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;',
  'float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;',
 ])assert(expectedBump.includes(unchanged));
 assert.equal(T.ShaderChunk.map_fragment,originalMapChunk);assert.equal(T.ShaderChunk.bumpmap_pars_fragment,originalBumpChunk);
 assert.equal(m.map,map);assert.equal(m.bumpMap,map);assert.equal(m.bumpScale,.018);assert.deepEqual(map.matrix.toArray(),matrix);
 const hook=m.onBeforeCompile;assert.equal(installMacArthurBumpCenterReuse(m,{enabled:true}),true);assert.equal(m.onBeforeCompile,hook);assert.equal(m.customProgramCacheKey(),key);
});

test('an approved material cannot keep a stale reuse shader after a later texture or UV change',()=>{
 const m=material();let inheritedCalls=0;
 m.onBeforeRender=()=>{inheritedCalls++;};
 assert(installMacArthurBumpCenterReuse(m,{enabled:true}));compile(m);renderCallback(m);assert.equal(inheritedCalls,1);
 const shared=m.map!;m.bumpMap=shared.clone();
 assert.throws(()=>renderCallback(m),/approved material or shared texture changed/);assert.equal(inheritedCalls,2);
 assert.throws(()=>compile(m),/approved material or shared texture changed/);
 m.bumpMap=shared;shared.channel=1;assert.throws(()=>renderCallback(m),/approved material or shared texture changed/);
});

test('a previous render callback cannot silently break the shared-map contract',()=>{
 const m=material();m.onBeforeRender=()=>{m.bumpMap=m.map!.clone();};
 assert(installMacArthurBumpCenterReuse(m,{enabled:true}));
 assert.throws(()=>renderCallback(m),/approved material or shared texture changed/);
});

test('unsupported inherited UV/sample hooks fail the opt-in proof loudly',()=>{
 for(const modify of [
  (s:Shader)=>{s.vertexShader+='\nvMapUv += vec2(.1);';},
  (s:Shader)=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','diffuseColor.rgb *= .8;');},
  (s:Shader)=>{s.fragmentShader+='\nfloat dHdxy_fwd(){return 0.;}';},
 ]){
  const m=material();m.onBeforeCompile=modify;assert(installMacArthurBumpCenterReuse(m,{enabled:true}));
  assert.throws(()=>compile(m),/proof contract/);
 }
});

test('diagnostic clones validate their own texture bindings, not the original material bindings',()=>{
 const m=material();assert(installMacArthurBumpCenterReuse(m,{enabled:true}));
 const clone=m.clone();clone.onBeforeCompile=m.onBeforeCompile;clone.customProgramCacheKey=m.customProgramCacheKey;
 assert(compile(clone).fragmentShader.includes(MACARTHUR_BUMP_CENTER_READ));
 clone.bumpMap=clone.map!.clone();assert.throws(()=>compile(clone),/approved material or shared texture changed/);
});

test('final wrapper preserves the atmosphere owner and known shader-chain identity',()=>{
 const m=material(),scene=new T.Scene(),atmosphere=new WorldAtmosphere(scene,new T.Texture());scene.add(new T.Mesh(new T.BoxGeometry(),m));atmosphere.flush();
 assert(hasAtmosphereProgram(m.onBeforeCompile,atmosphere));assert(installMacArthurBumpCenterReuse(m,{enabled:true}));
 assert(hasAtmosphereProgram(m.onBeforeCompile,atmosphere));
 const compiled=compile(m);assert.equal(compiled.uniforms.belleCloudNoise,atmosphere.uniforms.belleCloudNoise);
 const previous=m.onBeforeCompile;m.onBeforeCompile=function(s,r){previous.call(this,s,r);};
 assert(registerSharedGeometryShader(m,previous));atmosphere.dispose();
});
