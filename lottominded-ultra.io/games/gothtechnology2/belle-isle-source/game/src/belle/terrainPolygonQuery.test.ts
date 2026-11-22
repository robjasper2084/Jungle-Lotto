import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ParkTerrain,inside,type ParkMap,type Point} from './terrain.ts';
import {RideCore} from '../../runtime/ride-core/src/ridecore.ts';

const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap;
type PolygonSampler={contains(x:number,z:number,p:Point[]):boolean};
const contains=(terrain:ParkTerrain,x:number,z:number,p:Point[])=>(terrain as unknown as PolygonSampler).contains(x,z,p);

/** Exhaustive containment oracle for static rings. Public inside() traverses
 * every edge independently of the optimized private query. Length-based bounds
 * invalidation is intentional new behavior: the previous cache could retain
 * stale bounds after a resize. Same-length coordinate edits need a new array. */
function exhaustiveContains(){
 const cached=new WeakMap<Point[],{minX:number;maxX:number;minZ:number;maxZ:number;length:number}>();
 return(x:number,z:number,p:Point[])=>{
  let b=cached.get(p);
  if(!b||b.length!==p.length){
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const [px,pz]of p){minX=Math.min(minX,px);maxX=Math.max(maxX,px);minZ=Math.min(minZ,pz);maxZ=Math.max(maxZ,pz);}
   b={minX,maxX,minZ,maxZ,length:p.length};cached.set(p,b);
  }
  return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ&&inside(x,z,p);
 };
}
function exhaustiveTerrain(data:ParkMap){
 const terrain=new ParkTerrain(data);
 Object.assign(terrain,{contains:exhaustiveContains()});
 return terrain;
}

test('all static map rings and land/underpass queries match exhaustive containment exactly',()=>{
 const actual=new ParkTerrain(map),reference=exhaustiveTerrain(map),query=exhaustiveContains();
 const rings=[map.island,map.mainland,...(map.outerIslets||[]).map(p=>p.points),...map.water.flatMap(p=>[p.points,...p.holes])];
 let checks=0;
 for(const ring of rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  for(const [x,z]of [a,[(a[0]+b[0])/2,(a[1]+b[1])/2]])for(const [dx,dz]of [[0,0],[1e-9,0],[-1e-9,0],[0,1e-9],[0,-1e-9]]){
   assert.equal(contains(actual,x+dx,z+dz,ring),query(x+dx,z+dz,ring),'ring vertex/edge '+checks++);
  }
 }
 for(let x=-250;x<4500;x+=47)for(let z=-1800;z<2200;z+=53)for(const y of [2,8]){
  assert.equal(actual.land(x,z,y),reference.land(x,z,y),'land/underpass '+[x,z,y].join(','));
 }
});

test('exact band boundaries, concave/open/reversed rings and fallback geometries preserve results',()=>{
 const terrain=new ParkTerrain(map),query=exhaustiveContains();
 const comb:Point[]=[[0,-96],[12,-96],[12,-64],[4,-64],[4,-32],[12,-32],[12,0],[4,0],[4,32],[12,32],[12,64],[4,64],[4,96],[0,96],[0,64],[0,32],[0,0],[0,-32],[0,-64],[0,-96]];
 for(const ring of [comb,comb.slice(0,-1),comb.slice().reverse()]){
  for(const z of [-96,-64,-32,0,32,64,96])for(const x of [-1,0,2,4,8,12,13]){
   const epsilon=Number.EPSILON*Math.max(1,Math.abs(z));
   for(const delta of [-epsilon,0,epsilon])assert.equal(contains(terrain,x,z+delta,ring),query(x,z+delta,ring),'band edge '+[x,z,delta].join(','));
  }
 }
 const fallbackRings:Point[][]=[
  [],[[0,0]],[[0,0],[4,4]],[[0,0],[4,0],[4,4],[0,4]],
  Array.from({length:20},(_,i)=>[0,i*32] as Point),
  Array.from({length:20},(_,i)=>[i*2,i*32] as Point),
  comb.map(([x,z])=>[x,z*2048] as Point),
  comb.map(([x,z])=>[x,3e17+z] as Point),
  Array.from({length:64},(_,i)=>[i%8,(i%2)*131000] as Point),
  [...comb,[NaN,0]],[...comb,[0,NaN]],[...comb,[Infinity,0]],[...comb,[0,-Infinity]],
 ];
 for(const [i,ring]of fallbackRings.entries())for(const x of [-1,0,2,7,13,Infinity,NaN])for(const z of [-1,0,32,64,130000,3e17,Infinity,NaN]){
  assert.equal(contains(terrain,x,z,ring),query(x,z,ring),'fallback '+[i,x,z].join(','));
 }
});

test('point-count changes and replacement ring arrays rebuild their cached queries',()=>{
 const terrain=new ParkTerrain(map),ring:Point[]=[[0,0],[10,0],[10,10],[0,10]];
 assert.equal(contains(terrain,15,5,ring),false);
 ring.splice(2,0,[20,0],[20,10]);
 assert.equal(contains(terrain,15,5,ring),inside(15,5,ring));
 assert.equal(contains(terrain,15,5,ring),true);
 ring.splice(2,2);
 assert.equal(contains(terrain,15,5,ring),false);
 const replacement=ring.map(([x,z])=>[x+20,z] as Point);
 assert.equal(contains(terrain,25,5,replacement),true);
 assert.equal(contains(terrain,5,5,ring),true);
});

test('full deterministic rider state matches exhaustive queries across six real-map routes',()=>{
 const actual=new ParkTerrain(map),reference=exhaustiveTerrain(map);
 const starts=[map.spawn,{x:464.05,z:880.67,heading:1.1},{x:2169.3683,z:785.5,heading:2.03},{x:2505.3734,z:618.3816,heading:2.05},{x:2629.5446,z:307.5443,heading:2.8},{x:2771.5028,z:60.4926,heading:2.4}];
 for(const [route,start]of starts.entries()){
  const spawn={position:{x:start.x,y:actual.height(start.x,start.z),z:start.z},headingY:start.heading};
  const a=new RideCore(actual,{spawn}),b=new RideCore(reference,{spawn});
  for(let i=0;i<120;i++){
   const input={throttle:i>=90&&i<100?-1:1,steer:Math.sin(i*.014)*.15,stableAI:true,hop:i===50,hopHeld:i>=50&&i<55,dismount:route%2===1&&i===70};
   assert.deepEqual(a.advance(.05,input),b.advance(.05,input),'advance '+route+'/'+i);
   assert.deepEqual(a.controller.captureState(),b.controller.captureState(),'controller state '+route+'/'+i);
  }
 }
});
