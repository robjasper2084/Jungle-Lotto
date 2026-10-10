import {EngineContext,engineReady} from './engine/runtime.ts';
import {routeBattleInput} from './engine/royaleKernel.ts';
import {Client,type Room} from '@colyseus/sdk';
import {RelayRoom,type RelayConfig} from './royale/relayRoom.ts';
import {RideController} from './controller.ts';
import {VoiceChat} from './voiceChat.ts';
import {ConnectionHealth} from './royale/connectionHealth.ts';
import type {BattleTerrain} from './royale/battleTerrain.ts';
import {currentHandshake,compatible} from './royale/arena.ts';
import {RoyaleMatch,move,BATTLE_HANDLING,type Command,type Motion,type RoyaleSnapshot} from './royale/rules.ts';
export class RoyaleSession{
 readonly voice=typeof document==='undefined'?undefined:new VoiceChat();
 match?:RoyaleMatch;room?:Room|RelayRoom;state?:RoyaleSnapshot;previous?:RoyaleSnapshot;received=0;me='local';host='';code='';seq=0;shot=0;prediction?:Motion;pending:Command[]=[];ready:string[]=[];botFill=false;message='';relayConfig?:RelayConfig;
 private sdk?:Client;private round='';private disposed=false;private predictionInput?:EngineContext;private connection=new ConnectionHealth();
 connectionStatus(now=performance.now()){return this.connection.status(now,this.pending.length);}
 constructor(readonly terrain:BattleTerrain){}
 offline(skin:string,wheelId='euc',size:6|10=6,botChase=true){this.leave();this.disposed=false;this.me='local';this.match=new RoyaleMatch(this.terrain,undefined,size,botChase);this.match.add(this.me,'You',false,skin,wheelId);for(let i=0;i<size-1;i++)this.match.add('ai-'+i,'AI '+(i+1),true,skin,wheelId);this.match.start(crypto.randomUUID(),Date.now()%5);this.accept(this.match.snapshot(this.me));}
 async online(endpoint:string,create:boolean,code:string,name:string,skin:string,botFill:boolean,spectate=false,wheelId='euc',matchSize:6|10=6,botChase=true){
  this.leave();this.disposed=false;const url=new URL(endpoint);if(!['https:','http:','wss:','ws:'].includes(url.protocol)||url.username||url.password)throw Error('Use the server HTTPS address.');
  if(url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Internet rooms need an HTTPS server.');
  this.sdk=new Client(endpoint);const options={handshake:currentHandshake(this.terrain.arenaIdentity),name,skin,botFill,spectate,wheelId,matchSize,botChase};
  if(create)this.bind(await this.sdk.create('static-royale',options),endpoint);
  else{if(!/^[A-Fa-f0-9]{8}$/.test(code))throw Error('Enter the 8-character room code.');const base=endpoint.replace(/^ws/,'http').replace(/\/$/,'');const result=await fetch(base+'/v1/royale/'+code.toUpperCase());if(!result.ok)throw Error('Room not found or expired.');const data=await result.json();this.bind(await this.sdk.joinById(data.roomId,options),endpoint);}
 }
 async supabase(config:RelayConfig,create:boolean,code:string,name:string,skin:string,botFill:boolean,spectate=false,wheelId='euc',matchSize:6|10=6,botChase=true){this.leave();this.disposed=false;this.relayConfig=config;const room=await RelayRoom.connect(config,{action:create?'create':'join',code:code.toUpperCase(),options:{handshake:currentHandshake(this.terrain.arenaIdentity),name,skin,botFill,spectate,wheelId,matchSize,botChase}});this.bind(room,config.endpoint);}
 private bind(room:Room|RelayRoom,endpoint:string){this.room=room;this.pending=[];this.connection.bind();this.message='';const current=()=>!this.disposed&&this.room===room;this.me=room.sessionId;this.voice?.bind(this.me,{state:(enabled,channel)=>room.send('voice-state',{enabled,channel}),signal:signal=>room.send('voice-signal',signal)});room.onMessage('voice-roster',members=>{if(current())this.voice?.setMembers(members);});room.onMessage('voice-signal',v=>{if(current())this.voice?.receive(v.from,v.signal);});room.onMessage('welcome',w=>{if(!current())return;if(!compatible(w.handshake,this.terrain.arenaIdentity)){this.leave();this.message='The server engine or map version does not match this game.';return;}this.host=w.host;this.code=w.code;this.botFill=w.botFill;this.message=w.spectator?'Spectating · live opponent positions stay private.':'Room '+w.code;});
  room.onMessage('lobby',l=>{if(!current())return;this.host=l.host;this.ready=l.ready;this.botFill=l.botFill;});room.onMessage('snapshot',s=>{if(current())this.accept(s);});room.onMessage('notice',n=>{if(current())this.message=String(n);});room.onError((_code,message)=>{if(current())this.connection.fail(message||'Connection error. Open connection options to reconnect.');});room.onLeave(()=>{if(!current())return;this.voice?.disconnect();this.connection.fail();});
  try{sessionStorage.setItem('static-royale-reconnect',JSON.stringify({endpoint,token:room.reconnectionToken}));}catch{}room.send('hello',{});
 }
 async reconnect(){const saved=JSON.parse(sessionStorage.getItem('static-royale-reconnect')??'null');if(!saved)throw Error('No reconnect session on this device.');this.disposed=false;this.connection.retry();try{if(this.relayConfig){this.bind(await RelayRoom.connect(this.relayConfig,{action:'reconnect',token:saved.token}),saved.endpoint);return;}this.sdk=new Client(saved.endpoint);this.bind(await this.sdk.reconnect(saved.token),saved.endpoint);}catch(error){this.connection.fail('Reconnect failed. Check the connection or leave and join a new room.');throw error;}}
 readyUp(){this.room?.send('ready',currentHandshake(this.terrain.arenaIdentity));}
 start(){if(this.room)this.room.send(this.state?.phase==='results'?'rematch':'start',{});else if(this.match){this.match.start(crypto.randomUUID(),Date.now()%5);this.accept(this.match.snapshot(this.me));}}
 release(){this.room?.send('release',{});this.match?.release(this.me);this.predictionInput?.clear();}
 private accept(s:RoyaleSnapshot){if(this.disposed)return;this.previous=this.state;this.state=s;this.received=performance.now();if(this.room)this.connection.snapshot(this.received);
  if(s.round!==this.round){this.round=s.round;this.seq=0;this.shot=0;this.pending=[];}
  if(!this.room||!s.self)return;
  if(!this.prediction)this.prediction={wheelId:s.self.wheelId,controller:new RideController(this.terrain,{tuning:BATTLE_HANDLING}),energy:100,burstUntil:0,burstLatch:false};
  if(engineReady()&&!this.predictionInput)this.predictionInput=new EngineContext();this.prediction.controller.restoreState(s.self.controller);this.prediction.energy=s.self.energy;this.prediction.burstUntil=s.self.burstUntil;this.prediction.burstLatch=s.self.burstLatch;this.seq=Math.max(this.seq,s.self.ack,s.self.inputCursor??0);this.shot=Math.max(this.shot,s.self.shotCursor??0);
  this.pending=this.pending.filter(c=>c.round===s.round&&c.seq>s.self!.ack);
  for(let i=0;i<this.pending.length;i++)move(this.prediction,this.predictionInput?routeBattleInput(this.predictionInput,0,this.pending[i]):this.pending[i],s.tick+i+1);
 }
 step(input:Command){if(!this.state||!['active','deployment'].includes(this.state.phase))return;
  if(this.room&&(this.pending.length>=150||this.connectionStatus().state==='disconnected'||this.connectionStatus().state==='reconnecting'))return;
  const c={...input,round:this.state.round,seq:++this.seq,tick:this.state.tick};if(c.fire)c.shot=++this.shot;else c.shot=this.shot;
  if(this.match){this.match.command(this.me,c);this.match.step();this.accept(this.match.snapshot(this.me));}
  else if(this.room&&this.state.self?.alive){this.pending.push(c);this.room.send('input',c);if(this.prediction)move(this.prediction,this.predictionInput?routeBattleInput(this.predictionInput,0,c):c,this.state.tick+this.pending.length);}
 }
 leave(){this.voice?.disconnect();this.disposed=true;this.room?.leave();this.room=undefined;this.match?.dispose();this.match=undefined;this.state=this.previous=undefined;this.prediction=undefined;this.predictionInput?.dispose();this.predictionInput=undefined;this.pending=[];this.round='';this.seq=this.shot=0;this.host=this.code='';this.ready=[];this.connection.reset();this.message='';this.relayConfig=undefined;}
}



