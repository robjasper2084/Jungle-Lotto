import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {greenhouseWorld,greenhouseInside,greenhouseRoom} from './conservatory.ts';
import {fountains,natureMix,waterLevel,TEMPERANCE_VIEW} from './waterFeatures.ts';

const here=new URL('.',import.meta.url);
const map=JSON.parse(fs.readFileSync(new URL('../../public/belle/map.json',here),'utf8')) as ParkMap;
const c=map.conservatory!,terrain=new ParkTerrain(map);
const at=(u:number,v:number)=>greenhouseWorld(c,u,v);

// The rejected draft put a fictional maze in the WEST garden, not inside the
// existing plant houses. Keep both areas distinct; do not remove real glazing,
// plant beds, the fountain or the three pond-side safety-rail segments.
test('rejected garden maze has no runtime modules, loaders, guide actions or colliders',()=>{
 for(const name of ['gardenMaze.ts','gardenMazeScene.ts','gardenMaze.test.ts','gardenMazeDrive.test.ts'])
  assert(!fs.existsSync(new URL(name,here)),name+' must not be shipped');
 const forbidden=/GardenMazeCollision|addGardenMaze|withinMazeGarden|mazeArrival|mazeLandmark|belle-conservatory-garden-maze|Conservatory Garden Maze/;
 for(const name of ['main.ts','world.ts','terrain.ts','nature.ts'])
  assert(!forbidden.test(fs.readFileSync(new URL(name,here),'utf8')),name+' retained a rejected maze dependency');
 assert(!map.landmarks.some(l=>l.id==='belle-conservatory-garden-maze'));
 assert(!('gardenMaze' in terrain));
});

test('former draft footprint has dry ground and no maze hitboxes across a half-metre grid',()=>{
 let samples=0;
 for(let u=-84;u<=-56;u+=.5)for(let v=-10;v<=10;v+=.5){
  const p=at(u,v);assert(terrain.land(p.x,p.z),'land '+u+','+v);
  assert(Number.isFinite(terrain.height(p.x,p.z)));
  assert(!terrain.obstructed(p.x,p.z,.35),'unexpected obstruction '+u+','+v);samples++;
 }
 assert.equal(samples,2337);
 for(const [u,v,du,dv,length]of [[-88,0,1,0,36],[-70,-14,0,1,28],[-88,-10,1,0,36],[-88,10,1,0,36]]){
  const p=at(u,v),q=at(u+du,v+dv),d={x:q.x-p.x,y:0,z:q.z-p.z};
  assert.equal(terrain.raycastObstacle({...p,y:3},d,length,.35),null,'ground sweep');
  assert.equal(terrain.raycastCamera({...p,y:3},d,length,.16),null,'camera sweep');
  assert.equal(terrain.raycastFlight({...p,y:3},d,length,.35),null,'flight sweep');
 }
});

test('greenhouse aisles remain open while actual beds, glazing and pond rails stay solid',()=>{
 for(const [u,v]of [[-24,0],[-9,0],[0,0],[0,-20],[0,-30],[0,16],[0,32],[16,0],[23,24],[23,34]]){
  const p=at(u,v);assert(!terrain.obstructed(p.x,p.z,.32),'intended aisle '+u+','+v);
 }
 const bed=c.beds[0],plant=at(bed.u,bed.v),rail=at(20.7,24);
 assert(terrain.obstructed(plant.x,plant.z,.25));assert(terrain.obstructed(rail.x,rail.z,.25));
 assert.equal(c.gardenWalls?.length,3);
 const p=at(-24,3),q=at(-23,3);
 assert.notEqual(terrain.raycastObstacle({...p,y:3},{x:q.x-p.x,y:0,z:q.z-p.z},15,.35),null,'real glass is retained');
});

test('greenhouse room zones, indoor sound mix and indoor fountain survive without a maze zone',()=>{
 for(const room of c.rooms){const p=at(room.point[0],room.point[1]);assert(greenhouseInside(c,p.x,p.z));assert.equal(greenhouseRoom(c,p.x,p.z),room.name);}
 const outside=at(-70,0);assert(!greenhouseInside(c,outside.x,outside.z));assert.equal(greenhouseRoom(c,outside.x,outside.z),null);
 const indoor=natureMix(true,true,.55,true,.4),outdoor=natureMix(true,true,.55,false,.4);
 assert(indoor.wind<outdoor.wind&&indoor.birds<outdoor.birds);assert.equal(indoor.water,outdoor.water);
 assert(waterLevel(fountains(map),...TEMPERANCE_VIEW)>0,'original indoor fountain stays audible by proximity');
 assert.deepEqual(natureMix(true,false,.55,true,.4),{wind:0,birds:0,water:0});
 const main=fs.readFileSync(new URL('main.ts',here),'utf8');
 assert.match(main,/natureAudio\.update\(pose\.x,pose\.z,[\s\S]*?greenhouseInside\(data\.conservatory,pose\.x,pose\.z\)/);
 assert.match(main,/greenhouseRoom\(data\.conservatory,pose\.x,pose\.z\)/);
});
