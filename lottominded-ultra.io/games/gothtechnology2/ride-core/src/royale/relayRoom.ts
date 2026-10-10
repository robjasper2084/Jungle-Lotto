import {RealtimeClient,type RealtimeChannel} from '@supabase/realtime-js';
import {importKey,seal,open} from './relayCrypto.ts';
import {unpack} from './relayCodec.ts';
export type RelayConfig={endpoint:string;publishableKey:string;accessCode:string};
export type RelayTicket={id:string;key:string;topic:string;expires:number;ticket:unknown;serverTopic:string;project:string};
export class RelayRoom {
 sessionId='';reconnectionToken='';roomId='';
 private handlers=new Map<string,((data:any)=>void)[]>();private recent=new Map<string,unknown>();
 private errors:((code:number,message:string)=>void)[]=[];private leaves:(()=>void)[]=[];
 private client!:RealtimeClient;private channel!:RealtimeChannel;private key!:CryptoKey;private ticket!:RelayTicket;
 private seq=0;private received=0;private tail=Promise.resolve();private inputs:any[]=[];private closed=false;
 private timer?:ReturnType<typeof setInterval>;private lastReceived=Date.now();private lastPing=0;
 static async connect(config:RelayConfig,options:unknown){
  const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.accessCode},body:JSON.stringify({action:'ticket'})});
  const ticket=await response.json();if(!response.ok)throw Error(ticket.error??'Test relay unavailable');
  const room=new RelayRoom();await room.open(config,ticket,options);return room;
 }
 private async open(config:RelayConfig,ticket:RelayTicket,options:unknown){
  this.ticket=ticket;this.key=await importKey(ticket.key);
  this.client=new RealtimeClient(ticket.project+'/realtime/v1',{params:{apikey:config.publishableKey},heartbeatIntervalMs:15000});
  this.channel=this.client.channel(ticket.topic,{config:{broadcast:{ack:false,self:false}}});
  
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Supabase connection timed out')),12000);this.channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timeout);reject(Error('Supabase connection failed'));}});});
  const host=this.client.channel(ticket.serverTopic,{config:{broadcast:{ack:true}}});
  host.on('broadcast',{event:'batch'},({payload})=>{const mine=Array.isArray(payload)?payload.find(p=>p.id===ticket.id):undefined;if(mine)void this.receive(mine.payload);});
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Test worker unavailable')),12000);host.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(status==='CHANNEL_ERROR'){clearTimeout(timeout);reject(Error('Test worker channel unavailable'));}});});
  const established=new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Test worker did not answer')),15000);this.onMessage('connected',()=>this.send('connect',options));this.onMessage('joined',v=>{clearTimeout(timeout);this.sessionId=v.sessionId;this.roomId=v.roomId;this.reconnectionToken=v.reconnectionToken;resolve();});this.onError((_code,m)=>{clearTimeout(timeout);reject(Error(m));});});
  await host.send({type:'broadcast',event:'hello',payload:ticket.ticket});
  try{await established;}catch(e){this.close();throw e;}finally{/* Keep the shared download channel until leave. */}
  this.timer=setInterval(()=>{this.flush();if(Date.now()-this.lastReceived>12000){this.errors.forEach(f=>f(408,'Test worker disconnected. Use Reconnect.'));this.close();}else if(Date.now()-this.lastPing>2000){this.lastPing=Date.now();this.packet('ping',{});}},250);
 }
 private async receive(payload:unknown){try{const frame=await open(this.key,payload,'server:'+this.ticket.topic);if(!Number.isSafeInteger(frame.seq)||frame.seq<=this.received)return;this.received=frame.seq;this.lastReceived=Date.now();for(const p of unpack(frame.data)){if(p.type==='error'){this.errors.forEach(f=>f(400,p.data));return;}if(p.type==='closed'){this.close();return;}this.recent.set(p.type,p.data);this.handlers.get(p.type)?.forEach(f=>f(p.data));}}catch{/* Unauthenticated packets cannot affect a client. */}}
 onMessage(type:string,handler:(data:any)=>void){this.handlers.set(type,[...(this.handlers.get(type)??[]),handler]);if(this.recent.has(type))queueMicrotask(()=>handler(this.recent.get(type)));}
 onError(handler:(code:number,message:string)=>void){this.errors.push(handler);}
 onLeave(handler:()=>void){this.leaves.push(handler);}
 send(type:string,data:unknown){if(this.closed)return;if(type==='input'){this.inputs.push(data);if(this.inputs.length>=15)this.flush();}else {this.flush();this.packet(type,data);}}
 private flush(){if(!this.inputs.length)return;const batch=this.inputs.splice(0,15);this.packet('inputs',batch);}
 private packet(type:string,data:unknown){const seq=++this.seq;this.tail=this.tail.then(async()=>{if(this.closed)return;const payload=await seal(this.key,{seq,type,data},'client:'+this.ticket.topic);await this.channel.send({type:'broadcast',event:'up',payload});}).catch(()=>{});}
 async leave(){if(this.closed)return;this.send('leave',{});await this.tail;this.close();}
 private close(){if(this.closed)return;this.closed=true;clearInterval(this.timer);void this.client?.removeAllChannels();this.client?.disconnect();this.leaves.forEach(f=>f());}
}
