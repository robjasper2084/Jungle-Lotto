import test from 'node:test';
import assert from 'node:assert/strict';
import {RIDERS,VEHICLES,parseSelection,assignPlayer,defaultPair,loadPair,savePair,PREF_KEY,setupErrors,CoopLobbyState,CoopInput,findPairSpawns,coopViewports,glViewport,preparePair} from './coop.ts';
const selection=(values={})=>({...defaultPair()[0],...values});
const pad=(index=0,changes={})=>({index,id:'Pad '+index,connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:4},()=>({pressed:false,value:0})),...changes});
const ground=(x,z)=>({height:2,land:true,blocked:false});
const pair=()=>[assignPlayer(0,defaultPair()[0]),assignPlayer(1,defaultPair()[1])];
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('five inspected base heroes and five EUC profiles map without invented car or bike assets',()=>{
 assert.equal(RIDERS.length,5);assert.equal(VEHICLES.length,5);
 for(const r of RIDERS)for(const v of VEHICLES){const m=assignPlayer(0,selection({riderId:r.id,vehicleId:v.id}));assert.equal(m.riderId,r.id);assert.equal(m.vehicleId,v.id);assert.match(m.rider.blob,/^[0-9a-f]{40}$/);assert(m.requiresRigValidation);}
});
test('unknown vehicles and path injection cannot become a player assignment',()=>{
 for(const vehicleId of ['Cadillac','hoverbike','bicycle','ebike:talaria','__proto__','https://evil.invalid/model.glb'])assert.equal(parseSelection(selection({vehicleId})),undefined);
 assert.throws(()=>assignPlayer(0,selection({riderId:'../../evil'})));assert.throws(()=>assignPlayer(3,selection()));
});
test('model source comes from allowlist, not caller URL or physics override',()=>{
 const m=assignPlayer(0,{...selection(),rider:{sourcePath:'https://evil'},profileSource:'evil',controller:'teleport'});
 assert(m.rider.sourcePath.includes('swoop-source/public/exports/rigged-heroes/'));assert.equal(m.controller,'RideCore');assert(!m.profileSource.includes('evil'));
});
test('each player gets a distinct frozen manifest even for the same hero',()=>{
 const a=assignPlayer(0,selection()),b=assignPlayer(1,selection());assert.notEqual(a.entityId,b.entityId);assert.notEqual(a,b);assert.notEqual(a.rider,b.rider);assert(Object.isFrozen(a)&&Object.isFrozen(a.rider));
});
test('corrupt and older preferences recover without touching solo storage',()=>{
 for(const value of ['broken','null','{}','{"version":2,"players":[]}','{"version":1,"players":[]}'])assert.deepEqual(loadPair({getItem:()=>value}),defaultPair());
 const store=memory();store.setItem('belle-solo','unchanged');savePair(store,defaultPair());assert.equal(store.getItem('belle-solo'),'unchanged');
});
test('valid selections persist but readiness and arbitrary metadata do not',()=>{
 const store=memory(),p=defaultPair();p[1]={...p[1],riderId:'DS_Man_01',ready:true,roomToken:'private'};assert(savePair(store,p));
 const saved=JSON.parse(store.getItem(PREF_KEY));assert(!('ready'in saved.players[1]));assert(!('roomToken'in saved.players[1]));assert.equal(loadPair(store)[1].riderId,'DS_Man_01');
});
test('storage denial retains in-memory usability without claiming persistence',()=>{
 const store={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};assert.deepEqual(loadPair(store),defaultPair());assert.equal(savePair(store,defaultPair()),false);
});
test('invalid seat cannot overwrite another seat or append a third player',()=>{
 const lobby=new CoopLobbyState();assert.throws(()=>lobby.select(2,selection()));assert.throws(()=>lobby.setReady(-1,true,0));assert.equal(lobby.snapshot().players.length,2);
});
test('independent changes preserve the other player but invalidate both ready flags',()=>{
 const lobby=new CoopLobbyState(),before=lobby.snapshot();lobby.setReady(0,true,0);lobby.setReady(1,true,0);lobby.select(1,selection({binding:'arrows',riderId:'DS_Man_01'}));
 assert.deepEqual(lobby.snapshot().players[0],before.players[0]);assert.deepEqual(lobby.snapshot().ready,[false,false]);assert.equal(lobby.setReady(0,true,0),false);
});
test('both players must confirm one current revision before manifests are released',()=>{
 const l=new CoopLobbyState();assert.throws(()=>l.manifests());l.setReady(0,true,0);assert.throws(()=>l.manifests());l.setReady(1,true,0);assert.equal(l.manifests().length,2);
});
test('snapshot mutation cannot silently change the lobby',()=>{
 const l=new CoopLobbyState(),s=l.snapshot();s.players[0].riderId='DS_Man_01';s.ready[0]=true;assert.equal(l.snapshot().players[0].riderId,'DS_Armored_Rider_01');assert.equal(l.snapshot().ready[0],false);
});
test('duplicate physical controller/keyboard is rejected but keyboard plus controller works',()=>{
 const p=defaultPair();p[1].binding='wasd';assert.equal(setupErrors(p,'local',[]).length,1);
 p[1].binding='pad:0';assert.deepEqual(setupErrors(p,'local',[pad()]),[]);p[0].binding='pad:0';assert.match(setupErrors(p,'local',[pad()])[0],/different/);
});
test('missing and nonstandard gamepads block setup rather than silently assigning keyboard',()=>{
 const p=defaultPair();p[1].binding='pad:1';assert(setupErrors(p,'local',[pad()]).length);assert(setupErrors(p,'local',[pad(1,{mapping:''})]).length);
});
test('online is explicitly unavailable without transport and never inferred from two cameras',()=>{
 assert.match(setupErrors(defaultPair(),'online',[])[0],/not connected/);assert.deepEqual(setupErrors(defaultPair(),'online',[],true),[]);
});
test('P1 and P2 keyboards do not steal each other movement',()=>{
 const a=new CoopInput('wasd'),b=new CoopInput('arrows');a.read(new Set(),[]);b.read(new Set(),[]);
 assert.equal(a.read(new Set(['KeyW']),[]).throttle,1);assert.equal(b.read(new Set(['KeyW']),[]).throttle,0);
 assert.equal(b.read(new Set(['ArrowDown']),[]).throttle,-1);assert.equal(a.read(new Set(['ArrowDown']),[]).throttle,0);
});
test('held startup controls require a neutral release; opposing held keys are not neutral',()=>{
 const i=new CoopInput('wasd');assert.equal(i.read(new Set(['KeyW','KeyS']),[]).throttle,0);assert.equal(i.read(new Set(['KeyW']),[]).throttle,0);i.read(new Set(),[]);assert.equal(i.read(new Set(['KeyW']),[]).throttle,1);
});
test('jump/recover are edges rather than repeated actions every frame',()=>{
 const i=new CoopInput('wasd');i.read(new Set(),[]);assert(i.read(new Set(['Space','KeyR']),[]).hop);assert.equal(i.read(new Set(['Space','KeyR']),[]).recover,false);i.read(new Set(),[]);assert(i.read(new Set(['Space']),[]).hop);
});
test('pause clears movement and requires release before resuming',()=>{
 const i=new CoopInput('wasd');i.read(new Set(),[]);assert.equal(i.read(new Set(['KeyW']),[]).throttle,1);i.read(new Set(['KeyW']),[],true);assert.equal(i.read(new Set(['KeyW']),[]).throttle,0);i.read(new Set(),[]);assert.equal(i.read(new Set(['KeyW']),[]).throttle,1);
});
test('gamepad assignment uses index, not position in a filtered array',()=>{
 const i=new CoopInput('pad:1');i.read(new Set(),[pad(1)]);assert.equal(i.read(new Set(),[pad(1,{axes:[0,-1]})]).throttle,1);assert.equal(i.read(new Set(),[pad(0,{axes:[0,-1]})]).throttle,0);
});
test('disconnect and replacement gamepad require neutral rearm',()=>{
 const i=new CoopInput('pad:0');i.read(new Set(),[pad()]);assert.equal(i.read(new Set(),[pad(0,{axes:[0,-1]})]).throttle,1);i.read(new Set(),[]);assert.equal(i.read(new Set(),[pad(0,{axes:[0,-1]})]).throttle,0);i.read(new Set(),[pad()]);assert.equal(i.read(new Set(),[pad(0,{id:'new device',axes:[0,-1]})]).throttle,0);
});
test('NaN controller axes never arm or produce invalid simulation input',()=>{
 const i=new CoopInput('pad:0');i.read(new Set(),[pad(0,{axes:[NaN,NaN]})]);assert.equal(i.read(new Set(),[pad(0,{axes:[0,-1]})]).throttle,0);
});
test('analog noise has a deadzone and valid extreme axes clamp to one',()=>{
 const i=new CoopInput('pad:0');i.read(new Set(),[pad()]);assert.equal(i.read(new Set(),[pad(0,{axes:[.05,.1]})]).throttle,0);assert.equal(i.read(new Set(),[pad(0,{axes:[4,-4]})]).steer,1);
});
test('spawn search separates actors and uses real queried ground elevation',()=>{
 const p=findPairSpawns({x:0,y:99,z:0,heading:0},ground);assert(p.every(x=>x.y===2));assert(Math.hypot(p[0].x-p[1].x,p[0].z-p[1].z)>=2.3);
});
test('spawn footprint stays off water and walls, not merely the center',()=>{
 const p=findPairSpawns({x:0,y:0,z:0,heading:0},(x,z)=>({height:0,land:x>=0,blocked:x<1&&z>1}));assert(p.every(x=>x.x>=.75));
});
test('spawn search is bounded and fails safely when no land exists',()=>{
 let probes=0;assert.throws(()=>findPairSpawns({x:0,y:0,z:0,heading:0},()=>{probes++;return {height:0,land:false,blocked:false};}),/safe/);assert(probes<=128);
});
test('invalid footprint, missing coordinates and nonfinite ground cannot create spawn',()=>{
 assert.throws(()=>findPairSpawns({x:0,y:0,z:0,heading:NaN},ground));assert.throws(()=>findPairSpawns({x:0,y:0,z:0,heading:0},ground,[.75]));assert.throws(()=>findPairSpawns({x:0,y:0,z:0,heading:0},()=>({height:NaN,land:true,blocked:false})));
});
test('odd landscape and portrait pixels partition exactly without gaps',()=>{
 for(const [w,h] of [[1441,961],[391,845],[320,568]]){const r=coopViewports(w,h);assert.equal(r.reduce((s,r)=>s+r.width*r.height,0),w*h);assert.equal(r.length,2);for(const v of r){const gl=glViewport(v,h);assert(gl.y>=0&&gl.y+gl.height<=h);}}
});
test('bad screen sizes never create invalid scissor rectangles',()=>{
 for(const [w,h]of [[0,2],[2,0],[NaN,5],[1,1],[50.5,20]])assert.throws(()=>coopViewports(w,h));
});
test('successful preparation returns distinct validated actors; no disposal before host activation',async()=>{
 let disposed=0,checked=0;const actors=await preparePair(pair(),async()=>({identity:{},validate:()=>{checked++;return true;},dispose:()=>disposed++}),new AbortController().signal);
 assert.equal(checked,2);assert.notEqual(actors[0].identity,actors[1].identity);assert.equal(disposed,0);actors.forEach(a=>a.dispose());assert.equal(disposed,2);
});
test('failed validation rolls back already-prepared and late actors',async()=>{
 let disposed=0;await assert.rejects(preparePair(pair(),async m=>{if(m.seat===1)await wait(15);return {identity:{},validate:()=>m.seat!==0,dispose:()=>disposed++};},new AbortController().signal));await wait(25);assert.equal(disposed,2);
});
test('shared skeleton identity is rejected and both resource handles cleaned',async()=>{
 const same={};let disposed=0;await assert.rejects(preparePair(pair(),async()=>({identity:same,validate:()=>true,dispose:()=>disposed++}),new AbortController().signal),/share/);assert.equal(disposed,2);
});
test('a never-resolving load respects deadline and cleans the other actor',async()=>{
 let disposed=0;await assert.rejects(preparePair(pair(),async m=>m.seat===1?new Promise(()=>{}):{identity:{},validate:()=>true,dispose:()=>disposed++},new AbortController().signal,15),/deadline/);assert.equal(disposed,1);
});
test('pre-aborted preparation never calls loaders or creates an unhandled rejection',async()=>{
 const ctl=new AbortController();ctl.abort(new Error('cancelled'));let calls=0;await assert.rejects(preparePair(pair(),async()=>{calls++;throw Error('should not run');},ctl.signal),/cancelled/);await wait(1);assert.equal(calls,0);
});
test('external cancellation disposes an asset that finishes after cancellation',async()=>{
 const ctl=new AbortController();let disposed=0;const work=preparePair(pair(),async()=>{await wait(20);return {identity:{},validate:()=>true,dispose:()=>disposed++};},ctl.signal);ctl.abort(new Error('closed'));await assert.rejects(work,/closed/);await wait(30);assert.equal(disposed,2);
});
test('forged manifest URLs are canonicalized before reaching the loader',async()=>{
 const m=pair().map(x=>({...x,rider:{sourcePath:'https://evil',blob:'fake'}}));const actors=await preparePair(m,async x=>{assert(!x.rider.sourcePath.includes('evil'));return {identity:{},validate:()=>true,dispose(){}};},new AbortController().signal);actors.forEach(a=>a.dispose());
});
