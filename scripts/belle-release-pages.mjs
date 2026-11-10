/** Binds the published Belle game bytes to the Pages build commit. Read/hash only;
 * never edits generated game bundles or changes the existing size/test policy. */
import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile,lstat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
export const GAME_PATH='lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const shaPattern=/^[0-9a-f]{40}$/;
function safePath(value){return typeof value==='string'&&value.startsWith(GAME_PATH)&&!value.includes('..')&&!value.includes('\\')&&!/[?#%\x00-\x20]/.test(value);}
export async function stampBelleRelease(site){
 const root=resolve(site),manifestPath=resolve(root,'pages-artifact-manifest.json');
 const manifest=JSON.parse(await readFile(manifestPath,'utf8'));if(!shaPattern.test(manifest.commit))throw Error('Pages commit is missing or invalid');
 const gameRoot=resolve(root,GAME_PATH),files=[];
 async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name),s=await lstat(path);if(s.isSymbolicLink())throw Error('Published game must not contain a symlink');
  if(s.isDirectory()){await visit(path);continue;}
  const name=relative(root,path).split(sep).join('/');
  if(!s.isFile()||!(/\.(js|css)$/i.test(name)||name===GAME_PATH+'index.html'))continue;
  if(!safePath(name)||s.size>32*1024*1024)throw Error('Unsafe/oversized game bundle '+name);
  const bytes=await readFile(path);files.push({path:name,bytes:bytes.length,sha256:hash(bytes)});
 }}
 await visit(gameRoot);files.sort((a,b)=>a.path.localeCompare(b.path));
 const entry=GAME_PATH+'index.html',index=files.find(f=>f.path===entry);
 if(!index||!files.some(f=>f.path.endsWith('.js')))throw Error('Actual game entry and JavaScript bundles are required');
 const html=await readFile(resolve(root,entry),'utf8');
 const moduleURLs=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
 if(!moduleURLs.length)throw Error('Game HTML has no bundle scripts');
 for(const src of moduleURLs){const url=new URL(src,'https://build.invalid/'+entry);if(url.origin!=='https://build.invalid'||!files.some(f=>'/'+f.path===url.pathname))throw Error('Game entry references an unbound bundle '+src);}
 // The content signatures establish that the source-level features reached the
 // emitted application; they are not a substitute for real browser gameplay.
 let js='';for(const f of files.filter(f=>f.path.endsWith('.js')))js+=await readFile(resolve(root,f.path),'utf8');
 const signatures={localCoop:js.includes('coop-open')&&js.includes('coop-overlay'),startupProfile:js.includes('__belleStartupProfile')};
 if(Object.values(signatures).some(v=>!v))throw Error('Required co-op/startup code absent from actual emitted bundles');
 manifest.belleGame={version:1,commit:manifest.commit,entry,files,signatures};
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 return manifest.belleGame;
}
export async function verifyBelleRelease(base,expected,{fetcher=fetch}={}){
 if(!shaPattern.test(expected))throw Error('Expected exact production merge SHA is required');
 const origin=new URL(base);if(origin.protocol!=='https:'||origin.username||origin.password||!origin.pathname.endsWith('/'))throw Error('Use the production HTTPS base URL');
 const get=async(path,max=32*1024*1024)=>{
  const url=new URL(path,origin);if(url.origin!==origin.origin||!url.pathname.startsWith(origin.pathname))throw Error('Verification URL escaped production base');
  url.searchParams.set('verify',expected);
  const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(45000),redirect:'error'});
  if(!response.ok)throw Error('HTTP '+response.status+' '+path);
  const body=Buffer.from(await response.arrayBuffer());if(body.length>max)throw Error('Oversized public response '+path);
  return {body,url:url.href,status:response.status};
 };
 const manifestResponse=await get('pages-artifact-manifest.json',4*1024*1024),manifest=JSON.parse(manifestResponse.body);
 if(manifest.commit!==expected)throw Error('Public Pages manifest is '+manifest.commit+', expected '+expected);
 const release=manifest.belleGame;
 if(release?.version!==1||release.commit!==expected||release.entry!==GAME_PATH+'index.html'||!Array.isArray(release.files)||release.files.length<2||release.files.length>300)throw Error('Missing or invalid emitted-game provenance');
 if(!release.signatures?.localCoop||!release.signatures?.startupProfile)throw Error('Expected game features absent from build evidence');
 const seen=new Set(),verified=[];let indexText='';
 for(const file of release.files){
  if(!safePath(file.path)||seen.has(file.path)||!/^([0-9a-f]{64})$/.test(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<1||file.bytes>32*1024*1024)throw Error('Invalid bundle hash entry');seen.add(file.path);
  const result=await get(file.path);
  if(result.body.length!==file.bytes||hash(result.body)!==file.sha256)throw Error('Public bundle differs from deployed build: '+file.path);
  if(file.path===release.entry)indexText=result.body.toString('utf8');
  verified.push({path:file.path,sha256:file.sha256,bytes:result.body.length,status:result.status});
 }
 if(!indexText||!verified.some(f=>f.path.endsWith('.js')))throw Error('Public HTML or game JavaScript was not verified');
 for(const match of indexText.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)){
  const url=new URL(match[1],new URL(release.entry,origin));const prefix=origin.pathname;
  if(url.origin!==origin.origin||!url.pathname.startsWith(prefix)||!seen.has(url.pathname.slice(prefix.length)))throw Error('Public HTML script points outside verified release');
 }
 return {passed:true,commit:expected,manifest:manifestResponse.url,game:new URL(release.entry,origin).href,verifiedAt:new Date().toISOString(),verifiedFiles:verified,scope:'Fetched public Pages manifest AND every stamped game HTML/JS/CSS file; SHA-256 and byte lengths match the production build. Not an interactive browser playtest.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,arg,sha]=process.argv.slice(2);
 if(mode==='stamp'){console.log(JSON.stringify(await stampBelleRelease(arg||'_site'),null,2));}
 else if(mode==='verify'){
  let result,last;const attempts=[];
  // CDN propagation retries are bounded and read-only; no failed workflow is restarted.
  for(let attempt=1;attempt<=10;attempt++){
   try{result=await verifyBelleRelease(arg,sha);break;}catch(error){last=error;attempts.push({attempt,at:new Date().toISOString(),error:String(error)});if(attempt<10)await new Promise(r=>setTimeout(r,30000));}
  }
  const report=result?{...result,attempts}:{passed:false,commit:sha,attempts,failure:String(last)};
  await writeFile('belle-public-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!result)process.exitCode=1;
 }else throw Error('Usage: node scripts/belle-release-pages.mjs stamp _site | verify https://host/base/ <merge-sha>');
}
