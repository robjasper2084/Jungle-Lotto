/** Independently re-read every retained raw file and the original restored build. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CASE_MS,CLEANUP_MS} from './budget.mjs';
import {PIN,SITES,SCOPE,verifyInputs,assertSnapshot,assertObservation,assertGraphics,assertNativeEvidence,assertConsumedResponses,sha256} from './contract.mjs';
import {gridShape,assertGridPoints,assertGroundRows} from './grid-capture.mjs';
import {readRaw,parseRaw,rawJson} from './evidence.mjs';
export async function validate(checkout,evidence){
 const out=resolve(evidence,'capture'),reportBytes=await readFile(resolve(out,'report.json')),report=parseRaw(reportBytes.toString());
 for(const [key,value]of Object.entries(SCOPE))assert.equal(report[key],value,'Diagnostic scope changed');
 assert.equal(report.source,PIN.head);assert.equal(report.sourceTree,PIN.tree);assert.equal(report.diagnosticHead,process.env.DIAGNOSTIC_EXPECTED_HEAD);assert.equal(report.runId,process.env.GITHUB_RUN_ID);
 assert.equal(report.caseBudgetMs,CASE_MS);assert(report.caseElapsedMs<CASE_MS&&report.caseElapsedMs>0);assert.equal(report.cleanup?.budgetMs,CLEANUP_MS);assert(report.cleanup.elapsedMs<=CLEANUP_MS&&report.cleanup.complete);
 assert.equal(report.collectionComplete,true,'Native observation did not complete; retain this diagnostic failure');assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedRequests,[]);
 assert.deepEqual(report.launchOptions,{channel:'chrome',headless:false,args:['--use-angle=metal']});
 const viewport=report.layout==='phone'?{width:390,height:844}:{width:1280,height:800};assert(['desktop','phone'].includes(report.layout));assert.deepEqual(report.viewport,viewport);
 assert.deepEqual(report.contextOptions,{viewport,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});assert.equal(report.deviceScaleFactor,1);
 assert.match(report.actualContext.renderer,/Metal/i);assert.doesNotMatch(report.actualContext.renderer,/SwiftShader|llvmpipe|software rasterizer/i);assert.equal(report.actualContext.width,viewport.width);assert.equal(report.actualContext.height,viewport.height);assert.equal(report.actualContext.deviceScaleFactor,1);
 assertGraphics(report.initialGraphics);assert.deepEqual(report.finalGraphics,report.initialGraphics);
 const raw=new Map();for(const file of report.rawFiles){assert(!raw.has(file.file),'Duplicate raw evidence path');raw.set(file.file,await readRaw(out,file));}
 const before=await readRaw(out,report.inputs),after=await verifyInputs(checkout,evidence);assert.deepEqual(after,before,'Source, immutable input or compiled inventory changed during collection');
 for(const file of after.sourceFiles){const bytes=await readFile(resolve(evidence,'application-source',file.path));assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256,'Archived source changed');}
 assertConsumedResponses(report.consumedResponses,after,report.url);assertNativeEvidence(report.nativeEvidence,report.sites);
 assert.equal(report.sites.length,2);const totals=[];
 for(const [i,site]of SITES.entries()){
  const row=report.sites[i];assert.equal(row.id,site.id);assert.equal(row.label,site.label);assert.equal(row.guideAction,site.action);assert.equal(row.complete,true);assert.equal(row.viewObservationCalls,1);
  const observation=await readRaw(out,row.observation),post=await readRaw(out,row.after);assert.equal(observation.error,null);assert.equal(observation.id,site.id);
  assert.equal(observation.atomicFrameBefore,observation.atomicFrameAfter);assert.equal(observation.before.frames,observation.atomicFrameBefore);assert.deepEqual(observation.readResults.map(row=>({method:row.method,complete:row.complete})),[{method:'snapshot',complete:true},{method:'exterior',complete:true},{method:'viewObstructions',complete:true}]);
  assertSnapshot(observation.before,site.id);assertSnapshot(post.snapshot,site.id);assertObservation(observation.viewObstructions,site.id,observation.exterior);
  assert.deepEqual(observation.graphicsBefore,report.initialGraphics);assert.deepEqual(post.graphics,report.initialGraphics);
  assert(post.snapshot.frames>=observation.before.frames);assert(Math.hypot(post.snapshot.actor.x-observation.before.actor.x,post.snapshot.actor.y-observation.before.actor.y,post.snapshot.actor.z-observation.before.actor.z)<.1);
  const settled=report.nativeEvidence.traces['settle-'+site.id];assert(Array.isArray(settled)&&settled.length>=4);const tail=settled.slice(-4),first=tail[0];assert(tail.at(-1).frames-first.frames>=3&&tail.every(s=>s.actor.onFoot&&Math.hypot(s.actor.x-first.actor.x,s.actor.z-first.actor.z)<.015),'Original settle criterion missing');
  const grid=row.grid,shape=gridShape(observation.exterior.bounds,observation.exterior.camera);assert.deepEqual(grid.shape,shape);assert.equal(grid.constructorCalls,1);assert.equal(grid.routeCalls,0);assert.equal(grid.sweepRequests,0);assert.equal(grid.viewRequests,0);assert.equal(grid.complete,true);
  assert.equal(grid.receipt.spacing,2);assert.equal(grid.receipt.maximumSearchAttempts,64);assert.deepEqual(grid.receipt.plans,[]);assert.deepEqual(grid.receipt.rejectedSweeps,[]);assert.deepEqual(grid.receipt.rejectedProspectivePaths,[]);
  let offset=0;
  for(const [index,file]of grid.batches.entries()){
   assert(raw.has(file.file),'Grid raw file absent from complete raw inventory');const batch=await readRaw(out,file);assert.equal(batch.index,index);assert.equal(batch.offset,offset);assert.equal(file.index,index);assert.equal(file.offset,offset);assert.equal(file.points,batch.points.length);assert.equal(batch.error,null);assert.equal(batch.complete,true);
   assertGridPoints(batch.points,shape,offset);assertGroundRows(batch.points,batch.rows);offset+=batch.points.length;
  }
  assert.equal(offset,shape.count);assert.equal(grid.totalPoints,shape.count);
  assert.equal(report.readCalls.filter(call=>call.method==='viewObstructions'&&call.id===site.id&&call.complete).length,1);
  assert(report.readCalls.every(call=>['snapshot','motion','exterior','viewObstructions'].includes(call.method)&&call.complete));
  totals.push({id:site.id,originalGridPoints:offset,batches:grid.batches.length,boxes:observation.viewObstructions.boxes.length,selectedTreeInstances:observation.viewObstructions.selectedTreeInstances,unsupported:observation.viewObstructions.unsupported});
 }
 const receipt={version:1,...SCOPE,collectionComplete:true,source:PIN.head,tree:PIN.tree,diagnosticHead:report.diagnosticHead,reportSha256:sha256(reportBytes),rawFiles:raw.size,build:after.build,artifact:after.artifact,sites:totals};
 await writeFile(resolve(evidence,'input-source-after.json'),rawJson(after,true),{flag:'wx'});await writeFile(resolve(evidence,'preflight-verification.json'),rawJson(receipt,true),{flag:'wx'});return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [checkout,evidence]=process.argv.slice(2);try{const receipt=await validate(resolve(checkout),resolve(evidence));console.log(JSON.stringify(receipt));}
 catch(error){await writeFile(resolve(evidence,'preflight-validation-error.json'),rawJson({diagnosticOnly:true,collectionComplete:false,error:String(error?.stack||error)},true));throw error;}
}
