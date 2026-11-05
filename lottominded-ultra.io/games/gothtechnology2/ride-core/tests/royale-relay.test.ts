import test from 'node:test';
import assert from 'node:assert/strict';
import {randomKey,importKey,seal,open} from '../src/royale/relayCrypto.ts';
import {pack,unpack} from '../src/royale/relayCodec.ts';
test('relay data is private to its client, direction-bound and tamper resistant',async()=>{
 const key=await importKey(randomKey()),other=await importKey(randomKey()),frame={seq:1,type:'snapshot',data:{integrity:42}};
 const packet=await seal(key,frame,'server:one');assert.deepEqual(await open(key,packet,'server:one'),frame);
 await assert.rejects(open(other,packet,'server:one'));await assert.rejects(open(key,packet,'client:one'));await assert.rejects(open(key,{...packet,data:'AAAA'+packet.data.slice(4)},'server:one'));
});
test('snapshot batches preserve every authoritative frame through compression',()=>{
 const frames=Array.from({length:5},(_,i)=>({type:'snapshot',data:{tick:i*3,actors:[],self:{ack:i*3}}}));assert.deepEqual(unpack(pack(frames)),frames);
});
