import {readFile,writeFile,unlink,stat,rename} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
// Immutable, already-published source bytes from this reviewed game release.
// The Unity program/clip remain exact; GitHub's public raw CDN serves their bytes.
export const UNITY_STAGE_SOURCE='https://raw.githubusercontent.com/robjasper2084/Jungle-Lotto/360925afb7269c23d295c0b473d670e8ecedb847/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/jazz-stage/';
// This endpoint serves the same public commit with application/wasm so Unity
// can compile by streaming rather than buffering after a MIME fallback.
export const UNITY_WASM_SOURCE='https://cdn.jsdelivr.net/gh/robjasper2084/Jungle-Lotto@360925afb7269c23d295c0b473d670e8ecedb847/lottominded-ultra.io/games/gothtechnology2/swoop-source/public/exports/jazz-stage/Build/WebGL.wasm';
export const UNITY_HASHES={
 'Build/WebGL.data':'26133327a15a6c41c04a17069c39f2fb7e5868f0809dc21c8b1bdd02ad856366',
 'Build/WebGL.wasm':'e9950484c51e90a625c26e60deeeb690a50d12f4246ee9a8793c3b1afbf8e659',
 'StreamingAssets/BloomPerformance.mp4':'972e6d4c70b6bdb24ddcf29636e4ef2db6a6ca0b11163078043224776d7f2534'
};
export async function shareUnityStage(root,hashes=UNITY_HASHES){const stage=resolve(root,'lottominded-ultra.io/games/gothtechnology2/arcade/swoop-detroit/exports/jazz-stage'),path=resolve(stage,'index.html');let html;try{html=await readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')return{saved:0};throw e;}
 // Fail before any mutation if the copied program no longer matches its pin.
 for(const [name,hash] of Object.entries(hashes))if(createHash('sha256').update(await readFile(resolve(stage,name))).digest('hex')!==hash)throw Error('Pinned Unity bytes changed: '+name);
 const replacements=[['Build/WebGL.data',UNITY_STAGE_SOURCE+'Build/WebGL.data'],['Build/WebGL.wasm',UNITY_WASM_SOURCE],['StreamingAssets',UNITY_STAGE_SOURCE+'StreamingAssets']];let out=html;for(const [from,to]of replacements){if(!out.includes('"'+from+'"'))throw Error('Unity stage configuration changed: '+from);out=out.replace('"'+from+'"','"'+to+'"');}
 const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,out,{flag:'wx'});await rename(temporary,path);let saved=Buffer.byteLength(html)-Buffer.byteLength(out);for(const n of Object.keys(UNITY_HASHES)){const file=resolve(stage,n);saved+=(await stat(file)).size;await unlink(file);}
 // The prior JazzPortal build is no longer referenced by this launcher.
 // Remove only its generated files from the deploy artifact, retaining sources.
 for(const n of ['JazzPortal.data','JazzPortal.wasm','JazzPortal.loader.js','JazzPortal.framework.js']){const file=resolve(stage,'Build',n);let size;try{size=(await stat(file)).size;}catch(e){if(e.code==='ENOENT')continue;throw e;}await unlink(file);saved+=size;}
 console.log('Shared exact Unity stage assets through their immutable GitHub source: '+(saved/1048576).toFixed(1)+' MiB.');return{saved,source:UNITY_STAGE_SOURCE};}
