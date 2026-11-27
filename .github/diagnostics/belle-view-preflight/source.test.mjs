import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {PIN,GAME,verifySource,sha256} from './contract.mjs';
const bundle=fileURLToPath(new URL('.',import.meta.url)),workflow=await readFile(resolve(bundle,'../../workflows/belle-native-view-preflight.yml'),'utf8');
const app=process.env.PREFLIGHT_APP_DIR;assert(app,'Source controls require the exact fixed-source checkout');
const originalWorkflow=await readFile(resolve(app,'.github/workflows/belle-staged-architecture-native.yml'),'utf8');
const harness=await readFile(resolve(bundle,'preflight.mjs'),'utf8'),grid=await readFile(resolve(bundle,'grid-capture.mjs'),'utf8');
test('all original source pins bind the exact reviewed commit/tree and unchanged checkout',async()=>{const receipt=await verifySource(app);assert.equal(receipt.head,PIN.head);assert.equal(receipt.tree,PIN.tree);assert.equal(receipt.sourceFiles.length,13);});
test('the original staged four build commands and GLB/source marker block are copied exactly',()=>{
 const commands='          npm ci\n          npm run check\n          npm test\n          npm run build';assert(originalWorkflow.includes(commands));assert(workflow.includes(commands));
 const extract=text=>text.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/)[1];assert.equal(extract(workflow),extract(originalWorkflow));
 assert.match(workflow,/VITE_STAGED_BELLE_ARCHITECTURE: '1'/);assert.match(workflow,/STAGED_LANDMARK_SOURCE_SHA: \$\{\{ steps\.pins\.outputs\.head \}\}/);
});
test('only the new diagnostic namespace triggers this workflow and the same-run artifact is required',()=>{
 assert.match(workflow,/paths:\n      - '\.github\/workflows\/belle-native-view-preflight\.yml'\n      - '\.github\/diagnostics\/belle-view-preflight\/\*\*'/);
 assert.match(workflow,/artifact_id: \$\{\{ steps\.upload\.outputs\.artifact-id \}\}/);assert.match(workflow,/artifact_sha256: \$\{\{ steps\.upload\.outputs\.artifact-digest \}\}/);
 assert.match(workflow,/PREFLIGHT_BUILD_ARTIFACT_ID: \$\{\{ needs\.build-staged\.outputs\.artifact_id \}\}/);
 assert.match(workflow,/fail-fast: false/);assert.match(workflow,/layout: \[desktop, phone\]/);assert.doesNotMatch(workflow,/pull_request_target|secrets\.|contents: write|actions: write/);
});
test('hidden-file uploads are scoped to explicit evidence directories containing only source-bound archives',async()=>{
 const uploads=workflow.split(/      - uses: actions\/upload-artifact@v4/).slice(1),withHidden=uploads.filter(block=>/include-hidden-files: true/.test(block));
 assert.equal(withHidden.length,2);assert.deepEqual(withHidden.map(block=>block.match(/          path: ([^\n]+)/)[1]),['build-evidence/','evidence/']);
 assert(uploads.filter(block=>!block.includes('include-hidden-files: true')).every(block=>block.includes('path: app/lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/dist/')));
 const directory=await mkdtemp(resolve(tmpdir(),'belle-preflight-source-archive-'));
 try{
  const receipt=await verifySource(app,{archiveTo:directory}),expected=receipt.sourceFiles.map(row=>'application-source/'+row.path).concat('application-commit.txt').sort(),actual=[];
  async function walk(path,prefix=''){for(const entry of await readdir(path,{withFileTypes:true})){assert(!entry.isSymbolicLink());if(entry.isDirectory())await walk(resolve(path,entry.name),prefix+entry.name+'/');else actual.push(prefix+entry.name);}}
  await walk(directory);assert.deepEqual(actual.sort(),expected);
  for(const row of receipt.sourceFiles)assert.equal(sha256(await readFile(resolve(directory,'application-source',row.path))),row.sha256);
  assert(expected.includes('application-source/.github/workflows/belle-staged-architecture-native.yml'),'Pinned original workflow must survive the scoped hidden-file upload');
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('preflight imports the original constructor and exposes no route execution, render override or gameplay setter',()=>{
 assert.match(harness,/await import\(pathToFileURL\(resolve\(game,'scripts\/staged-landmark-exterior-proof\.mjs'\)\)\.href\)/);
 for(const code of [harness,grid])assert.doesNotMatch(code,/(?:planner|result)\.route\s*\(|\.routeSweeps\s*\(|setPosition|teleport|dispatchEvent|dispatchKeyEvent|requestAnimationFrame\s*=|onBeforeRender\s*=|\.visible\s*=|\.collision\s*=/);
 assert.doesNotMatch(harness,/keyboard\.(?:down|press)\(['"](?:w|a|s|d|Arrow)/);assert.doesNotMatch(harness,/\.screenshot\(|captureScreenshot|canvas\.toDataURL|\.render\(/);
 assert.match(grid,/View preflight forbids route\/body-sweep queries/);assert.match(grid,/constructor cannot query it/);
});
test('native context and original settle criterion retain original semantics',async()=>{
 const original=await readFile(resolve(app,GAME,'scripts/staged-landmark-walk-proof.mjs'),'utf8');
 for(const fragment of ["{width:390,height:844}","{width:1280,height:800}","reducedMotion:'reduce',serviceWorkers:'block'","row.actor.onFoot&&row.actor.footBlend>.99","row.frames-first.frames>=3&&tail.every(s=>Math.hypot(s.actor.x-first.actor.x,s.actor.z-first.actor.z)<.015)"]){assert(original.includes(fragment));assert(harness.includes(fragment));}
 assert.match(harness,/polling:100/);assert.match(harness,/channel:'chrome',headless:false,args:\['--use-angle=metal'\]/);assert.doesNotMatch(harness,/isMobile:|hasTouch:|selectOption|\.fill\(/);
});
test('syntax is valid for every production module before any native execution',()=>{
 for(const name of ['preflight.mjs','contract.mjs','grid-capture.mjs','budget.mjs','evidence.mjs','archive-source.mjs','validate-evidence.mjs'])execFileSync(process.execPath,['--check',resolve(bundle,name)],{stdio:'pipe'});
});
