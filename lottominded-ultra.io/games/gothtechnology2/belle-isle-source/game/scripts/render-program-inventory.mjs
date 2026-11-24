/** Inert native-browser diagnostic. Never imported by or built into the game. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {installRenderProgramInventory,inspectNativeMetalLaunch} from './render-program-inventory-browser.mjs';

const game=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(game,'dist');
const output=resolve(process.env.BELLE_PROGRAM_INVENTORY_OUTPUT??resolve(game,'output/program-inventory'));
const manifestPath=process.env.BELLE_PROGRAM_INVENTORY_MANIFEST;
const PRODUCT='4fb82975e974a4279ba72c196f3b9093fd2b5882';
const STRICT='8f6af949083800c491b65e0709c04cc29eb5712634f744c5b912f76ce651fcf5';
const viewport={width:1440,height:900},launch={channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',['-C',game,...args],{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const json=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
const started=Date.now();
const report={version:1,status:'starting',diagnosticCaptureValid:false,releaseAccepted:false,performanceVerified:false,
  scope:'Standalone GL program and layout inventory over the entire trusted W-down to W-up interval on the unchanged full game. Not a performance acceptance run.',
  requestedSeconds:90,viewport,deviceScaleFactor:1,quality:'high',cap:60,expectedSamples:4,launch,
  errors:[],consoleErrors:[],failedRequests:[],cleanupErrors:[],integrityErrors:[],phases:[],
  note:'GL API state and raw shader source observations are not native Metal pipeline keys or GPU timings. No material callbacks, scene state, renderer flags, release gates or runtime source are changed.'};
let browser,page,server,deadline,deadlineRecovery,closing=false,manifest,held=false,inventoryWritten=false;
const checkpoint=async phase=>{if(phase){report.status=phase;report.phases.push({phase,elapsedMs:Date.now()-started});}await json(resolve(output,'report.json'),report);};

async function buildInventory(directory=dist){
  const files=[];
  async function walk(folder){
    for(const entry of await readdir(folder,{withFileTypes:true})){
      const path=resolve(folder,entry.name);
      if(entry.isDirectory())await walk(path);
      else{assert(entry.isFile(),'Unexpected build symlink or nonfile: '+path);const bytes=await readFile(path);files.push({path:relative(directory,path).split(sep).join('/'),bytes:bytes.length,sha256:sha(bytes)});}
    }
  }
  await walk(directory);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
async function verifyInputs(stage){
  assert(manifest&&manifest.version===1,'Committed experiment manifest required');
  const commit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}'),parents=git('show','-s','--format=%P','HEAD').split(' ').filter(Boolean);
  assert.equal(commit,manifest.commit);assert.equal(tree,manifest.tree);assert.deepEqual(parents,[PRODUCT]);assert.equal(manifest.parent,PRODUCT);
  if(process.env.GITHUB_SHA)assert.equal(commit,process.env.GITHUB_SHA);
  const root=git('rev-parse','--show-toplevel');
  const entries=Object.entries(manifest.sources??{});assert(entries.length>500,'Full source inventory is required');
  const sources={};
  for(const [path,expected] of entries){
    assert.equal(typeof path,'string');assert.match(expected,/^[0-9a-f]{64}$/);
    const file=resolve(game,path),inside=relative(root,file);assert(inside!==''&&!inside.startsWith('..'+sep)&&!inside.startsWith(sep),'Source path escapes repository');
    sources[path]=sha(await readFile(file));assert.equal(sources[path],expected,'Source bytes changed: '+path);
  }
  for(const path of ['scripts/render-program-inventory.mjs','scripts/render-program-inventory-browser.mjs','scripts/render-program-inventory.test.mjs'])assert(sources[path],'Collector source missing from manifest: '+path);
  assert.equal(sources['scripts/sustained-ride-profile.mjs'],STRICT,'Original strict script changed');
  const files=await buildInventory();assert.equal(files.length,195);assert.deepEqual(files,manifest.files,'Exact immutable full-game build changed');
  assert.equal(sha(await readFile(manifestPath)),report.identity.manifestSha256,'Manifest bytes changed');
  const proof={stage,commit,tree,parents,sourceFiles:entries.length,builtFiles:files.length,verifiedAt:new Date().toISOString(),
    sourceSha256:sha(JSON.stringify(sources)),buildInventorySha256:sha(JSON.stringify(files)),unchanged:true};
  await json(resolve(output,'integrity-'+stage+'.json'),proof);return proof;
}
function sourceSummary(source){
  const names=[...source.matchAll(/^\s*#define\s+SHADER_NAME\s+(.+)$/gm)].map(match=>match[1]);
  const defines=source.split('\n').filter(line=>/^\s*#define\s+/.test(line));
  const nameStripped=source.replace(/^([ \t]*#define[ \t]+SHADER_NAME)[ \t]+[^\r\n]*/gm,'$1 INVENTORY_NAME_REMOVED');
  return {sha256:sha(source),characters:source.length,shaderNames:names,defines,
    nameLineStrippedSha256:sha(nameStripped),normalization:'Only the SHADER_NAME macro replacement text is replaced. This is a textual similarity grouping, not semantic equivalence.'};
}
async function persistInventory(evidence){
  await mkdir(resolve(output,'programs'),{recursive:true});
  // The raw returned snapshot is saved first, even when source validation failed.
  await json(resolve(output,'inventory-raw.json'),evidence);
  const copied=structuredClone(evidence),groups=new Map(),nameGroups=new Map();
  for(const context of copied.contexts??[])for(const program of context.programs??[]){
    for(const shader of program.nativeShaders??[]){
      if(typeof shader.source!=='string')continue;
      const stage=shader.type===35633?'vertex':shader.type===35632?'fragment':'stage-'+shader.type;
      const file='context-'+context.id+'-program-'+program.id+'-'+stage+'.glsl';
      await writeFile(resolve(output,'programs',file),shader.source);
      Object.assign(shader,{file:'programs/'+file,...sourceSummary(shader.source)});delete shader.source;
    }
    for(const epoch of program.epochs??[])for(const shader of epoch.shaders??[]){
      if(typeof shader.source!=='string')continue;
      const file='context-'+context.id+'-program-'+program.id+'-epoch-'+epoch.epoch+'-shader-'+shader.shaderId+'-requested.glsl';
      await writeFile(resolve(output,'programs',file),shader.source);
      Object.assign(shader,{file:'programs/'+file,...sourceSummary(shader.source)});delete shader.source;
    }
    const vertex=program.nativeShaders?.find(shader=>shader.type===35633),fragment=program.nativeShaders?.find(shader=>shader.type===35632);
    if(vertex?.sha256&&fragment?.sha256){
      const identity={contextId:context.id,programId:program.id,drawCalls:program.drawCalls,valid:program.valid,
        shaderNames:[...vertex.shaderNames,...fragment.shaderNames]};
      const key=vertex.sha256+':'+fragment.sha256,names=vertex.nameLineStrippedSha256+':'+fragment.nameLineStrippedSha256;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(identity);
      if(!nameGroups.has(names))nameGroups.set(names,[]);nameGroups.get(names).push(identity);
    }
  }
  const grouped={rawSourceGroups:[...groups].map(([hashPair,programs])=>({hashPair,programs})),
    shaderNameLineStrippedGroups:[...nameGroups].map(([hashPair,programs])=>({hashPair,programs})),
    note:'Group equality describes source text hashes only. SHADER_NAME removal is explicitly lossy and does not prove interchangeable programs, uniforms, render state, vertex layouts or native pipeline identities.'};
  await json(resolve(output,'inventory.json'),copied);await json(resolve(output,'source-groups.json'),grouped);
  inventoryWritten=true;
  report.inventory={complete:evidence.complete,status:evidence.status,capture:evidence.capture,contexts:evidence.contexts?.map(context=>({id:context.id,
    canvasId:context.canvasId,api:context.api,programs:context.programs?.length,layouts:context.layouts?.length,
    combinations:context.combinations?.length,counts:context.counts})),drops:evidence.drops,observerErrors:evidence.observerErrors,
    sourceValidationErrors:evidence.sourceValidationErrors,rawSourceGroups:groups.size,nameLineStrippedGroups:nameGroups.size,
    rawEvidenceSha256:sha(await readFile(resolve(output,'inventory-raw.json')))};
  await checkpoint('inventory-preserved');
}
async function graphicsProof(){
  return page.locator('#game').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');if(!gl||gl.isContextLost())throw Error('Main WebGL2 unavailable');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {canvas:{width:canvas.width,height:canvas.height},viewport:[innerWidth,innerHeight,devicePixelRatio],attributes:gl.getContextAttributes(),
      renderer:String(gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),vendor:String(gl.getParameter(ext?.UNMASKED_VENDOR_WEBGL??gl.VENDOR)),
      version:String(gl.getParameter(gl.VERSION)),defaultFramebuffer:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,
      samples:gl.getParameter(gl.SAMPLES),drawingBuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight}};
  });
}
function validateGraphics(proof){
  assert(/Metal/i.test(proof.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(proof.renderer),'Native Metal renderer required');
  assert.deepEqual(proof.canvas,viewport);assert.deepEqual(proof.drawingBuffer,viewport);assert.deepEqual(proof.viewport,[1440,900,1]);
  assert.equal(proof.attributes.antialias,true);assert.equal(proof.defaultFramebuffer,true);assert.equal(proof.samples,4,'Actual default framebuffer must remain 4x MSAA');
}
async function main(){
  assert.equal(process.platform,'darwin','The collector requires the native macOS Chrome/Metal runner');
  assert(manifestPath,'BELLE_PROGRAM_INVENTORY_MANIFEST is required');
  const manifestBytes=await readFile(manifestPath);manifest=JSON.parse(manifestBytes);
  report.identity={manifest:manifestPath,manifestSha256:sha(manifestBytes),commit:manifest.commit,tree:manifest.tree,
    productParent:manifest.parent,buildId:manifest.buildId,buildFiles:manifest.files?.length};
  report.integrityBefore=await verifyInputs('before');await checkpoint('verified-immutable-inputs');
  const require=createRequire(resolve(game,'../../package.json')),{chromium,expect:baseExpect}=require('@playwright/test'),expect=baseExpect.configure({timeout:180000});
  report.runtime={node:process.version,platform:process.platform,arch:process.arch,playwright:require('@playwright/test/package.json').version};
  server=createCoopStaticServer(dist);await new Promise((ok,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ok);});
  report.url='http://127.0.0.1:'+server.address().port+'/?profile=1&locationPerf=1';
  browser=await chromium.launch(launch);report.browserVersion=browser.version();
  deadline=setTimeout(()=>{
    report.errors.push('Collector exceeded its 420-second deadline');
    deadlineRecovery=(async()=>{
      let forced=false;
      const forceClose=setTimeout(()=>{
        forced=true;report.errors.push('Deadline partial export did not finish within 8 seconds; a hung or unavailable page may prevent recovery');
        closing=true;void browser?.close().catch(error=>report.cleanupErrors.push('Forced deadline cleanup: '+String(error)));
      },8000);
      try{
        if(page&&!page.isClosed()){
          if(held)try{await page.keyboard.up('w');held=false;}catch(error){report.cleanupErrors.push('Deadline trusted release: '+String(error));}
          const evidence=await page.evaluate(()=>{const api=window.__belleProgramInventory;if(!api)return null;
            api.abort('Collector hard deadline');return api.exportEvidence();});
          if(evidence)await persistInventory(evidence);
          else report.errors.push('Deadline partial export unavailable: browser-init observer was not installed');
        }else report.errors.push('Deadline partial export unavailable: page already closed');
      }catch(error){report.errors.push('Deadline partial export: '+String(error));}
      finally{clearTimeout(forceClose);closing=true;try{await browser?.close();}catch(error){report.cleanupErrors.push('Deadline browser cleanup: '+String(error));}
        report.deadlineRecovery={attempted:true,forcedClose:forced,inventoryWritten};}
    })();
  },420000);
  const browserCdp=await browser.newBrowserCDPSession();
  try{
    report.browserIdentity=await browserCdp.send('Browser.getVersion');const info=await browserCdp.send('SystemInfo.getInfo');
    report.systemInfo={commandLine:info.commandLine,gpu:info.gpu};
    report.nativeBackendProof=inspectNativeMetalLaunch(info.commandLine,info.gpu);
    assert(report.nativeBackendProof.valid,report.nativeBackendProof.errors.join('; '));
  }finally{await browserCdp.detach();}
  page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:false,hasTouch:false,reducedMotion:'reduce'});page.setDefaultTimeout(180000);await page.bringToFront();
  page.on('pageerror',error=>report.errors.push(error.stack??String(error)));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)report.failedRequests.push('HTTP '+response.status()+' '+response.url());});
  page.on('requestfailed',request=>{if(!closing)report.failedRequests.push((request.failure()?.errorText??'failed')+' '+request.url());});
  await page.addInitScript(installRenderProgramInventory);
  await page.addInitScript(()=>{localStorage.setItem('belle-graphics-v1',JSON.stringify({quality:'high',cap:60,antiAliasing:'automatic'}));});
  const navigation=Date.now();await page.goto(report.url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('#welcome')?.dataset.state));
  await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:1000});report.welcomeReadyMs=Date.now()-navigation;
  report.graphicsBefore=await graphicsProof();validateGraphics(report.graphicsBefore);
  await page.locator('.cinema-ride-picker > summary').click();await page.locator('.ride-options label').filter({hasText:'One wheel'}).click();
  await page.getByRole('button',{name:'Use this ride',exact:true}).click();await page.locator('#start').click();
  await expect(page.locator('body')).not.toHaveClass(/at-start/);report.rideStartedMs=Date.now()-navigation;
  await page.locator('#location-perf > summary').click();
  async function settings(){if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click();await page.locator('#settings-open').click();await expect(page.locator('#settings')).toBeVisible();}
  await settings();await expect(page.locator('#quality')).toHaveValue('high');await expect(page.locator('#performance-probe-warning')).toHaveCount(0);
  const panel=page.locator('#ride-profile');await expect(panel).toBeAttached();await panel.locator('summary').click();
  report.preCapture=await page.evaluate(()=>window.__belleProgramInventory.summary());await checkpoint('ready-for-trusted-capture');
  assert.equal(report.preCapture.observerErrors,0);assert.deepEqual(report.preCapture.drops,{});
  assert(report.preCapture.hooks.every(hook=>!hook.required||(hook.installed&&hook.bindingIntact)),'Incomplete startup hook coverage');
  await panel.getByRole('button',{name:'Start 10-minute capture',exact:true}).click();await page.locator('[data-close="settings"]').click();await page.locator('#game').focus();
  await page.evaluate(()=>window.__belleProgramInventory.arm());
  let inFlight=false,reassertions=0,heartbeatError=null,pending=Promise.resolve();const heldStart=Date.now();
  await page.keyboard.down('w');held=true;
  const heartbeat=setInterval(()=>{if(inFlight)return;inFlight=true;pending=page.keyboard.down('w').then(()=>reassertions++,error=>{heartbeatError=String(error);}).finally(()=>{inFlight=false;});},450);
  try{await page.waitForTimeout(90000);}finally{clearInterval(heartbeat);await pending;await page.keyboard.up('w');held=false;}
  report.heldInputWallMs=Date.now()-heldStart;report.input={reassertions,heartbeatError};
  // No GL introspection or browser page evaluation occurs between the real
  // key-down and key-up above. The app's unchanged profile ends on that key-up.
  await settings();if(!await panel.evaluate(node=>node.open))await panel.locator('summary').click();
  await expect(panel.getByRole('button',{name:'Start 10-minute capture',exact:true})).toBeVisible();
  const raw=await panel.locator('textarea').inputValue();await writeFile(resolve(output,'ride-profile.json'),raw+'\n');report.profile=JSON.parse(raw);
  const evidence=await page.evaluate(()=>window.__belleProgramInventory.exportEvidence());await persistInventory(evidence);
  report.graphicsAfter=await graphicsProof();validateGraphics(report.graphicsAfter);
  assert.equal(report.profile.stopReason,'trusted-W-keyup');assert.equal(heartbeatError,null);
  assert(report.heldInputWallMs>=90000&&evidence.capture.durationMs>=89000,'Complete genuine 90-second held input required');
  assert(evidence.capture.durationMs<=report.heldInputWallMs+1000,'Inventory window escaped held-input boundary');
  assert.equal(evidence.complete,true,'Inventory is incomplete; partial data are retained');
  const stats=report.profile;assert(stats.frames>=8&&Number.isFinite(stats.metrics?.frameMs?.p95)&&stats.movingSeconds>=5&&stats.distanceMetres>=3,'Actual full-scene riding required');
  for(const value of [stats.settingsAtStart,stats.settings]){
    assert.equal(value.quality,'high');assert.equal(value.effectiveQuality,'high');assert.equal(value.cap,60);assert.equal(value.pixelRatio,1);
    assert.equal(value.adaptiveScale,1);assert.equal(value.diagnosticReduction,false);assert.equal(value.vehicle,'onewheel');
  }
  assert.deepEqual(stats.viewport,[1440,900,1]);
  await page.locator('[data-close="settings"]').click();await page.screenshot({path:resolve(output,'riding-end.png'),timeout:60000});
  report.collectionCompleted=true;
}

