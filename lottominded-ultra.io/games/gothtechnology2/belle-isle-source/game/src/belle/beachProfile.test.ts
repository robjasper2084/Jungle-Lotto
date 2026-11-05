import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ParkTerrain,inside,type ParkMap} from './terrain.ts';
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8')) as ParkMap,terrain=new ParkTerrain(map);
test('beach shore slopes toward the water without moving buildings or approach roads',()=>{
 const b=terrain.beaches.find(b=>b.id==='368854132')!;let sloping=0;
 for(let x=1920;x<2000;x+=2)for(let z=120;z<220;z+=2){if(!inside(x,z,b.points))continue;const h=terrain.height(x,z);assert(Number.isFinite(h)&&h>=.119&&h<=2.001);if(h<1.5)sloping++;}
 assert(sloping>20);for(const b of map.buildings.filter(b=>b.points.some(p=>p[0]>1800&&p[0]<2100&&p[1]>0&&p[1]<450)))for(const p of b.points)assert(Math.abs(terrain.height(p[0],p[1])-2)<.03,b.id+' foundation moved');
 assert(terrain.land(1949,184));assert(!terrain.obstructed(1949,184,1));assert(terrain.height(1949,184)>.3);
});
test('beach ground normals and vertical tyre-support rays agree with visible height',()=>{
 for(const [x,z]of [[1949,184],[1970,150],[2000,80]]){
  const out={height:0,normal:{x:0,y:1,z:0},surface:'pavement' as const,offCourse:false};terrain.sampleGround(x,z,out);assert(!out.offCourse);assert(out.normal.y>.93);const ray=terrain.raycast({x,y:5,z},{x:0,y:-1,z:0},10);assert(ray!==null);assert(Math.abs(5-ray-out.height)<1e-6);
 }
});
