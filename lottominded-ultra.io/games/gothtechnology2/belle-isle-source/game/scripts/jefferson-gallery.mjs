/** Actual-game Jefferson gallery through the public Guide's Travel action.
 * No player/camera injection, fake frame advancement, or replacement canvas.
 *
 * ENV_GALLERY_DEVICE=desktop|phone (desktop/high or phone/smooth, DPR 1)
 * ENV_GALLERY_SITES=stearns,garden-court,bagley,wells,pasadena,palms,grand-boulevard,woodward
 * ENV_GALLERY_NIGHT=1 adds night captures of the two street stops.
 * ENV_GALLERY_EXECUTABLE=/usr/bin/chromium selects local headless SwiftShader.
 * Otherwise the existing gallery launcher and optional Metal requirement apply.
 * ENV_GALLERY_OUTPUT and ENV_GALLERY_BUILD_DIR may select explicit directories.
 * --write-build-receipt seals all source and built-asset hashes after a fresh build.
 * The native CI job verifies that receipt instead of comparing checkout mtimes.
 * A subset run never reports full gallery coverage or release acceptance.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {access,mkdir,readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {isAbsolute,resolve} from 'node:path';
import {createCoopStaticServer} from './coop-static-server.mjs';
import {launchGalleryBrowser,galleryRenderer,galleryNeedsMetal} from './gallery-renderer.mjs';

const game=resolve(import.meta.dirname,'..');
const require=createRequire(resolve(game,'../../package.json'));
const device=process.env.ENV_GALLERY_DEVICE||'desktop';
assert(['desktop','phone'].includes(device),'Unknown ENV_GALLERY_DEVICE');
const viewport=device==='phone'?{width:390,height:844}:{width:1440,height:900};
const quality=device==='phone'?'smooth':'high',fps=device==='phone'?'30':'60';
const night=process.env.ENV_GALLERY_NIGHT==='1';
const runId=new Date().toISOString().replaceAll(/[-:.]/g,'');
const output=resolve(process.env.ENV_GALLERY_OUTPUT||resolve(game,'output/jefferson-gallery',device,runId));
const build=resolve(process.env.ENV_GALLERY_BUILD_DIR||resolve(game,'dist'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJSON=async path=>JSON.parse(await readFile(path,'utf8'));
const receiptName='jefferson-build-receipt.json';
const hashRecord=({path,bytes,sha256})=>({path,bytes,sha256});
if(process.argv.includes('--write-build-receipt')){
 const sourceIdentity=await identity();
 assert(!sourceIdentity.sources.some(s=>s.requiresBuild&&s.modifiedAfterBuild),'Cannot seal stale build; rebuild the candidate first');
 const receipt={schema:1,createdAt:new Date().toISOString(),gitHead:sourceIdentity.gitHead,githubSha:sourceIdentity.githubSha,
  sources:sourceIdentity.sources.map(hashRecord),buildFiles:sourceIdentity.buildFiles};
 await writeFile(resolve(build,receiptName),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({receipt:resolve(build,receiptName),gitHead:receipt.gitHead,sourceFiles:receipt.sources.length,buildFiles:receipt.buildFiles.length}));
 process.exit(0);
}
const originalMap=await readJSON(resolve(game,'public/belle/map.json'));
const districts=await readJSON(resolve(game,'src/belle/detroitDistricts.json'));
const extension=await readJSON(resolve(game,'src/belle/jeffersonExtension.json'));

const sites=[
 {id:'stearns',buildingId:'detroit-89989',name:'Frederick Stearns Building',guide:'Frederick Stearns Building · East Jefferson'},
 {id:'garden-court',buildingId:'868842406',name:'Garden Court Apartments',guide:'Garden Court Apartments · East Jefferson'},
 {id:'bagley',buildingId:'114282642',name:'John N. Bagley House',guide:'John N. Bagley House · East Jefferson'},
 {id:'wells',buildingId:'955779335',name:'William H. Wells House',guide:'William H. Wells House · East Jefferson'},
 {id:'pasadena',buildingId:'957898908',name:'Pasadena Apartments',guide:'Pasadena Apartments · East Jefferson'},
 {id:'palms',buildingId:'jefferson-city-8423552-0',name:'The Palms Apartments',guide:'The Palms Apartments · East Jefferson'},
 {id:'grand-boulevard',name:'Jefferson at East Grand Boulevard',guide:'Jefferson Avenue · East Grand Boulevard',
  center:[111320*Math.cos(42.34680*Math.PI/180)*(-83.0015752696423+83.00175),-111320*(42.3470310199068-42.34680)],street:true},
 {id:'woodward',name:'Jefferson at Woodward',guide:'Jefferson Avenue · Woodward downtown',center:extension.destination.sourceSignalPoint,street:true},
];
function centroid(points){
 let area=0,x=0,z=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],cross=a[0]*b[1]-b[0]*a[1];
  area+=cross;x+=(a[0]+b[0])*cross;z+=(a[1]+b[1])*cross;
 }
 assert(Math.abs(area)>.01,'Invalid gallery building polygon');
 return [x/(3*area),z/(3*area)];
}
for(const site of sites)if(site.buildingId){
 const source=[...originalMap.buildings,...districts.buildings,...extension.buildings].find(b=>b.id===site.buildingId);
 assert(source,'Missing gallery source building '+site.buildingId);site.center=centroid(source.points);
}
const filter=process.env.ENV_GALLERY_SITES?.split(',').map(x=>x.trim()).filter(Boolean);
if(filter){
 assert(filter.length,'ENV_GALLERY_SITES selected no sites');
 assert.equal(new Set(filter).size,filter.length,'Duplicate ENV_GALLERY_SITES selection');
 for(const id of filter)assert(sites.some(s=>s.id===id),'Unknown gallery site '+id);
}
const selected=new Set(filter||sites.map(s=>s.id));
const scheduled=[...sites.map(site=>({site,light:'high-noon',hour:'12'})),
 ...(night?sites.filter(s=>s.street).map(site=>({site,light:'night',hour:'22'})):[])];
await mkdir(output,{recursive:true});
try{await access(resolve(output,'report.json'));throw Error('Output already has report.json; preserve it and select a new output directory');}
catch(error){if(error.code!=='ENOENT')throw error;}

const limits={actionMs:150000,screenshotMs:180000,gpuFenceMs:60000,totalMs:480000};
const began=performance.now(),deadline=began+limits.totalMs;
function remaining(max=limits.actionMs){
 const ms=Math.floor(deadline-performance.now());
 if(ms<=0)throw Error('Jefferson gallery reached its fixed eight-minute budget');
 return Math.min(max,ms);
}
const elapsed=()=>Math.round(performance.now()-began);
const report={schema:1,runId,startedAt:new Date().toISOString(),device,viewport,quality,fps:Number(fps),dpr:1,reducedMotion:'reduce',
 source:'Actual built Belle Isle WebGL game, public Guide Travel to street view, read-only gds-capture camera observer',
 sourceIdentity:null,renderer:null,browserMode:null,limits,requestedSites:[...selected],nightRequested:night,
 fullDaySites:sites.map(s=>s.id),partialSelection:selected.size!==sites.length,
 passed:false,selectedCoveragePassed:false,fullDayCoverageComplete:false,releaseAccepted:false,nativePerformanceAccepted:false,
 physicalDeviceResult:false,manualVisualReviewRequired:true,
 limitations:['Browser viewport emulation is not physical-device evidence','Captured frames do not establish the original 90-second performance gates',
  'Model likeness, unobstructed facade coverage and any reference-photo pairing still require visual review',
  'Signal timing and pole/head dimensions are authored gameplay approximations; source intersection inventory is separate'],
 visits:scheduled.map(({site,light,hour})=>({id:site.id,name:site.name,guide:site.guide,light,hour:Number(hour),quality,
  selected:selected.has(site.id),status:selected.has(site.id)?'scheduled':'not-selected',passed:false,screenshot:null})),
 errors:[],failedRequests:[],coverageGaps:[],cleanupErrors:[]};
let server,browser,page,chromium,expect,currentPhase='preparation',watchdog;
function recordError(message){report.errors.push({phase:currentPhase,elapsedMs:elapsed(),message:String(message)});}
async function persist(){await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
async function filesWithin(directory,prefix=''){
 const paths=[];
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  const name=prefix+entry.name;
  if(entry.isDirectory())paths.push(...await filesWithin(resolve(directory,entry.name),name+'/'));
  else if(entry.isFile())paths.push(name);
 }
 return paths;
}
async function identity(){
 let head=null,dirty=null;
 try{head=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();dirty=execFileSync('git',['status','--porcelain'],{cwd:game,encoding:'utf8'}).trim().split('\n').filter(Boolean);}
 catch{/* Source hashes still identify the local files when git metadata is unavailable. */}
 const index=await readFile(resolve(build,'index.html')),indexStat=await stat(resolve(build,'index.html'));
 const buildFiles=[];
 for(const name of await filesWithin(build))if(name!==receiptName){
  const bytes=await readFile(resolve(build,name));buildFiles.push({path:name,bytes:bytes.length,sha256:hash(bytes)});
 }
 const sourceFiles=[...(await filesWithin(resolve(game,'src'))).map(name=>'src/'+name),
  'index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json','public/belle/map.json',
  'scripts/jefferson-gallery.mjs','scripts/gallery-renderer.mjs','scripts/coop-static-server.mjs',
  '../../package.json','../../package-lock.json'].sort();
 const sources=[];
 for(const name of sourceFiles){
  const path=resolve(game,name),bytes=await readFile(path),info=await stat(path);
  sources.push({path:name,bytes:bytes.length,sha256:hash(bytes),requiresBuild:!name.startsWith('scripts/'),modifiedAfterBuild:info.mtimeMs>indexStat.mtimeMs});
 }
 return{gitHead:head,githubSha:process.env.GITHUB_SHA||null,dirtyPaths:dirty,buildDirectory:build,
  indexSha256:hash(index),indexModifiedAt:indexStat.mtime.toISOString(),
  bundles:buildFiles.filter(f=>f.path.startsWith('assets/')&&/\.(?:js|css)$/.test(f.path)),buildFiles,sources,buildReceipt:null,
  servedLocalBuild:!process.env.ENV_GALLERY_URL,remoteBuildByteIdentityVerified:false};
}
async function verifyBuildReceipt(sourceIdentity){
 let bytes;
 try{bytes=await readFile(resolve(build,receiptName));}catch(error){if(error.code==='ENOENT')return false;throw error;}
 const receipt=JSON.parse(bytes);
 assert.equal(receipt.schema,1,'Unsupported build receipt');
 assert.equal(receipt.gitHead,sourceIdentity.gitHead,'Build receipt belongs to a different source commit');
 assert.deepEqual(receipt.sources,sourceIdentity.sources.map(hashRecord),'Source bytes differ from the sealed candidate build');
 assert.deepEqual(receipt.buildFiles,sourceIdentity.buildFiles,'Built asset bytes differ from the sealed candidate build');
 sourceIdentity.buildReceipt={path:receiptName,sha256:hash(bytes),createdAt:receipt.createdAt,verified:true,
  sourceFiles:receipt.sources.length,buildFiles:receipt.buildFiles.length};
 return true;
}
async function frames(){
 const text=await page.locator('#profile').getAttribute('data-active-frames',{timeout:remaining()});
 assert(text!==null&&/^\d+$/.test(text),'Missing actual active-frame counter');return Number(text);
}
async function painted(){
 const before=await frames();
 await expect.poll(frames,{timeout:remaining()}).toBeGreaterThan(before+2);
 const budget=remaining(limits.gpuFenceMs);
 const fence=await page.locator('#game').evaluate((canvas,timeout)=>new Promise((done,fail)=>{
  const gl=canvas.getContext('webgl2');
  if(!gl||gl.isContextLost())return fail(Error('Real WebGL2 context unavailable'));
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0),start=performance.now();
  if(!sync)return fail(Error('GPU fence allocation failed'));
  gl.flush();
  const poll=()=>{
   const status=gl.clientWaitSync(sync,0,0);
   if(status===gl.CONDITION_SATISFIED||status===gl.ALREADY_SIGNALED){
    gl.deleteSync(sync);return requestAnimationFrame(()=>requestAnimationFrame(()=>done({complete:true,elapsedMs:performance.now()-start})));
   }
   if(status===gl.WAIT_FAILED||performance.now()-start>timeout){gl.deleteSync(sync);return fail(Error('GPU fence failed or exceeded original 60-second ceiling'));}
   requestAnimationFrame(poll);
  };poll();
 }),budget);
 return{activeFramesBefore:before,activeFramesAfter:await frames(),gpuFence:fence};
}
async function camera(){
 const observed=await page.evaluate(()=>window.__gdsCamera?.()??null);
 assert(observed&&!observed.unavailable,'Read-only game camera observer unavailable');
 assert(Array.isArray(observed.position)&&observed.position.length===3&&observed.position.every(Number.isFinite),'Invalid observed camera position');
 assert(Array.isArray(observed.direction)&&observed.direction.length===3&&observed.direction.every(Number.isFinite),'Invalid observed camera direction');
 assert(Number.isFinite(observed.fovDegrees)&&observed.fovDegrees>0,'Invalid observed camera FOV');
 return observed;
}
async function openMenu(){if(!await page.locator('#ride-menu').isVisible())await page.locator('#tools-toggle').click({timeout:remaining()});}
async function configure(hour){
 await openMenu();await page.locator('#settings-open').click({timeout:remaining()});
 const cycle=page.locator('#sky-cycle');if(await cycle.isChecked())await cycle.uncheck({timeout:remaining()});
 await page.locator('#sky-preset').selectOption(hour,{timeout:remaining()});
 await page.locator('#quality').selectOption(quality,{timeout:remaining()});
 await page.locator('#fps').selectOption(fps,{timeout:remaining()});
 await page.locator('[data-close="settings"]').click({timeout:remaining()});
}
async function travel(site){
 await openMenu();await page.locator('#map-open').click({timeout:remaining()});
 const card=page.locator('#landmarks .landmark').filter({has:page.getByRole('heading',{name:site.guide,exact:true})});
 await expect(card).toHaveCount(1,{timeout:remaining()});
 await expect(card).toBeVisible({timeout:remaining()});
 const found=await card.locator('h3').innerText({timeout:remaining()});
 await card.getByRole('button',{name:'Travel to street view',exact:true}).click({timeout:remaining()});
 await expect(page.locator('#guide')).not.toBeVisible({timeout:remaining()});
 await page.bringToFront();await page.locator('#game').focus({timeout:remaining()});
 return found;
}
function positionReceipt(observed,site){
 const dx=site.center[0]-observed.position[0],dz=site.center[1]-observed.position[2];
 const distance=Math.hypot(dx,dz),horizontalDirection=Math.hypot(observed.direction[0],observed.direction[2]);
 const headingCosine=distance&&horizontalDirection?(dx*observed.direction[0]+dz*observed.direction[2])/(distance*horizontalDirection):null;
 assert(distance<200,'Observed camera is not near the selected real-map destination: '+site.id);
 if(!site.street)assert(headingCosine!==null&&headingCosine>.65,'Observed camera faces away from the selected building: '+site.id);
 return{targetCenter:site.center,horizontalDistanceM:distance,headingCosine,framingAccepted:false};
}
try{
 report.sourceIdentity=await identity();
 if(!process.env.ENV_GALLERY_URL&&!await verifyBuildReceipt(report.sourceIdentity))
  assert(!report.sourceIdentity.sources.some(s=>s.requiresBuild&&s.modifiedAfterBuild),'Runtime source changed after build; rebuild the exact candidate before capture');
 const playwright=require('@playwright/test');chromium=playwright.chromium;expect=playwright.expect.configure({timeout:limits.actionMs});
 server=createCoopStaticServer(build);await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const url=new URL(process.env.ENV_GALLERY_URL||'http://127.0.0.1:'+server.address().port+'/');
 url.searchParams.set('profile','1');url.searchParams.set('gds-capture','1');report.url=url.href;
 currentPhase='startup';
 const executable=process.env.ENV_GALLERY_EXECUTABLE;
 if(executable){
  assert(isAbsolute(executable),'ENV_GALLERY_EXECUTABLE must be an absolute path');
  assert(!galleryNeedsMetal,'Explicit local SwiftShader executable cannot satisfy the required Metal lane');
  await access(executable);report.browserMode='explicit executable; headless SwiftShader';
  browser=await chromium.launch({executablePath:executable,headless:true,timeout:remaining(),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 }else{
  report.browserMode=galleryNeedsMetal?'existing native Chrome Metal launcher':'existing software gallery launcher';
  browser=await launchGalleryBrowser(chromium,process.env.ENV_GALLERY_BROWSER==='chromium'?undefined:'chrome');
 }
 report.browserVersion=browser.version();
 watchdog=setTimeout(()=>{recordError('Fixed eight-minute gallery budget exhausted');void browser?.close().catch(error=>report.cleanupErrors.push(String(error)));},remaining(limits.totalMs));
 page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:device==='phone',hasTouch:device==='phone',reducedMotion:'reduce'});
 page.setDefaultTimeout(limits.actionMs);page.setDefaultNavigationTimeout(limits.actionMs);
 page.on('pageerror',error=>recordError(error.message));
 page.on('console',message=>{if(message.type()==='error')recordError(message.text());});
 page.on('response',response=>{if(response.status()>=400)recordError('HTTP '+response.status()+' '+response.url());});
 page.on('requestfailed',request=>report.failedRequests.push({phase:currentPhase,elapsedMs:elapsed(),url:request.url(),error:request.failure()?.errorText||'network failure'}));
 await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:remaining()});
 await expect(page.locator('#welcome')).toHaveAttribute('data-state','ready',{timeout:remaining()});
 report.renderer=await galleryRenderer(page);
 const motion=page.locator('#startup-motion');if(await motion.getAttribute('aria-pressed')!=='true')await motion.click({timeout:remaining()});
 await page.locator('.cinema-ride-picker > summary').click({timeout:remaining()});
 await page.locator('.ride-options label').filter({hasText:'One wheel'}).click({timeout:remaining()});
 await page.getByRole('button',{name:'Use this ride',exact:true}).click({timeout:remaining()});
 await page.locator('#start').click({timeout:remaining()});
 await expect(page.locator('body')).not.toHaveClass(/at-start/,{timeout:remaining()});
 let currentHour;
 for(let i=0;i<scheduled.length;i++){
  const {site,light,hour}=scheduled[i],entry=report.visits[i];if(!entry.selected)continue;
  if(performance.now()>=deadline){entry.status='not-attempted';entry.failure='Fixed gallery budget exhausted';continue;}
  currentPhase=site.id+'/'+light;entry.status='attempting';entry.startedAtMs=elapsed();
  try{
   if(hour!==currentHour){await configure(hour);currentHour=hour;}
   entry.destination=await travel(site);entry.frame=await painted();
   await expect.poll(()=>page.locator('#profile').getAttribute('data-quality'),{timeout:remaining()}).toBe(quality);
   entry.cameraBefore=await camera();entry.position=positionReceipt(entry.cameraBefore,site);
   entry.focus=await page.evaluate(()=>({focused:document.hasFocus(),visibility:document.visibilityState,activeElement:document.activeElement?.id||null}));
   assert(entry.focus.focused&&entry.focus.visibility==='visible','Game page is not foreground at capture');
   const filename=site.id+'-'+device+'-'+quality+'-'+light+'.png';
   const bytes=await page.screenshot({path:resolve(output,filename),timeout:remaining(limits.screenshotMs)});
   entry.screenshot=filename;entry.screenshotBytes=bytes.length;entry.sha256=hash(bytes);
   assert(bytes.length>=12000,'Screenshot is unexpectedly small; inspect retained image');
   assert.equal(bytes.readUInt32BE(16),viewport.width,'PNG width differs from requested viewport');
   assert.equal(bytes.readUInt32BE(20),viewport.height,'PNG height differs from requested viewport');
   entry.cameraAfter=await camera();
   entry.cameraDrift={distanceM:Math.hypot(...entry.cameraAfter.position.map((v,n)=>v-entry.cameraBefore.position[n])),
    directionDelta:Math.hypot(...entry.cameraAfter.direction.map((v,n)=>v-entry.cameraBefore.direction[n]))};
   assert(entry.cameraDrift.distanceM<=3&&entry.cameraDrift.directionDelta<=.08,'Camera drift exceeded existing gallery tolerances during screenshot');
   entry.activeFramesAfterScreenshot=await frames();
   entry.profileData=await page.locator('#profile').evaluate(node=>({...node.dataset}));
   entry.place=await page.locator('#place').textContent({timeout:remaining()});
   entry.observedSkyHour=Number(await page.locator('#sky-hour').inputValue({timeout:remaining()}));
   assert(Math.abs(entry.observedSkyHour-Number(hour))<.051,'Captured sky differs from requested hour');
   assert.equal(Number(entry.profileData.jeffersonBuildings),6,'Real game did not report all six Jefferson replicas');
   entry.passed=true;entry.status='captured';
  }catch(error){
   entry.status='failed';entry.failure=error?.stack||String(error);
   try{entry.failureCamera=await camera();}catch(observerError){entry.failureObserverError=String(observerError);}
   if(page&&!page.isClosed()&&performance.now()<deadline)await page.keyboard.press('Escape').catch(()=>{});
  }
  entry.completedAtMs=elapsed();await persist();
 }
}catch(error){recordError(error?.stack||String(error));}
finally{
 clearTimeout(watchdog);currentPhase='cleanup';
 if(browser)await browser.close().catch(error=>report.cleanupErrors.push(String(error)));
 if(server)await new Promise(done=>server.close(done));
 for(const entry of report.visits)if(entry.selected&&(entry.status==='scheduled'||entry.status==='attempting')){
  entry.status='not-attempted';entry.failure='Run ended before this scheduled capture completed';
 }
 report.coverageGaps=report.visits.filter(v=>!v.passed).map(v=>({id:v.id,light:v.light,status:v.status,reason:v.failure||'Not selected for this run'}));
 report.fullDayCoverageComplete=report.visits.filter(v=>v.light==='high-noon').every(v=>v.passed);
 report.selectedCoveragePassed=report.visits.filter(v=>v.selected).every(v=>v.passed)&&!report.errors.length&&!report.failedRequests.length&&!report.cleanupErrors.length;
 report.passed=report.fullDayCoverageComplete&&report.visits.every(v=>v.passed)&&report.selectedCoveragePassed;
 report.status=report.passed?'complete':report.visits.some(v=>v.screenshot)?'partial':'failed';
 report.finishedAt=new Date().toISOString();report.elapsedMs=elapsed();await persist();
}
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cards=report.visits.map(entry=>'<article><h2>'+escape(entry.name)+'</h2><p>'+escape(entry.quality)+' · '+escape(entry.light)+' · '+escape(entry.status)+'</p>'+
 (entry.screenshot?'<a href="'+escape(entry.screenshot)+'"><img src="'+escape(entry.screenshot)+'" alt="Actual game capture of '+escape(entry.name)+'"></a>':'<p class="missing">No captured image for this scheduled view.</p>')+
 (entry.failure?'<details><summary>Capture limitation</summary><pre>'+escape(entry.failure)+'</pre></details>':'')+
 (entry.cameraBefore?'<details><summary>Observed game camera</summary><pre>'+escape(JSON.stringify(entry.cameraBefore,null,2))+'</pre></details>':'')+'</article>').join('');
