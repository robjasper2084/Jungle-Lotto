import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CommunityRide,LaneRoute} from '@digital-static/ridecore/cycling';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {rideCoreTerrain} from './ridecore-terrain.ts';
const read=async(name:string)=>JSON.parse(await readFile(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
test('Elmwood group completes the real Creek Lane corridor without an off-road shortcut',async()=>{
 const [grid,site,placements]=await Promise.all(['terrain.json','site.json','placements.json'].map(read));const map=new ElmwoodTerrain(grid,site.features,placements);await map.init();const terrain=rideCoreTerrain(map);
 const route=new LaneRoute(map.features.find(f=>f.id==='59197492')!.points.map(p=>({x:p[0],z:-p[1],width:4}))).section(25,175),ride=new CommunityRide(route,terrain,3.3,4);
 ride.join({...route.at(0,-.85)});ride.continue();let s=0;
 for(let i=0;i<14000&&ride.stage!=='complete';i++){s=Math.min(route.length-1,s+3.3/60);const p=route.at(s,-.85);ride.step(1/60,{...p,y:map.height(p.x,-p.z),speed:3.3});if(ride.stage==='regroup')ride.continue();}
 assert.equal(ride.stage,'complete',JSON.stringify(ride.riders));assert.equal(ride.completed,true);map.physics.free();
});

