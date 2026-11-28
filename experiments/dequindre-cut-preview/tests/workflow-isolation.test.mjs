import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {repoRoot,previewRoot} from '../scripts/paths.mjs';
import {assertPreviewWorkflow,PREVIEW_BRANCH,PREVIEW_WORKFLOW} from '../scripts/workflow-isolation.mjs';

test('CI stays on the exact draft branch with read-only artifact-only scope',async()=>{
 const source=await readFile(resolve(repoRoot,PREVIEW_WORKFLOW),'utf8');
 const result=assertPreviewWorkflow(source);
 assert.deepEqual(result,{productionDeployment:false,productionAcceptance:false,branch:PREVIEW_BRANCH,jobCount:1});
 for(const [from,to]of [
  [PREVIEW_BRANCH,'main'],
  ['    paths:\n','    branches-ignore: [main]\n    paths:\n'],
  ['\npermissions:','  workflow_dispatch:\n\npermissions:'],
  ['  contents: read','  contents: write'],
  ["github.ref == 'refs/heads/"+PREVIEW_BRANCH+"'","github.ref != 'refs/heads/main'"],
  ['    runs-on: ubuntu-24.04','    environment: github-pages\n    runs-on: ubuntu-24.04'],
  ['actions/upload-artifact@v4','actions/upload-pages-artifact@v4'],
  ['experiments/dequindre-cut-preview/dist/preview-manifest.json\n','experiments/dequindre-cut-preview/dist/\n'],
  ['          persist-credentials: false','          persist-credentials: true'],
 ])assert.throws(()=>assertPreviewWorkflow(source.replace(from,to)),/workflow boundary changed/,to);
});

test('CI uses three bounded browser boots and samples every route transition',async()=>{
 const suite=await readFile(resolve(previewRoot,'scripts/run-browser-suite.mjs'),'utf8');
 assert.match(suite,/\[\['--profile'\],\['--phone','--profile'\],\['--compact','--reduced-motion'\]\]/);
 assert.match(suite,/const url='http:\/\/127\.0\.0\.1:8317\/'/);
 assert.match(suite,/manifest\.productionRooms!==false/);
 const smoke=await readFile(resolve(previewRoot,'scripts/browser-smoke.mjs'),'utf8');
 const observer=smoke.indexOf('globalThis.__dequindreBrowserObservation={intervals:');
 const segment=smoke.indexOf("for(const stop of ['atwater','freight','mack'])",observer);
 assert.ok(observer>0&&segment>observer);
 assert.match(smoke.slice(segment),/travelStarted=await mark\(stop,'travel-start'\);\s+await choose\(stop\)/);
 assert.match(smoke.slice(segment),/await holdForward\(30000\)/);
 assert.match(smoke,/intervalsMs:p\.intervals,elapsedMs:p\.elapsed,markers:p\.markers/);
 assert.match(smoke,/productionAcceptance:false/);
});
