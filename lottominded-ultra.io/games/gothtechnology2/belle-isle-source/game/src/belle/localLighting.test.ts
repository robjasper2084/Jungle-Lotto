import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import type {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LocalLightPool,type LocalLight} from './localLighting.ts';
import {BridgeLightSlots,type Lamp} from './bridgeLightPlan.ts';
import {addDossinLighting} from './dossinScene.ts';
import {addAquariumLife} from './aquariumScene.ts';
import {addYachtClub} from './yachtClubScene.ts';
import {dossinWorld} from './dossin.ts';
import {aquariumWorld} from './aquarium.ts';
import {yachtWorld,yachtInside} from './yachtClub.ts';
import type {ParkMap} from './terrain.ts';

const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
const authored:LocalLight[]=[
 {position:[2,3,4],color:0xffebce,intensity:9,distance:25,decay:1.5},
 {position:[0,5,-3],color:0xc4dbc6,intensity:8,distance:32,decay:1.6},
 {position:[-2,7,0],color:0xffd5a0,intensity:36,distance:26,decay:2}
];
function fixture(){
 const scene=new T.Scene(),pool=new LocalLightPool(scene);
 const posts:Lamp[]=[40,20,5,30].map(x=>({p:[x,8,0],ground:[x,0,0]}));
 const slots=posts.map((_,index)=>({index,level:1-index*.2}));pool.setStreet(posts,slots,.6);
 return{scene,pool,posts,slots};
}
function pointLights(scene:T.Scene){const lights:T.PointLight[]=[];scene.traverseVisible(o=>{if((o as T.PointLight).isPointLight)lights.push(o as T.PointLight);});return lights;}
function position(light:T.PointLight,x:number,y:number,z:number){assert(light.position.distanceTo(new T.Vector3(x,y,z))<1e-8);}
function authoredLight(light:T.PointLight,color:number,intensity:number,distance:number,decay:number){
 assert(light.color.equals(new T.Color(color)));assert.equal(light.intensity,intensity);assert.equal(light.distance,distance);assert.equal(light.decay,decay);assert.equal(light.castShadow,false);
}

