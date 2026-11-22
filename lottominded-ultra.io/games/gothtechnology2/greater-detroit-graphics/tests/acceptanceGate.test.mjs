import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAcceptance,evidenceFiles,hasExactHeadPeerApproval} from '../src/acceptanceGate.mjs';
const head='a'.repeat(40),hash='b'.repeat(64);
const evidence=(path)=>({path,sha256:hash});
const camera={position:[0,3,4],direction:[0,0,-1],fovDegrees:60};
function completeClaim(){
 const screenshot=(name)=>({reviewed:true,baseline:{artifact:evidence(name+'/before.png'),camera},candidate:{artifact:evidence(name+'/after.png'),camera}});
 const build=(name)=>({result:'success',headSha:head,artifact:evidence(name+'/build.log')});
 const route=(name)=>({result:'pass',bothDirections:true,physicalSeam:true,noLightPops:true,noClipping:true,noShaderHitches:true,noNetworkErrors:true,artifact:evidence(name+'/traversal.json')});
 const perf=(name,mean,p95)=>({device:name+' dedicated test device',browser:'Chromium',durationSeconds:600,meanFrameMs:mean,p95FrameMs:p95,artifact:evidence(name+'/frames.json')});
 return {headSha:head,conditions:{date:'2026-09-15',solarHour:16.7,weather:'clear'},
 screenshots:{'belle-isle':screenshot('belle'),'swoop-detroit':screenshot('swoop'),elmwood:screenshot('elmwood')},
 builds:{'belle-isle':build('belle'),'swoop-detroit':build('swoop'),elmwood:build('elmwood')},
 traversal:{'belle-swoop':route('belle-swoop'),'swoop-elmwood':route('swoop-elmwood')},
 performance:{desktop:perf('desktop',13.5,16.6),mobile:perf('mobile',28,33)},
 lut:{state:'deferred'}};
}
test('no report is always blocked',()=>assert.ok(validateAcceptance(undefined,head).length));
test('valid manifest claims can pass STRUCTURAL validation only; CLI must check hashes and review',()=>{
 const report=completeClaim();
 assert.deepEqual(validateAcceptance(report,head),[]);
 assert.equal(evidenceFiles(report).length,13);
});
test('stale head is a hard blocker',()=>assert.ok(validateAcceptance(completeClaim(),'c'.repeat(40)).some(x=>x.includes('exact head'))));
test('different screenshot angle is a hard blocker',()=>{const r=completeClaim();r.screenshots.elmwood.candidate.camera={...camera,position:[3,3,4]};assert.ok(validateAcceptance(r,head).some(x=>x.includes('Different camera')));});
test('no playable district seam is a hard blocker',()=>{const r=completeClaim();r.traversal['belle-swoop'].physicalSeam=false;assert.ok(validateAcceptance(r,head).some(x=>x.includes('seamless traversal')));});
test('one-way or network-error crossing is a blocker',()=>{const r=completeClaim();r.traversal['swoop-elmwood'].bothDirections=false;r.traversal['swoop-elmwood'].noNetworkErrors=false;assert.ok(validateAcceptance(r,head).some(x=>x.includes('swoop-elmwood')));});
test('10 minute requirement and p95 budgets are enforced',()=>{const r=completeClaim();r.performance.desktop.p95FrameMs=18;r.performance.mobile.durationSeconds=590;const issues=validateAcceptance(r,head);assert.ok(issues.some(x=>x.includes('desktop')));assert.ok(issues.some(x=>x.includes('mobile')));});
test('unhashed media and missing builds are blocked',()=>{const r=completeClaim();r.screenshots.elmwood.baseline.artifact.sha256='fake';r.builds['swoop-detroit'].result='pending';const issues=validateAcceptance(r,head);assert.ok(issues.some(x=>x.includes('baseline screenshot')));assert.ok(issues.some(x=>x.includes('swoop-detroit')));});
test('LUT cannot be applied without base stability and verified capture',()=>{const r=completeClaim();r.lut={state:'applied',baseStabilized:false};assert.ok(validateAcceptance(r,head).some(x=>x.includes('LUT')));});
test('approval must come from independent user on exact same head, latest state wins',()=>{
 const review=(login,state,commit_id)=>({user:{login},state,commit_id});
 assert.equal(hasExactHeadPeerApproval([],head,'owner'),false);
 assert.equal(hasExactHeadPeerApproval([review('owner','APPROVED',head)],head,'owner'),false);
 assert.equal(hasExactHeadPeerApproval([review('peer','APPROVED','c'.repeat(40))],head,'owner'),false);
 assert.equal(hasExactHeadPeerApproval([review('peer','APPROVED',head),review('peer','CHANGES_REQUESTED',head)],head,'owner'),false);
 assert.equal(hasExactHeadPeerApproval([review('peer','APPROVED',head)],head,'owner'),true);
});
