import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine} from '../src/engine/runtime.ts';
import {ArenaTerrain,currentHandshake,compatible} from '../src/royale/arena.ts';
import {RoyaleMatch,neutral,PROTECTION} from '../src/royale/rules.ts';
import {cycleScope,scopedFov,scopeSites,canReachScope,isScope} from '../src/royale/scopes.ts';
await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));
const terrain=await ArenaTerrain.create();
function full(engine=true){const m=new RoyaleMatch(terrain,engine);for(let i=0;i<6;i++)m.add('r'+i,'Rider '+i);m.start('scopes');return m;}
function place(m:RoyaleMatch,i:number,p:{x:number;y:number;z:number}){const a=m.actors[i];a.controller.reset({position:p,headingY:0});a.pose={...a.controller.poseValue};}
function advance(m:RoyaleMatch,n:number){for(let i=0;i<n;i++)m.step();}

test('optic magnification follows projection math and only owned scopes cycle',()=>{
 for(const [kind,zoom]of [['scope2',2],['scope4',4],['scope8',8]] as const){const fov=scopedFov(43,kind);assert(Math.abs(Math.tan(43*Math.PI/360)/Math.tan(fov*Math.PI/360)-zoom)<1e-9);}
 assert.equal(scopedFov(43,null),43);assert.equal(cycleScope([],null),null);
 assert.equal(cycleScope(['scope4','scope2'],'scope2'),'scope4');assert.equal(cycleScope(['scope2','scope4'],'scope4'),null);
});
test('pickups require distance, floor proximity and line of sight',()=>{
 const p={x:0,y:0,z:0};assert(canReachScope(p,{x:2,y:0,z:0},()=>true));
 assert(!canReachScope(p,{x:3,y:0,z:0},()=>true));assert(!canReachScope(p,{x:0,y:3,z:0},()=>true));assert(!canReachScope(p,p,()=>false));
});
for(const engine of [false,true])test((engine?'compiled':'fallback')+' match owns pickup, rejects inventory claims, preserves reconnect and resets rematch',()=>{
 const m=full(engine),a=m.actors[0],item=m.loot.find(l=>isScope(l.kind))!,kind=item.kind;assert(isScope(kind));
 place(m,0,item.p);m.step();assert.equal(a.scopes.length,0,'deployment stays locked');advance(m,PROTECTION);assert.deepEqual(a.scopes,[kind]);assert(!item.available);
 assert(!m.command(a.id,{...neutral(m.round,1,m.tick),scopes:['scope8']}));
 const other=m.actors[1];place(m,1,item.p);m.step();assert.equal(other.scopes.length,0,'one collectible cannot go to two players');
 m.disconnect(a.id);m.reconnect(a.id);assert.deepEqual(m.snapshot(a.id).self?.scopes,[kind]);
 if(engine){const saved=m.captureEngineState();m.restoreEngineState(saved);assert.deepEqual(m.snapshot(a.id).self?.scopes,[kind]);assert(!m.loot.find(l=>l.id===item.id)!.available);}
 m.phase='results';m.start('fresh');assert.deepEqual(m.actors[0].scopes,[]);assert(m.loot.filter(l=>isScope(l.kind)).every(l=>l.available));m.dispose();
});
test('authored sites cover the connected map and give each start a nearby 2x',()=>{
 const nodes=Array.from({length:41*41},(_,i)=>({x:(i%41-20)*20,y:0,z:(Math.floor(i/41)-20)*20}));
 const starts=[-100,0,100].flatMap(x=>[-100,100].map(z=>({position:{x,y:0,z},headingY:0})));
 const sites=scopeSites(nodes,starts,{x:0,y:0,z:0},500);assert.equal(sites.length,42);
 for(const start of starts)assert(sites.some(s=>s.kind==='scope2'&&Math.hypot(s.p.x-start.position.x,s.p.z-start.position.z)<=25));
 for(const kind of ['scope2','scope4','scope8'])assert(sites.some(s=>s.kind===kind));assert(Math.max(...sites.map(s=>s.p.x))-Math.min(...sites.map(s=>s.p.x))>700);
});
test('old servers cannot silently omit collectible optics',()=>{const h=currentHandshake();assert(compatible(h));const {optics,...old}=h as typeof h&{optics:string};assert(optics);assert(!compatible(old));});
test.after(()=>terrain.dispose());
