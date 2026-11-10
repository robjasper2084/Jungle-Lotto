import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {makeSunsetCanopy,canopyTint,SUNSET_CANOPY_LIMIT} from './sunsetCanopy.ts';
import {makeNaturePlan,natureBudget,type NaturePlan} from './naturePlan.ts';
import {ParkTerrain,inside,segment,type ParkMap} from './terrain.ts';
import {photoShadowExtent,sunsetPhotoGrade} from './photoReferenceGrade.ts';
import {createWater} from './water.ts';
import {connectSkySettings} from './skySettings.ts';
import type {SkySettings} from './skyModel.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
const stored:NaturePlan=JSON.parse(readFileSync(new URL('../../public/belle/nature/placements.json',import.meta.url),'utf8'));
const original=stored.trees.filter(p=>p.canopyTone===undefined);
const generated=makeNaturePlan(map),added=generated.trees.filter(p=>p.canopyTone!==undefined);
const point=[...map.landmarks,...map.pois].find(p=>p.name==='Sunset Point')!;
const terrain=new ParkTerrain(map);
const segments=map.roads.flatMap(r=>r.points.slice(1).map((b,i)=>({a:r.points[i],b,w:r.width})));
const noPlants=map.areas.filter(a=>['pitch','track','pedestrian','playground','golf_course','swimming_pool','outdoor_seating','fitness_station','beach','marina'].includes(a.kind));
const shore=[map.island,...map.water.map(w=>w.points)].flatMap(p=>p.slice(1).map((b,i)=>({a:p[i],b})));

