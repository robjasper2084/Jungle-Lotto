/** Actual shipped-game smoke. Trusted UI only; no seeded race state or patched simulation. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {recordRequestFailure} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/visual-review-evidence.mjs';
import {recordEvidenceError,observeEvidence,cleanupCinematicCase,finalizeCinematicCase,finalizeCinematicReport,waitForCinematicFlightFrame} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/scripts/cinematic-review-evidence.mjs';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {verifyBelleRelease,GAME_PATH} from './belle-release-pages.mjs';
import {liveVerified} from '../lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/public/release-health-model.mjs';
const repository=resolve(import.meta.dirname,'..');
const require=createRequire(resolve(repository,'lottominded-ultra.io/games/gothtechnology2/package.json'));
const {chromium,expect}=require('@playwright/test');
const base='https://robjasper2084.github.io/Jungle-Lotto/';
const target=new URL(process.env.BELLE_GAME_URL||GAME_PATH,base);
const local=target.protocol==='http:'&&target.hostname==='127.0.0.1';
assert(local||target.href===new URL(GAME_PATH,base).href,'Only the actual production game or local build is allowed');
const sha=process.env.EXPECTED_MERGE_SHA||process.env.GITHUB_SHA;
assert.match(sha||'',/^[0-9a-f]{40}$/,'Exact tested commit is required');
const checkout=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
assert.equal(checkout,sha,'Reported source must be the actual checkout');
const output=resolve(process.env.BELLE_CINEMATIC_OUTPUT||'artifacts/belle-cinematic');await mkdir(output,{recursive:true});
const selected=process.env.BELLE_CINEMATIC_CASE||'all';
const cases=[{name:'desktop',width:1440,height:960},{name:'compact-landscape',width:390,height:340},{name:'small-phone',width:320,height:568}].filter(c=>selected==='all'||c.name===selected);
assert(cases.length>0,'Unknown browser case');
const report={commit:sha,checkout,runId:process.env.GITHUB_RUN_ID??null,runAttempt:process.env.GITHUB_RUN_ATTEMPT??null,errors:[],game:target.href,startedAt:new Date().toISOString(),passed:false,liveVerified:false,scope:local?'Candidate build, not production publication':'Actual public build and browser',hardwarePerformanceCertified:false,manualScreenshotReviewRequired:true,cases:[]};
let browser;
try{
 if(!local){report.deployment=JSON.parse(await readFile('belle-production-jobs.json','utf8'));assert.equal(report.deployment.passed,true);assert.equal(report.deployment.commit,sha);report.publicBytes=await verifyBelleRelease(base,sha);}
 browser=await chromium.launch({channel:'chrome',headless:process.env.BELLE_BROWSER_HEADED!=='1',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 report.browserVersion=browser.version();
 for(const entry of cases){
  const mobile=entry.width<600,context=await browser.newContext({viewport:{width:entry.width,height:entry.height},deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(45000);await context.tracing.start({screenshots:true,snapshots:true});
  const evidence={...entry,source:checkout,passed:false,functionalPassed:false,errors:[],failedRequests:[],cleanupFailed:false,screenshots:[],screenshotEvidence:[]};report.cases.push(evidence);
  let phase='gameplay';
  const tap=locator=>mobile?locator.tap():locator.click();
  const shot=async name=>{const file=entry.name+'-'+name+'.png';await page.screenshot({path:resolve(output,file),timeout:90000});evidence.screenshots.push(file);const bytes=await readFile(resolve(output,file));evidence.screenshotEvidence.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),at:new Date().toISOString(),source:checkout,runId:report.runId});};
  const auditLayout=async preset=>{
   const result=await page.evaluate(()=>{
    const visible=selector=>[...document.querySelectorAll(selector)].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';});
    const controls=visible('.hover-touch button,.hover-actions button,.hover-cruise button,#hero-cam-record');
    const label=el=>el.id||el.getAttribute('aria-label')||el.textContent.trim();
    const obscured=controls.filter(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width<44||r.height<44||r.x<0||r.y<0||r.right>innerWidth||r.bottom>innerHeight||!(hit===el||el.contains(hit));}).map(label);
    const overlaps=[];
    // Instrument children contain the visible readings; their transparent,
    // pointer-inert full-width layout wrapper is not an obscuring panel.
    for(const panel of visible('.hover-instruments > *,#jarvs-avionics,#ride-radio'))for(const control of controls){const a=panel.getBoundingClientRect(),b=control.getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([label(panel),label(control)]);}
    for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([label(controls[i]),label(controls[j])]);}
    return {obscured,overlaps};
   });
   (evidence.layoutAudit??={})[preset]=result;
   assert.deepEqual(result,{obscured:[],overlaps:[]},'Flight status and radio must leave 44px controls clear at '+entry.name+' '+preset);
  };
  page.on('pageerror',error=>observeEvidence(evidence,phase,()=>evidence.errors.push(error.message)));
  page.on('console',message=>observeEvidence(evidence,phase,()=>{if(message.type()==='error'||/context\s*(?:was\s*)?lost/i.test(message.text()))evidence.errors.push(message.text());}));
  page.on('response',response=>observeEvidence(evidence,phase,()=>{if(response.status()>=400)evidence.errors.push('HTTP '+response.status()+' '+response.url());}));
  page.on('requestfailed',request=>observeEvidence(evidence,phase,()=>recordRequestFailure(evidence,request,phase)));
  try{
   await page.goto(target.href+'?profile=1&verify='+sha,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state),null,{timeout:180000});
   await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready');assert.match(await page.title(),/Belle Isle/i);
   if(await page.locator('#startup-motion').getAttribute('aria-pressed')!=='true')await tap(page.locator('#startup-motion'));
   await tap(page.locator('.cinema-ride-picker > summary'));
   await tap(page.locator('.ride-options label').filter({has:page.locator('input[value="hoverbike"]')}));
   await expect(page.locator('input[name="startup-vehicle"][value="hoverbike"]')).toBeChecked();
   await tap(page.getByRole('button',{name:'Use this ride',exact:true}));await tap(page.locator('#start'));
   await expect(page.locator('body')).toHaveClass(/on-hoverbike/,{timeout:150000});await expect(page.locator('body')).not.toHaveClass(/at-start/);
   await expect(page.locator('#hover-hud')).toBeVisible();
   // Observe actual renderer submissions, not just the existence of a canvas.
   const postMount=await page.evaluate(()=>window.__belleStartupProfile?.().submittedFrames);
   assert(Number.isSafeInteger(postMount)&&postMount>=0,'Missing actual post-render submission counter');
   const submissions=()=>page.evaluate(()=>window.__belleStartupProfile?.().submittedFrames);
   await expect.poll(submissions,{timeout:90000}).toBeGreaterThan(postMount+2);
   const gpu=await page.locator('#game').evaluate(waitForCinematicFlightFrame);
   evidence.frameAudit={postMount,submissions:await submissions(),gpu};
   assert(evidence.frameAudit.submissions>postMount+2&&gpu.gpuCompletedAt>=gpu.gpuSubmittedAt&&gpu.paintOpportunities===2,'Fresh GPU-completed cinematic frame evidence required');
   evidence.rendering=await page.evaluate(()=>{const c=document.querySelector('#game'),gl=c.getContext('webgl2');return{live:!!gl&&!gl.isContextLost(),width:c.width,height:c.height,profile:window.__belleStartupProfile?.()};});
   assert(evidence.rendering.live&&evidence.rendering.width>0&&evidence.rendering.height>0);await auditLayout('exploration');await shot('exploration');
   await tap(page.locator('#tools-toggle'));await tap(page.locator('#settings-open'));
   await expect(page.locator('#cinematic-settings')).toBeVisible();await expect(page.locator('#compact-cockpit')).toBeChecked();
   await page.locator('#compact-cockpit').uncheck();await expect(page.locator('body')).toHaveAttribute('data-cockpit-density','full');
   await page.locator('#compact-cockpit').check();await expect(page.locator('body')).toHaveAttribute('data-cockpit-density','compact');
   for(const preset of ['racing','cinematic','exploration']){await page.locator('#hud-preset').selectOption(preset);await expect(page.locator('body')).toHaveAttribute('data-hud-preset',preset);}
   await tap(page.locator('#belle-sunset'));await expect(page.locator('#sky-clouds')).toHaveValue('wispy');await expect(page.locator('#sky-speed')).toHaveValue('60');await expect(page.locator('#sky-cycle')).toBeChecked();
   await page.locator('#motion').check();await expect(page.locator('body')).toHaveAttribute('data-presentation-motion','reduced');
   await page.locator('#hud-preset').selectOption('cinematic');await shot('settings');
   await tap(page.locator('#settings [data-close="settings"]'));
   await expect(page.locator('#pause')).toBeVisible();await expect(page.locator('#tools-toggle')).toBeVisible();await expect(page.locator('#hover-hud')).toBeVisible();
   await expect(page.locator('.location-chip')).toBeHidden();await expect(page.locator('#navigation')).toBeHidden();
   for(const id of ['pause','tools-toggle','view']){
    const hit=await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{width:r.width,height:r.height,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:at===el||el.contains(at)};});
    assert(hit.width>=44&&hit.height>=44&&hit.inside&&hit.hit,'Accessible unobstructed '+id+' at '+entry.name);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page-width overflow');await auditLayout('cinematic');await shot('cinematic-sunset');
   // Pause and resume through real UI; no timeline or input-state substitution.
   await tap(page.locator('#pause'));await expect(page.locator('#pause')).toHaveText('Resume');await tap(page.locator('#pause'));await expect(page.locator('#pause')).toHaveText('Pause');
   assert.deepEqual(evidence.errors,[],'No unexpected console, asset or context errors');assert.deepEqual(evidence.failedRequests,[],'No aborted or failed requests');evidence.functionalPassed=true;
  }catch(error){evidence.failure=error.stack||String(error);phase='failure-capture';try{await shot('failure');}catch(captureError){recordEvidenceError(evidence,'failure-screenshot',captureError);}throw error;}
  finally{phase='cleanup';await cleanupCinematicCase(evidence,()=>context.tracing.stop({path:resolve(output,entry.name+'-trace.zip')}),()=>context.close());}
  assert.equal(finalizeCinematicCase(evidence),true,'Cinematic case must remain clean through context cleanup');
 }
 if(!local){report.publicBytes=await verifyBelleRelease(base,sha);report.liveVerified=liveVerified({deployment:report.deployment,publicBytes:report.publicBytes,browser:{passed:report.cases.every(c=>c.passed),commit:sha}},sha);assert.equal(report.liveVerified,true);}
 report.passed=report.cases.every(c=>c.passed);
}catch(error){report.failure=error.stack||String(error);process.exitCode=1;}
finally{
 try{if(browser)await browser.close();}catch(error){report.errors.push('cleanup:browser '+(error.stack||String(error)));}
 if(!finalizeCinematicReport(report,cases.length))process.exitCode=1;
 report.finishedAt=new Date().toISOString();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,liveVerified:report.liveVerified,commit:sha,cases:report.cases.map(c=>({name:c.name,passed:c.passed})),failure:report.failure},null,2));
}
