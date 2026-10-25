import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch,PROTECTION,neutral} from '../src/royale/rules.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create();
for(const engine of [false,true])for(const skin of ['DS_Man_01','DS_Armored_Rider_01','DS_Hoodie_Woman_01','DS_Mascot_Hoodie_01','DS_Mascot_Suit_01'])test(`Recover remounts a knocked-off human without respawning (${skin}, engine=${engine})`,()=>{
 const m=new RoyaleMatch(terrain,engine);m.add('human','Human');m.add('other','Other');m.start('human-recovery',1);
 for(let i=0;i<PROTECTION;i++)m.step();
 const a=m.actors[0];a.skin=skin;a.controller.reset({position:{x:0,y:0,z:0},headingY:0});a.controller.combatOnFoot=true;a.controller.knockOff();a.pose={...a.controller.poseValue};
 let seq=0;const step=(recover=false)=>{m.command(a.id,{...neutral(m.round,++seq,m.tick),recover});m.step();};
 // Wait for the full captured fall and ground rise, not the old short stagger.
 for(let i=0;i<240;i++){step();if(a.pose.crashMotion===0)break;}
 assert.equal(a.pose.crashMotion,0,'fall and ground rise finish within four seconds');
 assert.equal(a.pose.footMode,2);const stock=a.reentryUsed,health=a.integrity,park=[a.pose.parkX,a.pose.parkY,a.pose.parkZ];
 step(true);assert.equal(a.pose.footMode,3,'Recover starts the real pickup animation');
 for(let i=0;i<240;i++)step();
 assert.equal(a.pose.footMode,0);assert.equal(a.reentryUsed,stock);assert.equal(a.integrity,health);assert.deepEqual([a.pose.x,a.pose.y,a.pose.z],park);
 m.dispose();
});


for(const engine of [false,true])test(`early Recover survives stagger without teleport or respawn (engine=${engine})`,()=>{
 const m=new RoyaleMatch(terrain,engine);m.add('human','Human');m.add('other','Other');m.start('early',1);
 for(let i=0;i<PROTECTION;i++)m.step();const a=m.actors[0];
 a.controller.reset({position:{x:0,y:0,z:0},headingY:0});a.controller.combatOnFoot=true;a.controller.knockOff();a.pose={...a.controller.poseValue};
 const health=a.integrity,stock=a.reentryUsed;let seq=0;
 m.command(a.id,{...neutral(m.round,++seq,m.tick),recover:true});m.step();
 assert.equal(a.pose.footMode,2,'must settle before mounting');
 for(let i=0;i<240;i++){m.command(a.id,neutral(m.round,++seq,m.tick));m.step();}
 assert.equal(a.pose.footMode,0);assert.equal(a.integrity,health);assert.equal(a.reentryUsed,stock);m.dispose();
});
test('critical health blocks queued recovery in the shared movement rules',()=>{
 const m=new RoyaleMatch(terrain,false);m.add('human','Human');m.add('other','Other');m.start('blocked',1);
 for(let i=0;i<PROTECTION;i++)m.step();const a=m.actors[0];a.controller.reset({position:{x:0,y:0,z:0},headingY:0});a.controller.combatOnFoot=true;a.controller.knockOff();a.pose={...a.controller.poseValue};a.integrity=10;
 for(let i=0;i<240;i++){m.command(a.id,{...neutral(m.round,i+1,m.tick),recover:i===0});m.step();}
 assert.equal(a.pose.footMode,2);assert.equal(a.integrity,10);assert.equal(a.reentryUsed,0);m.dispose();
});
for(const engine of [false,true])test(`distant wheel recovery does not teleport or consume respawns (engine=${engine})`,()=>{
 const m=new RoyaleMatch(terrain,engine);m.add('human','Human');m.add('other','Other');m.start('distance',1);
 for(let i=0;i<PROTECTION;i++)m.step();const a=m.actors[0];
 a.controller.reset({position:{x:0,y:0,z:0},headingY:0});a.controller.combatOnFoot=true;a.controller.knockOff();
 let seq=0;const step=(recover=false,throttle=0)=>{m.command(a.id,{...neutral(m.round,++seq,m.tick),recover,throttle});m.step();};
 // Move away using real walking input after the fall; teleporting the pose
 // during a fall is overwritten by its authoritative momentum trajectory.
 for(let i=0;i<240;i++)step();
 for(let i=0;i<300;i++)step(false,1);
 const away={x:a.pose.x,z:a.pose.z};assert.ok(Math.hypot(away.x-a.pose.parkX,away.z-a.pose.parkZ)>9);
 for(let i=0;i<240;i++)step(i===0);
 assert.equal(a.pose.footMode,2);assert.equal(a.pose.parkX,0);assert.ok(Math.hypot(a.pose.x-a.pose.parkX,a.pose.z-a.pose.parkZ)>9);assert.equal(a.reentryUsed,0);m.dispose();
});
test.after(()=>terrain.dispose());
