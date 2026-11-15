import {test} from 'node:test';
import assert from 'node:assert/strict';
import {surfaceKind} from './realisticMaterialRules.ts';
import * as T from 'three';
import {prepareCanopyCoverage} from './canopyCoverage.ts';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

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
