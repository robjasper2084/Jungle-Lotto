import {loadHostFixture} from './hostFixture.js';

import {Room,Server,ServerError,type Client,type AuthContext} from '@colyseus/core';
import {WebSocketTransport} from '@colyseus/ws-transport';
import {cleanChatText,ChatRateGate} from '@digital-static/ridecore/chat';
import {TagMatch,TagTerrain,TAG_VERSION,type TagFixture,type TagCommand,type TagProduct,type TagRuleset} from '@digital-static/ridecore/tag';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const fixtures=new Map<TagProduct,TagFixture>();
const fixturePhysics=new Map<TagProduct,()=>Promise<Uint8Array|undefined>>();
for(const product of ['swoop-detroit','elmwood-explorer'] as const){const loaded=await loadHostFixture(resolve(root,'fixtures'),product);fixtures.set(product,loaded.fixture);fixturePhysics.set(product,loaded.physics);}
// Terrain is immutable: matches query it; their actors/projectiles own all state.
// Reuse at most two worlds instead of restoring the large Swoop snapshot per room.
const terrains=new Map<TagProduct,Promise<TagTerrain>>();
function terrainFor(product:TagProduct){let terrain=terrains.get(product);if(!terrain){terrain=(async()=>TagTerrain.create(fixtures.get(product)!,await fixturePhysics.get(product)!()))();terrains.set(product,terrain);terrain.catch(()=>terrains.delete(product));}return terrain;}
export async function preloadTagMaps(){for(const product of fixtures.keys()){const started=performance.now();await terrainFor(product);console.log(JSON.stringify({stage:'map-ready',product,ms:Math.round(performance.now()-started),rssMiB:Math.round(process.memoryUsage().rss/1048576)}));}}
const codes=new Map<string,{roomId:string;product:TagProduct;expires:number}>();
// A small free test host must reject excess rooms before allocating map physics.
const roomLimit=Number(process.env.TAG_MAX_ROOMS??0);
let reservedRooms=0;
const attempts=new Map<string,{until:number;count:number}>();
const roomMetrics=new Map<string,{product:string;active:number;spectators:number;tickMedianMs:number;tickP95Ms:number;slowTicks:number;bytesPerSecond:number}>();
const cleanupRates=setInterval(()=>{const now=Date.now();for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);},60000);cleanupRates.unref();
function allowed(ip:string,limit=30){const now=Date.now(),old=attempts.get(ip);if(!old||old.until<now){if(attempts.size>=10000)attempts.delete(attempts.keys().next().value!);attempts.set(ip,{until:now+60000,count:1});return true;}return ++old.count<=limit;}
const configuredOrigins=(process.env.ALLOWED_ORIGINS??'').split(',').filter(Boolean);
function originAllowed(origin:string|null){if(!origin)return process.env.NODE_ENV!=='production';try{const u=new URL(origin);return configuredOrigins.includes(origin)||process.env.NODE_ENV!=='production'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname);}catch{return false;}}
type Options={product:TagProduct;version:string;hash:string;name?:string;ruleset?:TagRuleset;difficulty?:'easy'|'normal'|'hard'|'expert';target?:number;botFill?:boolean;spectate?:boolean};
export class LoveTagRoom extends Room{
  private reserved=false;
  private chatRate=new ChatRateGate();
  maxClients=12;autoDispose=true;private match!:TagMatch;private terrain!:TagTerrain;private host='';private code='';private target=4;private botFill=true;private ready=new Set<string>();private spectators=new Set<string>();private messageRates=new Map<string,{time:number;count:number}>();private lastCommand=new Map<string,number>();private accumulator=0;private broadcastClock=0;private oldest=Date.now();private slowTicks=0;private tickTimes:number[]=[];private byteCount=0;private metricTime=performance.now();
  async onCreate(options:Options){
    const fixture=fixtures.get(options.product);if(!fixture||options.version!==TAG_VERSION||options.hash!==fixture.hash)throw new ServerError(400,'INCOMPATIBLE_BUILD');
    if(options.ruleset!=='classic'&&options.ruleset!=='spread')throw new ServerError(400,'INVALID_RULESET');
    if(roomLimit>0&&reservedRooms>=roomLimit)throw new ServerError(503,'TEST_SERVER_BUSY: Join the existing room or try again after it closes.');
    reservedRooms++;this.reserved=true;
    this.target=Math.max(options.ruleset==='spread'?4:2,Math.min(8,Number.isInteger(options.target)?options.target!:4));this.botFill=options.botFill!==false;
    this.terrain=await terrainFor(options.product);this.match=new TagMatch(fixture,this.terrain,options.ruleset,['easy','normal','hard','expert'].includes(options.difficulty??'')?options.difficulty!:'normal');this.setPrivate(true);
    do{this.code=randomBytes(5).toString('hex').slice(0,8).toUpperCase();}while(codes.has(this.code));
    codes.set(this.code,{roomId:this.roomId,product:options.product,expires:Date.now()+2*60*60*1000});
    this.onMessage('*',(client,type,data)=>{
      const now=Date.now(),rate=this.messageRates.get(client.sessionId);if(!rate||now-rate.time>1000)this.messageRates.set(client.sessionId,{time:now,count:1});else if(++rate.count>100){client.leave(4008,'INPUT_RATE_LIMIT');return;}
      if(type==='hello')this.welcome(client);
      else if(type==='chat'){const text=cleanChatText(data?.text);if(!text)return;if(!this.chatRate.allow(client.sessionId,now)){client.send('notice','Wait a moment before sending another message.');return;}this.broadcast('chat',{id:randomUUID(),player:client.sessionId,name:client.userData?.name??'Rider',text,at:now});}
      else if(type==='input'&&!this.spectators.has(client.sessionId)){if(this.match.command(client.sessionId,data as TagCommand))this.lastCommand.set(client.sessionId,now);}
      else if(type==='ready'&&data?.hash===fixture.hash)this.ready.add(client.sessionId);
      else if(type==='release')this.match.release(client.sessionId);
      else if(type==='start'||type==='rematch'){if(client.sessionId!==this.host){client.send('notice','ONLY_HOST_CAN_START');return;}if(!['lobby','results'].includes(this.match.phase))return;
        if(this.clients.some(c=>!this.ready.has(c.sessionId))){client.send('notice','WAITING_FOR_READY_PLAYERS');return;}
        this.match.actors=this.match.actors.filter(a=>!a.dnf);for(const id of [...this.spectators]){if(this.match.actors.length>=this.target){const replaceBot=this.match.actors.findIndex(a=>a.bot);if(replaceBot>=0)this.match.actors.splice(replaceBot,1);}if(this.match.actors.length<this.target){const c=this.clients.find(c=>c.sessionId===id);if(c){this.match.addActor(id,c.userData?.name??'Rider');this.spectators.delete(id);}}}
        if(this.botFill)while(this.match.actors.length<this.target)this.match.addActor('bot-'+randomUUID(),'Bot '+(this.match.actors.length+1),true);
        try{this.match.start(randomUUID());}catch(error){client.send('notice',(error as Error).message);}
      }
    });
    this.setSimulationInterval(ms=>{
      const begun=performance.now();this.accumulator=Math.min(this.accumulator+ms/1000,.25);
      while(this.accumulator>=1/60){for(const c of this.clients)if(Date.now()-(this.lastCommand.get(c.sessionId)??0)>350)this.match.release(c.sessionId);this.match.step();this.accumulator-=1/60;}
      this.broadcastClock+=ms;if(this.broadcastClock>=50){this.broadcastClock%=50;for(const c of this.clients){const snapshot=this.match.snapshot(this.spectators.has(c.sessionId)?undefined:c.sessionId);this.byteCount+=Buffer.byteLength(JSON.stringify(snapshot));c.send('snapshot',snapshot);}}
      const duration=performance.now()-begun;this.tickTimes.push(duration);if(this.tickTimes.length>600)this.tickTimes.shift();if(duration>16.7)this.slowTicks++;
      if(performance.now()-this.metricTime>=1000){const samples=[...this.tickTimes].sort((a,b)=>a-b),elapsed=(performance.now()-this.metricTime)/1000;roomMetrics.set(this.roomId,{product:fixture.product,active:this.match.actors.length,spectators:this.spectators.size,tickMedianMs:samples[Math.floor(samples.length*.5)]??0,tickP95Ms:samples[Math.floor(samples.length*.95)]??0,slowTicks:this.slowTicks,bytesPerSecond:Math.round(this.byteCount/elapsed)});this.byteCount=0;this.metricTime=performance.now();}
      if(Date.now()-this.oldest>2*60*60*1000)void this.disconnect();
    },1000/60);
  }
  onAuth(_client:Client,options:Options,context:AuthContext){
    if(!originAllowed(context.headers.get('origin')))throw new ServerError(403,'ORIGIN_NOT_ALLOWED');
    if(!allowed('join:'+(context.ip??'unknown'),30))throw new ServerError(429,'JOIN_RATE_LIMIT');
    if(options.version!==TAG_VERSION||options.product!==this.match.fixture.product||options.hash!==this.match.fixture.hash)throw new ServerError(400,'INCOMPATIBLE_MAP_OR_BUILD');
    const late=this.match.phase!=='lobby';
    if(late||options.spectate){if(this.spectators.size>=4)throw new ServerError(409,'SPECTATORS_FULL');}
    else if(this.match.actors.length>=this.target)throw new ServerError(409,'ROOM_FULL');
    return true;
  }
  onJoin(client:Client,options:Options){
    const name=String(options.name??'Rider').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,20)||'Rider';client.userData={name};
    if(this.match.phase!=='lobby'||options.spectate)this.spectators.add(client.sessionId);else this.match.addActor(client.sessionId,name);
    if(!this.host)this.host=client.sessionId;this.welcome(client);
  }
  private welcome(client:Client){client.send('welcome',{code:this.code,host:this.host,product:this.match.fixture.product,hash:this.match.fixture.hash,version:TAG_VERSION,spectator:this.spectators.has(client.sessionId),grace:20});client.send('snapshot',this.match.snapshot(this.spectators.has(client.sessionId)?undefined:client.sessionId));}
  onDrop(client:Client){const actor=this.match.actors.find(a=>a.id===client.sessionId);if(actor)actor.connected=false;this.match.release(client.sessionId);void this.allowReconnection(client,20).catch(()=>{});}
  onReconnect(client:Client){const actor=this.match.actors.find(a=>a.id===client.sessionId);if(actor)actor.connected=true;this.lastCommand.set(client.sessionId,Date.now());this.welcome(client);}
  onLeave(client:Client){this.chatRate.forget(client.sessionId);this.match.leave(client.sessionId);this.spectators.delete(client.sessionId);this.ready.delete(client.sessionId);this.messageRates.delete(client.sessionId);this.lastCommand.delete(client.sessionId);if(client.sessionId===this.host){this.host=this.clients.find(c=>c.sessionId!==client.sessionId)?.sessionId??'';this.broadcast('host',this.host);}}
  onDispose(){roomMetrics.delete(this.roomId);codes.delete(this.code);if(this.match)this.match.phase='disposing';if(this.reserved){this.reserved=false;reservedRooms--;}}
}
export function createTagServer(extendApp?:(app:import('express').Application)=>void){const server=new Server({transport:new WebSocketTransport({maxPayload:8192,pingInterval:3000,pingMaxRetries:2}),express(app){
  app.use((req,res,next)=>{const origin=req.headers.origin??null;if(origin&&!originAllowed(origin)){res.status(403).json({error:'ORIGIN_NOT_ALLOWED'});return;}if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');if(req.method==='OPTIONS'){res.sendStatus(204);return;}if(!allowed('http:'+req.ip,120)){res.status(429).json({error:'REQUEST_RATE_LIMIT'});return;}next();});
  app.get('/ops/metrics',(req,res)=>{const token=process.env.TAG_METRICS_TOKEN,auth=req.headers.authorization??'';if(!token){res.sendStatus(404);return;}const expected=Buffer.from('Bearer '+token),actual=Buffer.from(auth);if(actual.length!==expected.length||!timingSafeEqual(actual,expected)){res.sendStatus(401);return;}res.json({version:TAG_VERSION,rooms:Object.fromEntries(roomMetrics),memory:process.memoryUsage()});});
  extendApp?.(app);
  app.get('/health',(_req,res)=>res.json({ok:true,version:TAG_VERSION,products:[...fixtures.keys()]}));
  app.get('/v1/room/:code',(req,res)=>{const code=String(req.params.code).toUpperCase();if(!/^[A-F0-9]{8}$/.test(code)){res.status(400).json({error:'INVALID_ROOM_CODE'});return;}const room=codes.get(code);if(!room||room.expires<Date.now()){res.status(404).json({error:'ROOM_EXPIRED'});return;}res.json({roomId:room.roomId,product:room.product,version:TAG_VERSION});});
}});
server.define('love-tag',LoveTagRoom);

return server;}
