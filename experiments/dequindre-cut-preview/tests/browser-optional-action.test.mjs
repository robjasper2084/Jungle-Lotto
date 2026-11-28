import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {attemptOptionalCaptureAction} from '../scripts/browser-optional-action.mjs';
import {belleRoot,previewRoot} from '../scripts/paths.mjs';

test('preview restores only the native Skip hit target above the original navigation',async()=>{
 const [tip,navigation,preview]=await Promise.all([
  readFile(resolve(belleRoot,'src/belle/firstRideObjective.css'),'utf8'),
  readFile(resolve(belleRoot,'src/belle/sunsetPreview.css'),'utf8'),
  readFile(resolve(previewRoot,'src/preview.css'),'utf8'),
 ]);
 const card=tip.match(/#first-ride-objective:not\(\[hidden\]\)\{([^}]+)\}/)[1];
 const button=tip.match(/#first-ride-objective button\{([^}]+)\}/)[1];
 const map=navigation.match(/#reference-hud\{([^}]+)\}/)[1];
 assert.match(card,/pointer-events:none/);
 assert.doesNotMatch(button,/pointer-events:/,'native button inherits the original click-through card');
 assert.ok(Number(card.match(/z-index:(\d+)/)[1])>Number(map.match(/z-index:(\d+)/)[1]),'original stacking already places the optional tip above navigation');
 assert.match(preview,/\.dequindre-preview-surface #first-ride-objective button\{pointer-events:auto\}/);
 assert.doesNotMatch(preview,/#reference-hud[^}]*pointer-events:none/,'navigation remains interactive');
});

test('a blocked optional native action preserves failure and evidence without stopping later required work',async()=>{
 const obstruction={hit:{tag:'SPAN',text:'N ↑',withinSkip:false}};
 const result=await attemptOptionalCaptureAction(async()=>{throw Error('Native tap intercepted by reference navigation');},async()=>obstruction);
 assert.equal(result.completed,false);
 assert.match(result.error,/Native tap intercepted/);
 assert.deepEqual(result.obstruction,obstruction);
 let continued=false;
 await assert.rejects(async()=>{continued=true;throw Error('Required source asset check failed');},/Required source asset check failed/);
 assert.equal(continued,true,'optional failure returned normally; required failures are still thrown by their own checks');
});

test('successful optional native dismissal is recorded only after its hidden-state assertion passes',async()=>{
 let verified=false,evidenceReads=0;
 const success=await attemptOptionalCaptureAction(async()=>{verified=true;},async()=>{evidenceReads++;});
 assert.equal(success.completed,true);assert.equal(verified,true);assert.equal(evidenceReads,0);
 const failed=await attemptOptionalCaptureAction(async()=>{throw Error('The native card is still visible');});
 assert.equal(failed.completed,false);assert.match(failed.error,/still visible/);
});

test('optional evidence failure is retained and cannot relabel the original action as successful',async()=>{
 const result=await attemptOptionalCaptureAction(async()=>{throw Error('Blocked tap');},async()=>{throw Error('Page unavailable for hit test');});
 assert.equal(result.completed,false);assert.match(result.error,/Blocked tap/);assert.match(result.evidenceError,/Page unavailable/);
});
