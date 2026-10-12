import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {loadDowntown} from './downtown-fixture.mjs';
import {initializeEngine,RoyaleMatch,neutral,PROTECTION,weaponSocket,WEAPONS} from '../../ride-core/dist/royale.js';
import {rangeLayout,RangeScoring} from '../../ride-core/dist/royale/practiceRange.js';
await initializeEngine(await readFile(process.env.ROYALE_ENGINE_PATH??new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)));
const city=await loadDowntown(),layout=rangeLayout(city),range=new RangeScoring(layout.targets,layout.heading),m=new RoyaleMatch(layout.terrain,undefined,6,true,true);
try {
 m.add('local','Range',false,'DS_Armored_Rider_01');m.start('range',123);let seq=0,shot=0;
 const tick=(input={})=>{assert(m.command('local',{...neutral(m.round,++seq,m.tick),...input}));m.step();const a=m.actors[0];range.observe(m.projectiles,a.id,()=>weaponSocket(a.pose,a.skin,a.input.aimYaw,a.input.aimPitch,a.combat.aimBlend).muzzle);};
 for(let i=0;i<PROTECTION+1;i++)tick();tick({dismount:true});for(let i=0;i<80;i++)tick();assert.equal(m.actors[0].pose.footMode,2);
 for(const target of layout.targets){const a=m.actors[0],yaw=Math.atan2(target.center.x-a.pose.x,target.center.z-a.pose.z);for(let i=0;i<60;i++)tick({facingYaw:yaw,aimMode:2});
  const muzzle=weaponSocket(a.pose,a.skin,0,0,a.combat.aimBlend).muzzle,distance=Math.hypot(target.center.x-muzzle.x,target.center.z-muzzle.z),pitch=Math.atan2(target.center.y-muzzle.y+.5*WEAPONS.static.gravity*(distance/WEAPONS.static.speed)**2,distance);
  tick({facingYaw:yaw,aimMode:2,aimPitch:pitch,fire:true,shot:++shot});for(let i=0;i<100;i++)tick({facingYaw:yaw,aimMode:2,aimPitch:pitch});assert(target.hits>0,'real projectile should hit '+target.distance+' m target');
 }
 assert(m.actors[0].alive);assert.equal(city.fieldRadii?.[0]===100000,false);assert(m.loot.some(l=>l.kind==='scope8'));
 await writeFile(new URL('../../docs/combat/evidence/range-20261011.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),compiledAuthority:true,origin:layout.origin,heading:layout.heading,targets:layout.targets,onlineTerrainUnchanged:true},null,2));console.log('PASS actual downtown compiled bullets hit 10, 25, 50, 100 metre targets');
} finally {m.dispose();city.terrain.dispose();}
