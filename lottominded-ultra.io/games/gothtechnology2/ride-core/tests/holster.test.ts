import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCombat,neutral,RoyaleMatch,PROTECTION} from '../src/royale/rules.ts';
import {routeHolster,weaponReady,weaponReadyAmount} from '../src/royale/holster.ts';
import {WEAPON_DRAW_TICKS,standingIdle,sampleHeroAction} from '../src/heroActions.ts';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';

test('holster and draw block shooting and reload until complete; repeated requests cannot skip the animation',()=>{
 const s=initialCombat(),c={...neutral('test'),holster:true,fire:true,reload:true};
 assert(!routeHolster(s,c,100).fire);assert(s.holster?.stowed);
 assert.equal(weaponReadyAmount(s,100),1);
 for(let t=101;t<100+WEAPON_DRAW_TICKS;t++){const out=routeHolster(s,c,t);assert(!out.fire&&!out.reload);assert(s.holster?.stowed);}
 routeHolster(s,neutral('test'),150);assert.equal(weaponReadyAmount(s,150),0);
 const draw=routeHolster(s,{...neutral('test'),fire:true},151);assert(!draw.fire);assert(!s.holster?.stowed);
 assert(!weaponReady(s,151+WEAPON_DRAW_TICKS-1));assert(weaponReady(s,151+WEAPON_DRAW_TICKS));
 assert(routeHolster(s,{...neutral('test'),fire:true},151+WEAPON_DRAW_TICKS).fire);
 const busy=initialCombat();busy.reloadStart=1;routeHolster(busy,c,2);assert(!busy.holster?.stowed);
});
test('Blender idle is seamless and grip is held until the wheel is grounded',()=>{
 const a=standingIdle(0),b=standingIdle(8-1e-7);a.forEach((n,i)=>assert(Math.abs(n-b[i])<1e-6));
 for(let i=0;i<=100;i++){const [grip,lift]=sampleHeroAction('pickup',i/100);if(lift>.001)assert(grip>.999);assert(lift>=0&&lift<=.121);}
});
test('actual authoritative engine keeps ammo while holstered, syncs guests, restores state and allows a completed draw',async()=>{
 await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
 const terrain=await ArenaTerrain.create(),m=new RoyaleMatch(terrain),copy=new RoyaleMatch(terrain);
 for(let i=0;i<6;i++){m.add('r'+i,'r'+i);copy.add('r'+i,'r'+i);}m.start('holster',1);copy.start('other',1);
 for(let n=0;n<PROTECTION;n++)m.step();
 let seq=0;const send=(bits:Partial<ReturnType<typeof neutral>>)=>{assert(m.command('r0',{...neutral(m.round,++seq,m.tick),...bits}));m.step();};
 const actor=m.actors[0],ammo=actor.ammo.static;
 send({holster:true,fire:true,shot:1});for(let i=0;i<45;i++)send({});
 assert.equal(actor.ammo.static,ammo);assert(actor.combat.holster?.stowed);
 const guest=m.actors[1];guest.controller.reset({position:{x:actor.pose.x+.5,y:actor.pose.y,z:actor.pose.z},headingY:0});guest.pose={...guest.controller.poseValue};
 assert(m.snapshot('r1').actors.find(a=>a.id==='r0')?.combat.holster?.stowed);
 copy.restoreEngineState(m.captureEngineState());assert.deepEqual(copy.actors[0].combat.holster,actor.combat.holster);
 send({fire:true,shot:2});for(let i=0;i<WEAPON_DRAW_TICKS-1;i++)send({});
 assert.equal(actor.ammo.static,ammo);
 send({fire:true,shot:3});assert.equal(actor.ammo.static,ammo-1);
 send({dismount:true});for(let i=0;i<65;i++)send({});
 send({holster:true});for(let i=0;i<45;i++)send({});
 assert(actor.combat.holster?.stowed);send({brawl:true});
 assert(actor.combat.melee.brawl,'can enter Brawl with a stowed firearm');
 const before=actor.combat.melee.serial,remaining=actor.ammo.static;
 send({light:true});assert(actor.combat.melee.serial>before,'unarmed strike reaches the authoritative engine');
 send({brawl:true,fire:true,shot:4});assert(!actor.combat.melee.brawl);
 assert.equal(actor.ammo.static,remaining,'exiting Brawl cannot fire a stowed weapon');
 m.dispose();copy.dispose();
});
