/** Generates a separate diagnostic from immutable source. It never edits the
 * original walk driver, six-view comparison, application, build or thresholds. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sourceSha,sourcePins,sha256,replaceOnce,betweenOnce} from './contract.mjs';

export async function buildDriver({game,out=resolve(import.meta.dirname,'generated')}={}){
 assert(game,'STAGED_LANDMARK_GAME_DIR is required');game=resolve(game);out=resolve(out);await mkdir(out,{recursive:true});
 const receipts=[];let original;
 for(const [name,expected] of Object.entries(sourcePins)){
  const bytes=await readFile(resolve(game,'scripts',name));assert.equal(sha256(bytes),expected,'Pinned source changed: '+name);
  receipts.push({file:'scripts/'+name,sha256:expected,bytes:bytes.length});if(name==='staged-landmark-walk-proof.mjs')original=bytes.toString('utf8');
 }
 const extension=await readFile(resolve(import.meta.dirname,'extension.txt'),'utf8');
 let derived=replaceOnce(original,"const AQUARIUM='107227742',CONSERVATORY='107310050';",`import {exteriorPlan,galleryViewport,segmentWaypoints,assetPins,modelBounds,projectedModel,observedModelTransform,worldPoint,headingTo,assertExteriorEvidence,assertGallerySettings} from ${JSON.stringify(pathToFileURL(resolve(import.meta.dirname,'contract.mjs')).href)};\nimport {installExteriorRendererLifecycle,observeExteriorPageSignals} from ${JSON.stringify(pathToFileURL(resolve(import.meta.dirname,'renderer-lifecycle.mjs')).href)};\nconst AQUARIUM='107227742',CONSERVATORY='107310050';`);
 derived=replaceOnce(derived,"const viewport=layout==='phone'?{width:390,height:844}:{width:1280,height:800},started=Date.now();",'const viewport=galleryViewport(layout),started=Date.now();');
 derived=replaceOnce(derived,"'output/staged-landmark-walk-proof'","'output/pr213-exterior'");
 derived=replaceOnce(derived,' async function exercise(){',extension+'\n async function exercise(){');
 derived=replaceOnce(derived,'  await context.addInitScript(()=>{','  await context.addInitScript(installLandmarkComparisonObserver,{historyLimit:8});\n  await context.addInitScript(installExteriorRendererLifecycle);\n  await context.addInitScript(()=>{');
 derived=replaceOnce(derived,'  page=await context.newPage();page.setDefaultTimeout(90_000);client=await context.newCDPSession(page);',
  '  page=await context.newPage();page.setDefaultTimeout(90_000);client=await context.newCDPSession(page);\n  report.rendererPageSignals=observeExteriorPageSignals(page);report.rendererLifecycle={status:\'not-collected\'};');
 derived=replaceOnce(derived,"   if(!gl||gl.isContextLost()||!canvas.width||!canvas.height)return no(Error('A live game WebGL2 canvas is required'));",
  "   const contextLost=gl?gl.isContextLost():null,emptyBitmap=canvas?(!canvas.width||!canvas.height):null;\n   try{window.__exteriorRendererLifecycle?.captureGuard(canvas,gl,{missingContext:!gl,contextLost,emptyBitmap});}catch{/* Observation cannot change the original guard. */}\n   if(!gl||contextLost||!canvas.width||!canvas.height)return no(Error('A live game WebGL2 canvas is required'));");
 derived=replaceOnce(derived,"   try{report.nativeEvidence=await bounded(page.evaluate(()=>window.__stagedWalkNativeEvidence),10_000,'Native evidence collection');}",
  "   try{const collected=await bounded(page.evaluate(()=>{\n    let lifecycle;try{lifecycle=window.__exteriorRendererLifecycle?{status:'available',...window.__exteriorRendererLifecycle.snapshot()}:{status:'unavailable',reason:'Lifecycle observer missing'};}catch(error){lifecycle={status:'unavailable',reason:String(error)};}\n    return{native:window.__stagedWalkNativeEvidence,lifecycle};\n   }),10_000,'Native evidence collection');report.nativeEvidence=collected.native;report.rendererLifecycle=collected.lifecycle;}");
 derived=replaceOnce(derived,'  await bounded(browser?.close(),10_000,\'Browser cleanup\')',
  "  if(report.rendererPageSignals)report.rendererPageSignals.cleanupStartedAtMs=Date.now();\n  await bounded(browser?.close(),10_000,'Browser cleanup')");
 derived=replaceOnce(derived,"['click','keydown','keyup','pointerdown','pointerup']","['click','keydown','keyup','pointerdown','pointerup','input','change']");
 derived=replaceOnce(derived,'     phase:e.phase,at:performance.now()});',"     phase:e.phase,value:element?.value??null,settingsOpen:document.querySelector('#settings')?.open===true,at:performance.now()});");
 derived=replaceOnce(derived,'  report.initialGraphics=await page.evaluate(', '  await configureExterior();\n  report.initialGraphics=await page.evaluate(');
 derived=betweenOnce(derived,"  await guideAction(AQUARIUM,'Travel to entrance');await setFirstPerson(false);await capture('aquarium-exterior',AQUARIUM);",'  report.finalGraphics=', '  await exteriorRoute();\n\n');
 derived=replaceOnce(derived,'assertNativeEvidence(report.nativeEvidence);','assertExteriorEvidence(report.nativeEvidence,exteriorViews,layout);');
 derived=replaceOnce(derived,'  assert.equal(report.passages.length,2);assert.equal(report.contacts.length,2);assert.equal(report.captures.length,8);\n  assert(report.contacts.every(contact=>contact.passed),\'A sampled contact did not satisfy the native visual/collider agreement gate\');',"  assert.equal(report.captures.length,exteriorViews.length,'Every additional exterior view is required');");
 derived=replaceOnce(derived,'/** Opt-in PR213 evidence in the actual built island.','/** GENERATED ADDITIVE EXTERIOR DIAGNOSTIC. Original walk acceptance remains unchanged.');
 derived=replaceOnce(derived,'passed:report.passed,source,layout,phase:report.phase','passed:report.passed,source,layout:report.layout,phase:report.phase');
 const output=resolve(out,'exterior-driver.mjs');await writeFile(output,derived);
 const diagnosticRoot=resolve(import.meta.dirname,'../../..'),diagnosticFiles=[];
 const diagnosticIdentity={expectedHead:process.env.PR213_DIAGNOSTIC_SHA??null,head:null,tree:null,trackedClean:null};
 const git=args=>execFileSync('git',args,{cwd:diagnosticRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{diagnosticIdentity.head=git(['rev-parse','HEAD']);diagnosticIdentity.tree=git(['rev-parse','HEAD^{tree}']);diagnosticIdentity.trackedClean=git(['status','--porcelain','--untracked-files=no'])==='';}
 catch(error){if(diagnosticIdentity.expectedHead)throw error;}
 if(diagnosticIdentity.expectedHead){assert.equal(diagnosticIdentity.head,diagnosticIdentity.expectedHead);assert.equal(diagnosticIdentity.trackedClean,true,'Diagnostic checkout changed');}
 for(const path of ['contract.mjs','build-driver.mjs','extension.txt','contract.test.mjs','renderer-lifecycle.mjs','renderer-lifecycle.test.mjs','prepare-dist.mjs','README.md','ground/audit-ground.mjs','ground/source-pins.json','ground/README.md'].map(name=>'.github/diagnostics/pr213-exterior/'+name).concat('.github/workflows/belle-pr213-exterior-diagnostic.yml')){
  const bytes=await readFile(resolve(diagnosticRoot,path)),copy=resolve(out,'diagnostic-source',path);await mkdir(dirname(copy),{recursive:true});await writeFile(copy,bytes);
  diagnosticFiles.push({file:path,sha256:sha256(bytes),bytes:bytes.length});
 }
 const receipt={sourceSha,sourceFilesUnmodified:true,diagnosticIdentity,diagnosticFiles,originalWalkSha256:sha256(original),derivedSha256:sha256(derived),extensionSha256:sha256(extension),receipts,output,scope:'Separate eight-view exterior route. Existing six matched views, eight walk captures and original performance/control gates are unchanged.'};
 await writeFile(resolve(out,'driver-provenance.json'),JSON.stringify(receipt,null,2)+'\n');
 for(const row of receipts)assert.equal(sha256(await readFile(resolve(game,row.file))),row.sha256,'An original source changed during generation');
 return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const receipt=await buildDriver({game:process.env.STAGED_LANDMARK_GAME_DIR,out:process.env.PR213_EXTERIOR_GENERATED});console.log(JSON.stringify(receipt,null,2));
}
