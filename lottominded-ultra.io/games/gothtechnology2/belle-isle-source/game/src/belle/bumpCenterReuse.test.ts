import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WebGLPrograms} from 'three/src/renderers/webgl/WebGLPrograms.js';
// @ts-expect-error The pinned declaration package omits this implementation-only test import.
import {WebGLMaterials} from 'three/src/renderers/webgl/WebGLMaterials.js';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';
import {BUMP_CENTER_CHUNKS} from './bumpCenterChunks.ts';
import {installBumpCenterReuse,reuseMacArthurBumpCenters} from './bumpCenterReuse.ts';
import {WorldAtmosphere} from './worldAtmosphere.ts';
import {hasAtmosphereProgram} from './atmosphereProgramIdentity.ts';
import {finishMacArthurConcrete} from './macArthurSurface.ts';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';

type Shader=Parameters<T.Material['onBeforeCompile']>[0]&Record<string,unknown>;
const flag='belleReuseAlbedoBumpCenter';
const renderer={outputColorSpace:T.SRGBColorSpace,getRenderTarget:()=>null,toneMapping:T.ACESFilmicToneMapping,
 state:{buffers:{depth:{getReversed:()=>false}}},shadowMap:{enabled:false,type:T.PCFShadowMap}} as unknown as T.WebGLRenderer;
const programs=(WebGLPrograms as unknown as (...args:unknown[])=>{getParameters:(...a:unknown[])=>Shader;getProgramCacheKey:(p:object)=>string})(
 renderer,{get:()=>null},{has:()=>false},{precision:'highp',logarithmicDepthBuffer:false},{},{numPlanes:0,numIntersection:0});
const nativeMaterials=(WebGLMaterials as unknown as (...a:unknown[])=>{refreshMaterialUniforms:(...a:unknown[])=>void})(renderer,{get:()=>({envMap:null})});
const lights=Object.fromEntries(['directional','point','spot','spotLightMap','rectArea','hemi','directionalShadowMap','pointShadowMap','spotShadowMap'].map(k=>[k,[]]));
Object.assign(lights,{numSpotLightShadowsWithMaps:0,numLightProbes:0});
function material(){
 const m=new T.MeshStandardMaterial({map:new T.Texture(),bumpScale:.018});m.bumpMap=m.map;
 m.name='Higgsfield • warm limestone · MacArthur masonry';m.userData.realisticSurface='brick';m.userData.realisticProfile='brick|triplanar';
 m.customProgramCacheKey=()=>'audited-original';return m;
}
function fresh(m:T.Material,override:Record<string,unknown>={}):Shader{
 const p=programs.getParameters(m,lights,[],new T.Scene(),new T.Mesh(new T.BoxGeometry(1,1,1),m),[]);
 return Object.assign(p,{vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,
  uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms)},override);
}
function compile(m:T.Material,override:Record<string,unknown>={}):Shader{const s=fresh(m,override);m.onBeforeCompile(s,renderer);return s;}
function refresh(m:T.Material,s:Shader){nativeMaterials.refreshMaterialUniforms(s.uniforms,m,1,600,null);}
const safe=(s:Shader)=>s.fragmentShader.startsWith('#define BELLE_BUMP_CENTER_PROGRAM_SAFE 1\n');
const value=(s:Shader)=>s.uniforms[flag]?.value===true;

function uploader(){
 const active=[{name:'map',size:1,type:0x8b5e},{name:'bumpMap',size:1,type:0x8b5e},
  {name:'mapTransform',size:1,type:0x8b5b},{name:'bumpMapTransform',size:1,type:0x8b5b},{name:flag,size:1,type:0x8b56}];
 const state=new Map<string,unknown>(),bound=new Map<number,T.Texture>();let unit=0;
 const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>active.length,getActiveUniform:(_:unknown,i:number)=>active[i],getUniformLocation:(_:unknown,name:string)=>name,
  uniform1i:(name:string,v:number)=>state.set(name,Number(v)),uniformMatrix3fv:(name:string,_:boolean,v:Float32Array)=>state.set(name,Array.from(v))};
 const textures={allocateTextureUnit:()=>unit++,setTexture2D:(texture:T.Texture,n:number)=>bound.set(n,texture)};
 const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,p:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],u:Shader['uniforms'],textures:unknown)=>void};
 const uniforms=new Uniforms(gl,{});
 return {state,bound,upload(s:Shader){unit=0;Uniforms.upload(gl,uniforms.seq,s.uniforms,textures);},texture(name:string){return bound.get(Number(state.get(name)));}};
}

