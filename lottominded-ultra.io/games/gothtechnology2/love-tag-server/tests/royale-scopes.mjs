import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadHostFixture} from '../dist/hostFixture.js';
import {TagTerrain} from '../../ride-core/dist/tag/fixture.js';
import {DowntownArena,RoyaleMatch,initializeEngine} from '../../ride-core/dist/royale.js';
import {canReachScope} from '../../ride-core/dist/royale/scopes.js';

await initializeEngine(await readFile(new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)));
const data=await loadHostFixture(new URL('../fixtures/',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'swoop-detroit');
const world=await TagTerrain.create(data.fixture,await data.physics());
try {
 const terrain=new DowntownArena(world),sites=terrain.optics;
 assert.equal(sites.length,42);
 for(const {p} of sites){
  assert(terrain.clear(p.x,p.z,.75,p.y),'scope inside obstacle');
  assert(Math.abs(terrain.ground(p.x,p.z,p.y).height-p.y)<.1,'scope off ground');
  assert(terrain.route(terrain.spawns[0].position,p).length>0,'scope unreachable');
  for(const center of terrain.zones)assert(Math.hypot(p.x-center.x,p.z-center.z)<terrain.fieldRadii[0]);
 }
 for(const s of terrain.spawns)assert(sites.some(v=>v.kind==='scope2'&&Math.hypot(v.p.x-s.position.x,v.p.z-s.position.z)<25));
 const match=new RoyaleMatch(terrain);for(let i=0;i<6;i++)match.add('check'+i,'Scope check '+i,false,'DS_Man_01');match.start('scopes-map-check',0);
 const loot=match.loot.filter(v=>v.kind.startsWith('scope'));
 assert.equal(loot.length,42);
 for(const item of loot)assert(canReachScope(item.p,item.p,(a,b,r)=>terrain.line(a,b,r)));
 const saved=match.captureEngineState();match.restoreEngineState(saved);assert.deepEqual(match.loot.filter(v=>v.kind.startsWith('scope')),loot);
 const evidence={time:new Date().toISOString(),map:terrain.arenaIdentity,scopeCount:sites.length,tiers:Object.fromEntries(['scope2','scope4','scope8'].map(k=>[k,sites.filter(s=>s.kind===k).length])),checks:['42 sites on connected downtown graph','all sites clear and on ground','all six starts have a nearby 2x','all sites inside every opening field','compiled host includes scopes and preserves loot on restore'],sites};
 await writeFile(new URL('../../docs/combat/evidence/royale-scopes-map-20261010.json',import.meta.url),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({...evidence,sites:undefined}));match.dispose();
} finally {world.dispose();}
