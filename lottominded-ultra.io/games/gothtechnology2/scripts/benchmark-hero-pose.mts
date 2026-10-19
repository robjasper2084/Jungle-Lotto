import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {Hero} from '../swoop-source/src/detroit/actors.ts';
import {heroAssets} from '../swoop-source/src/detroit/heroTestAssets.ts';
import {RIDER_CHOICES} from '../swoop-source/src/detroit/riderChoices.ts';
import {createPose} from '../swoop-source/src/detroit/controller.ts';

// CPU-only pose comparison; excludes asset loading, GPU skinning and rendering.
const assets=await heroAssets(),rows=[];
const pose=(mode:number,i:number)=>({...createPose(),x:4,z:-3,headingY:i*.037,
 speed:mode===2?-2:mode===0?8:2,footMode:mode===0?0:mode===6?3:2,
 footBlend:mode===0?0:mode===6?.5:1,footTime:i/60,footPhase:i/96,footCycle:i/96,
 footCrouch:mode===3?1:0,footProne:mode===4?1:0,crashBlend:mode===5?.6:0,
 crashDrop:mode===5?.4:0,crashRoll:mode===5?.5:0,parkX:9,parkY:0,parkZ:-3,
 groundPitch:mode===0?.07:0,groundRoll:mode===0?-.04:0,bodyTwist:.08});
for(const {id}of RIDER_CHOICES){
 const h=new Hero(assets,undefined,id);
 try{for(let mode=0;mode<7;mode++){
  for(let i=0;i<48;i++)h.apply(pose(mode,i));
  const ms:number[]=[];
  for(let i=0;i<240;i++){const p=pose(mode,i),start=performance.now();h.apply(p);ms.push(performance.now()-start);}
  const matrices:number[][]=[];
  for(let i=0;i<48;i++){h.apply(pose(mode,i));h.root.updateMatrixWorld(true);matrices.push(h.bones.flatMap(b=>b.o.matrixWorld.toArray()).concat(h.vehicle.matrixWorld.toArray()));}
  ms.sort((a,b)=>a-b);rows.push({id,mode,p50:ms[120],p95:ms[228],matrices});
 }}finally{h.dispose();}
}
await writeFile(process.argv[2],JSON.stringify(rows));
console.log(JSON.stringify(rows.map(({id,mode,p50,p95})=>({id,mode,p50,p95}))));
