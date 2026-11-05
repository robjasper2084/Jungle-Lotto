import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';import {ArenaTerrain} from '../src/royale/arena.ts';import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';
test('compiled elimination records the actual attacker, keeps live/spectator views private and returns historical shots',async()=>{
 await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));const terrain=await ArenaTerrain.create(),m=new RoyaleMatch(terrain,true);m.add('shooter','Shooter');m.add('victim','Victim');m.add('hidden','Hidden');m.start('killcam',1);
 for(const [i,a]of m.actors.entries()){a.controller.reset({position:{x:i===2?250:0,y:0,z:i===1?10:0},headingY:0});a.pose={...a.controller.poseValue};}
 let seq=0,shot=0;for(let i=0;i<PROTECTION+200;i++){const fire=i>PROTECTION&&i%10===0;assert(m.command('shooter',{...neutral(m.round,++seq,m.tick),fire,shot:fire?++shot:shot}));m.step();if(!m.actors[1].alive)break;}
 assert(!m.actors[1].alive,'victim should be eliminated by actual compiled shots');assert.equal(m.killcam('shooter'),undefined);assert.equal(m.killcam('spectator'),undefined);
 const replay=m.killcam('victim')!;assert(replay);assert.equal(replay.killer,'shooter');assert.equal(replay.victim,'victim');assert(replay.frames.length<=61);assert(replay.frames.some(f=>f.projectiles.some(p=>p.owner==='shooter')));
 assert(replay.frames.every(f=>!f.self&&!f.actors.some(a=>a.id==='hidden')&&f.loot.length===0));const spectator=m.snapshot('victim');assert.equal(spectator.spectating?.delay,3);assert(spectator.spectating!.tick!<=m.tick-180);assert(!spectator.actors.some(a=>a.id==='hidden'));
 for(let i=0;i<30;i++)m.step();assert.equal(m.killcam('victim')!.frames.at(-1)!.tick,replay.frames.at(-1)!.tick,'must remain historical');
 m.actors[1].alive=true;assert.equal(m.killcam('victim'),undefined);m.dispose();terrain.dispose();
});
test('a compiled field elimination does not invent a killer',async()=>{
 await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
 const terrain=await ArenaTerrain.create(),outside=Object.create(terrain);Object.defineProperties(outside,{zones:{value:Array.from({length:5},()=>({x:2000,z:2000}))},fieldRadii:{value:[100,80,60,40,20,0]}});
 const m=new RoyaleMatch(outside,true);try{m.add('victim','Victim');m.start('field-death',1);for(let i=0;i<6000&&m.actors[0].alive;i++)m.step();assert(!m.actors[0].alive);assert.equal(m.killcam('victim'),undefined);}finally{m.dispose();terrain.dispose();}
});
