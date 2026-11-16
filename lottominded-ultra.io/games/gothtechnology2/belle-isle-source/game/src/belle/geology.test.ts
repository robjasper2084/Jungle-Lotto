import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ParkTerrain,type ParkMap} from './terrain.ts';
import {planBoulders,MAX_BOULDERS} from './geology.ts';
import {roadIndex} from './streetPlan.ts';
const map:ParkMap=JSON.parse(readFileSync(new URL('../../public/belle/map.json',import.meta.url),'utf8'));
test('natural rock clusters are finite, deterministic, and do not block mapped ride shoulders',()=>{
 const terrain=new ParkTerrain(map),original=JSON.stringify(map),rocks=planBoulders(map,terrain),compare=planBoulders(map,terrain);
 assert.deepEqual(rocks,compare);
 assert.equal(JSON.stringify(map),original);
 assert(rocks.length>=12&&rocks.length<=MAX_BOULDERS,'should form bounded natural clusters');
 const occupied=roadIndex(map.roads);
 for(const b of rocks){
  assert(terrain.land(b.x,b.z));
  assert(!terrain.obstructed(b.x,b.z,b.radius+.3));
  assert(!occupied(b.x,b.z,'',9+b.radius),'geology cannot enter protected racing and pathway corridors');
  assert([b.x,b.z,b.y,b.radius,b.height,b.yaw].every(Number.isFinite));
  assert(b.radius>=.7&&b.radius<=1.56);
 }
});
test('new mineral obstacles join real on-foot and flight collision with no terrain height changes',()=>{
 const terrain=new ParkTerrain(map),rock=planBoulders(map,terrain)[0];
 assert(rock,'expected at least one rock');
 const before=terrain.height(rock.x,rock.z);
 terrain.registerBoulders([{x:rock.x,z:rock.z,bottom:rock.y,top:rock.y+rock.height,radius:rock.radius*.78}]);
 assert(terrain.obstructed(rock.x,rock.z,.15),'footpath and rider collision must reject the rock');
 const hit=terrain.raycastFlight({x:rock.x-4,y:rock.y+rock.height*.5,z:rock.z},{x:1,y:0,z:0},8,.2);
 assert(hit!==null&&hit<6,'rider and camera rays must see the solid');
 assert.equal(terrain.height(rock.x,rock.z),before,'geology never edits the existing ground/collision surface');
});
