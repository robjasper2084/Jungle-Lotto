import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchSeries} from '../src/royale/matchSeries.ts';
import {ArenaTerrain} from '../src/royale/arena.ts';
import {RoyaleMatch} from '../src/royale/rules.ts';

test('three rounds award once, keep standings, and reset only for a new series',()=>{
 const series=new MatchSeries();
 for(let i=1;i<=3;i++){series.begin();assert.equal(series.number,i);const scores=[{id:'a',name:'A',kills:i,damage:30},{id:'b',name:'B',kills:0,damage:5}];series.finish('r'+i,'a',scores);series.finish('r'+i,'a',scores);assert.equal(series.completed.length,i);assert.equal(series.snapshot().complete,i===3);}
 const result=series.snapshot();assert.equal(result.winner,'a');assert.equal(result.standings[0].wins,3);assert.equal(result.standings[0].kills,6);series.begin();assert.equal(series.number,1);assert.equal(series.completed.length,0);
});
test('equal three-round totals are a match draw',()=>{const s=new MatchSeries();for(let i=0;i<3;i++){s.begin();s.finish('r'+i,null,[{id:'a',name:'A',kills:0,damage:0},{id:'b',name:'B',kills:0,damage:0}]);}assert.equal(s.snapshot().winner,null);});

const terrain=await ArenaTerrain.create();
const place=(m:RoyaleMatch,i:number,x:number,z:number)=>{const a=m.actors[i];a.controller.reset({position:{x,y:0,z},headingY:0});a.pose={...a.controller.poseValue};};
test('spectators follow delayed actors without exposing live positions or private inventory',()=>{
 const m=new RoyaleMatch(terrain,false);for(const id of ['me','a','b'])m.add(id,id);m.start('watch',1);for(let i=0;i<3;i++)place(m,i,0,i*10);
 assert.equal(m.watch('me','a'),false);assert.equal(m.snapshot('outsider').spectating,undefined);
 m.actors[0].alive=false;for(let i=0;i<450;i++)m.step();
 assert(m.watch('viewer','b'));const first=m.snapshot('viewer',true);assert.equal(first.spectating?.target,'b');assert.equal(first.self,undefined);assert(!('ammo' in first.actors[0]));
 assert.equal(first.spectating?.tick,first.tick-180);
 const old=first.actors.find(a=>a.id==='b')!.pose.x;place(m,2,40,20);m.step();
 assert.equal(m.snapshot('viewer',true).actors.find(a=>a.id==='b')!.pose.x,old);
 assert.equal(m.snapshot('viewer',true).spectating?.tick,first.spectating?.tick,'held poses retain their recorded time');
 for(let i=0;i<190;i++)m.step();assert(Math.abs(m.snapshot('viewer',true).actors.find(a=>a.id==='b')!.pose.x-40)<.1);
 assert(m.watch('me','a'));assert.equal(m.snapshot('me').spectating?.target,'a');m.dispose();
});
test('a rider awaiting reentry cannot scout opponents',()=>{
 const m=new RoyaleMatch(terrain,false,6,true,true);for(const id of ['me','a','b'])m.add(id,id);m.start('respawn-watch',1);m.tick=300;m.actors[0].alive=false;m.actors[0].reentryUntil=900;
 assert.equal(m.watch('me','a'),false);assert.equal(m.snapshot('me').spectating,undefined);assert(!m.snapshot('me').actors.some(a=>a.id==='a'));m.dispose();
});
test('local round restart keeps series and resets combat state',()=>{
 const m=new RoyaleMatch(terrain,false);m.add('me','You');m.add('b','Other');
 for(let i=1;i<=3;i++){m.start('round-'+i,1);m.tick=300;m.actors[1].alive=false;m.step();assert.equal(m.phase,'results');assert.equal(m.snapshot('me').series.number,i);assert.equal(m.snapshot('me').series.standings[0].wins,i);}
 m.start('fresh',2);assert.equal(m.series.number,1);assert(m.actors.every(a=>a.alive&&a.integrity===100));m.dispose();
});
test.after(()=>terrain.dispose());
