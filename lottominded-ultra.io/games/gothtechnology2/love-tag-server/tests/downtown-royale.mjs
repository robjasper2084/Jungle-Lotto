import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadHostFixture} from '../dist/hostFixture.js';
import {TagTerrain} from '../../ride-core/dist/tag/fixture.js';
import {DowntownArena,RoyaleMatch,initializeEngine,currentHandshake,compatible} from '../../ride-core/dist/royale.js';
await initializeEngine(await readFile(new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)));
const data=await loadHostFixture(new URL('../fixtures/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'swoop-detroit');
const world=await TagTerrain.create(data.fixture,await data.physics()),terrain=new DowntownArena(world);
const evidence={radii:terrain.fieldRadii,time:new Date().toISOString(),handshake:currentHandshake(terrain.arenaIdentity),checks:[],spawns:terrain.spawns,zones:terrain.zones};
try{
 assert(compatible(evidence.handshake,terrain.arenaIdentity));assert(!compatible(evidence.handshake));
 assert(!compatible({...evidence.handshake,collision:'wrong'},terrain.arenaIdentity));
 for(const {position:p} of terrain.spawns){assert(terrain.clear(p.x,p.z,.75,p.y));for(const zone of terrain.zones){assert(terrain.route(p,zone).length>0);assert(Math.hypot(p.x-zone.x,p.z-zone.z)<terrain.fieldRadii[0]);}}
 for(const p of terrain.supplies)assert(terrain.clear(p.x,p.z,.75,p.y));
 for(const zone of terrain.zones)for(const [x,z]of [[2535.75,-1395.43],[-262.125,-1796.201],[-81.87,-1222.79]]){const t=world.fixture.transform;assert(Math.hypot((x-t.tx)/t.sx-zone.x,z-t.tz-zone.z)<terrain.fieldRadii[0]-50);}
 evidence.checks.push('Mack, Chene Park and Cut entrance inside all opening seeds','six clear authored starts','five reachable field centers','12 supplies on actual ground','map mismatch rejected');
 for(let seed=0;seed<5;seed++){
  const match=new RoyaleMatch(terrain);for(let i=0;i<6;i++)match.add('r'+i,'Rider '+i,true,'DS_Man_01');match.start('district-'+seed,seed);
  const f=match.snapshot('r0').field;assert.equal(f.radius,terrain.fieldRadii[0]);assert.equal(f.x,terrain.zones[seed].x);assert.equal(f.z,terrain.zones[seed].z);
  for(let i=0;i<600;i++)match.step();
  const saved=match.captureEngineState(),field=match.snapshot().field;match.restoreEngineState(saved);assert.deepEqual(match.snapshot().field,field);
  assert(match.actors.every(a=>Number.isFinite(a.pose.y)&&Math.abs(a.pose.y-terrain.ground(a.pose.x,a.pose.z,a.pose.y).height)<4));
  evidence.checks.push('seed '+seed+' compiled field, ten-second ride, snapshot restore');match.dispose();
 }
 await writeFile(new URL('../../docs/combat/evidence/downtown-map.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{world.dispose();}
