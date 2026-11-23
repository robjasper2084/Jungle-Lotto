/** Controlled GPU pixel equivalence, not gameplay or sustained-performance acceptance. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {transform} from 'esbuild';

const game=resolve(import.meta.dirname,'..');
const out=resolve(game,process.env.BELLE_SHADER_OUTPUT||'output/shader-equivalence');
const baseline=process.env.BELLE_SHADER_BASELINE;
assert.match(baseline||'',/^[0-9a-f]{40}$/,'An immutable baseline commit is required.');
const prefix='lottominded-ultra.io/games/gothtechnology2/belle-isle-source/game/';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fromGit=file=>execFileSync('git',['show',baseline+':'+prefix+file],{cwd:game,encoding:'utf8'});
const sourcePath='src/belle/atmosphereShaders.ts';
const baselineSource=fromGit(sourcePath);
const candidateSource=await readFile(resolve(game,sourcePath),'utf8');
for(const file of ['src/belle/physicalLighting.ts','package-lock.json']){
 assert.equal(await readFile(resolve(game,file),'utf8'),fromGit(file),file+' must match the baseline for this isolated shader comparison.');
}
const baselineModule=(await transform(baselineSource,{loader:'ts',format:'esm',target:'es2022'})).code;
const require=createRequire(import.meta.url);
function dependency(name){
 try{return require(name);}catch(error){
  try{return createRequire(resolve(game,'../../package.json'))(name);}catch{}
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw error;
  return createRequire(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'package.json'))(name);
 }
}
let chromium;
try{({chromium}=dependency('playwright'));}catch{({chromium}=dependency('@playwright/test'));}
await mkdir(out,{recursive:true});
const report={
 scope:'Controlled real-WebGL pixel equivalence of production atmosphere/wind shaders and physical lighting. Includes active/inactive lights, projected maps, shadows and zero/nonzero wind. This fixture does not load the island, exercise gameplay, or certify sustained performance.',
 baseline,candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:game,encoding:'utf8'}).trim(),
 shaderSha256:{baseline:hash(baselineSource),candidate:hash(candidateSource)},
 startedAt:new Date().toISOString(),passed:false,cases:[],errors:[],failedRequests:[],captures:[]
};

async function fixtureMain(){
 const T=await import('three');
 const old=await import('/baseline-atmosphere.ts');
 const current=await import('/src/belle/atmosphereShaders.ts');
 const {physicalLighting}=await import('/src/belle/physicalLighting.ts');
 const width=384,height=256;
 // Retention is only for this readback fixture, never a production renderer setting.
 const renderer=new T.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:true});
 renderer.setSize(width,height);renderer.setPixelRatio(1);
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
 const result=window.__shaderResult={
  renderer:String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)),
  gpuTimerAvailable:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
  presentation:'Main drawing buffer, ACESFilmic tone mapping and sRGB output; antialiasing disabled for exact pixel comparison.',
  passed:false,cases:[],errors:[],trustedStart:false
 };
 const noiseBytes=new Uint8Array(8*8*4);
 for(let i=0;i<64;i++){noiseBytes[i*4]=(i*71+37)%256;noiseBytes[i*4+1]=165;noiseBytes[i*4+2]=210;noiseBytes[i*4+3]=255;}
 const noise=new T.DataTexture(noiseBytes,8,8);
 noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.minFilter=noise.magFilter=T.LinearFilter;noise.needsUpdate=true;
 const specs=[
  {name:'inactive-spot-zero-wind',spot:0,wind:0},
  {name:'active-spot-zero-wind',spot:45,wind:0},
  {name:'active-spot-map',spot:45,wind:0,map:true},
  {name:'active-spot-depth-shadow',spot:45,wind:0,shadow:true},
  {name:'active-spot-depth-shadow-wind',spot:45,wind:.12,shadow:true},
  {name:'inactive-spot-map-shadow',spot:0,wind:0,map:true,shadow:true},
  {name:'active-spot-map-shadow',spot:45,wind:0,map:true,shadow:true},
  {name:'active-spot-cloth-wind',spot:45,wind:.12},
  {name:'active-spot-crown-wind',spot:45,wind:.12,crown:true},
  {name:'zero-wind-point-shadow',spot:0,wind:0,pointShadow:true},
  {name:'moving-wind-point-shadow',spot:45,wind:.12,pointShadow:true}
 ];
 function sceneFor(factory,spec,label){
  const scene=new T.Scene();scene.background=new T.Color(0x15212b);scene.fog=new T.FogExp2(0x81909c,.035);
  const camera=new T.PerspectiveCamera(43,width/height,.1,40);
  camera.position.set(3.7,2.5,6);camera.lookAt(0,.25,0);
  const uniforms={
   belleCloudNoise:{value:noise},belleSunDirection:{value:new T.Vector3(.3,1,.5).normalize()},
   belleCloudTime:{value:13},belleCloudCoverage:{value:.6},belleCloudStrength:{value:.08},
   belleAirStrength:{value:0},belleWindTime:{value:2.3},belleWindAmount:{value:spec.wind},
   belleWindRange:{value:new T.Vector2(-.8,.8)}
  };
  const resources=new Set(),receipts={surfaceDraws:0,depthDraws:0,distanceDraws:0,compiled:[]};
  function decorate(material,kind='surface'){
   resources.add(material);
   material.onBeforeCompile=shader=>{
    receipts.compiled.push({kind,instancing:!!shader.instancing,
     pointLights:shader.numPointLights,pointShadows:shader.numPointLightShadows,
     spotLights:shader.numSpotLights,spotMaps:shader.numSpotLightMaps,spotShadows:shader.numSpotLightShadows});
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=factory.windVertex(shader.vertexShader,!!spec.crown);
    if(kind==='surface'){
     const patched=factory.atmosphereShader(shader.vertexShader,physicalLighting(shader.fragmentShader),
      T.ShaderChunk.lights_fragment_begin,shader.numPointLightShadows===0&&shader.numPointLights>1);
     shader.vertexShader=patched.vertex;shader.fragmentShader=patched.fragment;
    }
   };
   material.customProgramCacheKey=()=>label+'-'+spec.name+'-'+kind;
   return material;
  }
  function addMesh(geometry,material,x,y,z,instances=0){
   resources.add(geometry);
   const dressed=decorate(material),mesh=instances?new T.InstancedMesh(geometry,dressed,instances):new T.Mesh(geometry,dressed);
   if(instances)for(let i=0;i<instances;i++)mesh.setMatrixAt(i,new T.Matrix4().makeTranslation((i-1)*.22,-i*.05,i*.14));
   mesh.position.set(x,y,z);
   mesh.castShadow=true;mesh.receiveShadow=true;
   mesh.customDepthMaterial=decorate(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),'depth');
   mesh.customDistanceMaterial=decorate(new T.MeshDistanceMaterial(),'distance');
   mesh.onBeforeRender=()=>receipts.surfaceDraws++;
   mesh.onBeforeShadow=(_renderer,_object,_camera,_shadowCamera,_geometry,shadowMaterial)=>{
    if(shadowMaterial===mesh.customDepthMaterial)receipts.depthDraws++;
    if(shadowMaterial===mesh.customDistanceMaterial)receipts.distanceDraws++;
   };
   scene.add(mesh);return mesh;
  }
  addMesh(new T.SphereGeometry(.65,36,24),new T.MeshStandardMaterial({color:0xa38258,roughness:1,metalness:0}),-1.15,.15,0);
  addMesh(new T.TorusKnotGeometry(.42,.16,96,14),new T.MeshPhysicalMaterial({color:0x84b1cf,roughness:.24,metalness:.8,clearcoat:1,clearcoatRoughness:.13,sheen:.6,sheenColor:0x936044}),.3,.35,0);
  const leaves=addMesh(new T.SphereGeometry(.48,24,16),new T.MeshPhysicalMaterial({color:0x54845b,roughness:.67,metalness:0,clearcoat:.3}),1.2,.05,-.25,3);
  leaves.scale.set(.65,1.6,.45);
  const ground=addMesh(new T.PlaneGeometry(9,9,8,8),new T.MeshStandardMaterial({color:0x665f50,roughness:.8,metalness:0}),0,-.65,0);
  ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  scene.add(new T.AmbientLight(0xa8bcdd,.28));
  const sun=new T.DirectionalLight(0xffe1bb,1.6);sun.position.set(3,5,2);scene.add(sun);
  for(let i=0;i<3;i++){
   const light=new T.PointLight(i===1?0x8fb4ff:0xffffff,i===1?12:0,15,2);
   light.position.set(-2+i*2,2,-1);light.castShadow=!!spec.pointShadow&&i===1;
   light.shadow.mapSize.set(128,128);scene.add(light);
  }
  for(let i=0;i<2;i++){
   const light=new T.SpotLight(i===0?0xffdda8:0x8fcfff,i===0?spec.spot:0,18,.72,.45,1);
   light.position.set(i===0?1.5:-2,3.6,3);light.target.position.set(0,0,0);
   light.castShadow=!!spec.shadow;light.shadow.mapSize.set(128,128);light.shadow.bias=-.001;
   if(spec.map){
    const data=new Uint8Array([255,100,45,255,80,255,110,255,90,120,255,255,255,240,160,255]);
    const map=new T.DataTexture(data,2,2);map.needsUpdate=true;light.map=map;resources.add(map);
   }
   scene.add(light,light.target);
  }
  return {scene,camera,receipts,dispose(){
   scene.traverse(object=>{if(object.isLight&&object.shadow)object.shadow.dispose();});
   for(const resource of resources)resource.dispose();
  }};
 }
 async function completeGpu(){
  if(gl.isContextLost())throw Error('WebGL context lost.');
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!sync)throw Error('GPU completion fence unavailable.');
  const started=performance.now();gl.flush();
  try{
   while(true){
    const status=gl.clientWaitSync(sync,0,0);
    if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)break;
    if(status===gl.WAIT_FAILED||gl.isContextLost()||performance.now()-started>45000)throw Error('GPU completion failed.');
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   return {submittedAt:started,completedAt:performance.now()};
  }finally{gl.deleteSync(sync);}
 }
 async function render(factory,spec,label){
  const content=sceneFor(factory,spec,label);
  try{
   await renderer.compileAsync(content.scene,content.camera);
   renderer.setRenderTarget(null);renderer.render(content.scene,content.camera);
   const fence=await completeGpu(),pixels=new Uint8Array(width*height*4);
   gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error after render/readback.');
   const digest=await crypto.subtle.digest('SHA-256',pixels);
   const receipts=content.receipts;
   const pathsCovered=receipts.surfaceDraws>0&&receipts.compiled.some(p=>p.kind==='surface'&&p.instancing)&&
    (!spec.map||receipts.compiled.some(p=>p.kind==='surface'&&p.spotMaps===2))&&
    (!spec.shadow||(receipts.depthDraws>0&&receipts.compiled.some(p=>p.kind==='depth')&&receipts.compiled.some(p=>p.kind==='surface'&&p.spotShadows===2)))&&
    (!spec.pointShadow||(receipts.distanceDraws>0&&receipts.compiled.some(p=>p.kind==='distance')&&receipts.compiled.some(p=>p.kind==='surface'&&p.pointShadows===1)));
   return {pixels,fence,receipts,pathsCovered,sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')};
  }finally{content.dispose();}
 }
 function showPixels(parent,label,pixels){
  const holder=document.createElement('div'),caption=document.createElement('p');
  caption.textContent=label;holder.append(caption);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d'),flipped=new Uint8ClampedArray(pixels.length);
  for(let y=0;y<height;y++)flipped.set(pixels.subarray(y*width*4,(y+1)*width*4),(height-y-1)*width*4);
  ctx.putImageData(new ImageData(flipped,width,height),0,0);holder.append(canvas);parent.append(holder);
 }
 const button=document.querySelector('button');
 button.addEventListener('click',async event=>{
  result.trustedStart=event.isTrusted;button.disabled=true;
  try{
   for(const spec of specs){
    const before=await render(old,spec,'baseline'),after=await render(current,spec,'candidate');
    let changedPixels=0,maxChannelDifference=0,nonemptyPixels=0;
    for(let i=0;i<before.pixels.length;i+=4){
     let changed=false;
     for(let channel=0;channel<4;channel++){
      const difference=Math.abs(before.pixels[i+channel]-after.pixels[i+channel]);
      if(difference)changed=true;maxChannelDifference=Math.max(maxChannelDifference,difference);
     }
     if(changed)changedPixels++;
     if(before.pixels[i]+before.pixels[i+1]+before.pixels[i+2]>25)nonemptyPixels++;
    }
    const record={name:spec.name,settings:spec,changedPixels,maxChannelDifference,nonemptyPixels,
     baseline:{sha256:before.sha256,fence:before.fence,receipts:before.receipts,pathsCovered:before.pathsCovered},
     candidate:{sha256:after.sha256,fence:after.fence,receipts:after.receipts,pathsCovered:after.pathsCovered},
     passed:changedPixels===0&&nonemptyPixels>width*height*.2&&before.pathsCovered&&after.pathsCovered};
    result.cases.push(record);
    const article=document.createElement('article');article.id=spec.name;
    const heading=document.createElement('h2');heading.textContent=spec.name;article.append(heading);
    const row=document.createElement('section');article.append(row);document.querySelector('main').append(article);
    showPixels(row,'Baseline GPU pixels',before.pixels);showPixels(row,'Candidate GPU pixels',after.pixels);
   }
   const digest=name=>result.cases.find(item=>item.name===name).baseline.sha256;
   result.controlsChangePixels={
    activeLight:digest('inactive-spot-zero-wind')!==digest('active-spot-zero-wind'),
    activeWind:digest('active-spot-zero-wind')!==digest('active-spot-cloth-wind'),
    crownWind:digest('active-spot-cloth-wind')!==digest('active-spot-crown-wind'),
    projectedMap:digest('active-spot-zero-wind')!==digest('active-spot-map'),
    mappedSpotShadow:digest('active-spot-map')!==digest('active-spot-map-shadow'),
    spotShadow:digest('active-spot-zero-wind')!==digest('active-spot-depth-shadow'),
    movingSpotShadow:digest('active-spot-cloth-wind')!==digest('active-spot-depth-shadow-wind'),
    pointShadow:digest('inactive-spot-zero-wind')!==digest('zero-wind-point-shadow'),
    movingPointShadow:digest('active-spot-cloth-wind')!==digest('moving-wind-point-shadow')
   };
   result.passed=result.trustedStart&&result.cases.length===specs.length&&
    result.cases.every(item=>item.passed)&&Object.values(result.controlsChangePixels).every(Boolean);
  }catch(error){result.errors.push(String(error.stack||error));}
  finally{noise.dispose();renderer.dispose();document.body.dataset.complete='true';}
 });
 document.body.dataset.ready='true';
}

const html='<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Shader GPU pixel verification</title><style>body{background:#10191f;color:#e7e7df;font:15px Arial;margin:24px}button{padding:14px}section{display:flex;gap:20px}h2{font-size:18px}canvas{width:384px;height:256px}article{margin:24px 0}</style></head><body><h1>Shader GPU pixel verification</h1><p>Controlled rendering fixture. Not gameplay or frame-rate acceptance.</p><button>Run verification</button><main></main><script type="module" src="/shader-fixture.mjs"></script></body></html>';
const fixtureModule='('+fixtureMain.toString()+')();';
const server=await createServer({root:game,configFile:false,publicDir:false,logLevel:'error',
 cacheDir:resolve(out,'vite-cache'),optimizeDeps:{noDiscovery:true,include:['three']},
 server:{host:'127.0.0.1',port:0,strictPort:false},plugins:[{
  name:'shader-equivalence-fixture',configureServer(server){server.middlewares.use((request,response,next)=>{
   if(new URL(request.url,'http://fixture').pathname==='/'){response.setHeader('Content-Type','text/html');response.end(html);}else next();
  });},
  resolveId(id){if(id==='/shader-fixture.mjs')return '\0shader-fixture.mjs';if(id==='/baseline-atmosphere.ts')return '\0baseline-atmosphere.ts';},
  load(id){if(id==='\0shader-fixture.mjs')return fixtureModule;if(id==='\0baseline-atmosphere.ts')return baselineModule;}
 }]});
let browser,context;
try{
 await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
 if(process.argv.includes('--check-fixture-http')){
  for(const path of ['/shader-fixture.mjs','/baseline-atmosphere.ts','/src/belle/atmosphereShaders.ts','/src/belle/physicalLighting.ts']){
   const response=await fetch(origin+path),source=await response.text();assert.equal(response.status,200,path);
   assert(!/import\(['"]three['"]\)/.test(source),path+' must resolve browser imports');
   console.log(JSON.stringify({path,status:response.status,bytes:Buffer.byteLength(source)}));
  }
  await server.close();console.log('HTTP transform only; no browser verification performed.');process.exit(0);
 }
 const native=process.platform==='darwin';
 browser=await chromium.launch({...(process.env.BELLE_BROWSER_PATH?{executablePath:process.env.BELLE_BROWSER_PATH}:{channel:'chrome'}),
  headless:!native,args:native?['--enable-gpu','--use-gl=angle','--use-angle=metal']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 report.browser=browser.version();
 context=await browser.newContext({viewport:{width:1000,height:800},deviceScaleFactor:1});
 const page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('pageerror',error=>report.errors.push(error.stack||error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
 page.on('response',response=>{if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());});
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.dataset.ready==='true');
 await page.getByRole('button',{name:'Run verification',exact:true}).click();
 await page.waitForFunction(()=>document.body.dataset.complete==='true',null,{timeout:180000});
 const result=await page.evaluate(()=>window.__shaderResult);
 Object.assign(report,{renderer:result.renderer,presentation:result.presentation,gpuTimerAvailable:result.gpuTimerAvailable,cases:result.cases,controlsChangePixels:result.controlsChangePixels,trustedStart:result.trustedStart});
 report.errors.push(...result.errors);
 if(native)assert(/Metal/.test(result.renderer)&&!/SwiftShader|llvmpipe/i.test(result.renderer),'Native Metal fixture required on macOS.');
 for(const record of report.cases){
  const file=record.name+'.png',bytes=await page.locator('#'+record.name).screenshot({path:resolve(out,file)});
  report.captures.push({file,sha256:hash(bytes),bytes:bytes.length});
 }
 assert.equal(result.passed,true,'Every controlled image must be byte-identical and controls must visibly exercise active paths.');
 assert.equal(hash(await readFile(resolve(game,sourcePath))),report.shaderSha256.candidate,'Source changed during the check.');
 report.passed=true;
}catch(error){report.errors.push(error.stack||String(error));}
finally{
 try{await context?.close();}catch(error){report.errors.push('Context cleanup: '+error.message);}
 try{await browser?.close();}catch(error){report.errors.push('Browser cleanup: '+error.message);}
 try{await server.close();}catch(error){report.errors.push('Server cleanup: '+error.message);}
 report.finishedAt=new Date().toISOString();
 report.passed=report.passed&&report.cases.length===11&&report.cases.every(item=>item.passed)&&!report.errors.length&&!report.failedRequests.length;
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