test('the guarded helper changes only the center selection; all native offset, derivative, face and normalization arithmetic remains exact',()=>{
 const m=material(),original=compile(m),defines=m.defines,render=m.onBeforeRender,dispose=installBumpCenterReuse(m)!;
 const s=compile(m);refresh(m,s);assert(safe(s));assert(value(s));assert.equal(s.vertexShader,original.vertexShader);
 for(const line of BUMP_CENTER_CHUNKS.bumpmap_pars_fragment.split('\n')){
  if(line.includes('vec2 dHdxy_fwd()')||line.includes('float Hll ='))continue;
  if(line.trim())assert(s.fragmentShader.includes(line),line);
 }
 assert(s.fragmentShader.includes('Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;'));
 assert(s.fragmentShader.includes('Hll = bumpScale * belleAlbedoBumpCenter;'));
 assert(s.fragmentShader.includes('dHdxy_fwd( 0.0 )'),'no-map native variants have a declared argument');
 assert.equal(m.defines,defines);assert.deepEqual(defines,{STANDARD:''});assert.equal(m.onBeforeRender,render);
 assert(Object.isFrozen(s.uniforms[flag]));assert.equal(Reflect.set(s.uniforms[flag],'needsUpdate',false),false);
 dispose();assert(!value(s));assert.equal(compile(m).fragmentShader,original.fragmentShader);
});

test('native refresh and upload keep alias flag and sampler bindings aligned, including a deliberately skipped same-material refresh',()=>{
 const m=material(),alias=m.map!,other=alias.clone(),dispose=installBumpCenterReuse(m)!,s=compile(m),gpu=uploader(),version=m.version;
 refresh(m,s);gpu.upload(s);assert.equal(gpu.state.get(flag),1);assert.equal(gpu.texture('map'),alias);assert.equal(gpu.texture('bumpMap'),alias);
 m.bumpMap=other;
 // r185 skips both operations when refreshMaterial is false. Even reading the
 // flag directly refers to the still-authoritative old table, not live m.map.
 assert(value(s));assert.equal(gpu.state.get(flag),1);assert.equal(gpu.texture('bumpMap'),alias);
 refresh(m,s);gpu.upload(s);assert.equal(gpu.state.get(flag),0);assert.equal(gpu.texture('bumpMap'),other);
 m.bumpMap=alias;refresh(m,s);gpu.upload(s);assert.equal(gpu.state.get(flag),1);
 assert.equal(m.version,version,'input changes do not invalidate or churn programs');dispose();
});

test('a nonforwarding replacement render callback and same-feature map swap cannot leave reuse enabled',()=>{
 const m=material(),alias=m.map!,other=alias.clone(),dispose=installBumpCenterReuse(m)!,s=compile(m),gpu=uploader();
 refresh(m,s);gpu.upload(s);assert.equal(gpu.state.get(flag),1);
 const replacement=function(this:T.MeshStandardMaterial){this.bumpMap=other;};m.onBeforeRender=replacement;
 Reflect.apply(m.onBeforeRender,m,[]);refresh(m,s);gpu.upload(s);
 assert.equal(m.onBeforeRender,replacement);assert.equal(gpu.texture('bumpMap'),other);assert.equal(gpu.state.get(flag),0);dispose();
 assert.equal(m.onBeforeRender,replacement,'helper never owns that callback');
});

test('frozen/replaced define objects and disposal preserve their exact references and unrelated fields',()=>{
 const m=material(),defines=m.defines!,dispose=installBumpCenterReuse(m)!,s=compile(m);refresh(m,s);Object.freeze(defines);assert(value(s));
 m.defines=Object.freeze({...defines,USER_OWNED:7,BELLE_REUSE_ALBEDO_BUMP_CENTER:99});const replacement=m.defines;
 assert(!value(s));dispose();dispose();assert.equal(m.defines,replacement);assert.deepEqual(replacement,{STANDARD:'',USER_OWNED:7,BELLE_REUSE_ALBEDO_BUMP_CENTER:99});
 assert.deepEqual(defines,{STANDARD:''});
 const frozen=material(),release=installBumpCenterReuse(frozen)!,shader=compile(frozen);refresh(frozen,shader);Object.freeze(frozen);
 assert.doesNotThrow(release);assert(!value(shader),'an immutable cached guarded hook can only take the native path after disposal');
});

