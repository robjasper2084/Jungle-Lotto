/** Separate diagnostic entry; application source and immutable dist stay untouched. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pins,sha256,gitBlob,json,checkout,helperPins,modelPins,manifest} from './provenance.mjs';
import {verifyLandmarkIndexManifest} from './landmark-index-manifest.mjs';

const [mode,appArg,outArg,assetArg]=process.argv.slice(2);assert(pins.sources[mode]&&appArg&&outArg&&assetArg);
const app=resolve(appArg),game=resolve(app,pins.gamePath),out=resolve(outArg),bundle=import.meta.dirname;
const source=checkout(app,mode),helpers=await helperPins(game),models=await modelPins(game,mode);
const landmarkIndices=await verifyLandmarkIndexManifest(resolve(assetArg),game);
const require=createRequire(resolve(game,'package.json')),three=dirname(require.resolve('three'));
assert.equal(JSON.parse(await readFile(resolve(three,'../package.json'),'utf8')).version,'0.185.1');
await mkdir(out,{recursive:true});
const tsc=resolve(out,'fixture-tsconfig.json');
await json(tsc,{extends:resolve(game,'tsconfig.json'),compilerOptions:{baseUrl:game,typeRoots:[resolve(game,'node_modules/@types')],paths:{
 '@app/*':[resolve(game,'src/belle/*')],'three':[resolve(game,'node_modules/@types/three')],'three/*':[resolve(game,'node_modules/@types/three/*')],
 '@digital-static/ridecore':[resolve(game,'runtime/ride-core/src/index.ts')]}},include:[resolve(bundle,'browser.ts'),resolve(bundle,'scene-receipt.ts'),resolve(game,'node_modules/vite/client.d.ts')]});
execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--project',tsc],{stdio:'inherit'});
const {build}=await import(pathToFileURL(require.resolve('vite')).href),inputs=new Map();
async function recordFile(file){
 const bytes=await readFile(file),path=relative(app,file).replaceAll('\\','/');
 const row={path,bytes:bytes.length,gitBlob:gitBlob(bytes),sha256:sha256(bytes)};
 if(!path.startsWith('../')&&!path.includes('/node_modules/')){
  const committed=execFileSync('git',['rev-parse',source.head+':'+path],{cwd:app,encoding:'utf8'}).trim();assert.equal(row.gitBlob,committed,'Bundled source differs from pinned Git blob: '+path);
 }
 inputs.set(file,row);return bytes;
}
await build({configFile:false,root:game,publicDir:false,base:'./',
 define:{'import.meta.env.VITE_STAGED_BELLE_ARCHITECTURE':JSON.stringify('1'),'__ROOF_VARIANT__':JSON.stringify(mode)},
 resolve:{alias:[{find:'@app',replacement:resolve(game,'src/belle')},{find:/^three$/,replacement:resolve(three,'three.module.js')},
  {find:/^three\/addons\//,replacement:resolve(three,'../examples/jsm')+'/'},{find:'@digital-static/ridecore',replacement:resolve(game,'runtime/ride-core/src/index.ts')}]},
 plugins:[{name:'record-exact-source-inputs',async moduleParsed(info){
  if(info.id.startsWith('\0'))return;const file=info.id.split('?')[0],bytes=await recordFile(file);
  // Vite's new-URL transform can inline these bytes without a Rollup module.
  // Bind the actual original asset file instead of silently omitting that input.
  if(/\.[cm]?[jt]s$/.test(file))for(const match of bytes.toString('utf8').matchAll(/new URL\(\s*(['"])(\.\.?\/[^'"]+)\1\s*,\s*import\.meta\.url\s*\)/g))await recordFile(resolve(dirname(file),match[2]));
 }}],build:{outDir:resolve(out,'fixture'),emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,
 lib:{entry:resolve(bundle,'browser.ts'),formats:['es'],fileName:()=> 'roof-compare.js'},rollupOptions:{output:{chunkFileNames:'roof-compare-[hash].js',assetFileNames:'roof-compare-[hash][extname]'}}}});
await writeFile(resolve(out,'fixture/index.html'),'<!doctype html><meta charset="utf-8"><title>Controlled Aquarium roof comparison — diagnostic only</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><canvas id="game" tabindex="0"></canvas><script type="module" src="./roof-compare.js"></script>\n');
const rows=[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path));
for(const file of ['world.ts','stagedLandmarkStudies.ts','islandSky.ts','staticArchitectureBatch.ts','sharedGeometryBuffers.ts'])assert(rows.some(r=>r.path.endsWith('/src/belle/'+file)),'Required original module missing: '+file);
await json(resolve(out,'source-inputs.json'),{mode,source,helpers,models,landmarkIndices,stagedFlag:'VITE_STAGED_BELLE_ARCHITECTURE=1',inputs:rows});
await json(resolve(out,'fixture-manifest.json'),await manifest(resolve(out,'fixture')));
checkout(app,mode);console.log(JSON.stringify({mode,source,inputs:rows.length,fixture:resolve(out,'fixture')}));
