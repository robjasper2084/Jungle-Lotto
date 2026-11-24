import {test} from 'node:test';
import assert from 'node:assert/strict';
import {surfaceKind} from './realisticMaterialRules.ts';
import * as T from 'three';
import {prepareCanopyCoverage} from './canopyCoverage.ts';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {applyRealisticMaterials,loadRealisticMaterials} from './realisticMaterials.ts';
import {WebGLUniforms} from 'three/src/renderers/webgl/WebGLUniforms.js';

test('all world skins match their recorded bytes and bounded runtime dimensions',async()=>{
 const base=new URL('../../public/belle/skins/',import.meta.url);
 const provenance=JSON.parse(await readFile(new URL('PROVENANCE.json',base),'utf8')).worldRefresh20261114;
 assert.equal(provenance.sources.length,29);assert.equal(provenance.outputs.length,57);
 assert.equal(new Set(provenance.outputs.map((o:{file:string})=>o.file)).size,57);
 let total=0;
 for(const output of provenance.outputs){
  const data=await readFile(new URL(output.file,base));total+=data.length;
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(createHash('sha256').update(data).digest('hex'),output.sha256,output.file);
  let size:number[]|undefined;
  for(let offset=12;offset+8<data.length;){const type=data.toString('ascii',offset,offset+4),n=data.readUInt32LE(offset+4),p=offset+8;
   if(type==='VP8 '){size=[data.readUInt16LE(p+6)&0x3fff,data.readUInt16LE(p+8)&0x3fff];break;}
   if(type==='VP8L'){const bits=data.readUInt32LE(p+1);size=[(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];break;}
   if(type==='VP8X'){size=[data.readUIntLE(p+4,3)+1,data.readUIntLE(p+7,3)+1];break;}
   offset=p+n+(n%2);
  }
  const expected=output.file.endsWith('-color.webp')?1024:512;assert.deepEqual(size,[expected,expected],output.file);
 }
 assert.equal(total,provenance.runtimeBytes);assert(total<16*1024*1024,'World surface download budget');
});

test('surface treatment preserves optical surfaces, the readable plate and controllable lights',()=>{
 for(const name of ['Running_Light_Blue','Brake_Light_Red','Michigan_Blue','Plate_White','Cinema_Lens_Coating','Cinema_Monitor_Blue','Conservatory clear panes','Aquarium tank glazing','Aquarium mosaic floor','Aquarium illuminated habitat']){
  assert.equal(surfaceKind(name,'',.5),null,name);
 }
});
test('marine surfaces keep live instruments and navigation optics while receiving the correct skin',()=>{
 for(const name of ['Nav_Port','Nav_Starboard','Cockpit_Display','Hydro reactive display','Reactive instrument surface','Hydro canopy glazing','Smoked windscreen'])assert.equal(surfaceKind(name,'boat'),null,name);
 for(const [name,kind] of [['Hydro racing red','paint'],['Hydro graphite composite','graphite'],['Charcoal marine upholstery','leather'],['Hydro cockpit charcoal','rubber'],['Hydro titanium','metal'],['Golf green turf','grass'],['Golf bunker sand','sand'],['Golf flag cloth','cloth'],['Giant slide woven cloth','cloth']])assert.equal(surfaceKind(name,''),kind,name);
});
test('actor details remain distinct from architecture and road finishes',()=>{
 assert.equal(surfaceKind('Material_0','Boerboel'),'fur');
 assert.equal(surfaceKind('Higgsfield_Hero_PBR','Hero_Head'),'skin');
 assert.equal(surfaceKind('Higgsfield_Hero_PBR','Hero_Body'),'cloth');
 assert.equal(surfaceKind('Skin_Grip_Rubber','Camera'),'rubber');
 assert.equal(surfaceKind('Island asphalt','Joined island pavement'),'asphalt');
 assert.equal(surfaceKind('Weathered red brick','Casino'),'brick');
 assert.equal(surfaceKind('PH Bark Brown 02','Nearby maple'),'bark');
});
test('CORLEO keeps authored optics and applies distinct rider and chassis finishes',()=>{
 for(const name of ['CR_DisplayPrintedLabels','CR_DisplayLime','CR_DisplayDigits','CR_InstrumentAmber','CR_InstrumentCyan','CR_Headlamp','CR_RearLamp','Pilot_Visor','Pilot_Accent_Light'])assert.equal(surfaceKind(name,'CORLEO',.7),null,name);
 for(const [name,kind] of [['CR_GraphiteCeramic','graphite'],['CR_OchreSaddle','leather'],['CR_HoofRubber','rubber'],['Pilot_Boot_Sole','rubber'],['Pilot_Fabric','cloth'],['Pilot_FlexPanels','cloth'],['Pilot_Armor','paint'],['Pilot_Helmet','paint'],['Pilot_Accent','paint'],['CR_LimeAccent','paint'],['Pilot_Hardware','metal']])assert.equal(surfaceKind(name,'CORLEO'),kind,name);
});
test('new skins distinguish natural materials and retain optical glazing',()=>{
 for(const [name,kind]of [['Monument white marble','marble'],['Monument aged bronze','bronze'],['Aquarium exterior copper roof','copper'],['Aquarium jade glazed tile','ceramic'],['Station white painted cladding','paint'],['Fishing cork handle','cork'],['Fishing rod graphite','graphite'],['Freshwater fish scales','scales'],['Pigeon ash feathers','feather'],['Climbing rope','rope'],['Black seat leather','leather']])assert.equal(surfaceKind(name,''),kind,name);
 assert.equal(surfaceKind('Station reflective glazing',''),null);
});


test('near river and lagoons cannot receive the fallback concrete finish',()=>{
 for(const object of ['Detroit River rolling waves','Detroit River distant water','Lagoon · Lake Okonoka','Lagoon · Blue Heron','Koi pond · clear surface']){
  // applyRealisticMaterials passes context+' '+object.name, including a leading space.
  for(const label of [object,' '+object,object+' '])for(const metalness of [0,.035,.08,.5])assert.equal(surfaceKind('',label,metalness),null,label);
 }
 // Nearby architecture and the submerged gravel are not optical water.
 assert.equal(surfaceKind('Concrete','Lagoon bridge'), 'concrete');
 assert.equal(surfaceKind('','Koi pond gravel bed'),'gravel');
 assert.equal(surfaceKind('Weathered red brick','Riverfront building'),'brick');
});


test('canopy coverage preserves atlases and composes the original material hook once',()=>{
 for(const far of [false,true]){
  const map=new T.Texture(),material=far?new T.MeshBasicMaterial({map,alphaTest:.35}):new T.MeshStandardMaterial({map,alphaTest:.45});
  let calls=0;material.onBeforeCompile=s=>{calls++;s.fragmentShader='// original leaf shader\n'+s.fragmentShader;};material.customProgramCacheKey=()=> 'original-atlas';
  prepareCanopyCoverage(material,far);
  // A second source instance may normalize the shared atlas cutoff again.
  material.alphaTest=.45;prepareCanopyCoverage(material,far);
  assert.equal(material.map,map);assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);assert.equal(material.alphaToCoverage,true);assert.equal(material.alphaTest,far?.25:.12);
  const lib=far?T.ShaderLib.basic:T.ShaderLib.standard;const shader={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader,{} as T.WebGLRenderer);
  assert.equal(calls,1);assert(shader.fragmentShader.includes('// original leaf shader'));
  assert.equal((shader.fragmentShader.match(/float belleAutumn=/g)||[]).length,1);
  assert(shader.fragmentShader.includes('#include <alphatest_fragment>'));
  assert.equal((shader.fragmentShader.match(/texture2D/g)||[]).length,(lib.fragmentShader.match(/texture2D/g)||[]).length);
  assert.equal(material.customProgramCacheKey(),'original-atlas|belle-canopy-coverage-v2');
  material.dispose();map.dispose();
 }
});
test('canopy color fails closed on an incompatible shader instead of silently dropping texture work',()=>{
 const material=new T.MeshStandardMaterial();prepareCanopyCoverage(material);
 assert.throws(()=>material.onBeforeCompile({vertexShader:'',fragmentShader:'void main(){}',uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0],{} as T.WebGLRenderer),/original map shader missing/);
 material.dispose();
});