await writeFile(resolve(output,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jefferson actual-game gallery</title><style>body{margin:0;padding:28px;background:#111921;color:#e7edf2;font:16px/1.5 system-ui,sans-serif}header{max-width:1000px}h1{font-size:32px;margin:0 0 10px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,350px),1fr));gap:22px}article{background:#1a2632;border:1px solid #46596b;border-radius:10px;padding:18px;overflow:hidden}img{display:block;width:100%;height:auto}a{color:#85d7ff}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.missing{color:#f0c797}h2{font-size:20px}</style><header><h1>Jefferson Avenue — actual game captures</h1><p>'+escape(device)+' · '+escape(quality)+' · '+escape(report.status)+'. Captured '+report.visits.filter(v=>v.passed).length+' of '+report.visits.length+' scheduled views.</p><p>These images come from the built game and its public Guide travel controls. Partial selections remain marked. Visual likeness and the original sustained performance release gates are separate.</p><p><a href="report.json">Open the complete evidence report</a></p></header><main>'+cards+'</main></html>');
console.log(JSON.stringify({output,passed:report.passed,selectedCoveragePassed:report.selectedCoveragePassed,partialSelection:report.partialSelection,
 status:report.status,renderer:report.renderer,captured:report.visits.filter(v=>v.passed).map(v=>v.screenshot),coverageGaps:report.coverageGaps,errors:report.errors.slice(0,4)}));
if(!report.selectedCoveragePassed)process.exitCode=1;
