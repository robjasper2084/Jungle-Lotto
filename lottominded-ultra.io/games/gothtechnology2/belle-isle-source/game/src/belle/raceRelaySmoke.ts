import {RealtimeClient} from '@supabase/realtime-js';
import {ONLINE_CONFIG} from '../../runtime/elmwood-source/src/detroit/onlineConfig.ts';
import {validRacePlan} from './raceRules.ts';
import {BELLE_PROTOCOL} from './onlineProtocol.ts';
import assert from 'node:assert/strict';
const room=crypto.randomUUID().replaceAll('-',''),ids=Array.from({length:4},()=>crypto.randomUUID());
const clients=ids.map(()=>new RealtimeClient(ONLINE_CONFIG.url+'/realtime/v1',{params:{apikey:ONLINE_CONFIG.key},heartbeatIntervalMs:10000}));
const channels=clients.map((c,i)=>c.channel('belle-isle:explorers:'+room,{config:{broadcast:{ack:true,self:false},presence:{key:ids[i]},private:false}}));
const seen=ids.map(()=>new Set<string>()),ready=new Set([ids[0]]),states=ids.map(()=>0),recovery=ids.map(()=>0);let roster=0;
const send=(i:number,data:unknown)=>channels[i].send({type:'broadcast',event:'race',payload:{protocol:BELLE_PROTOCOL,room,sender:ids[i],data}});
const wait=async(test:()=>boolean)=>{const end=Date.now()+15000;while(!test()){if(Date.now()>end)throw Error('relay timeout');await new Promise(r=>setTimeout(r,50));}};
try {
 channels.forEach((c,i)=>{c.on('presence',{event:'sync'},()=>{roster=Math.max(roster,Object.keys(c.presenceState()).length);});c.on('broadcast',{event:'race'},({payload:e})=>{if(e.protocol!==BELLE_PROTOCOL||e.room!==room||!ids.includes(e.sender))return;const m=e.data;if(validRacePlan(m,ids[0],ids)&&e.sender===ids[0]){seen[i].add(m.id);void send(i,{type:'ready',id:m.id});}if(i===0&&m.type==='ready')ready.add(e.sender);if(m.type==='state'&&e.sender===ids[0])states[i]++;if(m.type==='recovered'&&e.sender===ids[0])recovery[i]++;});});
 await Promise.all(channels.map((c,i)=>new Promise<void>((ok,fail)=>{c.subscribe(s=>{if(s==='SUBSCRIBED')void c.track({id:ids[i],name:'Race QA '+(i+1),joined:Date.now()+i,protocol:BELLE_PROTOCOL,voice:false}).then(()=>ok());if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')fail(Error(s));});})));
 await wait(()=>roster===4);await new Promise(r=>setTimeout(r,300));
 const plan={type:'plan',id:crypto.randomUUID(),host:ids[0],course:'island-shoreline-v1',laps:1,entries:ids.map((id,i)=>({id,name:'Race QA '+(i+1),ai:false}))};await send(0,plan);await wait(()=>ready.size===4);
 for(let seq=0;seq<5;seq++)await send(0,{type:'state',id:plan.id,seq,phase:seq<3?'countdown':'racing',countdown:Math.max(0,3-seq),elapsed:Math.max(0,seq-3),racers:[]});
 await send(0,{type:'recovered',id:plan.id,player:ids[2],next:2,passed:2,seq:6});await wait(()=>states.slice(1).every(n=>n===5)&&recovery.slice(1).every(n=>n===1));
 assert.equal(ready.size,4);assert(seen.slice(1).every(s=>s.has(plan.id)));console.log(JSON.stringify({clients:4,roster,ready:ready.size,statePacketsReceived:states.slice(1),recoveryPacketsReceived:recovery.slice(1),microphones:'off'}));
 await send(0,{type:'cancel',id:plan.id});
} finally {await Promise.all(clients.map(c=>c.removeAllChannels()));clients.forEach(c=>c.disconnect());}
