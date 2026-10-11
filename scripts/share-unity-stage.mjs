import {readFile,writeFile,unlink,stat,rename} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
// Immutable, already-published source bytes from this reviewed game release.
// The Unity program/clip remain exact; GitHub's public raw CDN serves their bytes.
export const UNITY_STAGE_SOURCE='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/a30097110eb5f4789ace15458dc9a3753379b528/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/jazz-stage/';
// This endpoint serves the same public commit with application/wasm so Unity
// can compile by streaming rather than buffering after a MIME fallback.
export const UNITY_WASM_SOURCE='https://cdn.jsdelivr.net/gh/robjasper2084/Jungle-Lotto@a30097110eb5f4789ace15458dc9a3753379b528/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/jazz-stage/Build/JazzPortal.wasm';
export async function shareUnityStage(root){const stage=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/exports/jazz-stage'),path=resolve(stage,'index.html');let html;try{html=await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')return{saved:0};throw e;}
 const replacements=[['Build/JazzPortal.data',UNITY_STAGE_SOURCE+'Build/JazzPortal.data'],['Build/JazzPortal.wasm',UNITY_WASM_SOURCE],['StreamingAssets',UNITY_STAGE_SOURCE+'StreamingAssets']];let out=html;for(const [from,to]of replacements){if(!out.includes('"'+from+'"'))throw Error('Unity stage configuration changed: '+from);out=out.replace('"'+from+'"','"'+to+'"');}
 const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,out,{flag:'wx'});await rename(temporary,path);let saved=Buffer.byteLength(html)-Buffer.byteLength(out);for(const n of ['Build/JazzPortal.data','Build/JazzPortal.wasm','StreamingAssets/BloomPerformance.mp4']){const file=resolve(stage,n);saved+=(await stat(file)).size;await unlink(file);}
 // The prior screen-only build is no longer referenced by this launcher.
 // Remove only its generated files from the deploy artifact, retaining sources.
 for(const n of ['WebGL.data','WebGL.wasm','WebGL.loader.js','WebGL.framework.js']){const file=resolve(stage,'Build',n);let size;try{size=(await stat(file)).size;}catch(e){if(e.code==='ENOENT')continue;throw e;}await unlink(file);saved+=size;}
 console.log('Shared exact Unity stage assets through their immutable GitHub source: '+(saved/1048576).toFixed(1)+' MiB.');return{saved,source:UNITY_STAGE_SOURCE};}
