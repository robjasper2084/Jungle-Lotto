import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {loadHostFixture} from '../dist/hostFixture.js';
import {TagTerrain} from '../../ride-core/dist/tag/fixture.js';
import {AuthoredArena,authoredArenaLayout} from '../../ride-core/dist/royale/authoredArena.js';

const evidence=[];
for(const product of ['swoop-detroit','elmwood-explorer']){
 const data=await loadHostFixture(resolve(import.meta.dirname,'../fixtures'),product),bytes=await data.physics();
 const terrain=await TagTerrain.create(data.fixture,bytes);
 try{
  const map=new AuthoredArena(terrain),layout=map.layout;
  assert.equal(layout.spawns.length,6);assert.equal(layout.supplies.length,12);
  assert(layout.zones.length>=1);assert(map.compatible(map.handshake));
  assert(!map.compatible({...map.handshake,collision:'other-map'}));
  assert(!map.compatible({...map.handshake,map:product==='swoop-detroit'?'elmwood-full-map':'detroit-full-map'}));
  assert.equal(layout.collision,data.fixture.hash);
  assert.deepEqual(authoredArenaLayout(data.fixture,p=>map.clear(p.x,p.z,.75,p.y)),layout);
  let minimumSpacing=Infinity;
  for(let i=0;i<6;i++){
   const p=layout.spawns[i].position;assert(map.clear(p.x,p.z,.75,p.y));
   for(let j=0;j<i;j++)minimumSpacing=Math.min(minimumSpacing,Math.hypot(p.x-layout.spawns[j].position.x,p.z-layout.spawns[j].position.z));
   for(const z of layout.zones){assert(map.route(p,z).length>1,'Spawn can reach each final zone');
    assert(Math.hypot(p.x-z.x,p.z-z.z)<layout.initialRadius);}
   assert(layout.supplies.filter(s=>Math.hypot(p.x-s.x,p.z-s.z)<=35).length>=2);
   const source=map.sourcePosition(p),t=data.fixture.transform;
   assert.equal((source.x-t.tx)/t.sx,p.x);assert(Math.abs(source.y-t.ty-p.y)<1e-8);
  }
  for(const p of [...layout.zones,...layout.supplies])assert(map.clear(p.x,p.z,.75,p.y));
  assert(minimumSpacing>=20);
  evidence.push({product,arena:layout.arena,hash:layout.collision,connectedSites:layout.nodes.length,
   spawns:6,minimumSpacingM:Math.round(minimumSpacing),supplies:layout.supplies.length,
   reachableFinalZones:layout.zones.length,initialRadiusM:layout.initialRadius,
   sameCanonicalPhysics:true,deterministicLayout:true,mismatchRejected:true,
   scope:'Authoritative authored-map adapter validation; not integrated browser gameplay'});
  console.log(JSON.stringify(evidence.at(-1)));
 }finally{terrain.dispose();}
}
const root=new URL('../../docs/static-royale/evidence/',import.meta.url);await mkdir(root,{recursive:true});
await writeFile(new URL('authored-maps.json',root),JSON.stringify({at:new Date().toISOString(),evidence},null,2));