test('all four surface combinations share shader source while retaining their own material inputs and authored hook',async t=>{
 const loaded=new Map<string,T.Texture>(),uploaded:T.Texture[]=[];
 const renderer={capabilities:{getMaxAnisotropy:()=>8},initTexture:(texture:T.Texture)=>uploaded.push(texture)} as unknown as T.WebGLRenderer;
 const loader=t.mock.method(T.TextureLoader.prototype,'loadAsync',async(url:string)=>{
  const texture=new T.Texture({width:1,height:1});texture.name=url;loaded.set(url,texture);return texture;
 });
 await loadRealisticMaterials(renderer);loader.mock.restore();
 assert.equal(loaded.size,57);assert.equal(new Set(uploaded).size,57);

 const source=new T.MeshStandardMaterial({color:0x427856,metalness:.12,side:T.DoubleSide});
 const atlas=new T.Texture(),normalMap=new T.Texture();source.map=atlas;source.normalMap=normalMap;
 source.defines={AUTHORED_SURFACE:1};source.customProgramCacheKey=()=>'authored-surface-v7';
 // Keep the existing r185 clone contract. Its define reset is a separate,
 // pre-existing edge; this shader-variant change does not repair that behavior.
 const baselineClone=source.clone(),expectedDefines={...baselineClone.defines};baselineClone.dispose();
 const authoredUniform={value:17};let authoredCalls=0;
 source.onBeforeCompile=shader=>{authoredCalls++;shader.uniforms.authored=authoredUniform;shader.fragmentShader='// retained authored finish\n'+shader.fragmentShader;};
 const root=new T.Group(),planes=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),solid=new T.BoxGeometry(1,1,1);
 const cases=[
  {kind:'wood',planar:true,profile:[1,.50,.01]},
  {kind:'wood',planar:false,profile:[1,.50,.01]},
  {kind:'rubber',planar:true,profile:[9,0,.002]},
  {kind:'rubber',planar:false,profile:[9,0,.002]},
 ];
 const meshes=cases.map(row=>{const mesh=new T.Mesh(row.planar?planes:solid,source);mesh.name=row.kind+' surface';root.add(mesh);return mesh;});
 const duplicate=new T.Mesh(planes,source);duplicate.name='wood surface';root.add(duplicate);
 const created=applyRealisticMaterials(root);
 assert.equal(created.length,4);assert.equal(new Set(meshes.map(mesh=>mesh.material)).size,4);
 assert.equal(duplicate.material,meshes[0].material,'identical kind and projection can retain their material clone');
 assert.deepEqual(applyRealisticMaterials(root),[],'dressing remains idempotent');
 const compile=(material:T.MeshStandardMaterial)=>{
  const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader,renderer);return shader;
 };
 const shaders=meshes.map(mesh=>compile(mesh.material));
 assert.equal(authoredCalls,4,'each material prepares its own uniform bindings even with a common program');
 assert.equal(new Set(shaders.map(shader=>shader.vertexShader)).size,1);
 assert.equal(new Set(shaders.map(shader=>shader.fragmentShader)).size,1);
 assert.equal(new Set(meshes.map(mesh=>mesh.material.customProgramCacheKey())).size,1);
 assert.equal(meshes[0].material.customProgramCacheKey(),'authored-surface-v7-higgsfield-surface-v5');
 for(let i=0;i<cases.length;i++){
  const row=cases[i],material=meshes[i].material,shader=shaders[i];
  assert.deepEqual(shader.uniforms.skinProfile.value.toArray(),row.profile);
  assert.equal(shader.uniforms.skinPlanar.value,row.planar);
  assert.equal(shader.uniforms.skinColor.value,loaded.get('./belle/skins/'+row.kind+'-color.webp'));
  assert.equal(shader.uniforms.skinDetail.value,loaded.get('./belle/skins/'+row.kind+'-detail.webp'));
  assert.equal(shader.uniforms.authored,authoredUniform);
  assert.equal(material.map,atlas);assert.equal(material.normalMap,normalMap);assert.equal(material.side,source.side);
  assert.deepEqual(material.defines,expectedDefines);assert(material.color.equals(source.color));assert.equal(material.metalness,source.metalness);
 }
 assert.equal(source.customProgramCacheKey(),'authored-surface-v7');assert.equal(source.version,0);
 assert.deepEqual(source.defines,{AUTHORED_SURFACE:1});
 assert.equal(source.map,atlas);assert.equal(source.normalMap,normalMap);

 await t.test('the pinned Three uniform uploader switches every material through one cached program without stale projection, pigment or textures',()=>{
  const active=[{name:'skinColor',size:1,type:0x8b5e},{name:'skinDetail',size:1,type:0x8b5e},
   {name:'skinProfile',size:1,type:0x8b51},{name:'skinPlanar',size:1,type:0x8b56}];
  const state=new Map<string,number|number[]>(),bound=new Map<number,T.Texture>();let nextUnit=0;
  const gl={ACTIVE_UNIFORMS:0x8b86,getProgramParameter:()=>active.length,getActiveUniform:(_:unknown,i:number)=>active[i],getUniformLocation:(_:unknown,name:string)=>name,
   uniform1i:(name:string,value:number)=>state.set(name,Number(value)),uniform3f:(name:string,x:number,y:number,z:number)=>state.set(name,[x,y,z])};
  const textures={allocateTextureUnit:()=>nextUnit++,setTexture2D:(texture:T.Texture,unit:number)=>bound.set(unit,texture)};
  // The public type declarations omit seq/upload. Exercise the installed r185
  // implementation and its per-program value cache, not a mock uploader.
  const Uniforms=WebGLUniforms as unknown as {new(gl:unknown,program:unknown):{seq:unknown[]};upload:(gl:unknown,seq:unknown[],values:Record<string,T.IUniform>,textures:unknown)=>void};
  const programUniforms=new Uniforms(gl,{});
  for(const i of [0,1,2,3,0,3,2,1,0]){
   nextUnit=0;bound.clear();Uniforms.upload(gl,programUniforms.seq,shaders[i].uniforms,textures);
   assert.deepEqual(state.get('skinProfile'),cases[i].profile,'material '+i+' profile');
   assert.equal(state.get('skinPlanar'),Number(cases[i].planar),'material '+i+' projection');
   assert.equal(bound.get(Number(state.get('skinColor'))),loaded.get('./belle/skins/'+cases[i].kind+'-color.webp'));
   assert.equal(bound.get(Number(state.get('skinDetail'))),loaded.get('./belle/skins/'+cases[i].kind+'-detail.webp'));
  }
 });

 await t.test('uniform objects are per compilation and changing one cannot contaminate a sibling or recompiled material',()=>{
  shaders[0].uniforms.skinPlanar.value=false;shaders[0].uniforms.skinProfile.value.set(77,88,99);
  assert.equal(shaders[2].uniforms.skinPlanar.value,true);assert.deepEqual(shaders[1].uniforms.skinProfile.value.toArray(),cases[1].profile);
  const again=compile(meshes[0].material);
  assert.equal(again.uniforms.skinPlanar.value,true);assert.deepEqual(again.uniforms.skinProfile.value.toArray(),cases[0].profile);
  assert.notEqual(again.uniforms.skinProfile,shaders[0].uniforms.skinProfile);assert.notEqual(again.uniforms.skinPlanar,shaders[0].uniforms.skinPlanar);
  assert.equal(again.uniforms.skinColor.value,shaders[0].uniforms.skinColor.value,'only immutable texture inputs are shared');
 });
 for(const material of created)material.dispose();source.dispose();atlas.dispose();normalMap.dispose();planes.dispose();solid.dispose();
 for(const texture of loaded.values())texture.dispose();
});
