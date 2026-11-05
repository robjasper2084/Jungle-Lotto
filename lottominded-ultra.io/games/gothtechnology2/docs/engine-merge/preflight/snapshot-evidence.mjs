import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),pack=resolve(repo,'lottominded-ultra.io/games/gothtechnology2');
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const files=[];
async function add(path,scope){
 const s=await stat(path);if(s.isDirectory()){for(const name of (await readdir(path)).sort())await add(join(path,name),scope);return;}
 const bytes=await readFile(path);files.push({path:relative(repo,path).replaceAll('\\','/'),scope,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const path of [
'engine/breadflowerdos/integration','engine/breadflowerdos/UPSTREAM_SOURCE.json',
'ride-core/src/engine','ride-core/src/royale','ride-core/src/royaleClient.ts','ride-core/src/controller.ts','ride-core/src/balanceEngine.ts','ride-core/src/rideDynamics.ts',
'ride-core/tests/engine-royale.test.ts','ride-core/tests/royale.test.ts','ride-core/package.json','ride-core/package-lock.json','ride-core/scripts/copy-engine.mjs',
'love-tag-server/src/BattleRoyaleRoom.ts','love-tag-server/src/royaleClock.ts','love-tag-server/src/server.ts','love-tag-server/package.json','love-tag-server/package-lock.json',
'love-tag-server/tests/engine-royale-online.mjs','love-tag-server/tests/engine-royale-round.mjs','love-tag-server/tests/royale-clock.mjs',
'swoop-source/src/detroit/royale','swoop-source/src/detroit/main.ts','swoop-source/src/detroit/bicycleAdapter.ts','swoop-source/royale.html','swoop-source/package.json','swoop-source/vite.config.ts',
'swoop-source/src/detroit/sceneryWorld.ts','swoop-source/src/detroit/scenery.ts','swoop-source/src/detroit/city-render.ts','swoop-source/src/detroit/cutLandmarks.ts','swoop-source/src/detroit/cutMurals.ts','swoop-source/src/detroit/grassField.ts','swoop-source/src/detroit/harbor.ts','swoop-source/src/detroit/millikenLandmarks.ts','swoop-source/src/detroit/riverfrontDetails.ts','swoop-source/src/detroit/routeArt.ts','swoop-source/src/detroit/routeRails.ts','swoop-source/src/detroit/streetFurniture.ts','swoop-source/src/detroit/tagSceneryCollisions.ts','swoop-source/src/detroit/valade.ts','swoop-source/src/detroit/waterfront.ts',
'love-tag-server/tests/downtown-fixture.mjs','love-tag-server/tests/downtown-royale.mjs',
'elmwood-source/src/detroit/elmwood.ts','elmwood-source/src/detroit/ride-motion.ts','elmwood-source/elmwood.html','elmwood-source/package.json',
'scripts/build-swoop-detroit.mjs','scripts/build-elmwood-explorer.mjs',
'swoop-source/art/animation-polish/Unity/Assets/Editor/BreadflowerAssetReview.cs'
])await add(resolve(pack,path),'local source snapshot; not a task ownership claim');
for(const path of ['.game-builds/build-engine-staging.mjs','.game-builds/engine-review-server.mjs'])await add(resolve(repo,path),'isolated staging tools');
for(const path of ['src/controller.ts','src/balanceEngine.ts','src/rideDynamics.ts','package.json'])
 await add(resolve(repo,'../Digital_Static_RideCore',path),'linked original RideCore; preserved shared source');
const moduleHash=createHash('sha256').update(await readFile(resolve(pack,'ride-core/src/engine/breadflower.wasm'))).digest('hex');
await writeFile(resolve(pack,'docs/engine-merge/acceptance-source-manifest.json'),JSON.stringify({at:new Date().toISOString(),repo,revision,branch:execFileSync('git',['branch','--show-current'],{cwd:repo,encoding:'utf8'}).trim(),note:'Shared dirty checkout. Hashes identify reviewed source, not exclusive ownership or a commit. Authored-map scene and collision are integrated into the shared Royale route. No production promotion.',upstream:'6b4d4e1f10dee9b1c8932db95f91b92e3eceb7db',moduleHash,files},null,2));
console.log('Recorded '+files.length+' source files at '+revision);

