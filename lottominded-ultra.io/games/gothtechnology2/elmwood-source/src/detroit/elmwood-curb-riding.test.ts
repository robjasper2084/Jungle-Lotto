import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RideController,NEUTRAL_ACTIONS} from '@digital-static/ridecore';
import {ElmwoodTerrain} from './elmwood-terrain.ts';
import {rideCoreTerrain} from './ridecore-terrain.ts';

const read=(name:string)=>JSON.parse(fs.readFileSync(new URL('../../public/elmwood/'+name,import.meta.url),'utf8'));
const map=new ElmwoodTerrain(read('terrain.json'),read('site.json').features,read('placements.json'));
await map.init();

test('mapped forecourt and chapel curbs do not launch or throw the rider',t=>{
  const sampler=rideCoreTerrain(map);let crossings=0;
  for(let index=0;index<map.curbs.length;index+=3)for(const side of [-1,1]){
    const curb=map.curbs[index],dx=Math.cos(curb.heading)*side,dz=-Math.sin(curb.heading)*side;
    const x=curb.x-dx*3,z=-curb.north-dz*3;
    // Test unobstructed crossings, keeping tree/crypt collision behavior separate.
    let clear=true;
    for(let distance=0;distance<4.5;distance+=.2){
      const px=x+dx*distance,pz=z+dz*distance,y=map.height(px,-pz);
      if(map.raycastObstacle({x:px,y:y+.65,z:pz},{x:dx,y:0,z:dz},.6,.35)!==null){clear=false;break;}
    }
    if(!clear)continue;
    const sim=new RideController(sampler,{spawn:{position:{x,y:map.height(x,-z),z},headingY:Math.atan2(dx,dz)}});
    let progress=0;
    for(let tick=0;tick<720&&progress<4.25;tick++){
      sim.step(1/120,{...NEUTRAL_ACTIONS,throttle:.65});const state=sim.snapshot();
      assert.equal(state.crashed,false,`curb ${index}, side ${side}: ${state.crashCause}`);
      assert.equal(state.grounded,true,`curb ${index}, side ${side}: false curb takeoff at ${progress.toFixed(2)}m`);
      progress=(state.position.x-x)*dx+(state.position.z-z)*dz;
    }
    assert.ok(progress>=4.25,`curb ${index}, side ${side}: stuck`);
    assert.equal(sim.snapshot().landings,0);crossings++;
  }
  assert.ok(crossings>=20,`Only ${crossings} clear crossings tested`);
  t.diagnostic(`${crossings} mapped curb crossings, both approach directions, actual standalone terrain and packaged RideCore`);
});
