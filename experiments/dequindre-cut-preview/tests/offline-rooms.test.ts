import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BelleOnlineRooms,type OfflineRoomHooks} from '../src/offlineRooms.ts';

test('room adapter stays offline with no socket, fetch, timer, or remote side effects',async t=>{
 const unexpected=(name:string)=>()=>{throw Error('Offline preview attempted '+name);};
 for(const name of ['fetch','WebSocket','setInterval'] as const)t.mock.method(globalThis,name,unexpected(name));
 const calls:string[]=[];
 const hooks:OfflineRoomHooks={
  race:()=>{throw Error('Remote race received');},raceOpen:()=>calls.push('raceOpen'),
  clear:()=>calls.push('clear'),ride:()=>calls.push('ride'),
  sky:()=>({hour:12,cycle:false,dayMinutes:20,clouds:'clear'}),
  syncSky:()=>{throw Error('Remote sky received');},localSky:()=>calls.push('localSky'),
  skyHost:host=>calls.push('skyHost:'+host),follow:()=>{throw Error('Remote avatar followed');},
 };
 const rooms=new BelleOnlineRooms(hooks);
 const state=()=>({online:rooms.online,sessionActive:rooms.sessionActive,isHost:rooms.isHost,hostId:rooms.hostId,members:rooms.members.length,buffers:rooms.buffers.size});
 const expected={online:false,sessionActive:false,isHost:false,hostId:'',members:0,buffers:0};
 assert.deepEqual(state(),expected);
 rooms.open();rooms.sendRace({type:'plan',room:'production-room'});
 rooms.update({pose:{x:1,y:2,z:3} as Parameters<typeof rooms.update>[0]['pose'],mode:'ride',seat:0,active:true});
 await rooms.leave();await rooms.leave(false,true);
 assert.deepEqual(state(),expected);
 assert.ok(calls.includes('localSky'));assert.ok(calls.includes('skyHost:true'));
 assert.equal(calls.includes('ride'),false);assert.equal(calls.includes('raceOpen'),false);
 assert.equal(rooms.inputBlocked,false);
});

test('room adapter has no runtime production imports or invitation/voice capability',async()=>{
 const source=await readFile(new URL('../src/offlineRooms.ts',import.meta.url),'utf8');
 for(const line of source.split('\n').filter(line=>/^import\b/.test(line)))assert.match(line,/^import type /);
 assert.doesNotMatch(source,/\b(?:RealtimeClient|WebSocket|fetch|setInterval|VoiceChat|parseRoomInvitation|getUserMedia)\s*\(/);
 assert.match(source,/Explore solo, use local co-op, or start an offline race/);
 assert.match(source,/\['friends-open','welcome-friends'\]/);
});
