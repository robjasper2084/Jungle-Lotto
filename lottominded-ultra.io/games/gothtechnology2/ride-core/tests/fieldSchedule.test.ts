import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeEngine,EngineContext} from '../src/engine/runtime.ts';
import {fieldAt,PROTECTION,DEADLINE} from '../src/royale/rules.ts';
import {FIELD_HOLDS,FIELD_CLOSES,FIELD_DURATION,fieldStageAt} from '../src/royale/fieldSchedule.ts';

await initializeEngine(await readFile(new URL('../src/engine/breadflower.wasm',import.meta.url)));

test('field holds for looting, closes gradually, and gives a fresh warning before each stage',()=>{
 let elapsed=0;
 assert.equal(FIELD_DURATION,600);
 assert.equal(fieldStageAt(0).remaining,60);
 for(let phase=0;phase<5;phase++){
  const tick=PROTECTION+elapsed*60,hold=FIELD_HOLDS[phase],close=FIELD_CLOSES[phase];
  const start=fieldStageAt(tick),lastHold=fieldStageAt(tick+hold*60-1),closing=fieldStageAt(tick+hold*60);
  assert.equal(start.phase,phase);assert(!start.closing);assert.equal(start.remaining,hold);
  assert.equal(lastHold.fraction,0);assert(!lastHold.closing);
  assert(closing.closing);assert.equal(closing.remaining,close);assert.equal(closing.fraction,0);
  assert.equal(fieldStageAt(tick+(hold+close/2)*60).fraction,.5);
  elapsed+=hold+close;
 }
 const end=fieldStageAt(PROTECTION+DEADLINE);assert.equal(end.fraction,1);assert.equal(end.remaining,0);
});

test('compiled server matches client field over the whole longer round and restores after the old deadline',()=>{
 const core=new EngineContext(),rejoined=new EngineContext();
 const radii=[1525,1220,763,247,52,0],zones=Array.from({length:5},()=>({x:0,z:0}));
 core.checked('add',0);core.checked('add',1);core.checked('start',3);
 zones.forEach((p,i)=>core.checked('zone',i,p.x,p.z));core.checked('radii',...radii);
 for(let i=0;i<2;i++)core.checked('pose',i,0,0,0,0,0,1);
 let previous=radii[0];
 try{
  for(let tick=1;tick<=PROTECTION+DEADLINE;tick++){
   core.checked('begin');core.checked('rules');core.checked('end');
   if(tick%60===0||tick===PROTECTION+DEADLINE){
    const field=fieldAt(tick,3,zones,radii);
    for(const [i,k]of ['x','z','radius','nextRadius','remaining','phase','damage'].entries())
     assert(Math.abs(core.call('field',i)-field[k as keyof typeof field])<1e-6,k+' at '+tick);
    assert(field.radius<=previous);assert(previous-field.radius<5,'downtown boundary closes at a controlled pace');previous=field.radius;
   }
   if(tick===30000){rejoined.restore(core.capture());assert.deepEqual(rejoined.capture(),core.capture());}
   if(tick>30000){rejoined.checked('begin');rejoined.checked('rules');rejoined.checked('end');}
  }
  assert.equal(core.call('state',0),PROTECTION+DEADLINE);assert.equal(core.call('state',1),3);
  assert.equal(core.call('state',3),3);assert.deepEqual(rejoined.capture(),core.capture());
 }finally{core.dispose();rejoined.dispose();}
});
