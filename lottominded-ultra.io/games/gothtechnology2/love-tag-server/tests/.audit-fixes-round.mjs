import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {initializeEngine,ENGINE_ID,neutral} from '@digital-static/ridecore/royale';
import {RoyaleSession} from '../../ride-core/dist/royaleClient.js';
// Real public session API and sockets. This is one automated client plus five
// authoritative AI, never recorded as six humans or an internet playtest.
const storage=new Map();globalThis.sessionStorage={setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)??null};
await initializeEngine(await readFile(new URL('../../ride-core/dist/engine/breadflower.wasm',import.meta.url)));
import {loadDowntown} from './downtown-fixture.mjs';
const terrain=await loadDowntown(),endpoint=process.env.ROYALE_TEST_URL||'http://127.0.0.1:8212';
let session=new RoyaleSession(terrain),timer;const began=Date.now();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label,limit=12000){const end=Date.now()+limit;while(Date.now()<end){if(check())return;await pause(50);}throw Error('Timed out: '+label);}
try{
 await session.online(endpoint,true,'','Automated round','DS_Man_01',true);
 await until(()=>session.state?.phase==='lobby','lobby');session.readyUp();await pause(200);session.start();
 await until(()=>session.state?.phase==='active','active');
 let commands=0;timer=setInterval(()=>{if(session.state?.self?.alive)session.step({...neutral(''),fire:commands++%30===0});},17);
 await until(()=>session.state.self.shotCursor>=3,'confirmed shots');
 const before={ammo:session.state.self.ammo.static,shot:session.state.self.shotCursor,seq:session.state.self.inputCursor};
 clearInterval(timer);session.room.reconnection.enabled=false;session.room.connection.close();await pause(900);
 assert.equal(session.connectionStatus().state,'disconnected');
 // Mimic reload: a new client object must adopt retained server sequence floors.
 const old=session;session=new RoyaleSession(terrain);await session.reconnect();
 await until(()=>session.state?.self,'reconnected');
 assert.equal(session.connectionStatus().state,'connected');assert.equal(session.state.self.ammo.static,before.ammo);assert(session.seq>=before.seq);assert(session.shot>=before.shot);
 const health=session.state.self.integrity;
 timer=setInterval(()=>{if(session.state?.self?.alive)session.step({...neutral(''),fire:commands++%30===0});},17);
 await until(()=>session.state.self.ammo.static<before.ammo,'fire accepted immediately after reconnect');
 const reconnected={sameEntity:session.me===old.me,healthNotReset:session.state.self.integrity<=health,inputCursor:session.seq,shotCursor:session.shot};
 assert(reconnected.sameEntity&&reconnected.healthNotReset);
 await until(()=>session.state?.phase==='results','full authoritative results',390000);
 clearInterval(timer);const result=structuredClone(session.state);assert(result.results.length===6&&result.remaining<=1&&result.engine.module===ENGINE_ID.module);
 const botIds=new Set(result.roster.filter(a=>a.bot).map(a=>a.id));
 assert(result.results.some(a=>botIds.has(a.id)&&a.shots>0),'network bots must actually fire');
 assert(result.results.some(a=>botIds.has(a.id)&&a.hits>0),'network bots must land authoritative hits');
 session.readyUp();await pause(200);session.start();await until(()=>session.state?.phase==='deployment','rematch');
 assert.notEqual(session.state.round,result.round);assert.equal(session.state.self.ammo.static,80);assert.equal(session.state.self.integrity,100);
 await writeFile('C:/Users/digit/Documents/phone/output/royale-audit-20261010/network-fixes-round.json',JSON.stringify({at:new Date().toISOString(),durationSeconds:(Date.now()-began)/1000,endpoint,humans:0,automatedClients:1,bots:5,hostedInternet:false,engine:ENGINE_ID,reconnected,rematch:true,result},null,2));
 console.log('PASS full engine-backed network round, new client reconnect with immediate firing, results and rematch');
}finally{clearInterval(timer);session.leave();terrain.terrain.dispose();}
