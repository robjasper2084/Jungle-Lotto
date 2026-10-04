import {readFile,writeFile} from 'node:fs/promises';
import {TagMatch,TagTerrain,neutralCommand} from '@digital-static/ridecore/tag';
import assert from 'node:assert/strict';
const evidence=[];const difficulty=process.env.TAG_DIFFICULTY??"normal";
for(const product of ['swoop-detroit','elmwood-explorer'])for(const rules of ['classic','spread']){
 const f=JSON.parse(await readFile(new URL('../fixtures/'+product+'.json',import.meta.url),'utf8')),terrain=await TagTerrain.create(f),start=performance.now(),match=new TagMatch(f,terrain,rules,difficulty);
 match.addActor('human','Review rider');for(let i=1;i<4;i++)match.addActor('bot-'+i,'Bot '+i,true);match.start('actual-'+product+'-'+rules);
 const positions=match.actors.map(a=>({...a.controller.poseValue})),distances=[0,0,0,0],visited=match.actors.map(()=>new Set()),illegal=[0,0,0,0];let seq=0;
 for(let n=0;n<11200&&match.phase!=='results';n++){
  match.command('human',{...neutralCommand(match.round,++seq,match.tick),throttle:n<450?.65:0,steer:n>230&&n<330?.15:0});match.step();
  match.actors.forEach((a,i)=>{const p=a.controller.poseValue;distances[i]+=Math.hypot(p.x-positions[i].x,p.z-positions[i].z);Object.assign(positions[i],p);visited[i].add(match.navigation.nearest(p));if(!terrain.legal(p))illegal[i]++;});
 }
 evidence.push({product,rules,difficulty,phase:match.phase,simulatedSeconds:match.time,elapsedMs:performance.now()-start,graphNodes:match.navigation.nodes.length,distances,visited:visited.map(s=>s.size),illegalTicks:illegal,resets:match.actors.map(a=>a.resets),tags:match.actors.map(a=>a.tags),winners:match.winners});terrain.dispose();console.log(JSON.stringify(evidence.at(-1)));
}
await writeFile(new URL('../../docs/love-tag/evidence/actual-map-ai-'+difficulty+'.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),kind:'canonical-duration actual fixture headless simulation, not browser enjoyment proof',evidence},null,2));
// The intentionally steered human may leave the lane. Bots must remain legal;
// a process exiting successfully after printing a failure is not acceptance.
for(const result of evidence){
 assert.equal(result.phase,'results',result.product+' '+result.rules+' must finish');
 assert.ok(result.illegalTicks.slice(1).every(n=>n===0),JSON.stringify(result));
 assert.ok(result.resets.slice(1).every(n=>n===0),JSON.stringify(result));
 if(result.rules==='classic'){
  assert.ok(result.distances.slice(1).every(n=>n>250),JSON.stringify(result));
  assert.ok(result.visited.slice(1).every(n=>n>20),JSON.stringify(result));
 }
}
console.log('PASS: both real maps, both rules, no illegal bot ticks or bot resets.');
