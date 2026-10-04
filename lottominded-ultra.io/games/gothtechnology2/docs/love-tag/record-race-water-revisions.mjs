import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const pack=resolve(import.meta.dirname,'../..'),actual='C:/Users/digit/Documents/phone/euc-detroit-riverwalk',core='C:/Users/digit/Documents/phone/Digital_Static_RideCore';
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const gitIdentity=cwd=>{try{return {root:execFileSync('git',['rev-parse','--show-toplevel'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(),head:execFileSync('git',['rev-parse','HEAD'],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()};}catch{return {root:cwd,head:'No Git revision available; use individual source hashes'};}};
const sources=[...['racePilot.ts','raceRules.ts','raceView.ts','mobileHud.css','dogCommandHud.ts','dogActions.css','controller.ts','recovery.ts','world.ts','water-recovery.test.ts'].map(f=>resolve(pack,'swoop-source/src/detroit',f)),...['cyclingView.ts','tagClient.ts','tag/rules.ts'].map(f=>resolve(core,'src',f)),resolve(core,'tests/tag.test.ts')];
const elmwood=['elmwood-race.ts','elmwood-race.test.ts','elmwood-gameplay.ts','elmwood-main-menu.ts','elmwood-ride.ts','elmwood-water.ts','elmwood-water.test.ts','elmwood-weather.ts','elmwood-environment.ts','elmwood.ts','elmwood-mobile-hud.css','riding/bicycleView.ts','dogActions.css'];
sources.push(resolve(actual,'src/detroit/elmwood-walkers.ts'));
// These already diverged before this task. Preserve both, and package the actual project.
sources.push(resolve(actual,'src/detroit/dogCommandHud.ts'),resolve(pack,'elmwood-source/src/detroit/dogCommandHud.ts'));
const mirrors=[];
for(const file of elmwood){const path=resolve(actual,'src/detroit',file),mirror=resolve(pack,'elmwood-source/src/detroit',file),a=await hash(path),b=await hash(mirror);sources.push(path,mirror);mirrors.push({file,actual:a,mirror:b,match:a===b});}
for(const file of ['build-swoop-detroit.mjs','build-elmwood-explorer.mjs','elmwood-explorer-embed.js','elmwood-touch-layout.mjs','elmwood-touch-layout.test.mjs'])sources.push(resolve(pack,'scripts',file));
for(const file of ['src/server.ts','dist/server.js','package.json','tests/local-online.mjs','tests/map-ai.mjs','fixtures/swoop-detroit.json','fixtures/elmwood-explorer.json'])sources.push(resolve(pack,'love-tag-server',file));
const packaged=[];
for(const product of ['swoop-detroit','elmwood-explorer']){
 const dir=resolve(pack,'.game-builds/love-tag-review',product);
 for(const name of [product==='swoop-detroit'?'index.html':'elmwood.html']){
  const entry=resolve(dir,name);packaged.push(entry);
  for(const match of (await readFile(entry,'utf8')).matchAll(/(?:src|href)="(\.\/assets\/[^" ]+\.(?:js|css))"/g))packaged.push(resolve(dir,match[1]));
 }
 packaged.push(resolve(dir,'love-tag',product+'.json'));
}
const receipt={at:new Date().toISOString(),scope:'Local review only; no original or hosted build promoted',head:execFileSync('git',['rev-parse','HEAD'],{cwd:pack,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:pack,encoding:'utf8'}).trim(),sourceRepositories:{actualExplorer:gitIdentity(actual),rideCore:gitIdentity(core),server:gitIdentity(resolve(pack,'love-tag-server'))},workingChanges:'Current files individually hashed; remaining dirty work retained. No commit or push performed by this run; HEAD advanced externally during work.',node:process.version,mirrors,sources:await Promise.all(sources.map(async path=>({path,sha256:await hash(path)}))),packaged:await Promise.all(packaged.map(async path=>({path,sha256:await hash(path)})))};
await writeFile(resolve(import.meta.dirname,'evidence/race-water-revisions-20261004.json'),JSON.stringify(receipt,null,2));
if(mirrors.some(m=>!m.match))throw Error('An actual Explorer source differs from its mirror; inspect receipt');
console.log(JSON.stringify({sources:receipt.sources.length,packaged:packaged.length,mirrors:mirrors.length,allMirrorsMatch:true,head:receipt.head}));