await mkdir(output,{recursive:true});await checkpoint('starting');
try{await main();}catch(error){report.errors.push(error.stack??String(error));await checkpoint('collection-failed');}
finally{
  if(deadlineRecovery)await deadlineRecovery;
  if(page&&!page.isClosed()){
    if(held)try{await page.keyboard.up('w');held=false;}catch(error){report.cleanupErrors.push('Trusted key release: '+String(error));}
    if(!inventoryWritten)try{
      const evidence=await page.evaluate(()=>{const api=window.__belleProgramInventory;if(!api)return null;api.abort('Driver ended before successful evidence collection');return api.exportEvidence();});
      if(evidence)await persistInventory(evidence);
    }catch(error){report.errors.push('Partial inventory export: '+String(error));
      try{await json(resolve(output,'inventory-partial-summary.json'),await page.evaluate(()=>window.__belleProgramInventory?.summary()??null));}catch(secondary){report.errors.push('Partial summary: '+String(secondary));}
    }
    try{report.hookCleanup=await page.evaluate(()=>window.__belleProgramInventory?.dispose()??null);if(report.hookCleanup?.failures?.length)report.cleanupErrors.push(...report.hookCleanup.failures);}catch(error){report.cleanupErrors.push('Hook cleanup: '+String(error));}
  }
  closing=true;clearTimeout(deadline);
  try{await browser?.close();}catch(error){report.cleanupErrors.push('Browser cleanup: '+String(error));}
  if(server)try{server.closeAllConnections?.();await new Promise((ok,reject)=>server.close(error=>error?reject(error):ok()));}catch(error){report.cleanupErrors.push('Server cleanup: '+String(error));}
  if(manifest)try{report.integrityAfter=await verifyInputs('after');}catch(error){report.integrityErrors.push(error.stack??String(error));}
  report.elapsedWallMs=Date.now()-started;
  report.diagnosticCaptureValid=!!report.collectionCompleted&&inventoryWritten&&report.inventory?.complete===true&&report.integrityAfter?.unchanged===true&&
    !report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length&&!report.cleanupErrors.length&&!report.integrityErrors.length;
  report.releaseAccepted=false;report.performanceVerified=false;
  await checkpoint(report.diagnosticCaptureValid?'valid-diagnostic-only':'failed-diagnostic-partial-evidence-retained');
  console.log('BELLE_PROGRAM_INVENTORY '+JSON.stringify({status:report.status,diagnosticCaptureValid:report.diagnosticCaptureValid,
    releaseAccepted:false,performanceVerified:false,identity:report.identity,inventory:report.inventory,
    errors:report.errors.slice(0,3),cleanupErrors:report.cleanupErrors,integrityErrors:report.integrityErrors.slice(0,2)}));
  if(!report.diagnosticCaptureValid)process.exitCode=1;
}
