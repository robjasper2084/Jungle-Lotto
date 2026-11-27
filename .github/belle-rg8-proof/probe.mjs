// Opt-in isolated texture-format experiment. Never changes the game or its gates.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,readdir,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';

const game=resolve(process.argv[2]??'');
const output=resolve(process.argv[3]??'rg8-proof-output');
const backend=process.env.RG8_PROBE_BACKEND??'swiftshader';
assert(['swiftshader','metal'].includes(backend));
const pinned=JSON.parse(await readFile(resolve(dirname(fileURLToPath(import.meta.url)),'source-manifest.json'),'utf8'));
assert.equal(pinned.sourceSha,'75906273c0cd414c0d004320fc6f654b4783e5b1');
assert.equal(execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pinned.sourceSha);
assert.equal(execFileSync('git',['-C',game,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),pinned.sourceTree);
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require(process.env.RG8_PROBE_PLAYWRIGHT??'playwright');}catch{
  const runtime=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  assert(runtime,'Install the existing project Playwright runtime before running this opt-in proof.');
  playwright=require(resolve(runtime,'playwright'));
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const sourcePath=resolve(game,'src/belle/realisticMaterials.ts');
const sourceBytes=await readFile(sourcePath),source=sourceBytes.toString('utf8');
assert.equal(sha(sourceBytes),pinned.materialSource.sha256);
assert.equal(gitBlob(sourceBytes),pinned.materialSource.gitBlob);
const runtime=resolve(process.env.RG8_PROBE_RUNTIME_ROOT??resolve(game,'../..'));
for(const row of pinned.lockedRuntime){const bytes=await readFile(resolve(runtime,row.path));assert.equal(sha(bytes),row.sha256);assert.equal(gitBlob(bytes),row.gitBlob);}
const three=resolve(process.env.RG8_PROBE_THREE_ROOT??resolve(runtime,'node_modules/three'));
assert.equal(JSON.parse(await readFile(resolve(three,'package.json'),'utf8')).version,pinned.threeVersion);
for(const row of pinned.threeFiles)assert.equal(sha(await readFile(resolve(three,row.path))),row.sha256,'Three source changed: '+row.path);
function sourceBlock(chunk){
  const marker="replace('#include <"+chunk+">',`";
  const begin=source.indexOf(marker);assert(begin>=0,'Missing source block '+chunk);
  const start=begin+marker.length,end=source.indexOf('`);',start);assert(end>start);
  const full=source.slice(start,end);
  assert(full.startsWith('#include <'+chunk+'>'));
  return full.slice(('#include <'+chunk+'>').length);
}
const samplingStart=source.indexOf('vec3 skinWeights(){');
const samplingEnd=source.indexOf('`+shader.fragmentShader;',samplingStart);
assert(samplingStart>=0&&samplingEnd>samplingStart);
const blocks={sampling:source.slice(samplingStart,samplingEnd),map:sourceBlock('map_fragment'),roughness:sourceBlock('roughnessmap_fragment'),normal:sourceBlock('normal_fragment_maps')};
for(const [name,block]of Object.entries(blocks))assert.equal(sha(block),pinned.sourceBlocks[name],'Shader source block changed: '+name);
assert(blocks.map.includes('sampleSkin(skinDetail,skinP,skinPx,skinPy,skinW)'));
assert(blocks.normal.includes('dFdx(skinD.g)'));
assert(blocks.roughness.includes('skinD.r'));
const skins=resolve(game,'public/belle/skins');
const names=(await readdir(skins)).filter(x=>/^[a-z]+-detail\.webp$/.test(x)).sort();
assert.equal(names.length,28,'Expected all original authored detail maps');
const assets=[];
for(const name of names){const bytes=await readFile(resolve(skins,name));assets.push({name,bytes:bytes.length,sha256:sha(bytes),gitBlob:gitBlob(bytes)});}
const chosen=['grass','asphalt','limestone'];
const profiles={};
for(const kind of chosen){
  const match=source.match(new RegExp('(?:[\\s,])'+kind+':\\[([^\\]]+)\\]'));assert(match,'Missing original profile '+kind);
  profiles[kind]=match[1].split(',').map(Number);assert(profiles[kind].every(Number.isFinite));
  const name=kind+'-color.webp',bytes=await readFile(resolve(skins,name));assets.push({name,bytes:bytes.length,sha256:sha(bytes),gitBlob:gitBlob(bytes)});
}
assert.deepEqual(profiles,pinned.profiles);
assert.deepEqual([...assets].sort((a,b)=>a.name.localeCompare(b.name)),[...pinned.assets].sort((a,b)=>a.name.localeCompare(b.name)),'Source asset inventory changed');
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'source-binding.json'),JSON.stringify({
  purpose:'Isolated format feasibility and microbenchmark, not full-game release acceptance',
  sourceHead:execFileSync('git',['-C',game,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  sourceFile:sourcePath,sourceSha256:sha(sourceBytes),sourceGitBlob:gitBlob(sourceBytes),assets,
  blocks:Object.fromEntries(Object.entries(blocks).map(([k,v])=>[k,{sha256:sha(v),source:v}])),
  profiles,backend,threeVersion:pinned.threeVersion,threeFiles:pinned.threeFiles,
},null,2)+'\n');
if(process.env.RG8_PROBE_SOURCE_ONLY==='1'){
  console.log(JSON.stringify({sourceOnly:true,assets:assets.length,detailMaps:names.length,blocks:Object.keys(blocks),gpuExecuted:false,output}));
  process.exit(0);
}
const allowed=new Map(assets.map(row=>[row.name,row]));
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));
    if(!name){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>RG8 isolated proof</title><canvas id="probe" width="1280" height="800"></canvas>');return;}
    if(!allowed.has(name)){res.writeHead(404);res.end();return;}
    const bytes=await readFile(resolve(skins,name));assert.equal(sha(bytes),allowed.get(name).sha256,'Source asset changed while serving');
    res.setHeader('Content-Type','image/webp');res.end(bytes);
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const evidence=[];let browser,page;
const report={passed:false,backend,errors:[],requests:[],limitations:'Raw WebGL source-bound sampling fixture only. No actual game scene, controls, native 90-second ride or current production deployment is certified.'};
try{
  browser=await playwright.chromium.launch({
    ...(process.env.RG8_PROBE_BROWSER?{executablePath:process.env.RG8_PROBE_BROWSER}:{channel:'chrome'}),
    headless:process.env.RG8_PROBE_HEADLESS==='1',
    args:backend==='swiftshader'?['--use-angle=swiftshader','--enable-unsafe-swiftshader','--gpu-watchdog-timeout-seconds=60']:['--use-angle=metal'],
  });
  report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(String(e)));
  page.on('requestfailed',r=>report.requests.push({url:r.url(),error:r.failure()?.errorText}));
  await page.exposeFunction('saveRawProof',async(name,base64,meta)=>{
    assert(/^[a-z0-9._-]+$/.test(name));const bytes=Buffer.from(base64,'base64'),isFloat=meta.componentType==='Float32',file=name+(isFloat?'.rgba32f.gz':'.rgba.gz');
    assert.equal(bytes.length,meta.width*meta.height*4*(isFloat?4:1));
    const zipped=gzipSync(bytes);await writeFile(resolve(output,file),zipped);
    const row={file,bytes:bytes.length,sha256:sha(bytes),gzipSha256:sha(zipped),...meta};evidence.push(row);
    await appendFile(resolve(output,'capture-receipts.ndjson'),JSON.stringify(row)+'\n');return row;
  });
  await page.exposeFunction('appendProofEvent',async row=>{await appendFile(resolve(output,'proof-events.ndjson'),JSON.stringify(row)+'\n');});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  const proofPending=page.evaluate(async({names,chosen,profiles,blocks,backend,assets})=>{
    const check=(value,message)=>{if(!value)throw Error(message);};
    const canvas=document.getElementById('probe');
    const gl=canvas.getContext('webgl2',{alpha:false,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:true});
    check(gl,'WebGL2 unavailable');const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const renderer=String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER));
    check(backend==='swiftshader'?/SwiftShader/i.test(renderer):/Metal/i.test(renderer)&&!/SwiftShader|software/i.test(renderer),'Unexpected renderer: '+renderer);
    const anis=gl.getExtension('EXT_texture_filter_anisotropic'),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),floatColor=gl.getExtension('EXT_color_buffer_float');
    check(anis,'Original anisotropy extension unavailable');
    const maxAnis=Math.min(8,gl.getParameter(anis.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
    const result={renderer,glVersion:gl.getParameter(gl.VERSION),context:gl.getContextAttributes(),maxAnisotropy:maxAnis,imageReceipts:[],textureReceipts:[],mips:[],samples:[],floatSamples:[],positiveControls:[],timings:[],gpuTimingAvailable:!!timer,floatColorAvailable:!!floatColor,gpuTimingBenefitVerified:false};
    window.__rg8Proof=result;
    await window.appendProofEvent({event:'context',renderer,glVersion:result.glVersion,context:result.context,maxAnisotropy:maxAnis,gpuTimingAvailable:!!timer,floatColorAvailable:!!floatColor});
    check(floatColor,'Required RGBA32F output extension unavailable; proof cannot pass through RGBA8 quantization alone');
    function errorAt(where){check(gl.getError()===gl.NO_ERROR,'GL error at '+where);check(!gl.isContextLost(),'Context lost at '+where);}
    function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);check(gl.getShaderParameter(shader,gl.COMPILE_STATUS),gl.getShaderInfoLog(shader));return shader;}
    const vertex=`#version 300 es
precision highp float;
uniform vec2 extent;uniform vec3 suppliedNormal;
out vec3 skinPosition;out vec3 skinNormal;out vec3 vViewPosition;
void main(){vec2 corner=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vec2 p=corner*2.-1.;gl_Position=vec4(p,0.,1.);skinPosition=vec3((p.x*.5+.5)*extent.x-1.37,(p.x*.17+p.y*.29)*extent.y,(p.y*.5+.5)*extent.y-2.91);skinNormal=suppliedNormal;vViewPosition=vec3(p.x*3.,p.y*2.,2.+p.x*.13);}`;
    const prefix=`#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
in vec3 skinPosition;in vec3 skinNormal;in vec3 vViewPosition;
uniform sampler2D skinDetail;uniform sampler2D skinColor;uniform vec3 skinProfile;uniform bool skinPlanar;uniform float originalRoughness;uniform bool swapRG;uniform int mipLevel;uniform int resultPlane;
out vec4 outColor;
`;
    function program(fragment){const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);check(gl.getProgramParameter(p,gl.LINK_STATUS),gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);return p;}
    const mipFragment=prefix+'void main(){outColor=texelFetch(skinDetail,ivec2(gl_FragCoord.xy),mipLevel);}';
    const mipProgram=program(mipFragment);
    const mapBlock=blocks.map.replace('vec3 skinD=sampleSkin(skinDetail,skinP,skinPx,skinPy,skinW);','vec3 skinD=sampleSkin(skinDetail,skinP,skinPx,skinPy,skinW);if(swapRG)skinD=skinD.grb;');
    check(mapBlock!==blocks.map,'Positive control injection failed');
    const sampleBody=prefix+blocks.sampling+`void main(){vec3 normal=normalize(vec3(.17,1.,.31));vec3 diffuse=vec3(.54,.58,.49);vec4 diffuseColor=vec4(diffuse,1.);float roughnessFactor=originalRoughness;`+mapBlock+blocks.roughness+blocks.normal;
    const sampleFragment=sampleBody+`outColor=vec4(diffuseColor.r*(.6+.4*normal.y),roughnessFactor,diffuseColor.b*(.6+.4*normal.z),1.);}`;
    const floatFragment=sampleBody+`outColor=resultPlane==0?vec4(normal,roughnessFactor):vec4(diffuseColor.rgb,skinD.g);}`;
    const sampleProgram=program(sampleFragment);
    const floatProgram=program(floatFragment);
    result.shaders={vertex,mipFragment,sampleFragment,floatFragment};
    await window.appendProofEvent({event:'shaders',shaders:result.shaders});
    const locations=new Map();
    function uniform(p,name){let cache=locations.get(p);if(!cache){cache=new Map();locations.set(p,cache);}if(!cache.has(name))cache.set(name,gl.getUniformLocation(p,name));return cache.get(name);}
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
    let target,framebuffer,width=0,height=0,targetType='';
    function surface(w,h,type='u8'){if(w===width&&h===height&&type===targetType)return;if(framebuffer)gl.deleteFramebuffer(framebuffer);if(target)gl.deleteTexture(target);width=w;height=h;targetType=type;target=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,target);gl.texImage2D(gl.TEXTURE_2D,0,type==='f32'?gl.RGBA32F:gl.RGBA8,w,h,0,gl.RGBA,type==='f32'?gl.FLOAT:gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);check(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'Incomplete '+type+' output');gl.viewport(0,0,w,h);errorAt('output allocation');}
    async function image(name){
      const binding=assets.find(row=>row.name===name);check(binding,'Unbound image '+name);
      const response=await fetch('/'+name,{cache:'no-store'});check(response.status===200,'Image HTTP status '+response.status);
      const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
      const sha256=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
      check(bytes.byteLength===binding.bytes&&sha256===binding.sha256,'Browser-consumed bytes changed '+name);
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
      try{const img=new Image();img.src=url;await img.decode();const expected=name.endsWith('-detail.webp')?512:1024;check(img.naturalWidth===expected&&img.naturalHeight===expected,'Authored map dimensions changed: '+name);result.imageReceipts.push({name,bytes:bytes.byteLength,sha256,httpStatus:response.status,consumedBy:'verified-browser-ArrayBuffer-to-Blob-to-same-HTMLImageElement',width:img.naturalWidth,height:img.naturalHeight});return img;}
      finally{URL.revokeObjectURL(url);}
    }
    function upload(img,kind,aniso,name){
      const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
      const internal=kind==='rg'?gl.RG8:kind==='color'?gl.SRGB8_ALPHA8:gl.RGBA8,format=kind==='rg'?gl.RG:gl.RGBA;
      // Match Three r185's regular-image path: immutable complete mip allocation,
      // then the same decoded DOM image. No canvas readback/CPU conversion.
      const levels=Math.floor(Math.log2(Math.max(img.naturalWidth,img.naturalHeight)))+1;
      gl.texStorage2D(gl.TEXTURE_2D,levels,internal,img.naturalWidth,img.naturalHeight);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,format,gl.UNSIGNED_BYTE,img);errorAt('DOM upload '+kind);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameterf(gl.TEXTURE_2D,anis.TEXTURE_MAX_ANISOTROPY_EXT,aniso);gl.generateMipmap(gl.TEXTURE_2D);errorAt('mipmap '+kind);
      result.textureReceipts.push({name,kind,internalFormat:internal,format,type:gl.UNSIGNED_BYTE,width:img.naturalWidth,height:img.naturalHeight,levels,allocation:'texStorage2D',upload:'texSubImage2D',source:'same-decoded-HTMLImageElement',flipY:true,premultiplyAlpha:false,colorConversion:gl.NONE,unpackAlignment:4,wrapS:gl.REPEAT,wrapT:gl.REPEAT,magFilter:gl.LINEAR,minFilter:gl.LINEAR_MIPMAP_LINEAR,anisotropy:aniso,generatedMipmaps:true});return texture;
    }
    async function completed(){const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);check(fence,'Fence allocation failed');gl.flush();const start=performance.now();try{while(true){const state=gl.clientWaitSync(fence,0,0);if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return;check(state===gl.TIMEOUT_EXPIRED,'Fence failure');check(performance.now()-start<15000,'Fixture fence deadline');await new Promise(r=>setTimeout(r,2));}}finally{gl.deleteSync(fence);}}
    function bind(p,detail,color){gl.useProgram(p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,detail);gl.uniform1i(uniform(p,'skinDetail'),0);if(color){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,color);gl.uniform1i(uniform(p,'skinColor'),1);}gl.activeTexture(gl.TEXTURE0);}
    function parameters(p,{extent=[1,1],planar=true,profile=[1,0,0,.94],swap=false,level=0,plane=0}={}){gl.uniform2f(uniform(p,'extent'),...extent);gl.uniform3f(uniform(p,'suppliedNormal'),...(planar?[0,1,0]:[.31,.87,.38]));gl.uniform3f(uniform(p,'skinProfile'),...profile.slice(0,3));gl.uniform1f(uniform(p,'originalRoughness'),profile[3]);gl.uniform1i(uniform(p,'skinPlanar'),planar?1:0);gl.uniform1i(uniform(p,'swapRG'),swap?1:0);gl.uniform1i(uniform(p,'mipLevel'),level);gl.uniform1i(uniform(p,'resultPlane'),plane);}
    async function pixels(p,detail,color,settings){bind(p,detail,color);parameters(p,settings);gl.drawArrays(gl.TRIANGLES,0,3);await completed();const out=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,out);errorAt('raw readback');return out;}
    function compare(a,b){check(a.length===b.length,'Mismatched captures');let changedPixels=0,maxChannelDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++){const d=Math.abs(a[i+j]-b[i+j]);changed||=d!==0;maxChannelDelta=Math.max(maxChannelDelta,d);}if(changed)changedPixels++;}return{changedPixels,maxChannelDelta};}
    async function floatPixels(detail,color,settings){bind(floatProgram,detail,color);parameters(floatProgram,settings);gl.drawArrays(gl.TRIANGLES,0,3);await completed();const out=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,out);errorAt('Float32 raw readback');return out;}
    function compareFloat(a,b){check(a.length===b.length,'Mismatched Float32 captures');const left=new Uint32Array(a.buffer,a.byteOffset,a.length),right=new Uint32Array(b.buffer,b.byteOffset,b.length);let changedPixels=0,changedComponents=0,nonFiniteComponents=0,maxAbsoluteDelta=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<4;j++){if(left[i+j]!==right[i+j]){changed=true;changedComponents++;}if(!Number.isFinite(a[i+j])||!Number.isFinite(b[i+j]))nonFiniteComponents++;else maxAbsoluteDelta=Math.max(maxAbsoluteDelta,Math.abs(a[i+j]-b[i+j]));}if(changed)changedPixels++;}return{changedPixels,changedComponents,nonFiniteComponents,maxAbsoluteDelta};}
    const littleEndian=new Uint8Array(new Uint32Array([0x11223344]).buffer)[0]===0x44;
    async function save(name,pixels){const isFloat=pixels instanceof Float32Array,bytes=new Uint8Array(pixels.buffer,pixels.byteOffset,pixels.byteLength);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return window.saveRawProof(name,btoa(binary),{width,height,format:isFloat?'raw-RGBA32F-bottom-up':'raw-RGBA8-bottom-up',componentType:isFloat?'Float32':'Uint8',bytesPerPixel:isFloat?16:4,...(isFloat?{littleEndian}:{})});}
    const held=new Map();
    for(const name of names){
      const img=await image(name),rgba=upload(img,'rgba',maxAnis,name),rg=upload(img,'rg',maxAnis,name);
      for(let level=0;level<10;level++){
        const size=512>>level;surface(size,size);
        const a=await pixels(mipProgram,rgba,null,{level}),b=await pixels(mipProgram,rg,null,{level}),difference=compare(a,b);
        const base=name.replace('.webp','')+'-mip-'+level;
        const receipts=[await save(base+'-rgba8',a),await save(base+'-rg8',b)];result.mips.push({name,level,...difference,receipts});
        await window.appendProofEvent({event:'mip',data:result.mips.at(-1)});
        check(difference.changedPixels===0&&difference.maxChannelDelta===0,'Mipmap mismatch '+name+' '+level);
        if(level===0)for(let i=0;i<a.length;i+=4)check(a[i+2]===0&&a[i+3]===255,'Browser-decoded dropped channels differ from RG8 defaults');
      }
      const kind=name.replace('-detail.webp','');if(chosen.includes(kind))held.set(kind,{rgba,rg});else{gl.deleteTexture(rgba);gl.deleteTexture(rg);}
    }
    for(const kind of chosen){
      const {rgba,rg}=held.get(kind),color=upload(await image(kind+'-color.webp'),'color',maxAnis,kind+'-color.webp');held.get(kind).color=color;
      for(const a of [...new Set([1,maxAnis])]){
        for(const t of [rgba,rg,color]){gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameterf(gl.TEXTURE_2D,anis.TEXTURE_MAX_ANISOTROPY_EXT,a);}
        for(const planar of [true,false])for(const extent of [[.5,.3],[2,1.5],[16,12],[128,1]]){
          surface(384,256);const settings={planar,extent,profile:profiles[kind]};
          const left=await pixels(sampleProgram,rgba,color,settings),right=await pixels(sampleProgram,rg,color,settings),difference=compare(left,right);
          const name=kind+'-'+(planar?'planar':'triplanar')+'-aniso-'+a+'-span-'+extent.join('_').replaceAll('.','p');
          const receipts=[await save(name+'-rgba8',left),await save(name+'-rg8',right)];result.samples.push({kind,planar,extent,anisotropy:a,...difference,receipts});
          await window.appendProofEvent({event:'rgba8-sample',data:result.samples.at(-1)});
          check(difference.changedPixels===0&&difference.maxChannelDelta===0,'Gradient/derivative mismatch '+name);
          surface(384,256,'f32');
          for(const plane of [0,1]){
            const floatLeft=await floatPixels(rgba,color,{...settings,plane}),floatRight=await floatPixels(rg,color,{...settings,plane}),floatDifference=compareFloat(floatLeft,floatRight);
            const contents=plane===0?'normal-xyz-roughness':'diffuse-rgb-height';
            const floatReceipts=[await save(name+'-'+contents+'-rgba8',floatLeft),await save(name+'-'+contents+'-rg8',floatRight)];
            result.floatSamples.push({kind,planar,extent,anisotropy:a,plane,contents,littleEndian,...floatDifference,receipts:floatReceipts});
            await window.appendProofEvent({event:'float32-sample',data:result.floatSamples.at(-1)});
            check(floatDifference.changedComponents===0&&floatDifference.nonFiniteComponents===0,'Float32 bit mismatch '+name+' '+contents);
          }
        }
      }
      surface(384,256);const settings={planar:false,extent:[2,1.5],profile:profiles[kind]};
      const baseline=await pixels(sampleProgram,rgba,color,settings),altered=await pixels(sampleProgram,rgba,color,{...settings,swap:true}),difference=compare(baseline,altered);
      const receipts=[await save(kind+'-positive-original',baseline),await save(kind+'-positive-swapped-rg',altered)];
      result.positiveControls.push({kind,...difference,receipts});await window.appendProofEvent({event:'positive-control',data:result.positiveControls.at(-1)});check(difference.changedPixels>0,'Empty detail positive control '+kind);
    }
    // Balanced complete-render microtimings only. They cannot certify actual game benefit.
    if(timer){
      surface(1280,800);
      const sequence=['a','b','b','a','b','a','a','b','a','b','b','a','b','a','a','b'];
      for(const kind of chosen)for(const planar of [true,false]){
        const {rgba,rg,color}=held.get(kind);for(const t of [rgba,rg,color]){gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameterf(gl.TEXTURE_2D,anis.TEXTURE_MAX_ANISOTROPY_EXT,maxAnis);}
        for(const [index,lane]of ['a','b','b','a',...sequence].entries()){
          bind(sampleProgram,lane==='a'?rgba:rg,color);parameters(sampleProgram,{planar,extent:[16,12],profile:profiles[kind]});
          const row={kind,planar,index,warmup:index<4,lane:lane==='a'?'RGBA8':'RG8',querySequence:result.timings.length,rawElapsedNs:null,elapsedNs:null,submitMs:null,width,height,anisotropy:maxAnis,status:'pending',allocated:false,begun:false,ended:false,completed:false,resolved:false,deleted:false,disjointBefore:null,disjointAfter:null,error:null};result.timings.push(row);
          await window.appendProofEvent({event:'timer-start',data:row});
          let query,active=false;
          try{
            row.disjointBefore=!!gl.getParameter(timer.GPU_DISJOINT_EXT);check(!row.disjointBefore,'Disjoint GPU before sample');
            query=gl.createQuery();check(query,'Timer allocation failed');row.allocated=true;
            const started=performance.now();gl.beginQuery(timer.TIME_ELAPSED_EXT,query);active=true;row.begun=true;gl.drawArrays(gl.TRIANGLES,0,3);gl.endQuery(timer.TIME_ELAPSED_EXT);active=false;row.ended=true;row.submitMs=performance.now()-started;
            await completed();row.completed=true;const deadline=performance.now()+15000;
            while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){check(performance.now()<deadline,'Timer deadline');await new Promise(r=>setTimeout(r,2));}
            row.rawElapsedNs=gl.getQueryParameter(query,gl.QUERY_RESULT);row.resolved=true;row.disjointAfter=!!gl.getParameter(timer.GPU_DISJOINT_EXT);
            check(!row.disjointAfter,'Disjoint GPU sample');check(Number.isFinite(row.rawElapsedNs)&&row.rawElapsedNs>0,'Invalid elapsed query');errorAt('timed sample');row.elapsedNs=row.rawElapsedNs;row.status='valid';
          }catch(error){row.status='invalid';row.error=String(error.message||error);throw error;}
          finally{if(active){try{gl.endQuery(timer.TIME_ELAPSED_EXT);row.ended=true;}catch{/* Original failure stays recorded. */}}if(query){gl.deleteQuery(query);row.deleted=true;}await window.appendProofEvent({event:'timer-finish',data:row});}
        }
      }
    }
    result.correctnessVerified=true;result.timingStatus=timer?'complete-uninterpreted':'unavailable';result.passed=true;return result;
  },{names,chosen,profiles,blocks,backend,assets});
  let proofDeadline;
  try{report.proof=await Promise.race([proofPending,new Promise((_,reject)=>{proofDeadline=setTimeout(()=>reject(Error('Isolated proof exceeded its original 15-minute diagnostic deadline')),900000);})]);}
  finally{clearTimeout(proofDeadline);}
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
  assert.equal(report.proof.mips.length,280);assert.equal(report.proof.positiveControls.length,3);
  assert.equal(report.proof.samples.length,48);assert.equal(report.proof.floatSamples.length,96);
  assert.equal(report.proof.imageReceipts.length,31);
  if(report.proof.gpuTimingAvailable){assert.equal(report.proof.timings.length,120);assert(report.proof.timings.every(row=>row.status==='valid'&&row.allocated&&row.begun&&row.ended&&row.completed&&row.resolved&&row.deleted&&!row.disjointBefore&&!row.disjointAfter));}
  report.passed=report.proof.passed===true;
}catch(error){
  report.errors.push(String(error.stack||error));process.exitCode=1;
  let partialDeadline;
  try{if(page&&!page.isClosed())report.proof=await Promise.race([page.evaluate(()=>window.__rg8Proof??null),new Promise((_,reject)=>{partialDeadline=setTimeout(()=>reject(Error('Partial collection unavailable')),5000);})]);}catch{/* Preserve original error and journaled raw evidence. */}finally{clearTimeout(partialDeadline);}
}
finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  try{
    assert.equal(sha(await readFile(sourcePath)),pinned.materialSource.sha256);
    for(const row of assets)assert.equal(sha(await readFile(resolve(skins,row.name))),row.sha256);
    for(const row of pinned.lockedRuntime)assert.equal(sha(await readFile(resolve(runtime,row.path))),row.sha256);
    for(const row of pinned.threeFiles)assert.equal(sha(await readFile(resolve(three,row.path))),row.sha256);
    report.immutableSourceAfter=true;
  }catch(error){report.passed=false;report.immutableSourceAfter=false;report.errors.push(String(error));process.exitCode=1;}
  report.evidence=evidence;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,backend,mipPairs:report.proof?.mips?.length??0,gradientPairs:report.proof?.samples?.length??0,floatPairs:report.proof?.floatSamples?.length??0,queries:report.proof?.timings?.length??0,evidenceFiles:evidence.length,errors:report.errors,output}));
}
