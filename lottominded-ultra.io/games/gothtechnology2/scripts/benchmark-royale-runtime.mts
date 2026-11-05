/** Local deterministic CPU benchmark; no browser, rendering, network or GPU claim. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initializeEngine} from '../ride-core/src/engine/runtime.ts';
import {TagTerrain} from '../ride-core/src/tag/fixture.ts';
import {DowntownArena} from '../ride-core/src/royale/downtownArena.ts';
import {RoyaleMatch} from '../ride-core/src/royale/rules.ts';
import {loadFixture} from '../ride-core/src/fixtureLoader.ts';

const output=process.argv[2];
if(!output)throw Error('Pass an output JSON path.');
await initializeEngine(await readFile(new URL('../ride-core/src/engine/breadflower.wasm',import.meta.url)));
const fixture=await loadFixture(process.env.ROYALE_FIXTURE_URL??'http://127.0.0.1:8261/arcade/swoop-detroit/love-tag/swoop-detroit.json');
const terrain=new DowntownArena(await TagTerrain.create(fixture));
const summary=(a:number[])=>{const sorted=[...a].sort((x,y)=>x-y);return {p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1),total:a.reduce((x,y)=>x+y,0)};};
const costs:Record<string,{calls:number;ms:number}>={};
for(const key of ['ground','sampleGround','clear','line','route','sweep','raycastObstacle'] as const){
 const original=terrain[key].bind(terrain);costs[key]={calls:0,ms:0};
 (terrain as any)[key]=(...args:any[])=>{const start=performance.now();try{return (original as any)(...args);}finally{costs[key].calls++;costs[key].ms+=performance.now()-start;}};
}
const runs=[];
try{
 for(let run=0;run<3;run++){
  const m=new RoyaleMatch(terrain,true,10,true,true);
  for(let i=0;i<10;i++)m.add('bench-'+i,'Rider '+i,true);
  m.start('cpu-benchmark',42);
  for(const cost of Object.values(costs)){cost.calls=0;cost.ms=0;}
  const steps:number[]=[],snapshots:number[]=[];
  for(let tick=0;tick<1800&&m.phase!=='results';tick++){
   const start=performance.now();m.step();const after=performance.now();m.snapshot('bench-0');const end=performance.now();
   if(tick>=240){steps.push(after-start);snapshots.push(end-after);}
  }
  const final=m.captureEngineState();
  runs.push({run,ticks:m.tick,alive:m.actors.filter(a=>a.alive).length,shots:m.actors.reduce((n,a)=>n+a.shots,0),stepMs:summary(steps),snapshotMs:summary(snapshots),terrainInclusive:structuredClone(costs),stateHash:createHash('sha256').update(JSON.stringify(final)).digest('hex')});
  m.dispose();
 }
 const report={fixture:terrain.terrain.fixture.hash,staticBoxes:terrain.terrain.fixture.staticBoxes?.length??0,nodes:terrain.navigation.nodes.length,engine:'breadflower',actors:10,tickRate:60,seed:42,runs};
 await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{terrain.terrain.dispose();}
