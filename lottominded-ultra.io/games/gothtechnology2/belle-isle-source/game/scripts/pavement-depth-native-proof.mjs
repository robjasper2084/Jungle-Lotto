/** Targeted native/SwiftShader zero-RGBA proof only. No original full-game
 * acceptance driver, threshold, graphics policy or source artifact is changed. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {PAVEMENT_PROOF_PINS as pins} from './pavement-depth-proof-pins.mjs';
import {validatePavementDepthProof} from './pavement-depth-proof-contract.mjs';

const game=resolve(import.meta.dirname,'..'),output=resolve(game,'output/pavement-depth-proof');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const span=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'Exact authored source span exists: '+start);return source.slice(a,b);};
await mkdir(output,{recursive:true});
const sourceReceipts={baseline:pins.baseHead,snippets:{},unchangedFiles:{}};
for(const [file,expected]of Object.entries(pins.unchangedFiles)){
 const bytes=await readFile(resolve(game,file));assert.equal(sha(bytes),expected,'Isolated experiment must retain exact 759 '+file);
 sourceReceipts.unchangedFiles[file]={sha256:expected,bytes:bytes.length};
}
const world=await readFile(resolve(game,'src/belle/world.ts'),'utf8'),shore=await readFile(resolve(game,'src/belle/shore.ts'),'utf8');
const snippets={mat:span(world,'const mat=','export async function createWorld'),grass:span(world,'const grass=mat(',';const pavement=mat('),
 poly:span(world,'function poly(','function road('),approaches:span(shore,' const bridge=data.bridge,ux=',' const foam=addShoreWash')};
for(const [name,text]of Object.entries(snippets)){
 assert.equal(sha(text),pins.snippets[name].sha256,'Exact 759 '+name+' source span');
 sourceReceipts.snippets[name]={sha256:sha(text),bytes:Buffer.byteLength(text)};
}
const authored=`import * as T from 'three';
import type {Point,ParkMap,ParkTerrain} from '../src/belle/terrain.ts';
${snippets.mat}
export function authoredGrass(){${snippets.grass};grass.name='Park lawn';return grass;}
${snippets.poly}
export const authoredPoly=poly;
export function authoredApproaches(scene:T.Scene,data:ParkMap,terrain:ParkTerrain,grass:T.Material){${snippets.approaches}}
`;
const compiled=await build({entryPoints:[resolve(import.meta.dirname,'pavement-depth-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error',
 plugins:[{name:'source-bound-759-components',setup(builder){
  builder.onResolve({filter:/^pavement-proof-authored$/},()=>({path:'pavement-proof-authored',namespace:'pavement-proof'}));
  builder.onLoad({filter:/.*/,namespace:'pavement-proof'},()=>({contents:authored,loader:'ts',resolveDir:import.meta.dirname}));
 }}]});
const javascript=compiled.outputFiles[0].contents;
await writeFile(resolve(output,'source-receipts.json'),JSON.stringify(sourceReceipts,null,2)+'\n');
await writeFile(resolve(output,'authored-components.ts'),authored);
if(process.argv.includes('--compile-only')){
 await writeFile(resolve(output,'compiled-fixture.sha256'),sha(javascript)+'\n');
 console.log(JSON.stringify({compiled:true,fixtureSha256:sha(javascript),bytes:javascript.length,sourceReceipts}));
 process.exit(0);
}
const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
const publicRoot=resolve(game,'public'),types={'.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://127.0.0.1').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:1280px;height:800px}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
 if(path==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
 const filename=resolve(publicRoot,'.'+decodeURIComponent(path));if(!filename.startsWith(publicRoot+sep)){res.writeHead(403);res.end();return;}
 res.setHeader('Content-Type',types[extname(filename)]??'application/octet-stream');res.end(await readFile(filename));
 }catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;const errors=[],failedRequests=[];
const report={sourceHead:process.env.PAVEMENT_DEPTH_SOURCE_SHA??process.env.GITHUB_SHA??null,baseline:pins.baseHead,platform:process.platform,
 fixtureSha256:sha(javascript),sourceReceipts,renderer:null,passed:false,errors,failedRequests,captures:[],result:null};
try{
 const native=process.platform==='darwin';browser=await chromium.launch(native?
  {channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}:
  {channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(String(error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.__pavementDepthProof==='function',{},{timeout:60000});
 const result=await page.evaluate(()=>window.__pavementDepthProof()),images=result.images;delete result.images;report.result=result;report.renderer=result.gpu;
 assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU backend '+result.gpu);
 assert.equal(result.assetSha256,pins.unchangedFiles['public/belle/pavement.bin']);
 for(const image of images){const bytes=Buffer.from(image.png.replace(/^data:image\/png;base64,/,''),'base64');assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),1280);assert.equal(bytes.readUInt32BE(20),800);const file=image.name+'.png';await writeFile(resolve(output,file),bytes);report.captures.push({file,sha256:sha(bytes),bytes:bytes.length});}
 assert.equal(errors.length,0);assert.equal(failedRequests.length,0);assert.equal(report.captures.length,51);
 validatePavementDepthProof(result);assert.equal(result.passed,true,'Depth pass changed pixels/original draw inputs, failed guards, or controls did not demonstrate coverage');report.passed=true;
}catch(error){errors.push(String(error));process.exitCode=1;}
finally{await browser?.close();await new Promise(ok=>server.close(ok));await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,result:report.result?{...report.result,rows:report.result.rows.map(({baselineDraws,candidateDraws,...row})=>row)}:null}));}
