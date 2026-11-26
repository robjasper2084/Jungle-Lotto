// Isolated native pixel and CPU proof. Never counts as release acceptance.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const app=resolve(process.argv[2]),out=resolve(process.argv[3]);
await mkdir(out,{recursive:true});
const runtime=join(app,'lottominded-ultra.io/games/gothtechnology2'),game=join(runtime,'belle-isle-source/game');
const requireGame=createRequire(join(game,'package.json'));
const {chromium}=createRequire(join(runtime,'package.json'))('@playwright/test');
const {build}=requireGame('esbuild');
const sha=b=>createHash('sha256').update(b).digest('hex');
const files={'/street-details.json':await readFile(join(game,'public/belle/street-details.json')),'/street-details.bin':await readFile(join(game,'public/belle/street-details.bin'))};
const receipt={scope:'Actual street source/assets; fixed fixture camera and lights; not full-game performance or release acceptance',sourceHead:process.env.EXPECTED_CANDIDATE,baseHead:process.env.EXPECTED_BASE,assetSha256:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)])),errors:[],requests:[]};
let browser,server;
try{
 const source=await readFile(new URL('./street-matrix-fixture.mjs',import.meta.url),'utf8');
 const bundle=await build({stdin:{contents:source,resolveDir:game,sourcefile:'street-matrix-proof.js'},bundle:true,write:false,format:'iife',platform:'browser',target:'chrome120'});
 server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');receipt.requests.push({path:url.pathname,method:req.method});
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><head><meta charset="utf-8"><title>Street source fixture</title></head><body style="margin:0"><canvas></canvas><script src="/proof.js"></script></body></html>');return;}
  if(url.pathname==='/proof.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(bundle.outputFiles[0].contents);return;}
  if(Object.hasOwn(files,url.pathname)){res.writeHead(200,{'Content-Type':url.pathname.endsWith('.json')?'application/json':'application/octet-stream'});res.end(files[url.pathname]);return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(404);res.end();
 });
 await new Promise((ok,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',ok);});
 const args=process.platform==='darwin'?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60'];
 browser=await chromium.launch({channel:'chrome',headless:false,args});receipt.chrome=browser.version();receipt.platform=process.platform;receipt.args=args;
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 page.on('pageerror',e=>receipt.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')receipt.errors.push(m.text());});page.on('requestfailed',r=>receipt.errors.push(r.url()+' '+JSON.stringify(r.failure())));
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
 const {images,...report}=await page.evaluate(()=>globalThis.__streetProof());
 receipt.report=report;receipt.captures=[];
 for(const item of images){const png=Buffer.from(item.png.replace(/^data:image\/png;base64,/,''),'base64');assert.equal(png.readUInt32BE(16),1440);assert.equal(png.readUInt32BE(20),900);await writeFile(join(out,item.name),png);receipt.captures.push({name:item.name,bytes:png.length,sha256:sha(png),rgbaSha256:item.rgbaSha256,canvasRgbaSha256:item.canvasRgbaSha256});}
 const correctBackend=process.platform==='darwin'?/Metal/i.test(report.renderer)&&!/SwiftShader|llvmpipe|software rasterizer/i.test(report.renderer):/SwiftShader/i.test(report.renderer);
 receipt.passed=correctBackend&&report.three==='185'&&report.comparisons.length===6&&receipt.captures.length===12&&report.comparisons.every(c=>c.nonuniform&&c.changedPixels===0&&c.baselineCanvasHash===c.candidateCanvasHash&&c.baselineDraws===c.candidateDraws&&c.baselineTriangles===c.candidateTriangles)&&report.shadowControls.length===6&&report.shadowControls.every(c=>c.changedPixels>0&&c.canvasChanged)&&receipt.errors.length===0;
 console.log(JSON.stringify({scope:receipt.scope,passed:receipt.passed,renderer:report.renderer,roots:report.roots,comparisons:report.comparisons,shadowControls:report.shadowControls,timing:report.timing}));
 if(!receipt.passed)process.exitCode=1;
}catch(e){receipt.errors.push(String(e?.stack??e));receipt.passed=false;process.exitCode=1;}
finally{await writeFile(join(out,'proof.json'),JSON.stringify(receipt,null,2)+'\n');if(browser)await browser.close().catch(()=>{});if(server?.listening)await new Promise(ok=>server.close(ok));}
