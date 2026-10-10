import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {RelayRoom} from '../../ride-core/dist/royale/relayRoom.js';
import {HANDSHAKE} from '../../ride-core/dist/royale/arena.js';
import {neutral} from '../../ride-core/dist/royale/rules.js';
const config=JSON.parse(await readFile('.royale-test-private/session.json','utf8'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=30000){const t=Date.now();while(!fn()){if(Date.now()-t>timeout)throw Error(label+' timed out');await pause(100);}}
const options={handshake:HANDSHAKE,name:'Network test',skin:'DS_Man_01',botFill:false};
const live=[],evidence={transport:'Supabase encrypted relay + local authoritative Colyseus',realHumanParticipants:0,remotePhysicalDevices:0};
function watch(room){const s={room,snapshot:null,welcome:null,received:0,intervals:[],notices:[]};room.onMessage('snapshot',v=>{const now=Date.now();if(s.received)s.intervals.push(now-s.received);s.received=now;s.snapshot=v;});room.onMessage('welcome',v=>s.welcome=v);room.onMessage('notice',v=>s.notices.push(v));room.onMessage('lobby',v=>s.lobby=v);room.onError((code,m)=>console.error('Relay error',code,m));return s;}
try{
 const bad=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+'0'.repeat(64)},body:JSON.stringify({action:'ticket'})});assert.equal(bad.status,403);evidence.invalidAccessRejected=true;
 const first=watch(await RelayRoom.connect(config,{action:'create',options}));live.push(first);await until(()=>first.welcome,'welcome');const code=first.welcome.code;
 for(let i=1;i<6;i++){live.push(watch(await RelayRoom.connect(config,{action:'join',code,options:{...options,name:'Network test '+i}})));}
 await until(()=>live.every(c=>c.snapshot?.roster.length===6),'six riders');for(const c of live)c.room.send('ready',HANDSHAKE);
 await until(()=>first.lobby?.ready?.length===6,'six ready acknowledgments');first.room.send('start',{});await until(()=>live.every(c=>c.snapshot?.phase==='active'),'active round');
 assert(live.every(c=>c.snapshot.roster.length===6&&c.snapshot.roster.every(a=>!a.bot)));assert.equal(new Set(live.map(c=>c.snapshot.round)).size,1);
 const before=live.map(c=>c.snapshot.self.controller.fields.pose);const start=Date.now();
 for(let seq=1;seq<=120;seq++){for(const c of live)c.room.send('input',{...neutral(c.snapshot.round,seq,c.snapshot.tick),throttle:1,steer:.06});await pause(1000/60);}
 await pause(1500);for(let i=0;i<6;i++){const p=live[i].snapshot.self.controller.fields.pose;assert(Math.hypot(p.x-before[i].x,p.z-before[i].z)>1);}
 evidence.sixIndependentConnections=true;evidence.independentMovement=true;console.log('Six Supabase connections are in the same active match and moved independently.');
 await until(()=>live.every(c=>c.snapshot?.phase==='results'),'full field round',400000);
 evidence.results=live[0].snapshot.results;evidence.fullRoundResult=live[0].snapshot.reason;
 while(Date.now()-start<165000)await pause(1000);
 for(const c of live){assert(Date.now()-c.received<5000);const sorted=c.intervals.sort((a,b)=>a-b);c.p95=sorted[Math.floor(sorted.length*.95)];}
 evidence.relaySurvived165Seconds=true;evidence.snapshotIntervalP95Ms=live.map(c=>c.p95);
 await mkdir('evidence',{recursive:true});await writeFile('evidence/royale-supabase-20261009.json',JSON.stringify({date:new Date().toISOString(),...evidence},null,2));console.log(JSON.stringify(evidence,null,2));
}catch(e){console.error(JSON.stringify(live.map(c=>({phase:c.snapshot?.phase,tick:c.snapshot?.tick,roster:c.snapshot?.roster?.map(r=>({bot:r.bot,connected:r.connected})),notices:c.notices,lag:Date.now()-c.received})),null,2));throw e;}finally{for(const c of live)await c.room.leave();}
