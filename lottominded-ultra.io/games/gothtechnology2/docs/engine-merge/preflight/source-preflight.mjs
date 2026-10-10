// Read-only provenance inventory. Run from any working directory with Node 22+.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const here=import.meta.dirname;
const pack=resolve(here,'../../..');
const repo=resolve(pack,'../../..');
const workspace=dirname(repo);
const upstream=resolve(repo,'.game-builds/breadflowerdos-upstream');
const pin='6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db';
const git=(at,...args)=>execFileSync('git',['-C',at,...args],{encoding:'utf8'}).trim();
if(git(upstream,'rev-parse','HEAD')!==pin)throw Error('UPSTREAM_PIN_MISMATCH');
// Compare content, not checkout stat-cache timestamps after CRLF normalization.
git(upstream,'diff','--exit-code','HEAD');
const paths=['LICENSE','README.md','CMakeLists.txt','src/dice/hfe/io/PlayerInput.hpp','src/dice/hfe/EventManager.cpp','src/dice/hfe/EventManager.hpp','src/dice/hfe/world/Object.hpp','src/dice/hfe/world/ObjectModule.cpp','src/dice/hfe/world/PlayerManager.cpp','src/dice/hfe/VariableStorage.hpp','src/dice/hfe/SettingsRepostitory.cpp','src/dice/hfe/SettingsRepostitory.hpp','src/dice/hfe/Game.hpp','src/dice/hfe/GameServer.cpp'];
const files=[];
for(const path of paths){
 const bytes=await readFile(resolve(upstream,path));
 const gitBlob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
 const expected=git(upstream,'rev-parse',`${pin}:${path}`);
 if(gitBlob!==expected)throw Error('GIT_BLOB_MISMATCH '+path);
 files.push({path,gitBlob,sha256:createHash('sha256').update(bytes).digest('hex'),verified:true});
}
const targets=[['swoop',resolve(pack,'swoop-source')],['elmwoodPackagedSource',resolve(pack,'elmwood-source')],['elmwoodExternal',resolve(workspace,'euc-detroit-riverwalk')],['rideCoreActualLinked',resolve(workspace,'Digital_Static_RideCore')],['rideCoreRoyale',resolve(pack,'ride-core')]];
const sources=[];
for(const [id,path]of targets){const pkg=await readFile(resolve(path,'package.json'));sources.push({id,path,packageSha256:createHash('sha256').update(pkg).digest('hex'),packageVersion:JSON.parse(pkg).version});}
const suppliedRoot=resolve(pack,'engine/breadflowerdos/supplied-kit');
const supplied=[];
for(const name of ['README.md','00_START_HERE.txt','01_ENGINE_MERGE_MASTER_PROMPT.md','02_ENGINE_MERGE_ACCEPTANCE_TESTS.md','03_STATIC_ROYALE_GAMEPLAY_SPEC.md','engine/src/input_bridge.cpp','tests/wasm.test.mjs','dist/breadflower-input.wasm']){
 const path=resolve(suppliedRoot,name);try{await access(path);const b=await readFile(path);supplied.push({name,path,present:true,sha256:createHash('sha256').update(b).digest('hex')});}catch{supplied.push({name,path,present:false});}
}
const result={date:new Date().toISOString(),scope:'CORE_RELEASE',stage:'Source inventory; runtime status is tracked separately in STATUS.md',upstreamCommit:pin,upstreamPristine:true,repoHead:git(repo,'rev-parse','HEAD'),repoBranch:git(repo,'branch','--show-current'),files,sources,supplied,providedBridgeTests:'See provided-* evidence; this inventory does not execute tests',gameIntegration:'See per-product acceptance ledger',sixHumanOnline:'NOT TESTED'};
await mkdir(resolve(here,'../evidence'),{recursive:true});
await writeFile(resolve(here,'../evidence/source-preflight.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({upstreamCommit:pin,verifiedFiles:files.length,sources:sources.map(s=>s.id),providedBridgeTests:result.providedBridgeTests},null,2));

