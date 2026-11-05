import assert from 'node:assert/strict';
import {Client} from '@colyseus/sdk';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {TagMatch,TagTerrain,neutralCommand} from '@digital-static/ridecore/tag';
const endpoint=process.env.TAG_ENDPOINT??'http://127.0.0.1:8211',evidence=[];
const rulesets=process.env.TAG_RULESET?[process.env.TAG_RULESET]:(process.env.TAG_QUICK==='1'?['classic']:['classic','spread']);
assert(rulesets.every(r=>['classic','spread'].includes(r)),'Supported ruleset');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label,timeout=20000){const end=Date.now()+timeout;while(!check()){if(Date.now()>end)throw Error('Timed out: '+label);await sleep(100);}}
async function scenario(product,ruleset){
 const {fixture}=JSON.parse(await readFile(new URL('../fixtures/'+product+'.server.json',import.meta.url),'utf8'));
 const options={product,version:'heart-rush-1',hash:fixture.hash,ruleset,target:ruleset==='spread'?4:2,botFill:ruleset==='spread',name:'Human A'};
 const headers={Origin:'https://robjasper2084.github.io'},sdkA=new Client(endpoint,{headers}),sdkB=new Client(endpoint,{headers}),a=await sdkA.create('love-tag',options);let sa,sb,welcome,code;
 a.reconnection.enabled=false;a.onLeave(code=>console.log(product,ruleset,'client A left',code));
 a.onMessage('snapshot',s=>sa=s);a.onMessage('welcome',w=>{welcome=w;code=w.code;a.send('ready',{hash:fixture.hash});});a.onMessage('notice',n=>console.log(product,ruleset,'notice',n));a.onMessage('host',()=>{});a.send('hello',{});
 for(let i=0;i<100&&!code;i++)await sleep(100);assert(code,'Room has a real valid code');
 await assert.rejects(sdkA.create('love-tag',options),/TEST_SERVER_BUSY/);console.log(product,ruleset,'room created; capacity guard passes');
 const lookup=await fetch(endpoint+'/v1/room/'+code).then(r=>r.json());assert.equal(lookup.roomId,a.roomId);
 const b=await sdkB.joinById(lookup.roomId,{...options,name:'Human B'});b.reconnection.enabled=false;b.onMessage('snapshot',s=>sb=s);b.onMessage('welcome',()=>b.send('ready',{hash:fixture.hash}));b.onMessage('notice',()=>{});b.onMessage('host',()=>{});b.send('hello',{});
 await until(()=>sa?.actors.filter(p=>!p.bot).length===2&&sb,'two joined humans');assert.notEqual(a.sessionId,b.sessionId);await sleep(500);a.send('start',{});await until(()=>sa?.phase==='active','active round');console.log(product,ruleset,'two humans joined; active round');
 assert.equal(sa.phase,'active');let seqA=0,seqB=0,shot=0;const beforeA={...sa.actors.find(p=>p.id===a.sessionId).pose},beforeB={...sa.actors.find(p=>p.id===b.sessionId).pose};
 for(let i=0;i<45;i++){a.send('input',{...neutralCommand(sa.round,++seqA,sa.tick),throttle:1,steer:.1});b.send('input',{...neutralCommand(sb.round,++seqB,sb.tick),throttle:.5,steer:-.1});await sleep(17);}
 a.send('release',{});b.send('release',{});await sleep(400);
 const afterA=sa.actors.find(p=>p.id===a.sessionId).pose,afterB=sb.actors.find(p=>p.id===b.sessionId).pose;assert(Math.hypot(afterA.x-beforeA.x,afterA.z-beforeA.z)>.3);assert(Math.hypot(afterB.x-beforeB.x,afterB.z-beforeB.z)>.1);
 for(let i=0;i<300&&!sa.events.some(e=>e.kind==='tag');i++){const shooter=sa.actors.find(p=>p.id===a.sessionId),target=sa.actors.find(p=>p.id===b.sessionId),dx=target.pose.x-shooter.pose.x,dz=target.pose.z-shooter.pose.z,distance=Math.hypot(dx,dz),yaw=Math.atan2(Math.sin(Math.atan2(dx,dz)-shooter.pose.headingY),Math.cos(Math.atan2(dx,dz)-shooter.pose.headingY)),pitch=Math.atan2(target.pose.y-shooter.pose.y,distance);
   a.send('input',{...neutralCommand(sa.round,++seqA,sa.tick),throttle:0,steer:0,aimYaw:Math.max(-1.35,Math.min(1.35,yaw)),aimPitch:Math.max(-.75,Math.min(.75,pitch)),fire:true,shot:++shot});await sleep(17);}
 const tagged=sa.events.some(e=>e.kind==='tag');assert(tagged,'Real server confirms a tag');
 console.log(product,ruleset,'independent movement and server tag passed');
 const originalSeat=b.sessionId,token=b.reconnectionToken;b.connection.close();await sleep(5000);const rejoined=await sdkB.reconnect(token);rejoined.reconnection.enabled=false;let sr;rejoined.onMessage('snapshot',s=>sr=s);rejoined.onMessage('welcome',()=>{});rejoined.onMessage('host',()=>{});rejoined.onMessage('notice',()=>{});rejoined.send('hello',{});await until(()=>sr,'reconnected snapshot');assert.equal(rejoined.sessionId,originalSeat);assert(sr.actors.some(p=>p.id===originalSeat));console.log(product,ruleset,'reconnected same seat');
 // Full canonical round: do not shorten server timers for this evidence.
 await until(()=>sa.phase==='results','full canonical round results',200000);await until(()=>sr.phase==='results','second client results');
 assert.equal(sa.phase,'results');assert.deepEqual(sa.winners,sr.winners);assert.equal(sa.round,sr.round);
 const previousRound=sa.round;a.send('rematch',{});await sleep(500);assert.equal(sa.phase,'countdown');assert.notEqual(sa.round,previousRound);
 evidence.push({product,ruleset,roomId:a.roomId,code,humans:2,bots:options.target-2,independentMovement:true,serverTag:tagged,reconnectSeconds:5,seatRetained:true,canonicalDuration:180,resultIdentical:true,rematch:true,hash:fixture.hash});await rejoined.leave();await a.leave();
}
const watchdog=setTimeout(()=>{console.error('Hosted acceptance exceeded its bounded run time');process.exit(1);},process.env.TAG_QUICK==='1'?600000:1100000);
try{for(const product of ['swoop-detroit','elmwood-explorer'])for(const ruleset of rulesets){await scenario(product,ruleset);await sleep(1500);}}catch(error){console.error(error);process.exit(1);}finally{clearTimeout(watchdog);}
await mkdir(new URL('../../docs/love-tag/evidence/',import.meta.url),{recursive:true});await writeFile(new URL('../../docs/love-tag/evidence/free-host-online.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),endpoint,kind:'authoritative service + two independent SDK clients, sequential rooms on free tier; not browser or separate-device QA',evidence},null,2));
console.log(JSON.stringify(evidence,null,2));