test('interior lights preserve transformed authored positions and reserve the nearest street lamp',()=>{
 const {scene,pool}=fixture(),root=new T.Group();root.position.set(10,2,20);root.rotation.y=Math.PI/2;scene.add(root);
 const interior=pool.registerInterior(authored,root);
 pool.beginFrame(0,0);interior.request(true);pool.update();
 assert.equal(pointLights(scene).length,4);assert(pool.lights.every(light=>light.parent===scene&&light.visible));
 position(pool.lights[0],14,5,18);position(pool.lights[1],7,7,20);position(pool.lights[2],10,9,22);
 for(let i=0;i<3;i++){const source=authored[i];authoredLight(pool.lights[i],source.color,source.intensity,source.distance,source.decay);}
 position(pool.lights[3],5,8,0);authoredLight(pool.lights[3],0xffe0a7,57,42,2);
});
test('exit restores all four fading street slots and zero-light fallback keeps the topology stable',()=>{
 const {scene,pool,posts,slots}=fixture(),interior=pool.registerInterior(authored);
 pool.beginFrame(0,0);interior.request(true);pool.update();
 pool.beginFrame(0,0);interior.request(false);pool.update();
 for(let i=0;i<4;i++){
  position(pool.lights[i],posts[i].p[0],8,0);authoredLight(pool.lights[i],0xffe0a7,.6*95*slots[i].level,42,2);
 }
 pool.setStreet([],[],1);pool.beginFrame(10000,10000);pool.update();
 assert.equal(pointLights(scene).length,4);assert(pool.lights.every(light=>light.intensity===0));
 pool.beginFrame(0,0);interior.request(true);pool.update();
 assert.equal(pool.lights[3].intensity,0);assert.equal(pool.lights[0].intensity,9);
});
test('repeated indoor and outdoor frames reuse exactly the same four scene lights',()=>{
 const {scene,pool,posts}=fixture(),interior=pool.registerInterior(authored),street=new BridgeLightSlots();
 const identities=[...pool.lights],children=[...scene.children];
 for(let frame=0;frame<240;frame++){
  pool.beginFrame(frame%35,0);pool.setStreet(posts,street.update(posts,frame%35,0,1/60),frame<120?1:0);
  interior.request(frame%40<20);pool.update();
  assert.deepEqual(pool.lights,identities);assert.deepEqual(scene.children,children);assert.equal(pointLights(scene).length,4);
 }
 pool.beginFrame(0,0);pool.update();assert(pool.lights.every(light=>light.intensity===0));
});
test('Dossin keeps its three original world-space lamps and activation region',()=>{
 const {scene,pool}=fixture(),layout=map.dossin!,dossin=addDossinLighting(scene,layout,pool);
 pool.beginFrame(...layout.center as [number,number]);dossin.update(...layout.center as [number,number]);pool.update();
 [[-4,-12],[-1,8],[16,22]].forEach(([u,v],i)=>{
  const p=dossinWorld(layout,u,v);position(pool.lights[i],p.x,5.45,p.z);authoredLight(pool.lights[i],0xffebce,9,25,1.5);
 });
 assert.equal(pointLights(scene).length,4);
 const outside=dossinWorld(layout,40,0);pool.beginFrame(outside.x,outside.z);dossin.update(outside.x,outside.z);pool.update();
 assert(pool.lights.every(light=>light.color.equals(new T.Color(0xffe0a7))));
});
test('Aquarium light requests survive the fish animation throttle and hide only fish on exit',()=>{
 const {scene,pool}=fixture(),layout=map.aquarium!,aquarium=addAquariumLife(scene,layout,pool);
 for(const time of [1,1,1.001]){
  pool.beginFrame(...layout.center as [number,number]);aquarium.update(time,...layout.center as [number,number]);pool.update();
  [-23,0,23].forEach((v,i)=>{const p=aquariumWorld(layout,0,v);position(pool.lights[i],p.x,6.6,p.z);authoredLight(pool.lights[i],0xc4dbc6,8,32,1.6);});
  assert.equal(pointLights(scene).length,4);
 }
 const outside=aquariumWorld(layout,27,0);pool.beginFrame(outside.x,outside.z);aquarium.update(1.001,outside.x,outside.z);pool.update();
 assert.equal(scene.getObjectByName('Aquarium fish and gallery lights')!.visible,false);assert.equal(pointLights(scene).length,4);
 assert(pool.lights.every(light=>light.color.equals(new T.Color(0xffe0a7))));
});
test('stationary Yacht Club lighting stays active despite the two-metre geometry throttle',async()=>{
 const {scene,pool}=fixture();
 const loader={loadAsync:async()=>({scene:new T.Group()})} as unknown as GLTFLoader;
 const yacht=await addYachtClub(scene,loader,pool),inside=yachtWorld(-7,-3);assert(yachtInside(inside.x,inside.z));
 for(let frame=0;frame<20;frame++){
  pool.beginFrame(inside.x,inside.z);yacht.update(inside.x,inside.z);pool.update();
  [[-40,-4,8],[-7,-3,7],[26,-2,7]].forEach(([u,v,y],i)=>{const p=yachtWorld(u,v);position(pool.lights[i],p.x,y,p.z);authoredLight(pool.lights[i],0xffd5a0,36,26,2);});
  assert.equal(pointLights(scene).length,4);
 }
 const outside=yachtWorld(200,0);pool.beginFrame(outside.x,outside.z);yacht.update(outside.x,outside.z);pool.update();
 assert.equal(pointLights(scene).length,4);assert(pool.lights.every(light=>light.color.equals(new T.Color(0xffe0a7))));
});
