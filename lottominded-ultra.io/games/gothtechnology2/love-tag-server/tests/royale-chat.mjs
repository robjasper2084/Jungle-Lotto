import assert from 'node:assert/strict';
import {Client} from '@colyseus/sdk';
import {currentHandshake} from '@digital-static/ridecore/royale';
import {loadDowntown} from './downtown-fixture.mjs';
import {writeFile} from 'node:fs/promises';
process.env.TAG_TEST_IMPORT='1';
const {server}=await import(process.env.FPS_HOST_MODULE??'../dist/server.js');
await server.listen(8249,'127.0.0.1');
const terrain=await loadDowntown(),handshake=currentHandshake(terrain.arenaIdentity);terrain.terrain.dispose();
const rooms=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
const options={handshake,name:'Chat review',skin:'DS_Armored_Rider_01',botFill:true,matchSize:6};
function watch(room){rooms.push(room);const messages=[];room.onMessage('chat',m=>messages.push(m));for(const t of ['welcome','lobby','snapshot','voice-roster'])room.onMessage(t,()=>{});return {room,messages};}
try{
 const a=watch(await new Client('http://127.0.0.1:8249').create('static-royale',options));
 const b=watch(await new Client('http://127.0.0.1:8249').joinById(a.room.roomId,{...options,name:'Second rider'}));
 const separate=watch(await new Client('http://127.0.0.1:8249').create('static-royale',options));
 a.room.send('chat',{text:'Hello!',player:b.room.sessionId,name:'Forged name'});await sleep(300);
 assert.equal(a.messages.length,1);assert.equal(b.messages.length,1);assert.equal(separate.messages.length,0);
 assert.equal(b.messages[0].player,a.room.sessionId);assert.equal(b.messages[0].name,'Chat review');
 for(const text of ['x'.repeat(161),'bad\u202etext','', 'fast repeat'])a.room.send('chat',{text});await sleep(300);assert.equal(b.messages.length,1);
 await sleep(1000);a.room.send('chat',{text:'Ready!'});await sleep(300);assert.equal(b.messages.length,2);
 await writeFile('evidence/royale-chat-20261013.json',JSON.stringify({automatedClients:3,physicalHumans:0,lobbyChat:true,serverOwnedIdentity:true,separateRoomIsolation:true,lengthAndControlValidation:true,rateLimit:true},null,2));
 console.log('PASS: lobby delivery, authoritative identity, room isolation, bounded text and rate limit.');
}finally{for(const room of rooms)await room.leave().catch(()=>{});await server.gracefullyShutdown(false);}
