/** Supplemental full-world visual evidence, not a gameplay/FPS or photo-parity test. */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const expected='a9b6b4d1fd7c8b529a7052843797101dbee6f614';
const prefix='lottominded-ultra.io/games/gothtechnology2';
const repositoryRoot=process.cwd();
const game=resolve(prefix,'belle-isle-source/game'),output=resolve('output/belle-reference-audit');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const tree=git('rev-parse',expected+':'+prefix+'/belle-isle-source/game');
assert.equal(git('rev-parse','HEAD:'+prefix+'/belle-isle-source/game'),tree,'Review must use unchanged candidate game source');
await mkdir(output,{recursive:true});
const report={source:expected,sourceTree:tree,reviewCommit:git('rev-parse','HEAD'),scope:'Full-world rendering fixture using the unchanged candidate world, terrain, models, textures, lighting, material and quality modules. Camera is explicitly positioned for comparison; no gameplay/input or physical-device FPS is certified.',visualMatchEstablished:false,renderCompleted:false,errors:[],warnings:[],failedRequests:[],captures:[]};
const pageSource=String.raw`
import * as T from 'three';
import {createWorld} from './src/belle/world.ts';
import {ParkTerrain} from './src/belle/terrain.ts';
import {alignScottMap} from './src/belle/fountainLayout.ts';
import {prepareCoastGuardMap} from './src/belle/coastGuard.ts';
import {loadRealisticMaterials} from './src/belle/realisticMaterials.ts';
import {configureAssetDelivery} from './src/belle/assetDelivery.ts';
import {SceneWarmup} from './src/belle/sceneWarmup.ts';
import {sunDirection} from './src/belle/skyModel.ts';
const status=document.getElementById('status');
const state=window.referenceAudit={ready:false,error:null,metadata:null};
const paint=()=>new Promise(r=>requestAnimationFrame(()=>r()));
async function boot(){
 configureAssetDelivery();
 const response=await fetch('./belle/map.json');if(!response.ok)throw Error('Map HTTP '+response.status);
 const data=await response.json();alignScottMap(data);prepareCoastGuardMap(data);
 const terrain=new ParkTerrain(data),scene=new T.Scene();
 const canvas=document.getElementById('game');
 const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.setSize(1000,1000);renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 status.textContent='Loading original surface textures';await loadRealisticMaterials(renderer);
 const world=await createWorld(scene,renderer,data,terrain,message=>status.textContent=message);
 const point=[...data.landmarks,...data.pois].find(p=>p.name==='Sunset Point');
 if(!point)throw Error('Original map has no Sunset Point');
 const dx=-3127-point.x,dz=1983-point.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
 const camera=new T.PerspectiveCamera(52,1,.08,22000);
 const warmup=new SceneWarmup(renderer,scene,camera,()=>{});
 async function captureSettings({quality='high',height=80,distance=260,targetBack=60}={}){
  world.setQuality(quality);renderer.setPixelRatio(1);world.sky.preview(false);
  world.sky.configure({hour:17.55,cycle:false,dayMinutes:20,clouds:'clear'});
  camera.position.set(point.x-ux*distance,2+height,point.z-uz*distance);
  camera.lookAt(point.x-ux*targetBack,2,point.z-uz*targetBack);camera.updateMatrixWorld(true);
  world.update(0,camera.position.x,camera.position.z,camera,false);
  await world.sky.prepareReflections(camera,camera.position.x,camera.position.z);
  await warmup.prepare();
  for(let i=0;i<3;i++){await paint();world.update(0,camera.position.x,camera.position.z,camera,false);renderer.render(scene,camera);}
  const gl=renderer.getContext();if(gl.isContextLost())throw Error('Lost WebGL context');
  const pixels=new Uint8Array(4*64*64);gl.readPixels(468,468,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const unique=new Set();for(let i=0;i<pixels.length;i+=4)unique.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);
  if(unique.size<8)throw Error('Render sample is blank or uniform');
  return {point:{name:point.name,x:point.x,z:point.z},camera:{position:camera.position.toArray(),target:[point.x-ux*targetBack,2,point.z-uz*targetBack],fov:52,aspect:1,heightAboveDatum:height},sky:world.sky.settings,sunDirection:sunDirection(17.55),requestedQuality:quality,effectiveQuality:world.quality.effective,exposure:renderer.toneMappingExposure,pixelRatio:renderer.getPixelRatio(),canvas:{width:canvas.width,height:canvas.height},webgl:gl.getParameter(gl.VERSION),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,uniqueSampleColors:unique.size,reflection:world.sky.presentation};
 }
 window.captureReferenceSettings=captureSettings;
 state.metadata=await captureSettings();state.ready=true;status.textContent='Render ready · manual visual review still required';
}
boot().catch(error=>{state.error=String(error.stack||error);status.textContent=state.error;console.error(error);});
`;
await writeFile(resolve(game,'reference-audit.js'),pageSource);
await writeFile(resolve(game,'reference-audit.html'),'<!doctype html><html><head><meta charset="utf-8"><title>PR141 full-world reference evidence</title><style>html,body{margin:0;background:#111}canvas{display:block}#status{font:14px sans-serif;color:white;position:fixed;left:8px;bottom:8px;pointer-events:none}</style></head><body><canvas id="game"></canvas><output id="status">Preparing world</output><script type="module" src="./reference-audit.js"></script></body></html>');
const requireGame=createRequire(resolve(game,'package.json'));
const {build}=await import(pathToFileURL(requireGame.resolve('vite')).href);
try{process.chdir(game);await build({root:game,configFile:resolve(game,'vite.config.ts'),build:{rollupOptions:{input:resolve(game,'reference-audit.html')}}});}finally{process.chdir(repositoryRoot);}
const dist=resolve(game,'dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}let file=resolve(dist,'.'+pathname);if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403).end();return;}const s=await stat(file);if(!s.isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':s.size,'Cache-Control':'no-store'});createReadStream(file).on('error',()=>res.destroy()).pipe(res);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const requireStore=createRequire(resolve(prefix,'package.json'));
const {chromium}=requireStore('@playwright/test');
let browser,page;
try{
 browser=await chromium.launch({channel:'chromium',headless:false,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']});
 report.browserVersion=browser.version();
 page=await browser.newPage({viewport:{width:1000,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'});
 page.setDefaultTimeout(90_000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());else if(m.type()==='warning')report.warnings.push(m.text());});
 page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400)report.errors.push('HTTP '+r.status()+' '+r.url());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/reference-audit.html',{waitUntil:'domcontentloaded',timeout:90_000});
 await page.waitForFunction(()=>window.referenceAudit?.ready||window.referenceAudit?.error,null,{timeout:600_000});
 const initial=await page.evaluate(()=>window.referenceAudit);assert.equal(initial.error,null,initial.error);
 for(const [name,settings] of [['high-aerial',null],['high-aerial-near',{quality:'high',height:60,distance:190,targetBack:40}],['smooth-aerial',{quality:'smooth',height:80,distance:260,targetBack:60}]]){
  const metadata=settings?await page.evaluate(s=>window.captureReferenceSettings(s),settings):initial.metadata;
  const file=name+'.png';await page.locator('#game').screenshot({path:resolve(output,file),timeout:150_000});
  report.captures.push({file,sha256:createHash('sha256').update(await readFile(resolve(output,file))).digest('hex'),...metadata});
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.renderCompleted=true;
}catch(error){report.failure=String(error.stack||error);if(page)try{await page.screenshot({path:resolve(output,'failure.png'),timeout:30_000});}catch{}process.exitCode=1;}
finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 if(browser)await browser.close();server.closeAllConnections();server.close();
}
