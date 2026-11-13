import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {recordRequestFailure} from './visual-review-evidence.mjs';

const source=await readFile(new URL('./polish-browser-smoke.mjs',import.meta.url),'utf8');

test('polish uses the reviewed revalidating server instead of a duplicate no-store fixture',()=>{
 assert.match(source,/import \{createCoopStaticServer\} from '\.\/coop-static-server\.mjs'/);
 assert.match(source,/const server = createCoopStaticServer\(root\);/);
 assert.doesNotMatch(source,/createServer\(|'Cache-Control'\s*:/);
});

test('polish records every native request failure without an abort exemption',()=>{
 const start=source.indexOf("page.on('requestfailed'");assert(start>=0);
 const handler=source.slice(start,source.indexOf('\n    });',start)+8);
 assert.match(handler,/recordRequestFailure\(entry, request, requestPhase\)/);
 assert.doesNotMatch(handler,/ERR_ABORTED|startsWith|filter\(|\bif\b/);
 assert.match(source,/requestPhase = 'fixtures';/);
 assert.match(source,/finally \{\s*requestPhase = 'cleanup';/);
});

for(const phase of ['gameplay','fixtures','cleanup'])for(const error of ['net::ERR_ABORTED','net::ERR_CONNECTION_RESET']){
 test(`${phase}: ${error} is retained as a fatal raw failure`,()=>{
  const entry={errors:[],failedRequests:[]};const request={failure:()=>({errorText:error}),url:()=>'/belle/flora/iris.glb',resourceType:()=> 'fetch'};
  const message=recordRequestFailure(entry,request,phase);
  assert.equal(entry.errors[0],message);assert.equal(entry.failedRequests[0],message);
  assert.equal(entry.requestFailureDetails[0].phase,phase);assert.equal(entry.requestFailureDetails[0].errorText,error);
  assert.equal(entry.requestFailureDetails[0].resourceType,'fetch');assert(Number.isFinite(Date.parse(entry.requestFailureDetails[0].at)));
 });
}

// Exercise the actual finalization statements after browser.close, not a copied
// decision rule. Thus late cleanup events cannot preserve a stale green result.
const finalStart=source.indexOf('    entry.cleanupFailed = cleanupFailed;');
const finalEnd=source.indexOf('    await writeFile',finalStart);
assert(finalStart>source.indexOf('await bounded(browser.close()'));
assert(finalEnd>finalStart);
const finalization=source.slice(finalStart,finalEnd);
function finish({errors=[],failure,cleanupFailed=false,timedOut=false,complete=true}={}){
 const entry={functionalPassed:true,errors,failure,metrics:{initialCountdownHold:{timing:{status:'passed'}},restartedCountdownHold:{timing:{status:complete?'passed':'inconclusive'}}}};
 runInNewContext(finalization,{entry,cleanupFailed,timedOut,countdownChecks:['initialCountdownHold','restartedCountdownHold']});return entry;
}
test('complete gameplay with clean requests and cleanup retains success',()=>{const e=finish();assert.equal(e.passed,true);assert.equal(e.status,'passed');});
test('abort arriving during browser cleanup invalidates all pass flags',()=>{const e=finish({errors:['net::ERR_ABORTED /belle/gardens.glb']});assert.equal(e.functionalPassed,false);assert.equal(e.verificationComplete,false);assert.equal(e.passed,false);assert.equal(e.status,'failed');});
for(const [name,state]of Object.entries({runtime:{errors:['Shader compile failed']},failedAction:{failure:'Native button missed'},cleanup:{cleanupFailed:true},timeout:{timedOut:true}}))test(`original ${name} failure remains fatal`,()=>assert.equal(finish(state).passed,false));
test('incomplete countdown evidence stays inconclusive rather than green',()=>{const e=finish({complete:false});assert.equal(e.functionalPassed,true);assert.equal(e.verificationComplete,false);assert.equal(e.passed,false);assert.equal(e.status,'inconclusive');});
