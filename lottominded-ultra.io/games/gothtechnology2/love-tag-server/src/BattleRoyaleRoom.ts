import {Room,ServerError,type Client,type AuthContext} from '@colyseus/core';
import {DowntownArena,RoyaleMatch,currentHandshake,compatible,initializeEngine,wheelProfile} from '@digital-static/ridecore/royale';
import {TagTerrain} from '@digital-static/ridecore/tag';
import {loadHostFixture} from './hostFixture.js';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {RoyaleClock} from './royaleClock.js';
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
 maxClients=10;private match!:RoyaleMatch;private terrain!:DowntownArena;private host='';private code='';private botFill=false;
 private ready=new Set<string>();private spectators=new Set<string>();private rates=new Map<string,{at:number;n:number}>();private battleClock=new RoyaleClock();private failed=false;private telemetryAt=0;private sendClock=0;private born=Date.now();
 async onCreate(options:any){
  if(process.env.BREADFLOWER_ENGINE==='1')await(engineLoad??=readFile(new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)).then(initializeEngine));
  this.terrain=await downtown();
  if(!compatible(options?.handshake,this.terrain.arenaIdentity))throw new ServerError(400,'INCOMPATIBLE_ARENA');
  try{wheelProfile(options.wheelId??'euc');}catch{throw new ServerError(400,'WHEEL_NOT_ALLOWED');}
  if(['maxSpeed','acceleration','wheelRadius'].some(key=>key in options))throw new ServerError(400,'SERVER_OWNS_WHEEL_PROFILE');
  this.botFill=options.botFill===true;this.match=new RoyaleMatch(this.terrain);this.setPrivate(true);
  do{this.code=randomBytes(4).toString('hex').toUpperCase();}while(royaleCodes.has(this.code));
  royaleCodes.set(this.code,{roomId:this.roomId,expires:Date.now()+7200000});
  this.onMessage('*',(c,type,data)=>{
   const now=Date.now(),r=this.rates.get(c.sessionId);if(!r||now-r.at>=1000)this.rates.set(c.sessionId,{at:now,n:1});else if(++r.n>100){c.leave(4008,'INPUT_RATE_LIMIT');return;}
   if(type==='hello')this.welcome(c);
   else if(type==='ready'&&compatible(data,this.terrain.arenaIdentity)){this.ready.add(c.sessionId);this.broadcastRoster();}
   else if(type==='release')this.match.release(c.sessionId);
   else if(type==='input'&&!this.spectators.has(c.sessionId))this.match.command(c.sessionId,data);
   else if(type==='start'||type==='rematch'){
    if(c.sessionId!==this.host){c.send('notice','Only the room owner can start.');return;}
    if(!['lobby','results'].includes(this.match.phase))return;
    if(this.match.phase==='results'){this.match.actors=this.match.actors.filter(a=>a.bot||a.connected);}
    const humans=this.match.actors.filter(a=>!a.bot);
    if(!humans.length||humans.some(a=>!a.connected||!this.ready.has(a.id))){c.send('notice','Waiting for every rider to load and ready.');return;}
    if(!this.botFill&&humans.length!==6){c.send('notice','Human-only matches need six ready riders.');return;}
    if(this.match.phase==='results'){this.match.actors=this.match.actors.filter(a=>a.bot||a.connected);this.match.phase='lobby';}
    if(this.botFill)while(this.match.actors.length<6)this.match.add('bot-'+randomUUID(),'AI '+(this.match.actors.length+1),true);
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
  else if(this.match.actors.length>=6)throw new ServerError(409,'SIX_COMBATANTS_ONLY');
  return true;
 }
 onJoin(c:Client,options:any){
  const name=String(options.name??'Rider').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,20)||'Rider';
  const skins=['DS_Man_01','DS_Hoodie_Woman_01','DS_Mascot_Suit_01','DS_Mascot_Hoodie_01','DS_Armored_Rider_01'];
  if(this.match.phase!=='lobby'||options.spectate===true)this.spectators.add(c.sessionId);else this.match.add(c.sessionId,name,false,skins.includes(options.skin)?options.skin:skins[0],options.wheelId??'euc');
  if(!this.host&&!this.spectators.has(c.sessionId))this.host=c.sessionId;this.welcome(c);this.broadcastRoster();
 }
 private welcome(c:Client){c.send('welcome',{code:this.code,host:this.host,handshake:currentHandshake(this.terrain.arenaIdentity),botFill:this.botFill,spectator:this.spectators.has(c.sessionId)});c.send('snapshot',this.match.snapshot(this.spectators.has(c.sessionId)?undefined:c.sessionId));}
 private broadcastRoster(){this.broadcast('lobby',{host:this.host,ready:[...this.ready],botFill:this.botFill});}
 onDrop(c:Client){this.match.disconnect(c.sessionId);void this.allowReconnection(c,20).catch(()=>{});}
 onReconnect(c:Client){this.match.reconnect(c.sessionId);this.welcome(c);}
 onLeave(c:Client){
  this.match.disconnect(c.sessionId);if(this.match.phase==='lobby'||this.match.phase==='results')this.match.actors=this.match.actors.filter(a=>a.id!==c.sessionId);
  this.ready.delete(c.sessionId);this.spectators.delete(c.sessionId);this.rates.delete(c.sessionId);
  if(c.sessionId===this.host)this.host=this.clients.find(a=>a.sessionId!==c.sessionId&&!this.spectators.has(a.sessionId))?.sessionId??'';
  this.broadcastRoster();
 }
 onDispose(){royaleCodes.delete(this.code);this.match?.dispose();}
}
