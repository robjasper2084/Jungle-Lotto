import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {RelayRoom} from '../../ride-core/dist/royale/relayRoom.js';
import {HANDSHAKE} from '../../ride-core/dist/royale/arena.js';
import {neutral} from '../../ride-core/dist/royale/rules.js';
const config=JSON.parse(await readFile('.royale-test-private/session.json','utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){const at=Date.now();while(!fn()){if(Date.now()-at>20000)throw Error(label);await sleep(100);}}
let room,state,ready;
try{
 room=await RelayRoom.connect(config,{action:'create',options:{handshake:HANDSHAKE,name:'Reconnect test',skin:'DS_Man_01',botFill:true}});
 room.onMessage('snapshot',s=>state=s);room.onMessage('lobby',s=>ready=s.ready);
 room.send('ready',HANDSHAKE);await until(()=>ready?.length===1,'ready');room.send('start',{});
 await until(()=>state?.phase==='active','active');
 room.send('input',{...neutral(state.round,1,state.tick),fire:true,shot:1});await until(()=>state.self.ammo.static===79,'ammo consumed');
 const original={id:room.sessionId,token:room.reconnectionToken,health:state.self.integrity,ammo:state.self.ammo.static};
 room.close();await sleep(8000);state=undefined;
 room=await RelayRoom.connect(config,{action:'reconnect',token:original.token});room.onMessage('snapshot',s=>state=s);await until(()=>state?.self,'reconnect snapshot');
 assert.equal(room.sessionId,original.id);assert.equal(state.self.ammo.static,original.ammo);assert(state.self.integrity<=original.health);
 const result={date:new Date().toISOString(),transport:'Supabase',sameEntity:true,noAmmoRefill:true,noHealing:true,physicalHumans:0};
 await writeFile('evidence/royale-supabase-reconnect-20261009.json',JSON.stringify(result,null,2));console.log(result);
}finally{await room?.leave();}