test('reference canopy is bounded, hardwood-dominated and keeps the original plant prefix',()=>{
 assert(added.length>=48&&added.length<=SUNSET_CANOPY_LIMIT);
 assert.equal(SUNSET_CANOPY_LIMIT,72);
 assert.deepEqual(generated.trees.slice(0,original.length),original,'no original tree moves or changes species');
 assert.deepEqual(generated.ground,stored.ground,'existing ground cover remains byte-equivalent data');
 assert(added.filter(p=>p.id==='maple').length/added.length>.75);
 assert.equal(natureBudget.high.trees,48);assert.equal(natureBudget.automatic.trees,36);assert.equal(natureBudget.smooth.trees,20);
 assert(generated.trees.length<=6500);
});
test('new point canopy clears mapped roads, paths, buildings, water and visitor facilities',()=>{
 for(const p of added){
  assert(terrain.land(p.x,p.z)&&inside(p.x,p.z,map.island));
  assert(!segments.some(s=>segment(p.x,p.z,s.a,s.b).d<s.w/2+4.49));
  assert(!shore.some(s=>segment(p.x,p.z,s.a,s.b).d<4.99));
  assert(!map.buildings.some(b=>inside(p.x,p.z,b.points)));
  assert(!noPlants.some(a=>inside(p.x,p.z,a.points)));
  assert(!(map.monuments||[]).some(m=>Math.hypot(p.x-m.x,p.z-m.z)<m.radius+5.49));
  assert(Math.abs(p.y-terrain.height(p.x,p.z))<.0011);
 }
});
test('open point lawn and separated tree roots survive the canopy pass',()=>{
 const dx=point.x+3127,dz=point.z-1983,length=Math.hypot(dx,dz);
 for(const [i,p] of added.entries()){
  const back=((p.x-point.x)*dx+(p.z-point.z)*dz)/length;
  assert(back>=64.99&&back<=320.01);
  assert(Math.hypot(p.x-point.x,p.z-point.z)<400);
  assert(!original.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<9.99));
  assert(!added.slice(i+1).some(q=>Math.hypot(p.x-q.x,p.z-q.z)<11.99));
  assert(p.scale>=1.22&&p.scale<=1.62);assert(p.heightScale!>=.79&&p.heightScale!<=.96);
 }
});
test('canopy placement is deterministic and cannot mutate input trees or the map',()=>{
 const trees=original.slice(0,10).map(p=>Object.freeze({...p}));Object.freeze(trees);
 const before=JSON.stringify(map);
 const a=makeSunsetCanopy(map,trees,()=>true,()=>2),b=makeSunsetCanopy(map,trees,()=>true,()=>2);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(map),before);assert.equal(trees.length,10);
 assert.equal(a.length,SUNSET_CANOPY_LIMIT);
});
test('missing point, blocked land, invalid height and full capacity create no invented canopy',()=>{
 assert.deepEqual(makeSunsetCanopy({...map,landmarks:[],pois:[]},[],()=>true,()=>2),[]);
 assert.deepEqual(makeSunsetCanopy(map,[],()=>false,()=>2),[]);
 assert.deepEqual(makeSunsetCanopy(map,[],()=>true,()=>NaN),[]);
 const full=Array.from({length:6500},()=>original[0]);assert.deepEqual(makeSunsetCanopy(map,full,()=>true,()=>2),[]);
});
test('near and distant canopy share finite bounded tint, while original trees remain neutral',()=>{
 assert.deepEqual(canopyTint(.95),[.95,.95,.95]);
 for(const value of [-10,0,.5,1,10,NaN,Infinity])for(const tone of [-5,0,.5,1,5,NaN,Infinity]){
  const tint=canopyTint(value,tone);assert(tint.every(x=>Number.isFinite(x)&&x>=0&&x<=1.393));
 }
 const warm=canopyTint(1,.75);assert(warm[0]>warm[1]&&warm[1]>warm[2]);
 const source=readFileSync(new URL('./nature.ts',import.meta.url),'utf8');
 assert.equal((source.match(/setColorAt\(i,plantTint\(p\)\)/g)||[]).length,3);
});
test('aerial shadows widen gradually without increasing texture resolution or affecting ground views',()=>{
 for(const y of [-100,0,2,6,10,NaN,Infinity])assert.equal(photoShadowExtent(y),55);
 assert(photoShadowExtent(82)>=150&&photoShadowExtent(82)<=170);
 assert.equal(photoShadowExtent(1e6),170);
 let previous=55;for(let y=0;y<250;y+=.1){const v=photoShadowExtent(y);assert(v>=previous&&v<=170);previous=v;}
 const source=readFileSync(new URL('./islandSky.ts',import.meta.url),'utf8');
 assert(source.includes('key.shadow.mapSize.set(2048,2048)'));
 assert.equal((source.match(/new T.DirectionalLight\(/g)||[]).length,1);
});
test('photo lighting retains the original neutral day/night envelope',()=>{
 assert.equal(sunsetPhotoGrade(-.4,0,1).warmth,0);
 assert(sunsetPhotoGrade(.09,0,0).warmth>.95);
 const source=readFileSync(new URL('./islandSky.ts',import.meta.url),'utf8');
 assert(source.includes('photoLook.warmth*.20')&&source.includes('photoLook.warmth*.48'));
 assert(source.includes('meteorOpacity')&&source.includes('starUV')&&source.includes('moonDirection'));
});
test('river layers share uncoated water normals while lagoons retain their optical finish and wakes',()=>{
 const scene=new T.Scene();
 createWater(scene,{} as T.WebGLRenderer,map,terrain,()=>new T.PlaneGeometry(1,1).rotateX(-Math.PI/2));
 const near=scene.getObjectByName('Detroit River rolling waves') as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
 const far=scene.getObjectByName('Detroit River distant water') as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
 const lagoon=scene.children.find(o=>o.name.startsWith('Lagoon · ')) as T.Mesh<T.BufferGeometry,T.MeshPhysicalMaterial>;
 for(const mesh of [near,far]){
  assert.equal(mesh.material.clearcoat,0);assert.equal(mesh.material.roughness,.28);
  const shader={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
  mesh.material.onBeforeCompile(shader,{} as T.WebGLRenderer);
  assert(shader.fragmentShader.includes('vec2 warp=')&&shader.fragmentShader.includes('warp.yx*.7+r1*.08'));
  assert.equal((shader.fragmentShader.match(/texture2D\(riverNormals/g)||[]).length,3,'still two normal layers plus existing wash sample');
  for(const token of ['riverSunReflection','riverRipples[12]','shipWake[4]','hoverWash'])assert(shader.fragmentShader.includes(token));
 }
 assert.equal(lagoon.material.clearcoat,.60);assert.equal(lagoon.material.roughness,.12);
 const shader={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}} as Parameters<T.Material['onBeforeCompile']>[0];
 lagoon.material.onBeforeCompile(shader,{} as T.WebGLRenderer);
 assert(!shader.fragmentShader.includes('vec2 warp='));assert(shader.fragmentShader.includes('fountainNight'));
 scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});
});
test('optional reference sky preset holds a clear sunset without overriding saved settings on initialization',()=>{
 const ids=['sky-hour','sky-clock','sky-cycle','sky-speed','sky-clouds','sky-preset'];
 const elements=Object.fromEntries(ids.map(id=>[id,{value:'',checked:false,onchange:undefined as undefined|(()=>void)}]));
 const options:{value:string;textContent:string}[]=[];
 Object.assign(elements['sky-preset'],{querySelector:()=>options.find(o=>o.value==='17.55')??null,append:(option:{value:string;textContent:string})=>options.push(option)});
 let state:SkySettings={hour:12,cycle:true,dayMinutes:60,clouds:'overcast'};let calls=0;
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{activeElement:null,getElementById:(id:string)=>elements[id],createElement:()=>({value:'',textContent:''})}});
 try{
  connectSkySettings({get settings(){return {...state};},get hour(){return state.hour;},configure(next){state={...state,...next};calls++;}});
  assert.equal(calls,0);assert.equal(state.clouds,'overcast');assert.equal(options.length,1);assert.equal(options[0].value,'17.55');
  elements['sky-preset'].value='17.55';elements['sky-preset'].onchange!();
  assert.equal(state.hour,17.55);assert.equal(state.cycle,false);assert.equal(state.clouds,'clear');assert.equal(state.dayMinutes,60);
  assert.equal(elements['sky-clouds'].value,'clear');
  state.clouds='layered';elements['sky-preset'].value='9';elements['sky-preset'].onchange!();assert.equal(state.clouds,'layered');assert.equal(state.hour,9);
 }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else delete(globalThis as unknown as Record<string,unknown>).document;}
 assert.equal(options[0].textContent,'Photo-reference sunset · clear');
});
