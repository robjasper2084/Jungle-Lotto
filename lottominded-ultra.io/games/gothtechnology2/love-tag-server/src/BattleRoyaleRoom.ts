import {Room,ServerError,type Client,type AuthContext} from '@colyseus/core';
import {DowntownArena,RoyaleMatch,currentHandshake,compatible,initializeEngine,wheelProfile} from '@digital-static/ridecore/royale';
import {TagTerrain} from '@digital-static/ridecore/tag';
import {loadHostFixture} from './hostFixture.js';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {RoyaleClock} from './royaleClock.js';
import {voiceChannel,voiceSignal,voiceRecipient,type VoiceChannel,type VoiceMember} from '@digital-static/ridecore/voice-protocol';
export const royaleCodes=new Map<string,{roomId:string;expires:number}>();
const origins=(process.env.ALLOWED_ORIGINS??'').split(',').filter(Boolean);
let engineLoad:Promise<unknown>|undefined;
// Every room reads the same immutable canonical city. Actors remain room-local.
let downtownLoad:Promise<DowntownArena>|undefined;
function downtown(){return downtownLoad??=(async()=>{
 const data=await loadHostFixture(fileURLToPath(new URL('../fixtures/',import.meta.url)),'swoop-detroit');
 return new DowntownArena(await TagTerrain.create(data.fixture,await data.physics()));
})().catch(error=>{downtownLoad=undefined;throw error;});}
export class BattleRoyaleRoom extends Room{
 maxClients=14;private size:6|10=10;private match!:RoyaleMatch;private terrain!:DowntownArena;private host='';private code='';private botFill=false;private botCount=-1;
 private ready=new Set<string>();private spectators=new Set<string>();private rates=new Map<string,{at:number;n:number}>();private battleClock=new RoyaleClock();private failed=false;private telemetryAt=0;private sendClock=0;private born=Date.now();
 private voices=new Map<string,VoiceChannel>();private voiceRates=new Map<string,{at:number;n:number}>();
 private voiceMembers():VoiceMember[]{return this.clients.filter(c=>this.voices.has(c.sessionId)).map(c=>({id:c.sessionId,name:this.match.actors.find(a=>a.id===c.sessionId)?.name??'Spectator',channel:this.voices.get(c.sessionId)!}));}
 private voiceRoster(){this.broadcast('voice-roster',this.voiceMembers());}
 async onCreate(options:any){
  if(process.env.BREADFLOWER_ENGINE==='1')await(engineLoad??=readFile(new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)).then(initializeEngine));
  this.terrain=await downtown();
  if(!compatible(options?.handshake,this.terrain.arenaIdentity))throw new ServerError(400,'INCOMPATIBLE_ARENA');
  try{wheelProfile(options.wheelId??'euc');}catch{throw new ServerError(400,'WHEEL_NOT_ALLOWED');}
  if(['maxSpeed','acceleration','wheelRadius'].some(key=>key in options))throw new ServerError(400,'SERVER_OWNS_WHEEL_PROFILE');
  this.size=options.matchSize===6?6:10;this.botFill=options.botFill!==false;if(options.botCount!==undefined&&(!Number.isInteger(options.botCount)||options.botCount< -1||options.botCount>9))throw new ServerError(400,'BOT_COUNT_INVALID');this.botCount=options.botCount??-1;this.match=new RoyaleMatch(this.terrain,undefined,this.size,options.botChase!==false,true);this.setPrivate(true);
  do{this.code=randomBytes(4).toString('hex').toUpperCase();}while(royaleCodes.has(this.code));
  royaleCodes.set(this.code,{roomId:this.roomId,expires:Date.now()+7200000});
  this.onMessage('*',(c,type,data)=>{
   if(type==='voice-state'||type==='voice-signal'){
    const now=Date.now(),r=this.voiceRates.get(c.sessionId);if(!r||now-r.at>=1000)this.voiceRates.set(c.sessionId,{at:now,n:1});else if(++r.n>60)return;
    if(type==='voice-state'){if(data?.enabled===false)this.voices.delete(c.sessionId);else if(data?.enabled===true&&voiceChannel(data.channel))this.voices.set(c.sessionId,data.channel);this.voiceRoster();}
    else {const signal=voiceSignal(data);if(signal&&voiceRecipient(c.sessionId,signal,this.voiceMembers()))this.clients.find(p=>p.sessionId===signal.to)?.send('voice-signal',{from:c.sessionId,signal});}
    return;
   }
   const now=Date.now(),r=this.rates.get(c.sessionId);if(!r||now-r.at>=1000)this.rates.set(c.sessionId,{at:now,n:1});else if(++r.n>100){c.leave(4008,'INPUT_RATE_LIMIT');return;}
   if(type==='hello')this.welcome(c);
   else if(type==='ready'&&compatible(data,this.terrain.arenaIdentity)){this.ready.add(c.sessionId);this.broadcastRoster();}
   else if(type==='release')this.match.release(c.sessionId);
   else if(type==='input'&&!this.spectators.has(c.sessionId))this.match.command(c.sessionId,data);
   else if(type==='respawn'&&!this.spectators.has(c.sessionId)){if(!data||typeof data.accept!=='boolean'||Object.keys(data).length!==1){c.send('notice','Invalid re-entry request.');return;}const result=this.match.requestReentry(c.sessionId,data.accept);c.send('notice',result.reason);if(result.ok&&data.accept)this.broadcast('respawn',{id:c.sessionId,remaining:this.match.actors.filter(a=>a.alive).length});}
   else if(type==='start'||type==='rematch'){
    if(c.sessionId!==this.host){c.send('notice','Only the room owner can start.');return;}
    if(!['lobby','results'].includes(this.match.phase))return;
    if(this.match.phase==='results'){this.match.actors=this.match.actors.filter(a=>a.bot||a.connected);}
    const humans=this.match.actors.filter(a=>!a.bot);
    if(!humans.length||humans.some(a=>!a.connected||!this.ready.has(a.id))){c.send('notice','Waiting for every rider to load and ready.');return;}
    if(!this.botFill&&humans.length!==this.size){c.send('notice','Human-only matches need '+this.size+' ready riders.');return;}
    this.match.actors=this.match.actors.filter(a=>!a.bot&&a.connected);this.match.phase='lobby';
    const wanted=this.botFill?Math.min(this.size-humans.length,this.botCount<0?this.size:this.botCount):0;while(this.match.actors.filter(a=>a.bot).length<wanted)this.match.add('bot-'+randomUUID(),'AI '+(this.match.actors.length+1),true,'DS_Armored_Rider_01');
    this.match.start(randomUUID(),randomBytes(2).readUInt16LE());this.ready.clear();this.broadcastRoster();
   }
  });
  this.setSimulationInterval(ms=>{
   if(this.failed)return;
   try{this.battleClock.advance(ms,()=>this.match.step());}catch(error){
    this.failed=true;this.broadcast('notice','The match stopped because its engine could not continue safely. Return to the lobby and create a new room.');
    console.error('ROYALE_ENGINE_FAILURE',this.roomId,error);void this.disconnect(1011);return;
   }
   this.sendClock+=ms;if(this.sendClock>=50){this.sendClock%=50;for(const c of this.clients)c.send('snapshot',{...this.match.snapshot(this.spectators.has(c.sessionId)?undefined:c.sessionId),hostPerformance:{...this.battleClock.metrics}});}
   if(Date.now()-this.telemetryAt>=30000){this.telemetryAt=Date.now();console.info('ROYALE_FRAME_BUDGET',this.roomId,JSON.stringify(this.battleClock.metrics));}
   if(Date.now()-this.born>7200000)void this.disconnect();
  },1000/60);
 }
 onAuth(_c:Client,options:any,context:AuthContext){
  try{wheelProfile(options?.wheelId??'euc');}catch{throw new ServerError(400,'WHEEL_NOT_ALLOWED');}
  if(['maxSpeed','acceleration','wheelRadius'].some(key=>key in (options??{})))throw new ServerError(400,'SERVER_OWNS_WHEEL_PROFILE');
  const origin=context.headers.get('origin');let local=false;try{local=!!origin&&['127.0.0.1','localhost','[::1]'].includes(new URL(origin).hostname);}catch{}
  if(process.env.NODE_ENV==='production'?(!origin||!origins.includes(origin)):(origin&&!local&&!origins.includes(origin)))throw new ServerError(403,'ORIGIN_NOT_ALLOWED');
  if(!compatible(options?.handshake,this.terrain.arenaIdentity))throw new ServerError(400,'INCOMPATIBLE_ARENA');
  const late=this.match.phase!=='lobby';
  if(late||options.spectate===true){if(this.spectators.size>=4)throw new ServerError(409,'SPECTATORS_FULL');}
  else if(this.match.actors.length>=this.size)throw new ServerError(409,'ROOM_COMBATANTS_FULL');
  return true;
 }
 onJoin(c:Client,options:any){
  const name=String(options.name??'Rider').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,20)||'Rider';
  const skins=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
  if(this.match.phase!=='lobby'||options.spectate===true)this.spectators.add(c.sessionId);else this.match.add(c.sessionId,name,false,skins.includes(options.skin)?options.skin:skins[0],options.wheelId??'euc');
  if(!this.host&&!this.spectators.has(c.sessionId))this.host=c.sessionId;this.welcome(c);this.broadcastRoster();
 }
 private welcome(c:Client){c.send('welcome',{code:this.code,host:this.host,handshake:currentHandshake(this.terrain.arenaIdentity),botFill:this.botFill,matchSize:this.size,spectator:this.spectators.has(c.sessionId)});c.send('snapshot',this.match.snapshot(this.spectators.has(c.sessionId)?undefined:c.sessionId));}
 private broadcastRoster(){this.broadcast('lobby',{host:this.host,ready:[...this.ready],botFill:this.botFill,matchSize:this.size});}
 onDrop(c:Client){this.voices.delete(c.sessionId);this.voiceRoster();this.match.disconnect(c.sessionId);void this.allowReconnection(c,20).catch(()=>{});}
 onReconnect(c:Client){this.match.reconnect(c.sessionId);this.welcome(c);}
 onLeave(c:Client){
  this.voices.delete(c.sessionId);this.voiceRates.delete(c.sessionId);this.voiceRoster();
  this.match.disconnect(c.sessionId);if(this.match.phase==='lobby'||this.match.phase==='results')this.match.actors=this.match.actors.filter(a=>a.id!==c.sessionId);
  this.ready.delete(c.sessionId);this.spectators.delete(c.sessionId);this.rates.delete(c.sessionId);
  if(c.sessionId===this.host)this.host=this.clients.find(a=>a.sessionId!==c.sessionId&&!this.spectators.has(a.sessionId))?.sessionId??'';
  this.broadcastRoster();
 }
 onDispose(){royaleCodes.delete(this.code);this.match?.dispose();}
}


