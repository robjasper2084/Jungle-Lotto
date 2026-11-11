import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {replaceBelleBuild,belleProduct,belleRoute} from './belle-pages.mjs';
import {isServerOnlySource,serverOnlySourceRoot,isDevelopmentOnlySource,developmentOnlySourceRoots} from './pages-public-scope.mjs';
async function fixture(t){const root=await mkdtemp(join(tmpdir(),'belle-pages-'));t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(basename(root).startsWith('belle-pages-'));await rm(root,{recursive:true,force:true});});const dist=join(root,belleProduct,'belle-isle-source/game/dist');await mkdir(join(dist,'assets'),{recursive:true});await mkdir(join(dist,'belle'),{recursive:true});await writeFile(join(dist,'index.html'),'<script type="module" src="./assets/new.js"></script><link href="./assets/new.css" rel="stylesheet">');await writeFile(join(dist,'assets/new.js'),'new game');await writeFile(join(dist,'assets/new.css'),'body{}');await writeFile(join(dist,'belle/map.json'),'{}');await writeFile(join(dist,'asset-manifest.json'),JSON.stringify(['belle/map.json']));return{root,dist};}
test('release replaces stale storefront game with this runs complete build',async t=>{const {root}=await fixture(t);const other={path:belleProduct+'/index.html',source:'unchanged',bytes:20};const result=await replaceBelleBuild(root,[other,{path:belleRoute+'assets/old.js',source:'old',bytes:3},{path:belleRoute+'index.html',source:'old',bytes:3}]);assert.ok(result.includes(other));assert.ok(result.some(f=>f.path===belleRoute+'assets/new.js'));assert.ok(!result.some(f=>f.path.endsWith('/old.js')));assert.equal(result.filter(f=>f.path===belleRoute+'index.html').length,1);});
test('release fails closed on missing runtime assets and scripts',async t=>{const {root,dist}=await fixture(t);await rm(join(dist,'assets/new.js'));await assert.rejects(replaceBelleBuild(root,[]),/missing compiled/);await writeFile(join(dist,'assets/new.js'),'new');await rm(join(dist,'belle/map.json'));await assert.rejects(replaceBelleBuild(root,[]),/runtime asset missing/);});
test('release refuses source maps and private files',async t=>{const {root,dist}=await fixture(t);await writeFile(join(dist,'assets/new.js.map'),'private');await assert.rejects(replaceBelleBuild(root,[]),/Refusing private/);});


test('never bundles LOVE TAG backend fixtures or service code into the static Pages site',()=>{
 for(const suffix of ['fixtures/swoop-detroit.json.gz','fixtures/elmwood-explorer.json','fixtures/elmwood-explorer.json.gz','src/server.ts','src/supabase-test-worker.ts','tests/host-fixture.mjs','Dockerfile','package.json','.env.example'])assert.equal(isServerOnlySource(serverOnlySourceRoot+suffix),true,suffix);
});
test('preserves the frontend LOVE TAG maps, arcade build, Belle Isle and other public sites',()=>{
 for(const file of [
  'lottominded-ultra.io/games/gothtechnology2/swoop-source/public/love-tag/swoop-detroit.json.gz',
  'lottominded-ultra.io/games/gothtechnology2/store/public/arcade/swoop-detroit/love-tag/swoop-detroit.json.gz',
  'lottominded-ultra.io/games/gothtechnology2/store/public/arcade/elmwood-explorer/love-tag/elmwood-explorer.json.gz',
  'lottominded-ultra.io/games/gothtechnology2/arcade/belle-isle-explorer/index.html',
  'lottominded-ultra.io/index.html','lotto mind refined/index.html','lottomind-stem-studio/index.html'
 ])assert.equal(isServerOnlySource(file),false,file);
});
test('the backend exclusion matches only its exact anchored directory',()=>{
 for(const file of ['love-tag-server/fixtures/swoop-detroit.json.gz','lottominded-ultra.io/games/gothtechnology2/love-tag-server-assets/index.html','lottominded-ultra.io/games/gothtechnology2/another-love-tag-server/index.html',null,undefined,{}])assert.equal(isServerOnlySource(file),false,String(file));
});

// This is a delivery filter, not a source-tree deletion: published arcade
// routes and assets still come from their existing compiled client paths.
test('exclude non-deployable game authoring files, duplicate media and QA captures',()=>{
 assert.equal(developmentOnlySourceRoots.length,3);
 for(const file of [
  'lottominded-ultra.io/games/lottomind-jackpot-maze/source/package.json',
  'lottominded-ultra.io/games/lottomind-jackpot-maze/source/src/game/GameRuntime.ts',
  'lottominded-ultra.io/games/lottomind-jackpot-maze/source/public/assets/video/detroit-commercial-02.mp4',
  'lottominded-ultra.io/games/shadow-ops-canvas/docs/lottomind-vault-run-concept.png',
  'lottominded-ultra.io/games/lottomind-313-fortune-grid/docs/screenshots/desktop-1440-first-turn.png',
 ])assert.equal(isDevelopmentOnlySource(file),true,file);
});
test('retain real Jackpot Maze, Shadow Ops and Fortune Grid playing routes and media',()=>{
 for(const file of [
  'lottominded-ultra.io/games/lottomind-jackpot-maze/index.html',
  'lottominded-ultra.io/games/lottomind-jackpot-maze/assets/video/detroit-commercial-02.mp4',
  'lottominded-ultra.io/games/shadow-ops-canvas/index.html',
  'lottominded-ultra.io/games/shadow-ops-canvas/assets/bosses/canopy_drone_queen_cutout.png',
  'lottominded-ultra.io/games/lottomind-313-fortune-grid/index.html',
  'lottominded-ultra.io/games/lottomind-313-fortune-grid/assets/art/dream-oracle-card-atlas.png',
  'lottominded-ultra.io/games/lottomind-jackpot-maze/source-map-not-dev/index.html',
  'lottominded-ultra.io/games/shadow-ops-canvas/docs-assets/runtime.png',
  'lottominded-ultra.io/games/lottomind-313-fortune-grid/docs-image.png',
  null, undefined, {}
 ])assert.equal(isDevelopmentOnlySource(file),false,String(file));
});
