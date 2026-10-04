import assert from 'node:assert/strict';
import {Client} from '@colyseus/sdk';
import {readFile,writeFile} from 'node:fs/promises';
import {cleanChatText,ChatRateGate} from '@digital-static/ridecore/chat';
const endpoint=process.env.TAG_ENDPOINT??'http://127.0.0.1:8211',sleep=ms=>new Promise(r=>setTimeout(r,ms)),evidence=[];
assert.equal(cleanChatText(' hello '),'hello');
for(const text of ['', 'x'.repeat(161), 'bad\u202e', '<script>\n'])assert.equal(cleanChatText(text),undefined);
assert.equal(cleanChatText('<img src=x onerror=alert(1)>'),'<img src=x onerror=alert(1)>'); // Rendered with text nodes.
const gate=new ChatRateGate();assert(gate.allow('a',0));assert(!gate.allow('a',1199));assert(gate.allow('b',0));assert(gate.allow('a',1200));gate.forget('a');assert(gate.allow('a',1201));
for(const product of ['swoop-detroit','elmwood-explorer']){
 const fixture=JSON.parse(await readFile(new URL('../fixtures/'+product+'.json',import.meta.url),'utf8'));
 const options={product,version:'heart-rush-1',hash:fixture.hash,ruleset:'classic',target:2,botFill:false,name:'Host'};
 const a=await new Client(endpoint).create('love-tag',options),b=await new Client(endpoint).joinById(a.roomId,{...options,name:'Guest'}),other=await new Client(endpoint).create('love-tag',options);
 const receivedA=[],receivedB=[],receivedOther=[];for(const [room,items]of [[a,receivedA],[b,receivedB],[other,receivedOther]]){room.onMessage('chat',m=>items.push(m));for(const kind of ['snapshot','welcome','host','notice'])room.onMessage(kind,()=>{});}
 await sleep(150);a.send('chat',{text:'Hello room',player:b.sessionId,name:'Spoofed identity'});await sleep(180);
 assert.equal(receivedA.length,1);assert.equal(receivedB.length,1);assert.equal(receivedB[0].player,a.sessionId);assert.equal(receivedB[0].name,'Host');assert.equal(receivedOther.length,0);
 a.send('chat',{text:'Too fast'});a.send('chat',{text:'x'.repeat(161)});b.send('chat',{text:'Hi host'});await sleep(180);assert.equal(receivedA.length,2);assert.equal(receivedB.length,2);assert.equal(receivedA[1].player,b.sessionId);
 await sleep(1100);a.send('chat',{text:'<img src=x onerror=alert(1)>'});await sleep(180);assert.equal(receivedB.at(-1).text,'<img src=x onerror=alert(1)>');assert.equal(receivedOther.length,0);
 await b.leave();await a.leave();await other.leave();evidence.push({product,humans:2,actualServer:true,roomIsolation:true,serverIdentity:true,rateLimit:true,textOnlyPayload:true,cleanLeave:true});console.log('PASS chat '+product);
}
await writeFile(new URL('../../docs/love-tag/evidence/multiplayer-chat-20261004.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),scope:'Loopback real Colyseus SDK clients, not browser or hosted evidence',evidence},null,2));
