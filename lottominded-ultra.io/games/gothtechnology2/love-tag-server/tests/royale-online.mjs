import assert from 'node:assert/strict';
import {Client} from '@colyseus/sdk';
import {HANDSHAKE,neutral} from '@digital-static/ridecore/royale';
import {writeFile,mkdir} from 'node:fs/promises';
const endpoint=process.env.ROYALE_ENDPOINT??'http://127.0.0.1:8211',evidence=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,limit=10000){for(let n=0;n<limit/50;n++){if(fn())return;await pause(50);}throw Error('Timed out: '+label);}
function watch(room){const state={room,snapshot:null,welcome:null,lobby:null,notices:[]};room.onMessage('snapshot',s=>state.snapshot=s);room.onMessage('welcome',s=>state.welcome=s);room.onMessage('lobby',s=>state.lobby=s);room.onMessage('notice',s=>state.notices.push(s));room.send('hello',{});return state;}
const options={handshake:HANDSHAKE,name:'Connection 1',skin:'DS_Man_01',botFill:false};
let live=[];
try{
 const first=watch(await new Client(endpoint).create('static-royale',options));live.push(first);
 await until(()=>first.welcome,'welcome');
 const code=first.welcome.code,lookup=await fetch(endpoint+'/v1/royale/'+code).then(r=>r.json());assert.equal(lookup.roomId,first.room.roomId);
 first.room.send('ready',HANDSHAKE);first.room.send('start',{});await pause(200);assert.equal(first.snapshot.phase,'lobby');assert(first.notices.some(n=>n.includes('six')));
 for(let i=1;i<6;i++){const r=watch(await new Client(endpoint).joinById(lookup.roomId,{...options,name:'Connection '+(i+1)}));live.push(r);r.room.send('ready',HANDSHAKE);}
 await assert.rejects(new Client(endpoint).joinById(lookup.roomId,options),/SIX_COMBATANTS_ONLY/);
 await assert.rejects(new Client(endpoint).joinById(lookup.roomId,{...options,handshake:{...HANDSHAKE,physics:'wrong'}}),/INCOMPATIBLE_ARENA/);
 await pause(250);first.room.send('start',{});
 await until(()=>live.every(c=>c.snapshot?.phase==='active'),'all six active');
 assert(live.every(c=>c.snapshot.roster.length===6&&c.snapshot.roster.every(a=>!a.bot)));
 assert.equal(new Set(live.map(c=>c.snapshot.round)).size,1);
 const before=live.map(c=>c.snapshot.self.controller.fields.pose);
 for(let seq=1;seq<=90;seq++){for(const c of live)c.room.send('input',{...neutral(c.snapshot.round,seq,c.snapshot.tick),throttle:1,steer:.08});await pause(17);}
 await pause(200);
 for(let i=0;i<6;i++){const p=live[i].snapshot.self.controller.fields.pose;assert(Math.hypot(p.x-before[i].x,p.z-before[i].z)>1);}
 const seventh=watch(await new Client(endpoint).joinById(lookup.roomId,{...options,name:'Late observer'}));await until(()=>seventh.snapshot,'late spectator');assert.equal(seventh.welcome.spectator,true);assert.equal(seventh.snapshot.actors.length,0);assert.equal(seventh.snapshot.self,undefined);seventh.room.send('input',{...neutral(first.snapshot.round,1,first.snapshot.tick),throttle:1,fire:true,shot:1});await seventh.room.leave();
 const old=live[1],oldId=old.room.sessionId,token=old.room.reconnectionToken,ammo=old.snapshot.self.ammo,integrity=old.snapshot.self.integrity;old.room.reconnection.enabled=false;old.room.connection.close();await pause(1000);
 const returned=watch(await new Client(endpoint).reconnect(token));live[1]=returned;await until(()=>returned.snapshot?.self,'reconnect');assert.equal(returned.room.sessionId,oldId);assert.deepEqual(returned.snapshot.self.ammo,ammo);assert(returned.snapshot.self.integrity<=integrity);
 const tick=live[2].snapshot.tick;await first.room.leave();live.shift();await pause(500);assert(live[1].snapshot.tick>tick);
 evidence.push({test:'six independent SDK clients on loopback',humanParticipants:0,connections:6,exactSlots:true,seventhRejected:true,incompatibleRejected:true,independentMovement:true,lateJoinSpectates:true,reconnectSameEntity:true,roomOwnerDepartureSurvives:true,room:code});
 for(const c of live)await c.room.leave();live=[];
 for(const humans of [1,2,3,4,5,6]){
  const a=watch(await new Client(endpoint).create('static-royale',{...options,botFill:true}));live.push(a);await until(()=>a.welcome,'mixed welcome');
  for(let i=1;i<humans;i++)live.push(watch(await new Client(endpoint).joinById(a.room.roomId,{...options,name:'Mixed '+i})));
  for(const c of live)c.room.send('ready',HANDSHAKE);await pause(200);a.room.send('start',{});await until(()=>a.snapshot?.phase==='deployment','mixed deployment');
  assert.equal(a.snapshot.roster.length,6);assert.equal(a.snapshot.roster.filter(x=>x.bot).length,6-humans);evidence.push({test:'mixed room',connections:humans,bots:6-humans});
  for(const c of live)await c.room.leave();live=[];
 }
 await mkdir('evidence',{recursive:true});await writeFile('evidence/royale-local-20261009.json',JSON.stringify({date:new Date().toISOString(),endpoint,hostedInternet:false,physicalHumans:0,evidence},null,2));console.log(JSON.stringify(evidence,null,2));
}finally{for(const c of live)await c.room.leave();}