test('native nonzero UV channels and updated transforms are checked in the actual refreshed table',()=>{
 const m=material(),texture=m.map!,dispose=installBumpCenterReuse(m)!;texture.channel=2;
 const s=compile(m);assert.equal(s.mapUv,'uv2');assert.equal(s.bumpMapUv,'uv2');assert(safe(s));
 texture.offset.set(.13,.71);texture.repeat.set(3.5,7.1);texture.center.set(.5,.5);texture.rotation=.28;refresh(m,s);assert(value(s));
 assert.deepEqual(s.uniforms.mapTransform.value.elements,texture.matrix.elements);
 assert.notEqual(s.uniforms.mapTransform.value,texture.matrix,'native refresh copied the matrix');
 s.uniforms.bumpMapTransform.value.elements[6]+=.125;assert(!value(s));refresh(m,s);assert(value(s));
 texture.matrixAutoUpdate=false;texture.matrix.elements[0]=NaN;refresh(m,s);assert(!value(s));dispose();
});

test('an unequal-channel native program remains disabled after same-feature alias replacement without recompilation',()=>{
 const m=material();m.bumpMap=m.map!.clone();m.bumpMap.channel=1;const dispose=installBumpCenterReuse(m)!,s=compile(m);
 assert.equal(s.mapUv,'uv');assert.equal(s.bumpMapUv,'uv1');assert(!safe(s));refresh(m,s);assert(!value(s));
 m.bumpMap=m.map;refresh(m,s);assert(!value(s));assert(s.fragmentShader.startsWith('#define BELLE_BUMP_CENTER_PROGRAM_SAFE 0\n'));dispose();
});

test('returning to an earlier cached unsafe native program cannot inherit a later safe uniform-table decision',()=>{
 const m=material(),other=m.map!.clone();other.channel=1;m.bumpMap=other;const dispose=installBumpCenterReuse(m)!;
 const unsafe=compile(m),unsafeKey=programs.getProgramCacheKey(unsafe);assert(!safe(unsafe));
 m.bumpMap=m.map;const latest=compile(m),safeKey=programs.getProgramCacheKey(latest);assert(safe(latest));assert.notEqual(safeKey,unsafeKey);
 m.bumpMap=other;assert.equal(programs.getProgramCacheKey(fresh(m)),unsafeKey,'r185 selects the earlier cached program');
 refresh(m,latest);assert(!value(latest));m.bumpMap=m.map;refresh(m,latest);assert(value(latest));
 assert(!safe(unsafe),'the active program has its own constant zero, despite the latest table now reporting an alias');dispose();
});

test('native video decode, alpha/discard, clipping and depth variants remain disabled after live inputs become ordinary',()=>{
 const cases:Record<string,unknown>[]=[{decodeVideoTexture:true},{alphaTest:true},{alphaHash:true},{alphaToCoverage:true},{alphaMap:true},
  {numClippingPlanes:1},{numClipIntersection:1},{logarithmicDepthBuffer:true},{normalMap:true},{opaque:false},{map:false,mapUv:false}];
 for(const params of cases){const m=material(),dispose=installBumpCenterReuse(m)!,s=compile(m,params);refresh(m,s);assert(!safe(s),JSON.stringify(params));assert(!value(s));dispose();}
 const m=material();Object.assign(m.map!,{isVideoTexture:true});m.map!.colorSpace=T.SRGBColorSpace;
 const dispose=installBumpCenterReuse(m)!,s=compile(m);assert.equal(s.decodeVideoTexture,true);assert(!safe(s));
 const ordinary=new T.Texture();m.map=m.bumpMap=ordinary;refresh(m,s);assert(!value(s));dispose();
});

test('unsupported alpha owners and injected discard/depth/control-flow or UV mutation are left native',()=>{
 for(const change of [(m:T.MeshStandardMaterial)=>m.alphaTest=.5,(m:T.MeshStandardMaterial)=>m.alphaHash=true,
  (m:T.MeshStandardMaterial)=>m.alphaToCoverage=true,(m:T.MeshStandardMaterial)=>m.transparent=true,
  (m:T.MeshStandardMaterial)=>m.normalMap=new T.Texture()]){const m=material();change(m);assert.equal(installBumpCenterReuse(m),undefined);}
 for(const code of ['if(diffuseColor.a<.5)discard;','gl_FragDepth=.5;','if(gl_FragCoord.x<50.)return;','for(int i=0;i<2;i++)diffuseColor.rgb*=.5;',
  'sampledDiffuseColor.rgb*=.9;','vBumpMapUv*=2.;']){
  const m=material();m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+code);};
  const original=compile(m),dispose=installBumpCenterReuse(m)!;const s=compile(m);assert.equal(s.fragmentShader,original.fragmentShader,code);assert.equal(s.uniforms[flag],undefined);dispose();
 }
});

