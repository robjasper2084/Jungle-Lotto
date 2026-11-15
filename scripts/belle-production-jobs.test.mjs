import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDeployment,assertManifest,liveVerified,requireTarget,REPOSITORY,GAME_PATH} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/release-health-model.mjs';
import {verifyProductionJobs} from './belle-production-jobs.mjs';
const sha='a'.repeat(40),id=123;
const run={id,head_sha:sha,head_branch:'main',event:'push',name:'Deploy GitHub Pages',repository:{full_name:REPOSITORY},head_repository:{full_name:REPOSITORY},status:'completed',conclusion:'success',run_attempt:2};
const jobs=[{id:1,name:'build',status:'completed',conclusion:'success',steps:[{name:'Tests',status:'completed',conclusion:'success'}]},{id:2,name:'deploy',status:'completed',conclusion:'success',steps:[{name:'Deploy to GitHub Pages',status:'completed',conclusion:'success'}]}];
const manifest={commit:sha,belleGame:{version:1,commit:sha,entry:GAME_PATH+'index.html',files:[{},{}]}};
test('actual completed deploy and matching source are mandatory',()=>assert.equal(assertDeployment(run,jobs,sha,id).commit,sha));
test('failed, skipped, pending or badge-only deploy never passes',()=>{
 for(const state of ['failure','skipped',null,'cancelled'])assert.throws(()=>assertDeployment(run,[jobs[0],{...jobs[1],conclusion:state}],sha,id));
 assert.throws(()=>assertDeployment(run,[jobs[0],{...jobs[1],steps:[]}],sha,id));
 assert.throws(()=>assertDeployment(run,[jobs[0],{...jobs[1],steps:[{...jobs[1].steps[0],conclusion:'failure'}]}],sha,id));
});
test('PR, wrong SHA, fork, wrong run and in-progress evidence are rejected',()=>{
 for(const change of [{event:'pull_request'},{head_branch:'branch'},{head_sha:'b'.repeat(40)},{id:124},{status:'in_progress'},{head_repository:{full_name:'other/repo'}}])assert.throws(()=>assertDeployment({...run,...change},jobs,sha,id));
 assert.throws(()=>requireTarget('short',id));assert.throws(()=>requireTarget(sha,'123/../../'));
});
test('missing and duplicate jobs fail closed',()=>{assert.throws(()=>assertDeployment(run,[],sha,id));assert.throws(()=>assertDeployment(run,[...jobs,jobs[0]],sha,id));});
test('manifest match is independent from workflow success',()=>{assert.equal(assertManifest(manifest,sha).commit,sha);assert.throws(()=>assertManifest({...manifest,commit:'b'.repeat(40)},sha));assert.throws(()=>assertManifest({...manifest,belleGame:{...manifest.belleGame,commit:'b'.repeat(40)}},sha));});
test('live verification requires jobs, bytes and a real browser on the exact SHA',()=>{
 const yes={passed:true,commit:sha};assert.equal(liveVerified({deployment:yes,publicBytes:yes,browser:yes},sha),true);
 for(const key of ['deployment','publicBytes','browser'])for(const no of [undefined,{...yes,passed:false},{...yes,commit:'b'.repeat(40)}])assert.equal(liveVerified({deployment:yes,publicBytes:yes,browser:yes,[key]:no},sha),false);
});
test('latest-attempt API pagination is complete and read-only',async()=>{
 const urls=[];const fetcher=async(url,options)=>{urls.push(url);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);return {ok:true,json:async()=>url.includes('/jobs?')?{total_count:2,jobs:url.endsWith('page=1')?[jobs[0]]:[jobs[1]]}:run};};
 const result=await verifyProductionJobs(sha,id,{fetcher,token:null});assert.equal(result.passed,true);assert.equal(urls.length,3);assert(urls[1].includes('/attempts/2/jobs'));
});
test('API denial or truncated job collection cannot be green',async()=>{
 await assert.rejects(verifyProductionJobs(sha,id,{fetcher:async()=>({ok:false,status:403}),token:null}),/403/);
 let n=0;await assert.rejects(verifyProductionJobs(sha,id,{fetcher:async()=>({ok:true,json:async()=>++n===1?run:{total_count:10,jobs:[]}}),token:null}),/Incomplete/);
});
