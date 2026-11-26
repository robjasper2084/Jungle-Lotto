/** Compile only a separate fixture entry; do not overwrite original app assets. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {pins,sha256,gitBlob,manifest} from './provenance.mjs';
const game=resolve(process.env.APP_GAME||''),out=resolve(process.env.APPROACH_ORDER_OUT||''),bundle=import.meta.dirname;
assert(process.env.APP_GAME&&process.env.APPROACH_ORDER_OUT);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim(),pins.applicationSource);
assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:game,encoding:'utf8'}).trim(),pins.applicationTree);
const require=createRequire(resolve(game,'package.json')),three=dirname(require.resolve('three'));
const tsc=resolve(out,'fixture-tsconfig.json');await mkdir(out,{recursive:true});
await writeFile(tsc,JSON.stringify({extends:resolve(game,'tsconfig.json'),compilerOptions:{baseUrl:game,typeRoots:[resolve(game,'node_modules/@types')],paths:{
 '@app/*':[resolve(game,'src/belle/*')],'three':[resolve(game,'node_modules/@types/three')],'three/*':[resolve(game,'node_modules/@types/three/*')],
 '@digital-static/ridecore':[resolve(game,'runtime/ride-core/src/index.ts')]}},include:[resolve(bundle,'browser.ts'),resolve(game,'node_modules/vite/client.d.ts')]}));
execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--project',tsc],{stdio:'inherit'});
const {build}=await import(pathToFileURL(require.resolve('vite')).href),inputs=new Map();
await build({configFile:false,root:game,publicDir:false,base:'./',resolve:{alias:[
 {find:'@app',replacement:resolve(game,'src/belle')},{find:/^three$/,replacement:resolve(three,'three.module.js')},
 {find:/^three\/addons\//,replacement:resolve(three,'../examples/jsm')+'/'},{find:'@digital-static/ridecore',replacement:resolve(game,'runtime/ride-core/src/index.ts')} ]},
 plugins:[{name:'record-fixture-inputs',async moduleParsed(info){if(info.id.startsWith('\0'))return;const file=info.id.split('?')[0];const bytes=await readFile(file);inputs.set(file,{file,bytes:bytes.length,gitBlob:gitBlob(bytes),sha256:sha256(bytes)});}}],
 build:{outDir:resolve(out,'fixture'),emptyOutDir:true,target:'es2022',minify:false,sourcemap:true,
  lib:{entry:resolve(bundle,'browser.ts'),formats:['es'],fileName:()=> 'approach-order.js'},rollupOptions:{output:{chunkFileNames:'approach-order-[hash].js',assetFileNames:'approach-order-[hash][extname]'}}}});
await writeFile(resolve(out,'fixture/index.html'),'<!doctype html><meta charset="utf-8"><title>Isolated approach order diagnostic</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><canvas id="game"></canvas><script type="module" src="./approach-order.js"></script>\n');
const rows=[...inputs.values()].map(row=>({...row,file:relative(game,row.file)})).sort((a,b)=>a.file.localeCompare(b.file));
assert(rows.some(r=>r.file==='src/belle/world.ts')&&rows.some(r=>r.file==='src/belle/shore.ts')&&rows.some(r=>r.file==='src/belle/islandSky.ts')&&rows.some(r=>r.file==='src/belle/detroitScene.ts'),'Real source context did not bundle');
await writeFile(resolve(out,'fixture-inputs.json'),JSON.stringify({applicationSource:pins.applicationSource,applicationTree:pins.applicationTree,files:rows},null,2)+'\n');
await writeFile(resolve(out,'fixture-before.json'),JSON.stringify(await manifest(resolve(out,'fixture')),null,2)+'\n');
console.log(JSON.stringify({diagnosticOnly:true,applicationSource:pins.applicationSource,inputs:rows.length,fixture:resolve(out,'fixture')}));