test('changed pinned chunks or non-data sampler/matrix uniform values do not permit reuse',()=>{
 for(const name of Object.keys(BUMP_CENTER_CHUNKS) as (keyof typeof BUMP_CENTER_CHUNKS)[]){
  const before=T.ShaderChunk[name];try{T.ShaderChunk[name]=before+'\n// changed';const m=material(),dispose=installBumpCenterReuse(m)!,s=compile(m);assert(!s.uniforms[flag]);dispose();}finally{T.ShaderChunk[name]=before;}
 }
 const m=material(),dispose=installBumpCenterReuse(m)!,s=compile(m);refresh(m,s);assert(value(s));
 const map=s.uniforms.map.value;s.uniforms.map={get value(){return map;}};assert(!value(s));dispose();
});

test('owner, foreign and bound-key compilations have the same program form with fresh, independent flag bindings',()=>{
 const m=material(),dispose=installBumpCenterReuse(m)!,source=compile(m);refresh(m,source);assert(value(source));
 const clone=m.clone();clone.onBeforeCompile=m.onBeforeCompile;clone.customProgramCacheKey=m.customProgramCacheKey.bind(m);
 const foreign=compile(clone);refresh(clone,foreign);assert.equal(foreign.fragmentShader,source.fragmentShader);
 assert.equal(programs.getProgramCacheKey(foreign),programs.getProgramCacheKey(source));assert(!value(foreign));
 assert.notEqual(foreign.uniforms[flag],source.uniforms[flag]);assert(value(source));
 const released=installBumpCenterReuse(clone)!,owned=compile(clone);refresh(clone,owned);assert(value(owned));assert.notEqual(owned.uniforms[flag],source.uniforms[flag]);
 released();assert(!value(owned));assert(value(source));dispose();
});

test('the native uniform uploader switches independent material tables through one program without flag/sampler leakage',()=>{
 const a=material(),b=material();b.bumpMap=b.map!.clone();const disposeA=installBumpCenterReuse(a)!,disposeB=installBumpCenterReuse(b)!;
 const sa=compile(a),sb=compile(b),gpu=uploader();assert.equal(sa.fragmentShader,sb.fragmentShader);
 for(const [m,s] of [[a,sa],[b,sb],[a,sa],[b,sb],[a,sa]] as const){refresh(m,s);gpu.upload(s);assert.equal(gpu.state.get(flag),m===a?1:0);assert.equal(gpu.texture('map'),m.map);assert.equal(gpu.texture('bumpMap'),m.bumpMap);}
 disposeA();disposeB();
});

test('forwarding wrappers/captured keys force cached guarded programs to native without version or define edits',()=>{
 const m=material(),dispose=installBumpCenterReuse(m)!,s=compile(m);refresh(m,s);assert(value(s));
 const captured=m.customProgramCacheKey(),inner=m.onBeforeCompile,version=m.version,defines=m.defines;
 m.onBeforeCompile=function(...args){return Reflect.apply(inner,this,args);};m.customProgramCacheKey=()=>captured;
 assert(!value(s));const again=compile(m);refresh(m,again);assert(!value(again));assert.equal(again.fragmentShader,s.fragmentShader);
 assert.equal(m.version,version);assert.equal(m.defines,defines);dispose();assert(!value(s));
});

