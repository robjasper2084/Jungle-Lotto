/** Same-context real WebGL street batching equivalence. Full-game performance
 * and control requirements remain in their original independent workflows. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

const game=resolve(import.meta.dirname,'..'),output=resolve(game,'output/street-batch-proof');
const require=createRequire(resolve(game,'../../package.json')),{chromium}=require('@playwright/test');
await mkdir(output,{recursive:true});
const compiled=await build({entryPoints:[resolve(import.meta.dirname,'street-batch-proof-browser.ts')],bundle:true,format:'esm',target:'es2022',write:false,logLevel:'error'});
const javascript=compiled.outputFiles[0].contents,publicRoot=resolve(game,'public');
const types={'.json':'application/json','.bin':'application/octet-stream','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}canvas{display:block;width:960px;height:600px}</style></head><body><canvas></canvas><script type="module" src="/proof.js"></script></body></html>');return;}
  if(path==='/proof.js'){res.setHeader('Content-Type','text/javascript');res.end(javascript);return;}
  const filename=resolve(publicRoot,'.'+decodeURIComponent(path));
  if(!filename.startsWith(publicRoot+sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',types[extname(filename)]||'application/octet-stream');res.end(await readFile(filename));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
let browser;const errors=[],failedRequests=[];
const report={sourceHead:process.env.STREET_BATCH_SOURCE_SHA??process.env.GITHUB_SHA??null,platform:process.platform,renderer:null,passed:false,errors,failedRequests,
 fixtureSha256:createHash('sha256').update(javascript).digest('hex'),captures:[],result:null};
try{
 const native=process.platform==='darwin';
 browser=await chromium.launch(native?{channel:'chrome',headless:false,args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}:
  {channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:960,height:600},deviceScaleFactor:1});
 page.on('pageerror',error=>errors.push(String(error)));page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof window.__streetBatchProof==='function',{},{timeout:60000});
 const result=await page.evaluate(()=>window.__streetBatchProof());
 report.renderer=result.gpu;const images=result.images;delete result.images;report.result=result;
 assert(native?/Metal/i.test(result.gpu)&&!/SwiftShader|llvmpipe/i.test(result.gpu):/SwiftShader/i.test(result.gpu),'Unexpected actual GPU backend '+result.gpu);
 for(const image of images){
  const bytes=Buffer.from(image.png.replace(/^data:image\/png;base64,/,''),'base64');
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),960);assert.equal(bytes.readUInt32BE(20),600);
  const filename=image.name+'.png';await writeFile(resolve(output,filename),bytes);
  report.captures.push({file:filename,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 assert.equal(errors.length,0);assert.equal(failedRequests.length,0);
 assert.equal(result.passed,true,'Street batching changed rendered pixels, triangle coverage, visibility, or failed to reduce draws');
 report.passed=true;
}catch(error){errors.push(String(error));process.exitCode=1;}
finally{
 await browser?.close();await new Promise(ok=>server.close(ok));
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
