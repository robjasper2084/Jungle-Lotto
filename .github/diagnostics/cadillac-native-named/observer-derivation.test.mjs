import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {derive as originalDerive} from './observer-original.mjs';
import {derive} from './belle-cpu-observer.mjs';
import {validateNamedSubmission} from './validate-named-submission.mjs';

// The path below is overridden by the environment so this review package can
// run beside either the recovered checkout or a separate workflow checkout.
const driverPath=process.env.STRICT_DRIVER_PATH??new URL('../../Jungle-Lotto/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/sustained-ride-profile.mjs',import.meta.url);
const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');

test('the only difference from the existing CPU-derived driver is its extra named observation query',async()=>{
 assert.equal(blob(await readFile(new URL('./observer-original.mjs',import.meta.url))),'007ef71a678d52e103492d5c4ecf74f38c3150af');
 const bytes=await readFile(driverPath),source=bytes.toString('utf8');
 assert.equal(blob(bytes),'c722b5810a7693e5ece72ed00b4401e7cde7267a');
 const old=originalDerive(source),next=derive(source);
 assert.equal(old.split("'/?profile=1'").length,2);
 assert.equal(next,old.replace("'/?profile=1'","'/?profile=1&renderSubmission=1'"));
 assert.equal(next.split("'/?profile=1&renderSubmission=1'").length,2);
 assert.equal(blob(await readFile(driverPath)),blob(bytes),'The tracked driver is read only');
 assert.throws(()=>derive(source+'\n'),/pinned Git blob/);
});

function report(){
 const head='75906273c0cd414c0d004320fc6f654b4783e5b1';
 const coverage=()=>({installed:true,status:'complete',context:'available',hooks:[
  {name:'renderer.renderBufferDirect',status:'installed'},{name:'scene.updateMatrixWorld',status:'installed'}],notes:[]});
 const settings=()=>({quality:'high',effectiveQuality:'high',pixelRatio:1,diagnosticReduction:false,world:{performanceDiagnostic:false}});
 return {sourceHead:head,device:'desktop',mode:'full',requestedSeconds:90,renderBackend:'angle-metal',actualGpu:{renderer:'ANGLE Metal Apple Paravirtual'},gpsRegression:{passed:true},
  passed:false,baselinePassed:false,frameQualityAccepted:false,releasePerformanceVerified:false,
  profile:{stopReason:'trusted-W-keyup',settingsAtStart:settings(),settings:settings(),over250ms:5,metrics:{frameMs:{p95:83.9}},
   buildAtStart:{status:'unavailable',reason:'manual comparison not selected'},build:{status:'unavailable',reason:'manual comparison not selected'},
   submissionInstrumentation:{atStart:coverage(),atFinish:coverage()},submissionDiagnostics:{profiledCallbacks:10,operations:{directDraw:{calls:120,cpuMs:200}}},
   renderDiagnostics:{profiledCallbacks:10,topRenderWork:[{submission:{topDirectDraws:[{cpuMs:2,object:'Mapped object',material:'Original surface'}]}}]}}};
}

test('evidence validation retains raw failures and does not rewrite the report',()=>{
 const input=report(),before=structuredClone(input),result=validateNamedSubmission(input,input.sourceHead);
 assert.deepEqual(input,before);assert.equal(result.originalResult.passed,false);assert.equal(result.originalResult.p95,83.9);assert.equal(result.originalResult.over250ms,5);
 assert.equal(result.namedDrawRows,1);assert.match(result.scope,/not native release acceptance/);
});

test('missing named/core evidence fails and partial noncore GL coverage remains explicit',()=>{
 for(const alter of [
  r=>{r.profile.submissionInstrumentation.atStart=null;},
  r=>{r.profile.submissionInstrumentation.atFinish.hooks[0].status='failed';},
  r=>{r.profile.submissionDiagnostics.profiledCallbacks=0;},
  r=>{r.profile.renderDiagnostics.topRenderWork[0].submission.topDirectDraws=[];},
  r=>{r.profile.loopDiagnostics={status:'available'};},r=>{r.profile.build.reason='build marker could not be read';},
  r=>{r.mode='diagnostic';},r=>{r.requestedSeconds=30;},r=>{r.profile.settings.diagnosticReduction=true;},
 ]){const input=report();alter(input);assert.throws(()=>validateNamedSubmission(input,input.sourceHead));}
 const input=report();input.profile.submissionInstrumentation.atFinish.status='partial';
 input.profile.submissionInstrumentation.atFinish.hooks.push({name:'gl.example',status:'missing',reason:'Not supported'});
 const result=validateNamedSubmission(input,input.sourceHead);assert.equal(result.submissionCoverage.atFinish.status,'partial');
 assert.equal(result.submissionCoverage.atFinish.hooks.at(-1).reason,'Not supported');
});