test('compile/key wrappers preserve exact receiver, arguments, one-call count, returns and thrown objects',()=>{
 const m=material(),seen:{hook:string;receiver:unknown;args:unknown[]}[]=[],token={returned:true};
 m.onBeforeCompile=function(...args){seen.push({hook:'compile',receiver:this,args});return token;};
 m.customProgramCacheKey=function(...args){seen.push({hook:'key',receiver:this,args});return 'original-'+this.name;};
 const dispose=installBumpCenterReuse(m)!,shader=fresh(m);seen.length=0;const args=[shader,renderer];
 assert.equal(Reflect.apply(m.onBeforeCompile,m,args),token);assert.deepEqual(seen.pop(),{hook:'compile',receiver:m,args});
 const keyArgs=[{extra:1}];Reflect.apply(m.customProgramCacheKey,m,keyArgs);assert.deepEqual(seen.pop(),{hook:'key',receiver:m,args:keyArgs});assert.equal(seen.length,0);dispose();
 for(const hook of ['onBeforeCompile','customProgramCacheKey'] as const){const failed=material(),error={hook};let calls=0;failed[hook]=function(){calls++;throw error;} as never;
  const release=installBumpCenterReuse(failed)!;assert.throws(()=>Reflect.apply(failed[hook],failed,hook==='onBeforeCompile'?[fresh(material()),renderer]:[]),v=>v===error);assert.equal(calls,1);release();}
});

test('disposal restores exact owned descriptors, keeps other callbacks and does not touch defines',()=>{
 const m=material(),names=['onBeforeCompile','customProgramCacheKey','onBeforeRender'] as const;
 const before=names.map(name=>Object.getOwnPropertyDescriptor(m,name)),defines=m.defines,dispose=installBumpCenterReuse(m)!;
 assert.equal(installBumpCenterReuse(m),dispose);dispose();const version=m.version;dispose();assert.equal(m.version,version);
 names.forEach((name,i)=>assert.deepEqual(Object.getOwnPropertyDescriptor(m,name),before[i]));assert.equal(m.defines,defines);
 const release=installBumpCenterReuse(m)!,replacement=()=>{};m.onBeforeCompile=replacement;release();assert.equal(m.onBeforeCompile,replacement);
 m.onBeforeCompile=T.Material.prototype.onBeforeCompile;installBumpCenterReuse(m);m.dispose();assert.equal(m.onBeforeCompile,T.Material.prototype.onBeforeCompile);
});

test('actual atmosphere→realistic clone→final owner reaches the live material with original texture/profile and uniform ownership',async t=>{
 const loaded:T.Texture[]=[];const loader=t.mock.method(T.TextureLoader.prototype,'loadAsync',async(url:string)=>{const texture=new T.Texture({width:1,height:1});texture.name=url;loaded.push(texture);return texture;});
 await loadRealisticMaterials({capabilities:{getMaxAnisotropy:()=>8},initTexture:()=>{}} as unknown as T.WebGLRenderer);loader.mock.restore();
 const scene=new T.Scene(),atmosphere=new WorldAtmosphere(scene,new T.Texture()),root=new T.Group(),base=new T.MeshStandardMaterial({map:new T.Texture(),side:T.DoubleSide});base.name='Higgsfield • warm limestone';
 const mesh=new T.Mesh(new T.BoxGeometry(4,3,2),base);mesh.name='MacArthur_Higgsfield_•_warm_limestone';root.add(mesh);finishMacArthurConcrete(root);
 const original=mesh.material;original.bumpMap=original.map;original.bumpScale=.018;scene.add(root);atmosphere.flush();applyRealisticMaterials(scene);
 const live=mesh.material;assert.notEqual(live,original);assert(hasAtmosphereProgram(live.onBeforeCompile,atmosphere));assert.equal(live.userData.realisticProfile,'brick|triplanar');
 assert.equal(reuseMacArthurBumpCenters(root),1);assert(hasAtmosphereProgram(live.onBeforeCompile,atmosphere));
 const s=compile(live);refresh(live,s);assert(safe(s));assert(value(s));assert.equal(s.uniforms.belleCloudTime,atmosphere.uniforms.belleCloudTime);
 assert.equal(s.uniforms.skinColor.value,loaded.find(texture=>texture.name==='./belle/skins/brick-color.webp'));
 assert.equal(s.uniforms.skinPlanar.value,false);assert.equal(s.uniforms.skinProfile.value.z,.018);
 assert(s.fragmentShader.includes('belleMineralStreak'));assert(s.fragmentShader.includes('skinGradient'));assert(s.fragmentShader.includes('belleViewDFG'));
 scene.remove(root);scene.add(root);atmosphere.flush();assert(!value(s));const rewrapped=compile(live);refresh(live,rewrapped);assert(!value(rewrapped));
 assert.equal(rewrapped.uniforms.belleCloudTime,atmosphere.uniforms.belleCloudTime);atmosphere.dispose();live.dispose();for(const texture of loaded)texture.dispose();
});
