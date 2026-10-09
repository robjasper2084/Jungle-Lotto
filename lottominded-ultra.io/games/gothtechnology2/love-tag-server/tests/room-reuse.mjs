import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Client} from '@colyseus/sdk';
const endpoint=process.env.TAG_ENDPOINT??'http://127.0.0.1:8225';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
for(const product of ['swoop-detroit','elmwood-explorer','swoop-detroit','elmwood-explorer']){
 const {fixture}=JSON.parse(await readFile(new URL('../fixtures/'+product+'.server.json',import.meta.url),'utf8'));
 const options={product,hash:fixture.hash,version:'heart-rush-1',ruleset:'classic',target:2,botFill:false};
 const sdk=new Client(endpoint,{headers:{Origin:'https://robjasper2084.github.io'}}),begun=performance.now();
 const room=await sdk.create('love-tag',options);let snapshot,code;
 room.onMessage('welcome',message=>{code=message.code;room.send('ready',{hash:fixture.hash});});
 room.onMessage('snapshot',message=>snapshot=message);room.onMessage('host',()=>{});room.send('hello',{});
 for(let i=0;i<100&&!code;i++)await delay(50);
 assert(code);assert(snapshot.actors.some(p=>p.id===room.sessionId));
 assert.equal((await fetch(endpoint+'/health')).status,200);
 await assert.rejects(sdk.create('love-tag',options),/TEST_SERVER_BUSY/);
 const elapsed=Math.round(performance.now()-begun);
 await room.leave();await delay(500);
 assert.equal((await fetch(endpoint+'/v1/room/'+code)).status,404);
 console.log(JSON.stringify({product,roomCreateAndHealthMs:elapsed,cleanExit:true}));
}
