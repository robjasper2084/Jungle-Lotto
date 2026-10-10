import assert from 'node:assert/strict';import {Client} from '@colyseus/sdk';import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {initializeEngine,currentHandshake,neutral,ENGINE_ID} from '@digital-static/ridecore/royale';import {loadDowntown} from './downtown-fixture.mjs';
await initializeEngine(await readFile(new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)));const terrain=await loadDowntown(),handshake=currentHandshake(terrain.arenaIdentity);assert.equal(terrain.spawns.length,10);assert(terrain.supplies.length>50);assert(terrain.optics.length>=42);terrain.terrain.dispose();
const endpoint=process.env.ROYALE_ENDPOINT??'http://127.0.0.1:8230',live=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,name){const end=Date.now()+20000;while(Date.now()<end){if(fn())return;await wait(40);}throw Error('Timed out '+name);}
function watch(room){const w={room,s:null,hello:null};room.onMessage('snapshot',s=>w.s=s);room.onMessage('welcome',h=>w.hello=h);room.onMessage('lobby',()=>{});room.onMessage('voice-roster',()=>{});room.send('hello',{});return w;}
const opts={handshake,name:'Network review',skin:'DS_Armored_Rider_01',botFill:false,matchSize:10,botChase:true};const evidence=[];
try{
 const first=watch(await new Client(endpoint).create('static-royale',opts));live.push(first);await until(()=>first.hello,'welcome');
 for(let i=1;i<10;i++)live.push(watch(await new Client(endpoint).joinById(first.room.roomId,{...opts,name:'Review '+i})));
 await assert.rejects(new Client(endpoint).joinById(first.room.roomId,opts),/ROOM_COMBATANTS_FULL/);
 for(const w of live)w.room.send('ready',handshake);await wait(200);first.room.send('start',{});await until(()=>live.every(w=>w.s?.phase==='active'),'ten active');
 assert(live.every(w=>w.s.roster.length===10&&w.s.size===10&&w.s.engine.module===ENGINE_ID.module));const before=live.map(w=>w.s.self.controller.fields.pose);
 for(let seq=1;seq<=30;seq++){for(const w of live)w.room.send('input',{...neutral(w.s.round,seq,w.s.tick),throttle:1,steer:.03});await wait(17);}await wait(200);
 assert(live.every((w,i)=>Math.hypot(w.s.self.controller.fields.pose.x-before[i].x,w.s.self.controller.fields.pose.z-before[i].z)>.5));
 const old=live[9],id=old.room.sessionId,token=old.room.reconnectionToken,ammo=old.s.self.ammo,dog=old.s.self.dogPower;old.room.reconnection.enabled=false;old.room.connection.close();await wait(500);const returned=watch(await new Client(endpoint).reconnect(token));live[9]=returned;await until(()=>returned.s?.self,'restore tenth');assert.equal(returned.room.sessionId,id);assert.deepEqual(returned.s.self.ammo,ammo);assert.equal(returned.s.self.dogPower.charges,dog.charges);
 evidence.push({scenario:'10 independent network clients',physicalHumans:0,module:ENGINE_ID.module,tenRoster:true,eleventhRejected:true,allMoved:true,tenthReconnect:true});
 for(const w of live)await w.room.leave();live.length=0;
 for(const humans of [1,4]){const a=watch(await new Client(endpoint).create('static-royale',{...opts,botFill:true}));live.push(a);await until(()=>a.hello,'fill welcome');for(let i=1;i<humans;i++)live.push(watch(await new Client(endpoint).joinById(a.room.roomId,opts)));for(const w of live)w.room.send('ready',handshake);await wait(200);a.room.send('start',{});await until(()=>a.s?.phase==='deployment','fill started');assert.equal(a.s.roster.filter(r=>r.bot).length,10-humans);evidence.push({scenario:'AI fill',networkClients:humans,bots:10-humans});for(const w of live)await w.room.leave();live.length=0;}
 await mkdir('evidence',{recursive:true});await writeFile('evidence/royale-ten-20261010.json',JSON.stringify({endpoint,physicalHumans:0,hostedInternet:false,evidence},null,2));console.log(JSON.stringify(evidence));
}finally{for(const w of live)await w.room.leave();}
