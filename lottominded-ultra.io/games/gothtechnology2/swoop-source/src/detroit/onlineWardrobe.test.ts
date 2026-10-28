import test from 'node:test';
import assert from 'node:assert/strict';
import * as swoop from './onlineProtocol.ts';
import * as elmwood from '../../../elmwood-source/src/detroit/onlineProtocol.ts';
import {WARDROBE_CHOICES} from '../../../ride-core/src/riderWardrobe.ts';

for(const [map,protocol]of [['cut',swoop],['elmwood',elmwood]] as const){
 test(map+' preserves every suit through presence, roster ordering and match launch',()=>{
  for(const {id:rider}of WARDROBE_CHOICES){
   const members=Array.from({length:4},(_,i)=>({id:'00000000-0000-0000-0000-'+String(i).padStart(12,'0'),rider,joined:i,host:i===3}));
   const validated=members.map(m=>protocol.roomMember(JSON.parse(JSON.stringify(m)))!);
   assert.ok(validated.every(Boolean));
   const owner=members[3].id,roster=protocol.roomRoster(validated,owner);
   assert.equal(roster[0].id,owner);assert.deepEqual(roster.map(m=>m.rider),Array(4).fill(rider));
   const match={id:'00000000-0000-0000-0000-000000000010',owner,members:roster,mode:'free',spawn:0,seed:1,startAt:Date.now()+3000,map};
   assert.deepEqual(protocol.roomMatch(JSON.parse(JSON.stringify(match)),roster,owner,map,['free'])?.members.map(m=>m.rider),Array(4).fill(rider));
   assert.equal(members[0].rider,rider);
  }
 });
}
