/** Reconstruct a retained exact-source preview for an isolated diagnostic. */
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile,writeFile,mkdir,cp,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {GAME,PIN,ROCKS,gitBlob,sha256,hashFile,buildInventory,verifyPreviewBuild,verifyDriver,verifySourceArtifact,verifyDistArchive} from './contract.mjs';
import {buildEmbeddedAssetIndex} from './embedded-assets.mjs';
export {verifySourceArtifact} from './contract.mjs';
const save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const timingPath='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/research/street-detail-stats.json';
export function onlyBuildTimingChanged(before,after){
 const a=JSON.parse(before),b=JSON.parse(after);assert(typeof a.buildMs==='number'&&typeof b.buildMs==='number');
 delete a.buildMs;delete b.buildMs;assert.deepEqual(a,b,'Generated data changed beyond buildMs');return true;
}
async function command(argv,cwd,log,env=process.env){
 const target=createWriteStream(log,{flags:'wx'}),started=new Date().toISOString();
 const status=await new Promise((ok,reject)=>{const child=spawn(argv[0],argv.slice(1),{cwd,env,stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(target,{end:false});child.stderr.pipe(target,{end:false});child.on('error',reject);child.on('close',code=>ok(code));});
 await new Promise((ok,reject)=>{target.on('error',reject);target.end(ok);});
 return {argv,started,finished:new Date().toISOString(),status,log:await hashFile(log)};
}
export async function preparePreview({checkout,evidence,sourceArchive,sourceMetadata}){
 // Explicitly guards a future local build; no trigger, download or Git mutation is included.
 assert.equal(process.env.BELLE_TRACE_BUILD_AUTHORIZED,'1','Prototype build disabled until explicitly authorized');
 checkout=resolve(checkout);evidence=resolve(evidence);const game=resolve(checkout,GAME),git=args=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();
 assert.equal(git(['rev-parse','HEAD']),PIN.head);assert.equal(git(['rev-parse','HEAD^{tree}']),PIN.tree);
 const preflight={head:git(['rev-parse','HEAD']),tree:git(['rev-parse','HEAD^{tree}']),
  status:git(['status','--porcelain=v1','--untracked-files=all','--ignored=matching']),
  untrackedAndIgnored:git(['ls-files','--others','--exclude-standard','--directory']),
  ignored:git(['ls-files','--others','--ignored','--exclude-standard','--directory'])};
 assert.equal(preflight.status,'','Use a new exact-head checkout with no pre-existing tracked, untracked or ignored changes');
 assert.equal(preflight.untrackedAndIgnored,'','Pre-existing untracked build inputs');assert.equal(preflight.ignored,'','Pre-existing ignored build inputs');
 for(const key of Object.keys(process.env))assert(!key.startsWith('VITE_')||key==='VITE_POLYHAVEN_ROCK_PREVIEW','Unexpected build flag: '+key);
 await mkdir(evidence,{recursive:false});
 await save(resolve(evidence,'fresh-checkout-preflight.json'),preflight);
 const driver=await readFile(resolve(game,'scripts/sustained-ride-profile.mjs')),gps=await readFile(resolve(game,'scripts/gps-full-scene-check.mjs'));
 verifyDriver(driver.toString(),gps.toString());assert.equal(gitBlob(await readFile(resolve(game,'scripts/coop-static-server.mjs'))),PIN.server);
 const metadata=JSON.parse(await readFile(sourceMetadata,'utf8'));verifySourceArtifact(metadata);
 assert.deepEqual(await hashFile(sourceArchive),{bytes:PIN.sourceArtifactBytes,sha256:PIN.sourceArtifactSha256});
 await cp(sourceArchive,resolve(evidence,'source-artifact.zip'),{errorOnExist:true,force:false});
 await cp(sourceMetadata,resolve(evidence,'source-artifact-metadata.json'),{errorOnExist:true,force:false});
 // Only the exact three established GLBs are staged; reject unsafe archive names,
 // symlinks, duplicates and any mismatch before writing the future checkout.
 const staging=resolve(game,'public/belle/polyhaven-review');
 await assert.rejects(lstat(staging),{code:'ENOENT'},'Refuse an existing preview staging directory');
 await assert.rejects(lstat(resolve(game,'dist')),{code:'ENOENT'},'Refuse an existing compiled build');
 const extraction=`import json,sys,zipfile,stat,hashlib,pathlib\nz=zipfile.ZipFile(sys.argv[1]); rows=json.loads(sys.argv[3]); names=set()\nfor e in z.infolist():\n p=pathlib.PurePosixPath(e.filename); assert e.filename and not p.is_absolute() and '..' not in p.parts and '\\\\' not in e.filename and e.filename not in names and not stat.S_ISLNK(e.external_attr>>16); names.add(e.filename)\nprovenance=json.loads(z.read('source-provenance.json')); assert provenance['head']==sys.argv[4] and provenance['tree']==sys.argv[5] and provenance['runId']==sys.argv[6]\nout=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=False)\nfor r in rows:\n b=z.read(r['folder']+'/'+r['file']); assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']; (out/r['file']).write_bytes(b)\n`;
 execFileSync('python3',['-c',extraction,sourceArchive,staging,JSON.stringify(ROCKS),PIN.head,PIN.tree,String(PIN.sourceArtifactRun)]);
 const timingBefore=await readFile(resolve(checkout,timingPath)),commands=[];
 await save(resolve(evidence,'application-inputs.json'),{head:PIN.head,tree:PIN.tree,driver:{bytes:driver.length,gitBlob:gitBlob(driver),sha256:sha256(driver)},
  gpsHelper:gitBlob(gps),server:PIN.server,rocks:ROCKS,sourceArtifact:metadata,canonicalPreviewRun:PIN.canonicalPreviewRun,failedBuildByteReplay:false,
  gameLock:await hashFile(resolve(game,'package-lock.json')),browserLock:await hashFile(resolve(game,'../../package-lock.json'))});
 for(const [i,argv] of [['ci',['npm','ci']],['check',['npm','run','check']],['test',['npm','test']],['build',['npm','run','build']]]){
  const env=i==='build'?{...process.env,VITE_POLYHAVEN_ROCK_PREVIEW:'1'}:process.env;
  const row=await command(argv,game,resolve(evidence,i+'.log'),env);commands.push(row);await writeFile(resolve(evidence,'commands.json'),JSON.stringify(commands,null,2)+'\n');
  assert.equal(row.status,0,'Original build preparation failed: '+i);
 }
 const changed=git(['diff','--name-only','HEAD','--']).split('\n').filter(Boolean);
 assert(changed.every(x=>x===timingPath),'Tracked source/data changed during rebuild: '+changed.join(', '));
 if(changed.length){const after=await readFile(resolve(checkout,timingPath));onlyBuildTimingChanged(timingBefore,after);
  await save(resolve(evidence,'generated-timing.json'),{path:timingPath,beforeSha256:sha256(timingBefore),afterSha256:sha256(after),beforeText:timingBefore.toString(),afterText:after.toString(),onlyBuildMsChanged:true});
  await writeFile(resolve(checkout,timingPath),timingBefore);}
 assert.equal(git(['diff','--name-only','HEAD','--']),'');
 const files=await buildInventory(resolve(game,'dist')),previewBuild=await verifyPreviewBuild(resolve(game,'dist'),files);
 const embeddedImageIndex=await buildEmbeddedAssetIndex(resolve(game,'dist'),files);
 await save(resolve(evidence,'embedded-image-index.json'),embeddedImageIndex);
 const archive=resolve(evidence,'rebuilt-preview-dist.zip');
 const zipper=`import pathlib,sys,zipfile\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:\n for p in sorted(root.rglob('*')):\n  assert not p.is_symlink()\n  if p.is_file(): z.write(p,p.relative_to(root).as_posix())\n`;
 execFileSync('python3',['-c',zipper,resolve(game,'dist'),archive]);
 verifyDistArchive(archive,files);
 const receipt={diagnosticBuild:true,failedBuildByteReplay:false,head:PIN.head,tree:PIN.tree,canonicalPreviewRun:PIN.canonicalPreviewRun,
  sourceArtifactId:PIN.sourceArtifactId,sourceArtifactSha256:PIN.sourceArtifactSha256,rocks:ROCKS,buildCommand:['npm','run','build'],
  buildEnvironment:{VITE_POLYHAVEN_ROCK_PREVIEW:'1'},buildExit:0,cleanTrackedInputs:true,commands,previewBuild,files,
  embeddedImageIndexFile:'embedded-image-index.json',embeddedImageIndexReceipt:await hashFile(resolve(evidence,'embedded-image-index.json')),
  distArchive:'rebuilt-preview-dist.zip',distArchiveReceipt:await hashFile(archive),node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim()};
 await save(resolve(evidence,'preview-build-receipt.json'),receipt);return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [checkout,evidence,sourceArchive,sourceMetadata]=process.argv.slice(2);assert(checkout&&evidence&&sourceArchive&&sourceMetadata);
 const receipt=await preparePreview({checkout,evidence,sourceArchive,sourceMetadata});console.log(JSON.stringify({diagnosticBuild:true,failedBuildByteReplay:false,files:receipt.files.length,dist:receipt.distArchiveReceipt}));
}
