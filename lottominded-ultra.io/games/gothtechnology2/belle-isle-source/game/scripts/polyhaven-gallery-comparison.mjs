/** Additive exact-source flag-off/flag-on evidence. Guide routes are paired;
 * camera equivalence, visual overlap and collision acceptance require review.
 * This never seeds poses or changes the separate 90-second performance harness.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rm,access} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import zones from '../src/belle/environmentZones.json' with {type:'json'};

const game=resolve(import.meta.dirname,'..');
const prototypes=[['namaqualand_boulder_03','boulder-automatic.glb'],['rock_moss_set_01','moss-1-automatic.glb'],['rock_moss_set_01','moss-2-automatic.glb']];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const save=async(file,value)=>writeFile(file,JSON.stringify(value,null,2)+'\n');
const modes=['baseline','candidate'];
export const comparisonLimitations=[
 'The baseline is the same exact source with VITE_POLYHAVEN_ROCK_PREVIEW=0; it is not a historical production revision.',
 'Both modes use the same eight public Guide Travel destinations and settings. Rider/camera pose is not recorded; identical poses and pixel-aligned images are not established.',
 'Inspect both real images at every stop for visual quality, old/new geometry overlap and framing. Automated capture checks do not approve these visual properties or unchanged collision behavior.',
 'Phone Smooth intentionally retains original rock visuals; loaded prototypes and zero preview-visible instances verify that fallback, not mobile display of the new rocks.',
 'Gallery captures do not certify physical-phone performance or replace the unchanged native 90-second performance runs.'
];

export function expectedVisits(device){
 return zones.zones.flatMap(zone=>zone.stops.map((stop,index)=>({id:zone.id+'-'+stop.id,destination:stop.destinationName,
  quality:device==='phone'?'smooth':'high',light:index%2?'overcast-sunset':'clear-noon',clouds:index%2?'overcast':'clear',time:index%2?17.8:12})));
}

export function compareGalleries(captures,{head,tree,device}){
 const errors=[],pairs=[],view=device==='phone'?{width:390,height:844}:{width:1440,height:900};
 const check=(ok,message)=>{if(!ok)errors.push(message);};
 check(/^[0-9a-f]{40}$/.test(head||'')&&/^[0-9a-f]{40}$/.test(tree||''),'Missing exact source head/tree');
 check(['desktop','phone'].includes(device),'Unknown device');
 for(const mode of modes){
  const capture=captures[mode],report=capture?.gallery;
  check(capture?.sourceHead===head&&capture?.sourceTree===tree,mode+': source mismatch');
  check(capture?.mode===mode&&capture?.previewFlag===(mode==='candidate'?'1':'0'),mode+': build mode mismatch');
  check(capture?.buildStatus===0&&capture?.captureStatus===0,mode+': build or capture failed');
  for(const error of capture?.errors||[])errors.push(mode+': '+error);
  check(report?.passed===true,mode+': gallery not passed');
  if(!report)continue;
  check(report.head===head&&report.sourceTree===tree&&report.mode===mode,mode+': gallery source/mode mismatch');
  check(report.hostPlatform==='darwin'&&/Metal/i.test(report.renderer||'')&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report.renderer||''),mode+': native Mac Metal required');
  check(report.device===device&&report.viewport?.width===view.width&&report.viewport?.height===view.height&&report.browserViewport?.width===view.width&&report.browserViewport?.height===view.height&&report.browserViewport?.devicePixelRatio===1,mode+': viewport or DPR mismatch');
  check(report.route===zones.id&&report.quick===true&&report.qualities?.length===1&&report.qualities[0]===(device==='phone'?'smooth':'high'),mode+': route/quality mismatch');
  for(const key of ['errors','failedRequests','coverageGaps'])check(Array.isArray(report[key])&&report[key].length===0,mode+': '+key+' not empty or missing');
  const visits=report.visits||[],expected=expectedVisits(device);
  check(visits.length===expected.length&&new Set(visits.map(v=>v.id)).size===expected.length,mode+': missing or duplicate visits');
  for(const stop of expected){
   const visit=visits.find(v=>v.id===stop.id),label=mode+': '+stop.id;
   check(visit?.passed===true&&visit.frame?.gpuFence===true,label+': missing genuine painted capture');
   check(visit?.destination===stop.destination&&visit.quality===stop.quality&&visit.light===stop.light&&visit.clouds===stop.clouds,label+': Guide route or lighting mismatch');
   check(visit?.settings?.quality===stop.quality&&visit.profileData?.quality===stop.quality&&Number(visit.settings?.time)===stop.time&&visit.settings?.clouds===stop.clouds&&visit.settings?.cycle===false&&Number(visit.settings?.cap)===(device==='phone'?30:60),label+': actual settings mismatch');
   check(visit?.settings?.focused===true&&visit.settings?.visibility==='visible',label+': capture not foreground');
   check(typeof visit?.screenshot==='string'&&basename(visit.screenshot)===visit.screenshot&&visit.screenshot.endsWith('.png')&&visit.screenshotBytes>=15000&&/^[0-9a-f]{64}$/.test(visit.sha256||''),label+': image receipt missing');
   const rocks=visit?.rockReview;
   check(Number.isInteger(rocks?.visible)&&rocks.visible>=0,label+': missing rock telemetry');
   if(mode==='baseline')check(rocks?.state===null&&rocks.loaded===false&&rocks.visible===0,label+': preview active in baseline');
   else{
    check(rocks?.state==='loaded'&&rocks.loaded===true,label+': source prototypes not loaded');
    if(device==='phone')check(rocks?.visible===0,label+': Smooth unexpectedly displays preview rocks');
   }
  }
  if(mode==='candidate'&&device==='desktop')check(visits.some(v=>v.passed&&v.rockReview?.visible>0),'candidate: no desktop visit displays source-rock instances');
 }
 for(const stop of expectedVisits(device)){
  const baseline=captures.baseline?.gallery?.visits?.find(v=>v.id===stop.id),candidate=captures.candidate?.gallery?.visits?.find(v=>v.id===stop.id);
  pairs.push({id:stop.id,destination:stop.destination,quality:stop.quality,light:stop.light,
   baseline:baseline?.screenshot||null,candidate:candidate?.screenshot||null,
   guideSettingsMatch:!!baseline&&!!candidate&&['destination','quality','light','clouds'].every(key=>baseline[key]===candidate[key]),cameraEquivalence:'unverified'});
 }
 return {automatedEvidencePassed:errors.length===0,errors,pairs,manualReviewRequired:true,
  visualOverlapAccepted:null,collisionBehaviorAccepted:null,limitations:comparisonLimitations};
}

export async function verifyImages(report,directory,device){
 for(const visit of report.visits||[]){
  if(!visit.screenshot)continue;
  assert.equal(basename(visit.screenshot),visit.screenshot,'Image path escapes capture directory');
  const bytes=await readFile(resolve(directory,visit.screenshot));
  assert.equal(bytes.length,visit.screenshotBytes,'Image byte receipt mismatch');
  assert.equal(digest(bytes),visit.sha256,'Image hash receipt mismatch');
  assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Capture is not PNG');
  assert.equal(bytes.toString('ascii',12,16),'IHDR','PNG dimensions missing');
  assert.equal(bytes.readUInt32BE(16),device==='phone'?390:1440,'Image viewport width mismatch');
  assert.equal(bytes.readUInt32BE(20),device==='phone'?844:900,'Image viewport height mismatch');
 }
}

function run(command,args,env,timeout){
 const result=spawnSync(command,args,{cwd:game,env,stdio:'inherit',timeout});
 if(result.error)throw result.error;
 if(result.signal)throw Error(command+' terminated by '+result.signal);
 return result.status;
}
const safe=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function comparisonHtml(report){
 return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Poly Haven Guide route comparison</title><style>body{font:16px system-ui;margin:24px;background:#171c22;color:#eee}section{margin:24px 0;border-top:1px solid #667;padding-top:16px}.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}figure{margin:0}img{width:100%;height:auto}pre{white-space:pre-wrap}</style><h1>Poly Haven Guide route comparison · '+safe(report.device)+'</h1><p>Automated evidence checks: '+(report.automatedEvidencePassed?'passed':'FAILED')+'. Manual pose, overlap and collision review remains required.</p><p>Source '+safe(report.sourceHead)+' · tree '+safe(report.sourceTree)+'</p><ul>'+comparisonLimitations.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ul><pre>'+safe(report.errors.join('\n'))+'</pre>'+report.pairs.map(pair=>'<section><h2>'+safe(pair.destination)+'</h2><p>'+safe(pair.quality)+' · '+safe(pair.light)+' · camera equivalence unverified</p><div class="pair">'+modes.map(mode=>'<figure><figcaption>'+mode+' · preview flag '+(mode==='candidate'?'1':'0')+'</figcaption>'+(pair[mode]?'<img src="'+mode+'/'+safe(pair[mode])+'" alt="'+mode+' real game capture at '+safe(pair.destination)+'">':'<p>Missing capture</p>')+'</figure>').join('')+'</div></section>').join('');
}

async function main(){
 const device=process.env.ENV_GALLERY_DEVICE,output=resolve(game,'output/polyhaven-comparison',device||'unknown');
 const captures={},fatal=[],started=new Date().toISOString();
 let sourceHead=null,sourceTree=null,sourceArtifact=null;
 await mkdir(output,{recursive:true});
 await save(resolve(output,'comparison.json'),{automatedEvidencePassed:false,status:'running',device,started,manualReviewRequired:true});
 try{
  assert.ok(['desktop','phone'].includes(device),'Select desktop or phone');
  assert.equal(process.platform,'darwin','Comparison requires native Mac Metal');
  sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim();
  sourceTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:game,encoding:'utf8'}).trim();
  assert.equal(sourceHead,process.env.POLYHAVEN_EXPECTED_HEAD,'Checkout does not match exact requested head');
  execFileSync('git',['diff','--quiet','HEAD','--'],{cwd:game});
  assert.ok(process.env.POLYHAVEN_REVIEW_DIR,'Missing source-art artifact directory');
  const artifact=resolve(process.env.POLYHAVEN_REVIEW_DIR);
  sourceArtifact=await json(resolve(artifact,'source-provenance.json'));
  assert.equal(sourceArtifact.head,sourceHead,'Source-art head mismatch');
  assert.equal(sourceArtifact.tree,sourceTree,'Source-art tree mismatch');
  const assets=[];
  for(const [folder,file] of prototypes){
   const source=await readFile(resolve(artifact,folder,file)),staged=await readFile(resolve(game,'public/belle/polyhaven-review',file));
   assert.ok(source.equals(staged),'Staged prototype differs from source-art: '+file);
   assets.push({file,bytes:source.length,sha256:digest(source)});
  }
  for(const mode of modes){
   const directory=resolve(output,mode),capture={mode,sourceHead,sourceTree,previewFlag:mode==='candidate'?'1':'0',assets,buildStatus:null,captureStatus:null,errors:[],gallery:null};
   captures[mode]=capture;
   await rm(directory,{recursive:true,force:true});await mkdir(directory,{recursive:true});
   try{
    capture.buildStatus=run('npm',['run','build'],{...process.env,VITE_POLYHAVEN_ROCK_PREVIEW:capture.previewFlag},30*60*1000);
    assert.equal(capture.buildStatus,0,'Build failed');
    const manifestBytes=await readFile(resolve(game,'dist/asset-manifest.json')),manifest=JSON.parse(manifestBytes);
    capture.assetManifestSha256=digest(manifestBytes);capture.entryHtmlSha256=digest(await readFile(resolve(game,'dist/index.html')));
    for(const asset of assets){
     const relative='belle/polyhaven-review/'+asset.file,filename=resolve(game,'dist',relative);
     assert.equal(manifest.includes(relative),mode==='candidate','Build manifest mode mismatch: '+relative);
     if(mode==='candidate')assert.equal(digest(await readFile(filename)),asset.sha256,'Built prototype hash mismatch: '+relative);
     else await assert.rejects(access(filename),{code:'ENOENT'},'Baseline unexpectedly contains preview prototype');
    }
    capture.captureStatus=run(process.execPath,['scripts/island-zone-gallery.mjs'],{...process.env,
     ENV_GALLERY_DEVICE:device,ENV_GALLERY_REQUIRE_METAL:'1',ENV_GALLERY_QUICK:'1',ENV_GALLERY_MODE:mode,
     ENV_GALLERY_POLYHAVEN:mode==='candidate'&&device==='desktop'?'1':'0',ENV_GALLERY_OUTPUT_DIR:directory,
     ENV_GALLERY_SOURCE_SHA:sourceHead,ENV_GALLERY_SOURCE_TREE:sourceTree,ENV_GALLERY_URL:'',ENV_GALLERY_BROWSER:'chrome'},40*60*1000);
    capture.gallery=await json(resolve(directory,'report.json'));
    await verifyImages(capture.gallery,directory,device);
   }catch(error){capture.errors.push(error.stack||String(error));}
   await save(resolve(directory,'capture.json'),capture);
  }
 }catch(error){fatal.push(error.stack||String(error));}
 const report={...compareGalleries(captures,{head:sourceHead,tree:sourceTree,device}),device,sourceHead,sourceTree,sourceArtifact,started,finished:new Date().toISOString(),workflowSha:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,captures};
 report.errors.push(...fatal);report.automatedEvidencePassed=report.errors.length===0;
 await save(resolve(output,'comparison.json'),report);
 await writeFile(resolve(output,'index.html'),comparisonHtml(report));
 console.log(JSON.stringify({device,sourceHead,sourceTree,automatedEvidencePassed:report.automatedEvidencePassed,manualReviewRequired:true,errors:report.errors}));
 if(!report.automatedEvidencePassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
