import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {dossinWorld,dossinLocal,dossinInside,dossinBlocked,dossinRay,dossinRoom} from './dossin.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap,c=map.dossin!,terrain=new ParkTerrain(map);
function route(points:number[][]){for(let i=1;i<points.length;i++){const a=dossinWorld(c,...points[i-1] as [number,number]),b=dossinWorld(c,...points[i] as [number,number]),len=Math.hypot(b.x-a.x,b.z-a.z);assert.equal(terrain.raycastObstacle({...a,y:3},{x:(b.x-a.x)/len,y:0,z:(b.z-a.z)/len},len,.32),null,points[i-1]+' -> '+points[i]);}}
test('museum entrance and galleries preserve mapped coordinates and level floor',()=>{for(const [u,v]of[[-5,-29],[-5,-18],[-5,12],[15,22],[-28,-19.4]]){const p=dossinWorld(c,u,v),q=dossinLocal(c,p.x,p.z);assert(Math.abs(q.u-u)<1e-9&&Math.abs(q.v-v)<1e-9);assert.equal(terrain.height(p.x,p.z),2);assert(!terrain.obstructed(p.x,p.z,.32));}assert(!dossinInside(c,...Object.values(dossinWorld(c,-5,-29)) as [number,number]));});
test('open north doors lead to all galleries with a continuous return path',()=>{
 route([[-5,-29],[-5,-18],[-5,0],[-5,22],[14,22],[14,20.5],[26,20.5]]);
 route([[-5,-14.8],[0,-14.8],[7,-14.8]]);
 route([[-5,-18],[-8,-18],[-8,-19.4],[-28,-19.4]]);
 route([[-28,-19.4],[-8,-19.4],[-8,-18],[-5,-18],[-5,-29]]);
});
test('museum walls, cases and rear pilothouse stop walkers and camera rays',()=>{
 for(const [u,v]of[[10.7,5],[-8.3,5],[3.8,0],[-28.3,-16.9],[4.3,31.15]]){const p=dossinWorld(c,u,v);assert(dossinBlocked(c,p.x,p.z,.32));}
 const p=dossinWorld(c,-5,0),q=dossinWorld(c,1,0),len=Math.hypot(q.x-p.x,q.z-p.z);assert(dossinRay(c,{...p,y:3.5},{x:(q.x-p.x)/len,y:0,z:(q.z-p.z)/len},15,.18)!<7.2);
 assert.match(dossinRoom(c,...Object.values(dossinWorld(c,-28,-19.4)) as [number,number])!,/Miss Pepsi/);
});
