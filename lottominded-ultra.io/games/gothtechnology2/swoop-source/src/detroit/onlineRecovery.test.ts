import test from 'node:test';
import assert from 'node:assert/strict';
import {OnlineRooms} from './onlineRooms.ts';
import {ElmwoodOnlineRooms} from '../../../elmwood-source/src/detroit/onlineRooms.ts';
import {ROOM_PROTOCOL as swoopProtocol} from './onlineProtocol.ts';
import {ROOM_PROTOCOL as elmwoodProtocol} from '../../../elmwood-source/src/detroit/onlineProtocol.ts';
import {NEUTRAL_ACTIONS} from './controller.ts';

// Exercise the real packet validation and host input consumption, without opening
// a public room or turning on a microphone. This is not a network delivery test.
for(const [name,Room,protocol] of [['Swoop',OnlineRooms,swoopProtocol],['Elmwood',ElmwoodOnlineRooms,elmwoodProtocol]] as const){
 test(name+' guest Recover survives the following movement packet, affects only its seat, and consumes once',()=>{
  const room=Object.create(Room.prototype) as any;
  Object.assign(room,{self:'host',owner:'host',connected:true,pending:new Map(),match:{id:'match',owner:'host',members:[{id:'host'},{id:'guest'},{id:'other'}]}});
  Object.defineProperty(room,'healthy',{value:true});
  const receive=(sender:string,id:string,seq:number,reset:boolean)=>room.receiveInput({protocol,sender,data:{id,match:'match',seq,actions:{...NEUTRAL_ACTIONS,reset}}});
  receive('guest','guest',1,true);receive('guest','guest',2,false);
  receive('guest','other',3,true); // A guest cannot recover another rider.
  const first=room.inputs({...NEUTRAL_ACTIONS,throttle:1});
  assert.deepEqual(first.map((a:any)=>a.reset),[false,true,false]);assert.equal(first[0].throttle,1);
  assert.deepEqual(room.inputs(NEUTRAL_ACTIONS).map((a:any)=>a.reset),[false,false,false]);
  receive('guest','guest',1,true); // A replayed packet cannot produce another reset.
  assert.equal(room.inputs(NEUTRAL_ACTIONS)[1].reset,false);
 });
}
