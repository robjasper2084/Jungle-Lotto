import {readFile} from 'node:fs/promises';
import {Client,type Room} from '@colyseus/sdk';
import {RealtimeClient,type RealtimeChannel} from '@supabase/realtime-js';
import {importKey,open,seal} from '../../ride-core/dist/royale/relayCrypto.js';
import {pack} from '../../ride-core/dist/royale/relayCodec.js';
type Ticket={id:string;key:string;topic:string;expires:number;issued:number};
type Link={ticket:Ticket;key:CryptoKey;channel:RealtimeChannel;room?:Room;seq:number;received:number;last:number;count:number;at:number;tail:Promise<void>;frames:{type:string;data:unknown}[]};
const config=JSON.parse(await readFile(new URL('../.royale-test-private/session.json',import.meta.url),'utf8'));
const local='http://127.0.0.1:8211';
async function heartbeat(){const r=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.workerToken},body:JSON.stringify({action:'worker'})});if(!r.ok)throw Error('Supabase worker authorization unavailable');return r.json();}
const auth=await heartbeat(),key=await importKey(auth.relay_key),links=new Map<string,Link>(),created=new Set<string>();
const realtime=new RealtimeClient(auth.project+'/realtime/v1',{params:{apikey:config.publishableKey},heartbeatIntervalMs:15000});
const host=realtime.channel(auth.relay_topic,{config:{broadcast:{ack:false}}});
function send(link:Link,type:string,data:unknown){if(link.frames.length>24)link.frames=link.frames.filter(p=>p.type!=='snapshot');link.frames.push({type,data});}
async function drop(link:Link,explicit=false){links.delete(link.ticket.id);if(link.room){if(explicit)await link.room.leave();else {link.room.reconnection.enabled=false;link.room.connection.close();}}void realtime.removeChannel(link.channel);}
async function command(link:Link,p:any){
 if(!Number.isSafeInteger(p.seq)||p.seq<=link.received)return;link.received=p.seq;link.last=Date.now();
 if(p.type==='connect'&&!link.room){
  const o=p.data;if(!o||!['create','join','reconnect'].includes(o.action))throw Error('Invalid join');
  const client=new Client(local);let room:Room;
  if(o.action==='create'){if(created.size>=1)throw Error('Test limited to one concurrent room');room=await client.create('static-royale',o.options);created.add(room.roomId);}
  else if(o.action==='reconnect')room=await client.reconnect(String(o.token));
  else{if(!/^[A-F0-9]{8}$/.test(o.code))throw Error('Invalid room code');const r=await fetch(local+'/v1/royale/'+o.code);if(!r.ok)throw Error('Room not found');room=await client.joinById((await r.json()).roomId,o.options);}
  link.room=room;room.reconnection.enabled=false;
  for(const type of ['welcome','lobby','snapshot','notice'])room.onMessage(type,data=>send(link,type,data));
  room.onError((_code,message)=>send(link,'error',message??'Room error'));room.onLeave(()=>{send(link,'closed',{});if(![...links.values()].some(l=>l!==link&&l.room?.roomId===room.roomId))created.delete(room.roomId);});
  send(link,'joined',{sessionId:room.sessionId,roomId:room.roomId,reconnectionToken:room.reconnectionToken});room.send('hello',{});return;
 }
 if(p.type==='ping')return;
 if(!link.room)return;
 if(p.type==='leave'){await drop(link,true);return;}
 if(p.type==='inputs'&&Array.isArray(p.data)&&p.data.length<=15){for(const input of p.data)link.room.send('input',input);return;}
 if(['hello','ready','start','rematch','release'].includes(p.type))link.room.send(p.type,p.data);
}
host.on('broadcast',{event:'hello'},({payload})=>{void (async()=>{
 try{const t=await open(key,payload,'royale-ticket-v1') as Ticket;if(t.expires<Date.now()||Date.now()-t.issued>60000||links.has(t.id)||links.size>=10)return;
  const channel=realtime.channel(t.topic,{config:{broadcast:{ack:false}}}),link:Link={ticket:t,key:await importKey(t.key),channel,seq:0,received:0,last:Date.now(),count:0,at:Date.now(),tail:Promise.resolve(),frames:[]};links.set(t.id,link);
  channel.on('broadcast',{event:'up'},({payload})=>{if(Date.now()-link.at>1000){link.at=Date.now();link.count=0;}if(++link.count>40)return;
   link.tail=link.tail.then(async()=>{try{await command(link,await open(link.key,payload,'client:'+t.topic));}catch{send(link,'error','Join or message rejected.');}});
  });
  channel.subscribe(status=>{if(status==='SUBSCRIBED')send(link,'connected',{});});
 }catch{/* Invalid tickets are never forwarded to the game server. */}
})();});
await new Promise<void>((resolve,reject)=>host.subscribe(s=>s==='SUBSCRIBED'?resolve():s==='CHANNEL_ERROR'?reject(Error('Realtime connection failed')):undefined));
console.log('Supabase encrypted test relay connected; simulation remains on 127.0.0.1:8211. Test expires '+auth.expires_at);
let sending=false;const batchTimer=setInterval(()=>{if(sending||host.state!=='joined')return;sending=true;void (async()=>{try{const batch=[];for(const link of links.values()){if(!link.frames.length)continue;const data=pack(link.frames.splice(0));batch.push({id:link.ticket.id,payload:await seal(link.key,{seq:++link.seq,data},'server:'+link.ticket.topic)});}if(batch.length)await host.send({type:'broadcast',event:'batch',payload:batch});}finally{sending=false;}})();},250);
const timer=setInterval(()=>{for(const link of links.values())if(Date.now()-link.last>5000||link.ticket.expires<Date.now())void drop(link);},1000);
const beat=setInterval(()=>void heartbeat().catch(()=>{console.error('Test lease expired or unavailable. Closing relay.');void stop();}),15000);
async function stop(){clearInterval(timer);clearInterval(beat);clearInterval(batchTimer);for(const link of links.values())await drop(link);await realtime.removeAllChannels();realtime.disconnect();process.exit(0);}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
