import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION,WEAPONS,weaponSocket} from '../src/royale/rules.ts';
import {RangeScoring} from '../src/royale/practiceRange.ts';

await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create();
test.after(()=>terrain.dispose());
for(const distance of [10,25,50,100])test('compiled projectile reaches and scores a '+distance+' m board with ballistic holdover',()=>{
 const m=new RoyaleMatch(terrain);m.add('human','Player');m.add('other','Other');m.start('range-'+distance,3);
 try{
  const actor=m.actors[0],other=m.actors[1];actor.controller.reset({position:{x:-200,y:0,z:-180},headingY:0});actor.pose={...actor.controller.poseValue};
  other.controller.reset({position:{x:200,y:0,z:180},headingY:0});other.pose={...other.controller.poseValue};
  for(let i=0;i<PROTECTION;i++)m.step();
  const target={distance,center:{x:-200,y:1.3,z:-180+distance},hits:0},scoring=new RangeScoring([target],0),spec=WEAPONS.static;
  let yaw=0,pitch=0;
  // Hold over for the weapon's real gravity; no hitscan or fabricated impacts.
  for(let i=0;i<5;i++){const o=weaponSocket(actor.pose,actor.skin,yaw,pitch,1).muzzle,d=Math.hypot(target.center.x-o.x,target.center.z-o.z);yaw=Math.atan2(target.center.x-o.x,target.center.z-o.z);pitch=Math.atan2(target.center.y-o.y+.5*spec.gravity*(d/spec.speed)**2,d);}
  let seq=0;
  for(let i=0;i<30;i++){assert(m.command('human',{...neutral(m.round,++seq,m.tick),aimMode:2,aimYaw:yaw,aimPitch:pitch}));m.step();}
  assert(m.command('human',{...neutral(m.round,++seq,m.tick),aimMode:2,aimYaw:yaw,aimPitch:pitch,fire:true,shot:1}));m.step();
  let impacts=0;for(let i=0;i<80;i++){
   impacts+=scoring.observe(m.projectiles,'human',()=>weaponSocket(actor.pose,actor.skin,yaw,pitch,1).muzzle).length;
   m.command('human',{...neutral(m.round,++seq,m.tick),aimMode:2,aimYaw:yaw,aimPitch:pitch});m.step();
  }
  assert.equal(actor.shots,1);assert.equal(actor.ammo.static,79);assert.equal(target.hits,1);assert.equal(impacts,1);
 }finally{m.dispose();}
});
