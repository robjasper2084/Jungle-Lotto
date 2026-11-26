import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const GAME_PATH='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game';
export const pins=JSON.parse(await readFile(new URL('./pins.json',import.meta.url),'utf8'));
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');

export function verifyArtifactMetadata(value){
 assert.equal(value.id,pins.artifact.id,'Original artifact ID changed');
 assert.equal(value.name,pins.artifact.name,'Original artifact name changed');
 assert.equal(value.size_in_bytes,pins.artifact.bytes,'Original artifact size changed');
 assert.equal(value.digest,'sha256:'+pins.artifact.sha256,'Original artifact digest changed');
 assert.equal(value.expired,false,'Original artifact has expired');
 assert.equal(value.workflow_run?.id,pins.originalRun,'Original build run changed');
 assert.equal(value.workflow_run?.head_sha,pins.applicationSource,'Original artifact source changed');
 return value;
}

export async function manifest(directory){
 const files=[];
 async function visit(relative=''){
  const entries=await readdir(resolve(directory,relative),{withFileTypes:true});
  entries.sort((a,b)=>a.name.localeCompare(b.name,'en'));
  for(const entry of entries){
   const path=relative?relative+'/'+entry.name:entry.name;
   assert(!entry.isSymbolicLink(),'Build symlink is not supported: '+path);
   if(entry.isDirectory())await visit(path);
   else{
    assert(entry.isFile(),'Unexpected build entry: '+path);
    const bytes=await readFile(resolve(directory,path));
    files.push({path,bytes:bytes.length,sha256:sha256(bytes)});
   }
  }
 }
 await visit();
 return{version:1,files,manifestSha256:sha256(JSON.stringify(files))};
}

export async function verifyManifest(directory,expected){
 const actual=await manifest(directory);
 assert.deepEqual(actual,expected,'Original build files changed');
 return actual;
}

export async function prepare(app,bundle,evidence,diagnosticRevision){
 assert.match(diagnosticRevision,/^[0-9a-f]{40}$/,'Missing immutable diagnostic revision');
 const git=args=>execFileSync('git',args,{cwd:app,encoding:'utf8'}).trim();
 assert.equal(git(['rev-parse','HEAD']),pins.applicationSource,'Application checkout changed');
 assert.equal(git(['rev-parse','HEAD^{tree}']),pins.applicationTree,'Application source tree changed');
 git(['diff','HEAD','--exit-code']);
 const game=resolve(app,GAME_PATH),dist=resolve(game,'dist'),scriptReceipts=[];
 for(const [file,expected] of Object.entries(pins.scripts)){
  const bytes=await readFile(resolve(game,'scripts',file));
  assert.equal(gitBlob(bytes),expected,'Original native helper changed: '+file);
  scriptReceipts.push({file,bytes:bytes.length,gitBlob:expected,sha256:sha256(bytes)});
 }
 const marker=JSON.parse(await readFile(resolve(dist,'cadillac-mods-build.json'),'utf8'));
 assert.deepEqual(marker,pins.build,'Original build marker changed');
 assert.equal(sha256(await readFile(resolve(dist,'index.html'))),pins.build.indexSha256,'Original index changed');
 await mkdir(evidence,{recursive:true});
 const buildManifest=await manifest(dist);
 const receipt={version:1,applicationSource:pins.applicationSource,applicationTree:pins.applicationTree,
  diagnosticRevision,originalRun:pins.originalRun,artifact:pins.artifact,build:marker,scriptReceipts,
  originalBuildManifestSha256:buildManifest.manifestSha256,preparedAt:new Date().toISOString(),
  scope:'Original immutable controls assets plus an isolated source-bound world fixture. No application source, original build byte, or controls acceptance change.'};
 await writeFile(resolve(evidence,'source-provenance.json'),JSON.stringify(receipt,null,2)+'\n');
 await writeFile(resolve(evidence,'dist-before.json'),JSON.stringify(buildManifest,null,2)+'\n');
 await writeFile(resolve(evidence,'original-controls-driver.mjs'),await readFile(resolve(game,'scripts/cadillac-mods-browser-smoke.mjs')));
 await writeFile(resolve(evidence,'pins.json'),await readFile(resolve(bundle,'pins.json')));
 return receipt;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [command,...args]=process.argv.slice(2);
 if(command==='artifact'){
  verifyArtifactMetadata(JSON.parse(await readFile(args[0],'utf8')));
  if(args[1]){const bytes=await readFile(args[1]);assert.equal(bytes.length,pins.artifact.bytes);assert.equal(sha256(bytes),pins.artifact.sha256);}
 }else if(command==='prepare')await prepare(...args);
 else if(command==='after'){
  const [app,evidence]=args,game=resolve(app,GAME_PATH);
  const expected=JSON.parse(await readFile(resolve(evidence,'dist-before.json'),'utf8'));
  await verifyManifest(resolve(game,'dist'),expected);
  execFileSync('git',['diff','HEAD','--exit-code'],{cwd:app});
  for(const [name,expectedBlob] of Object.entries(pins.scripts))assert.equal(gitBlob(await readFile(resolve(game,'scripts',name))),expectedBlob);
  await writeFile(resolve(evidence,'dist-after.json'),JSON.stringify(expected,null,2)+'\n');
 }else throw Error('Expected artifact, prepare or after');
}
