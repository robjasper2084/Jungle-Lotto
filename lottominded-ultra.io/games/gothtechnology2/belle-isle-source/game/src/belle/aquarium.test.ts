import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {aquariumWorld,aquariumLocal,aquariumInside,aquariumBlocked,aquariumRay} from './aquarium.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap,c=map.aquarium!,terrain=new ParkTerrain(map);
function route(points:number[][]){for(let i=1;i<points.length;i++){const a=aquariumWorld(c,points[i-1][0],points[i-1][1]),b=aquariumWorld(c,points[i][0],points[i][1]),len=Math.hypot(b.x-a.x,b.z-a.z);assert.equal(terrain.raycastObstacle({...a,y:3},{x:(b.x-a.x)/len,y:0,z:(b.z-a.z)/len},len,.32),null,points[i-1]+' -> '+points[i]);}}
test('aquarium transforms round trip and north entrance faces its mapped approach',()=>{for(const p of [[0,-44],[0,0],[-5,24],[6,37]]){const w=aquariumWorld(c,p[0],p[1]),l=aquariumLocal(c,w.x,w.z);assert(Math.abs(l.u-p[0])<1e-9&&Math.abs(l.v-p[1])<1e-9);}const p=aquariumWorld(c,0,-44);assert(p.z<c.center[1]);});
test('entrance, both galleries and two central bypass aisles remain walkable',()=>{
 route([[-.8,-44],[-.8,-37.7],[0,-35],[0,-5],[3.1,-4],[3.1,4],[0,6],[0,35]]);
 route([[0,35],[0,6],[-3.1,4],[-3.1,-4],[0,-5],[.8,-37.7],[.8,-44]]);
 for(const [u,v]of[[0,-30],[3.1,0],[0,30]]){const p=aquariumWorld(c,u,v);assert(aquariumInside(c,p.x,p.z));assert(!terrain.obstructed(p.x,p.z,.32));assert.equal(terrain.height(p.x,p.z),2);}
});
test('tank panes and exterior masonry block both walking and camera rays',()=>{
 for(const [u,v]of[[5,-20],[0,0],[6.8,0],[3,-38],[0,38]]){const p=aquariumWorld(c,u,v);assert(aquariumBlocked(c,p.x,p.z,.32));}
 const p=aquariumWorld(c,0,-20),q=aquariumWorld(c,1,-20);assert(aquariumRay(c,{...p,y:3.5},{x:q.x-p.x,y:0,z:q.z-p.z},8,.18)!<4.1);
 const approach=aquariumWorld(c,0,-44);assert(!aquariumInside(c,approach.x,approach.z));
});

import {aquariumFloor} from './aquarium.ts';
test('outside steps rise to the landing and inside steps descend back to the gallery',()=>{
 const s=c.stairs!;assert(s);
 const floor=(u:number,v:number)=>{const p=aquariumWorld(c,u,v);return terrain.height(p.x,p.z);};
 assert.equal(floor(0,-44),2);assert.equal(floor(0,-38),2.6);assert.equal(floor(0,-34),2);
 for(let i=0;i<s.count;i++){assert(Math.abs(floor(0,s.outsideStart+(i+.5)*s.tread)-(2+(i+1)*s.rise))<1e-8);assert(Math.abs(floor(0,s.landingEnd+(i+.5)*s.tread)-(2+(s.count-1-i)*s.rise))<1e-8);}
 const outside=aquariumWorld(c,5,-40);assert.equal(aquariumFloor(c,outside.x,outside.z),null);
 const rail=aquariumWorld(c,0,-40.4);assert(terrain.obstructed(rail.x,rail.z,.2),'exterior handrail must collide');
 for(const lane of [-.8,.8])route([[lane,-44],[lane,-34]]);
});
