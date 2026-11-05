import {Client,type Room} from '@colyseus/sdk';
import {voiceIce,DEFAULT_VOICE_ICE} from './voiceIce.ts';

/** Uses a bounded guest seat, with the same public origin policy as game rooms.
 * Closing the game room also releases its voice credential seat. */
export class RoomVoiceLease{
 private room?:Room;private generation=0;private refresh?:ReturnType<typeof setInterval>;
 private pending=false;private retryAt=0;private endpoint='';
 private ice:(value:RTCIceServer[])=>void;private status:(text:string)=>void;
 constructor(ice:(value:RTCIceServer[])=>void,status:(text:string)=>void){this.ice=ice;this.status=status;}
 async connect(endpoint:string){
  if(this.room&&endpoint===this.endpoint)return;
  if(this.pending||Date.now()<this.retryAt)return;
  let url:URL;
  try{url=new URL(endpoint);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error();}
  catch{this.status('Direct voice · relay not configured');return;}
  this.disconnect();this.endpoint=endpoint;this.pending=true;const generation=this.generation;
  this.status('Connecting voice relay…');
  try{
   const client=new Client(endpoint);let timedOut=false;
   const joining=client.joinOrCreate('voice-relay');
   // A late join must release its server seat after the UI has moved on.
   void joining.then(room=>{if(timedOut||generation!==this.generation)void room.leave();},()=>{});
   let timer:ReturnType<typeof setTimeout>|undefined;
   let room:Room;
   try{room=await Promise.race([joining,new Promise<never>((_,reject)=>{timer=setTimeout(()=>{timedOut=true;reject(Error('Voice host timeout'));},12000);})]);}
   finally{clearTimeout(timer);}
   if(generation!==this.generation){void room.leave();return;}
   this.room=room;room.reconnection.enabled=false;
   room.onMessage('voice-ice',body=>{
    if(generation!==this.generation)return;
    const servers=voiceIce(body?.iceServers);if(!servers)return;
    this.ice(servers);this.status(body.relay?'Voice relay configured':'Direct voice · relay unavailable');
   });
   room.onLeave(()=>{if(generation===this.generation){this.disconnect();this.retryAt=Date.now()+30_000;this.ice(DEFAULT_VOICE_ICE);this.status('Direct voice · reconnecting relay');}});
   room.send('refresh');
   this.refresh=setInterval(()=>room.send('refresh'),10*60_000);
  }catch{if(generation===this.generation){this.retryAt=Date.now()+30_000;this.status('Direct voice · relay unavailable; retry connection');}}
  finally{if(generation===this.generation)this.pending=false;}
 }
 disconnect(){this.generation++;this.pending=false;clearInterval(this.refresh);this.refresh=undefined;const room=this.room;this.room=undefined;if(room)void room.leave();}
}
